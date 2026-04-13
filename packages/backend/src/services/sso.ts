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
import logger from './logger.js'

function maskSecret(value: string | undefined | null, visibleChars: number = 3): string {
  if (!value) return '(empty)'
  if (value.length <= visibleChars) return '***'
  return `${value.substring(0, visibleChars)}***`
}

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
  logger.debug(`[SSO] buildAuthorizeUrl started: provider=${provider}, redirectUri=${redirectUri}`)
  
  const ssoProvider = await getSsoProvider(provider)
  if (!ssoProvider) {
    logger.error(`[SSO] buildAuthorizeUrl failed: provider not found or disabled`)
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
  const advancedConfig = parseAdvancedConfig(ssoProvider.advancedConfig)
  logger.debug(`[SSO] buildAuthorizeUrl: type=${ssoProvider.type}, hasAdvancedConfig=${!!advancedConfig}`)

  if (ssoProvider.type === SSO_PROVIDER_TYPES.CUSTOM) {
    if (!advancedConfig?.authorizeUrlTemplate) {
      logger.error(`[SSO] buildAuthorizeUrl failed: authorizeUrlTemplate missing for CUSTOM type`)
      throw new Error('Authorize URL template is required for CUSTOM SSO provider')
    }
    
    const context: Record<string, unknown> = {
      clientId: ssoProvider.clientId || '',
      clientSecret: ssoProvider.clientSecret || '',
      appId: ssoProvider.appId || '',
      appSecret: ssoProvider.appSecret || '',
      redirectUri,
      state,
      scope: ssoProvider.scope || ''
    }
    logger.debug(`[SSO] CUSTOM template context: ${JSON.stringify(context)}`)
    
    const authorizeUrl = advancedConfig.authorizeUrlTemplate.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
      const trimmedKey = key.trim()
      const value = context[trimmedKey]
      return value !== undefined && value !== null ? String(value) : ''
    })

    logger.debug(`[SSO] buildAuthorizeUrl completed: authorizeUrl=${authorizeUrl}`)
    return { authorizeUrl, state }
  }

  const params = processor.getAuthorizeUrl({
    clientId: ssoProvider.clientId || '',
    redirectUri,
    state,
    scope: ssoProvider.scope,
    appId: ssoProvider.appId || undefined
  })

  const authorizeUrl = `${ssoProvider.authorizeUrl}?${params}`

  logger.debug(`[SSO] buildAuthorizeUrl completed: authorizeUrl=${authorizeUrl}`)
  return { authorizeUrl, state }
}

export function verifyState(state: string): { valid: boolean; provider?: string } {
  cleanupExpiredStates()

  const stateData = stateStore.get(state)
  if (!stateData) {
    logger.debug(`[SSO] verifyState failed: state not found`)
    return { valid: false }
  }

  if (Date.now() - stateData.createdAt > STATE_EXPIRES_MS) {
    stateStore.delete(state)
    logger.debug(`[SSO] verifyState failed: state expired`)
    return { valid: false }
  }

  stateStore.delete(state)
  logger.debug(`[SSO] verifyState success: provider=${stateData.provider}`)
  return { valid: true, provider: stateData.provider }
}

export async function exchangeCodeForToken(
  providerName: string,
  code: string,
  redirectUri: string
): Promise<{ 
  accessToken?: string
  steps?: Record<string, Record<string, unknown>>
  userInfo?: { id: string; username: string; email?: string; displayName: string }
}> {
  logger.debug(`[SSO] exchangeCodeForToken started: provider=${providerName}, code=${maskSecret(code)}`)
  
  const provider = await getSsoProvider(providerName)
  if (!provider) {
    logger.error(`[SSO] exchangeCodeForToken failed: provider not found`)
    throw new Error('SSO provider not found')
  }

  const processor = getSsoProcessor(provider.type)
  const advancedConfig = parseAdvancedConfig(provider.advancedConfig)
  logger.debug(`[SSO] exchangeCodeForToken: type=${provider.type}`)
  
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

  logger.debug(`[SSO] exchangeCodeForToken completed: accessToken=${maskSecret(result.accessToken)}, hasSteps=${!!result.steps}, hasUserInfo=${!!result.userInfo}`)
  return { 
    accessToken: result.accessToken, 
    steps: result.steps,
    userInfo: result.userInfo
  }
}

export async function fetchUserInfo(
  providerName: string, 
  accessToken?: string,
  steps?: Record<string, Record<string, unknown>>,
  existingUserInfo?: { id: string; username: string; email?: string; displayName: string }
): Promise<Record<string, unknown>> {
  logger.debug(`[SSO] fetchUserInfo started: provider=${providerName}, hasExistingUserInfo=${!!existingUserInfo}`)
  
  const provider = await getSsoProvider(providerName)
  if (!provider) {
    logger.error(`[SSO] fetchUserInfo failed: provider not found`)
    throw new Error('SSO provider not found')
  }

  if (existingUserInfo) {
    const mappedInfo = {
      [provider.userIdField]: existingUserInfo.id,
      [provider.usernameField]: existingUserInfo.username,
      [provider.emailField]: existingUserInfo.email,
      [provider.displayNameField]: existingUserInfo.displayName
    }
    logger.debug(`[SSO] fetchUserInfo completed (from existing): id=${existingUserInfo.id}, username=${existingUserInfo.username}`)
    return mappedInfo
  }

  if (!accessToken) {
    logger.error(`[SSO] fetchUserInfo failed: accessToken is required when existingUserInfo is not provided`)
    throw new Error('Access token is required when existing user info is not provided')
  }

  const processor = getSsoProcessor(provider.type)
  const advancedConfig = parseAdvancedConfig(provider.advancedConfig)
  const userInfo = await processor.getUserInfo({
    accessToken,
    userInfoUrl: provider.userInfoUrl || undefined,
    advancedConfig,
    steps,
    fieldMapping: {
      userIdField: provider.userIdField,
      usernameField: provider.usernameField,
      emailField: provider.emailField,
      displayNameField: provider.displayNameField
    }
  })

  const mappedInfo = {
    [provider.userIdField]: userInfo.id,
    [provider.usernameField]: userInfo.username,
    [provider.emailField]: userInfo.email,
    [provider.displayNameField]: userInfo.displayName
  }
  
  logger.debug(`[SSO] fetchUserInfo completed: id=${userInfo.id}, username=${userInfo.username}, email=${userInfo.email || '(none)'}`)
  return mappedInfo
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

  logger.debug(`[SSO] findOrCreateUser: ssoUserId=${ssoUserId}, username=${username}, email=${email || '(none)'}`)

  if (!ssoUserId) {
    logger.error(`[SSO] findOrCreateUser failed: SSO user ID not found in user info`)
    throw new Error('SSO user ID not found in user info')
  }

  let user = await db.select().from(users).where(and(eq(users.ssoProvider, providerName), eq(users.ssoUserId, ssoUserId))).get()

  if (user) {
    logger.debug(`[SSO] findOrCreateUser: found existing user by SSO, id=${user.id}`)
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
      logger.debug(`[SSO] findOrCreateUser: found existing user by email, linking SSO, id=${user.id}`)
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

  logger.debug(`[SSO] findOrCreateUser: creating new user, username=${uniqueUsername}`)
  
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

  logger.debug(`[SSO] findOrCreateUser: created new user, id=${newUser.id}`)
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
): Promise<{ token: string; user: { id: string; username: string; displayName: string; email: string | null; roles: string[] } }> {
  logger.debug(`[SSO] ssoLogin started: provider=${providerName}`)
  
  const provider = await getSsoProvider(providerName)
  if (!provider) {
    logger.error(`[SSO] ssoLogin failed: provider not found`)
    throw new Error('SSO provider not found')
  }

  logger.debug(`[SSO] ssoLogin: step 1/4 - exchanging code for token`)
  const { accessToken, steps, userInfo: existingUserInfo } = await exchangeCodeForToken(providerName, code, redirectUri)
  
  logger.debug(`[SSO] ssoLogin: step 2/4 - fetching user info`)
  const userInfo = await fetchUserInfo(providerName, accessToken, steps, existingUserInfo)
  
  logger.debug(`[SSO] ssoLogin: step 3/4 - finding or creating user`)
  const user = await findOrCreateUser(providerName, userInfo, provider)
  
  const userRoleRecords = await db
    .select({ role: roles })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id))

  const rolesList = userRoleRecords.map(ur => ur.role.name)
  
  logger.debug(`[SSO] ssoLogin: step 4/4 - creating token`)
  const token = await createToken(user.id, userAgent, ipAddress)

  logger.debug(`[SSO] ssoLogin completed: userId=${user.id}, username=${user.username}, roles=${rolesList.join(',')}`)
  return { token, user: { ...user, roles: rolesList } }
}
