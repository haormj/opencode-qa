import type { SsoProcessor, SsoUserInfo, AdvancedConfig } from '../sso-processor.js'

function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  return current
}

function replaceTemplateVariables(
  template: string,
  variables: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path: string) => {
    const value = getValueByPath(variables, path)
    return value !== undefined ? String(value) : ''
  })
}

function replaceBodyTemplate(
  body: Record<string, unknown>,
  variables: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      result[key] = replaceTemplateVariables(value, variables)
    } else if (typeof value === 'object' && value !== null) {
      result[key] = replaceBodyTemplate(value as Record<string, unknown>, variables)
    } else {
      result[key] = value
    }
  }
  return result
}

async function executePreRequests(
  preRequests: NonNullable<AdvancedConfig['preRequests']>,
  context: Record<string, unknown>
): Promise<Record<string, Record<string, unknown>>> {
  const results: Record<string, Record<string, unknown>> = {}

  for (const preRequest of preRequests) {
    const url = replaceTemplateVariables(preRequest.url, context)
    const headers: Record<string, string> = {}
    
    if (preRequest.headers) {
      for (const [key, value] of Object.entries(preRequest.headers)) {
        headers[key] = replaceTemplateVariables(value, context)
      }
    }

    let body: string | undefined
    if (preRequest.body && preRequest.method === 'POST') {
      const processedBody = replaceBodyTemplate(preRequest.body, context)
      body = JSON.stringify(processedBody)
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(url, {
      method: preRequest.method,
      headers,
      body
    })

    if (!response.ok) {
      throw new Error(`Pre-request '${preRequest.name}' failed: ${response.status}`)
    }

    const responseData = await response.json() as Record<string, unknown>
    
    if (preRequest.responseFields) {
      results[preRequest.name] = {}
      for (const [outputKey, path] of Object.entries(preRequest.responseFields)) {
        const value = getValueByPath(responseData, path)
        if (value !== undefined) {
          results[preRequest.name][outputKey] = value
        }
      }
    }

    context[preRequest.name] = results[preRequest.name] || responseData
  }

  return results
}

const CustomSsoProcessor: SsoProcessor = {
  getAuthorizeUrl(params) {
    const { clientId, redirectUri, state, scope, advancedConfig } = params
    
    const urlParams: Record<string, string> = {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state
    }

    if (scope && scope.trim()) {
      urlParams.scope = scope
    }

    if (advancedConfig?.authorize?.extraParams) {
      Object.assign(urlParams, advancedConfig.authorize.extraParams)
    }

    return new URLSearchParams(urlParams).toString()
  },

  async exchangeCode(params) {
    const { code, redirectUri, clientId, clientSecret, tokenUrl, advancedConfig } = params
    
    let context: Record<string, unknown> = { code, redirectUri, clientId, clientSecret }
    
    if (advancedConfig?.preRequests) {
      const preRequestResults = await executePreRequests(advancedConfig.preRequests, context)
      context.preRequests = preRequestResults
    }

    const contentType = advancedConfig?.tokenExchange?.contentType || 'application/x-www-form-urlencoded'
    
    let body: string
    if (advancedConfig?.tokenExchange?.bodyTemplate) {
      const processedBody = replaceBodyTemplate(advancedConfig.tokenExchange.bodyTemplate, context)
      body = JSON.stringify(processedBody)
    } else {
      const formParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId || '',
        client_secret: clientSecret || ''
      })
      body = formParams.toString()
    }

    const headers: Record<string, string> = {
      'Content-Type': contentType
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers,
      body
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token exchange failed: ${errorText}`)
    }

    const data = await response.json() as Record<string, unknown>
    const accessTokenPath = advancedConfig?.tokenExchange?.accessTokenPath || 'access_token'
    const accessToken = getValueByPath(data, accessTokenPath)

    if (typeof accessToken !== 'string') {
      throw new Error('Access token not found in response')
    }

    return { accessToken }
  },

  async getUserInfo(params) {
    const { accessToken, userInfoUrl, advancedConfig, userIdField, usernameField, emailField, displayNameField } = params

    if (!userInfoUrl) {
      throw new Error('User info URL is required for CUSTOM SSO')
    }

    const method = advancedConfig?.userInfo?.method || 'GET'
    const accessTokenLocation = advancedConfig?.userInfo?.accessTokenLocation || 'header'
    const accessTokenPrefix = advancedConfig?.userInfo?.accessTokenPrefix || 'Bearer '

    const headers: Record<string, string> = {
      ...advancedConfig?.userInfo?.headers
    }

    let url = userInfoUrl
    if (accessTokenLocation === 'header') {
      headers['Authorization'] = `${accessTokenPrefix}${accessToken}`
    } else if (accessTokenLocation === 'query') {
      const separator = userInfoUrl.includes('?') ? '&' : '?'
      url = `${userInfoUrl}${separator}access_token=${encodeURIComponent(accessToken)}`
    }

    const response = await fetch(url, {
      method,
      headers
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch user info: ${errorText}`)
    }

    const data = await response.json() as Record<string, unknown>

    const responsePaths = advancedConfig?.userInfo?.responsePaths || {}

    const idPath = responsePaths.id || userIdField || 'sub'
    const usernamePath = responsePaths.username || usernameField || 'preferred_username'
    const emailPath = responsePaths.email || emailField || 'email'
    const displayNamePath = responsePaths.displayName || displayNameField || 'name'

    return {
      id: String(getValueByPath(data, idPath) || ''),
      username: String(getValueByPath(data, usernamePath) || ''),
      email: getValueByPath(data, emailPath) ? String(getValueByPath(data, emailPath)) : undefined,
      displayName: String(getValueByPath(data, displayNamePath) || '')
    }
  }
}

export default CustomSsoProcessor
