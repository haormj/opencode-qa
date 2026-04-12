import { Router } from 'express'
import { db, assistants, bots, userAssistantBots } from '../db/index.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import logger from '../services/logger.js'

const router = Router()

router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id

    const allAssistants = await db.select({
      id: assistants.id,
      name: assistants.name,
      slug: assistants.slug,
      description: assistants.description,
      defaultBotId: assistants.defaultBotId,
      isActive: assistants.isActive,
      createdAt: assistants.createdAt
    }).from(assistants).where(eq(assistants.isActive, true)).orderBy(assistants.name)

    const assistantsWithBot = await Promise.all(allAssistants.map(async (assistant) => {
      const userBotAssignment = await db.select()
        .from(userAssistantBots)
        .where(and(
          eq(userAssistantBots.assistantId, assistant.id),
          eq(userAssistantBots.userId, userId)
        ))
        .get()

      let effectiveBotId: string | null = null

      if (userBotAssignment) {
        effectiveBotId = userBotAssignment.botId
      } else {
        effectiveBotId = assistant.defaultBotId
      }

      let effectiveBot = null
      if (effectiveBotId) {
        effectiveBot = await db.select({
          id: bots.id,
          name: bots.name,
          displayName: bots.displayName,
          avatar: bots.avatar
        }).from(bots).where(eq(bots.id, effectiveBotId)).get()
      }

      return {
        id: assistant.id,
        name: assistant.name,
        slug: assistant.slug,
        description: assistant.description,
        defaultBotId: assistant.defaultBotId,
        defaultBot: effectiveBot,
        isActive: assistant.isActive,
        createdAt: assistant.createdAt
      }
    }))

    res.json(assistantsWithBot)
  } catch (error) {
    logger.error('Get assistants error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.id

    const assistant = await db.select({
      id: assistants.id,
      name: assistants.name,
      slug: assistants.slug,
      description: assistants.description,
      defaultBotId: assistants.defaultBotId,
      isActive: assistants.isActive,
      createdAt: assistants.createdAt
    }).from(assistants).where(and(eq(assistants.id, id), eq(assistants.isActive, true))).get()

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' })
    }

    const userBotAssignment = await db.select()
      .from(userAssistantBots)
      .where(and(
        eq(userAssistantBots.assistantId, assistant.id),
        eq(userAssistantBots.userId, userId)
      ))
      .get()

    let effectiveBotId: string | null = null

    if (userBotAssignment) {
      effectiveBotId = userBotAssignment.botId
    } else {
      effectiveBotId = assistant.defaultBotId
    }

    let effectiveBot = null
    if (effectiveBotId) {
      effectiveBot = await db.select({
        id: bots.id,
        name: bots.name,
        displayName: bots.displayName,
        avatar: bots.avatar
      }).from(bots).where(eq(bots.id, effectiveBotId)).get()
    }

    res.json({
      id: assistant.id,
      name: assistant.name,
      slug: assistant.slug,
      description: assistant.description,
      defaultBotId: assistant.defaultBotId,
      defaultBot: effectiveBot,
      isActive: assistant.isActive,
      createdAt: assistant.createdAt
    })
  } catch (error) {
    logger.error('Get assistant error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
