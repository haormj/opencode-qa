import { Router } from 'express'
import { db, systemSettings } from '../db/index.js'
import { like, or } from 'drizzle-orm'
import logger from '../services/logger.js'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const settings = await db.select().from(systemSettings)
      .where(or(
        like(systemSettings.key, 'login.%'),
        like(systemSettings.key, 'site.%'),
        like(systemSettings.key, 'install.%')
      ))

    const result: Record<string, string> = {}
    for (const s of settings) {
      result[s.key] = s.value
    }

    res.json(result)
  } catch (error) {
    logger.error('Get public settings error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
