import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import bcrypt from 'bcrypt'

const createMockDb = () => ({
  select: vi.fn(() => mockDb),
  from: vi.fn(() => mockDb),
  where: vi.fn(() => mockDb),
  get: vi.fn(),
  insert: vi.fn(() => mockDb),
  values: vi.fn(() => mockDb),
  returning: vi.fn(),
  update: vi.fn(() => mockDb),
  set: vi.fn(() => mockDb),
  delete: vi.fn(() => mockDb),
  innerJoin: vi.fn(() => mockDb),
})

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
    info: vi.fn(),
  },
}))

const authRoutes = (await import('../../src/routes/auth.js')).default

const app = express()
app.use(express.json())
app.use('/api/auth', authRoutes)

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

describe('Auth Routes', () => {
  beforeEach(() => {
    resetMocks()
  })

  describe('POST /api/auth/register', () => {
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
      vi.mocked(mockDb.get).mockResolvedValueOnce({
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
      vi.mocked(mockDb.get)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
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
      vi.mocked(mockDb.get)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      vi.mocked(mockDb.returning).mockResolvedValue([{
        id: 'user-id',
        username: 'testuser',
        password: 'hashed-password',
        displayName: 'testuser',
      }])

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: 'password123',
        })

      expect(response.status).toBe(200)
    })
  })

  describe('POST /api/auth/login', () => {
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
  })
})
