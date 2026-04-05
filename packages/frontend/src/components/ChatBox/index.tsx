import { useEffect, useRef, useState } from 'react'
import Chat, { Bubble, MessageProps } from '@chatui/core'
import '@chatui/core/dist/index.css'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'
import { mermaid } from '@streamdown/mermaid'
import { math } from '@streamdown/math'
import { cjk } from '@streamdown/cjk'
import { Avatar } from 'antd'
import { RobotOutlined, UserOutlined } from '@ant-design/icons'
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
  onSend: (type: string, text: string) => void
  isAdminMode?: boolean
  sessionStatus?: string
}

function ChatBox({ 
  messages, 
  typing, 
  onSend,
  isAdminMode = false,
  sessionStatus = 'active'
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
    const text = content.text || ''
    const isAnimating = typing && !isUser

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
          content={isUser ? text : ''}
        >
        {!isUser && (
          <Streamdown
            className="message-content"
            plugins={{ code, mermaid, math, cjk }}
            isAnimating={isAnimating}
            caret="block"
          >
            {text}
          </Streamdown>
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
  const showWelcome = messages.length === 0
  
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
