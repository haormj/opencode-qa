import { Router } from 'express'
import { db, bots, assistants, userAssistantBots, sessions } from '../db/index.js'
import { eq, desc, and, sql, inArray } from 'drizzle-orm'
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

    // 1. Check if any assistant uses this bot as default
    const assistantRefs = await db.select({ id: assistants.id, name: assistants.name })
      .from(assistants).where(eq(assistants.defaultBotId, id))

    if (assistantRefs.length > 0) {
      const names = assistantRefs.map(a => a.name).join('、')
      return res.status(400).json({ error: `该机器人正在被以下助手使用：${names}，请先修改助手的默认机器人` })
    }

    // 2. Check if any user-assistant-bot assignment uses this bot
    const userBotRefs = await db.select()
      .from(userAssistantBots).where(eq(userAssistantBots.botId, id))

    if (userBotRefs.length > 0) {
      return res.status(400).json({ error: '该机器人正在被用户分配使用，请先取消相关分配' })
    }

    // 3. Check if any active session uses this bot through its assistant
    // Find assistants whose defaultBotId is this bot (already checked above, but also
    // check sessions directly by assistantId linked to assistants using this bot)
    const affectedAssistantIds = assistantRefs.map(a => a.id)
    if (affectedAssistantIds.length > 0) {
      const activeSessionResult = await db.select({ count: sql<number>`count(*)` })
        .from(sessions)
        .where(and(
          inArray(sessions.assistantId, affectedAssistantIds),
          eq(sessions.status, 'active')
        )).get()

      if (activeSessionResult && activeSessionResult.count > 0) {
        return res.status(400).json({ error: `该机器人正在 ${activeSessionResult.count} 个活跃会话中使用，请先关闭相关会话` })
      }
    }

    await db.delete(bots).where(eq(bots.id, id))

    res.json({ success: true })
  } catch (error) {
    logger.error('Delete bot error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
