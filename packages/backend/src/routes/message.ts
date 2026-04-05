import { Router } from 'express'
import { prisma } from '../index.js'
import { sendOpenCodeMessageStream, checkOrCreateOpenCodeSession, rebuildContext } from '../services/opencode.js'
import { authMiddleware } from '../middleware/auth.js'
import logger from '../services/logger.js'

const router = Router()

router.post('/stream', authMiddleware, async (req, res) => {
  try {
    const { content, sessionId: existingSessionId } = req.body
    const userId = req.user!.id

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Message content is required' })
    }

    const defaultBot = await prisma.bot.findFirst({
      where: { isActive: true }
    })

    if (!defaultBot) {
      return res.status(500).json({ error: 'No active bot found' })
    }

    let session
    if (!existingSessionId) {
      const title = content.length > 30 ? content.substring(0, 30) + '...' : content
      session = await prisma.session.create({
        data: {
          userId,
          title,
          status: 'active'
        }
      })
    } else {
      session = await prisma.session.findFirst({
        where: { id: existingSessionId, userId },
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
          }
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

      session = await prisma.session.update({
        where: { id: existingSessionId },
        data: { updatedAt: new Date() }
      })
    }

    const sessionId = session.id

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

    sendEvent('session', { sessionId })

    let opencodeSessionIdFromStream: string | undefined

    const { sessionId: returnedSessionId, answer } = await sendOpenCodeMessageStream(
      content,
      botConfig,
      opencodeSessionId,
      (chunk: string) => {
        sendEvent('text', { text: chunk })
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
        botId: defaultBot.id
      }
    })

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

export default router
