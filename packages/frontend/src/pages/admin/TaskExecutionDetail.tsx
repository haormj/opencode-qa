import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Tag, Button, Spin, Typography, Avatar, Empty } from 'antd'
import { ArrowLeftOutlined, RobotOutlined, UserOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'
import { mermaid } from '@streamdown/mermaid'
import { math } from '@streamdown/math'
import { cjk } from '@streamdown/cjk'
import { getExecution, getExecutionMessages, type TaskExecution, type ExecutionMessage } from '../../services/api'
import './TaskExecutionDetail.css'

const statusConfig: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
  pending: { color: 'default', icon: <ClockCircleOutlined />, text: '等待中' },
  running: { color: 'processing', icon: <SyncOutlined spin />, text: '执行中' },
  completed: { color: 'success', icon: <CheckCircleOutlined />, text: '已完成' },
  failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' }
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

function TaskExecutionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [execution, setExecution] = useState<TaskExecution | null>(null)
  const [messages, setMessages] = useState<ExecutionMessage[]>([])

  useEffect(() => {
    if (!id) return
    
    setLoading(true)
    Promise.all([
      getExecution(id),
      getExecutionMessages(id)
    ])
      .then(([execData, msgs]) => {
        setExecution(execData)
        setMessages(msgs)
      })
      .catch(() => {
        // Error handling
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spin size="large" />
      </div>
    )
  }

  if (!execution) {
    return (
      <Card>
        <Empty description="执行记录不存在" />
        <div className="text-center mt-4">
          <Button onClick={() => navigate('/admin/executions')}>返回列表</Button>
        </div>
      </Card>
    )
  }

  const statusInfo = statusConfig[execution.status] || statusConfig.pending

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
            </div>
          </div>
        </div>
      </div>

      <div className="execution-messages">
        {messages.length === 0 ? (
          <Empty description="暂无消息" className="mt-20" />
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user'
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
                    <Streamdown
                      className="message-content"
                      plugins={{ code, mermaid, math, cjk }}
                    >
                      {msg.content}
                    </Streamdown>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default TaskExecutionDetail
