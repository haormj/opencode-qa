import { Router } from 'express'
import { prisma } from '../index.js'

const router = Router()

router.post('/', async (req, res) => {
  try {
    const { questionId, reason, contact } = req.body
    
    if (!questionId || !reason) {
      return res.status(400).json({ error: 'questionId and reason are required' })
    }
    
    const question = await prisma.question.findUnique({
      where: { id: questionId }
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
    
    // TODO: 集成 WeLink 通知
    // await sendWeLinkNotification(question, feedback)
    
    res.json(feedback)
  } catch (error) {
    console.error('Feedback error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/pending', async (_req, res) => {
  try {
    const pending = await prisma.feedback.findMany({
      where: { resolved: false },
      include: { question: true },
      orderBy: { createdAt: 'desc' }
    })
    
    res.json(pending)
  } catch (error) {
    console.error('Pending feedback error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params
    
    const feedback = await prisma.feedback.update({
      where: { id: parseInt(id) },
      data: { resolved: true }
    })
    
    await prisma.question.update({
      where: { id: feedback.questionId },
      data: { status: 'solved' }
    })
    
    res.json(feedback)
  } catch (error) {
    console.error('Resolve feedback error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
