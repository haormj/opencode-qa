import { db, tasks, taskExecutions, taskExecutionMessages, users } from '../db/index.js'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { sendOpenCodeMessage, sendOpenCodeMessageStream, sendOpenCodeMessageWithWorkspace, sendOpenCodeMessageStreamWithWorkspace, abortOpenCodeSession, deleteOpenCodeSession, type BotConfig } from './opencode.js'
import { executionEventManager } from './execution-event-manager.js'
import { generateTaskMarkdown, prepareWorkspaceScripts } from './task-markdown.js'
import { createWorkspace, getWorkspacePath, cleanupWorkspace, shouldCleanupImmediately } from './workspace-manager.js'
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
  
  const workspacePath = await createWorkspace(executionId)
  logger.info(`[TaskExecutor] Created workspace for execution ${executionId}: ${workspacePath}`)
  
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
    const scriptsMap = await prepareWorkspaceScripts(flowData, workspacePath)
    const markdown = await generateTaskMarkdown(flowData, workspacePath, scriptsMap)
    
    await saveMessage(executionId, 'user', markdown)
    
    const { answer } = await sendOpenCodeMessageWithWorkspace(
      markdown,
      botConfig,
      workspacePath
    )
    
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
  
  const workspacePath = await createWorkspace(executionId)
  logger.info(`[TaskExecutor] Created workspace for stream execution ${executionId}: ${workspacePath}`)
  
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
    let currentSessionId: string | null = null
    try {
      const flowData: FlowData = JSON.parse(task.flowData)
      const scriptsMap = await prepareWorkspaceScripts(flowData, workspacePath)
      const markdown = await generateTaskMarkdown(flowData, workspacePath, scriptsMap)
      
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
        reasoning: null,
        createdAt: assistantMessageTime
      })
      
      executionEventManager.emitStreamStart(executionId, assistantMessageId)
      
      let accumulatedContent = ''
      let reasoningContent = ''
      
      const saveInterval = setInterval(async () => {
        if (accumulatedContent || reasoningContent) {
          try {
            await db.update(taskExecutionMessages)
              .set({ content: accumulatedContent, reasoning: reasoningContent || null })
              .where(eq(taskExecutionMessages.id, assistantMessageId))
          } catch (e) {
            logger.error('[TaskExecutor] Failed to save intermediate content:', e)
          }
        }
      }, 2000)
      
      try {
        const { answer } = await sendOpenCodeMessageStreamWithWorkspace(
          markdown,
          botConfig,
          workspacePath,
          (chunk: string, type: string) => {
            if (type === 'text') {
              accumulatedContent += chunk
              executionEventManager.emitText(executionId, chunk)
            } else if (type === 'reasoning') {
              reasoningContent += chunk
              executionEventManager.emitReasoning(executionId, chunk)
            }
          },
          async (sessionId: string) => {
            logger.info('[TaskExecutor] OpenCode session created:', sessionId)
            currentSessionId = sessionId
            try {
              await db.update(taskExecutions)
                .set({ opencodeSessionId: sessionId })
                .where(eq(taskExecutions.id, executionId))
            } catch (error) {
              logger.error('[TaskExecutor] Failed to save opencodeSessionId:', error)
            }
          }
        )
        
        clearInterval(saveInterval)
        
        executionEventManager.emitStreamEnd(executionId)
        
        await db.update(taskExecutionMessages)
          .set({ content: answer, reasoning: reasoningContent || null })
          .where(eq(taskExecutionMessages.id, assistantMessageId))
        
        executionEventManager.emitMessage(executionId, {
          id: assistantMessageId,
          executionId,
          role: 'assistant',
          content: answer,
          reasoning: reasoningContent || null,
          createdAt: assistantMessageTime
        })
        
        await handleOutputs(flowData, answer)
        
        const updateResult = await db.update(taskExecutions)
          .set({
            status: 'completed',
            completedAt: new Date(),
            result: answer
          })
          .where(and(eq(taskExecutions.id, executionId), eq(taskExecutions.status, 'running')))
          .returning()
        
        if (updateResult.length > 0) {
          if (currentSessionId) {
            try {
              await deleteOpenCodeSession(botConfig.apiUrl, currentSessionId)
              logger.info('[TaskExecutor] Deleted OpenCode session:', currentSessionId)
            } catch (error) {
              logger.error('[TaskExecutor] Failed to delete OpenCode session:', error)
            }
          }
          if (shouldCleanupImmediately()) {
            await cleanupWorkspace(executionId)
          }
          executionEventManager.emitStatus(executionId, 'completed')
        }
      } catch (streamError) {
        clearInterval(saveInterval)
        throw streamError
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`[TaskExecutor] Stream execution failed for task ${taskId}:`, errorMessage)
      
      const updateResult = await db.update(taskExecutions)
        .set({
          status: 'failed',
          completedAt: new Date(),
          result: errorMessage
        })
        .where(and(eq(taskExecutions.id, executionId), eq(taskExecutions.status, 'running')))
        .returning()
      
      if (updateResult.length > 0) {
        if (currentSessionId) {
          try {
            await deleteOpenCodeSession(botConfig.apiUrl, currentSessionId)
            logger.info('[TaskExecutor] Deleted OpenCode session:', currentSessionId)
          } catch (error) {
            logger.error('[TaskExecutor] Failed to delete OpenCode session:', error)
          }
        }
        if (shouldCleanupImmediately()) {
          await cleanupWorkspace(executionId)
        }
        executionEventManager.emitStatus(executionId, 'failed')
      }
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

export async function cancelExecution(
  executionId: string,
  cancelledBy: string,
  botConfig: BotConfig
): Promise<{ success: boolean; error?: string }> {
  const execution = await db.select().from(taskExecutions).where(eq(taskExecutions.id, executionId)).get()
  
  if (!execution) {
    return { success: false, error: '执行记录不存在' }
  }
  
  if (execution.status !== 'running') {
    return { success: false, error: '只有运行中的任务可以终止' }
  }
  
  if (execution.opencodeSessionId) {
    try {
      await abortOpenCodeSession(botConfig.apiUrl, execution.opencodeSessionId)
      await deleteOpenCodeSession(botConfig.apiUrl, execution.opencodeSessionId)
    } catch (error) {
      logger.error('[TaskExecutor] Failed to abort/delete OpenCode session:', error)
    }
  }
  
  const user = await db.select().from(users).where(eq(users.id, cancelledBy)).get()
  const cancelledByUser = user ? {
    id: user.id,
    username: user.username,
    displayName: user.displayName
  } : null
  
  await db.update(taskExecutions)
    .set({
      status: 'cancelled',
      cancelledBy,
      completedAt: new Date()
    })
    .where(eq(taskExecutions.id, executionId))
  
  if (shouldCleanupImmediately()) {
    await cleanupWorkspace(executionId)
  }
  
  executionEventManager.emitStatus(executionId, 'cancelled', cancelledByUser)
  
  return { success: true }
}

export type { ExecuteTaskOptions, ExecutionResult }
