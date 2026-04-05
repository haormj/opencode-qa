const OPENCODE_SERVER_USERNAME = process.env.OPENCODE_SERVER_USERNAME || 'opencode'
const OPENCODE_SERVER_PASSWORD = process.env.OPENCODE_SERVER_PASSWORD || ''
const DEFAULT_AGENT = process.env.OPENCODE_AGENT || 'explore'

console.log('[OpenCode Config]', {
  OPENCODE_SERVER_USERNAME,
  OPENCODE_SERVER_PASSWORD: OPENCODE_SERVER_PASSWORD ? '***' : '(not set)',
  DEFAULT_AGENT
})

interface BotConfig {
  apiUrl: string
  provider: string
  model: string
  apiKey?: string
}

interface Session {
  id: string
  title?: string
  createdAt?: string
}

interface MessagePart {
  type: string
  text?: string
}

interface MessageResponse {
  info: {
    id: string
    role: string
  }
  parts: MessagePart[]
}

interface StreamEvent {
  type: string
  properties?: Record<string, unknown>
  part?: MessagePart
  message?: MessageResponse
}

async function fetchAPI<T>(apiUrl: string, path: string, options: RequestInit = {}): Promise<T> {
  console.log(`[OpenCode] Request: ${path}`, options.body)
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  }
  
  if (OPENCODE_SERVER_PASSWORD) {
    const auth = Buffer.from(`${OPENCODE_SERVER_USERNAME}:${OPENCODE_SERVER_PASSWORD}`).toString('base64')
    headers['Authorization'] = `Basic ${auth}`
  }
  
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers,
  })
  
  if (!response.ok) {
    const errorBody = await response.text()
    console.error(`[OpenCode] Error ${response.status}:`, errorBody)
    throw new Error(`OpenCode API error: ${response.status} - ${errorBody}`)
  }
  
  const text = await response.text()
  if (!text) {
    console.log(`[OpenCode] Empty response`)
    return {} as T
  }
  
  const data = JSON.parse(text)
  console.log(`[OpenCode] Response:`, JSON.stringify(data, null, 2))
  return data as T
}

async function createEventConnection(apiUrl: string): Promise<{ events: AsyncGenerator<StreamEvent>, controller: AbortController }> {
  const controller = new AbortController()
  const headers: Record<string, string> = { Accept: 'text/event-stream' }
  
  if (OPENCODE_SERVER_PASSWORD) {
    const auth = Buffer.from(`${OPENCODE_SERVER_USERNAME}:${OPENCODE_SERVER_PASSWORD}`).toString('base64')
    headers['Authorization'] = `Basic ${auth}`
  }
  
  const response = await fetch(`${apiUrl}/event`, {
    signal: controller.signal,
    headers
  })
  
  if (!response.ok) {
    throw new Error(`Failed to connect to event stream: ${response.status}`)
  }
  
  const body = response.body
  if (!body) {
    throw new Error('No response body')
  }
  
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  
  async function* eventGenerator(): AsyncGenerator<StreamEvent> {
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = line.slice(6)
              yield JSON.parse(data) as StreamEvent
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
  
  return { events: eventGenerator(), controller }
}

export async function checkOrCreateOpenCodeSession(apiUrl: string, sessionId?: string): Promise<{ sessionId: string; needsRebuild: boolean }> {
  if (sessionId) {
    console.log('[OpenCode] Checking existing session:', sessionId)
    try {
      const response = await fetch(`${apiUrl}/session/${sessionId}`)
      if (response.ok) {
        console.log('[OpenCode] Session exists:', sessionId)
        return { sessionId, needsRebuild: false }
      }
    } catch (error) {
      console.log('[OpenCode] Session check failed, will create new one')
    }
  }
  
  console.log('[OpenCode] Creating new session...')
  const session = await fetchAPI<Session>(apiUrl, '/session', {
    method: 'POST',
    body: JSON.stringify({ title: 'OpenCode QA Session' }),
  })
  
  if (!session.id) {
    throw new Error('Failed to create OpenCode session')
  }
  
  console.log('[OpenCode] New session created:', session.id)
  return { sessionId: session.id, needsRebuild: !!sessionId }
}

export async function rebuildContext(
  sessionId: string,
  historyParts: Array<{ type: 'text'; text: string }>,
  botConfig: BotConfig
): Promise<void> {
  console.log('[OpenCode] Rebuilding context with', historyParts.length, 'messages')
  
  await fetchAPI<MessageResponse>(botConfig.apiUrl, `/session/${sessionId}/message`, {
    method: 'POST',
    body: JSON.stringify({
      model: {
        providerID: botConfig.provider,
        modelID: botConfig.model
      },
      agent: DEFAULT_AGENT,
      parts: historyParts,
      noReply: true
    })
  })
  
  console.log('[OpenCode] Context rebuilt successfully')
}

export async function sendOpenCodeMessage(
  message: string, 
  botConfig: BotConfig,
  opencodeSessionId?: string
): Promise<{ sessionId: string; answer: string }> {
  console.log('[OpenCode] sendOpenCodeMessage called:', { message: message.substring(0, 50), opencodeSessionId })
  
  const { sessionId } = await checkOrCreateOpenCodeSession(botConfig.apiUrl, opencodeSessionId)
  
  console.log('[OpenCode] Sending message to session:', sessionId)
  const result = await fetchAPI<MessageResponse>(botConfig.apiUrl, `/session/${sessionId}/message`, {
    method: 'POST',
    body: JSON.stringify({
      model: {
        providerID: botConfig.provider,
        modelID: botConfig.model
      },
      agent: DEFAULT_AGENT,
      parts: [{ type: 'text', text: message }]
    }),
  })
  
  console.log('[OpenCode] Message response:', {
    hasInfo: !!result.info,
    hasParts: !!result.parts,
    partsLength: result.parts?.length
  })
  
  let answer = ''
  if (result.parts) {
    for (const part of result.parts) {
      if (part.type === 'text' && part.text) {
        answer += part.text
      }
    }
  }
  
  console.log('[OpenCode] Answer length:', answer.length)
  
  return {
    sessionId,
    answer: answer || '抱歉，我无法回答这个问题。'
  }
}

export async function getSessionMessages(apiUrl: string, sessionId: string) {
  return fetchAPI<MessageResponse[]>(apiUrl, `/session/${sessionId}/message`)
}

export async function deleteOpenCodeSession(apiUrl: string, sessionId: string): Promise<boolean> {
  console.log('[OpenCode] Deleting session:', sessionId)
  
  try {
    const headers: Record<string, string> = {}
    if (OPENCODE_SERVER_PASSWORD) {
      const auth = Buffer.from(`${OPENCODE_SERVER_USERNAME}:${OPENCODE_SERVER_PASSWORD}`).toString('base64')
      headers['Authorization'] = `Basic ${auth}`
    }

    const response = await fetch(`${apiUrl}/session/${sessionId}`, {
      method: 'DELETE',
      headers
    })

    if (!response.ok && response.status !== 404) {
      console.error(`[OpenCode] Failed to delete session ${sessionId}: ${response.status}`)
      return false
    }
    
    console.log('[OpenCode] Session deleted:', sessionId)
    return true
  } catch (error) {
    console.error(`[OpenCode] Error deleting session ${sessionId}:`, error)
    return false
  }
}
