import { createOpencodeClient, type OpencodeClient } from '@opencode-ai/sdk/v2'

import logger from './logger.js'

export type ChunkType = 'text' | 'reasoning'

interface CallbackInfo {
  onChunk: (chunk: string, type: ChunkType) => void
  onComplete: () => void
  lastActive: number
  partTypes: Map<string, ChunkType>
}

interface Subscription {
  apiUrl: string
  client: OpencodeClient
  eventStream: Awaited<ReturnType<OpencodeClient['event']['subscribe']>> | null
  callbacks: Map<string, CallbackInfo>
  reconnectAttempts: number
  isReconnecting: boolean
  abortController: AbortController | null
}

const OPENCODE_SERVER_USERNAME = process.env.OPENCODE_SERVER_USERNAME || 'opencode'
const OPENCODE_SERVER_PASSWORD = process.env.OPENCODE_SERVER_PASSWORD || ''

class EventSubscriptionManager {
  private subscriptions: Map<string, Subscription> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000
  private readonly INACTIVE_TIMEOUT_MS = 10 * 60 * 1000
  private readonly MAX_RECONNECT_DELAY_MS = 10000
  private readonly INITIAL_RECONNECT_DELAY_MS = 1000
  private readonly STREAM_TIMEOUT_MS = 60000

  async initialize(): Promise<void> {
    logger.info('[EventSubscriptionManager] Initializing...')
    this.startCleanupTimer()
    logger.info('[EventSubscriptionManager] Initialized')
  }

  register(apiUrl: string, sessionId: string, onChunk: (chunk: string, type: ChunkType) => void, onComplete: () => void = () => {}): void {
    logger.info('[EventSubscriptionManager] Registering callback for session:', sessionId)
    
    let subscription = this.subscriptions.get(apiUrl)
    
    if (!subscription) {
      logger.info('[EventSubscriptionManager] Creating new subscription for apiUrl:', apiUrl)
      subscription = {
        apiUrl,
        client: this.createClient(apiUrl),
        eventStream: null,
        callbacks: new Map(),
        reconnectAttempts: 0,
        isReconnecting: false,
        abortController: null
      }
      this.subscriptions.set(apiUrl, subscription)
      this.startEventListener(subscription)
    }
    
    subscription.callbacks.set(sessionId, {
      onChunk,
      onComplete,
      lastActive: Date.now(),
      partTypes: new Map()
    })
    
    logger.info('[EventSubscriptionManager] Callback registered. Total callbacks:', subscription.callbacks.size)
  }

  unregister(apiUrl: string, sessionId: string): void {
    logger.info('[EventSubscriptionManager] Unregistering callback for session:', sessionId)
    
    const subscription = this.subscriptions.get(apiUrl)
    if (subscription) {
      subscription.callbacks.delete(sessionId)
      logger.info('[EventSubscriptionManager] Callback unregistered. Remaining callbacks:', subscription.callbacks.size)
    }
  }

  updateActiveTime(apiUrl: string, sessionId: string): void {
    const subscription = this.subscriptions.get(apiUrl)
    if (subscription) {
      const callbackInfo = subscription.callbacks.get(sessionId)
      if (callbackInfo) {
        callbackInfo.lastActive = Date.now()
      }
    }
  }

  private createClient(apiUrl: string): OpencodeClient {
    const headers: Record<string, string> = {}
    if (OPENCODE_SERVER_PASSWORD) {
      const auth = Buffer.from(`${OPENCODE_SERVER_USERNAME}:${OPENCODE_SERVER_PASSWORD}`).toString('base64')
      headers['Authorization'] = `Basic ${auth}`
    }
    
    return createOpencodeClient({
      baseUrl: apiUrl,
      headers
    })
  }

  private async startEventListener(subscription: Subscription): Promise<void> {
    logger.info('[EventSubscriptionManager] Starting event listener for:', subscription.apiUrl)
    
    try {
      subscription.abortController = new AbortController()
      subscription.eventStream = await subscription.client.event.subscribe()
      logger.info('[EventSubscriptionManager] Event stream connected')
      
      this.processEventStream(subscription)
    } catch (error) {
      logger.error('[EventSubscriptionManager] Failed to start event listener:', error)
      this.reconnect(subscription)
    }
  }

  private async processEventStream(subscription: Subscription): Promise<void> {
    if (!subscription.eventStream) return
    
    try {
      for await (const event of subscription.eventStream.stream) {
        this.handleEvent(subscription, event)
      }
    } catch (error: any) {
      logger.error('[EventSubscriptionManager] Event stream error:', error.message || error)
      if (!subscription.isReconnecting) {
        this.reconnect(subscription)
      }
    }
  }

  private handleEvent(subscription: Subscription, event: any): void {
    const eventType = event.type
    
    if (eventType === 'server.heartbeat') {
      return
    }
    
    logger.debug(`[EventSubscriptionManager] Raw event: ${JSON.stringify(event).substring(0, 500)}`)
    
    const sessionId = event.properties?.sessionID
    if (!sessionId) {
      logger.warn(`[EventSubscriptionManager] Event missing sessionID, type: ${eventType}`)
      return
    }
    
    const callbackInfo = subscription.callbacks.get(sessionId)
    if (!callbackInfo) {
      logger.warn(`[EventSubscriptionManager] No callback found for session: ${sessionId}, event type: ${event.type}`)
      logger.debug(`[EventSubscriptionManager] Current registered sessions: ${Array.from(subscription.callbacks.keys()).join(', ')}`)
      return
    }
    
    callbackInfo.lastActive = Date.now()
    
    if (event.type === 'message.part.updated') {
      const part = event.properties?.part
      if (part?.id && part?.type) {
        const partType: ChunkType = part.type === 'reasoning' ? 'reasoning' : 'text'
        callbackInfo.partTypes.set(part.id, partType)
        logger.debug(`[EventSubscriptionManager] Part registered: ${part.id} -> ${partType}`)
      }
    }
    
    if (event.type === 'message.part.delta') {
      const partId = event.properties?.partID
      const delta = event.properties?.delta
      
      if (partId && delta) {
        const type = callbackInfo.partTypes.get(partId) || 'text'
        logger.debug(`[EventSubscriptionManager] Part delta: partId=${partId}, type=${type}, delta=${delta.substring(0, 50)}`)
        callbackInfo.onChunk(delta, type)
      }
    }
    
    if (event.type === 'session.idle') {
      logger.info('[EventSubscriptionManager] Message completed for session:', sessionId)
      callbackInfo.onComplete()
    }
  }

  private async reconnect(subscription: Subscription): Promise<void> {
    if (subscription.isReconnecting) {
      logger.info('[EventSubscriptionManager] Already reconnecting, skip')
      return
    }
    
    subscription.isReconnecting = true
    logger.info('[EventSubscriptionManager] Starting reconnect, attempt:', subscription.reconnectAttempts + 1)
    
    const delay = Math.min(
      this.INITIAL_RECONNECT_DELAY_MS * Math.pow(2, subscription.reconnectAttempts),
      this.MAX_RECONNECT_DELAY_MS
    )
    
    logger.info(`[EventSubscriptionManager] Reconnect delay: ${delay}ms`)
    await new Promise(resolve => setTimeout(resolve, delay))
    
    try {
      if (subscription.abortController) {
        subscription.abortController.abort()
      }
      
      subscription.eventStream = await subscription.client.event.subscribe()
      subscription.reconnectAttempts = 0
      logger.info('[EventSubscriptionManager] Reconnected successfully')
      
      this.processEventStream(subscription)
    } catch (error) {
      logger.error('[EventSubscriptionManager] Reconnect failed:', error)
      subscription.reconnectAttempts++
    } finally {
      subscription.isReconnecting = false
    }
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveCallbacks()
    }, this.CLEANUP_INTERVAL_MS)
  }

  private cleanupInactiveCallbacks(): void {
    const now = Date.now()
    let totalCleaned = 0
    
    for (const [apiUrl, subscription] of this.subscriptions) {
      const sessionsToRemove: string[] = []
      
      for (const [sessionId, callbackInfo] of subscription.callbacks) {
        if (now - callbackInfo.lastActive > this.INACTIVE_TIMEOUT_MS) {
          sessionsToRemove.push(sessionId)
        }
      }
      
      for (const sessionId of sessionsToRemove) {
        subscription.callbacks.delete(sessionId)
        totalCleaned++
        logger.info('[EventSubscriptionManager] Cleaned inactive callback:', sessionId)
      }
      
      if (subscription.callbacks.size === 0) {
        logger.info('[EventSubscriptionManager] No callbacks remaining, keeping subscription for reuse')
      }
    }
    
    if (totalCleaned > 0) {
      logger.info('[EventSubscriptionManager] Cleanup completed. Total cleaned:', totalCleaned)
    }
  }

  async shutdown(): Promise<void> {
    logger.info('[EventSubscriptionManager] Shutting down...')
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    
    for (const subscription of this.subscriptions.values()) {
      if (subscription.abortController) {
        subscription.abortController.abort()
      }
      subscription.callbacks.clear()
    }
    
    this.subscriptions.clear()
    logger.info('[EventSubscriptionManager] Shutdown completed')
  }

  getStats(): { apiUrl: string; callbackCount: number }[] {
    const stats: { apiUrl: string; callbackCount: number }[] = []
    for (const [apiUrl, subscription] of this.subscriptions) {
      stats.push({
        apiUrl,
        callbackCount: subscription.callbacks.size
      })
    }
    return stats
  }
}

export const eventSubscriptionManager = new EventSubscriptionManager()
