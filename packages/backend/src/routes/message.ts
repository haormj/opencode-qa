import { Router } from 'express'
import { prisma } from '../index.js'
import { sendOpenCodeMessageStream, checkOrCreateOpenCodeSession, rebuildContext, abortOpenCodeSession } from '../services/opencode.js'
import { eventSubscriptionManager, type ChunkType } from '../services/event-subscription-manager.js'
import { sessionEventManager } from '../services/session-event-manager.js'
import { authMiddleware } from '../middleware/auth.js'
import logger from '../services/logger.js'

const router = Router()

router.post('/stream', authMiddleware, async (req, res) => {
  try {
    const { content, sessionId } = req.body
    const userId = req.user!.id

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Message content is required' })
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Session ID is required' })
    }

    const defaultBot = await prisma.bot.findFirst({
      where: { isActive: true }
    })

    if (!defaultBot) {
      return res.status(500).json({ error: 'No active bot found' })
    }

    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    if (session.status === 'closed') {
      return res.status(400).json({ error: 'This session has been closed' })
    }

    if (session.status === 'human') {
      const userMessage = await prisma.message.create({
        data: {
          sessionId: session.id,
          senderType: 'user',
          content,
          userId
        },
        include: {
          user: {
            select: { id: true, displayName: true, username: true }
          }
        }
      })

      // 触发实时事件，通知所有监听该会话的客户端
      sessionEventManager.emitMessage(session.id, {
        id: userMessage.id,
        sessionId: userMessage.sessionId,
        senderType: userMessage.senderType,
        content: userMessage.content,
        reasoning: userMessage.reasoning,
        createdAt: userMessage.createdAt,
        user: userMessage.user
      })

      return res.json({
        id: userMessage.id,
        sessionId: session.id,
        content: userMessage.content,
        senderType: userMessage.senderType,
        createdAt: userMessage.createdAt
      })
    }

    const lastMessage = session.messages[0]
    if (lastMessage) {
      const hoursSinceLastMessage = (Date.now() - new Date(lastMessage.createdAt).getTime()) / (1000 * 60 * 60)
      if (hoursSinceLastMessage > 24) {
        await prisma.session.update({
          where: { id: session.id },
          data: { status: 'closed' }
        })
        return res.status(400).json({ error: 'Session has been closed due to inactivity (over 24 hours)' })
      }
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() }
    })

    const botConfig = {
      apiUrl: defaultBot.apiUrl,
      provider: defaultBot.provider,
      model: defaultBot.model,
      agent: defaultBot.agent,
      apiKey: defaultBot.apiKey || undefined
    }

    const { sessionId: opencodeSessionId, needsRebuild } = await checkOrCreateOpenCodeSession(
      botConfig.apiUrl,
      session.opencodeSessionId || undefined
    )

    // 立即保存 opencodeSessionId，确保可以提前停止
    if (opencodeSessionId && opencodeSessionId !== session.opencodeSessionId) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { opencodeSessionId }
      })
    }

    if (needsRebuild) {
      logger.info('[Message] Rebuilding context, fetching history messages')
      
      const previousMessages = await prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' }
      })
      
      const historyParts = previousMessages.map(msg => ({
        type: 'text' as const,
        text: `${msg.senderType === 'user' ? '用户' : 'AI'}：${msg.content}`
      }))
      
      await rebuildContext(opencodeSessionId, historyParts, botConfig)
    }

    const userMessage = await prisma.message.create({
      data: {
        sessionId,
        senderType: 'user',
        content,
        userId
      }
    })

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const sendEvent = (event: string, data: Record<string, unknown>) => {
      res.write(`event: ${event}\n`)
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    sendEvent('session', { sessionId, opencodeSessionId })

    let opencodeSessionIdFromStream: string | undefined
    let reasoningContent = ''

    const { sessionId: returnedSessionId, answer } = await sendOpenCodeMessageStream(
      content,
      botConfig,
      opencodeSessionId,
      (chunk: string, type: ChunkType) => {
        sendEvent(type, { text: chunk })
        if (type === 'reasoning') {
          reasoningContent += chunk
        }
      },
      (sid: string) => {
        opencodeSessionIdFromStream = sid
      }
    )

    if (opencodeSessionIdFromStream && opencodeSessionIdFromStream !== session.opencodeSessionId) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { opencodeSessionId: opencodeSessionIdFromStream }
      })
    }

    const botMessage = await prisma.message.create({
      data: {
        sessionId,
        senderType: 'bot',
        content: answer || '抱歉，我无法回答这个问题。',
        reasoning: reasoningContent || null,
        botId: defaultBot.id
      },
      include: {
        bot: {
          select: { id: true, displayName: true, avatar: true }
        }
      }
    })

    // 注意：bot 消息已通过流式响应完整传输给用户，不需要再通过 SSE 推送
    // SSE 推送仅用于：管理员回复 → 用户页面，用户消息 → 管理员页面

    sendEvent('done', {
      id: botMessage.id,
      sessionId,
      content: botMessage.content,
      senderType: botMessage.senderType,
      createdAt: botMessage.createdAt
    })
    res.end()

    req.on('close', () => {
      // Client disconnected
    })
  } catch (error) {
    logger.error('[Stream] Error:', error)
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

router.post('/stop', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' })
    }
    
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    })
    
    if (!session || !session.opencodeSessionId) {
      return res.status(404).json({ error: 'Session not found or no active generation' })
    }
    
    const defaultBot = await prisma.bot.findFirst({
      where: { isActive: true }
    })
    
    if (!defaultBot) {
      return res.status(500).json({ error: 'No active bot found' })
    }
    
    await abortOpenCodeSession(defaultBot.apiUrl, session.opencodeSessionId)
    eventSubscriptionManager.unregister(defaultBot.apiUrl, session.opencodeSessionId)
    
    res.json({ success: true })
  } catch (error) {
    logger.error('[Stop] Error:', error)
    res.status(500).json({ error: 'Failed to stop generation' })
  }
})

export default router
