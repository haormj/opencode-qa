import crypto from 'crypto'
import { prisma } from '../index.js'
import { createToken } from './token.js'

interface SsoState {
  nonce: string
  provider: string
  createdAt: number
}

const stateStore = new Map<string, SsoState>()
const STATE_EXPIRES_MS = 5 * 60 * 1000

function cleanupExpiredStates(): void {
  const now = Date.now()
  for (const [key, state] of stateStore.entries()) {
    if (now - state.createdAt > STATE_EXPIRES_MS) {
      stateStore.delete(key)
    }
  }
}

export async function getSsoProviders() {
  const providers = await prisma.ssoProvider.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      displayName: true,
      icon: true,
      iconMimeType: true
    }
  })
  return providers
}

export async function getSsoProvider(name: string) {
  const provider = await prisma.ssoProvider.findUnique({
    where: { name, enabled: true }
  })
  return provider
}

export async function buildAuthorizeUrl(provider: string, redirectUri: string): Promise<{ authorizeUrl: string; state: string }> {
  const ssoProvider = await getSsoProvider(provider)
  if (!ssoProvider) {
    throw new Error('SSO provider not found or disabled')
  }

  cleanupExpiredStates()

  const nonce = crypto.randomBytes(16).toString('hex')
  const state = crypto.randomBytes(16).toString('hex')

  stateStore.set(state, {
    nonce,
    provider,
    createdAt: Date.now()
  })

  const params = new URLSearchParams({
    client_id: ssoProvider.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: ssoProvider.scope,
    state
  })

  const authorizeUrl = `${ssoProvider.authorizeUrl}?${params.toString()}`

  return { authorizeUrl, state }
}

export function verifyState(state: string): { valid: boolean; provider?: string } {
  cleanupExpiredStates()

  const stateData = stateStore.get(state)
  if (!stateData) {
    return { valid: false }
  }

  if (Date.now() - stateData.createdAt > STATE_EXPIRES_MS) {
    stateStore.delete(state)
    return { valid: false }
  }

  stateStore.delete(state)
  return { valid: true, provider: stateData.provider }
}

export async function exchangeCodeForToken(
  providerName: string,
  code: string,
  redirectUri: string
): Promise<string> {
  const provider = await getSsoProvider(providerName)
  if (!provider) {
    throw new Error('SSO provider not found')
  }

  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: provider.clientId,
      client_secret: provider.clientSecret
    }).toString()
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token exchange failed: ${errorText}`)
  }

  const data = await response.json() as { access_token: string }
  return data.access_token
}

export async function fetchUserInfo(providerName: string, accessToken: string): Promise<Record<string, unknown>> {
  const provider = await getSsoProvider(providerName)
  if (!provider || !provider.userInfoUrl) {
    throw new Error('SSO provider or user info URL not found')
  }

  const response = await fetch(provider.userInfoUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to fetch user info: ${errorText}`)
  }

  return response.json() as Promise<Record<string, unknown>>
}

export async function findOrCreateUser(
  providerName: string,
  userInfo: Record<string, unknown>,
  provider: { userIdField: string; usernameField: string; emailField: string; displayNameField: string }
): Promise<{ id: string; username: string; displayName: string; email: string | null }> {
  const ssoUserId = String(userInfo[provider.userIdField] || '')
  const username = String(userInfo[provider.usernameField] || ssoUserId)
  const email = userInfo[provider.emailField] ? String(userInfo[provider.emailField]) : null
  const displayName = String(userInfo[provider.displayNameField] || username)

  if (!ssoUserId) {
    throw new Error('SSO user ID not found in user info')
  }

  let user = await prisma.user.findFirst({
    where: {
      ssoProvider: providerName,
      ssoUserId
    }
  })

  if (user) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email
    }
  }

  if (email) {
    user = await prisma.user.findUnique({
      where: { email }
    })

    if (user) {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          ssoProvider: providerName,
          ssoUserId
        }
      })

      return {
        id: updatedUser.id,
        username: updatedUser.username,
        displayName: updatedUser.displayName,
        email: updatedUser.email
      }
    }
  }

  let uniqueUsername = username
  let counter = 1
  while (await prisma.user.findUnique({ where: { username: uniqueUsername } })) {
    uniqueUsername = `${username}_${counter}`
    counter++
  }

  const newUser = await prisma.user.create({
    data: {
      username: uniqueUsername,
      email,
      displayName,
      ssoProvider: providerName,
      ssoUserId,
      password: null
    }
  })

  const userRole = await prisma.role.findUnique({
    where: { name: 'user' }
  })

  if (userRole) {
    await prisma.userRole.create({
      data: {
        userId: newUser.id,
        roleId: userRole.id
      }
    })
  }

  return {
    id: newUser.id,
    username: newUser.username,
    displayName: newUser.displayName,
    email: newUser.email
  }
}

export async function ssoLogin(
  providerName: string,
  code: string,
  redirectUri: string,
  userAgent?: string,
  ipAddress?: string
): Promise<{ token: string; user: { id: string; username: string; displayName: string; email: string | null } }> {
  const provider = await getSsoProvider(providerName)
  if (!provider) {
    throw new Error('SSO provider not found')
  }

  const accessToken = await exchangeCodeForToken(providerName, code, redirectUri)
  const userInfo = await fetchUserInfo(providerName, accessToken)
  const user = await findOrCreateUser(providerName, userInfo, provider)
  const token = await createToken(user.id, userAgent, ipAddress)

  return { token, user }
}
