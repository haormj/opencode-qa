export interface SsoUserInfo {
  id: string
  username: string
  email?: string
  displayName: string
}

export interface SsoProcessor {
  getAuthorizeUrl(params: {
    clientId: string
    redirectUri: string
    state: string
    scope?: string
    appId?: string
  }): string

  exchangeCode(params: {
    code: string
    redirectUri: string
    clientId?: string
    clientSecret?: string
    appId?: string
    appSecret?: string
    tokenUrl: string
  }): Promise<{ accessToken: string }>

  getUserInfo(params: {
    accessToken: string
    userInfoUrl?: string
  }): Promise<SsoUserInfo>
}

export const SSO_PROVIDER_TYPES = {
  GENERIC: 'GENERIC',
  FEISHU: 'FEISHU'
} as const

export type SsoProviderType = typeof SSO_PROVIDER_TYPES[keyof typeof SSO_PROVIDER_TYPES]
