import { Router } from 'express'
import { db, systemSettings } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'
import logger from '../services/logger.js'

const router = Router()

router.use(authMiddleware)
router.use(requireAdmin)

router.get('/', async (_req, res) => {
  try {
    const settings = await db.select().from(systemSettings)
    res.json(settings.map(s => ({
      id: s.id,
      key: s.key,
      value: s.value,
      description: s.description,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    })))
  } catch (error) {
    logger.error('Get settings error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params
    const { value } = req.body

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' })
    }

    const existing = await db.select().from(systemSettings)
      .where(eq(systemSettings.key, key))
      .get()

    if (!existing) {
      return res.status(404).json({ error: 'Setting not found' })
    }

    const [updated] = await db.update(systemSettings)
      .set({ value: String(value), updatedAt: new Date() })
      .where(eq(systemSettings.key, key))
      .returning()

    res.json({
      id: updated.id,
      key: updated.key,
      value: updated.value,
      description: updated.description,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    })
  } catch (error) {
    logger.error('Update setting error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
