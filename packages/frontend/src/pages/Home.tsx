import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { message } from 'antd'
import copy from 'copy-to-clipboard'
import Sidebar from '../components/Sidebar'
import UserHeader from '../components/UserHeader'
import ChatBox, { type ExtendedMessageProps, type ChatBoxRef } from '../components/ChatBox'
import AssistantSelector from '../components/AssistantSelector'
import Breadcrumb from '../components/Breadcrumb'
import SkillMarket from './skills/Market'
import SkillDetail from './skills/Detail'
import SkillPublish from './skills/Publish'
import MySkills from './skills/MySkills'
import MyFavorites from './skills/MyFavorites'
import { sendMessageStream, stopMessageStream, sendHumanMessage, getSession, updateSessionStatus, getUsername, generateAvatarColor, createSession, getAssistants, type MessageItem } from '../services/api'
import { useSessionEvents } from '../hooks/useSessionEvents'
import type { Session, Assistant } from '../services/api'
import './Home.css'

function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigateHook = useNavigate()
  const locationHook = useLocation()
  const sessionId = searchParams.get('sessionId')

  const [messages, setMessages] = useState<ExtendedMessageProps[]>([])
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [sessionStatus, setSessionStatus] = useState<string>('active')
  const [, forceUpdate] = useState(0)
  const notFoundRef = useRef(false)
  const chatBoxRef = useRef<ChatBoxRef>(null)
  const loadingStatesRef = useRef<Map<string, boolean>>(new Map())
  const streamingMessagesRef = useRef<Map<string, ExtendedMessageProps[]>>(new Map())
  const currentDisplaySessionIdRef = useRef<string | null>(null)
  const [mode, setMode] = useState<'chat' | 'skill'>('chat')
  const [currentAssistantId, setCurrentAssistantId] = useState<string | null>(() => {
    return localStorage.getItem('currentAssistantId')
  })
  const [assistants, setAssistants] = useState<Assistant[]>([])

  useEffect(() => {
    getAssistants()
      .then(setAssistants)
      .catch(() => message.error('加载助手列表失败'))
  }, [])

  useEffect(() => {
    if (locationHook.pathname.startsWith('/skills')) {
      setMode('skill')
    } else {
      setMode('chat')
    }
  }, [locationHook.pathname])

  const setLoadingState = useCallback((id: string, loading: boolean) => {
    loadingStatesRef.current.set(id, loading)
    forceUpdate(n => n + 1)
  }, [])

  const handleSessionsLoad = useCallback((_sessions: Session[]) => {
  }, [])

  const handleAssistantChange = useCallback((assistantId: string | null) => {
    setCurrentAssistantId(assistantId)
    if (assistantId) {
      localStorage.setItem('currentAssistantId', assistantId)
    } else {
      localStorage.removeItem('currentAssistantId')
    }
    setSearchParams({})
    setMessages([])
    setSessionStatus('active')
    setMode('chat')
  }, [setSearchParams])

  const handleModeChange = useCallback((newMode: 'chat' | 'skill') => {
    setMode(newMode)
    if (newMode === 'skill') {
      navigateHook('/skills')
    } else {
      navigateHook('/')
    }
  }, [navigateHook])

  const loadSession = useCallback(async (id: string) => {
    if (loadingStatesRef.current.get(id) && streamingMessagesRef.current.has(id)) {
      setMessages(streamingMessagesRef.current.get(id)!)
      return
    }
    
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
          },
          reasoning: msg.reasoning
        })
      })
      
      setMessages(loadedMessages)
      setSessionStatus(session.status || 'active')
    } catch (error) {
      if (notFoundRef.current) return
      const errorMessage = error instanceof Error ? error.message : '加载会话失败'
      if (errorMessage.includes('Session not found')) {
        notFoundRef.current = true
        message.error('会话不存在或已被删除')
        setSearchParams({})
      } else {
        message.error('加载会话失败')
      }
    }
  }, [setSearchParams])

  const sendMessage = useCallback(async (text: string, currentSessionId: string) => {
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

    if (sessionStatus === 'human') {
      setMessages(prev => [...prev, userMessage])
      
      sendHumanMessage(text, currentSessionId)
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

    const currentAssistant = assistants.find(a => a.id === currentAssistantId)
    const botName = currentAssistant?.defaultBot?.displayName || 'AI 助手'
    const botColor = currentAssistant?.defaultBot?.avatar || '#52c41a'

    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage: ExtendedMessageProps = {
      _id: assistantMessageId,
      type: 'typing',
      content: { text: '' },
      position: 'left',
      sender: {
        name: botName,
        color: botColor,
        type: 'ai'
      },
      reasoning: ''
    }

    setMessages(prev => {
      const newMessages = [...prev, userMessage, assistantMessage]
      streamingMessagesRef.current.set(currentSessionId, newMessages)
      return newMessages
    })
    setLoadingState(currentSessionId, true)

    let isFirstChunk = true
    let reasoningText = ''
    const streamSessionId = currentSessionId
    sendMessageStream(
      text,
      currentSessionId,
      (chunk: string) => {
        const cached = streamingMessagesRef.current.get(streamSessionId)
        if (cached) {
          const msgIndex = cached.findIndex(m => m._id === assistantMessageId)
          if (msgIndex !== -1) {
            cached[msgIndex] = {
              ...cached[msgIndex],
              type: isFirstChunk ? 'text' : cached[msgIndex].type,
              content: { text: cached[msgIndex].content.text + chunk }
            }
          }
        }
        if (currentDisplaySessionIdRef.current === streamSessionId) {
          setMessages(prev => prev.map(msg =>
            msg._id === assistantMessageId
              ? {
                  ...msg,
                  type: isFirstChunk ? 'text' : msg.type,
                  content: { text: msg.content.text + chunk }
                }
              : msg
          ))
        }
        if (isFirstChunk) isFirstChunk = false
      },
      (chunk: string) => {
        reasoningText += chunk
        const cached = streamingMessagesRef.current.get(streamSessionId)
        if (cached) {
          const msgIndex = cached.findIndex(m => m._id === assistantMessageId)
          if (msgIndex !== -1) {
            cached[msgIndex] = {
              ...cached[msgIndex],
              type: isFirstChunk ? 'text' : cached[msgIndex].type,
              reasoning: reasoningText
            }
          }
        }
        if (currentDisplaySessionIdRef.current === streamSessionId) {
          setMessages(prev => prev.map(msg =>
            msg._id === assistantMessageId
              ? {
                  ...msg,
                  type: isFirstChunk ? 'text' : msg.type,
                  reasoning: reasoningText
                }
              : msg
          ))
        }
        if (isFirstChunk) isFirstChunk = false
      },
      () => {
        streamingMessagesRef.current.delete(streamSessionId)
        if (currentDisplaySessionIdRef.current === streamSessionId) {
          setMessages(prev => prev.map(msg =>
            msg._id === assistantMessageId
              ? {
                  ...msg,
                  content: { text: msg.content.text }
                }
              : msg
          ))
        }
        setLoadingState(currentSessionId, false)
      },
      (error) => {
        streamingMessagesRef.current.delete(streamSessionId)
        console.error('Stream error:', error)
        const errorMessage = error instanceof Error ? error.message : '提问失败，请稍后重试'
        if (errorMessage.includes('Session has been closed') || errorMessage.includes('session has been closed')) {
          message.error('会话已关闭（超过24小时未活动），请新建会话')
          setSessionStatus('closed')
        } else {
          message.error(errorMessage)
        }
        if (currentDisplaySessionIdRef.current === streamSessionId) {
          setMessages(prev => prev.filter(msg => msg._id !== assistantMessageId))
        }
        setLoadingState(currentSessionId, false)
      }
    )
  }, [sessionStatus, setLoadingState])

  useEffect(() => {
    currentDisplaySessionIdRef.current = sessionId
    if (sessionId) {
      loadSession(sessionId)
      
      const pendingKey = `pendingMessage_${sessionId}`
      const pendingMessage = sessionStorage.getItem(pendingKey)
      if (pendingMessage) {
        sessionStorage.removeItem(pendingKey)
        setTimeout(() => {
          sendMessage(pendingMessage, sessionId)
        }, 100)
      }
    } else {
      setMessages([])
      setSessionStatus('active')
    }
  }, [sessionId, loadSession, sendMessage])

  const handleSend = useCallback(async (_type: string, text: string) => {
    if (!text.trim()) {
      message.warning('请输入问题')
      return
    }

    if (!sessionId) {
      try {
        const newSession = await createSession(text, currentAssistantId || undefined)
        sessionStorage.setItem(`pendingMessage_${newSession.id}`, text)
        setSearchParams({ sessionId: newSession.id })
        setRefreshTrigger(prev => prev + 1)
      } catch (error) {
        console.error('Create session error:', error)
        message.error('创建会话失败')
      }
      return
    }

    await sendMessage(text, sessionId)
  }, [sessionId, sendMessage, setSearchParams])

  const handleStop = useCallback(async () => {
    const currentSessionId = sessionId || new URLSearchParams(window.location.search).get('sessionId')
    if (!currentSessionId) return
    
    try {
      await stopMessageStream(currentSessionId)
    } catch (error) {
      console.error('Stop error:', error)
    }
    streamingMessagesRef.current.delete(currentSessionId)
    setLoadingState(currentSessionId, false)
  }, [sessionId, setLoadingState])

  const handleCopyLink = useCallback(() => {
    if (!sessionId) return
    const link = `${window.location.origin}/session/${sessionId}`
    const success = copy(link)
    if (success) {
      message.success('会话链接已复制')
    } else {
      message.error('复制失败，请重试')
    }
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
    if (loadingStatesRef.current.get(id) && streamingMessagesRef.current.has(id)) {
      setMessages(streamingMessagesRef.current.get(id)!)
    }
    setTimeout(() => chatBoxRef.current?.focus(), 0)
  }

  const handleNewSession = () => {
    setSearchParams({})
    setMessages([])
    setSessionStatus('active')
    setTimeout(() => chatBoxRef.current?.focus(), 0)
  }

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
    // 只处理来自 bot 或 admin 的消息（用户自己发的消息已经在本地添加了）
    if (msgData.senderType === 'user') return

    let senderName = 'AI 助手'
    let senderColor = '#52c41a'
    let senderType: 'user' | 'admin' | 'ai' = 'ai'

    if (msgData.senderType === 'bot' && msgData.bot) {
      senderName = msgData.bot.displayName
      senderColor = msgData.bot.avatar || '#52c41a'
      senderType = 'ai'
    } else if (msgData.senderType === 'admin') {
      senderName = '管理员'
      senderColor = '#1890ff'
      senderType = 'admin'
    }

    const newMessage: ExtendedMessageProps = {
      _id: msgData.id,
      type: 'text',
      content: { text: msgData.content },
      position: 'left',
      sender: {
        name: senderName,
        color: senderColor,
        type: senderType
      },
      reasoning: msgData.reasoning || undefined
    }

    setMessages(prev => {
      // 检查消息是否已存在
      const exists = prev.some(msg => msg._id === msgData.id)
      if (exists) return prev
      return [...prev, newMessage]
    })
  }, [])

  const handleRealtimeStatus = useCallback((statusData: { sessionId: string; status: string }) => {
    setSessionStatus(statusData.status)
  }, [])

  useSessionEvents({
    sessionId,
    onMessage: handleRealtimeMessage,
    onStatus: handleRealtimeStatus
  })

  return (
    <div className="home-layout">
      <Sidebar
        mode={mode}
        currentSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        refreshTrigger={refreshTrigger}
        onSessionsLoad={handleSessionsLoad}
        assistantId={currentAssistantId}
      />
      <div className="home-content">
        <UserHeader
          sessionId={sessionId || undefined}
          sessionStatus={sessionStatus}
          onCopyLink={handleCopyLink}
          onMarkNeedHuman={handleMarkNeedHuman}
          assistantSelector={
            <AssistantSelector
              value={currentAssistantId}
              onChange={handleAssistantChange}
              assistants={assistants}
              mode={mode}
              onModeChange={handleModeChange}
            />
          }
        />
        <Breadcrumb 
          assistantId={currentAssistantId} 
          assistants={assistants} 
          mode={mode}
          skillPathname={locationHook.pathname}
        />
        <div className="home-content-body">
          {mode === 'skill' ? (
            (() => {
              const path = locationHook.pathname
              const slug = path.match(/^\/skills\/([^/]+)$/)?.[1]
              if (path === '/skills/publish') return <SkillPublish />
              if (path === '/skills/my/published') return <MySkills />
              if (path === '/skills/my/favorites') return <MyFavorites />
              if (slug) return <SkillDetail />
              return <SkillMarket />
            })()
          ) : (
            <ChatBox
              ref={chatBoxRef}
              messages={messages}
              typing={sessionId ? loadingStatesRef.current.get(sessionId) || false : false}
              onSend={handleSend}
              onStop={handleStop}
              sessionStatus={sessionStatus}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default Home
