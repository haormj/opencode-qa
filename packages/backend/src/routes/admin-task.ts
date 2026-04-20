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
import { executeTask, executeTaskStream, cancelExecution, appendExecutionMessage, closeExecutionSession } from '../services/task-executor.js'
import { generateTaskMarkdown, prepareWorkspaceScripts } from '../services/task-markdown.js'
import {
  init as initScheduler,
  registerTask,
  cancelTask,
  type ScheduleConfig
} from '../services/task-scheduler.js'
import { db, bots, taskExecutions, taskExecutionMessages } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { encrypt, decrypt } from '../services/encryption.js'
import logger from '../services/logger.js'
import type { FlowData, Node } from '../types/task.js'
import { randomUUID } from 'crypto'

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

router.post('/executions/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.id
    
    const execution = await getExecutionById(id)
    if (!execution) {
      return res.status(404).json({ error: '执行记录不存在' })
    }
    
    if (execution.status !== 'running') {
      return res.status(400).json({ error: '只有运行中的任务可以终止' })
    }
    
    const task = await getTaskById(execution.taskId)
    if (!task || !task.botId) {
      return res.status(400).json({ error: '任务配置异常' })
    }
    
    const bot = await db.select().from(bots).where(eq(bots.id, task.botId)).get()
    if (!bot) {
      return res.status(400).json({ error: '机器人配置不存在' })
    }
    
    const botConfig = {
      apiUrl: bot.apiUrl,
      provider: bot.provider,
      model: bot.model,
      agent: bot.agent,
      apiKey: bot.apiKey ?? undefined
    }
    
    const result = await cancelExecution(id, userId, botConfig)
    
    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }
    
    res.json({ success: true, id, status: 'cancelled' })
  } catch (error) {
    logger.error('Cancel execution error:', error)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

router.post('/executions/:id/messages', async (req, res) => {
  try {
    const { id } = req.params
    const { content } = req.body
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: '消息内容不能为空' })
    }
    
    const result = await appendExecutionMessage(id, content)
    
    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }
    
    res.json({ success: true })
  } catch (error) {
    logger.error('Append execution message error:', error)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

router.post('/executions/:id/close', async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await closeExecutionSession(id)
    
    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }
    
    res.json({ success: true })
  } catch (error) {
    logger.error('Close execution session error:', error)
    res.status(500).json({ error: '服务器内部错误' })
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
    const { name, description, flowData, triggerType, scheduleConfig, webhookToken, botId } = req.body
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
      botId,
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
    const { name, description, flowData, triggerType, scheduleConfig, webhookToken, isActive, botId } = req.body
    
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
    if (botId !== undefined) updateData.botId = botId
    
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
    
    const existingTask = await getTaskById(id)
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' })
    }
    
    if (!existingTask.isActive) {
      if (!existingTask.botId) {
        return res.status(400).json({ error: '请先配置执行机器人' })
      }
      
      try {
        const flowData = JSON.parse(existingTask.flowData)
        if (!flowData.nodes || flowData.nodes.length === 0) {
          return res.status(400).json({ error: '请先配置任务流程' })
        }
      } catch {
        return res.status(400).json({ error: '任务流程数据异常' })
      }
    }
    
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

router.get('/:id/preview', async (req, res) => {
  try {
    const { id } = req.params
    
    const task = await getTaskById(id)
    if (!task) {
      return res.status(404).json({ error: '任务不存在' })
    }
    
    const flowData: FlowData = JSON.parse(task.flowData)
    const scriptsMap = await prepareWorkspaceScripts(flowData, undefined, { dryRun: true })
    const markdown = await generateTaskMarkdown(flowData, '{workspace}', scriptsMap)
    
    res.json({ markdown })
  } catch (error) {
    if (error instanceof Error && error.message.includes('服务器地址')) {
      return res.status(400).json({ error: error.message })
    }
    logger.error('Preview task error:', error)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

router.post('/:id/execute', async (req, res) => {
  try {
    const { id } = req.params
    const { debug } = req.body
    const userId = req.user!.id
    
    const task = await getTaskById(id)
    if (!task) {
      return res.status(404).json({ error: '任务不存在' })
    }
    
    if (!task.isActive) {
      return res.status(400).json({ error: '任务未启用' })
    }
    
    if (!task.botId) {
      return res.status(400).json({ error: '任务未配置机器人，请先在任务设置中选择机器人' })
    }
    
    const bot = await db.select().from(bots).where(eq(bots.id, task.botId)).get()
    if (!bot) {
      return res.status(400).json({ error: '配置的机器人不存在' })
    }
    
    if (!bot.isActive) {
      return res.status(400).json({ error: '配置的机器人未激活' })
    }
    
    const botConfig = {
      apiUrl: bot.apiUrl,
      provider: bot.provider,
      model: bot.model,
      agent: bot.agent,
      apiKey: bot.apiKey ?? undefined
    }
    
    const executionId = await executeTaskStream({
      taskId: id,
      triggerType: 'manual',
      triggeredBy: userId,
      botConfig,
      botId: bot.id,
      debug: debug || false
    })
    
    res.json({ executionId })
  } catch (error) {
    logger.error('Execute task error:', error)
    res.status(500).json({ error: '服务器内部错误' })
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

export { initScheduler }
export default router
