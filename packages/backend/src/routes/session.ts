import { Router } from 'express'
import { prisma } from '../index.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id

    const sessions = await prisma.session.findMany({
      where: { userId },
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
    console.error('Get sessions error:', error)
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
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages.map(m => ({
        id: m.id,
        senderType: m.senderType,
        content: m.content,
        createdAt: m.createdAt,
        user: m.user,
        bot: m.bot
      }))
    })
  } catch (error) {
    console.error('Get session error:', error)
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
    console.error('Update session error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.id

    const session = await prisma.session.findFirst({
      where: { id, userId }
    })

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    await prisma.session.delete({
      where: { id }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Delete session error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body
    const userId = req.user!.id

    if (!status || !['active', 'need_human', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required (active, need_human, resolved)' })
    }

    const session = await prisma.session.findFirst({
      where: { id, userId }
    })

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const updated = await prisma.session.update({
      where: { id },
      data: { status }
    })

    res.json({
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt
    })
  } catch (error) {
    console.error('Update session status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
