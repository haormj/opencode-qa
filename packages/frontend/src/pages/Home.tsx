import { useState, useCallback } from 'react'
import { message, Typography } from 'antd'
import ChatBox from '../components/ChatBox'
import FeedbackModal from '../components/FeedbackModal'
import { askQuestionStream } from '../services/api'
import type { MessageProps } from '@chatui/core'
import './Home.css'

const { Title, Paragraph } = Typography

function Home() {
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<MessageProps[]>([])
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(null)

  const handleSend = useCallback((_type: string, text: string) => {
    if (!text.trim()) {
      message.warning('请输入问题')
      return
    }

    const userMessage: MessageProps = {
      _id: Date.now().toString(),
      type: 'text',
      content: { text },
      position: 'right',
    }
    
    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage: MessageProps = {
      _id: assistantMessageId,
      type: 'text',
      content: { text: '' },
      position: 'left',
    }
    
    setMessages(prev => [...prev, userMessage, assistantMessage])
    setLoading(true)

    askQuestionStream(
      text,
      (chunk) => {
        setMessages(prev => prev.map(msg => 
          msg._id === assistantMessageId 
            ? { ...msg, content: { text: msg.content.text + chunk } }
            : msg
        ))
      },
      (result) => {
        setMessages(prev => prev.map(msg => 
          msg._id === assistantMessageId 
            ? { 
                ...msg, 
                content: { text: result.answer },
                data: { questionId: result.id }
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
  }, [])

  const handleFeedback = (questionId: number) => {
    setCurrentQuestionId(questionId)
    setFeedbackModalOpen(true)
  }

  const handleFeedbackSubmit = async (reason: string, contact: string) => {
    console.log('Feedback submitted:', { questionId: currentQuestionId, reason, contact })
    message.success('反馈已提交，我们会尽快处理')
    setFeedbackModalOpen(false)
  }

  const hasMessages = messages.length > 0

  return (
    <div className={hasMessages ? 'chat-page-full' : 'chat-page-center'}>
      {hasMessages ? (
        <ChatBox 
          messages={messages}
          typing={loading}
          onSend={handleSend}
          onFeedback={handleFeedback}
        />
      ) : (
        <div className="chat-welcome">
          <div className="welcome-content">
            <Title level={2} style={{ marginBottom: 8 }}>OpenCode QA</Title>
            <Paragraph type="secondary" style={{ marginBottom: 32 }}>
              基于项目代码库的智能问答系统
            </Paragraph>
            <ChatBox 
              messages={messages}
              typing={loading}
              onSend={handleSend}
              onFeedback={handleFeedback}
            />
          </div>
        </div>
      )}

      <FeedbackModal
        open={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        onSubmit={handleFeedbackSubmit}
      />
    </div>
  )
}

export default Home
