import { Router } from 'express'
import { db, bots, sessions, messages, users, assistants, userAssistantBots } from '../db/index.js'
import { eq, and, desc, asc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { sendOpenCodeMessageStream, checkOrCreateOpenCodeSession, rebuildContext, abortOpenCodeSession } from '../services/opencode.js'
import { eventSubscriptionManager, type ChunkType } from '../services/event-subscription-manager.js'
import { sessionEventManager } from '../services/session-event-manager.js'
import { authMiddleware } from '../middleware/auth.js'
import logger from '../services/logger.js'

const router = Router()

async function getUserBot(assistantId: string | null, userId: string): Promise<{ bot: typeof bots.$inferSelect; isUserAssigned: boolean } | null> {
  if (!assistantId) {
    const defaultAssistant = await db.select().from(assistants).where(eq(assistants.slug, 'default')).get()
    if (!defaultAssistant) {
      return null
    }
    assistantId = defaultAssistant.id
  }

  const userBotAssignment = await db.select()
    .from(userAssistantBots)
    .where(and(
      eq(userAssistantBots.assistantId, assistantId),
      eq(userAssistantBots.userId, userId)
    ))
    .get()

  if (userBotAssignment) {
    const bot = await db.select().from(bots).where(eq(bots.id, userBotAssignment.botId)).get()
    if (bot) {
      return { bot, isUserAssigned: true }
    }
  }

  const assistant = await db.select().from(assistants).where(eq(assistants.id, assistantId)).get()
  if (!assistant) {
    return null
  }

  const bot = await db.select().from(bots).where(eq(bots.id, assistant.defaultBotId)).get()
  if (bot) {
    return { bot, isUserAssigned: false }
  }

  return null
}

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

    const session = await db.select().from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId))).get()

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const botResult = await getUserBot(session.assistantId, userId)

    if (!botResult) {
      return res.status(500).json({ error: 'No bot found for this assistant' })
    }

    const { bot: userBot, isUserAssigned } = botResult
    logger.info(`[Message] Using bot: ${userBot.displayName} (user assigned: ${isUserAssigned})`)

    const lastMessage = await db.select().from(messages).where(eq(messages.sessionId, sessionId)).orderBy(desc(messages.createdAt)).limit(1).get()

    if (session.status === 'closed') {
      return res.status(400).json({ error: 'This session has been closed' })
    }

    if (session.status === 'human') {
      const now = new Date()
      const [userMessage] = await db.insert(messages).values({
        id: randomUUID(),
        sessionId: session.id,
        senderType: 'user',
        content,
        userId,
        createdAt: now
      }).returning()

      const user = await db.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users).where(eq(users.id, userId)).get()

      sessionEventManager.emitMessage(session.id, {
        id: userMessage.id,
        sessionId: userMessage.sessionId,
        senderType: userMessage.senderType,
        content: userMessage.content,
        reasoning: userMessage.reasoning,
        createdAt: userMessage.createdAt,
        user: user ? { id: user.id, displayName: user.displayName, username: user.username } : null
      })

      return res.json({
        id: userMessage.id,
        sessionId: session.id,
        content: userMessage.content,
        senderType: userMessage.senderType,
        createdAt: userMessage.createdAt
      })
    }

    if (lastMessage) {
      const hoursSinceLastMessage = (Date.now() - new Date(lastMessage.createdAt).getTime()) / (1000 * 60 * 60)
      if (hoursSinceLastMessage > 24) {
        await db.update(sessions).set({ status: 'closed', updatedAt: new Date() }).where(eq(sessions.id, session.id))
        return res.status(400).json({ error: 'Session has been closed due to inactivity (over 24 hours)' })
      }
    }

    await db.update(sessions).set({ updatedAt: new Date() }).where(eq(sessions.id, sessionId))

    const botConfig = {
      apiUrl: userBot.apiUrl,
      provider: userBot.provider,
      model: userBot.model,
      agent: userBot.agent,
      apiKey: userBot.apiKey || undefined
    }

    const { sessionId: opencodeSessionId, needsRebuild } = await checkOrCreateOpenCodeSession(
      botConfig.apiUrl,
      session.opencodeSessionId || undefined
    )

    if (opencodeSessionId && opencodeSessionId !== session.opencodeSessionId) {
      await db.update(sessions).set({ opencodeSessionId }).where(eq(sessions.id, sessionId))
    }

    if (needsRebuild) {
      logger.info('[Message] Rebuilding context, fetching history messages')
      
      const previousMessages = await db.select().from(messages).where(eq(messages.sessionId, sessionId)).orderBy(asc(messages.createdAt))
      
      const historyParts = previousMessages.map(msg => ({
        type: 'text' as const,
        text: `${msg.senderType === 'user' ? '用户' : 'AI'}：${msg.content}`
      }))
      
      await rebuildContext(opencodeSessionId, historyParts, botConfig)
    }

    const now = new Date()
    const [userMessage] = await db.insert(messages).values({
      id: randomUUID(),
      sessionId,
      senderType: 'user',
      content,
      userId,
      createdAt: now
    }).returning()

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
      await db.update(sessions).set({ opencodeSessionId: opencodeSessionIdFromStream }).where(eq(sessions.id, sessionId))
    }

    const [botMessage] = await db.insert(messages).values({
      id: randomUUID(),
      sessionId,
      senderType: 'bot',
      content: answer || '抱歉，我无法回答这个问题。',
      reasoning: reasoningContent || null,
      botId: userBot.id,
      createdAt: new Date()
    }).returning()

    sendEvent('done', {
      id: botMessage.id,
      sessionId,
      content: botMessage.content,
      senderType: botMessage.senderType,
      createdAt: botMessage.createdAt
    })
    res.end()

    req.on('close', () => {
      logger.debug(`[Stream] Client disconnected for session: ${sessionId}, opencodeSessionId: ${opencodeSessionIdFromStream || opencodeSessionId}`)
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
    
    const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).get()
    
    if (!session || !session.opencodeSessionId) {
      return res.status(404).json({ error: 'Session not found or no active generation' })
    }
    
    const userId = req.user!.id
    const botResult = await getUserBot(session.assistantId, userId)
    
    if (!botResult) {
      return res.status(500).json({ error: 'No bot found for this assistant' })
    }
    
    await abortOpenCodeSession(botResult.bot.apiUrl, session.opencodeSessionId)
    eventSubscriptionManager.unregister(botResult.bot.apiUrl, session.opencodeSessionId)
    
    res.json({ success: true })
  } catch (error) {
    logger.error('[Stop] Error:', error)
    res.status(500).json({ error: 'Failed to stop generation' })
  }
})

export default router
