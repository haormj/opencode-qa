export interface MessageItem {
  id: string
  sessionId: string
  senderType: 'user' | 'admin' | 'bot'
  content: string
  reasoning?: string
  createdAt: string
  inputTokens?: number | null
  outputTokens?: number | null
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
  assistantId?: string | null
  title: string
  status: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

export interface SessionDetail {
  id: string
  assistantId?: string | null
  assistantSlug?: string | null
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
  agent: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Assistant {
  id: string
  name: string
  slug: string
  description?: string
  defaultBotId: string
  defaultBot?: {
    id: string
    name: string
    displayName: string
    avatar: string | null
  }
  isActive: boolean
  createdAt: string
}

export interface UserAssistantBot {
  id: number
  assistantId: string
  userId: string
  botId: string
  user?: {
    id: string
    username: string
    displayName: string
  }
  bot?: {
    id: string
    name: string
    displayName: string
  }
  createdAt: string
}

export interface AdminSession {
  id: string
  title: string
  status: string
  assistantId?: string | null
  assistant?: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
  messageCount: number
  contextTokens: number | null
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

export async function logout(): Promise<void> {
  try {
    await request(`${API_BASE}/auth/sso/logout`, {
      method: 'POST',
    })
  } catch (error) {
    console.error('Logout API error:', error)
  }
  removeToken()
  window.location.href = '/login'
}

export interface SessionInfo {
  id: string
  userId: string
  status: string
  assistantSlug?: string | null
}

export async function getSessionInfo(id: string): Promise<SessionInfo> {
  return request<SessionInfo>(`${API_BASE}/sessions/public/${id}/info`)
}

export function sendMessageStream(
  content: string,
  sessionId: string | null,
  onText: (text: string) => void,
  onReasoning: (text: string) => void,
  onDone: (result: { id: string; sessionId: string; content: string; senderType: string; createdAt: string; inputTokens?: number | null; outputTokens?: number | null }) => void,
  onError: (error: Error) => void,
  onSession?: (sessionId: string) => void
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

    let eventType = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7)
        } else if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6))

          if (eventType === 'session' && data.sessionId) {
            onSession?.(data.sessionId)
          } else if (eventType === 'text' && data.text) {
            onText(data.text)
          } else if (eventType === 'reasoning' && data.text) {
            onReasoning(data.text)
          } else if (eventType === 'done') {
            onDone(data)
          } else if (eventType === 'error') {
            onError(new Error(data.error || 'Unknown error'))
          }
        }
      }
    }

    if (buffer.trim()) {
      const lines = buffer.split('\n')
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7)
        } else if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6))

          if (eventType === 'session' && data.sessionId) {
            onSession?.(data.sessionId)
          } else if (eventType === 'text' && data.text) {
            onText(data.text)
          } else if (eventType === 'reasoning' && data.text) {
            onReasoning(data.text)
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

export async function stopMessageStream(sessionId: string): Promise<void> {
  await request(`${API_BASE}/messages/stop`, {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  })
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

export async function createSession(title?: string, assistantId?: string): Promise<Session> {
  return request<Session>(`${API_BASE}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ title, assistantId }),
  })
}

export async function getSessions(assistantId?: string): Promise<Session[]> {
  const query = assistantId ? `?assistantId=${assistantId}` : ''
  return request<Session[]>(`${API_BASE}/sessions${query}`)
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
  needHuman?: boolean
  assistantId?: string
  page?: number
  pageSize?: number
}): Promise<AdminSessionListResponse> {
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.set('status', params.status)
  if (params?.userId) searchParams.set('userId', params.userId)
  if (params?.search) searchParams.set('search', params.search)
  if (params?.needHuman !== undefined) searchParams.set('needHuman', params.needHuman.toString())
  if (params?.assistantId) searchParams.set('assistantId', params.assistantId)
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

export interface UserFieldMapping {
  id?: string
  username?: string
  email?: string
  displayName?: string
}

export interface AdvancedConfig {
  authorizeUrlTemplate?: string
  pipeline: PipelineStep[]
  userFieldMapping?: UserFieldMapping
}

export interface SsoProvider {
  id: string
  name: string
  displayName: string
  icon?: string
  iconMimeType?: string
  enabled: boolean
  sortOrder: number
  type: string
  authorizeUrl: string
  tokenUrl: string
  userInfoUrl?: string
  clientId?: string
  appId?: string
  scope: string
  userIdField: string
  usernameField: string
  emailField: string
  displayNameField: string
  advancedConfig?: AdvancedConfig | null
  createdAt: string
  updatedAt: string
}

export async function getSsoProviders(): Promise<SsoProvider[]> {
  return request(`${API_BASE}/auth/sso/providers`)
}

export async function getSsoAuthorizeUrl(provider: string, redirectUri: string): Promise<{ authorizeUrl: string; state: string }> {
  const params = new URLSearchParams({ redirectUri })
  return request(`${API_BASE}/auth/sso/${provider}?${params.toString()}`)
}

export async function ssoCallback(provider: string, code: string, state: string, redirectUri: string): Promise<{ token: string; user: User }> {
  return request(`${API_BASE}/auth/sso/${provider}/callback`, {
    method: 'POST',
    body: JSON.stringify({ code, state, redirectUri }),
  })
}

export async function getAdminSsoProviders(): Promise<SsoProvider[]> {
  return request(`${API_BASE}/admin/sso-providers`)
}

export async function createSsoProvider(data: Partial<SsoProvider>): Promise<SsoProvider> {
  return request(`${API_BASE}/admin/sso-providers`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateSsoProvider(id: string, data: Partial<SsoProvider>): Promise<SsoProvider> {
  return request(`${API_BASE}/admin/sso-providers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteSsoProvider(id: string): Promise<void> {
  await request(`${API_BASE}/admin/sso-providers/${id}`, {
    method: 'DELETE',
  })
}

export async function uploadSsoProviderIcon(id: string, file: File): Promise<void> {
  const formData = new FormData()
  formData.append('icon', file)
  
  const token = getToken()
  await fetch(`${API_BASE}/admin/sso-providers/${id}/icon`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  })
}

export interface AssistantStat {
  id: string | null
  name: string
  total: number
  active: number
  human: number
  closed: number
  interceptionRate: number
}

export interface TokenStat {
  assistantId: string
  assistantName: string
  totalInputTokens: number
  totalOutputTokens: number
}

export interface Statistics {
  interceptionRate: number
  sessions: {
    total: number
    active: number
    human: number
    closed: number
  }
  users: {
    total: number
  }
  bots: {
    total: number
  }
  assistants: {
    total: number
  }
  assistantStats: AssistantStat[]
  tokenStats: TokenStat[]
}

export async function getStatistics(): Promise<Statistics> {
  return request<Statistics>(`${API_BASE}/admin/statistics`)
}

export interface SystemSetting {
  id: string
  key: string
  value: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

export async function getAdminSettings(): Promise<SystemSetting[]> {
  return request<SystemSetting[]>(`${API_BASE}/admin/settings`)
}

export async function updateSetting(key: string, value: string): Promise<SystemSetting> {
  return request<SystemSetting>(`${API_BASE}/admin/settings/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value })
  })
}

export async function getPublicSettings(): Promise<Record<string, string>> {
  return request<Record<string, string>>(`${API_BASE}/settings`)
}

export async function getAssistants(): Promise<Assistant[]> {
  return request(`${API_BASE}/assistants`)
}

export async function getAssistant(id: string): Promise<Assistant> {
  return request(`${API_BASE}/assistants/${id}`)
}

export async function getAdminAssistants(): Promise<Assistant[]> {
  return request(`${API_BASE}/admin/assistants`)
}

export async function getAdminAssistant(id: string): Promise<Assistant> {
  return request(`${API_BASE}/admin/assistants/${id}`)
}

export async function createAssistant(data: Partial<Assistant>): Promise<Assistant> {
  return request(`${API_BASE}/admin/assistants`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateAssistant(id: string, data: Partial<Assistant>): Promise<Assistant> {
  return request(`${API_BASE}/admin/assistants/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteAssistant(id: string): Promise<void> {
  await request(`${API_BASE}/admin/assistants/${id}`, {
    method: 'DELETE',
  })
}

export async function getAssistantUserBots(assistantId: string): Promise<UserAssistantBot[]> {
  return request(`${API_BASE}/admin/assistants/${assistantId}/user-bots`)
}

export async function createAssistantUserBot(assistantId: string, data: { userId: string; botId: string }): Promise<UserAssistantBot> {
  return request(`${API_BASE}/admin/assistants/${assistantId}/user-bots`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateAssistantUserBot(assistantId: string, userId: string, botId: string): Promise<UserAssistantBot> {
  return request(`${API_BASE}/admin/assistants/${assistantId}/user-bots/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ botId }),
  })
}

export async function deleteAssistantUserBot(assistantId: string, userId: string): Promise<void> {
  await request(`${API_BASE}/admin/assistants/${assistantId}/user-bots/${userId}`, {
    method: 'DELETE',
  })
}

export interface SkillCategory {
  id: number
  name: string
  slug: string
  icon: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface Skill {
  id: string
  name: string
  displayName: string
  slug: string
  description: string | null
  readme?: string | null
  categoryId?: number | null
  authorId: string
  version: string
  pendingVersion?: string
  status: string
  rejectReason: string | null
  downloadCount: number
  favoriteCount: number
  averageRating: number
  ratingCount: number
  createdAt: string
  updatedAt: string
  categoryName?: string | null
  categorySlug?: string | null
  authorName?: string | null
  favorited?: boolean
}

export interface SkillDetail extends Skill {
  authorUsername?: string
}

export interface SkillListResponse {
  total: number
  page: number
  pageSize: number
  items: Skill[]
}

// Skill APIs
export async function getSkills(params?: {
  page?: number
  pageSize?: number
  category?: string
  search?: string
  sort?: string
}): Promise<SkillListResponse> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString())
  if (params?.category) searchParams.set('category', params.category)
  if (params?.search) searchParams.set('search', params.search)
  if (params?.sort) searchParams.set('sort', params.sort)
  const query = searchParams.toString()
  return request<SkillListResponse>(`${API_BASE}/skills${query ? `?${query}` : ''}`)
}

export async function getTrendingSkills(limit?: number): Promise<Skill[]> {
  return request(`${API_BASE}/skills/trending${limit ? `?limit=${limit}` : ''}`)
}

export async function getSkillCategories(): Promise<SkillCategory[]> {
  return request(`${API_BASE}/skills/categories`)
}

export async function getSkillBySlug(slug: string): Promise<Skill> {
  return request(`${API_BASE}/skills/${slug}`)
}

export async function getSkillById(id: string): Promise<Skill> {
  const result = await request<SkillListResponse>(`${API_BASE}/skills/my/published`)
  return result.items.find(s => s.id === id) || null as unknown as Skill
}

export interface CreateSkillResult {
  id: string
  versionId: string
  slug: string
  version: string
  status: string
}

export async function createSkillWithFiles(data: {
  files: File[]
  paths: string[]
  name: string
  displayName: string
  slug: string
  description?: string
  changeLog?: string
}): Promise<CreateSkillResult> {
  const formData = new FormData()
  data.files.forEach((file) => {
    formData.append('files', file)
  })
  formData.append('paths', JSON.stringify(data.paths))
  formData.append('name', data.name)
  formData.append('displayName', data.displayName)
  formData.append('slug', data.slug)
  if (data.description) formData.append('description', data.description)
  if (data.changeLog) formData.append('changeLog', data.changeLog)

  const token = getToken()
  const response = await fetch(`${API_BASE}/skills`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

export interface UpdateSkillResult {
  id: string
  versionId: string
  newVersion: string
  status: string
}

export async function updateSkillWithFiles(id: string, data: {
  files: File[]
  paths: string[]
  displayName?: string
  description?: string
  versionType: 'major' | 'minor' | 'patch'
  changeLog: string
  status?: 'draft' | 'pending'
  overwriteDraft?: string
}): Promise<UpdateSkillResult> {
  const formData = new FormData()
  data.files.forEach((file) => {
    formData.append('files', file)
  })
  formData.append('paths', JSON.stringify(data.paths))
  if (data.displayName) formData.append('displayName', data.displayName)
  if (data.description) formData.append('description', data.description)
  formData.append('versionType', data.versionType)
  formData.append('changeLog', data.changeLog)
  if (data.status) formData.append('status', data.status)
  if (data.overwriteDraft) formData.append('overwriteDraft', data.overwriteDraft)

  const token = getToken()
  const response = await fetch(`${API_BASE}/skills/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    const err = new Error(error.error || `HTTP error! status: ${response.status}`) as Error & { draftVersion?: string; draftVersionId?: string }
    if (error.draftVersion) err.draftVersion = error.draftVersion
    if (error.draftVersionId) err.draftVersionId = error.draftVersionId
    throw err
  }

  return response.json()
}

export async function downloadSkill(slug: string): Promise<Blob> {
  const token = getToken()
  const response = await fetch(`${API_BASE}/skills/${slug}/download`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  if (!response.ok) {
    throw new Error('Download failed')
  }
  return response.blob()
}

export interface SkillVersion {
  id: string
  version: string
  versionType: string
  displayName: string | null
  description: string | null
  changeLog: string | null
  status: string
  rejectReason: string | null
  createdBy: string
  approvedBy: string | null
  createdAt: string
  approvedAt: string | null
  creatorName: string | null
}

export async function getSkillVersions(slug: string): Promise<{ items: SkillVersion[] }> {
  return request(`${API_BASE}/skills/${slug}/versions`)
}

export interface MyPendingVersion {
  id: string
  skillId: string
  version: string
  versionType: string
  displayName: string | null
  description: string | null
  changeLog: string | null
  status: string
  rejectReason: string | null
  createdBy: string
  createdAt: string
  skillName: string
  skillSlug: string
}

export async function getMySkillVersions(status?: string): Promise<{ items: MyPendingVersion[] }> {
  const params = new URLSearchParams()
  if (status) params.append('status', status)
  const query = params.toString() ? `?${params.toString()}` : ''
  return request(`${API_BASE}/skills/my/versions${query}`)
}

export interface MyVersionDetail extends MyPendingVersion {
  skillName: string
  skillSlug: string
  skillId: string
}

export async function getMySkillVersionById(versionId: string): Promise<MyVersionDetail> {
  return request(`${API_BASE}/skills/my/versions/${versionId}`)
}

export async function getMySkillVersionFiles(versionId: string): Promise<{ tree: FileNode[] }> {
  return request(`${API_BASE}/skills/my/versions/${versionId}/files`)
}

export async function getMySkillVersionFileContent(versionId: string, filePath: string): Promise<string> {
  const response = await fetch(`${API_BASE}/skills/my/versions/${versionId}/files/${encodeURIComponent(filePath)}`, {
    headers: {
      'Authorization': `Bearer ${getToken()}`
    }
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch file content' }))
    throw new Error(error.error || `HTTP error! status: ${response.status}`)
  }
  return response.text()
}

export async function createSkill(data: Partial<Skill> & { name: string; displayName: string; slug: string }): Promise<Skill> {
  return request(`${API_BASE}/skills`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateSkill(id: string, data: Partial<Skill>): Promise<Skill> {
  return request(`${API_BASE}/skills/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function offlineSkill(id: string): Promise<Skill> {
  return request(`${API_BASE}/skills/${id}/offline`, {
    method: 'PUT',
  })
}

export async function onlineSkill(id: string): Promise<Skill> {
  return request(`${API_BASE}/skills/${id}/online`, {
    method: 'PUT',
  })
}

export async function deleteSkill(id: string): Promise<{ success: boolean }> {
  return request(`${API_BASE}/skills/${id}`, {
    method: 'DELETE',
  })
}

export async function toggleSkillFavorite(id: string): Promise<{ favorited: boolean }> {
  return request(`${API_BASE}/skills/${id}/favorite`, {
    method: 'POST',
  })
}

export async function rateSkill(id: string, score: number, review?: string): Promise<{ score: number; review?: string }> {
  return request(`${API_BASE}/skills/${id}/rate`, {
    method: 'POST',
    body: JSON.stringify({ score, review }),
  })
}

export async function incrementSkillDownload(id: string): Promise<void> {
  await request(`${API_BASE}/skills/${id}/download`, {
    method: 'POST',
  })
}

export async function getMyPublishedSkills(params?: { page?: number; pageSize?: number }): Promise<SkillListResponse> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString())
  const query = searchParams.toString()
  return request(`${API_BASE}/skills/my/published${query ? `?${query}` : ''}`)
}

export async function getMyFavoriteSkills(): Promise<Skill[]> {
  return request(`${API_BASE}/skills/my/favorites`)
}

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

export interface UploadFileNode {
  name: string
  path: string
  size: number
  isDirectory: boolean
  children?: UploadFileNode[]
  isSkillMd?: boolean
}

export async function getSkillFiles(slug: string): Promise<{ tree: FileNode[] }> {
  return request(`${API_BASE}/skills/${slug}/files`)
}

export async function getSkillFileContentBySlug(slug: string, filePath: string): Promise<string> {
  const response = await fetch(`${API_BASE}/skills/${slug}/files/${encodeURIComponent(filePath)}`, {
    headers: {
      'Authorization': `Bearer ${getToken()}`
    }
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch file content' }))
    throw new Error(error.error || `HTTP error! status: ${response.status}`)
  }
  return response.text()
}

export async function getSkillReadme(slug: string): Promise<string | null> {
  try {
    const result = await request<{ content: string }>(`${API_BASE}/skills/${slug}/readme`)
    return result.content
  } catch {
    return null
  }
}

export interface UploadResult {
  files: FileNode[]
  totalSize: number
  fileCount: number
  hasSkillMd: boolean
  metadata: {
    name?: string
    displayName?: string
    description?: string
    version?: string
    icon?: string
  }
}

export async function uploadSkillFiles(files: FileList): Promise<UploadResult> {
  const formData = new FormData()
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i])
  }
  
  const token = getToken()
  const response = await fetch(`${API_BASE}/skills/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

// Admin Skill APIs
export async function getAdminSkills(params?: {
  page?: number
  pageSize?: number
  status?: string
  search?: string
  sort?: string
}): Promise<SkillListResponse> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString())
  if (params?.status) searchParams.set('status', params.status)
  if (params?.search) searchParams.set('search', params.search)
  if (params?.sort) searchParams.set('sort', params.sort)
  const query = searchParams.toString()
  return request(`${API_BASE}/admin/skills${query ? `?${query}` : ''}`)
}

export async function reviewSkillVersion(skillId: string, versionId: string, data: { status: 'approved' | 'rejected'; rejectReason?: string }): Promise<{ success: boolean }> {
  return request(`${API_BASE}/admin/skills/${skillId}/versions/${versionId}/review`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function reviewSkill(id: string, data: { status: string; rejectReason?: string; name?: string; displayName?: string; categoryId?: number; icon?: string; tags?: string; installCommand?: string }): Promise<Skill> {
  return request(`${API_BASE}/admin/skills/${id}/review`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function adminUpdateSkill(id: string, data: Partial<Skill>): Promise<Skill> {
  return request(`${API_BASE}/admin/skills/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function adminDeleteSkill(id: string): Promise<void> {
  await request(`${API_BASE}/admin/skills/${id}`, {
    method: 'DELETE',
  })
}

export async function getAdminSkillCategories(): Promise<SkillCategory[]> {
  return request(`${API_BASE}/admin/skills/categories`)
}

export async function createSkillCategory(data: Partial<SkillCategory> & { name: string; slug: string }): Promise<SkillCategory> {
  return request(`${API_BASE}/admin/skills/categories`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateSkillCategory(id: number, data: Partial<SkillCategory>): Promise<SkillCategory> {
  return request(`${API_BASE}/admin/skills/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteSkillCategory(id: number): Promise<void> {
  await request(`${API_BASE}/admin/skills/categories/${id}`, {
    method: 'DELETE',
  })
}

export async function getAdminSkillById(id: string): Promise<SkillDetail> {
  return request(`${API_BASE}/admin/skills/${id}`)
}

export async function getAdminSkillFiles(skillId: string): Promise<{ tree: FileNode[] }> {
  return request(`${API_BASE}/admin/skills/${skillId}/files`)
}

export async function getSkillFileContent(skillId: string, filePath: string): Promise<string> {
  const response = await fetch(`${API_BASE}/admin/skills/${skillId}/files/${encodeURIComponent(filePath)}`, {
    headers: {
      'Authorization': `Bearer ${getToken()}`
    }
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch file content' }))
    throw new Error(error.error || `HTTP error! status: ${response.status}`)
  }
  return response.text()
}

export async function batchReviewSkills(
  ids: string[],
  status: 'approved' | 'rejected',
  rejectReason?: string
): Promise<{ success: boolean; count: number }> {
  return request(`${API_BASE}/admin/skills/batch-review`, {
    method: 'POST',
    body: JSON.stringify({ ids, status, rejectReason }),
  })
}

export async function batchDeleteSkills(ids: string[]): Promise<{ success: boolean; count: number }> {
  return request(`${API_BASE}/admin/skills/batch-delete`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

export interface AdminSkillVersion {
  id: string
  skillId: string
  version: string
  versionType: string
  displayName: string | null
  description: string | null
  changeLog: string | null
  status: string
  rejectReason: string | null
  createdBy: string
  approvedBy: string | null
  createdAt: string
  approvedAt: string | null
  creatorName: string | null
  skillName: string | null
  skillSlug: string | null
}

export interface AdminSkillVersionListResponse {
  total: number
  page: number
  pageSize: number
  items: AdminSkillVersion[]
}

export async function getAdminSkillVersions(params: {
  page?: number
  pageSize?: number
  status?: string
}): Promise<AdminSkillVersionListResponse> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', params.page.toString())
  if (params.pageSize) query.set('pageSize', params.pageSize.toString())
  if (params.status) query.set('status', params.status)
  return request(`${API_BASE}/admin/skill-versions?${query.toString()}`)
}

export async function approveSkillVersion(versionId: string): Promise<{ success: boolean }> {
  return request(`${API_BASE}/admin/skill-versions/${versionId}/approve`, {
    method: 'PUT',
  })
}

export async function rejectSkillVersion(versionId: string, rejectReason: string): Promise<{ success: boolean }> {
  return request(`${API_BASE}/admin/skill-versions/${versionId}/reject`, {
    method: 'PUT',
    body: JSON.stringify({ rejectReason }),
  })
}

export async function getSkillVersionFiles(versionId: string): Promise<{ tree: FileNode[] }> {
  return request(`${API_BASE}/admin/skill-versions/${versionId}/files`)
}

export interface AdminSkillVersionDetail extends AdminSkillVersion {
  skillStatus: string
  skillDownloadCount: number
  skillFavoriteCount: number
  skillDescription: string | null
  skillAuthorName: string | null
}

export async function getAdminSkillVersionById(versionId: string): Promise<AdminSkillVersionDetail> {
  return request(`${API_BASE}/admin/skill-versions/${versionId}`)
}

export async function getSkillVersionFileContent(versionId: string, filePath: string): Promise<string> {
  const response = await fetch(`${API_BASE}/admin/skill-versions/${versionId}/files/${encodeURIComponent(filePath)}`, {
    headers: {
      'Authorization': `Bearer ${getToken()}`
    }
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch file content' }))
    throw new Error(error.error || `HTTP error! status: ${response.status}`)
  }
  return response.text()
}

export async function submitSkillVersion(versionId: string): Promise<{ success: boolean }> {
  return request(`${API_BASE}/skills/my/versions/${versionId}/submit`, {
    method: 'PUT',
  })
}

export async function cancelSkillVersion(versionId: string): Promise<{ success: boolean }> {
  return request(`${API_BASE}/skills/my/versions/${versionId}/cancel`, {
    method: 'PUT',
  })
}

export interface Task {
  id: string
  name: string
  description?: string | null
  flowData: string
  triggerType: 'manual' | 'schedule' | 'webhook'
  scheduleConfig?: string | null
  webhookToken?: string | null
  isActive: boolean
  botId?: string | null
  botName?: string | null
  createdByUser?: {
    id: string
    username: string
    displayName: string
  } | null
  createdAt: string
  updatedAt: string
}

export interface TaskListResponse {
  total: number
  page: number
  pageSize: number
  items: Task[]
}

export interface TaskExecution {
  id: string
  taskId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  triggerType: 'manual' | 'schedule' | 'webhook'
  triggeredBy: string | null
  triggeredByUser: {
    id: string
    username: string
    displayName: string
  } | null
  cancelledByUser: {
    id: string
    username: string
    displayName: string
  } | null
  startedAt?: string | null
  completedAt?: string | null
  isDebug: boolean
  createdAt: string
}

export interface TaskExecutionListResponse {
  total: number
  page: number
  pageSize: number
  items: TaskExecution[]
}

export interface ExecutionMessage {
  id: string
  executionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning?: string | null
  createdAt: string
}

export async function getTasks(params: { page: number; pageSize: number }): Promise<TaskListResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('page', params.page.toString())
  searchParams.set('pageSize', params.pageSize.toString())
  return request(`${API_BASE}/admin/tasks?${searchParams.toString()}`)
}

export async function getTask(id: string): Promise<Task> {
  return request(`${API_BASE}/admin/tasks/${id}`)
}

export async function createTask(data: {
  name: string
  description?: string
  flowData: string
  triggerType?: string
  scheduleConfig?: string | null
  webhookToken?: string
}): Promise<Task> {
  return request(`${API_BASE}/admin/tasks`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateTask(id: string, data: Partial<{
  name: string
  description: string
  flowData: string
  triggerType: string
  scheduleConfig: string
  webhookToken: string
  isActive: boolean
}>): Promise<Task> {
  return request(`${API_BASE}/admin/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteTask(id: string): Promise<void> {
  await request(`${API_BASE}/admin/tasks/${id}`, {
    method: 'DELETE',
  })
}

export async function toggleTask(id: string): Promise<Task> {
  return request(`${API_BASE}/admin/tasks/${id}/toggle`, {
    method: 'PATCH',
  })
}

export async function executeTask(id: string, debug?: boolean): Promise<{ executionId: string }> {
  return request(`${API_BASE}/admin/tasks/${id}/execute`, {
    method: 'POST',
    body: JSON.stringify({ debug: debug || false }),
  })
}

export async function getTaskPreview(id: string): Promise<{ markdown: string }> {
  return request(`${API_BASE}/admin/tasks/${id}/preview`)
}

export async function getTaskExecutions(taskId: string, params: { page: number; pageSize: number }): Promise<TaskExecutionListResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('page', params.page.toString())
  searchParams.set('pageSize', params.pageSize.toString())
  return request(`${API_BASE}/admin/tasks/${taskId}/executions?${searchParams.toString()}`)
}

export async function getAllExecutions(params: { page: number; pageSize: number; taskId?: string; status?: string }): Promise<TaskExecutionListResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('page', params.page.toString())
  searchParams.set('pageSize', params.pageSize.toString())
  if (params.taskId) {
    searchParams.set('taskId', params.taskId)
  }
  if (params.status) {
    searchParams.set('status', params.status)
  }
  return request(`${API_BASE}/admin/tasks/executions?${searchParams.toString()}`)
}

export async function getExecution(id: string): Promise<TaskExecution> {
  return request(`${API_BASE}/admin/tasks/executions/${id}`)
}

export async function getExecutionMessages(executionId: string): Promise<ExecutionMessage[]> {
  return request(`${API_BASE}/admin/tasks/executions/${executionId}/messages`)
}

export async function cancelExecution(id: string): Promise<{ success: boolean; id: string; status: string }> {
  return request(`${API_BASE}/admin/tasks/executions/${id}/cancel`, {
    method: 'POST',
  })
}

export async function appendExecutionMessage(executionId: string, content: string): Promise<{ success: boolean }> {
  return request(`${API_BASE}/admin/tasks/executions/${executionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  })
}

export async function closeExecutionSession(executionId: string): Promise<{ success: boolean }> {
  return request(`${API_BASE}/admin/tasks/executions/${executionId}/close`, {
    method: 'POST'
  })
}

export async function stopExecutionStream(executionId: string): Promise<{ success: boolean }> {
  return request(`${API_BASE}/admin/tasks/executions/${executionId}/stop-stream`, {
    method: 'POST'
  })
}
