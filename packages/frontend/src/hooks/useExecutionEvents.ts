import { useEffect, useRef } from 'react'
import {
  executionEventManager,
  ExecutionMessageEventData,
  ExecutionStatusEventData,
  ExecutionTextEventData,
  ExecutionStreamStartEventData,
  ExecutionConnectedEventData
} from '../services/execution-event-manager'

export type {
  ExecutionMessageEventData,
  ExecutionStatusEventData,
  ExecutionTextEventData,
  ExecutionStreamStartEventData,
  ExecutionConnectedEventData
}

interface UseExecutionEventsOptions {
  executionId: string | null
  onMessage?: (data: ExecutionMessageEventData) => void
  onStatus?: (data: ExecutionStatusEventData) => void
  onText?: (data: ExecutionTextEventData) => void
  onReasoning?: (data: ExecutionTextEventData) => void
  onStreamStart?: (data: ExecutionStreamStartEventData) => void
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
  onError
}: UseExecutionEventsOptions) {
  const onMessageRef = useRef(onMessage)
  const onStatusRef = useRef(onStatus)
  const onTextRef = useRef(onText)
  const onReasoningRef = useRef(onReasoning)
  const onStreamStartRef = useRef(onStreamStart)
  const onStreamEndRef = useRef(onStreamEnd)
  const onConnectedRef = useRef(onConnected)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onMessageRef.current = onMessage
    onStatusRef.current = onStatus
    onTextRef.current = onText
    onReasoningRef.current = onReasoning
    onStreamStartRef.current = onStreamStart
    onStreamEndRef.current = onStreamEnd
    onConnectedRef.current = onConnected
    onErrorRef.current = onError
  })

  useEffect(() => {
    if (!executionId) return

    const unsubscribe = executionEventManager.subscribe(executionId, {
      onConnected: (data) => onConnectedRef.current?.(data),
      onMessage: (data) => onMessageRef.current?.(data),
      onStatus: (data) => onStatusRef.current?.(data),
      onText: (data) => onTextRef.current?.(data),
      onReasoning: (data) => onReasoningRef.current?.(data),
      onStreamStart: (data) => onStreamStartRef.current?.(data),
      onStreamEnd: (data) => onStreamEndRef.current?.(data),
      onError: (error) => onErrorRef.current?.(error)
    })

    return () => {
      unsubscribe()
    }
  }, [executionId])
}
