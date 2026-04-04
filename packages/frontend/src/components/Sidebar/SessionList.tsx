import { useEffect, useState } from 'react'
import { Button, Empty, Spin, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import SessionItem from './SessionItem'
import { getSessions, deleteSession, updateSessionTitle } from '../../services/api'
import type { Session } from '../../services/api'
import './Sidebar.css'

interface SessionListProps {
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
  refreshTrigger?: number
}

function SessionList({ currentSessionId, onSelectSession, onNewSession, refreshTrigger }: SessionListProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSessions = async () => {
    try {
      const data = await getSessions()
      setSessions(data)
    } catch {
      message.error('获取会话列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [refreshTrigger])

  const handleDelete = async (sessionId: string) => {
    try {
      await deleteSession(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (currentSessionId === sessionId) {
        onNewSession()
      }
      message.success('会话已删除')
    } catch {
      message.error('删除失败')
    }
  }

  const handleRename = async (sessionId: string, title: string) => {
    try {
      await updateSessionTitle(sessionId, title)
      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, title } : s
      ))
      message.success('标题已更新')
    } catch {
      message.error('更新失败')
    }
  }

  return (
    <div className="session-list">
      <div className="session-list-header">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onNewSession}
          block
        >
          新建会话
        </Button>
      </div>
      
      <div className="session-list-content">
        {loading ? (
          <div className="session-list-loading">
            <Spin />
          </div>
        ) : sessions.length === 0 ? (
          <Empty description="暂无会话" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          sessions.map(session => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={session.id === currentSessionId}
              onClick={() => onSelectSession(session.id)}
              onDelete={() => handleDelete(session.id)}
              onRename={(title) => handleRename(session.id, title)}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default SessionList
