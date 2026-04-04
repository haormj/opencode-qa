import { useEffect, useState } from 'react'
import { Empty, Spin, message } from 'antd'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/styles/overlayscrollbars.css'
import SessionItem from './SessionItem'
import { getSessions, deleteSession, updateSessionTitle } from '../../services/api'
import type { Session } from '../../services/api'

interface SessionListProps {
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
  refreshTrigger?: number
  collapsed?: boolean
  onSessionsLoad?: (sessions: Session[]) => void
}

function SessionList({ currentSessionId, onSelectSession, onNewSession, refreshTrigger, collapsed, onSessionsLoad }: SessionListProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSessions = async () => {
    try {
      const data = await getSessions()
      setSessions(data)
      onSessionsLoad?.(data)
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
      const updatedSessions = sessions.map(s => 
        s.id === sessionId ? { ...s, title } : s
      )
      setSessions(updatedSessions)
      onSessionsLoad?.(updatedSessions)
      message.success('标题已更新')
    } catch {
      message.error('更新失败')
    }
  }

  return (
    <div className="session-list" style={{ display: collapsed ? 'none' : 'flex' }}>
      <OverlayScrollbarsComponent
        className="session-list-content"
        options={{
          scrollbars: {
            theme: 'os-theme-light',
            visibility: 'auto',
            autoHide: 'scroll',
            autoHideDelay: 800,
            dragScroll: true,
          },
        }}
      >
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
      </OverlayScrollbarsComponent>
    </div>
  )
}

export default SessionList
