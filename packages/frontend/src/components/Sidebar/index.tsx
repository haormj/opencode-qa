import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button, Tooltip } from 'antd'
import { PlusOutlined, AppstoreOutlined, FileTextOutlined, HeartOutlined } from '@ant-design/icons'
import SessionList from './SessionList'
import type { Session } from '../../services/api'
import { getPublicSettings } from '../../services/api'
import './Sidebar.css'

interface SidebarProps {
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
  refreshTrigger?: number
  onSessionsLoad?: (sessions: Session[]) => void
  assistantId?: string | null
  mode?: 'chat' | 'skill'
}

const skillMenuItems = [
  { key: '/skills', label: '技能市场', icon: <AppstoreOutlined /> },
  { key: '/skills/my/published', label: '我的技能', icon: <FileTextOutlined /> },
  { key: '/skills/my/favorites', label: '我的收藏', icon: <HeartOutlined /> },
]

function Sidebar({ 
  currentSessionId, 
  onSelectSession, 
  onNewSession, 
  refreshTrigger, 
  onSessionsLoad, 
  assistantId,
  mode = 'chat'
}: SidebarProps) {
  const [siteTitle, setSiteTitle] = useState('OpenCode QA')
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    getPublicSettings().then(settings => {
      if (settings['site.title']) {
        setSiteTitle(settings['site.title'])
      }
    }).catch(() => {})
  }, [])

  const isSkillMenuItemActive = (key: string) => {
    if (key === '/skills') {
      return location.pathname === '/skills' || location.pathname === '/skills/'
    }
    return location.pathname.startsWith(key)
  }

  const handleSkillMenuClick = (key: string) => {
    navigate(key)
  }

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-text">{siteTitle}</span>
      </div>

      <div className="sidebar-new-chat">
        <Tooltip title={mode === 'chat' ? '新对话' : '发布技能'} placement="top">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={mode === 'chat' ? onNewSession : () => navigate('/skills/publish')}
            block
          >
            {mode === 'chat' ? '新对话' : '发布技能'}
          </Button>
        </Tooltip>
      </div>

      {mode === 'chat' ? (
        <SessionList
          currentSessionId={currentSessionId}
          onSelectSession={onSelectSession}
          onNewSession={onNewSession}
          refreshTrigger={refreshTrigger}
          onSessionsLoad={onSessionsLoad}
          assistantId={assistantId}
        />
      ) : (
        <div className="session-list">
          <div className="session-list-content">
            {skillMenuItems.map(item => (
              <div
                key={item.key}
                className={`session-item ${isSkillMenuItemActive(item.key) ? 'active' : ''}`}
                onClick={() => handleSkillMenuClick(item.key)}
              >
                <span className="session-icon">{item.icon}</span>
                <span className="session-title">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Sidebar
