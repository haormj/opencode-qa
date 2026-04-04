import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Tag, Button, Input, Space, message, Avatar, Spin, Typography } from 'antd'
import { ArrowLeftOutlined, SendOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import 'github-markdown-css/github-markdown-light.css'
import { getAdminSessionDetail, adminReplyToSession, generateAvatarColor, type SessionDetail, type QuestionItem, type User } from '../../services/api'
import './Admin.css'

const { TextArea } = Input
const { Title, Text } = Typography

const statusColors: Record<string, string> = {
  active: 'green',
  need_human: 'orange',
  resolved: 'blue'
}

const statusLabels: Record<string, string> = {
  active: '进行中',
  need_human: '待人工',
  resolved: '已解决'
}

function AdminSessionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<(SessionDetail & { user: User }) | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)

  const fetchSession = async () => {
    if (!id) return
    setLoading(true)
    try {
      const result = await getAdminSessionDetail(id)
      setSession(result)
    } catch (error) {
      message.error('加载会话详情失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSession()
  }, [id])

  const handleReply = async () => {
    if (!id || !replyText.trim()) {
      message.warning('请输入回复内容')
      return
    }

    setReplying(true)
    try {
      await adminReplyToSession(id, replyText)
      message.success('回复成功')
      setReplyText('')
      fetchSession()
    } catch (error) {
      message.error('回复失败')
    } finally {
      setReplying(false)
    }
  }

  const canReply = session?.status === 'need_human'

  if (loading) {
    return (
      <div className="admin-loading">
        <Spin size="large" />
      </div>
    )
  }

  if (!session) {
    return (
      <Card>
        <div className="admin-empty">会话不存在</div>
      </Card>
    )
  }

  return (
    <Card
      title={
        <Space>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin')} />
          <span>{session.title}</span>
          <Tag color={statusColors[session.status]}>
            {statusLabels[session.status]}
          </Tag>
        </Space>
      }
    >
      <div className="session-info">
        <Space>
          <Avatar style={{ backgroundColor: generateAvatarColor(session.user.displayName) }}>
            {session.user.displayName[0]}
          </Avatar>
          <div>
            <Text strong>{session.user.displayName}</Text>
            <br />
            <Text type="secondary">@{session.user.username}</Text>
          </div>
        </Space>
      </div>

      <div className="message-list">
        {session.questions.map((q: QuestionItem) => (
          <div
            key={q.id}
            className={`message-item ${q.isAdminReply ? 'admin-message' : 'user-message'}`}
          >
            <div className="message-header">
              <Space>
                <Avatar
                  size="small"
                  style={{
                    backgroundColor: q.isAdminReply
                      ? '#1890ff'
                      : generateAvatarColor(session.user.displayName)
                  }}
                >
                  {q.isAdminReply ? <RobotOutlined /> : session.user.displayName[0]}
                </Avatar>
                <Text strong>
                  {q.isAdminReply ? '管理员回复' : q.question}
                </Text>
              </Space>
              <Text type="secondary" className="message-time">
                {new Date(q.createdAt).toLocaleString()}
              </Text>
            </div>
            {!q.isAdminReply && (
              <div className="message-question">
                <Text>{q.question}</Text>
              </div>
            )}
            {q.answer && (
              <div className="markdown-body message-answer">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {q.answer}
                </ReactMarkdown>
              </div>
            )}
            {q.feedback && (
              <div className="message-feedback">
                <Tag color="orange">反馈：{q.feedback.reason}</Tag>
                {q.feedback.contact && <Text type="secondary">联系方式：{q.feedback.contact}</Text>}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="reply-section">
        {canReply ? (
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="输入管理员回复..."
              autoSize={{ minRows: 2, maxRows: 4 }}
              style={{ flex: 1 }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={replying}
              onClick={handleReply}
            >
              发送
            </Button>
          </Space.Compact>
        ) : (
          <div className="reply-disabled">
            <Text type="secondary">
              {session.status === 'resolved'
                ? '该会话已解决，无需回复'
                : '该会话未标记为需要人工处理，无法回复'}
            </Text>
          </div>
        )}
      </div>
    </Card>
  )
}

export default AdminSessionDetail
