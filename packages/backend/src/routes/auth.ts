import { Router, Response } from 'express'
import bcrypt from 'bcrypt'
import { db, users, roles, userRoles } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { authMiddleware, AuthUser } from '../middleware/auth.js'
import { createToken } from '../services/token.js'
import logger from '../services/logger.js'

const router = Router()

interface RegisterRequest {
  username: string
  password: string
  email?: string
  displayName?: string
}

interface LoginRequest {
  username: string
  password: string
}

router.post('/register', async (req, res) => {
  try {
    const { username, password, email, displayName } = req.body as RegisterRequest

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' })
    }

    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({ error: 'Username must be between 3 and 50 characters' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const existingUser = await db.select().from(users).where(eq(users.username, username)).get()

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' })
    }

    if (email) {
      const existingEmail = await db.select().from(users).where(eq(users.email, email)).get()
      if (existingEmail) {
        return res.status(400).json({ error: 'Email already exists' })
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const now = new Date()

    const [user] = await db.insert(users).values({
      id: randomUUID(),
      username,
      password: hashedPassword,
      email,
      displayName: displayName || username,
      createdAt: now,
      updatedAt: now
    }).returning()

    const userRole = await db.select().from(roles).where(eq(roles.name, 'user')).get()

    if (userRole) {
      await db.insert(userRoles).values({
        userId: user.id,
        roleId: userRole.id,
        assignedAt: now
      })
    }

    const userAgent = req.get('user-agent')
    const ipAddress = req.ip || req.socket.remoteAddress
    const token = await createToken(user.id, userAgent, ipAddress)

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName
      }
    })
  } catch (error) {
    logger.error('Register error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body as LoginRequest

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' })
    }

    const user = await db.select().from(users).where(eq(users.username, username)).get()

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    if (!user.password) {
      return res.status(401).json({ error: 'Please use SSO login' })
    }

    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const userAgent = req.get('user-agent')
    const ipAddress = req.ip || req.socket.remoteAddress
    const token = await createToken(user.id, userAgent, ipAddress)

    const userRoleRecords = await db
      .select({ role: roles })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id))

    const rolesList = userRoleRecords.map(ur => ur.role.name)

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        roles: rolesList
      }
    })
  } catch (error) {
    logger.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/me', authMiddleware, (req, res: Response) => {
  const user = req.user as AuthUser
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    roles: user.roles,
    permissions: user.permissions
  })
})

export default router
