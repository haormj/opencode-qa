import { Router } from 'express'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'
import { db, taskExecutions, taskExecutionMessages, users } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { executionEventManager } from '../services/execution-event-manager.js'
import logger from '../services/logger.js'

const router = Router()

router.use(authMiddleware)
router.use(requireAdmin)

router.get('/:id/events', async (req, res) => {
  const executionId = req.params.id
  const userId = req.user!.id

  const execution = await db.select().from(taskExecutions).where(eq(taskExecutions.id, executionId)).get()
  if (!execution) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Execution not found' })}\n\n`)
    res.end()
    return
  }

  let cancelledByUser = null
  if (execution.status === 'cancelled' && execution.cancelledBy) {
    const user = await db.select().from(users).where(eq(users.id, execution.cancelledBy)).get()
    if (user) {
      cancelledByUser = {
        id: user.id,
        username: user.username,
        displayName: user.displayName
      }
    }
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const clientId = `${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const isTrigger = execution.triggeredBy === userId

  res.write(`event: connected\ndata: ${JSON.stringify({ 
    clientId, 
    executionId, 
    isTrigger,
    timestamp: new Date().toISOString() 
  })}\n\n`)

  res.write(`event: status\ndata: ${JSON.stringify({ 
    executionId, 
    status: execution.status,
    triggerType: execution.triggerType,
    triggeredBy: execution.triggeredBy,
    startedAt: execution.startedAt,
    completedAt: execution.completedAt,
    updatedAt: execution.createdAt,
    isDebug: execution.isDebug,
    cancelledByUser
  })}\n\n`)

  const messages = await db.select().from(taskExecutionMessages).where(eq(taskExecutionMessages.executionId, executionId)).orderBy(taskExecutionMessages.createdAt)
  for (const msg of messages) {
    res.write(`event: message\ndata: ${JSON.stringify({ id: msg.id, executionId, role: msg.role, content: msg.content, reasoning: msg.reasoning, createdAt: msg.createdAt })}\n\n`)
  }

  if (execution.status === 'running') {
    executionEventManager.register(executionId, clientId, res, { isTrigger })
  }

  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`)
    } catch (error: any) {
      if (error.message === 'aborted' || error.code === 'ECONNABORTED') {
        logger.debug(`[ExecutionSSE] Heartbeat aborted for client ${clientId}`)
      } else {
        logger.error(`[ExecutionSSE] Heartbeat error for client ${clientId}:`, error)
      }
      cleanup()
    }
  }, 30000)

  const cleanup = () => {
    clearInterval(heartbeatInterval)
    executionEventManager.unregister(executionId, clientId)
    try {
      res.end()
    } catch {
    }
  }

  req.on('close', () => {
    logger.debug(`[ExecutionSSE] Client ${clientId} disconnected from execution ${executionId}`)
    cleanup()
  })

  req.on('error', (error) => {
    if (error.message === 'aborted' || (error as any).code === 'ECONNABORTED') {
      logger.debug(`[ExecutionSSE] Connection aborted for client ${clientId}`)
    } else {
      logger.error(`[ExecutionSSE] Connection error for client ${clientId}:`, error)
    }
    cleanup()
  })

  logger.debug(`[ExecutionSSE] Client ${clientId} connected to execution ${executionId} (isTrigger: ${isTrigger})`)
})

export default router
