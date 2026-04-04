import { Router } from 'express'
import { prisma } from '../index.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { messageId, reason, contact } = req.body

    if (!messageId || !reason) {
      return res.status(400).json({ error: 'messageId and reason are required' })
    }

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        session: { userId: req.user!.id }
      }
    })

    if (!message) {
      return res.status(404).json({ error: 'Message not found' })
    }

    const feedback = await prisma.feedback.create({
      data: {
        messageId,
        reason,
        contact
      }
    })

    res.json(feedback)
  } catch (error) {
    console.error('Feedback error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
