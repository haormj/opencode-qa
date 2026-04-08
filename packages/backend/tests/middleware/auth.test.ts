import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response } from 'express'
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
    innerJoin: vi.fn(() => db),
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

vi.mock('../../src/services/logger.js', () => ({
  default: {
    error: vi.fn(),
  },
}))

const { authMiddleware, requireAdmin, optionalAuth } = await import('../../src/middleware/auth.js')

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret'

function resetMocks() {
  Object.keys(mockDb).forEach(key => {
    if (typeof mockDb[key as keyof typeof mockDb] === 'function') {
      vi.mocked(mockDb[key as keyof typeof mockDb]).mockClear()
      if (['select', 'from', 'where', 'insert', 'values', 'update', 'set', 'delete', 'innerJoin'].includes(key)) {
        vi.mocked(mockDb[key as keyof typeof mockDb]).mockReturnValue(mockDb)
      }
    }
  })
}

function createMockReqRes(authHeader?: string) {
  const req = {
    headers: {
      authorization: authHeader,
    },
    get: vi.fn((key: string) => {
      if (key === 'user-agent') return 'test-agent'
      return undefined
    }),
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    user: undefined,
  } as unknown as Request

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response

  const next = vi.fn()

  return { req, res, next }
}

describe('Auth Middleware', () => {
  beforeEach(() => {
    resetMocks()
  })

  describe('authMiddleware', () => {
    it('should return 401 if no authorization header', async () => {
      const { req, res, next } = createMockReqRes()

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
      expect(next).not.toHaveBeenCalled()
    })

    it('should return 401 if authorization header does not start with Bearer', async () => {
      const { req, res, next } = createMockReqRes('Basic token')

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
    })

    it('should return 401 if token not found in database', async () => {
      const userId = 'user-123'
      const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })

      vi.mocked(mockDb.get).mockResolvedValue(null)

      const { req, res, next } = createMockReqRes(`Bearer ${token}`)

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Token invalid or expired' })
    })

    it('should return 401 if token is revoked', async () => {
      const userId = 'user-123'
      const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      vi.mocked(mockDb.get).mockResolvedValueOnce({
        id: 'token-id',
        userId,
        token,
        expiresAt,
        createdAt: new Date(),
        revokedAt: new Date(),
      })

      const { req, res, next } = createMockReqRes(`Bearer ${token}`)

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Token invalid or expired' })
    })

    it('should return 401 if user not found', async () => {
      const userId = 'user-123'
      const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      vi.mocked(mockDb.get)
        .mockResolvedValueOnce({
          id: 'token-id',
          userId,
          token,
          expiresAt,
          createdAt: new Date(),
          revokedAt: null,
        })
        .mockResolvedValueOnce(null)

      const { req, res, next } = createMockReqRes(`Bearer ${token}`)

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' })
    })

    it('should handle invalid JWT token', async () => {
      const { req, res, next } = createMockReqRes('Bearer invalid-token')

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' })
    })
  })

  describe('requireAdmin', () => {
    it('should return 401 if user not set', () => {
      const { req, res, next } = createMockReqRes()
      req.user = undefined

      requireAdmin(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
    })

    it('should return 403 if user is not admin', () => {
      const { req, res, next } = createMockReqRes()
      req.user = {
        id: 'user-123',
        username: 'testuser',
        displayName: 'Test User',
        roles: ['user'],
        permissions: ['read'],
      }

      requireAdmin(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' })
    })

    it('should call next if user is admin', () => {
      const { req, res, next } = createMockReqRes()
      req.user = {
        id: 'user-123',
        username: 'adminuser',
        displayName: 'Admin User',
        roles: ['user', 'admin'],
        permissions: ['read', 'admin'],
      }

      requireAdmin(req, res, next)

      expect(next).toHaveBeenCalled()
    })
  })

  describe('optionalAuth', () => {
    it('should call next if no authorization header', async () => {
      const { req, res, next } = createMockReqRes()

      await optionalAuth(req, res, next)

      expect(next).toHaveBeenCalled()
    })
  })
})
