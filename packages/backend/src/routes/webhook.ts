import { Router } from 'express'
import { db, tasks, bots } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { executeTask } from '../services/task-executor.js'
import logger from '../services/logger.js'

const router = Router()

router.post('/trigger/:token', async (req, res) => {
  try {
    const { token } = req.params
    const payload = req.body
    
    const task = await db.select()
      .from(tasks)
      .where(eq(tasks.webhookToken, token))
      .get()
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found or invalid token' })
    }
    
    if (!task.isActive) {
      return res.status(400).json({ error: 'Task is not active' })
    }
    
    if (task.triggerType !== 'webhook') {
      return res.status(400).json({ error: 'Task is not configured for webhook trigger' })
    }
    
    const bot = await db.select().from(bots).where(eq(bots.isActive, true)).get()
    if (!bot) {
      return res.status(400).json({ error: 'No active bot configured' })
    }
    
    const botConfig = {
      apiUrl: bot.apiUrl,
      provider: bot.provider,
      model: bot.model,
      agent: bot.agent,
      apiKey: bot.apiKey ?? undefined
    }
    
    const result = await executeTask({
      taskId: task.id,
      triggerType: 'webhook',
      triggeredBy: null,
      botConfig,
      webhookPayload: payload
    })
    
    res.json({ success: true, executionId: result.executionId })
  } catch (error) {
    logger.error('Webhook trigger error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
