import { Router } from 'express'
import { prisma } from '../index.js'
import { authMiddleware } from '../middleware/auth.js'
import { deleteOpenCodeSession } from '../services/opencode.js'
import logger from '../services/logger.js'

const router = Router()

router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id
    const { title } = req.body

    const sessionTitle = title && typeof title === 'string' && title.trim()
      ? (title.length > 30 ? title.substring(0, 30) + '...' : title)
      : '新对话'

    const session = await prisma.session.create({
      data: {
        userId,
        title: sessionTitle,
        status: 'active'
      }
    })

    res.json({
      id: session.id,
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

    const session = await prisma.session.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true }
    })

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    res.json(session)
  } catch (error) {
    logger.error('Get session info error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id

    const sessions = await prisma.session.findMany({
      where: { userId, isDeleted: false },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true }
        }
      }
    })

    res.json(sessions.map(s => ({
      id: s.id,
      title: s.title,
      status: s.status,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messageCount: s._count.messages
    })))
  } catch (error) {
    logger.error('Get sessions error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.id

    const session = await prisma.session.findFirst({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: { id: true, displayName: true }
            },
            bot: {
              select: { id: true, displayName: true, avatar: true }
            }
          }
        }
      }
    })

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    res.json({
      id: session.id,
      title: session.title,
      status: session.status,
      needHuman: session.needHuman,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages.map(m => ({
        id: m.id,
        senderType: m.senderType,
        content: m.content,
        reasoning: m.reasoning,
        createdAt: m.createdAt,
        user: m.user,
        bot: m.bot
      }))
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

    const session = await prisma.session.findFirst({
      where: { id, userId }
    })

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const updated = await prisma.session.update({
      where: { id },
      data: { title }
    })

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

    const session = await prisma.session.findFirst({
      where: { id, userId, isDeleted: false }
    })

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    await prisma.session.update({
      where: { id },
      data: { isDeleted: true, status: 'closed' }
    })

    if (session.opencodeSessionId) {
      const defaultBot = await prisma.bot.findFirst({
        where: { isActive: true }
      })
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

    const session = await prisma.session.findFirst({
      where: { id, userId }
    })

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const updateData: { status: string; needHuman?: boolean } = { status }
    if (status === 'human') {
      updateData.needHuman = true
    }

    const updated = await prisma.session.update({
      where: { id },
      data: updateData
    })

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
