import { useEffect, useRef, useCallback } from 'react'
import { getToken, removeToken } from '../services/api'

const API_BASE = '/api'

export interface MessageEventData {
  type: 'message'
  data: {
    id: string
    sessionId: string
    senderType: string
    content: string
    reasoning?: string | null
    createdAt: string
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

export interface StatusEventData {
  type: 'status'
  data: {
    sessionId: string
    status: string
    updatedAt: string
  }
}

export type SessionEventData = MessageEventData | StatusEventData

interface UseSessionEventsOptions {
  sessionId: string | null
  onMessage?: (data: MessageEventData['data']) => void
  onStatus?: (data: StatusEventData['data']) => void
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (error: Event) => void
}

export function useSessionEvents({
  sessionId,
  onMessage,
  onStatus,
  onConnected,
  onDisconnected,
  onError
}: UseSessionEventsOptions) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5
  const baseReconnectDelay = 1000

  const connect = useCallback(() => {
    if (!sessionId) return
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const token = getToken()
    if (!token) {
      console.error('[SSE] No token found')
      return
    }

    // EventSource 不支持自定义 headers，使用 URL 参数传递 token
    const url = `${API_BASE}/sessions/${sessionId}/events?token=${encodeURIComponent(token)}`

    try {
      const eventSource = new EventSource(url)

      eventSourceRef.current = eventSource

      eventSource.addEventListener('connected', () => {
        reconnectAttemptsRef.current = 0
        onConnected?.()
      })

      eventSource.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data)
          onMessage?.(data)
        } catch (error) {
          console.error('[SSE] Failed to parse message:', error)
        }
      })

      eventSource.addEventListener('status', (event) => {
        try {
          const data = JSON.parse(event.data)
          onStatus?.(data)
        } catch (error) {
          console.error('[SSE] Failed to parse status:', error)
        }
      })

      eventSource.addEventListener('heartbeat', () => {
        // 心跳事件，保持连接活跃
      })

      eventSource.addEventListener('error', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          if (data.error === 'Unauthorized') {
            console.warn('[SSE] Unauthorized, redirecting to login')
            disconnect()
            removeToken()
            window.location.href = '/login'
            return
          }
          console.error('[SSE] Server error:', data.error)
        } catch {
          console.error('[SSE] Failed to parse error event:', event)
        }
      })

      eventSource.onerror = (error) => {
        console.error('[SSE] Error:', error)
        onError?.(error)
        
        // 自动重连逻辑
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current)
          
          reconnectTimerRef.current = window.setTimeout(() => {
            reconnectAttemptsRef.current++
            connect()
          }, delay)
        } else {
          console.error('[SSE] Max reconnect attempts reached')
          onDisconnected?.()
        }
      }

      eventSource.onopen = () => {}
    } catch (error) {
      console.error('[SSE] Failed to create connection:', error)
      onError?.(error as Event)
    }
  }, [sessionId, onMessage, onStatus, onConnected, onDisconnected, onError])

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    reconnectAttemptsRef.current = 0
  }, [])

  useEffect(() => {
    if (sessionId) {
      connect()
    }
    
    return () => {
      disconnect()
    }
  }, [sessionId, connect, disconnect])

  return {
    connect,
    disconnect,
    isConnected: !!eventSourceRef.current
  }
}
