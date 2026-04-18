import { db, tasks, taskExecutions, taskExecutionMessages, skills } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { sendOpenCodeMessage, sendOpenCodeMessageStream, type BotConfig } from './opencode.js'
import { decrypt } from './encryption.js'
import { executionEventManager } from './execution-event-manager.js'
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
    const markdown = await convertFlowToMarkdown(flowData)
    
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
      const markdown = await convertFlowToMarkdown(flowData)
      
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

async function convertFlowToMarkdown(flowData: FlowData): Promise<string> {
  const { nodes, edges } = flowData
  
  const sortedNodes = topologicalSort(nodes, edges)
  
  const parts: string[] = []
  parts.push('# Task Execution Plan\n')
  
  for (const node of sortedNodes) {
    const nodeContent = await nodeToMarkdown(node)
    if (nodeContent) {
      parts.push(nodeContent)
    }
  }
  
  return parts.join('\n\n')
}

function topologicalSort(nodes: Node[], edges: import('../types/task.js').Edge[]): Node[] {
  const nodeMap = new Map<string, Node>()
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()
  
  for (const node of nodes) {
    nodeMap.set(node.id, node)
    inDegree.set(node.id, 0)
    adjacency.set(node.id, [])
  }
  
  for (const edge of edges) {
    const current = inDegree.get(edge.target) ?? 0
    inDegree.set(edge.target, current + 1)
    adjacency.get(edge.source)?.push(edge.target)
  }
  
  const queue: string[] = []
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId)
    }
  }
  
  const result: Node[] = []
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    const node = nodeMap.get(nodeId)
    if (node) {
      result.push(node)
    }
    
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) {
        queue.push(neighbor)
      }
    }
  }
  
  return result
}

async function nodeToMarkdown(node: Node): Promise<string> {
  switch (node.type) {
    case 'skillInstall':
      return skillInstallToMarkdown(node.data as SkillInstallNodeData)
    case 'codeDownload':
      return codeDownloadToMarkdown(node.data as CodeDownloadNodeData)
    case 'step':
      return stepToMarkdown(node.data as StepNodeData)
    case 'output':
      return ''
    default:
      return ''
  }
}

async function skillInstallToMarkdown(data: SkillInstallNodeData): Promise<string> {
  const skill = await db.select().from(skills).where(eq(skills.id, data.skillId)).get()
  
  let content = `## Skill Installation: ${data.skillName}\n\n`
  content += `- **Skill ID**: ${data.skillId}\n`
  content += `- **Slug**: ${data.skillSlug}\n`
  
  if (skill?.description) {
    content += `- **Description**: ${skill.description}\n`
  }
  
  content += `\nPlease install this skill before proceeding.\n`
  
  return content
}

function codeDownloadToMarkdown(data: CodeDownloadNodeData): string {
  let content = `## Code Download\n\n`
  content += `- **Repository**: ${data.repoUrl}\n`
  content += `- **Branch**: ${data.branch}\n`
  content += `- **Target Path**: ${data.targetPath}\n`
  
  if (data.username) {
    let password = data.password
    if (password) {
      try {
        password = decrypt(password)
      } catch {
        logger.warn('[TaskExecutor] Failed to decrypt password, using as-is')
      }
    }
    content += `- **Credentials**: Username: ${data.username}${password ? ', Password: ***' : ''}\n`
  }
  
  content += `\nPlease clone the repository to the specified path.\n`
  
  return content
}

function stepToMarkdown(data: StepNodeData): string {
  let content = `## 步骤\n\n`
  content += `${data.instruction}\n`
  
  return content
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
export { convertFlowToMarkdown }
