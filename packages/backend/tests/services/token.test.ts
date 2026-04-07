import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'

const createMockDb = () => {
  const db = {
    select: vi.fn(() => db),
    from: vi.fn(() => db),
    where: vi.fn(() => db),
    get: vi.fn(),
    insert: vi.fn(() => db),
    values: vi.fn(() => db),
    returning: vi.fn(),
    update: vi.fn(() => db),
    set: vi.fn(() => db),
    delete: vi.fn(() => db),
  }
  return db
}

const mockDb = createMockDb()

vi.mock('../../src/db/index.js', () => ({
  db: mockDb,
  users: {},
  userTokens: {},
  roles: {},
  userRoles: {},
}))

const { createToken, validateToken, revokeToken, revokeAllUserTokens, cleanupExpiredTokens } = await import('../../src/services/token.js')

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret'

function resetMocks() {
  Object.keys(mockDb).forEach(key => {
    if (typeof mockDb[key as keyof typeof mockDb] === 'function') {
      vi.mocked(mockDb[key as keyof typeof mockDb]).mockClear()
      if (['select', 'from', 'where', 'insert', 'values', 'update', 'set', 'delete'].includes(key)) {
        vi.mocked(mockDb[key as keyof typeof mockDb]).mockReturnValue(mockDb)
      }
    }
  })
}

describe('Token Service', () => {
  beforeEach(() => {
    resetMocks()
  })

  describe('createToken', () => {
    it('should create a valid token for user', async () => {
      const userId = 'user-123'
      const userAgent = 'test-agent'
      const ipAddress = '127.0.0.1'

      vi.mocked(mockDb.returning).mockResolvedValue([{
        id: 'token-id',
        userId,
        token: 'test-token',
        userAgent,
        ipAddress,
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      }])

      const token = await createToken(userId, userAgent, ipAddress)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
    })

    it('should revoke existing tokens before creating new one', async () => {
      const userId = 'user-123'

      vi.mocked(mockDb.returning).mockResolvedValue([{
        id: 'token-id',
        userId,
        token: 'test-token',
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      }])

      await createToken(userId)

      expect(mockDb.delete).toHaveBeenCalled()
    })
  })

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      const userId = 'user-123'
      const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      vi.mocked(mockDb.get).mockResolvedValue({
        id: 'token-id',
        userId,
        token,
        expiresAt,
        createdAt: new Date(),
        revokedAt: null,
      })

      const result = await validateToken(token)

      expect(result).toBe(true)
    })

    it('should return false for non-existent token', async () => {
      const token = jwt.sign({ userId: 'user-123' }, JWT_SECRET, { expiresIn: '7d' })

      vi.mocked(mockDb.get).mockResolvedValue(null)

      const result = await validateToken(token)

      expect(result).toBe(false)
    })

    it('should return false for revoked token', async () => {
      const userId = 'user-123'
      const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      vi.mocked(mockDb.get).mockResolvedValue({
        id: 'token-id',
        userId,
        token,
        expiresAt,
        createdAt: new Date(),
        revokedAt: new Date(),
      })

      const result = await validateToken(token)

      expect(result).toBe(false)
    })

    it('should return false for expired token', async () => {
      const userId = 'user-123'
      const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() - 1)

      vi.mocked(mockDb.get).mockResolvedValue({
        id: 'token-id',
        userId,
        token,
        expiresAt,
        createdAt: new Date(),
        revokedAt: null,
      })

      const result = await validateToken(token)

      expect(result).toBe(false)
    })

    it('should return false for token with mismatched userId', async () => {
      const token = jwt.sign({ userId: 'user-123' }, JWT_SECRET, { expiresIn: '7d' })
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      vi.mocked(mockDb.get).mockResolvedValue({
        id: 'token-id',
        userId: 'different-user',
        token,
        expiresAt,
        createdAt: new Date(),
        revokedAt: null,
      })

      const result = await validateToken(token)

      expect(result).toBe(false)
    })

    it('should return false for invalid JWT', async () => {
      const result = await validateToken('invalid-token')

      expect(result).toBe(false)
    })
  })

  describe('revokeToken', () => {
    it('should revoke a token', async () => {
      const token = 'test-token'

      vi.mocked(mockDb.set).mockReturnValue(mockDb)

      await revokeToken(token)

      expect(mockDb.update).toHaveBeenCalled()
    })
  })

  describe('revokeAllUserTokens', () => {
    it('should delete all tokens for a user', async () => {
      const userId = 'user-123'

      await revokeAllUserTokens(userId)

      expect(mockDb.delete).toHaveBeenCalled()
    })
  })

  describe('cleanupExpiredTokens', () => {
    it('should delete expired and revoked tokens', async () => {
      await cleanupExpiredTokens()

      expect(mockDb.delete).toHaveBeenCalled()
    })
  })
})
