export interface SsoUserInfo {
  id: string
  username: string
  email?: string
  displayName: string
}

export interface PipelineStepCondition {
  field: string
  operator: 'exists' | 'equals' | 'notEmpty'
  value?: string
}

export interface PipelineStep {
  name: string
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  params?: Record<string, string>
  headers?: Record<string, string>
  body?: Record<string, unknown>
  contentType?: 'json' | 'form'
  extract?: Record<string, string>
  condition?: PipelineStepCondition
}

export interface AdvancedConfig {
  pipeline: PipelineStep[]
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
    advancedConfig?: AdvancedConfig
  }): Promise<{ accessToken: string; steps?: Record<string, Record<string, unknown>> }>

  getUserInfo(params: {
    accessToken: string
    userInfoUrl?: string
    advancedConfig?: AdvancedConfig
    steps?: Record<string, Record<string, unknown>>
  }): Promise<SsoUserInfo>
}

export const SSO_PROVIDER_TYPES = {
  GENERIC: 'GENERIC',
  FEISHU: 'FEISHU',
  CUSTOM: 'CUSTOM'
} as const

export type SsoProviderType = typeof SSO_PROVIDER_TYPES[keyof typeof SSO_PROVIDER_TYPES]
