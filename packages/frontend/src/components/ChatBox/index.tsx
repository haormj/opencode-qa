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
  onSend: (type: string, text: string) => void
  onFeedback: (questionId: number) => void
}

function ChatBox({ messages, typing, onSend, onFeedback }: ChatBoxProps) {
  const hasMessages = messages.length > 0

  function renderMessageContent(msg: MessageProps) {
    const { content, position, data } = msg as MessageProps & { 
      data?: { questionId?: number } 
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
    <div className="chat-box-wrapper">
      <Chat
        navbar={hasMessages ? { title: 'OpenCode QA' } : undefined}
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
