import { useState, useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { message } from 'antd'
import Sidebar from '../components/Sidebar'
import ChatBox, { type ExtendedMessageProps } from '../components/ChatBox'
import { askQuestionStream, getSession, updateSessionStatus, getUsername, generateAvatarColor } from '../services/api'
import type { QuestionItem, Session } from '../services/api'
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
      const username = getUsername()
      
      session.questions.forEach((q: QuestionItem) => {
        loadedMessages.push({
          _id: `q-${q.id}`,
          type: 'text',
          content: { text: q.question },
          position: 'right',
          sender: {
            name: username,
            color: generateAvatarColor(username),
            type: 'user'
          }
        })
        if (q.answer) {
          loadedMessages.push({
            _id: `a-${q.id}`,
            type: 'text',
            content: { text: q.answer },
            position: 'left',
            sender: q.isAdminReply ? {
              name: '管理员',
              color: '#1890ff',
              type: 'admin'
            } : {
              name: 'AI 助手',
              color: '#52c41a',
              type: 'ai'
            }
          })
        }
      })
      
      setMessages(loadedMessages)
      setSessionStatus(session.status || 'active')
    } catch {
      message.error('加载会话失败')
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
    askQuestionStream(
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
                content: { text: result.answer }
              }
            : msg
        ))
        setLoading(false)
      },
      (error) => {
        console.error('Stream error:', error)
        message.error('提问失败，请稍后重试')
        setMessages(prev => prev.filter(msg => msg._id !== assistantMessageId))
        setLoading(false)
      }
    )
  }, [sessionId, setSearchParams])

  const handleCopyLink = useCallback(() => {
    if (!sessionId) return
    const link = `${window.location.origin}?sessionId=${sessionId}`
    navigator.clipboard.writeText(link)
    message.success('会话链接已复制')
  }, [sessionId])

  const handleMarkNeedHuman = useCallback(async () => {
    if (!sessionId) return
    
    try {
      await updateSessionStatus(sessionId, 'need_human')
      setSessionStatus('need_human')
      handleCopyLink()
      message.success('已标记为需要人工处理')
    } catch {
      message.error('标记失败，请稍后重试')
    }
  }, [sessionId, handleCopyLink])

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
