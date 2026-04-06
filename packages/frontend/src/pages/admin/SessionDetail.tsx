import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Tag, Button, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { getAdminSessionDetail, adminReplyToSession, type SessionDetail, type MessageItem, type User } from '../../services/api'
import { useSessionEvents } from '../../hooks/useSessionEvents'
import type { ExtendedMessageProps } from '../../components/ChatBox'
import ChatBox from '../../components/ChatBox'
import './Admin.css'

const statusColors: Record<string, string> = {
  active: 'green',
  human: 'orange',
  closed: 'default'
}

const statusLabels: Record<string, string> = {
  active: '进行中',
  human: '待人工',
  closed: '已关闭'
}

function AdminSessionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<(SessionDetail & { user: User }) | null>(null)
  const notFoundRef = useRef(false)

  const fetchSession = async () => {
    if (!id) return
    setLoading(true)
    try {
      const result = await getAdminSessionDetail(id)
      setSession(result)
    } catch (error) {
      if (notFoundRef.current) return
      const errorMessage = error instanceof Error ? error.message : '加载会话详情失败'
      if (errorMessage.includes('Session not found')) {
        notFoundRef.current = true
        message.error('会话不存在')
        navigate('/admin')
      } else {
        message.error('加载会话详情失败')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSession()
  }, [id])

  // SSE 实时消息监听
  const handleRealtimeMessage = useCallback((msgData: {
    id: string
    sessionId: string
    senderType: string
    content: string
    reasoning?: string | null
    createdAt: string
    user?: { id: string; displayName: string; username: string } | null
    bot?: { id: string; displayName: string; avatar: string | null } | null
  }) => {
    // 只处理来自 user 或 bot 的消息（管理员自己发的消息已经在本地添加了）
    if (msgData.senderType === 'admin') return

    setSession(prev => {
      if (!prev) return prev
      
      // 检查消息是否已存在
      const exists = prev.messages.some(msg => msg.id === msgData.id)
      if (exists) return prev

        // 创建新消息对象
      const newMessage: MessageItem = {
        id: msgData.id,
        sessionId: msgData.sessionId,
        senderType: msgData.senderType as 'user' | 'admin' | 'bot',
        content: msgData.content,
        reasoning: msgData.reasoning || undefined,
        createdAt: msgData.createdAt,
        user: msgData.user || undefined,
        bot: msgData.bot ? {
          id: msgData.bot.id,
          displayName: msgData.bot.displayName,
          avatar: msgData.bot.avatar || undefined
        } : undefined
      }

      return {
        ...prev,
        messages: [...prev.messages, newMessage]
      }
    })
  }, [])

  useSessionEvents({
    sessionId: id || null,
    onMessage: handleRealtimeMessage
  })

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
        reasoning: msg.reasoning,
        position: msg.senderType === 'user' ? 'right' : 'left',
        sender: {
          name: senderName,
          color: senderColor,
          type: senderType
        }
      }
    })
  }

  const handleReply = (_type: string, text: string) => {
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
          sessionStatus={session.status}
          onSend={handleReply}
          isAdminMode
        />
      </div>
    </div>
  )
}

export default AdminSessionDetail
