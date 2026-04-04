import { Router } from 'express'
import { prisma } from '../index.js'
import { askQuestion } from '../services/opencode.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

router.post('/', async (req, res) => {
  try {
    const { question } = req.body
    
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required' })
    }
    
    const userId = req.headers['x-user-id'] as string || uuidv4()
    
    const { sessionId, answer } = await askQuestion(question)
    
    const saved = await prisma.question.create({
      data: {
        userId,
        sessionId,
        question,
        answer,
        status: 'solved'
      }
    })
    
    res.json({
      id: saved.id,
      sessionId: saved.sessionId,
      question: saved.question,
      answer: saved.answer,
      status: saved.status,
      createdAt: saved.createdAt
    })
  } catch (error) {
    console.error('Chat error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params
    
    const question = await prisma.question.findFirst({
      where: { sessionId },
      include: { feedback: true }
    })
    
    if (!question) {
      return res.status(404).json({ error: 'Session not found' })
    }
    
    res.json(question)
  } catch (error) {
    console.error('Get session error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
