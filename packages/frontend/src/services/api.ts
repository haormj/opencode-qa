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
