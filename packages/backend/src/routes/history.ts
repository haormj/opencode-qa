import { Router } from 'express'
import { db, sessions, messages, users, bots } from '../db/index.js'
import { eq, desc, asc } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import logger from '../services/logger.js'

const router = Router()

router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id

    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const offset = (page - 1) * pageSize

    const sessionList = await db.select().from(sessions).where(eq(sessions.userId, userId)).orderBy(desc(sessions.updatedAt)).limit(pageSize).offset(offset)

    const allMessages: Array<{
      id: string
      sessionId: string
      senderType: string
      content: string
      createdAt: Date
      user: { id: string; displayName: string | null } | null
      bot: { id: string; displayName: string | null; avatar: string | null } | null
    }> = []

    for (const s of sessionList) {
      const sessionMessages = await db.select({
        id: messages.id,
        sessionId: messages.sessionId,
        senderType: messages.senderType,
        content: messages.content,
        createdAt: messages.createdAt,
        userId: messages.userId,
        botId: messages.botId
      }).from(messages).where(eq(messages.sessionId, s.id)).orderBy(asc(messages.createdAt))

      for (const m of sessionMessages) {
        let user = null
        let bot = null

        if (m.userId) {
          const userResult = await db.select({ id: users.id, displayName: users.displayName }).from(users).where(eq(users.id, m.userId)).get()
          user = userResult ?? null
        }

        if (m.botId) {
          const botResult = await db.select({ id: bots.id, displayName: bots.displayName, avatar: bots.avatar }).from(bots).where(eq(bots.id, m.botId)).get()
          bot = botResult ?? null
        }

        allMessages.push({
          id: m.id,
          sessionId: m.sessionId,
          senderType: m.senderType,
          content: m.content,
          createdAt: m.createdAt,
          user,
          bot
        })
      }
    }

    res.json({
      total: allMessages.length,
      page,
      pageSize,
      items: allMessages
    })
  } catch (error) {
    logger.error('History error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
