import { useEffect, useRef, useCallback } from 'react'
import { getToken } from '../services/api'

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

export interface ExecutionConnectedEventData {
  clientId: string
  executionId: string
  isTrigger: boolean
  timestamp: string
}

interface UseExecutionEventsOptions {
  executionId: string | null
  onMessage?: (data: ExecutionMessageEventData) => void
  onStatus?: (data: ExecutionStatusEventData) => void
  onText?: (data: ExecutionTextEventData) => void
  onReasoning?: (data: ExecutionTextEventData) => void
  onStreamStart?: (data: ExecutionTextEventData) => void
  onStreamEnd?: (data: ExecutionTextEventData) => void
  onConnected?: (data: ExecutionConnectedEventData) => void
  onDisconnected?: () => void
  onError?: (error: Event) => void
}

export function useExecutionEvents({
  executionId,
  onMessage,
  onStatus,
  onText,
  onReasoning,
  onStreamStart,
  onStreamEnd,
  onConnected,
  onDisconnected,
  onError
}: UseExecutionEventsOptions) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5
  const baseReconnectDelay = 1000

  const onMessageRef = useRef(onMessage)
  const onStatusRef = useRef(onStatus)
  const onTextRef = useRef(onText)
  const onReasoningRef = useRef(onReasoning)
  const onStreamStartRef = useRef(onStreamStart)
  const onStreamEndRef = useRef(onStreamEnd)
  const onConnectedRef = useRef(onConnected)
  const onDisconnectedRef = useRef(onDisconnected)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onMessageRef.current = onMessage
    onStatusRef.current = onStatus
    onTextRef.current = onText
    onReasoningRef.current = onReasoning
    onStreamStartRef.current = onStreamStart
    onStreamEndRef.current = onStreamEnd
    onConnectedRef.current = onConnected
    onDisconnectedRef.current = onDisconnected
    onErrorRef.current = onError
  })

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

  const connect = useCallback(() => {
    if (!executionId) return
    
    disconnect()

    const token = getToken()
    if (!token) {
      console.error('[ExecutionSSE] No token found')
      return
    }

    const url = `${API_BASE}/executions/${executionId}/events?token=${encodeURIComponent(token)}`
    
    console.log('[ExecutionSSE] Connecting to:', url)
    
    try {
      const eventSource = new EventSource(url)

      eventSourceRef.current = eventSource

      eventSource.addEventListener('connected', (event) => {
        console.log('[ExecutionSSE] Connected event received:', event.data)
        reconnectAttemptsRef.current = 0
        try {
          const data = JSON.parse(event.data)
          onConnectedRef.current?.(data)
        } catch (error) {
          console.error('[ExecutionSSE] Failed to parse connected:', error)
        }
      })

      eventSource.addEventListener('message', (event) => {
        console.log('[ExecutionSSE] Message event received:', event.data)
        try {
          const data = JSON.parse(event.data)
          onMessageRef.current?.(data)
        } catch (error) {
          console.error('[ExecutionSSE] Failed to parse message:', error)
        }
      })

      eventSource.addEventListener('status', (event) => {
        try {
          const data = JSON.parse(event.data)
          onStatusRef.current?.(data)
        } catch (error) {
          console.error('[ExecutionSSE] Failed to parse status:', error)
        }
      })

      eventSource.addEventListener('text', (event) => {
        try {
          const data = JSON.parse(event.data)
          onTextRef.current?.(data)
        } catch (error) {
          console.error('[ExecutionSSE] Failed to parse text:', error)
        }
      })

      eventSource.addEventListener('reasoning', (event) => {
        try {
          const data = JSON.parse(event.data)
          onReasoningRef.current?.(data)
        } catch (error) {
          console.error('[ExecutionSSE] Failed to parse reasoning:', error)
        }
      })

      eventSource.addEventListener('stream_start', (event) => {
        try {
          const data = JSON.parse(event.data)
          onStreamStartRef.current?.(data)
        } catch (error) {
          console.error('[ExecutionSSE] Failed to parse stream_start:', error)
        }
      })

      eventSource.addEventListener('stream_end', (event) => {
        try {
          const data = JSON.parse(event.data)
          onStreamEndRef.current?.(data)
        } catch (error) {
          console.error('[ExecutionSSE] Failed to parse stream_end:', error)
        }
      })

      eventSource.addEventListener('error', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data)
          console.error('[ExecutionSSE] Error event:', data)
          onErrorRef.current?.(event)
        } catch {
          console.error('[ExecutionSSE] Error event:', event)
        }
      })

      eventSource.addEventListener('heartbeat', () => {})

      eventSource.onerror = (error) => {
        console.error('[ExecutionSSE] Connection error:', error)
        onErrorRef.current?.(error)
        
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current)
          console.log(`[ExecutionSSE] Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current + 1})`)
          
          reconnectTimerRef.current = window.setTimeout(() => {
            reconnectAttemptsRef.current++
            connect()
          }, delay)
        } else {
          console.error('[ExecutionSSE] Max reconnect attempts reached')
          onDisconnectedRef.current?.()
        }
      }

      eventSource.onopen = () => {
        console.log('[ExecutionSSE] Connection opened')
      }
    } catch (error) {
      console.error('[ExecutionSSE] Failed to create connection:', error)
      onErrorRef.current?.(error as Event)
    }
  }, [executionId, disconnect])

  useEffect(() => {
    if (executionId) {
      connect()
    }
    
    return () => {
      disconnect()
    }
  }, [executionId, connect, disconnect])

  return {
    connect,
    disconnect,
    isConnected: !!eventSourceRef.current
  }
}
