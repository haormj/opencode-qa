import { createOpencodeClient } from '@opencode-ai/sdk/v2'
import { eventSubscriptionManager, type ChunkType } from './event-subscription-manager.js'
import { toOpenCodePath } from './workspace-manager.js'

import logger from './logger.js'
const OPENCODE_SERVER_USERNAME = process.env.OPENCODE_SERVER_USERNAME || 'opencode'
const OPENCODE_SERVER_PASSWORD = process.env.OPENCODE_SERVER_PASSWORD || ''

logger.info('[OpenCode Config]', {
  OPENCODE_SERVER_USERNAME,
  OPENCODE_SERVER_PASSWORD: OPENCODE_SERVER_PASSWORD ? '***' : '(not set)'
})

interface BotConfig {
  apiUrl: string
  provider: string
  model: string
  agent: string
  apiKey?: string
}

interface IsolatedClientOptions {
  apiUrl: string
  workspacePath: string
}

const clients = new Map<string, ReturnType<typeof createOpencodeClient>>()

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  if (OPENCODE_SERVER_PASSWORD) {
    const auth = Buffer.from(`${OPENCODE_SERVER_USERNAME}:${OPENCODE_SERVER_PASSWORD}`).toString('base64')
    headers['Authorization'] = `Basic ${auth}`
  }
  return headers
}

function getClient(apiUrl: string) {
  if (!clients.has(apiUrl)) {
    const client = createOpencodeClient({
      baseUrl: apiUrl,
      headers: getAuthHeaders()
    })
    clients.set(apiUrl, client)
  }
  return clients.get(apiUrl)!
}

function createIsolatedClient(options: IsolatedClientOptions) {
  return createOpencodeClient({
    baseUrl: options.apiUrl,
    headers: getAuthHeaders(),
    directory: toOpenCodePath(options.workspacePath)
  })
}

export async function checkOrCreateOpenCodeSession(apiUrl: string, sessionId?: string): Promise<{ sessionId: string; needsRebuild: boolean }> {
  const client = getClient(apiUrl)
  
  if (sessionId) {
    logger.debug('[OpenCode] Checking existing session:', sessionId)
    try {
      const result = await client.session.get({ sessionID: sessionId })
      if (result.data) {
        logger.debug('[OpenCode] Session exists:', sessionId)
        return { sessionId, needsRebuild: false }
      }
    } catch (error: any) {
      logger.debug('[OpenCode] Session check failed, will create new one:', error.message || error)
    }
  }
  
  logger.info('[OpenCode] Creating new session...')
  try {
    const result = await client.session.create({
      title: 'OpenCode QA Session'
    })
    
    if (!result.data?.id) {
      const errorDetail = result.error 
        ? JSON.stringify(result.error) 
        : 'No session ID returned'
      logger.error(`[OpenCode] Session creation failed: ${errorDetail}`)
      throw new Error(`Failed to create OpenCode session: ${errorDetail}`)
    }
    
    logger.info('[OpenCode] New session created:', result.data.id)
    return { sessionId: result.data.id, needsRebuild: !!sessionId }
  } catch (error: any) {
    if (error.code === 'UND_ERR_BODY_TIMEOUT' || error.code === 'UND_ERR_CONNECT_TIMEOUT') {
      logger.error(`[OpenCode] Session creation timeout: ${error.message}`)
      throw new Error(`OpenCode server timeout: ${error.message}`)
    }
    throw error
  }
}

export async function rebuildContext(
  sessionId: string,
  historyParts: Array<{ type: 'text'; text: string }>,
  botConfig: BotConfig
): Promise<void> {
  logger.info(`[OpenCode] Rebuilding context with ${historyParts.length} messages`)
  
  const client = getClient(botConfig.apiUrl)
  
  try {
    await client.session.prompt({
      sessionID: sessionId,
      model: {
        providerID: botConfig.provider,
        modelID: botConfig.model
      },
      agent: botConfig.agent,
      noReply: true,
      parts: historyParts
    })
    
    logger.info('[OpenCode] Context rebuilt successfully')
  } catch (error: any) {
    if (error.code === 'UND_ERR_BODY_TIMEOUT' || error.code === 'UND_ERR_CONNECT_TIMEOUT') {
      logger.error(`[OpenCode] Context rebuild timeout: ${error.message}`)
      throw new Error(`OpenCode server timeout during context rebuild: ${error.message}`)
    }
    throw error
  }
}

export async function sendOpenCodeMessage(
  message: string,
  botConfig: BotConfig,
  opencodeSessionId?: string
): Promise<{ sessionId: string; answer: string }> {
  logger.debug('[OpenCode] sendOpenCodeMessage called:', { message: message.substring(0, 50), opencodeSessionId })
  
  const { sessionId } = await checkOrCreateOpenCodeSession(botConfig.apiUrl, opencodeSessionId)
  
  const client = getClient(botConfig.apiUrl)
  
  logger.debug('[OpenCode] Sending message to session:', sessionId)
  const result = await client.session.prompt({
    sessionID: sessionId,
    model: {
      providerID: botConfig.provider,
      modelID: botConfig.model
    },
    agent: botConfig.agent,
    parts: [{ type: 'text', text: message }]
  })
  
  logger.debug('[OpenCode] Message response:', {
    hasData: !!result.data,
    hasParts: !!result.data?.parts,
    partsLength: result.data?.parts?.length
  })
  
  let answer = ''
  if (result.data?.parts) {
    for (const part of result.data.parts) {
      if (part.type === 'text' && 'text' in part && part.text) {
        answer += part.text
      }
    }
  }
  
  if (!answer) {
    logger.warn(`[OpenCode] Empty answer for session: ${sessionId}, parts: ${result.data?.parts?.length || 0}`)
  }
  
  return {
    sessionId,
    answer: answer || '抱歉，我无法回答这个问题。'
  }
}

export async function sendOpenCodeMessageStream(
  message: string,
  botConfig: BotConfig,
  opencodeSessionId: string | undefined,
  onChunk: (chunk: string, type: ChunkType) => void,
  onSessionId: (sessionId: string) => void
): Promise<{ sessionId: string; answer: string; tokens?: { input: number; output: number } }> {
  logger.debug('[OpenCode] sendOpenCodeMessageStream called:', { message: message.substring(0, 50), opencodeSessionId })
  
  const { sessionId } = await checkOrCreateOpenCodeSession(botConfig.apiUrl, opencodeSessionId)
  onSessionId(sessionId)
  
  const client = getClient(botConfig.apiUrl)
  
  let answer = ''
  let tokensData: { input: number; output: number } | undefined = undefined
  let messageCompleted = false
  let completionResolver: () => void
  let intervalId: NodeJS.Timeout | null = null
  let lastActivityTime = Date.now()
  let timeoutCount = 0
  const MAX_TIMEOUT_COUNT = 3
  
  const completionPromise = new Promise<void>(resolve => {
    completionResolver = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
      resolve()
    }
  })
  
  const wrappedOnChunk = (chunk: string, type: ChunkType) => {
    lastActivityTime = Date.now()
    timeoutCount = 0
    if (type === 'text') {
      answer += chunk
    }
    onChunk(chunk, type)
  }
  
  const onComplete = () => {
    logger.info('[OpenCode] Message completed via event')
    messageCompleted = true
    completionResolver()
  }
  
  eventSubscriptionManager.register(botConfig.apiUrl, sessionId, wrappedOnChunk, onComplete)

  intervalId = setInterval(() => {
    const idleTime = Date.now() - lastActivityTime
    if (idleTime >= 60000) {
      timeoutCount++
      logger.warn(`[OpenCode] Timeout check ${timeoutCount}/${MAX_TIMEOUT_COUNT} for session: ${sessionId}, idleTime: ${Math.round(idleTime / 1000)}s`)
      if (timeoutCount >= MAX_TIMEOUT_COUNT) {
        logger.warn(`[OpenCode] Stream timeout after ${MAX_TIMEOUT_COUNT} idle periods for session: ${sessionId}, answer length: ${answer.length}`)
        completionResolver()
      }
    }
  }, 60000)
  
  try {
    logger.debug('[OpenCode] Sending message to session:', sessionId)
    const promptPromise = client.session.prompt({
      sessionID: sessionId,
      model: {
        providerID: botConfig.provider,
        modelID: botConfig.model
      },
      agent: botConfig.agent,
      parts: [{ type: 'text', text: message }]
    })
    
    await completionPromise
    
    const result = await promptPromise
    
    if (result.data?.info?.tokens) {
      tokensData = {
        input: result.data.info.tokens.input || 0,
        output: result.data.info.tokens.output || 0
      }
    }
    
    if (!answer) {
      logger.info(`[OpenCode] No answer from stream for session: ${sessionId}, trying prompt result`)
      if (!result.data?.parts || result.data.parts.length === 0) {
        logger.warn(`[OpenCode] Prompt result empty for session: ${sessionId}, error: ${result.error ? JSON.stringify(result.error) : 'none'}`)
      }
      if (result.data?.parts) {
        for (const part of result.data.parts) {
          if (part.type === 'text' && 'text' in part && part.text) {
            answer += part.text
            onChunk(part.text, 'text')
          }
        }
      }
    }
  } finally {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    eventSubscriptionManager.unregister(botConfig.apiUrl, sessionId)
    logger.info(`[OpenCode] Stream completed for session: ${sessionId}, answer length: ${answer.length}`)
    
    if (!answer) {
      logger.warn(`[OpenCode] Empty stream answer for session: ${sessionId}`)
    }
  }
  
  return {
    sessionId,
    answer: answer || '抱歉，我无法回答这个问题。',
    tokens: tokensData
  }
}

export async function getSessionMessages(apiUrl: string, sessionId: string) {
  const client = getClient(apiUrl)
  const result = await client.session.messages({ sessionID: sessionId })
  return result.data || []
}

export async function deleteOpenCodeSession(apiUrl: string, sessionId: string): Promise<boolean> {
  logger.info('[OpenCode] Deleting session:', sessionId)
  
  try {
    const client = getClient(apiUrl)
    await client.session.delete({ sessionID: sessionId })
    logger.info('[OpenCode] Session deleted:', sessionId)
    return true
  } catch (error) {
    logger.error(`[OpenCode] Error deleting session ${sessionId}:`, error)
    return false
  }
}

export async function abortOpenCodeSession(apiUrl: string, sessionId: string): Promise<boolean> {
  logger.info('[OpenCode] Aborting session:', sessionId)
  
  try {
    const client = getClient(apiUrl)
    await client.session.abort({ sessionID: sessionId })
    logger.info('[OpenCode] Session aborted:', sessionId)
    return true
  } catch (error) {
    logger.error(`[OpenCode] Error aborting session ${sessionId}:`, error)
    return false
  }
}

export async function sendOpenCodeMessageWithWorkspace(
  message: string,
  botConfig: BotConfig,
  workspacePath: string
): Promise<{ sessionId: string; answer: string }> {
  logger.info('[OpenCode] sendOpenCodeMessageWithWorkspace called:', { 
    workspacePath,
    messagePreview: message.substring(0, 50) 
  })
  
  const client = createIsolatedClient({
    apiUrl: botConfig.apiUrl,
    workspacePath
  })
  
  try {
    logger.info('[OpenCode] Creating isolated session in workspace:', workspacePath)
    const sessionResult = await client.session.create({
      title: 'Isolated Task Execution'
    })
    
    if (!sessionResult.data?.id) {
      const errorDetail = sessionResult.error 
        ? JSON.stringify(sessionResult.error) 
        : 'No session ID returned'
      logger.error(`[OpenCode] Isolated session creation failed: ${errorDetail}`)
      throw new Error(`Failed to create isolated OpenCode session: ${errorDetail}`)
    }
    
    const sessionId = sessionResult.data.id
    logger.info('[OpenCode] Isolated session created:', sessionId)
    
    const result = await client.session.prompt({
      sessionID: sessionId,
      model: {
        providerID: botConfig.provider,
        modelID: botConfig.model
      },
      agent: botConfig.agent,
      parts: [{ type: 'text', text: message }]
    })
    
    let answer = ''
    if (result.data?.parts) {
      for (const part of result.data.parts) {
        if (part.type === 'text' && 'text' in part && part.text) {
          answer += part.text
        }
      }
    }
    
    if (!answer) {
      logger.warn(`[OpenCode] Empty answer for isolated session: ${sessionId}`)
    }
    
    return {
      sessionId,
      answer: answer || '抱歉，我无法回答这个问题。'
    }
  } finally {
    try {
      await client.global.dispose()
      logger.info('[OpenCode] Isolated client disposed')
    } catch (error) {
      logger.error('[OpenCode] Failed to dispose client:', error)
    }
  }
}

export async function sendOpenCodeMessageStreamWithWorkspace(
  message: string,
  botConfig: BotConfig,
  workspacePath: string,
  onChunk: (chunk: string, type: ChunkType) => void,
  onSessionId: (sessionId: string) => void,
  existingSessionId?: string
): Promise<{ sessionId: string; answer: string; tokens?: { input: number; output: number } }> {
  logger.info('[OpenCode] sendOpenCodeMessageStreamWithWorkspace called:', { 
    workspacePath,
    messagePreview: message.substring(0, 50),
    existingSessionId
  })
  
  const client = createIsolatedClient({
    apiUrl: botConfig.apiUrl,
    workspacePath
  })
  
  let sessionId: string
  
  if (existingSessionId) {
    sessionId = existingSessionId
    logger.info('[OpenCode] Reusing existing session:', sessionId)
  } else {
    logger.info('[OpenCode] Creating isolated session in workspace:', workspacePath)
    const sessionResult = await client.session.create({
      title: 'Isolated Task Execution'
    })
    
    if (!sessionResult.data?.id) {
      const errorDetail = sessionResult.error 
        ? JSON.stringify(sessionResult.error) 
        : 'No session ID returned'
      logger.error(`[OpenCode] Isolated session creation failed: ${errorDetail}`)
      throw new Error(`Failed to create isolated OpenCode session: ${errorDetail}`)
    }
    
    sessionId = sessionResult.data.id
    logger.info('[OpenCode] Isolated session created:', sessionId)
  }
  
  onSessionId(sessionId)
  
  let answer = ''
  let tokensData: { input: number; output: number } | undefined = undefined
  let messageCompleted = false
  let completionResolver: () => void
  let intervalId: NodeJS.Timeout | null = null
  let lastActivityTime = Date.now()
  let timeoutCount = 0
  const MAX_TIMEOUT_COUNT = 3
  
  const completionPromise = new Promise<void>(resolve => {
    completionResolver = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
      resolve()
    }
  })
  
  const wrappedOnChunk = (chunk: string, type: ChunkType) => {
    lastActivityTime = Date.now()
    timeoutCount = 0
    if (type === 'text') {
      answer += chunk
    }
    onChunk(chunk, type)
  }
  
  const onComplete = () => {
    logger.info('[OpenCode] Isolated message completed via event')
    messageCompleted = true
    completionResolver()
  }
  
  eventSubscriptionManager.registerWithWorkspace(botConfig.apiUrl, sessionId, workspacePath, wrappedOnChunk, onComplete)

  intervalId = setInterval(() => {
    const idleTime = Date.now() - lastActivityTime
    if (idleTime >= 60000) {
      timeoutCount++
      logger.warn(`[OpenCode] Timeout check ${timeoutCount}/${MAX_TIMEOUT_COUNT} for isolated session: ${sessionId}, idleTime: ${Math.round(idleTime / 1000)}s`)
      if (timeoutCount >= MAX_TIMEOUT_COUNT) {
        logger.warn(`[OpenCode] Stream timeout after ${MAX_TIMEOUT_COUNT} idle periods for isolated session: ${sessionId}, answer length: ${answer.length}`)
        completionResolver()
      }
    }
  }, 60000)
  
  try {
    logger.debug('[OpenCode] Sending message to isolated session:', sessionId)
    const promptPromise = client.session.prompt({
      sessionID: sessionId,
      model: {
        providerID: botConfig.provider,
        modelID: botConfig.model
      },
      agent: botConfig.agent,
      parts: [{ type: 'text', text: message }]
    })
    
    await completionPromise
    
    const result = await promptPromise
    
    if (result.data?.info?.tokens) {
      tokensData = {
        input: result.data.info.tokens.input || 0,
        output: result.data.info.tokens.output || 0
      }
    }
    
    if (!answer) {
      logger.info(`[OpenCode] No answer from stream for isolated session: ${sessionId}, trying prompt result`)
      if (!result.data?.parts || result.data.parts.length === 0) {
        logger.warn(`[OpenCode] Prompt result empty for isolated session: ${sessionId}, error: ${result.error ? JSON.stringify(result.error) : 'none'}`)
      }
      if (result.data?.parts) {
        for (const part of result.data.parts) {
          if (part.type === 'text' && 'text' in part && part.text) {
            answer += part.text
            onChunk(part.text, 'text')
          }
        }
      }
    }
  } finally {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    eventSubscriptionManager.unregisterWithWorkspace(botConfig.apiUrl, sessionId, workspacePath)
    
    try {
      await client.global.dispose()
      logger.info('[OpenCode] Isolated client disposed')
    } catch (error) {
      logger.error('[OpenCode] Failed to dispose client:', error)
    }
    
    logger.info(`[OpenCode] Isolated stream completed for session: ${sessionId}, answer length: ${answer.length}`)
    
    if (!answer) {
      logger.warn(`[OpenCode] Empty stream answer for isolated session: ${sessionId}`)
    }
  }
  
  return {
    sessionId,
    answer: answer || '抱歉，我无法回答这个问题。',
    tokens: tokensData
  }
}

export type { BotConfig }
