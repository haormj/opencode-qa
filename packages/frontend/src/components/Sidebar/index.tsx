import { useState, useEffect } from 'react'
import { Button, Tooltip } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
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
  collapsed?: boolean
}

function Sidebar({ currentSessionId, onSelectSession, onNewSession, refreshTrigger, onSessionsLoad, collapsed = false }: SidebarProps) {
  const [siteTitle, setSiteTitle] = useState('OpenCode QA')

  useEffect(() => {
    getPublicSettings().then(settings => {
      if (settings['site.title']) {
        setSiteTitle(settings['site.title'])
      }
    }).catch(() => {})
  }, [])

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        {!collapsed && <span className="brand-text">{siteTitle}</span>}
      </div>

      <div className="sidebar-new-chat">
        <Tooltip title="新对话" placement={collapsed ? 'right' : 'top'}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onNewSession}
            block={!collapsed}
          >
            {!collapsed && '新对话'}
          </Button>
        </Tooltip>
      </div>

      <SessionList
        currentSessionId={currentSessionId}
        onSelectSession={onSelectSession}
        onNewSession={onNewSession}
        refreshTrigger={refreshTrigger}
        collapsed={collapsed}
        onSessionsLoad={onSessionsLoad}
      />
    </div>
  )
}

export default Sidebar
