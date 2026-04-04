import { List, Avatar, Typography, Button, Empty, Spin } from 'antd'
import { UserOutlined, RobotOutlined, DislikeOutlined } from '@ant-design/icons'
import type { QuestionResponse } from '../services/api'

const { Paragraph } = Typography

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  questionData?: QuestionResponse
}

interface ChatBoxProps {
  messages: Message[]
  loading: boolean
  onFeedback: (questionId: number) => void
}

function ChatBox({ messages, loading, onFeedback }: ChatBoxProps) {
  if (messages.length === 0 && !loading) {
    return (
      <Empty
        description="开始提问吧"
        style={{ padding: '40px 0' }}
      />
    )
  }

  return (
    <div style={{ maxHeight: 500, overflowY: 'auto', marginBottom: 16 }}>
      <List
        dataSource={messages}
        renderItem={(item) => (
          <List.Item style={{ border: 'none' }}>
            <List.Item.Meta
              avatar={
                <Avatar 
                  icon={item.type === 'user' ? <UserOutlined /> : <RobotOutlined />}
                  style={{ backgroundColor: item.type === 'user' ? '#1890ff' : '#52c41a' }}
                />
              }
              title={item.type === 'user' ? '我' : 'OpenCode'}
              description={
                <div>
                  <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>
                    {item.content}
                  </Paragraph>
                  {item.type === 'assistant' && item.questionData && (
                    <Button 
                      type="text" 
                      size="small"
                      icon={<DislikeOutlined />}
                      onClick={() => onFeedback(item.questionData!.id)}
                    >
                      未解决？提交反馈
                    </Button>
                  )}
                </div>
              }
            />
          </List.Item>
        )}
      />
      {loading && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin />
        </div>
      )}
    </div>
  )
}

export default ChatBox
