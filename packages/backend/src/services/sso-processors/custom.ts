import type { SsoProcessor, SsoUserInfo, AdvancedConfig, PipelineStep } from '../sso-processor.js'

function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.replace(/^\$\./, '').split('.')
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

function renderTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
    const trimmedPath = path.trim()
    const value = getValueByPath(context, trimmedPath)
    return value !== undefined && value !== null ? String(value) : ''
  })
}

function renderObject(obj: Record<string, unknown>, context: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = renderTemplate(value, context)
    } else if (typeof value === 'object' && value !== null) {
      result[key] = renderObject(value as Record<string, unknown>, context)
    } else {
      result[key] = value
    }
  }
  return result
}

function evaluateCondition(
  condition: PipelineStep['condition'],
  context: Record<string, unknown>
): boolean {
  if (!condition) return true

  const value = getValueByPath(context, condition.field)

  switch (condition.operator) {
    case 'exists':
      return value !== undefined
    case 'notEmpty':
      return value !== undefined && value !== null && value !== ''
    case 'equals':
      return String(value) === condition.value
    default:
      return true
  }
}

async function executeStep(
  step: PipelineStep,
  context: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = renderTemplate(step.url, context)
  
  const headers: Record<string, string> = {}
  if (step.headers) {
    for (const [key, value] of Object.entries(step.headers)) {
      headers[key] = renderTemplate(value, context)
    }
  }

  let finalUrl = url
  let body: string | undefined

  if (step.method === 'GET' && step.params) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(step.params)) {
      params.append(key, renderTemplate(value, context))
    }
    finalUrl = `${url}?${params.toString()}`
  } else if (step.body) {
    const renderedBody = renderObject(step.body, context)
    
    if (step.contentType === 'form') {
      const formParams = new URLSearchParams()
      for (const [key, value] of Object.entries(renderedBody)) {
        formParams.append(key, String(value))
      }
      body = formParams.toString()
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
    } else {
      body = JSON.stringify(renderedBody)
      headers['Content-Type'] = 'application/json'
    }
  }

  const response = await fetch(finalUrl, {
    method: step.method,
    headers,
    body: body && step.method !== 'GET' ? body : undefined
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Step '${step.name}' failed: ${response.status} - ${errorText}`)
  }

  const responseData = await response.json() as Record<string, unknown>
  
  const extracted: Record<string, unknown> = {}
  if (step.extract) {
    for (const [outputKey, jsonPath] of Object.entries(step.extract)) {
      const value = getValueByPath(responseData, jsonPath)
      if (value !== undefined) {
        extracted[outputKey] = value
      }
    }
  }

  return extracted
}

async function executePipeline(
  pipeline: PipelineStep[],
  initialContext: Record<string, unknown>
): Promise<{ steps: Record<string, Record<string, unknown>>; lastResult: Record<string, unknown> }> {
  const steps: Record<string, Record<string, unknown>> = {}
  const context = { ...initialContext, steps }

  for (const step of pipeline) {
    if (!evaluateCondition(step.condition, context)) {
      continue
    }

    const extracted = await executeStep(step, context)
    steps[step.name] = extracted
    context.steps = { ...steps }
  }

  const lastStep = pipeline[pipeline.length - 1]
  const lastResult = steps[lastStep?.name] || {}

  return { steps, lastResult }
}

const CustomSsoProcessor: SsoProcessor = {
  getAuthorizeUrl(params) {
    const urlParams: Record<string, string> = {
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      response_type: 'code',
      state: params.state
    }

    if (params.scope && params.scope.trim()) {
      urlParams.scope = params.scope
    }

    return new URLSearchParams(urlParams).toString()
  },

  async exchangeCode(params) {
    if (!params.advancedConfig?.pipeline?.length) {
      throw new Error('Pipeline configuration is required for CUSTOM SSO')
    }

    const context: Record<string, unknown> = {
      clientId: params.clientId,
      clientSecret: params.clientSecret,
      appId: params.appId,
      appSecret: params.appSecret,
      code: params.code,
      redirectUri: params.redirectUri,
      tokenUrl: params.tokenUrl
    }

    const pipeline = params.advancedConfig.pipeline
    const { steps, lastResult } = await executePipeline(pipeline, context)

    const accessToken = lastResult.accessToken || lastResult.access_token
    if (!accessToken) {
      throw new Error('Access token not found in pipeline result')
    }

    const mapping = params.advancedConfig.userFieldMapping || {}
    const idField = mapping.id || 'id'
    const usernameField = mapping.username || 'username'
    const emailField = mapping.email || 'email'
    const displayNameField = mapping.displayName || 'displayName'

    const id = lastResult[idField] || lastResult.id
    const username = lastResult[usernameField] || lastResult.username || id
    const email = lastResult[emailField] || lastResult.email
    const displayName = lastResult[displayNameField] || lastResult.displayName || username

    const userInfo: SsoUserInfo = {
      id: String(id || ''),
      username: String(username || ''),
      email: email ? String(email) : undefined,
      displayName: String(displayName || '')
    }

    return { 
      accessToken: String(accessToken),
      steps,
      userInfo
    }
  },

  async getUserInfo(params) {
    if (params.steps) {
      const mapping = params.advancedConfig?.userFieldMapping || {}
      const lastStepName = Object.keys(params.steps).pop()
      const lastResult = lastStepName ? params.steps[lastStepName] : {}

      const idField = mapping.id || 'id'
      const usernameField = mapping.username || 'username'
      const emailField = mapping.email || 'email'
      const displayNameField = mapping.displayName || 'displayName'

      const id = lastResult[idField] || lastResult.id
      const username = lastResult[usernameField] || lastResult.username || id
      const email = lastResult[emailField] || lastResult.email
      const displayName = lastResult[displayNameField] || lastResult.displayName || username

      return {
        id: String(id || ''),
        username: String(username || ''),
        email: email ? String(email) : undefined,
        displayName: String(displayName || '')
      }
    }

    throw new Error('Pipeline steps are required for CUSTOM SSO getUserInfo')
  }
}

export default CustomSsoProcessor
