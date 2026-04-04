import { Router } from 'express'
import { prisma } from '../index.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { questionId, reason, contact } = req.body
    const userId = req.user!.id

    if (!questionId || !reason) {
      return res.status(400).json({ error: 'questionId and reason are required' })
    }

    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        session: { userId }
      }
    })

    if (!question) {
      return res.status(404).json({ error: 'Question not found' })
    }

    const feedback = await prisma.feedback.create({
      data: {
        questionId,
        reason,
        contact
      }
    })

    await prisma.question.update({
      where: { id: questionId },
      data: { status: 'unsolved' }
    })

    res.json(feedback)
  } catch (error) {
    console.error('Feedback error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
