import { Router } from 'express'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  toggleTask,
  getExecutionsByTaskId,
  getAllExecutions,
  getExecutionById,
  getExecutionMessages
} from '../services/task.js'
import { executeTask } from '../services/task-executor.js'
import {
  init as initScheduler,
  registerTask,
  cancelTask,
  type ScheduleConfig
} from '../services/task-scheduler.js'
import { db, bots } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { encrypt } from '../services/encryption.js'
import logger from '../services/logger.js'
import type { FlowData, Node } from '../types/task.js'

const router = Router()

router.use(authMiddleware)
router.use(requireAdmin)

function encryptPasswordsInFlow(flowData: string): string {
  try {
    const flow: FlowData = JSON.parse(flowData)
    
    for (const node of flow.nodes) {
      if (node.type === 'codeDownload' && node.data) {
        const data = node.data as { password?: string }
        if (data.password) {
          data.password = encrypt(data.password)
        }
      }
    }
    
    return JSON.stringify(flow)
  } catch {
    return flowData
  }
}

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 10
    
    const { list, total } = await getTasks({ page, pageSize })
    
    res.json({ items: list, total, page, pageSize })
  } catch (error) {
    logger.error('Get tasks error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const task = await getTaskById(id)
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }
    
    res.json(task)
  } catch (error) {
    logger.error('Get task error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { name, description, flowData, triggerType, scheduleConfig, webhookToken } = req.body
    const userId = req.user!.id
    
    if (!name || !flowData) {
      return res.status(400).json({ error: 'Missing required fields: name, flowData' })
    }
    
    const encryptedFlowData = encryptPasswordsInFlow(flowData)
    
    const task = await createTask({
      name,
      description,
      flowData: encryptedFlowData,
      triggerType: triggerType || 'manual',
      scheduleConfig,
      webhookToken,
      createdBy: userId
    })
    
    if (triggerType === 'schedule' && scheduleConfig) {
      try {
        const config: ScheduleConfig = JSON.parse(scheduleConfig)
        await registerTask(task.id, task.name, config)
      } catch (e) {
        logger.error('Failed to register task scheduler:', e)
      }
    }
    
    res.json(task)
  } catch (error) {
    logger.error('Create task error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, flowData, triggerType, scheduleConfig, webhookToken, isActive } = req.body
    
    const existingTask = await getTaskById(id)
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' })
    }
    
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (flowData !== undefined) updateData.flowData = encryptPasswordsInFlow(flowData)
    if (triggerType !== undefined) updateData.triggerType = triggerType
    if (scheduleConfig !== undefined) updateData.scheduleConfig = scheduleConfig
    if (webhookToken !== undefined) updateData.webhookToken = webhookToken
    if (isActive !== undefined) updateData.isActive = isActive
    
    const task = await updateTask(id, updateData)
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }
    
    if (task.isActive && task.triggerType === 'schedule' && task.scheduleConfig) {
      try {
        const config: ScheduleConfig = JSON.parse(task.scheduleConfig)
        await registerTask(task.id, task.name, config)
      } catch (e) {
        logger.error('Failed to update task scheduler:', e)
      }
    } else {
      cancelTask(id)
    }
    
    res.json(task)
  } catch (error) {
    logger.error('Update task error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const task = await getTaskById(id)
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }
    
    cancelTask(id)
    await deleteTask(id)
    
    res.json({ success: true })
  } catch (error) {
    logger.error('Delete task error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params
    
    const task = await toggleTask(id)
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }
    
    if (task.isActive && task.triggerType === 'schedule' && task.scheduleConfig) {
      try {
        const config: ScheduleConfig = JSON.parse(task.scheduleConfig)
        await registerTask(task.id, task.name, config)
      } catch (e) {
        logger.error('Failed to register task scheduler:', e)
      }
    } else {
      cancelTask(id)
    }
    
    res.json(task)
  } catch (error) {
    logger.error('Toggle task error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/execute', async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.id
    
    const task = await getTaskById(id)
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }
    
    if (!task.isActive) {
      return res.status(400).json({ error: 'Task is not active' })
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
      taskId: id,
      triggerType: 'manual',
      triggeredBy: userId,
      botConfig
    })
    
    res.json(result)
  } catch (error) {
    logger.error('Execute task error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/executions', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 10
    const taskId = req.query.taskId as string | undefined
    
    const executions = await getAllExecutions({ page, pageSize, taskId })
    
    res.json(executions)
  } catch (error) {
    logger.error('Get all executions error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id/executions', async (req, res) => {
  try {
    const { id } = req.params
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 10
    
    const task = await getTaskById(id)
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }
    
    const executions = await getExecutionsByTaskId(id, { page, pageSize })
    
    res.json(executions)
  } catch (error) {
    logger.error('Get task executions error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/executions/:id', async (req, res) => {
  try {
    const { id } = req.params
    const execution = await getExecutionById(id)
    
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' })
    }
    
    res.json(execution)
  } catch (error) {
    logger.error('Get execution error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/executions/:id/messages', async (req, res) => {
  try {
    const { id } = req.params
    
    const execution = await getExecutionById(id)
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' })
    }
    
    const messages = await getExecutionMessages(id)
    
    res.json(messages)
  } catch (error) {
    logger.error('Get execution messages error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export { initScheduler }
export default router
