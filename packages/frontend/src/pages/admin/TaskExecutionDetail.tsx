import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Tag, Button, Spin, Typography, Avatar, Empty, Popconfirm, message } from 'antd'
import { ArrowLeftOutlined, RobotOutlined, UserOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, StopOutlined } from '@ant-design/icons'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'
import { mermaid } from '@streamdown/mermaid'
import { math } from '@streamdown/math'
import { cjk } from '@streamdown/cjk'
import type { TaskExecution, ExecutionMessage } from '../../services/api'
import { cancelExecution } from '../../services/api'
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isTriggerRef = useRef(false)
  const streamingMessageIdRef = useRef<string | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingReasoning])

  useExecutionEvents({
    executionId: id || null,
    onConnected: (data) => {
      setConnected(true)
      isTriggerRef.current = data.isTrigger
      streamingMessageIdRef.current = null
      setStreamingReasoning('')
      setIsStreaming(false)
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
            cancelledByUser: null,
            startedAt: data.startedAt ?? null,
            completedAt: data.completedAt ?? null,
            createdAt: data.updatedAt
          }
        }
        return { ...prev, status: data.status as TaskExecution['status'] }
      })
    },
    onMessage: (data) => {
      setMessages(prev => {
        const exists = prev.find(m => m.id === data.id)
        if (exists) {
          if (streamingMessageIdRef.current === data.id) {
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
      if (isTriggerRef.current && streamingMessageIdRef.current) {
        setMessages(prev => prev.map(m => 
          m.id === streamingMessageIdRef.current 
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
        setIsStreaming(true)
        setStreamingReasoning('')
        streamingMessageIdRef.current = data.messageId
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
          </div>
        )}
      </div>

      <div className="execution-messages">
        {messages.length === 0 ? (
          <Empty description="暂无消息" className="mt-20" />
        ) : (
          <>
            {messages.map((msg) => {
              const isUser = msg.role === 'user'
              const isStreamingMsg = msg.id === streamingMessageIdRef.current
              return (
                <div
                  key={msg.id}
                  className={`execution-message ${isUser ? 'message-right' : 'message-left'}`}
                >
                  <div className="message-sender">
                    {isUser ? (
                      <>
                        <span className="sender-name">任务指令</span>
                        <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#87d068' }} />
                      </>
                    ) : (
                      <>
                        <Avatar size="small" icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff' }} />
                        <span className="sender-name">机器人</span>
                      </>
                    )}
                  </div>
                  <div className="message-bubble">
                    {isUser ? (
                      <div className="message-text">{msg.content}</div>
                    ) : (
                      <>
                        {isStreaming && isStreamingMsg && streamingReasoning && (
                          <details className="reasoning-block" open>
                            <summary className="reasoning-summary">
                              💭 思考中
                              <span className="reasoning-dots">
                                <span className="reasoning-dot">.</span>
                                <span className="reasoning-dot">.</span>
                                <span className="reasoning-dot">.</span>
                              </span>
                            </summary>
                            <div className="reasoning-content">{streamingReasoning}</div>
                          </details>
                        )}
                        {!isStreamingMsg && msg.reasoning && (
                          <details className="reasoning-block">
                            <summary className="reasoning-summary">💭 思考过程</summary>
                            <div className="reasoning-content">{msg.reasoning}</div>
                          </details>
                        )}
                        <Streamdown
                          className="message-content"
                          plugins={{ code, mermaid, math, cjk }}
                          isAnimating={isStreaming && isStreamingMsg}
                          caret={isStreaming && isStreamingMsg ? 'block' : undefined}
                        >
                          {msg.content}
                        </Streamdown>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

export default TaskExecutionDetail
