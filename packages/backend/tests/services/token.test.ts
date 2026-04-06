import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
  },
  userToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  session: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  message: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  bot: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  role: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  userRole: {
    create: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
  },
  ssoProvider: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $disconnect: vi.fn(),
}

vi.mock('../../src/index.js', () => ({
  prisma: mockPrisma,
}))

const { createToken, validateToken, revokeToken, revokeAllUserTokens, cleanupExpiredTokens } = await import('../../src/services/token.js')

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret'

function resetMocks() {
  Object.values(mockPrisma).forEach((model) => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach((fn) => {
        if (typeof fn === 'function' && 'mockReset' in fn) {
          fn.mockReset()
        }
      })
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

      mockPrisma.userToken.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.userToken.create.mockResolvedValue({
        id: 'token-id',
        userId,
        token: 'test-token',
        userAgent,
        ipAddress,
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      })

      const token = await createToken(userId, userAgent, ipAddress)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(mockPrisma.userToken.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      })
      expect(mockPrisma.userToken.create).toHaveBeenCalled()
    })

    it('should revoke existing tokens before creating new one', async () => {
      const userId = 'user-123'

      mockPrisma.userToken.deleteMany.mockResolvedValue({ count: 2 })
      mockPrisma.userToken.create.mockResolvedValue({
        id: 'token-id',
        userId,
        token: 'test-token',
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      })

      await createToken(userId)

      expect(mockPrisma.userToken.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      })
    })
  })

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      const userId = 'user-123'
      const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      mockPrisma.userToken.findUnique.mockResolvedValue({
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

      mockPrisma.userToken.findUnique.mockResolvedValue(null)

      const result = await validateToken(token)

      expect(result).toBe(false)
    })

    it('should return false for revoked token', async () => {
      const userId = 'user-123'
      const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      mockPrisma.userToken.findUnique.mockResolvedValue({
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

      mockPrisma.userToken.findUnique.mockResolvedValue({
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

      mockPrisma.userToken.findUnique.mockResolvedValue({
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

      mockPrisma.userToken.update.mockResolvedValue({
        id: 'token-id',
        token,
        userId: 'user-123',
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: new Date(),
      })

      await revokeToken(token)

      expect(mockPrisma.userToken.update).toHaveBeenCalledWith({
        where: { token },
        data: { revokedAt: expect.any(Date) },
      })
    })
  })

  describe('revokeAllUserTokens', () => {
    it('should delete all tokens for a user', async () => {
      const userId = 'user-123'

      mockPrisma.userToken.deleteMany.mockResolvedValue({ count: 3 })

      await revokeAllUserTokens(userId)

      expect(mockPrisma.userToken.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      })
    })
  })

  describe('cleanupExpiredTokens', () => {
    it('should delete expired and revoked tokens', async () => {
      mockPrisma.userToken.deleteMany.mockResolvedValue({ count: 5 })

      await cleanupExpiredTokens()

      expect(mockPrisma.userToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            { revokedAt: { not: null } },
          ],
        },
      })
    })
  })
})
