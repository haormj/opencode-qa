import { useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Tag, Button, Spin, Typography, Empty, Popconfirm, message } from 'antd'
import { ArrowLeftOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, StopOutlined } from '@ant-design/icons'
import ChatBox, { ExtendedMessageProps } from '@/components/ChatBox'
import type { TaskExecution, ExecutionMessage } from '../../services/api'
import { cancelExecution, appendExecutionMessage, closeExecutionSession, stopExecutionStream } from '../../services/api'
import { useExecutionEvents } from '../../hooks/useExecutionEvents'
import './TaskExecutionDetail.css'

const statusConfig: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
  pending: { color: 'default', icon: <ClockCircleOutlined />, text: '等待中' },
  running: { color: 'processing', icon: <SyncOutlined spin />, text: '执行中' },
  completed: { color: 'success', icon: <CheckCircleOutlined />, text: '已完成' },
  failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
  cancelled: { color: 'warning', icon: <StopOutlined />, text: '已终止' }
}

function formatDuration(startedAt: string | null | undefined, completedAt: string | null | undefined): string {
  if (!startedAt) return '-'
  
  const start = new Date(startedAt).getTime()
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const durationMs = end - start
  
  if (durationMs < 1000) return `${durationMs}ms`
  if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`
  return `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`
}

function formatTriggerInfo(execution: TaskExecution | null): string {
  if (!execution) return ''
  
  if (execution.triggerType === 'manual' && execution.triggeredByUser) {
    return `执行者：${execution.triggeredByUser.displayName || execution.triggeredByUser.username}`
  }
  
  if (execution.triggerType === 'schedule') {
    return execution.startedAt 
      ? `定时触发：${new Date(execution.startedAt).toLocaleString()}`
      : '定时触发'
  }
  
  if (execution.triggerType === 'webhook') {
    return 'Webhook 触发'
  }
  
  return ''
}

function TaskExecutionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const [connected, setConnected] = useState(false)
  const [execution, setExecution] = useState<TaskExecution | null>(null)
  const [messages, setMessages] = useState<ExecutionMessage[]>([])
  const [streamingReasoning, setStreamingReasoning] = useState<string>('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [closing, setClosing] = useState(false)
  const isTriggerRef = useRef(false)
  const streamingMessageIdRef = useRef<string | null>(null)

  useExecutionEvents({
    executionId: id || null,
    onConnected: (data) => {
      setConnected(true)
      isTriggerRef.current = data.isTrigger
    },
    onStatus: (data) => {
      setExecution(prev => {
        if (!prev) {
          return {
            id: data.executionId,
            taskId: '',
            status: data.status as TaskExecution['status'],
            triggerType: data.triggerType as TaskExecution['triggerType'],
            triggeredBy: data.triggeredBy ?? null,
            triggeredByUser: null,
            cancelledByUser: data.cancelledByUser ?? null,
            startedAt: data.startedAt ?? null,
            completedAt: data.completedAt ?? null,
            isDebug: data.isDebug ?? false,
            createdAt: data.updatedAt
          }
        }
        return { 
          ...prev, 
          status: data.status as TaskExecution['status'],
          cancelledByUser: data.cancelledByUser ?? prev.cancelledByUser,
          isDebug: data.isDebug ?? prev.isDebug
        }
      })
    },
    onMessage: (data) => {
      setMessages(prev => {
        const exists = prev.find(m => m.id === data.id)
        if (exists) {
          if (streamingMessageIdRef.current === data.id && data.reasoning !== undefined) {
            setStreamingReasoning('')
            setIsStreaming(false)
            streamingMessageIdRef.current = null
          }
          return prev.map(m => m.id === data.id ? { ...m, content: data.content, reasoning: data.reasoning } : m)
        }
        return [...prev, {
          id: data.id,
          executionId: data.executionId,
          role: data.role as 'user' | 'assistant' | 'system',
          content: data.content,
          reasoning: data.reasoning,
          createdAt: data.createdAt
        }]
      })
    },
    onText: (data) => {
      const currentRef = streamingMessageIdRef.current
      if (isTriggerRef.current && currentRef) {
        setMessages(prev => prev.map(m => 
          m.id === currentRef 
            ? { ...m, content: m.content + data.text }
            : m
        ))
      }
    },
    onReasoning: (data) => {
      if (isTriggerRef.current) {
        setStreamingReasoning(prev => prev + data.text)
      }
    },
    onStreamStart: (data) => {
      if (isTriggerRef.current) {
        streamingMessageIdRef.current = data.messageId
        setIsStreaming(true)
        setStreamingReasoning('')
        setMessages(prev => {
          const exists = prev.find(m => m.id === data.messageId)
          if (exists) return prev
          return [...prev, {
            id: data.messageId,
            executionId: data.executionId,
            role: 'assistant' as const,
            content: '',
            createdAt: new Date().toISOString()
          }]
        })
      }
    },
    onStreamEnd: () => {
      if (isTriggerRef.current) {
        setIsStreaming(false)
      }
    },
    onError: (error) => {
      console.error('[ExecutionSSE] Error:', error)
    },
    onRestore: (data) => {
      if (!data.isTrigger) return
      
      if (data.streamingMessageId) {
        const streamingMessageId = data.streamingMessageId
        streamingMessageIdRef.current = streamingMessageId
        setIsStreaming(true)
        setStreamingReasoning(data.streamingReasoning || '')
        
        if (data.streamingContent) {
          const streamingContent = data.streamingContent
          setMessages(prev => {
            const exists = prev.find(m => m.id === streamingMessageId)
            if (exists) {
              return prev.map(m => 
                m.id === streamingMessageId 
                  ? { ...m, content: streamingContent } 
                  : m
              )
            }
            return [...prev, {
              id: streamingMessageId,
              executionId: id!,
              role: 'assistant' as const,
              content: streamingContent,
              createdAt: new Date().toISOString()
            }]
          })
        }
      }
    }
  })

  const handleCancel = async () => {
    if (!id) return
    try {
      await cancelExecution(id)
      message.success('任务已终止')
      setExecution(prev => prev ? { ...prev, status: 'cancelled' } : null)
    } catch (error) {
      message.error('终止任务失败')
    }
  }

  const handleSend = useCallback(async (_type: string, text: string) => {
    if (!id || !text.trim() || isStreaming) return
    
    try {
      await appendExecutionMessage(id, text.trim())
    } catch (error) {
      message.error('发送失败')
    }
  }, [id, isStreaming])

  const handleStop = useCallback(async () => {
    if (!id) return
    try {
      await stopExecutionStream(id)
      setIsStreaming(false)
    } catch (error) {
      message.error('停止失败')
    }
  }, [id])

  const handleCloseSession = useCallback(async () => {
    if (!id) return
    setClosing(true)
    try {
      await closeExecutionSession(id)
      message.success('会话已关闭')
      navigate('/admin/task-executions')
    } catch (error) {
      message.error('关闭失败')
    } finally {
      setClosing(false)
    }
  }, [id, navigate])

  const chatMessages = useMemo((): ExtendedMessageProps[] => {
    return messages.map((msg) => {
      const isStreamingMsg = msg.id === streamingMessageIdRef.current
      
      let reasoning = msg.reasoning ?? undefined
      if (isStreaming && isStreamingMsg && streamingReasoning) {
        reasoning = streamingReasoning
      }
      
      return {
        _id: msg.id,
        type: 'text',
        content: { text: msg.content },
        position: msg.role === 'user' ? 'right' : 'left',
        sender: msg.role === 'user' 
          ? { name: '任务指令', type: 'user' as const, color: '#87d068' }
          : { name: '机器人', type: 'ai' as const, color: '#1890ff' },
        reasoning
      }
    })
  }, [messages, isStreaming, streamingReasoning])

  if (!connected) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  if (!execution) {
    return (
      <div className="flex items-center justify-center h-96">
        <Empty description="执行记录不存在" />
        <div className="text-center mt-4">
          <Button onClick={() => navigate('/admin/executions')}>返回列表</Button>
        </div>
      </div>
    )
  }

  const statusInfo = statusConfig[execution.status] || statusConfig.pending
  const triggerInfo = formatTriggerInfo(execution)

  return (
    <div className="task-execution-detail">
      <div className="execution-header">
        <div className="execution-header-left">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
          />
          <div className="execution-info">
            <Typography.Title level={4} className="execution-title">
              执行详情
            </Typography.Title>
            <div className="execution-meta">
              <span className="execution-id">
                ID: {execution.id.slice(0, 8)}
              </span>
              <Tag color={statusInfo.color} icon={statusInfo.icon}>
                {statusInfo.text}
              </Tag>
              <span className="execution-duration">
                耗时: {formatDuration(execution.startedAt, execution.completedAt)}
              </span>
              {execution.startedAt && (
                <span className="execution-time">
                  开始: {new Date(execution.startedAt).toLocaleString()}
                </span>
              )}
              {triggerInfo && (
                <span className="execution-trigger">
                  {triggerInfo}
                </span>
              )}
              {execution.status === 'cancelled' && execution.cancelledByUser && (
                <span className="execution-cancelled-by">
                  终止者: {execution.cancelledByUser.displayName || execution.cancelledByUser.username}
                </span>
              )}
            </div>
          </div>
        </div>
        {execution.status === 'running' && (
          <div className="execution-header-right">
            {execution.isDebug ? (
              <Button type="primary" onClick={handleCloseSession} loading={closing}>
                关闭会话
              </Button>
            ) : (
              <Popconfirm
                title="确认终止"
                description="确定要终止该任务执行吗？"
                onConfirm={handleCancel}
                okText="确定"
                cancelText="取消"
              >
                <Button danger icon={<StopOutlined />}>
                  终止任务
                </Button>
              </Popconfirm>
            )}
          </div>
        )}
      </div>

      <div className="execution-chatbox">
        <ChatBox
          messages={chatMessages}
          typing={isStreaming}
          onSend={handleSend}
          onStop={handleStop}
          isAdminMode={false}
          sessionStatus={execution.isDebug && execution.status === 'running' ? 'active' : 'closed'}
          hideComposer={!execution.isDebug}
        />
      </div>
    </div>
  )
}

export default TaskExecutionDetail
