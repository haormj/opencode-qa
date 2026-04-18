import { db, tasks, taskExecutions, taskExecutionMessages } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { sendOpenCodeMessage, sendOpenCodeMessageStream, type BotConfig } from './opencode.js'
import { executionEventManager } from './execution-event-manager.js'
import { generateTaskMarkdown } from './task-markdown.js'
import logger from './logger.js'
import type { FlowData, Node, NodeType, NodeData, SkillInstallNodeData, CodeDownloadNodeData, StepNodeData, OutputNodeData } from '../types/task.js'

interface ExecuteTaskOptions {
  taskId: string
  triggerType: 'manual' | 'schedule' | 'webhook'
  triggeredBy?: string | null
  botConfig: BotConfig
  botId?: string | null
  webhookPayload?: Record<string, unknown>
}

interface ExecutionResult {
  executionId: string
  status: 'completed' | 'failed'
  result?: string
  error?: string
}

export async function executeTask(options: ExecuteTaskOptions): Promise<ExecutionResult> {
  const { taskId, triggerType, triggeredBy, botConfig, botId, webhookPayload } = options
  
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).get()
  if (!task) {
    throw new Error(`Task not found: ${taskId}`)
  }
  
  const executionId = randomUUID()
  const now = new Date()
  
  await db.insert(taskExecutions).values({
    id: executionId,
    taskId,
    status: 'running',
    startedAt: now,
    triggerType,
    triggeredBy: triggeredBy ?? null,
    botId: botId ?? null,
    createdAt: now
  })
  
  try {
    const flowData: FlowData = JSON.parse(task.flowData)
    const markdown = await generateTaskMarkdown(flowData)
    
    await saveMessage(executionId, 'user', markdown)
    
    const { answer } = await sendOpenCodeMessage(markdown, botConfig)
    
    await saveMessage(executionId, 'assistant', answer)
    
    await handleOutputs(flowData, answer)
    
    await db.update(taskExecutions)
      .set({
        status: 'completed',
        completedAt: new Date(),
        result: answer
      })
      .where(eq(taskExecutions.id, executionId))
    
    return { executionId, status: 'completed', result: answer }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`[TaskExecutor] Execution failed for task ${taskId}:`, errorMessage)
    
    await db.update(taskExecutions)
      .set({
        status: 'failed',
        completedAt: new Date(),
        result: errorMessage
      })
      .where(eq(taskExecutions.id, executionId))
    
    return { executionId, status: 'failed', error: errorMessage }
  }
}

export async function executeTaskStream(options: ExecuteTaskOptions): Promise<string> {
  const { taskId, triggerType, triggeredBy, botConfig, botId, webhookPayload } = options
  
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).get()
  if (!task) {
    throw new Error(`Task not found: ${taskId}`)
  }
  
  const executionId = randomUUID()
  const now = new Date()
  
  await db.insert(taskExecutions).values({
    id: executionId,
    taskId,
    status: 'running',
    startedAt: now,
    triggerType,
    triggeredBy: triggeredBy ?? null,
    botId: botId ?? null,
    createdAt: now
  })
  
  executionEventManager.emitStatus(executionId, 'running')
  
  ;(async () => {
    try {
      const flowData: FlowData = JSON.parse(task.flowData)
      const markdown = await generateTaskMarkdown(flowData)
      
      const userMessageId = randomUUID()
      const userMessageTime = new Date()
      await db.insert(taskExecutionMessages).values({
        id: userMessageId,
        executionId,
        role: 'user',
        content: markdown,
        createdAt: userMessageTime
      })
      
      executionEventManager.emitMessage(executionId, {
        id: userMessageId,
        executionId,
        role: 'user',
        content: markdown,
        createdAt: userMessageTime
      })
      
      // Wait for client to connect (max 3 seconds)
      const maxWaitTime = 3000
      const waitStartTime = Date.now()
      while (executionEventManager.getClientCount(executionId) === 0) {
        if (Date.now() - waitStartTime > maxWaitTime) {
          logger.warn(`[TaskExecutor] No client connected after ${maxWaitTime}ms, proceeding without streaming`)
          break
        }
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      const assistantMessageId = randomUUID()
      const assistantMessageTime = new Date()
      await db.insert(taskExecutionMessages).values({
        id: assistantMessageId,
        executionId,
        role: 'assistant',
        content: '',
        createdAt: assistantMessageTime
      })
      
      executionEventManager.emitStreamStart(executionId)
      
      let accumulatedContent = ''
      let reasoningContent = ''
      
      const saveInterval = setInterval(async () => {
        if (accumulatedContent) {
          try {
            await db.update(taskExecutionMessages)
              .set({ content: accumulatedContent })
              .where(eq(taskExecutionMessages.id, assistantMessageId))
          } catch (e) {
            logger.error('[TaskExecutor] Failed to save intermediate content:', e)
          }
        }
      }, 2000)
      
      try {
        const { answer } = await sendOpenCodeMessageStream(
          markdown,
          botConfig,
          undefined,
          (chunk: string, type: string) => {
            if (type === 'text') {
              accumulatedContent += chunk
              executionEventManager.emitText(executionId, chunk)
            } else if (type === 'reasoning') {
              reasoningContent += chunk
              executionEventManager.emitReasoning(executionId, chunk)
            }
          },
          () => {}
        )
        
        clearInterval(saveInterval)
        
        executionEventManager.emitStreamEnd(executionId)
        
        await db.update(taskExecutionMessages)
          .set({ content: answer })
          .where(eq(taskExecutionMessages.id, assistantMessageId))
        
        executionEventManager.emitMessage(executionId, {
          id: assistantMessageId,
          executionId,
          role: 'assistant',
          content: answer,
          createdAt: assistantMessageTime
        })
        
        await handleOutputs(flowData, answer)
        
        await db.update(taskExecutions)
          .set({
            status: 'completed',
            completedAt: new Date(),
            result: answer
          })
          .where(eq(taskExecutions.id, executionId))
        
        executionEventManager.emitStatus(executionId, 'completed')
      } catch (streamError) {
        clearInterval(saveInterval)
        throw streamError
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`[TaskExecutor] Stream execution failed for task ${taskId}:`, errorMessage)
      
      await db.update(taskExecutions)
        .set({
          status: 'failed',
          completedAt: new Date(),
          result: errorMessage
        })
        .where(eq(taskExecutions.id, executionId))
      
      executionEventManager.emitStatus(executionId, 'failed')
    }
  })()
  
  return executionId
}

async function saveMessage(executionId: string, role: 'user' | 'assistant', content: string): Promise<void> {
  await db.insert(taskExecutionMessages).values({
    id: randomUUID(),
    executionId,
    role,
    content,
    createdAt: new Date()
  })
}

async function handleOutputs(flowData: FlowData, result: string): Promise<void> {
  const outputNodes = flowData.nodes.filter(n => n.type === 'output')
  
  for (const node of outputNodes) {
    const data = node.data as OutputNodeData
    
    switch (data.type) {
      case 'email':
        await handleEmailOutput(data.config, result)
        break
      case 'file':
        await handleFileOutput(data.config, result)
        break
      case 'webhook':
        await handleWebhookOutput(data.config, result)
        break
    }
  }
}

async function handleEmailOutput(config: Record<string, string>, result: string): Promise<void> {
  const { to, subject } = config
  logger.info(`[TaskExecutor] Email output: to=${to}, subject=${subject}`)
}

async function handleFileOutput(config: Record<string, string>, result: string): Promise<void> {
  const { path: filePath } = config
  logger.info(`[TaskExecutor] File output: path=${filePath}`)
}

async function handleWebhookOutput(config: Record<string, string>, result: string): Promise<void> {
  const { url } = config
  logger.info(`[TaskExecutor] Webhook output: url=${url}`)
}

export type { ExecuteTaskOptions, ExecutionResult }
