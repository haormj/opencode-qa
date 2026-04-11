export interface SsoUserInfo {
  id: string
  username: string
  email?: string
  displayName: string
}

export interface AdvancedConfig {
  authorize?: {
    method?: 'GET' | 'POST'
    extraParams?: Record<string, string>
    paramsEncoding?: 'query' | 'body'
  }
  preRequests?: Array<{
    name: string
    url: string
    method: 'GET' | 'POST'
    headers?: Record<string, string>
    body?: Record<string, unknown>
    responseFields?: Record<string, string>
  }>
  tokenExchange?: {
    contentType?: 'application/x-www-form-urlencoded' | 'application/json'
    bodyTemplate?: Record<string, unknown>
    accessTokenPath?: string
  }
  userInfo?: {
    method?: 'GET' | 'POST'
    headers?: Record<string, string>
    accessTokenLocation?: 'header' | 'query'
    accessTokenPrefix?: string
    responsePaths?: {
      id?: string
      username?: string
      email?: string
      displayName?: string
    }
  }
}

export interface SsoProcessor {
  getAuthorizeUrl(params: {
    clientId: string
    redirectUri: string
    state: string
    scope?: string
    appId?: string
    advancedConfig?: AdvancedConfig
  }): string

  exchangeCode(params: {
    code: string
    redirectUri: string
    clientId?: string
    clientSecret?: string
    appId?: string
    appSecret?: string
    tokenUrl: string
    advancedConfig?: AdvancedConfig
    preRequestResults?: Record<string, Record<string, unknown>>
  }): Promise<{ accessToken: string }>

  getUserInfo(params: {
    accessToken: string
    userInfoUrl?: string
    advancedConfig?: AdvancedConfig
    userIdField?: string
    usernameField?: string
    emailField?: string
    displayNameField?: string
  }): Promise<SsoUserInfo>
}

export const SSO_PROVIDER_TYPES = {
  GENERIC: 'GENERIC',
  FEISHU: 'FEISHU',
  CUSTOM: 'CUSTOM'
} as const

export type SsoProviderType = typeof SSO_PROVIDER_TYPES[keyof typeof SSO_PROVIDER_TYPES]
