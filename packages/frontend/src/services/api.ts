export interface MessageItem {
  id: string
  sessionId: string
  senderType: 'user' | 'admin' | 'bot'
  content: string
  createdAt: string
  user?: {
    id: string
    displayName: string
    username?: string
  }
  bot?: {
    id: string
    displayName: string
    avatar?: string
  }
}

export interface Session {
  id: string
  title: string
  status: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

export interface SessionDetail {
  id: string
  title: string
  status: string
  needHuman: boolean
  createdAt: string
  updatedAt: string
  messages: MessageItem[]
}

export interface HistoryItem {
  id: string
  sessionId: string
  senderType: string
  content: string
  createdAt: string
  user?: {
    id: string
    displayName: string
  }
  bot?: {
    id: string
    displayName: string
  }
}

export interface HistoryResponse {
  total: number
  page: number
  pageSize: number
  items: HistoryItem[]
}

export interface User {
  id: string
  username: string
  email?: string
  displayName: string
  roles?: string[]
}

export interface LoginResponse {
  token: string
  user: User
}

export interface Bot {
  id: string
  name: string
  displayName: string
  avatar?: string
  apiUrl: string
  provider: string
  model: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminSession {
  id: string
  title: string
  status: string
  createdAt: string
  updatedAt: string
  messageCount: number
  user: {
    id: string
    username: string
    displayName: string
  }
}

export interface AdminSessionListResponse {
  total: number
  page: number
  pageSize: number
  items: AdminSession[]
}

export interface AdminUser {
  id: string
  username: string
  email?: string
  displayName: string
  createdAt: string
  roles: string[]
}

const API_BASE = '/api'

const TOKEN_KEY = 'opencode-qa-token'
const USER_KEY = 'opencode-qa-user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getStoredUser(): User | null {
  const userStr = localStorage.getItem(USER_KEY)
  if (!userStr) return null
  try {
    return JSON.parse(userStr)
  } catch {
    return null
  }
}

export function setStoredUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export function isAdmin(): boolean {
  const user = getStoredUser()
  return !!user && !!user.roles && user.roles.includes('admin')
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options?.headers,
    },
  })

  if (response.status === 401) {
    removeToken()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const result = await request<LoginResponse>(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  setToken(result.token)
  setStoredUser(result.user)
  return result
}

export async function register(
  username: string,
  password: string,
  email?: string,
  displayName?: string
): Promise<LoginResponse> {
  const result = await request<LoginResponse>(`${API_BASE}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ username, password, email, displayName }),
  })
  setToken(result.token)
  setStoredUser(result.user)
  return result
}

export async function getCurrentUser(): Promise<User> {
  return request<User>(`${API_BASE}/auth/me`)
}

export function logout(): void {
  removeToken()
  window.location.href = '/login'
}

export interface SessionInfo {
  id: string
  userId: string
  status: string
}

export async function getSessionInfo(id: string): Promise<SessionInfo> {
  return request<SessionInfo>(`${API_BASE}/sessions/public/${id}/info`)
}

export function sendMessageStream(
  content: string,
  sessionId: string | null,
  onText: (text: string) => void,
  onDone: (result: { id: string; sessionId: string; content: string; senderType: string; createdAt: string }) => void,
  onError: (error: Error) => void
): () => void {
  const controller = new AbortController()
  const token = getToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  fetch(`${API_BASE}/messages/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content, sessionId: sessionId || undefined }),
    signal: controller.signal,
  }).then(async (response) => {
    if (response.status === 401) {
      removeToken()
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }

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
            onDone(data)
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

export async function sendHumanMessage(
  content: string,
  sessionId: string
): Promise<{ id: string; sessionId: string; content: string; senderType: string; createdAt: string }> {
  return request(`${API_BASE}/messages/stream`, {
    method: 'POST',
    body: JSON.stringify({ content, sessionId }),
  })
}

export async function getHistory(page: number = 1, pageSize: number = 20): Promise<HistoryResponse> {
  return request<HistoryResponse>(`${API_BASE}/history?page=${page}&pageSize=${pageSize}`)
}

export async function getSession(sessionId: string): Promise<SessionDetail> {
  return request<SessionDetail>(`${API_BASE}/sessions/${sessionId}`)
}

export async function getSessions(): Promise<Session[]> {
  return request<Session[]>(`${API_BASE}/sessions`)
}

export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  await request(`${API_BASE}/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  })
}

export async function deleteSession(sessionId: string): Promise<void> {
  await request(`${API_BASE}/sessions/${sessionId}`, {
    method: 'DELETE',
  })
}

export async function updateSessionStatus(sessionId: string, status: string): Promise<void> {
  await request(`${API_BASE}/sessions/${sessionId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function getAdminSessions(params?: {
  status?: string
  userId?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<AdminSessionListResponse> {
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.set('status', params.status)
  if (params?.userId) searchParams.set('userId', params.userId)
  if (params?.search) searchParams.set('search', params.search)
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString())

  const query = searchParams.toString()
  return request<AdminSessionListResponse>(`${API_BASE}/admin/sessions${query ? `?${query}` : ''}`)
}

export async function getAdminSessionDetail(sessionId: string): Promise<SessionDetail & { user: User }> {
  return request(`${API_BASE}/admin/sessions/${sessionId}`)
}

export async function adminReplyToSession(sessionId: string, content: string): Promise<MessageItem> {
  return request(`${API_BASE}/admin/sessions/${sessionId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export async function closeAdminSession(sessionId: string): Promise<void> {
  await request(`${API_BASE}/admin/sessions/${sessionId}/close`, {
    method: 'PATCH',
  })
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  return request(`${API_BASE}/admin/users`)
}

export async function addUserRole(userId: string, role: string): Promise<void> {
  await request(`${API_BASE}/admin/users/${userId}/roles`, {
    method: 'POST',
    body: JSON.stringify({ role }),
  })
}

export async function removeUserRole(userId: string, role: string): Promise<void> {
  await request(`${API_BASE}/admin/users/${userId}/roles/${role}`, {
    method: 'DELETE',
  })
}

export async function getBots(): Promise<Bot[]> {
  return request(`${API_BASE}/bots`)
}

export async function getBot(id: string): Promise<Bot> {
  return request(`${API_BASE}/bots/${id}`)
}

export async function createBot(data: Partial<Bot>): Promise<Bot> {
  return request(`${API_BASE}/bots`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateBot(id: string, data: Partial<Bot>): Promise<Bot> {
  return request(`${API_BASE}/bots/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteBot(id: string): Promise<void> {
  await request(`${API_BASE}/bots/${id}`, {
    method: 'DELETE',
  })
}

export function generateAvatarColor(name: string): string {
  const colors = [
    '#f56a00', '#7265e6', '#ffbf00', '#00a2ae',
    '#1890ff', '#52c41a', '#eb2f96', '#722ed1',
    '#13c2c2', '#fa8c16', '#2f54eb', '#52c41a'
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function getUsername(): string {
  const user = getStoredUser()
  return user?.displayName || user?.username || '用户'
}
