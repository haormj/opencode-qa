import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../index.js'

export interface AuthUser {
  id: string
  username: string
  displayName: string
  roles: string[]
  permissions: string[]
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret'

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }

    const tokenRecord = await prisma.userToken.findUnique({
      where: { token }
    })

    if (!tokenRecord || tokenRecord.revokedAt || new Date() > tokenRecord.expiresAt) {
      return res.status(401).json({ error: 'Token invalid or expired' })
    }

    if (tokenRecord.userId !== decoded.userId) {
      return res.status(401).json({ error: 'Token mismatch' })
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    })

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    const roles = user.userRoles.map(ur => ur.role.name)
    const permissions = user.userRoles.flatMap(ur => {
      try {
        return JSON.parse(ur.role.permissions) as string[]
      } catch {
        return []
      }
    })

    req.user = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      roles,
      permissions
    }

    next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    return res.status(401).json({ error: 'Invalid token' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!req.user.roles.includes('admin')) {
    return res.status(403).json({ error: 'Admin access required' })
  }

  next()
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next()
  }

  return authMiddleware(req, res, next)
}
