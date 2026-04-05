import { Router } from 'express'
import { prisma } from '../index.js'
import { authMiddleware } from '../middleware/auth.js'
import logger from '../services/logger.js'

const router = Router()

router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id

    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const skip = (page - 1) * pageSize

    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: { id: true, displayName: true }
            },
            bot: {
              select: { id: true, displayName: true }
            }
          }
        }
      }
    })

    const messages = sessions.flatMap(s => s.messages)

    res.json({
      total: messages.length,
      page,
      pageSize,
      items: messages.map(m => ({
        id: m.id,
        sessionId: m.sessionId,
        senderType: m.senderType,
        content: m.content,
        createdAt: m.createdAt,
        user: m.user,
        bot: m.bot
      }))
    })
  } catch (error) {
    logger.error('History error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
