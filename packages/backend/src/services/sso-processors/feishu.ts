import type { SsoProcessor, SsoUserInfo } from '../sso-processor.js'

export const FEISHU_DEFAULTS = {
  AUTHORIZE_URL: 'https://open.feishu.cn/open-apis/authen/v1/authorize',
  TOKEN_URL: 'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token',
  USER_INFO_URL: 'https://open.feishu.cn/open-apis/authen/v1/user_info'
}

interface FeishuTokenResponse {
  code: number
  msg: string
  tenant_access_token?: string
  app_access_token?: string
}

interface FeishuUserTokenResponse {
  code: number
  msg: string
  data?: {
    access_token: string
    refresh_token: string
    token_type: string
    expires_in: number
  }
}

interface FeishuUserInfoResponse {
  code: number
  msg: string
  data?: {
    name: string
    en_name: string
    avatar_url: string
    email: string
    mobile: string
    open_id: string
    union_id: string
    user_id: string
  }
}

const FeishuSsoProcessor: SsoProcessor = {
  getAuthorizeUrl(params) {
    const appId = params.appId || params.clientId
    const url = new URLSearchParams({
      app_id: appId,
      redirect_uri: params.redirectUri,
      state: params.state
    })

    return url.toString()
  },

  async exchangeCode(params) {
    const appId = params.appId || params.clientId
    const appSecret = params.appSecret || params.clientSecret

    if (!appId || !appSecret) {
      throw new Error('App ID and App Secret are required for Feishu SSO')
    }

    const appAccessTokenResp = await fetch('https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret
      })
    })

    if (!appAccessTokenResp.ok) {
      const errorText = await appAccessTokenResp.text()
      throw new Error(`Failed to get app access token: ${errorText}`)
    }

    const appAccessTokenData = await appAccessTokenResp.json() as FeishuTokenResponse
    if (appAccessTokenData.code !== 0 || !appAccessTokenData.app_access_token) {
      throw new Error(`Feishu API error: ${appAccessTokenData.msg}`)
    }

    const userTokenResp = await fetch('https://open.feishu.cn/open-apis/authen/v1/oidc/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appAccessTokenData.app_access_token}`
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: params.code
      })
    })

    if (!userTokenResp.ok) {
      const errorText = await userTokenResp.text()
      throw new Error(`Failed to exchange code: ${errorText}`)
    }

    const userTokenData = await userTokenResp.json() as FeishuUserTokenResponse
    if (userTokenData.code !== 0 || !userTokenData.data) {
      throw new Error(`Feishu API error: ${userTokenData.msg}`)
    }

    return { accessToken: userTokenData.data.access_token }
  },

  async getUserInfo(params) {
    const response = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
      headers: {
        'Authorization': `Bearer ${params.accessToken}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch user info: ${errorText}`)
    }

    const data = await response.json() as FeishuUserInfoResponse
    if (data.code !== 0 || !data.data) {
      throw new Error(`Feishu API error: ${data.msg}`)
    }

    const user = data.data
    return {
      id: user.open_id,
      username: user.en_name || user.name || user.open_id,
      email: user.email || undefined,
      displayName: user.name
    }
  }
}

export default FeishuSsoProcessor
