import { useEffect, useRef, useState } from 'react'
import Chat, { Bubble, MessageProps } from '@chatui/core'
import '@chatui/core/dist/index.css'
import 'github-markdown-css/github-markdown-light.css'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'
import { Button, Tooltip } from 'antd'
import { LinkOutlined, UserSwitchOutlined, CheckCircleOutlined } from '@ant-design/icons'
import './ChatBox.css'

interface ChatBoxProps {
  messages: MessageProps[]
  typing?: boolean
  sessionTitle?: string
  sessionStatus?: string
  sessionId?: string
  onSend: (type: string, text: string) => void
  onMarkNeedHuman?: () => void
  onCopyLink?: () => void
}

function ChatBox({ 
  messages, 
  typing, 
  sessionTitle, 
  sessionStatus = 'active',
  sessionId,
  onSend, 
  onMarkNeedHuman,
  onCopyLink
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

  function renderMessageContent(msg: MessageProps) {
    const { type, content, position } = msg
    
    if (type === 'typing') {
      return <div className="typing-message">OpenCode 正在思考...</div>
    }
    
    const isUser = position === 'right'

    return (
      <div className="message-wrapper">
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
    if (isNeedHuman) return
    if (type === 'text' && text.trim()) {
      onSend(type, text)
    }
  }

  const isNeedHuman = sessionStatus === 'need_human'
  const showActions = sessionId && sessionTitle

  return (
    <div ref={wrapperRef} className={`chat-box-wrapper ${isScrolling ? 'scrolling' : ''} ${isNeedHuman ? 'session-locked' : ''}`}>
      {sessionTitle && (
        <div className="chat-header">
          <div className="chat-header-content">
            <h2 className="chat-header-title">{sessionTitle}</h2>
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
              {isNeedHuman ? (
                <Tooltip title="已标记为需要人工处理">
                  <Button 
                    type="text"
                    icon={<CheckCircleOutlined />}
                    disabled
                    className="marked-btn"
                  >
                    已标记
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip title="标记后输入框将被禁用，等待人工处理">
                  <Button 
                    type="primary"
                    danger
                    icon={<UserSwitchOutlined />}
                    onClick={onMarkNeedHuman}
                  >
                    AI无法解决，需要人工
                  </Button>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      )}
      <Chat
        messages={messages}
        renderMessageContent={renderMessageContent}
        onSend={handleSend}
        placeholder={isNeedHuman ? '会话已标记，等待人工处理...' : '请输入您的问题...'}
        isTyping={typing}
      />
    </div>
  )
}

export default ChatBox
