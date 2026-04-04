import { useState } from 'react'
import { Button, Tooltip } from 'antd'
import { MenuFoldOutlined, MenuUnfoldOutlined, PlusOutlined } from '@ant-design/icons'
import SessionList from './SessionList'
import UserInfo from './UserInfo'
import type { Session } from '../../services/api'
import './Sidebar.css'

interface SidebarProps {
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
  refreshTrigger?: number
  onSessionsLoad?: (sessions: Session[]) => void
}

function Sidebar({ currentSessionId, onSelectSession, onNewSession, refreshTrigger, onSessionsLoad }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        {!collapsed && <span className="brand-text">OpenCode QA</span>}
        <Tooltip title={collapsed ? '展开' : '收起'} placement="right">
          <Button
            type="text"
            className="collapse-btn"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
        </Tooltip>
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

      <UserInfo collapsed={collapsed} />
    </div>
  )
}

export default Sidebar
