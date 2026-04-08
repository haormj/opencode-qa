import { Router, type Request, type Response } from 'express'
import jwt from 'jsonwebtoken'
import { db, userTokens, users } from '../db/index.js'
import { eq, and, gt, isNotNull } from 'drizzle-orm'
import { sessionEventManager } from '../services/session-event-manager.js'
import logger from '../services/logger.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret'

async function getUserFromRequest(req: Request): Promise<{ id: string } | null> {
  try {
    let token: string | undefined
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    } else {
      token = req.query.token as string | undefined
    }

    if (!token) {
      return null
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }

    const tokenRecord = await db.select().from(userTokens).where(eq(userTokens.token, token)).get()

    if (!tokenRecord || tokenRecord.revokedAt || new Date() > tokenRecord.expiresAt) {
      return null
    }

    if (tokenRecord.userId !== decoded.userId) {
      return null
    }

    const user = await db.select().from(users).where(eq(users.id, decoded.userId)).get()

    if (!user) {
      return null
    }

    return { id: user.id }
  } catch (error) {
    logger.error('[SSE] Auth error:', error)
    return null
  }
}

router.get('/:id/events', async (req, res) => {
  const sessionId = req.params.id
  
  const user = await getUserFromRequest(req)
  if (!user) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Unauthorized' })}\n\n`)
    res.end()
    return
  }

  const userId = user.id

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const clientId = `${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, sessionId, timestamp: new Date().toISOString() })}\n\n`)

  sessionEventManager.register(sessionId, clientId, res)

  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`)
    } catch (error: any) {
      if (error.message === 'aborted' || error.code === 'ECONNABORTED') {
        logger.debug(`[SSE] Heartbeat aborted for client ${clientId}`)
      } else {
        logger.error(`[SSE] Heartbeat error for client ${clientId}:`, error)
      }
      cleanup()
    }
  }, 30000)

  const cleanup = () => {
    clearInterval(heartbeatInterval)
    sessionEventManager.unregister(sessionId, clientId)
    try {
      res.end()
    } catch {
    }
  }

  req.on('close', () => {
    logger.debug(`[SSE] Client ${clientId} disconnected from session ${sessionId}`)
    cleanup()
  })

  req.on('error', (error) => {
    if (error.message === 'aborted' || (error as any).code === 'ECONNABORTED') {
      logger.debug(`[SSE] Connection aborted for client ${clientId}`)
    } else {
      logger.error(`[SSE] Connection error for client ${clientId}:`, error)
    }
    cleanup()
  })

  logger.debug(`[SSE] Client ${clientId} connected to session ${sessionId}`)
})

export default router
