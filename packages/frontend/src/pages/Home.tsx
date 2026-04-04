import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { message, Typography } from 'antd'
import Sidebar from '../components/Sidebar'
import ChatBox from '../components/ChatBox'
import FeedbackModal from '../components/FeedbackModal'
import { askQuestionStream, getSession } from '../services/api'
import type { MessageProps } from '@chatui/core'
import type { QuestionItem } from '../services/api'
import './Home.css'

const { Title, Paragraph } = Typography

function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sessionId = searchParams.get('sessionId')

  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<MessageProps[]>([])
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId)
    } else {
      setMessages([])
    }
  }, [sessionId])

  const loadSession = async (id: string) => {
    try {
      const session = await getSession(id)
      const loadedMessages: MessageProps[] = []
      
      session.questions.forEach((q: QuestionItem) => {
        loadedMessages.push({
          _id: `q-${q.id}`,
          type: 'text',
          content: { text: q.question },
          position: 'right',
        })
        loadedMessages.push({
          _id: `a-${q.id}`,
          type: 'text',
          content: { text: q.answer || '' },
          position: 'left',
          data: { questionId: q.id }
        } as MessageProps)
      })
      
      setMessages(loadedMessages)
    } catch {
      message.error('加载会话失败')
    }
  }

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
      type: 'typing',
      content: { text: '' },
      position: 'left',
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
  }, [sessionId, setSearchParams])

  const handleFeedback = (questionId: number) => {
    setCurrentQuestionId(questionId)
    setFeedbackModalOpen(true)
  }

  const handleFeedbackSubmit = async (reason: string, contact: string) => {
    console.log('Feedback submitted:', { questionId: currentQuestionId, reason, contact })
    message.success('反馈已提交，我们会尽快处理')
    setFeedbackModalOpen(false)
  }

  const handleSelectSession = (id: string) => {
    setSearchParams({ sessionId: id })
  }

  const handleNewSession = () => {
    setSearchParams({})
    setMessages([])
  }

  const hasMessages = messages.length > 0

  return (
    <div className="home-layout">
      <Sidebar
        currentSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        refreshTrigger={refreshTrigger}
      />
      <div className="home-content">
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
      </div>

      <FeedbackModal
        open={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        onSubmit={handleFeedbackSubmit}
      />
    </div>
  )
}

export default Home
