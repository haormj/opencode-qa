import { Router } from 'express'
import { db, assistants } from '../db/index.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import logger from '../services/logger.js'

const router = Router()

router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const allAssistants = await db.select({
      id: assistants.id,
      name: assistants.name,
      slug: assistants.slug,
      description: assistants.description,
      isActive: assistants.isActive,
      createdAt: assistants.createdAt
    }).from(assistants).where(eq(assistants.isActive, true)).orderBy(assistants.name)

    res.json(allAssistants)
  } catch (error) {
    logger.error('Get assistants error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const assistant = await db.select({
      id: assistants.id,
      name: assistants.name,
      slug: assistants.slug,
      description: assistants.description,
      isActive: assistants.isActive,
      createdAt: assistants.createdAt
    }).from(assistants).where(and(eq(assistants.id, id), eq(assistants.isActive, true))).get()

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' })
    }

    res.json(assistant)
  } catch (error) {
    logger.error('Get assistant error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
