import { useEffect, useRef, useState } from 'react'
import Chat, { Bubble, MessageProps } from '@chatui/core'
import '@chatui/core/dist/index.css'
import 'github-markdown-css/github-markdown-light.css'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'
import { Button } from 'antd'
import { DislikeOutlined } from '@ant-design/icons'
import './ChatBox.css'

interface ChatBoxProps {
  messages: MessageProps[]
  typing?: boolean
  sessionTitle?: string
  onSend: (type: string, text: string) => void
  onFeedback: (questionId: number) => void
}

function ChatBox({ messages, typing, sessionTitle, onSend, onFeedback }: ChatBoxProps) {
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
    const { type, content, position, data } = msg as MessageProps & { 
      data?: { questionId?: number } 
    }
    
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
        {!isUser && data?.questionId && (
          <div className="message-actions">
            <Button 
              type="text" 
              size="small"
              icon={<DislikeOutlined />}
              onClick={() => onFeedback(data.questionId!)}
            >
              未解决？提交反馈
            </Button>
          </div>
        )}
      </div>
    )
  }

  function handleSend(type: string, text: string) {
    if (type === 'text' && text.trim()) {
      onSend(type, text)
    }
  }

  return (
    <div ref={wrapperRef} className={`chat-box-wrapper ${isScrolling ? 'scrolling' : ''}`}>
      {sessionTitle && (
        <div className="chat-header">
          <h2 className="chat-header-title">{sessionTitle}</h2>
          <p className="chat-header-subtitle">由 OpenCode AI 生成</p>
        </div>
      )}
      <Chat
        messages={messages}
        renderMessageContent={renderMessageContent}
        onSend={handleSend}
        placeholder="请输入您的问题..."
        isTyping={typing}
      />
    </div>
  )
}

export default ChatBox
