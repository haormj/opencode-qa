import { Router } from 'express'
import { prisma } from '../index.js'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'

const router = Router()

router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const bots = await prisma.bot.findMany({
      orderBy: { createdAt: 'desc' }
    })

    res.json(bots.map(bot => ({
      id: bot.id,
      name: bot.name,
      displayName: bot.displayName,
      avatar: bot.avatar,
      apiUrl: bot.apiUrl,
      provider: bot.provider,
      model: bot.model,
      description: bot.description,
      isActive: bot.isActive,
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt
    })))
  } catch (error) {
    console.error('Get bots error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const bot = await prisma.bot.findUnique({
      where: { id }
    })

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
      description: bot.description,
      isActive: bot.isActive,
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt
    })
  } catch (error) {
    console.error('Get bot error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, displayName, avatar, apiUrl, apiKey, provider, model, description, isActive } = req.body

    if (!name || !displayName || !apiUrl || !provider || !model) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const bot = await prisma.bot.create({
      data: {
        name,
        displayName,
        avatar,
        apiUrl,
        apiKey,
        provider,
        model,
        description,
        isActive: isActive ?? true
      }
    })

    res.json({
      id: bot.id,
      name: bot.name,
      displayName: bot.displayName,
      avatar: bot.avatar,
      apiUrl: bot.apiUrl,
      provider: bot.provider,
      model: bot.model,
      description: bot.description,
      isActive: bot.isActive,
      createdAt: bot.createdAt
    })
  } catch (error) {
    console.error('Create bot error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { name, displayName, avatar, apiUrl, apiKey, provider, model, description, isActive } = req.body

    const bot = await prisma.bot.update({
      where: { id },
      data: {
        name,
        displayName,
        avatar,
        apiUrl,
        apiKey,
        provider,
        model,
        description,
        isActive
      }
    })

    res.json({
      id: bot.id,
      name: bot.name,
      displayName: bot.displayName,
      avatar: bot.avatar,
      apiUrl: bot.apiUrl,
      provider: bot.provider,
      model: bot.model,
      description: bot.description,
      isActive: bot.isActive,
      updatedAt: bot.updatedAt
    })
  } catch (error) {
    console.error('Update bot error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params

    await prisma.bot.delete({
      where: { id }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Delete bot error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
