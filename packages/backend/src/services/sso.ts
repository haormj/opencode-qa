import crypto from 'crypto'
import { db, ssoProviders, users, roles, userRoles } from '../db/index.js'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { createToken } from './token.js'
import type { SsoProcessor, SsoProviderType, AdvancedConfig } from './sso-processor.js'
import { SSO_PROVIDER_TYPES } from './sso-processor.js'
import GenericSsoProcessor from './sso-processors/generic.js'
import FeishuSsoProcessor from './sso-processors/feishu.js'
import CustomSsoProcessor from './sso-processors/custom.js'

interface SsoState {
  nonce: string
  provider: string
  createdAt: number
}

const stateStore = new Map<string, SsoState>()
const STATE_EXPIRES_MS = 5 * 60 * 1000

function parseAdvancedConfig(configJson: string | null): AdvancedConfig | undefined {
  if (!configJson) return undefined
  try {
    return JSON.parse(configJson) as AdvancedConfig
  } catch {
    return undefined
  }
}

function cleanupExpiredStates(): void {
  const now = Date.now()
  for (const [key, state] of stateStore.entries()) {
    if (now - state.createdAt > STATE_EXPIRES_MS) {
      stateStore.delete(key)
    }
  }
}

function getSsoProcessor(type: string): SsoProcessor {
  switch (type) {
    case SSO_PROVIDER_TYPES.GENERIC:
      return GenericSsoProcessor
    case SSO_PROVIDER_TYPES.FEISHU:
      return FeishuSsoProcessor
    case SSO_PROVIDER_TYPES.CUSTOM:
      return CustomSsoProcessor
    default:
      throw new Error(`Unknown SSO provider type: ${type}`)
  }
}

export async function getSsoProviders() {
  const providerList = await db.select({
    id: ssoProviders.id,
    name: ssoProviders.name,
    displayName: ssoProviders.displayName,
    icon: ssoProviders.icon,
    iconMimeType: ssoProviders.iconMimeType
  }).from(ssoProviders).where(eq(ssoProviders.enabled, true)).orderBy(ssoProviders.sortOrder)
  return providerList
}

export async function getSsoProvider(name: string) {
  const provider = await db.select().from(ssoProviders).where(and(eq(ssoProviders.name, name), eq(ssoProviders.enabled, true))).get()
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

  const processor = getSsoProcessor(ssoProvider.type)
  const params = processor.getAuthorizeUrl({
    clientId: ssoProvider.clientId || '',
    redirectUri,
    state,
    scope: ssoProvider.scope,
    appId: ssoProvider.appId || undefined
  })

  const authorizeUrl = `${ssoProvider.authorizeUrl}?${params}`

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
): Promise<{ accessToken: string; steps?: Record<string, Record<string, unknown>> }> {
  const provider = await getSsoProvider(providerName)
  if (!provider) {
    throw new Error('SSO provider not found')
  }

  const processor = getSsoProcessor(provider.type)
  const advancedConfig = parseAdvancedConfig(provider.advancedConfig)
  const result = await processor.exchangeCode({
    code,
    redirectUri,
    clientId: provider.clientId || undefined,
    clientSecret: provider.clientSecret || undefined,
    appId: provider.appId || undefined,
    appSecret: provider.appSecret || undefined,
    tokenUrl: provider.tokenUrl,
    advancedConfig
  })

  return { accessToken: result.accessToken, steps: result.steps }
}

export async function fetchUserInfo(
  providerName: string, 
  accessToken: string,
  steps?: Record<string, Record<string, unknown>>
): Promise<Record<string, unknown>> {
  const provider = await getSsoProvider(providerName)
  if (!provider) {
    throw new Error('SSO provider not found')
  }

  const processor = getSsoProcessor(provider.type)
  const advancedConfig = parseAdvancedConfig(provider.advancedConfig)
  const userInfo = await processor.getUserInfo({
    accessToken,
    userInfoUrl: provider.userInfoUrl || undefined,
    advancedConfig,
    steps
  })

  return {
    [provider.userIdField]: userInfo.id,
    [provider.usernameField]: userInfo.username,
    [provider.emailField]: userInfo.email,
    [provider.displayNameField]: userInfo.displayName
  }
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

  let user = await db.select().from(users).where(and(eq(users.ssoProvider, providerName), eq(users.ssoUserId, ssoUserId))).get()

  if (user) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email
    }
  }

  if (email) {
    user = await db.select().from(users).where(eq(users.email, email)).get()

    if (user) {
      const now = new Date()
      const [updatedUser] = await db.update(users).set({
        ssoProvider: providerName,
        ssoUserId,
        updatedAt: now
      }).where(eq(users.id, user.id)).returning()

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
  while (await db.select().from(users).where(eq(users.username, uniqueUsername)).get()) {
    uniqueUsername = `${username}_${counter}`
    counter++
  }

  const now = new Date()
  const [newUser] = await db.insert(users).values({
    id: randomUUID(),
    username: uniqueUsername,
    email,
    displayName,
    ssoProvider: providerName,
    ssoUserId,
    password: '',
    createdAt: now,
    updatedAt: now
  }).returning()

  const userRole = await db.select().from(roles).where(eq(roles.name, 'user')).get()

  if (userRole) {
    await db.insert(userRoles).values({
      userId: newUser.id,
      roleId: userRole.id,
      assignedAt: now
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

  const { accessToken, steps } = await exchangeCodeForToken(providerName, code, redirectUri)
  const userInfo = await fetchUserInfo(providerName, accessToken, steps)
  const user = await findOrCreateUser(providerName, userInfo, provider)
  const token = await createToken(user.id, userAgent, ipAddress)

  return { token, user }
}
