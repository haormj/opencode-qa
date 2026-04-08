import { Router } from 'express'
import { db, bots } from '../db/index.js'
import { eq, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'
import logger from '../services/logger.js'

const router = Router()

router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const allBots = await db.select().from(bots).orderBy(desc(bots.createdAt))

    res.json(allBots.map(bot => ({
      id: bot.id,
      name: bot.name,
      displayName: bot.displayName,
      avatar: bot.avatar,
      apiUrl: bot.apiUrl,
      provider: bot.provider,
      model: bot.model,
      agent: bot.agent,
      description: bot.description,
      isActive: bot.isActive,
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt
    })))
  } catch (error) {
    logger.error('Get bots error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const bot = await db.select().from(bots).where(eq(bots.id, id)).get()

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' })
    }

    res.json({
      id: bot.id,
      name: bot.name,
      displayName: bot.displayName,
      avatar: bot.avatar,
      apiUrl: bot.apiUrl,
      apiKey: bot.apiKey,
      provider: bot.provider,
      model: bot.model,
      agent: bot.agent,
      description: bot.description,
      isActive: bot.isActive,
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt
    })
  } catch (error) {
    logger.error('Get bot error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, displayName, avatar, apiUrl, apiKey, provider, model, agent, description, isActive } = req.body

    if (!name || !displayName || !apiUrl || !provider || !model) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const now = new Date()
    const [bot] = await db.insert(bots).values({
      id: randomUUID(),
      name,
      displayName,
      avatar,
      apiUrl,
      apiKey,
      provider,
      model,
      agent: agent || 'plan',
      description,
      isActive: isActive ?? true,
      createdAt: now,
      updatedAt: now
    }).returning()

    res.json({
      id: bot.id,
      name: bot.name,
      displayName: bot.displayName,
      avatar: bot.avatar,
      apiUrl: bot.apiUrl,
      provider: bot.provider,
      model: bot.model,
      agent: bot.agent,
      description: bot.description,
      isActive: bot.isActive,
      createdAt: bot.createdAt
    })
  } catch (error) {
    logger.error('Create bot error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { name, displayName, avatar, apiUrl, apiKey, provider, model, agent, description, isActive } = req.body

    const [bot] = await db.update(bots).set({
      name,
      displayName,
      avatar,
      apiUrl,
      apiKey,
      provider,
      model,
      agent,
      description,
      isActive,
      updatedAt: new Date()
    }).where(eq(bots.id, id)).returning()

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' })
    }

    res.json({
      id: bot.id,
      name: bot.name,
      displayName: bot.displayName,
      avatar: bot.avatar,
      apiUrl: bot.apiUrl,
      provider: bot.provider,
      model: bot.model,
      agent: bot.agent,
      description: bot.description,
      isActive: bot.isActive,
      updatedAt: bot.updatedAt
    })
  } catch (error) {
    logger.error('Update bot error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const bot = await db.select().from(bots).where(eq(bots.id, id)).get()

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' })
    }

    if (bot.name === 'default') {
      return res.status(400).json({ error: 'Cannot delete default bot' })
    }

    await db.delete(bots).where(eq(bots.id, id))

    res.json({ success: true })
  } catch (error) {
    logger.error('Delete bot error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
