import { getToken } from './api'

const API_BASE = '/api/admin'

export interface ExecutionMessageEventData {
  id: string
  executionId: string
  role: string
  content: string
  createdAt: string
}

export interface ExecutionStatusEventData {
  executionId: string
  status: string
  triggerType?: string
  triggeredBy?: string | null
  startedAt?: string | null
  completedAt?: string | null
  updatedAt: string
}

export interface ExecutionTextEventData {
  executionId?: string
  text: string
}

export interface ExecutionStreamStartEventData {
  executionId: string
  messageId: string
}

export interface ExecutionConnectedEventData {
  clientId: string
  executionId: string
  isTrigger: boolean
  timestamp: string
}

interface CallbackFunctions {
  onConnected?: (data: ExecutionConnectedEventData) => void
  onMessage?: (data: ExecutionMessageEventData) => void
  onStatus?: (data: ExecutionStatusEventData) => void
  onText?: (data: ExecutionTextEventData) => void
  onReasoning?: (data: ExecutionTextEventData) => void
  onStreamStart?: (data: ExecutionStreamStartEventData) => void
  onStreamEnd?: (data: ExecutionTextEventData) => void
  onError?: (error: Event) => void
}

interface ExecutionState {
  status: string
  statusData?: ExecutionStatusEventData
  messages: ExecutionMessageEventData[]
  connected: boolean
  isTrigger: boolean
  streamingMessageId?: string
  streamingContent?: string
  streamingReasoning?: string
}

class ExecutionEventManager {
  private connections: Map<string, EventSource> = new Map()
  private states: Map<string, ExecutionState> = new Map()
  private callbacks: Map<string, Set<CallbackFunctions>> = new Map()

  subscribe(executionId: string, callbacks: CallbackFunctions): () => void {
    if (!executionId) {
      return () => {}
    }

    if (!this.callbacks.has(executionId)) {
      this.callbacks.set(executionId, new Set())
    }
    this.callbacks.get(executionId)!.add(callbacks)

    const state = this.states.get(executionId)
    if (state) {
      if (state.connected) {
        callbacks.onConnected?.({
          clientId: '',
          executionId,
          isTrigger: state.isTrigger,
          timestamp: new Date().toISOString()
        })
      }
      if (state.statusData) {
        callbacks.onStatus?.(state.statusData)
      }
      state.messages.forEach(msg => {
        if (state.streamingMessageId && msg.id === state.streamingMessageId && state.streamingContent) {
          callbacks.onMessage?.({ ...msg, content: state.streamingContent })
        } else {
          callbacks.onMessage?.(msg)
        }
      })
      if (state.streamingMessageId) {
        callbacks.onStreamStart?.({
          executionId,
          messageId: state.streamingMessageId
        })
        if (state.streamingReasoning) {
          callbacks.onReasoning?.({ text: state.streamingReasoning })
        }
      }
    }

    if (!this.connections.has(executionId)) {
      this.createConnection(executionId)
    }

    return () => {
      this.unsubscribe(executionId, callbacks)
    }
  }

  private unsubscribe(executionId: string, callbacks: CallbackFunctions): void {
    const callbackSet = this.callbacks.get(executionId)
    if (callbackSet) {
      callbackSet.delete(callbacks)
      
      if (callbackSet.size === 0) {
        this.callbacks.delete(executionId)
        
        const state = this.states.get(executionId)
        if (state && (state.status === 'completed' || state.status === 'failed')) {
          this.closeConnection(executionId)
          this.states.delete(executionId)
        }
      }
    }
  }

  private createConnection(executionId: string): void {
    const token = getToken()
    if (!token) {
      console.error('[ExecutionEventManager] No token found')
      return
    }

    const url = `${API_BASE}/executions/${executionId}/events?token=${encodeURIComponent(token)}`
    console.log('[ExecutionEventManager] Creating connection to:', url)

    try {
      const eventSource = new EventSource(url)
      this.connections.set(executionId, eventSource)

      eventSource.addEventListener('connected', (event) => {
        console.log('[ExecutionEventManager] Connected:', event.data)
        try {
          const data = JSON.parse(event.data)
          this.updateState(executionId, { connected: true, isTrigger: data.isTrigger })
          this.notifyCallbacks(executionId, 'onConnected', data)
        } catch (error) {
          console.error('[ExecutionEventManager] Failed to parse connected:', error)
        }
      })

      eventSource.addEventListener('message', (event) => {
        console.log('[ExecutionEventManager] Message:', event.data)
        try {
          const data = JSON.parse(event.data)
          this.addMessage(executionId, data)
          this.notifyCallbacks(executionId, 'onMessage', data)
        } catch (error) {
          console.error('[ExecutionEventManager] Failed to parse message:', error)
        }
      })

      eventSource.addEventListener('status', (event) => {
        try {
          const data = JSON.parse(event.data)
          this.updateState(executionId, { status: data.status, statusData: data })
          this.notifyCallbacks(executionId, 'onStatus', data)

          if (data.status === 'completed' || data.status === 'failed') {
            const callbackSet = this.callbacks.get(executionId)
            if (!callbackSet || callbackSet.size === 0) {
              this.closeConnection(executionId)
              this.states.delete(executionId)
            }
          }
        } catch (error) {
          console.error('[ExecutionEventManager] Failed to parse status:', error)
        }
      })

      eventSource.addEventListener('text', (event) => {
        try {
          const data = JSON.parse(event.data)
          const state = this.states.get(executionId)
          if (state?.streamingMessageId) {
            this.updateState(executionId, {
              streamingContent: (state.streamingContent || '') + data.text
            })
          }
          this.notifyCallbacks(executionId, 'onText', data)
        } catch (error) {
          console.error('[ExecutionEventManager] Failed to parse text:', error)
        }
      })

      eventSource.addEventListener('reasoning', (event) => {
        try {
          const data = JSON.parse(event.data)
          const state = this.states.get(executionId)
          if (state?.streamingMessageId) {
            this.updateState(executionId, {
              streamingReasoning: (state.streamingReasoning || '') + data.text
            })
          }
          this.notifyCallbacks(executionId, 'onReasoning', data)
        } catch (error) {
          console.error('[ExecutionEventManager] Failed to parse reasoning:', error)
        }
      })

      eventSource.addEventListener('stream_start', (event) => {
        try {
          const data = JSON.parse(event.data)
          this.updateState(executionId, { streamingMessageId: data.messageId })
          this.notifyCallbacks(executionId, 'onStreamStart', data)
        } catch (error) {
          console.error('[ExecutionEventManager] Failed to parse stream_start:', error)
        }
      })

      eventSource.addEventListener('stream_end', (event) => {
        try {
          const data = JSON.parse(event.data)
          this.updateState(executionId, { 
            streamingMessageId: undefined,
            streamingContent: undefined,
            streamingReasoning: undefined
          })
          this.notifyCallbacks(executionId, 'onStreamEnd', data)
        } catch (error) {
          console.error('[ExecutionEventManager] Failed to parse stream_end:', error)
        }
      })

      eventSource.addEventListener('error', (event) => {
        console.error('[ExecutionEventManager] Error event:', event)
        try {
          const data = JSON.parse((event as MessageEvent).data)
          this.notifyCallbacks(executionId, 'onError', data)
        } catch {
          this.notifyCallbacks(executionId, 'onError', event)
        }
      })

      eventSource.addEventListener('heartbeat', () => {})

      eventSource.onerror = (error) => {
        console.error('[ExecutionEventManager] Connection error:', error)
        this.notifyCallbacks(executionId, 'onError', error)
      }

      eventSource.onopen = () => {
        console.log('[ExecutionEventManager] Connection opened')
      }
    } catch (error) {
      console.error('[ExecutionEventManager] Failed to create connection:', error)
    }
  }

  private closeConnection(executionId: string): void {
    const eventSource = this.connections.get(executionId)
    if (eventSource) {
      eventSource.close()
      this.connections.delete(executionId)
      console.log('[ExecutionEventManager] Connection closed for:', executionId)
    }
  }

  private updateState(executionId: string, updates: Partial<ExecutionState>): void {
    const current = this.states.get(executionId) || {
      status: 'pending',
      messages: [],
      connected: false,
      isTrigger: false
    }
    this.states.set(executionId, { ...current, ...updates })
  }

  private addMessage(executionId: string, message: ExecutionMessageEventData): void {
    const state = this.states.get(executionId)
    if (state) {
      if (state.status === 'running' && state.streamingMessageId === message.id) {
        return
      }

      const existingIndex = state.messages.findIndex(m => m.id === message.id)
      if (existingIndex >= 0) {
        state.messages[existingIndex] = message
      } else {
        state.messages.push(message)
      }
    } else {
      this.states.set(executionId, {
        status: 'running',
        messages: [message],
        connected: true,
        isTrigger: false
      })
    }
  }

  private notifyCallbacks<K extends keyof CallbackFunctions>(
    executionId: string,
    event: K,
    data: Parameters<NonNullable<CallbackFunctions[K]>>[0]
  ): void {
    const callbackSet = this.callbacks.get(executionId)
    if (callbackSet) {
      callbackSet.forEach(callbacks => {
        const handler = callbacks[event]
        if (handler) {
          (handler as any)(data)
        }
      })
    }
  }

  getConnectionCount(): number {
    return this.connections.size
  }

  getCacheCount(): number {
    return this.states.size
  }
}

export const executionEventManager = new ExecutionEventManager()
