import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Tag, Button, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { getAdminSessionDetail, adminReplyToSession, type SessionDetail, type MessageItem, type User } from '../../services/api'
import type { ExtendedMessageProps } from '../../components/ChatBox'
import ChatBox from '../../components/ChatBox'
import './Admin.css'

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

  const convertMessagesToChatBox = (messages: MessageItem[]): ExtendedMessageProps[] => {
    return messages.map(msg => {
      let senderName = '用户'
      let senderColor = '#1890ff'
      let senderType: 'user' | 'admin' | 'ai' = 'user'
      
      if (msg.senderType === 'bot' && msg.bot) {
        senderName = msg.bot.displayName
        senderColor = msg.bot.avatar || '#52c41a'
        senderType = 'ai'
      } else if (msg.senderType === 'admin') {
        senderName = '管理员'
        senderColor = '#1890ff'
        senderType = 'admin'
      } else if (msg.senderType === 'user' && msg.user) {
        senderName = msg.user.displayName
        senderColor = '#1890ff'
        senderType = 'user'
      }
      
      return {
        _id: msg.id,
        type: 'text',
        content: { text: msg.content },
        position: msg.senderType === 'user' ? 'right' : 'left',
        sender: {
          name: senderName,
          color: senderColor,
          type: senderType
        }
      }
    })
  }

  const handleReply = (type: string, text: string) => {
    if (!id || !text.trim()) {
      message.warning('请输入回复内容')
      return
    }

    adminReplyToSession(id, text)
      .then(() => {
        message.success('回复成功')
        fetchSession()
      })
      .catch(() => {
        message.error('回复失败')
      })
  }

  if (loading) {
    return (
      <div className="admin-loading">
        <div style={{ textAlign: 'center', padding: '100px 0' }}>加载中...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="admin-empty">会话不存在</div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin')} />
        <span style={{ fontSize: '16px', fontWeight: 500 }}>{session.title}</span>
        <Tag color={statusColors[session.status]}>
          {statusLabels[session.status]}
        </Tag>
      </div>
      <div className="chat-page-full">
        <ChatBox
          messages={convertMessagesToChatBox(session.messages)}
          sessionTitle=""
          sessionStatus={session.status}
          sessionId={session.id}
          onSend={handleReply}
          onMarkNeedHuman={undefined}
          hideHeader
          isAdminMode
        />
      </div>
    </div>
  )
}

export default AdminSessionDetail
