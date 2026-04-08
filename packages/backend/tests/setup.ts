import { vi } from 'vitest'

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        get: vi.fn(),
        all: vi.fn(() => [])
      })),
      orderBy: vi.fn(() => ({
        get: vi.fn(),
        all: vi.fn(() => [])
      })),
      get: vi.fn(),
      all: vi.fn(() => [])
    })),
    orderBy: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(),
          all: vi.fn(() => [])
        })),
        get: vi.fn(),
        all: vi.fn(() => [])
      }))
    }))
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => []),
      onConflictDoUpdate: vi.fn(() => ({
        returning: vi.fn(() => [])
      }))
    }))
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => [])
      }))
    }))
  })),
  delete: vi.fn(() => ({
    where: vi.fn(() => ({
      returning: vi.fn(() => [])
    }))
  }))
}

const mockUsers = {
  id: 'id',
  username: 'username',
  password: 'password',
  email: 'email',
  displayName: 'display_name',
  ssoProvider: 'sso_provider',
  ssoUserId: 'sso_user_id',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
}

const mockRoles = {
  id: 'id',
  name: 'name',
  description: 'description',
  permissions: 'permissions'
}

const mockUserRoles = {
  id: 'id',
  userId: 'user_id',
  roleId: 'role_id',
  assignedAt: 'assigned_at'
}

const mockBots = {
  id: 'id',
  name: 'name',
  displayName: 'display_name',
  avatar: 'avatar',
  apiUrl: 'api_url',
  apiKey: 'api_key',
  provider: 'provider',
  model: 'model',
  agent: 'agent',
  description: 'description',
  isActive: 'is_active',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
}

const mockSessions = {
  id: 'id',
  userId: 'user_id',
  title: 'title',
  status: 'status',
  needHuman: 'need_human',
  isDeleted: 'is_deleted',
  opencodeSessionId: 'opencode_session_id',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
}

const mockMessages = {
  id: 'id',
  sessionId: 'session_id',
  senderType: 'sender_type',
  content: 'content',
  reasoning: 'reasoning',
  metadata: 'metadata',
  createdAt: 'created_at',
  userId: 'user_id',
  botId: 'bot_id'
}

const mockUserTokens = {
  id: 'id',
  userId: 'user_id',
  token: 'token',
  userAgent: 'user_agent',
  ipAddress: 'ip_address',
  expiresAt: 'expires_at',
  createdAt: 'created_at',
  revokedAt: 'revoked_at'
}

const mockSsoProviders = {
  id: 'id',
  name: 'name',
  displayName: 'display_name',
  icon: 'icon',
  iconMimeType: 'icon_mime_type',
  enabled: 'enabled',
  sortOrder: 'sort_order',
  type: 'type',
  authorizeUrl: 'authorize_url',
  tokenUrl: 'token_url',
  userInfoUrl: 'user_info_url',
  clientId: 'client_id',
  clientSecret: 'client_secret',
  appId: 'app_id',
  appSecret: 'app_secret',
  scope: 'scope',
  userIdField: 'user_id_field',
  usernameField: 'username_field',
  emailField: 'email_field',
  displayNameField: 'display_name_field',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
}

export { 
  mockDb as db,
  mockUsers as users,
  mockRoles as roles,
  mockUserRoles as userRoles,
  mockBots as bots,
  mockSessions as sessions,
  mockMessages as messages,
  mockUserTokens as userTokens,
  mockSsoProviders as ssoProviders
}

export function resetMocks() {
  Object.keys(mockDb).forEach(key => {
    const fn = mockDb[key as keyof typeof mockDb]
    if (typeof fn === 'function' && 'mockReset' in fn) {
      fn.mockReset()
    }
    if (typeof fn === 'function') {
      fn.mockClear()
    }
  })
}

vi.mock('../src/db/index.js', () => ({
  db: mockDb,
  users: mockUsers,
  roles: mockRoles,
  userRoles: mockUserRoles,
  bots: mockBots,
  sessions: mockSessions,
  messages: mockMessages,
  userTokens: mockUserTokens,
  ssoProviders: mockSsoProviders
}))
