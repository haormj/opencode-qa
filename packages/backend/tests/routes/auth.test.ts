import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import bcrypt from 'bcrypt'

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
    info: vi.fn(),
  },
}))

const authRoutes = (await import('../../src/routes/auth.js')).default

const app = express()
app.use(express.json())
app.use('/api/auth', authRoutes)

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

describe('Auth Routes', () => {
  beforeEach(() => {
    resetMocks()
  })

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-id',
        username: 'testuser',
        password: 'hashed-password',
        email: 'test@example.com',
        displayName: 'testuser',
      })
      mockPrisma.role.findUnique.mockResolvedValue({
        id: 1,
        name: 'user',
        description: 'Default user role',
        permissions: '[]',
      })
      mockPrisma.userRole.create.mockResolvedValue({
        id: 1,
        userId: 'user-id',
        roleId: 1,
        assignedAt: new Date(),
      })
      mockPrisma.userToken.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.userToken.create.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        token: 'test-token',
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      })

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: 'password123',
          email: 'test@example.com',
        })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('token')
      expect(response.body.user).toHaveProperty('id')
      expect(response.body.user.username).toBe('testuser')
    })

    it('should return 400 if username is missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          password: 'password123',
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Username and password are required')
    })

    it('should return 400 if password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Username and password are required')
    })

    it('should return 400 if username is too short', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'ab',
          password: 'password123',
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Username must be between 3 and 50 characters')
    })

    it('should return 400 if username is too long', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'a'.repeat(51),
          password: 'password123',
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Username must be between 3 and 50 characters')
    })

    it('should return 400 if password is too short', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: '12345',
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Password must be at least 6 characters')
    })

    it('should return 400 if username already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user-id',
        username: 'testuser',
        password: 'hashed-password',
        displayName: 'testuser',
      })

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: 'password123',
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Username already exists')
    })

    it('should return 400 if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'existing-user-id',
        username: 'otheruser',
        email: 'test@example.com',
        password: 'hashed-password',
        displayName: 'otheruser',
      })

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: 'password123',
          email: 'test@example.com',
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Email already exists')
    })

    it('should use username as displayName if not provided', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-id',
        username: 'testuser',
        password: 'hashed-password',
        displayName: 'testuser',
      })
      mockPrisma.role.findUnique.mockResolvedValue(null)
      mockPrisma.userToken.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.userToken.create.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        token: 'test-token',
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      })

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: 'password123',
        })

      expect(response.status).toBe(200)
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            displayName: 'testuser',
          }),
        })
      )
    })
  })

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10)

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        username: 'testuser',
        password: hashedPassword,
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
      mockPrisma.userToken.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.userToken.create.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        token: 'test-token',
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      })

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123',
        })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('token')
      expect(response.body.user.username).toBe('testuser')
      expect(response.body.user.roles).toContain('user')
    })

    it('should return 400 if username is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'password123',
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Username and password are required')
    })

    it('should return 400 if password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Username and password are required')
    })

    it('should return 401 if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'password123',
        })

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Invalid credentials')
    })

    it('should return 401 if password is incorrect', async () => {
      const hashedPassword = await bcrypt.hash('correct-password', 10)

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        username: 'testuser',
        password: hashedPassword,
        displayName: 'Test User',
        userRoles: [],
      })

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrong-password',
        })

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Invalid credentials')
    })

    it('should return 401 if user has no password (SSO user)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        username: 'ssouser',
        password: null,
        displayName: 'SSO User',
        ssoProvider: 'feishu',
        ssoUserId: 'feishu-123',
        userRoles: [],
      })

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'ssouser',
          password: 'password123',
        })

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Please use SSO login')
    })
  })
})
