import { Router } from 'express'
import { prisma } from '../index.js'
import { askQuestion } from '../services/opencode.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

router.post('/stream', async (req, res) => {
  try {
    console.log('[Stream] Request received:', req.body)

    const { question, sessionId: existingSessionId } = req.body

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required' })
    }

    const userId = req.headers['x-user-id'] as string || uuidv4()

    console.log('[Stream] Calling askQuestion...')
    const { sessionId, answer } = await askQuestion(question, existingSessionId)
    console.log('[Stream] askQuestion completed:', { sessionId, answerLength: answer.length })

    let session
    if (!existingSessionId) {
      const title = question.length > 30 ? question.substring(0, 30) + '...' : question
      session = await prisma.session.create({
        data: {
          id: sessionId,
          userId,
          title
        }
      })
    } else {
      session = await prisma.session.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() }
      })
    }

    const saved = await prisma.question.create({
      data: {
        userId,
        sessionId,
        question,
        answer: answer || '抱歉，我无法回答这个问题。',
        status: 'solved'
      }
    })

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const sendEvent = (event: string, data: Record<string, unknown>) => {
      res.write(`event: ${event}\n`)
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    sendEvent('session', { sessionId })

    const chars = answer.split('')
    let index = 0

    const interval = setInterval(() => {
      if (index < chars.length) {
        const chunk = chars.slice(index, index + 2).join('')
        sendEvent('text', { text: chunk })
        index += 2
      } else {
        clearInterval(interval)
        sendEvent('done', {
          id: saved.id,
          sessionId: saved.sessionId,
          question: saved.question,
          answer: saved.answer,
          status: saved.status,
          createdAt: saved.createdAt
        })
        res.end()
      }
    }, 15)

    req.on('close', () => {
      clearInterval(interval)
    })
  } catch (error) {
    console.error('[Stream] Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body
    })
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params
    const userId = req.headers['x-user-id'] as string

    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId },
      include: {
        questions: {
          orderBy: { createdAt: 'asc' },
          include: { feedback: true }
        }
      }
    })

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    res.json({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      questions: session.questions
    })
  } catch (error) {
    console.error('Get session error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
