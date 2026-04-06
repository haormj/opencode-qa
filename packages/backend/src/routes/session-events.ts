import { Router, type Request, type Response } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../index.js'
import { sessionEventManager } from '../services/session-event-manager.js'
import logger from '../services/logger.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret'

/**
 * 从请求中获取并验证 token
 * 支持 Header 和 Query 参数
 */
async function getUserFromRequest(req: Request): Promise<{ id: string } | null> {
  try {
    // 优先从 Header 获取
    let token: string | undefined
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    } else {
      // 从 Query 参数获取（EventSource 不支持自定义 headers）
      token = req.query.token as string | undefined
    }

    if (!token) {
      return null
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }

    const tokenRecord = await prisma.userToken.findUnique({
      where: { token }
    })

    if (!tokenRecord || tokenRecord.revokedAt || new Date() > tokenRecord.expiresAt) {
      return null
    }

    if (tokenRecord.userId !== decoded.userId) {
      return null
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    })

    if (!user) {
      return null
    }

    return { id: user.id }
  } catch (error) {
    logger.error('[SSE] Auth error:', error)
    return null
  }
}

/**
 * SSE 端点：监听会话事件
 * GET /api/sessions/:id/events
 * 
 * 支持的事件类型：
 * - message: 新消息通知
 * - status: 会话状态变更通知
 * - heartbeat: 心跳检测
 */
router.get('/:id/events', async (req, res) => {
  const sessionId = req.params.id
  
  // 验证用户
  const user = await getUserFromRequest(req)
  if (!user) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Unauthorized' })}\n\n`)
    res.end()
    return
  }

  const userId = user.id

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // 禁用 Nginx 缓冲

  // 生成客户端 ID
  const clientId = `${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

  // 发送初始连接成功事件
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, sessionId, timestamp: new Date().toISOString() })}\n\n`)

  // 注册客户端
  sessionEventManager.register(sessionId, clientId, res)

  // 发送心跳保持连接
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
  }, 30000) // 每 30 秒发送一次心跳

  // 清理函数
  const cleanup = () => {
    clearInterval(heartbeatInterval)
    sessionEventManager.unregister(sessionId, clientId)
    try {
      res.end()
    } catch {
      // 忽略结束时的错误
    }
  }

  // 监听连接关闭
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
