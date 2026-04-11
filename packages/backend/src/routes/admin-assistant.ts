import { Router } from 'express'
import { db, assistants, bots, users, userAssistantBots } from '../db/index.js'
import { eq, and, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'
import logger from '../services/logger.js'

const router = Router()

router.use(authMiddleware)
router.use(requireAdmin)

router.get('/', async (req, res) => {
  try {
    const allAssistants = await db.select({
      id: assistants.id,
      name: assistants.name,
      slug: assistants.slug,
      description: assistants.description,
      defaultBotId: assistants.defaultBotId,
      isActive: assistants.isActive,
      createdAt: assistants.createdAt,
      updatedAt: assistants.updatedAt
    }).from(assistants).orderBy(desc(assistants.createdAt))

    const assistantsWithBot = await Promise.all(allAssistants.map(async (assistant) => {
      const bot = await db.select({
        id: bots.id,
        name: bots.name,
        displayName: bots.displayName
      }).from(bots).where(eq(bots.id, assistant.defaultBotId)).get()

      return {
        ...assistant,
        defaultBot: bot
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

    const assistant = await db.select().from(assistants).where(eq(assistants.id, id)).get()

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' })
    }

    const bot = await db.select({
      id: bots.id,
      name: bots.name,
      displayName: bots.displayName
    }).from(bots).where(eq(bots.id, assistant.defaultBotId)).get()

    res.json({
      ...assistant,
      defaultBot: bot
    })
  } catch (error) {
    logger.error('Get assistant error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { name, slug, description, defaultBotId, isActive } = req.body

    if (!name || !slug || !defaultBotId) {
      return res.status(400).json({ error: 'Missing required fields: name, slug, defaultBotId' })
    }

    const bot = await db.select().from(bots).where(eq(bots.id, defaultBotId)).get()
    if (!bot) {
      return res.status(400).json({ error: 'Bot not found' })
    }

    const now = new Date()
    const [assistant] = await db.insert(assistants).values({
      id: randomUUID(),
      name,
      slug,
      description,
      defaultBotId,
      isActive: isActive ?? true,
      createdAt: now,
      updatedAt: now
    }).returning()

    res.json(assistant)
  } catch (error) {
    logger.error('Create assistant error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, slug, description, defaultBotId, isActive } = req.body

    if (defaultBotId) {
      const bot = await db.select().from(bots).where(eq(bots.id, defaultBotId)).get()
      if (!bot) {
        return res.status(400).json({ error: 'Bot not found' })
      }
    }

    const [assistant] = await db.update(assistants).set({
      name,
      slug,
      description,
      defaultBotId,
      isActive,
      updatedAt: new Date()
    }).where(eq(assistants.id, id)).returning()

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' })
    }

    res.json(assistant)
  } catch (error) {
    logger.error('Update assistant error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const assistant = await db.select().from(assistants).where(eq(assistants.id, id)).get()

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' })
    }

    if (assistant.slug === 'default') {
      return res.status(400).json({ error: 'Cannot delete default assistant' })
    }

    await db.delete(assistants).where(eq(assistants.id, id))

    res.json({ success: true })
  } catch (error) {
    logger.error('Delete assistant error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id/user-bots', async (req, res) => {
  try {
    const { id } = req.params

    const assignments = await db.select({
      id: userAssistantBots.id,
      assistantId: userAssistantBots.assistantId,
      userId: userAssistantBots.userId,
      botId: userAssistantBots.botId,
      createdAt: userAssistantBots.createdAt
    }).from(userAssistantBots).where(eq(userAssistantBots.assistantId, id))

    const assignmentsWithDetails = await Promise.all(assignments.map(async (assignment) => {
      const user = await db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName
      }).from(users).where(eq(users.id, assignment.userId)).get()

      const bot = await db.select({
        id: bots.id,
        name: bots.name,
        displayName: bots.displayName
      }).from(bots).where(eq(bots.id, assignment.botId)).get()

      return {
        ...assignment,
        user,
        bot
      }
    }))

    res.json(assignmentsWithDetails)
  } catch (error) {
    logger.error('Get user-bot assignments error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/user-bots', async (req, res) => {
  try {
    const { id } = req.params
    const { userId, botId } = req.body

    if (!userId || !botId) {
      return res.status(400).json({ error: 'Missing required fields: userId, botId' })
    }

    const assistant = await db.select().from(assistants).where(eq(assistants.id, id)).get()
    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' })
    }

    const user = await db.select().from(users).where(eq(users.id, userId)).get()
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const bot = await db.select().from(bots).where(eq(bots.id, botId)).get()
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' })
    }

    const now = new Date()
    const [assignment] = await db.insert(userAssistantBots).values({
      assistantId: id,
      userId,
      botId,
      createdAt: now,
      updatedAt: now
    }).onConflictDoUpdate({
      target: [userAssistantBots.assistantId, userAssistantBots.userId],
      set: { botId, updatedAt: now }
    }).returning()

    res.json(assignment)
  } catch (error) {
    logger.error('Create user-bot assignment error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/:id/user-bots/:userId', async (req, res) => {
  try {
    const { id, userId } = req.params
    const { botId } = req.body

    if (!botId) {
      return res.status(400).json({ error: 'Missing required field: botId' })
    }

    const bot = await db.select().from(bots).where(eq(bots.id, botId)).get()
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' })
    }

    const [assignment] = await db.update(userAssistantBots).set({
      botId,
      updatedAt: new Date()
    }).where(and(
      eq(userAssistantBots.assistantId, id),
      eq(userAssistantBots.userId, userId)
    )).returning()

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' })
    }

    res.json(assignment)
  } catch (error) {
    logger.error('Update user-bot assignment error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id/user-bots/:userId', async (req, res) => {
  try {
    const { id, userId } = req.params

    await db.delete(userAssistantBots).where(and(
      eq(userAssistantBots.assistantId, id),
      eq(userAssistantBots.userId, userId)
    ))

    res.json({ success: true })
  } catch (error) {
    logger.error('Delete user-bot assignment error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
