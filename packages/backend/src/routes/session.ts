import { Router } from 'express'
import { db, sessions, messages, users, bots, assistants } from '../db/index.js'
import { eq, and, desc, asc, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { authMiddleware } from '../middleware/auth.js'
import { deleteOpenCodeSession } from '../services/opencode.js'
import logger from '../services/logger.js'

const router = Router()

router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id
    const { title, assistantId } = req.body

    let validAssistantId = assistantId
    if (assistantId) {
      const assistant = await db.select().from(assistants)
        .where(and(eq(assistants.id, assistantId), eq(assistants.isActive, true)))
        .get()
      if (!assistant) {
        return res.status(400).json({ error: 'Assistant not found or inactive' })
      }
    } else {
      const defaultAssistant = await db.select().from(assistants)
        .where(eq(assistants.slug, 'default'))
        .get()
      validAssistantId = defaultAssistant?.id
    }

    const sessionTitle = title && typeof title === 'string' && title.trim()
      ? (title.length > 30 ? title.substring(0, 30) + '...' : title)
      : '新对话'

    const now = new Date()
    const [session] = await db.insert(sessions).values({
      id: randomUUID(),
      userId,
      assistantId: validAssistantId,
      title: sessionTitle,
      status: 'active',
      createdAt: now,
      updatedAt: now
    }).returning()

    res.json({
      id: session.id,
      assistantId: session.assistantId,
      title: session.title,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    })
  } catch (error) {
    logger.error('Create session error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/public/:id/info', async (req, res) => {
  try {
    const { id } = req.params

    const session = await db.select({ 
      id: sessions.id, 
      userId: sessions.userId, 
      status: sessions.status,
      assistantId: sessions.assistantId
    }).from(sessions).where(eq(sessions.id, id)).get()

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    let assistantSlug: string | null = null
    if (session.assistantId) {
      const assistant = await db.select({ slug: assistants.slug }).from(assistants).where(eq(assistants.id, session.assistantId)).get()
      assistantSlug = assistant?.slug || null
    }

    res.json({
      id: session.id,
      userId: session.userId,
      status: session.status,
      assistantSlug
    })
  } catch (error) {
    logger.error('Get session info error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id
    const { assistantId } = req.query

    const conditions = [eq(sessions.userId, userId), eq(sessions.isDeleted, false)]
    
    if (assistantId && typeof assistantId === 'string') {
      conditions.push(eq(sessions.assistantId, assistantId))
    }

    const sessionList = await db.select().from(sessions)
      .where(and(...conditions))
      .orderBy(desc(sessions.updatedAt))

    const sessionsWithCounts = await Promise.all(sessionList.map(async (s) => {
      const countResult = await db.select({ count: sql<number>`count(*)` }).from(messages).where(eq(messages.sessionId, s.id)).get()
      return {
        id: s.id,
        assistantId: s.assistantId,
        title: s.title,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: countResult?.count || 0
      }
    }))

    res.json(sessionsWithCounts)
  } catch (error) {
    logger.error('Get sessions error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.id

    const session = await db.select().from(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, userId))).get()

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    let assistantSlug: string | null = null
    if (session.assistantId) {
      const assistant = await db.select({ slug: assistants.slug }).from(assistants).where(eq(assistants.id, session.assistantId)).get()
      assistantSlug = assistant?.slug || null
    }

    const sessionMessages = await db.select({
      id: messages.id,
      senderType: messages.senderType,
      content: messages.content,
      reasoning: messages.reasoning,
      createdAt: messages.createdAt,
      userId: messages.userId,
      botId: messages.botId,
      inputTokens: messages.inputTokens,
      outputTokens: messages.outputTokens
    }).from(messages).where(eq(messages.sessionId, id)).orderBy(asc(messages.createdAt))

    const messagesWithDetails = await Promise.all(sessionMessages.map(async (m) => {
      let user = null
      let bot = null

      if (m.userId) {
        user = await db.select({ id: users.id, displayName: users.displayName }).from(users).where(eq(users.id, m.userId)).get()
      }

      if (m.botId) {
        bot = await db.select({ id: bots.id, displayName: bots.displayName, avatar: bots.avatar }).from(bots).where(eq(bots.id, m.botId)).get()
      }

      return {
        id: m.id,
        senderType: m.senderType,
        content: m.content,
        reasoning: m.reasoning,
        createdAt: m.createdAt,
        user,
        bot,
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens
      }
    }))

    res.json({
      id: session.id,
      assistantId: session.assistantId,
      assistantSlug,
      title: session.title,
      status: session.status,
      needHuman: session.needHuman,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: messagesWithDetails
    })
  } catch (error) {
    logger.error('Get session error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const { title } = req.body
    const userId = req.user!.id

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required' })
    }

    const session = await db.select().from(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, userId))).get()

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const [updated] = await db.update(sessions).set({ title, updatedAt: new Date() }).where(eq(sessions.id, id)).returning()

    res.json({
      id: updated.id,
      title: updated.title,
      updatedAt: updated.updatedAt
    })
  } catch (error) {
    logger.error('Update session error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.id

    const session = await db.select().from(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, userId), eq(sessions.isDeleted, false))).get()

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    await db.update(sessions).set({ isDeleted: true, status: 'closed', updatedAt: new Date() }).where(eq(sessions.id, id))

    if (session.opencodeSessionId) {
      const defaultBot = await db.select().from(bots).where(eq(bots.isActive, true)).get()
      if (defaultBot) {
        await deleteOpenCodeSession(defaultBot.apiUrl, session.opencodeSessionId)
      }
    }

    res.json({ success: true })
  } catch (error) {
    logger.error('Delete session error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body
    const userId = req.user!.id

    if (!status || !['active', 'human', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required (active, human, closed)' })
    }

    const session = await db.select().from(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, userId))).get()

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const updateData: { status: string; needHuman?: boolean; updatedAt: Date } = { status, updatedAt: new Date() }
    if (status === 'human') {
      updateData.needHuman = true
    }

    const [updated] = await db.update(sessions).set(updateData).where(eq(sessions.id, id)).returning()

    res.json({
      id: updated.id,
      status: updated.status,
      needHuman: updated.needHuman,
      updatedAt: updated.updatedAt
    })
  } catch (error) {
    logger.error('Update session status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
