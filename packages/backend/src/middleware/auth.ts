import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { db, users, userTokens, roles, userRoles } from '../db/index.js'
import { eq } from 'drizzle-orm'
import logger from '../services/logger.js'

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

    const tokenRecord = await db.select().from(userTokens).where(eq(userTokens.token, token)).get()

    if (!tokenRecord || tokenRecord.revokedAt || new Date() > tokenRecord.expiresAt) {
      return res.status(401).json({ error: 'Token invalid or expired' })
    }

    if (tokenRecord.userId !== decoded.userId) {
      return res.status(401).json({ error: 'Token mismatch' })
    }

    const user = await db.select().from(users).where(eq(users.id, decoded.userId)).get()

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    const userRoleRecords = await db
      .select({ role: roles })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id))

    const rolesList = userRoleRecords.map(ur => ur.role.name)
    const permissions = userRoleRecords.flatMap(ur => {
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
      roles: rolesList,
      permissions
    }

    next()
  } catch (error) {
    logger.error('Auth middleware error:', error)
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
