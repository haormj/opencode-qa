import type { SsoProcessor, SsoUserInfo } from '../sso-processor.js'

const GenericSsoProcessor: SsoProcessor = {
  getAuthorizeUrl(params) {
    const url = new URLSearchParams({
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      response_type: 'code',
      state: params.state
    })

    if (params.scope && params.scope.trim()) {
      url.append('scope', params.scope)
    }

    return url.toString()
  },

  async exchangeCode(params) {
    const response = await fetch(params.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: params.code,
        redirect_uri: params.redirectUri,
        client_id: params.clientId || '',
        client_secret: params.clientSecret || ''
      }).toString()
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token exchange failed: ${errorText}`)
    }

    const data = await response.json() as { access_token: string }
    return { accessToken: data.access_token }
  },

  async getUserInfo(params) {
    if (!params.userInfoUrl) {
      throw new Error('User info URL is required for GENERIC SSO')
    }

    const response = await fetch(params.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${params.accessToken}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch user info: ${errorText}`)
    }

    const data = await response.json() as Record<string, unknown>
    const userIdField = params.userIdField || 'sub'
    const usernameField = params.usernameField || 'preferred_username'
    const emailField = params.emailField || 'email'
    const displayNameField = params.displayNameField || 'name'

    return {
      id: String(data[userIdField as keyof typeof data] || data.sub || data.id || ''),
      username: String(data[usernameField as keyof typeof data] || data.preferred_username || data.username || data.name || ''),
      email: data[emailField as keyof typeof data] ? String(data[emailField as keyof typeof data]) : undefined,
      displayName: String(data[displayNameField as keyof typeof data] || data.name || data.display_name || data.preferred_username || '')
    }
  }
}

export default GenericSsoProcessor
