import { Button, Tooltip } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import SessionList from './SessionList'
import type { Session } from '../../services/api'
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
  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        {!collapsed && <span className="brand-text">OpenCode QA</span>}
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
