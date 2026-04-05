import { Router, Response } from 'express'
import bcrypt from 'bcrypt'
import { prisma } from '../index.js'
import { authMiddleware, AuthUser } from '../middleware/auth.js'
import { createToken } from '../services/token.js'

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

    const existingUser = await prisma.user.findUnique({
      where: { username }
    })

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' })
    }

    if (email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email }
      })
      if (existingEmail) {
        return res.status(400).json({ error: 'Email already exists' })
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        email,
        displayName: displayName || username
      }
    })

    const userRole = await prisma.role.findUnique({
      where: { name: 'user' }
    })

    if (userRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: userRole.id
        }
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
    console.error('Register error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body as LoginRequest

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' })
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    })

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

    const roles = user.userRoles.map(ur => ur.role.name)

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        roles
      }
    })
  } catch (error) {
    console.error('Login error:', error)
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
