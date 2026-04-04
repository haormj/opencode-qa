import { useEffect, useRef, useState } from 'react'
import Chat, { Bubble, MessageProps } from '@chatui/core'
import '@chatui/core/dist/index.css'
import 'github-markdown-css/github-markdown-light.css'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'
import { Button, Tooltip, Avatar } from 'antd'
import { LinkOutlined, UserSwitchOutlined, MenuFoldOutlined, MenuUnfoldOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons'
import './ChatBox.css'

export interface ExtendedMessageProps extends MessageProps {
  sender?: {
    name: string
    avatar?: string
    color?: string
    type: 'user' | 'ai' | 'admin'
  }
}

interface ChatBoxProps {
  messages: ExtendedMessageProps[]
  typing?: boolean
  sessionTitle?: string
  sessionStatus?: string
  sessionId?: string
  onSend: (type: string, text: string) => void
  onMarkNeedHuman?: () => void
  onCopyLink?: () => void
  sidebarCollapsed?: boolean
  onToggleSidebar?: () => void
  hideHeader?: boolean
  isAdminMode?: boolean
}

function ChatBox({ 
  messages, 
  typing, 
  sessionTitle, 
  sessionStatus = 'active',
  sessionId,
  onSend, 
  onMarkNeedHuman,
  onCopyLink,
  sidebarCollapsed = false,
  onToggleSidebar,
  hideHeader = false,
  isAdminMode = false
}: ChatBoxProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [isScrolling, setIsScrolling] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const pullToRefresh = wrapper.querySelector('.PullToRefresh') as HTMLElement
    if (!pullToRefresh) return

    const handleScroll = () => {
      setIsScrolling(true)
      pullToRefresh.classList.add('scrolling')

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        setIsScrolling(false)
        pullToRefresh.classList.remove('scrolling')
      }, 800)
    }

    pullToRefresh.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      pullToRefresh.removeEventListener('scroll', handleScroll)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  function renderMessageContent(msg: ExtendedMessageProps) {
    const { type, content, position, sender } = msg
    
    if (type === 'typing') {
      return <div className="typing-message">OpenCode 正在思考...</div>
    }
    
    const isUser = position === 'right'

    return (
      <div className="message-wrapper">
        {position === 'left' && sender && (
          <div className="message-sender">
            <Avatar size="small" style={{ backgroundColor: sender.color || '#1890ff' }}>
              {sender.type === 'admin' ? <UserOutlined /> : sender.type === 'ai' ? <RobotOutlined /> : (sender.avatar || sender.name[0])}
            </Avatar>
            <span className="sender-name">{sender.name}</span>
          </div>
        )}
        {position === 'right' && sender && (
          <div className="message-sender message-sender-right">
            <span className="sender-name">{sender.name}</span>
            <Avatar size="small" style={{ backgroundColor: sender.color || '#1890ff' }}>
              {sender.avatar || sender.name[0]}
            </Avatar>
          </div>
        )}
        <Bubble
          type="text"
          content={isUser ? content.text : ''}
        >
          {!isUser && (
            <div className="markdown-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {content.text || ''}
              </ReactMarkdown>
            </div>
          )}
        </Bubble>
      </div>
    )
  }

  function handleSend(type: string, text: string) {
    if (isClosed) return
    if (isAdminMode && !isHuman) return
    if (type === 'text' && text.trim()) {
      onSend(type, text)
    }
  }

  const isHuman = sessionStatus === 'human'
  const isClosed = sessionStatus === 'closed'
  const showActions = sessionId && sessionTitle && !hideHeader
  const showWelcome = messages.length === 0 && !sessionTitle && !hideHeader
  
  const getPlaceholder = () => {
    if (isClosed) return '会话已关闭'
    if (isAdminMode) {
      return isHuman ? '请输入回复内容...' : '该会话未标记为需要人工处理，无法回复'
    }
    return '请输入您的问题...'
  }
  
  const isInputDisabled = isClosed || (isAdminMode && !isHuman)

  return (
    <div ref={wrapperRef} className={`chat-box-wrapper ${isScrolling ? 'scrolling' : ''} ${isInputDisabled ? 'session-locked' : ''} ${showWelcome ? 'welcome-mode' : ''}`}>
      {!hideHeader && (
        <div className="chat-header">
          <Tooltip title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}>
            <Button
              type="text"
              className="sidebar-toggle-btn"
              icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={onToggleSidebar}
            />
          </Tooltip>
          <div className="chat-header-content">
            <h2 className="chat-header-title">{sessionTitle || '新对话'}</h2>
            <p className="chat-header-subtitle">由 OpenCode AI 生成</p>
          </div>
          {showActions && (
            <div className="chat-header-actions">
              <Tooltip title="复制会话链接">
                <Button 
                  type="text"
                  icon={<LinkOutlined />}
                  onClick={onCopyLink}
                >
                  复制链接
                </Button>
              </Tooltip>
              {!isClosed && (
                <Tooltip title={isHuman ? '可以点击复制链接发给支撑人员进一步定位' : '点击之后，AI将不再回复消息，可以点击复制链接发给支撑人员进一步定位'}>
                  <Button 
                    type="primary"
                    danger
                    icon={<UserSwitchOutlined />}
                    onClick={onMarkNeedHuman}
                    disabled={isHuman}
                  >
                    AI无法解决，需要人工
                  </Button>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      )}
      <div className="chat-content">
        {showWelcome && (
          <div className="welcome-message">
            <h2>有什么可以帮你的？</h2>
          </div>
        )}
        <Chat
          messages={messages}
          renderMessageContent={renderMessageContent}
          onSend={handleSend}
          placeholder={getPlaceholder()}
          isTyping={typing}
          key={sessionStatus}
        />
      </div>
    </div>
  )
}

export default ChatBox
