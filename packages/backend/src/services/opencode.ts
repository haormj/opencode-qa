const OPENCODE_HOST = process.env.OPENCODE_HOST || '127.0.0.1'
const OPENCODE_PORT = process.env.OPENCODE_PORT || '4096'
const OPENCODE_URL = `http://${OPENCODE_HOST}:${OPENCODE_PORT}`
const DEFAULT_PROVIDER = process.env.OPENCODE_PROVIDER || 'baiduqianfancodingplan'
const DEFAULT_MODEL = process.env.OPENCODE_MODEL || 'glm-5'
const DEFAULT_AGENT = process.env.OPENCODE_AGENT || 'explore'

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

async function fetchAPI<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${OPENCODE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  
  if (!response.ok) {
    throw new Error(`OpenCode API error: ${response.status}`)
  }
  
  return response.json() as Promise<T>
}

async function createEventConnection(): Promise<{ events: AsyncGenerator<StreamEvent>, controller: AbortController }> {
  const controller = new AbortController()
  const response = await fetch(`${OPENCODE_URL}/event`, {
    signal: controller.signal,
    headers: { Accept: 'text/event-stream' }
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

export async function askQuestion(question: string, existingSessionId?: string): Promise<{ sessionId: string; answer: string }> {
  let sessionId = existingSessionId
  
  if (!sessionId) {
    const session = await fetchAPI<Session>('/session', {
      method: 'POST',
      body: JSON.stringify({ title: question.substring(0, 100) }),
    })
    
    if (!session.id) {
      throw new Error('Failed to create session')
    }
    
    sessionId = session.id
  }
  
  const result = await fetchAPI<MessageResponse>(`/session/${sessionId}/message`, {
    method: 'POST',
    body: JSON.stringify({
      model: {
        providerID: DEFAULT_PROVIDER,
        modelID: DEFAULT_MODEL
      },
      agent: DEFAULT_AGENT,
      parts: [{ type: 'text', text: question }]
    }),
  })
  
  let answer = ''
  if (result.parts) {
    for (const part of result.parts) {
      if (part.type === 'text' && part.text) {
        answer += part.text
      }
    }
  }
  
  return {
    sessionId,
    answer: answer || '抱歉，我无法回答这个问题。'
  }
}

export async function getSessionMessages(sessionId: string) {
  return fetchAPI<MessageResponse[]>(`/session/${sessionId}/message`)
}
