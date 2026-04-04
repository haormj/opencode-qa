import { useState } from 'react'
import { Card, Input, Button, Spin, message, Typography } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import ChatBox from '../components/ChatBox'
import FeedbackModal from '../components/FeedbackModal'
import { askQuestion, type QuestionResponse } from '../services/api'

const { TextArea } = Input
const { Title } = Typography

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  questionData?: QuestionResponse
}

function Home() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(null)

  const handleSubmit = async () => {
    if (!question.trim()) {
      message.warning('请输入问题')
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: question
    }
    setMessages(prev => [...prev, userMessage])
    setQuestion('')
    setLoading(true)

    try {
      const result = await askQuestion(question)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: result.answer,
        questionData: result
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch {
      message.error('提问失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleFeedback = (questionId: number) => {
    setCurrentQuestionId(questionId)
    setFeedbackModalOpen(true)
  }

  const handleFeedbackSubmit = async (reason: string, contact: string) => {
    // TODO: 调用反馈 API
    console.log('Feedback submitted:', { questionId: currentQuestionId, reason, contact })
    message.success('反馈已提交，我们会尽快处理')
    setFeedbackModalOpen(false)
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Card>
        <Title level={3} style={{ marginBottom: 24 }}>
          业务知识问答
        </Title>
        
        <ChatBox 
          messages={messages} 
          loading={loading}
          onFeedback={handleFeedback}
        />

        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <TextArea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="请输入您的问题..."
            autoSize={{ minRows: 2, maxRows: 4 }}
            onPressEnter={e => {
              if (!e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
          />
          <Button 
            type="primary" 
            icon={<SendOutlined />}
            onClick={handleSubmit}
            loading={loading}
            style={{ height: 'auto' }}
          >
            发送
          </Button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Spin tip="正在思考中..." />
          </div>
        )}
      </Card>

      <FeedbackModal
        open={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        onSubmit={handleFeedbackSubmit}
      />
    </div>
  )
}

export default Home
