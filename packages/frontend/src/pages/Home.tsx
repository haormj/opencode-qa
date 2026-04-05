import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { message } from 'antd'
import Sidebar from '../components/Sidebar'
import UserHeader from '../components/UserHeader'
import ChatBox, { type ExtendedMessageProps } from '../components/ChatBox'
import { sendMessageStream, sendHumanMessage, getSession, updateSessionStatus, getUsername, generateAvatarColor, type MessageItem } from '../services/api'
import type { Session } from '../services/api'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'
import { mermaid } from '@streamdown/mermaid'
import { math } from '@streamdown/math'
import { cjk } from '@streamdown/cjk'
import './Home.css'

const MERMAID_TEST = `
## Mermaid 测试

### 流程图

\`\`\`mermaid
graph TD
    A[开始] --> B{判断}
    B -->|是| C[执行]
    B -->|否| D[跳过]
    C --> E[结束]
    D --> E
\`\`\`

### 时序图

\`\`\`mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant B as 后端
    U->>F: 输入问题
    F->>B: POST /api/stream
    B-->>F: SSE 响应
    F-->>U: 显示回复
\`\`\`
`

const TEST_MARKDOWN = `
# Markdown 完整测试

## 文本格式

普通文本，**粗体**，*斜体*，~~删除线~~，\`行内代码\`。

---

## 标题层级

# H1 标题
## H2 标题
### H3 标题
#### H4 标题
##### H5 标题
###### H6 标题

---

## 列表

### 无序列表
- 项目 1
- 项目 2
  - 嵌套项目 2.1
  - 嵌套项目 2.2
- 项目 3

### 有序列表
1. 第一步
2. 第二步
3. 第三步

---

## 代码块

\`\`\`typescript
interface User {
  id: string
  name: string
}

async function fetchUser(id: string): Promise<User> {
  return await fetch(\`/api/users/\${id}\`).then(r => r.json())
}
\`\`\`

\`\`\`python
def fibonacci(n: int) -> list[int]:
    if n <= 0: return []
    if n == 1: return [0]
    seq = [0, 1]
    for i in range(2, n):
        seq.append(seq[i-1] + seq[i-2])
    return seq
\`\`\`

---

## Mermaid 流程图

\`\`\`mermaid
graph TD
    A[开始] --> B{判断}
    B -->|是| C[执行]
    B -->|否| D[跳过]
    C --> E[结束]
    D --> E
\`\`\`

\`\`\`mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant B as 后端
    U->>F: 输入问题
    F->>B: POST /api/stream
    B-->>F: SSE 响应
    F-->>U: 显示回复
\`\`\`

---

## 表格

| 功能 | 状态 | 说明 |
|:-----|:----:|-----:|
| Markdown | ✅ | 已支持 |
| 代码高亮 | ✅ | Shiki |
| Mermaid | ✅ | 图表 |
| 数学公式 | ✅ | KaTeX |

---

## 引用块

> 这是一段引用。
> 
> 可以多行。

---

## 数学公式

行内：$E = mc^2$

块级：

$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$

---

## 链接

[OpenCode QA](https://github.com/haormj/opencode-qa)
`

function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sessionId = searchParams.get('sessionId')
  const isTestMode = searchParams.get('test') === 'true'

  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ExtendedMessageProps[]>([])
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionStatus, setSessionStatus] = useState<string>('active')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const notFoundRef = useRef(false)

  const handleSessionsLoad = useCallback((loadedSessions: Session[]) => {
    setSessions(loadedSessions)
  }, [])

  const currentSessionTitle = useMemo(() => {
    if (!sessionId) return '新对话'
    const session = sessions.find(s => s.id === sessionId)
    return session?.title || '新对话'
  }, [sessionId, sessions])

  useEffect(() => {
    if (isTestMode) {
      const testMessages: ExtendedMessageProps[] = [
        {
          _id: 'test-user',
          type: 'text',
          content: { text: '请展示完整的 Markdown 测试内容' },
          position: 'right',
          sender: { name: '测试用户', color: '#1890ff', type: 'user' }
        },
        {
          _id: 'test-ai',
          type: 'text',
          content: { text: TEST_MARKDOWN },
          position: 'left',
          sender: { name: 'AI 助手 (ChatBox 渲染)', color: '#52c41a', type: 'ai' }
        },
        {
          _id: 'test-native',
          type: 'text',
          content: { text: MERMAID_TEST },
          position: 'left',
          sender: { name: '原生 Streamdown 渲染', color: '#722ed1', type: 'ai' }
        }
      ]
      setMessages(testMessages)
      setLoading(false)
      return
    }
    
    if (sessionId) {
      loadSession(sessionId)
    } else {
      setMessages([])
      setSessionStatus('active')
    }
  }, [sessionId, isTestMode])

  const loadSession = async (id: string) => {
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
          }
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
  }

  const handleSend = useCallback((_type: string, text: string) => {
    if (!text.trim()) {
      message.warning('请输入问题')
      return
    }

    if (isTestMode) {
      const userMessage: ExtendedMessageProps = {
        _id: Date.now().toString(),
        type: 'text',
        content: { text },
        position: 'right',
        sender: { name: '测试用户', color: '#1890ff', type: 'user' }
      }
      setMessages(prev => [...prev, userMessage])
      
      setTimeout(() => {
        const aiMessage: ExtendedMessageProps = {
          _id: (Date.now() + 1).toString(),
          type: 'text',
          content: { text: `**测试模式回复**\n\n你发送的内容是：\n\n> ${text}\n\n支持 **粗体**、*斜体*、\`代码\` 等格式。` },
          position: 'left',
          sender: { name: 'AI 助手', color: '#52c41a', type: 'ai' }
        }
        setMessages(prev => [...prev, aiMessage])
      }, 500)
      return
    }

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

    if (sessionStatus === 'human' && sessionId) {
      setMessages(prev => [...prev, userMessage])
      
      sendHumanMessage(text, sessionId)
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

    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage: ExtendedMessageProps = {
      _id: assistantMessageId,
      type: 'typing',
      content: { text: '' },
      position: 'left',
      sender: {
        name: 'AI 助手',
        color: '#52c41a',
        type: 'ai'
      }
    }

    setMessages(prev => [...prev, userMessage, assistantMessage])
    setLoading(true)

    let isFirstChunk = true
    sendMessageStream(
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
                content: { text: result.content }
              }
            : msg
        ))
        setLoading(false)
      },
      (error) => {
        console.error('Stream error:', error)
        const errorMessage = error instanceof Error ? error.message : '提问失败，请稍后重试'
        if (errorMessage.includes('Session has been closed') || errorMessage.includes('session has been closed')) {
          message.error('会话已关闭（超过24小时未活动），请新建会话')
          setSessionStatus('closed')
        } else {
          message.error(errorMessage)
        }
        setMessages(prev => prev.filter(msg => msg._id !== assistantMessageId))
        setLoading(false)
      }
    )
  }, [sessionId, sessionStatus, setSearchParams])

  const handleCopyLink = useCallback(() => {
    if (!sessionId) return
    const link = `${window.location.origin}/session/${sessionId}`
    navigator.clipboard.writeText(link)
    message.success('会话链接已复制')
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
  }

  const handleNewSession = () => {
    setSearchParams({})
    setMessages([])
    setSessionStatus('active')
  }

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev)
  }, [])

  return (
    <div className="home-layout">
      <Sidebar
        currentSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        refreshTrigger={refreshTrigger}
        onSessionsLoad={handleSessionsLoad}
        collapsed={sidebarCollapsed}
      />
      <div className="home-content">
        <UserHeader
          sessionTitle={currentSessionTitle}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          sessionId={sessionId || undefined}
          sessionStatus={sessionStatus}
          onCopyLink={handleCopyLink}
          onMarkNeedHuman={handleMarkNeedHuman}
        />
        <div className="home-content-body">
          <ChatBox
            messages={messages}
            typing={loading}
            onSend={handleSend}
            sessionStatus={sessionStatus}
          />
          {isTestMode && (
            <div style={{ 
              padding: '20px', 
              borderTop: '2px solid #722ed1',
              background: '#fff',
              maxHeight: '50vh',
              overflow: 'auto'
            }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#722ed1' }}>
                🔬 原生 Streamdown 渲染（无 ChatBox 包装）
              </h3>
              <Streamdown plugins={{ code, mermaid, math, cjk }}>
                {MERMAID_TEST}
              </Streamdown>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Home
