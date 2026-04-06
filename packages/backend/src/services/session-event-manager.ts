import logger from './logger.js'

export interface MessageEvent {
  type: 'message'
  data: {
    id: string
    sessionId: string
    senderType: string
    content: string
    reasoning?: string | null
    createdAt: Date
    user?: {
      id: string
      displayName: string
      username: string
    } | null
    bot?: {
      id: string
      displayName: string
      avatar: string | null
    } | null
  }
}

export interface StatusEvent {
  type: 'status'
  data: {
    sessionId: string
    status: string
    updatedAt: Date
  }
}

export type SessionEvent = MessageEvent | StatusEvent

interface Client {
  id: string
  res: {
    write: (data: string) => void
    end: () => void
  }
}

class SessionEventManager {
  private clients: Map<string, Map<string, Client>> = new Map()

  /**
   * 注册客户端到指定会话
   */
  register(sessionId: string, clientId: string, res: Client['res']): void {
    if (!this.clients.has(sessionId)) {
      this.clients.set(sessionId, new Map())
    }
    
    const sessionClients = this.clients.get(sessionId)!
    sessionClients.set(clientId, { id: clientId, res })
    
    logger.info(`[SessionEvent] Client ${clientId} registered to session ${sessionId}`)
  }

  /**
   * 从指定会话注销客户端
   */
  unregister(sessionId: string, clientId: string): void {
    const sessionClients = this.clients.get(sessionId)
    if (sessionClients) {
      sessionClients.delete(clientId)
      
      if (sessionClients.size === 0) {
        this.clients.delete(sessionId)
      }
      
      logger.info(`[SessionEvent] Client ${clientId} unregistered from session ${sessionId}`)
    }
  }

  /**
   * 广播事件到指定会话的所有客户端
   */
  broadcast(sessionId: string, event: SessionEvent): void {
    const sessionClients = this.clients.get(sessionId)
    if (!sessionClients || sessionClients.size === 0) {
      return
    }

    const eventData = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
    
    sessionClients.forEach((client) => {
      try {
        client.res.write(eventData)
      } catch (error) {
        logger.error(`[SessionEvent] Failed to send event to client ${client.id}:`, error)
        this.unregister(sessionId, client.id)
      }
    })

    logger.debug(`[SessionEvent] Broadcast ${event.type} to ${sessionClients.size} clients in session ${sessionId}`)
  }

  /**
   * 发送消息事件
   */
  emitMessage(sessionId: string, message: MessageEvent['data']): void {
    this.broadcast(sessionId, {
      type: 'message',
      data: message
    })
  }

  /**
   * 发送状态变更事件
   */
  emitStatus(sessionId: string, status: string): void {
    this.broadcast(sessionId, {
      type: 'status',
      data: {
        sessionId,
        status,
        updatedAt: new Date()
      }
    })
  }

  /**
   * 获取指定会话的客户端数量
   */
  getClientCount(sessionId: string): number {
    const sessionClients = this.clients.get(sessionId)
    return sessionClients ? sessionClients.size : 0
  }

  /**
   * 获取所有活跃会话数量
   */
  getActiveSessionCount(): number {
    return this.clients.size
  }
}

export const sessionEventManager = new SessionEventManager()
