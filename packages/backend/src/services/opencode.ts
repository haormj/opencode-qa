import { createOpencodeClient } from '@opencode-ai/sdk/v2'
import { eventSubscriptionManager } from './event-subscription-manager.js'

const OPENCODE_SERVER_USERNAME = process.env.OPENCODE_SERVER_USERNAME || 'opencode'
const OPENCODE_SERVER_PASSWORD = process.env.OPENCODE_SERVER_PASSWORD || ''

console.log('[OpenCode Config]', {
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

const clients = new Map<string, ReturnType<typeof createOpencodeClient>>()

function getClient(apiUrl: string) {
  if (!clients.has(apiUrl)) {
    const headers: Record<string, string> = {}
    if (OPENCODE_SERVER_PASSWORD) {
      const auth = Buffer.from(`${OPENCODE_SERVER_USERNAME}:${OPENCODE_SERVER_PASSWORD}`).toString('base64')
      headers['Authorization'] = `Basic ${auth}`
    }
    
    const client = createOpencodeClient({
      baseUrl: apiUrl,
      headers
    })
    clients.set(apiUrl, client)
  }
  return clients.get(apiUrl)!
}

export async function checkOrCreateOpenCodeSession(apiUrl: string, sessionId?: string): Promise<{ sessionId: string; needsRebuild: boolean }> {
  const client = getClient(apiUrl)
  
  if (sessionId) {
    console.log('[OpenCode] Checking existing session:', sessionId)
    try {
      const result = await client.session.get({ sessionID: sessionId })
      if (result.data) {
        console.log('[OpenCode] Session exists:', sessionId)
        return { sessionId, needsRebuild: false }
      }
    } catch (error) {
      console.log('[OpenCode] Session check failed, will create new one')
    }
  }
  
  console.log('[OpenCode] Creating new session...')
  const result = await client.session.create({
    title: 'OpenCode QA Session'
  })
  
  if (!result.data?.id) {
    throw new Error('Failed to create OpenCode session')
  }
  
  console.log('[OpenCode] New session created:', result.data.id)
  return { sessionId: result.data.id, needsRebuild: !!sessionId }
}

export async function rebuildContext(
  sessionId: string,
  historyParts: Array<{ type: 'text'; text: string }>,
  botConfig: BotConfig
): Promise<void> {
  console.log('[OpenCode] Rebuilding context with', historyParts.length, 'messages')
  
  const client = getClient(botConfig.apiUrl)
  
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
  
  console.log('[OpenCode] Context rebuilt successfully')
}

export async function sendOpenCodeMessage(
  message: string,
  botConfig: BotConfig,
  opencodeSessionId?: string
): Promise<{ sessionId: string; answer: string }> {
  console.log('[OpenCode] sendOpenCodeMessage called:', { message: message.substring(0, 50), opencodeSessionId })
  
  const { sessionId } = await checkOrCreateOpenCodeSession(botConfig.apiUrl, opencodeSessionId)
  
  const client = getClient(botConfig.apiUrl)
  
  console.log('[OpenCode] Sending message to session:', sessionId)
  const result = await client.session.prompt({
    sessionID: sessionId,
    model: {
      providerID: botConfig.provider,
      modelID: botConfig.model
    },
    agent: botConfig.agent,
    parts: [{ type: 'text', text: message }]
  })
  
  console.log('[OpenCode] Message response:', {
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
  
  console.log('[OpenCode] Answer length:', answer.length)
  
  return {
    sessionId,
    answer: answer || '抱歉，我无法回答这个问题。'
  }
}

export async function sendOpenCodeMessageStream(
  message: string,
  botConfig: BotConfig,
  opencodeSessionId: string | undefined,
  onChunk: (chunk: string) => void,
  onSessionId: (sessionId: string) => void
): Promise<{ sessionId: string; answer: string }> {
  console.log('[OpenCode] sendOpenCodeMessageStream called:', { message: message.substring(0, 50), opencodeSessionId })
  
  const { sessionId } = await checkOrCreateOpenCodeSession(botConfig.apiUrl, opencodeSessionId)
  onSessionId(sessionId)
  
  const client = getClient(botConfig.apiUrl)
  
  let answer = ''
  let messageCompleted = false
  let completionResolver: () => void
  
  const completionPromise = new Promise<void>(resolve => {
    completionResolver = resolve
  })
  
  const wrappedOnChunk = (chunk: string) => {
    answer += chunk
    onChunk(chunk)
  }
  
  const onComplete = () => {
    console.log('[OpenCode] Message completed via event')
    messageCompleted = true
    completionResolver()
  }
  
  eventSubscriptionManager.register(botConfig.apiUrl, sessionId, wrappedOnChunk, onComplete)
  
  const timeoutId = setTimeout(() => {
    if (!messageCompleted) {
      console.log('[OpenCode] Stream timeout (60s)')
      completionResolver()
    }
  }, 60000)
  
  try {
    console.log('[OpenCode] Sending message to session:', sessionId)
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
    clearTimeout(timeoutId)
    
    if (!answer) {
      console.log('[OpenCode] No answer from stream, trying prompt result')
      try {
        const result = await promptPromise
        console.log('[OpenCode] Prompt result:', {
          hasData: !!result.data,
          hasParts: !!result.data?.parts,
          partsLength: result.data?.parts?.length
        })
        if (result.data?.parts) {
          for (const part of result.data.parts) {
            if (part.type === 'text' && 'text' in part && part.text) {
              answer += part.text
              onChunk(part.text)
            }
          }
        }
      } catch (error) {
        console.error('[OpenCode] Prompt error:', error)
      }
    }
  } finally {
    eventSubscriptionManager.unregister(botConfig.apiUrl, sessionId)
    console.log('[OpenCode] Stream answer length:', answer.length)
  }
  
  return {
    sessionId,
    answer: answer || '抱歉，我无法回答这个问题。'
  }
}

export async function getSessionMessages(apiUrl: string, sessionId: string) {
  const client = getClient(apiUrl)
  const result = await client.session.messages({ sessionID: sessionId })
  return result.data || []
}

export async function deleteOpenCodeSession(apiUrl: string, sessionId: string): Promise<boolean> {
  console.log('[OpenCode] Deleting session:', sessionId)
  
  try {
    const client = getClient(apiUrl)
    await client.session.delete({ sessionID: sessionId })
    console.log('[OpenCode] Session deleted:', sessionId)
    return true
  } catch (error) {
    console.error(`[OpenCode] Error deleting session ${sessionId}:`, error)
    return false
  }
}

export type { BotConfig }
