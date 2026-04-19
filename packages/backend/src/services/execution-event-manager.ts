import logger from './logger.js'

export interface StatusEvent {
  type: 'status'
  data: {
    executionId: string
    status: string
    updatedAt: Date
  }
}

export interface MessageEvent {
  type: 'message'
  data: {
    id: string
    executionId: string
    role: 'user' | 'assistant'
    content: string
    reasoning?: string | null
    createdAt: Date
  }
}

export interface TextEvent {
  type: 'text'
  data: {
    text: string
  }
}

export interface ReasoningEvent {
  type: 'reasoning'
  data: {
    text: string
  }
}

export interface StreamStartEvent {
  type: 'stream_start'
  data: {
    executionId: string
    messageId: string
  }
}

export interface StreamEndEvent {
  type: 'stream_end'
  data: {
    executionId: string
  }
}

export type ExecutionEvent = StatusEvent | MessageEvent | TextEvent | ReasoningEvent | StreamStartEvent | StreamEndEvent

interface Client {
  id: string
  res: {
    write: (data: string) => void
    end: () => void
  }
  isTrigger: boolean
}

class ExecutionEventManager {
  private clients: Map<string, Map<string, Client>> = new Map()

  register(executionId: string, clientId: string, res: Client['res'], options?: { isTrigger?: boolean }): void {
    if (!this.clients.has(executionId)) {
      this.clients.set(executionId, new Map())
    }
    
    const executionClients = this.clients.get(executionId)!
    executionClients.set(clientId, { id: clientId, res, isTrigger: options?.isTrigger ?? false })
    
    logger.info(`[ExecutionEvent] Client ${clientId} registered to execution ${executionId} (isTrigger: ${options?.isTrigger ?? false})`)
  }

  unregister(executionId: string, clientId: string): void {
    const executionClients = this.clients.get(executionId)
    if (executionClients) {
      executionClients.delete(clientId)
      
      if (executionClients.size === 0) {
        this.clients.delete(executionId)
      }
      
      logger.info(`[ExecutionEvent] Client ${clientId} unregistered from execution ${executionId}`)
    }
  }

  broadcast(executionId: string, event: ExecutionEvent): void {
    const executionClients = this.clients.get(executionId)
    if (!executionClients || executionClients.size === 0) {
      return
    }

    const eventData = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
    
    const streamEventTypes = ['text', 'reasoning', 'stream_start', 'stream_end']
    const isStreamEvent = streamEventTypes.includes(event.type)
    
    executionClients.forEach((client) => {
      if (isStreamEvent && !client.isTrigger) {
        return
      }
      
      try {
        client.res.write(eventData)
      } catch (error) {
        logger.error(`[ExecutionEvent] Failed to send event to client ${client.id}:`, error)
        this.unregister(executionId, client.id)
      }
    })

    logger.debug(`[ExecutionEvent] Broadcast ${event.type} to ${isStreamEvent ? 'trigger-only' : 'all'} clients in execution ${executionId}`)
  }

  emitStatus(executionId: string, status: string): void {
    this.broadcast(executionId, {
      type: 'status',
      data: {
        executionId,
        status,
        updatedAt: new Date()
      }
    })
  }

  emitMessage(executionId: string, message: MessageEvent['data']): void {
    this.broadcast(executionId, {
      type: 'message',
      data: message
    })
  }

  emitText(executionId: string, text: string): void {
    this.broadcast(executionId, {
      type: 'text',
      data: { text }
    })
  }

  emitReasoning(executionId: string, text: string): void {
    this.broadcast(executionId, {
      type: 'reasoning',
      data: { text }
    })
  }

  emitStreamStart(executionId: string, messageId: string): void {
    this.broadcast(executionId, {
      type: 'stream_start',
      data: { executionId, messageId }
    })
  }

  emitStreamEnd(executionId: string): void {
    this.broadcast(executionId, {
      type: 'stream_end',
      data: { executionId }
    })
  }

  getClientCount(executionId: string): number {
    const executionClients = this.clients.get(executionId)
    return executionClients ? executionClients.size : 0
  }

  getActiveExecutionCount(): number {
    return this.clients.size
  }
}

export const executionEventManager = new ExecutionEventManager()
