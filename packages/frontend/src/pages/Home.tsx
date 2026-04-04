import { useState, useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { message } from 'antd'
import Sidebar from '../components/Sidebar'
import ChatBox, { type ExtendedMessageProps } from '../components/ChatBox'
import { sendMessageStream, sendHumanMessage, getSession, updateSessionStatus, getUsername, generateAvatarColor, type MessageItem } from '../services/api'
import type { Session } from '../services/api'
import './Home.css'

function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sessionId = searchParams.get('sessionId')

  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ExtendedMessageProps[]>([])
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionStatus, setSessionStatus] = useState<string>('active')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const handleSessionsLoad = useCallback((loadedSessions: Session[]) => {
    setSessions(loadedSessions)
  }, [])

  const currentSessionTitle = useMemo(() => {
    if (!sessionId) return '新对话'
    const session = sessions.find(s => s.id === sessionId)
    return session?.title || '新对话'
  }, [sessionId, sessions])

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId)
    } else {
      setMessages([])
      setSessionStatus('active')
    }
  }, [sessionId])

  const loadSession = async (id: string) => {
    try {
      const session = await getSession(id)
      const loadedMessages: ExtendedMessageProps[] = []
      
      session.messages.forEach((msg: MessageItem) => {
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
          senderColor = generateAvatarColor(msg.user.displayName)
          senderType = 'user'
        }
        
        loadedMessages.push({
          _id: msg.id,
          type: 'text',
          content: { text: msg.content },
          position: msg.senderType === 'user' ? 'right' : 'left',
          sender: {
            name: senderName,
            color: senderColor,
            type: senderType
          }
        })
      })
      
      setMessages(loadedMessages)
      setSessionStatus(session.status || 'active')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载会话失败'
      if (errorMessage.includes('Session not found')) {
        message.error('会话不存在或已被删除')
        setSearchParams({})
      } else {
        message.error('加载会话失败')
      }
    }
  }

  const handleSend = useCallback((_type: string, text: string) => {
    if (!text.trim()) {
      message.warning('请输入问题')
      return
    }

    const username = getUsername()
    const userMessage: ExtendedMessageProps = {
      _id: Date.now().toString(),
      type: 'text',
      content: { text },
      position: 'right',
      sender: {
        name: username,
        color: generateAvatarColor(username),
        type: 'user'
      }
    }

    if (sessionStatus === 'human' && sessionId) {
      setMessages(prev => [...prev, userMessage])
      
      sendHumanMessage(text, sessionId)
        .then(() => {
          message.success('消息已发送，等待人工处理')
        })
        .catch((error) => {
          console.error('Send message error:', error)
          message.error('发送消息失败，请稍后重试')
          setMessages(prev => prev.filter(msg => msg._id !== userMessage._id))
        })
      return
    }

    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage: ExtendedMessageProps = {
      _id: assistantMessageId,
      type: 'typing',
      content: { text: '' },
      position: 'left',
      sender: {
        name: 'AI 助手',
        color: '#52c41a',
        type: 'ai'
      }
    }

    setMessages(prev => [...prev, userMessage, assistantMessage])
    setLoading(true)

    let isFirstChunk = true
    sendMessageStream(
      text,
      sessionId,
      (chunk: string) => {
        setMessages(prev => prev.map(msg =>
          msg._id === assistantMessageId
            ? {
                ...msg,
                type: isFirstChunk ? 'text' : msg.type,
                content: { text: msg.content.text + chunk }
              }
            : msg
        ))
        if (isFirstChunk) isFirstChunk = false
      },
      (result) => {
        if (!sessionId) {
          setSearchParams({ sessionId: result.sessionId })
          setRefreshTrigger(prev => prev + 1)
        }
        setMessages(prev => prev.map(msg =>
          msg._id === assistantMessageId
            ? {
                ...msg,
                content: { text: result.content }
              }
            : msg
        ))
        setLoading(false)
      },
      (error) => {
        console.error('Stream error:', error)
        const errorMessage = error instanceof Error ? error.message : '提问失败，请稍后重试'
        if (errorMessage.includes('Session has been closed') || errorMessage.includes('session has been closed')) {
          message.error('会话已关闭（超过24小时未活动），请新建会话')
          setSessionStatus('closed')
        } else {
          message.error(errorMessage)
        }
        setMessages(prev => prev.filter(msg => msg._id !== assistantMessageId))
        setLoading(false)
      }
    )
  }, [sessionId, sessionStatus, setSearchParams])

  const handleCopyLink = useCallback(() => {
    if (!sessionId) return
    const link = `${window.location.origin}/session/${sessionId}`
    navigator.clipboard.writeText(link)
    message.success('会话链接已复制')
  }, [sessionId])

  const handleMarkNeedHuman = useCallback(async () => {
    if (!sessionId) return
    
    try {
      await updateSessionStatus(sessionId, 'human')
      setSessionStatus('human')
      message.success('已标记为需要人工处理，可复制链接发给支撑人员')
    } catch {
      message.error('标记失败，请稍后重试')
    }
  }, [sessionId])

  const handleSelectSession = (id: string) => {
    setSearchParams({ sessionId: id })
  }

  const handleNewSession = () => {
    setSearchParams({})
    setMessages([])
    setSessionStatus('active')
  }

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev)
  }, [])

  const hasMessages = messages.length > 0

  return (
    <div className="home-layout">
      <Sidebar
        currentSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        refreshTrigger={refreshTrigger}
        onSessionsLoad={handleSessionsLoad}
        collapsed={sidebarCollapsed}
      />
      <div className="home-content">
        {hasMessages ? (
          <div className="chat-page-full">
            <ChatBox
              messages={messages}
              typing={loading}
              sessionTitle={currentSessionTitle}
              sessionStatus={sessionStatus}
              sessionId={sessionId || undefined}
              onSend={handleSend}
              onMarkNeedHuman={handleMarkNeedHuman}
              onCopyLink={handleCopyLink}
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebar={toggleSidebar}
            />
          </div>
        ) : (
          <div className="chat-page-full">
            <ChatBox
              messages={messages}
              typing={loading}
              onSend={handleSend}
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebar={toggleSidebar}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default Home
