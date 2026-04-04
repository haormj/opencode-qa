export interface QuestionResponse {
  id: number
  sessionId: string
  question: string
  answer: string
  status: string
  createdAt: string
}

export interface HistoryItem {
  id: number
  userId: string
  sessionId: string
  question: string
  answer: string
  status: string
  createdAt: string
  feedback?: {
    id: number
    reason: string
    contact: string | null
    resolved: boolean
  }
}

export interface HistoryResponse {
  total: number
  page: number
  pageSize: number
  items: HistoryItem[]
}

const API_BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

export async function askQuestion(question: string): Promise<QuestionResponse> {
  return request<QuestionResponse>(`${API_BASE}/chat`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  })
}

export function askQuestionStream(
  question: string,
  sessionId: string | null,
  onText: (text: string) => void,
  onDone: (result: QuestionResponse) => void,
  onError: (error: Error) => void
): () => void {
  const controller = new AbortController()
  
  fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, sessionId: sessionId || undefined }),
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }
    
    const decoder = new TextDecoder()
    let buffer = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      let eventType = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7)
        } else if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6))
          
          if (eventType === 'text' && data.text) {
            onText(data.text)
          } else if (eventType === 'done') {
            onDone(data as QuestionResponse)
          } else if (eventType === 'error') {
            onError(new Error(data.error || 'Unknown error'))
          }
        }
      }
    }
  }).catch((error) => {
    if (error.name !== 'AbortError') {
      onError(error)
    }
  })
  
  return () => controller.abort()
}

export async function getHistory(page: number = 1, pageSize: number = 20): Promise<HistoryResponse> {
  return request<HistoryResponse>(`${API_BASE}/history?page=${page}&pageSize=${pageSize}`)
}

export async function getSession(sessionId: string): Promise<HistoryItem> {
  return request<HistoryItem>(`${API_BASE}/chat/${sessionId}`)
}

export async function submitFeedback(questionId: number, reason: string, contact?: string): Promise<void> {
  await request(`${API_BASE}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ questionId, reason, contact }),
  })
}
