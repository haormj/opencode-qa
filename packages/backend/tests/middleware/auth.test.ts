import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response } from 'express'
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

vi.mock('../../src/services/logger.js', () => ({
  default: {
    error: vi.fn(),
  },
}))

const { authMiddleware, requireAdmin, optionalAuth } = await import('../../src/middleware/auth.js')

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

      mockPrisma.userToken.findUnique.mockResolvedValue(null)

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

      mockPrisma.userToken.findUnique.mockResolvedValue({
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

      mockPrisma.userToken.findUnique.mockResolvedValue({
        id: 'token-id',
        userId,
        token,
        expiresAt,
        createdAt: new Date(),
        revokedAt: null,
      })

      mockPrisma.user.findUnique.mockResolvedValue(null)

      const { req, res, next } = createMockReqRes(`Bearer ${token}`)

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' })
    })

    it('should set req.user and call next for valid token', async () => {
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

      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        username: 'testuser',
        displayName: 'Test User',
        userRoles: [
          {
            role: {
              name: 'user',
              permissions: '["read", "write"]',
            },
          },
          {
            role: {
              name: 'admin',
              permissions: '["admin"]',
            },
          },
        ],
      })

      const { req, res, next } = createMockReqRes(`Bearer ${token}`)

      await authMiddleware(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(req.user).toEqual({
        id: userId,
        username: 'testuser',
        displayName: 'Test User',
        roles: ['user', 'admin'],
        permissions: ['read', 'write', 'admin'],
      })
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

    it('should call authMiddleware if authorization header exists', async () => {
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

      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        username: 'testuser',
        displayName: 'Test User',
        userRoles: [
          {
            role: {
              name: 'user',
              permissions: '[]',
            },
          },
        ],
      })

      const { req, res, next } = createMockReqRes(`Bearer ${token}`)

      await optionalAuth(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(req.user).toBeDefined()
    })
  })
})
