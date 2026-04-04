import { useState } from 'react'
import { Button, Tooltip } from 'antd'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import SessionList from './SessionList'
import './Sidebar.css'

interface SidebarProps {
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
  refreshTrigger?: number
}

function Sidebar({ currentSessionId, onSelectSession, onNewSession, refreshTrigger }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && <span className="sidebar-title">会话列表</span>}
        <Tooltip title={collapsed ? '展开' : '收起'} placement="right">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
        </Tooltip>
      </div>
      
      {!collapsed && (
        <SessionList
          currentSessionId={currentSessionId}
          onSelectSession={onSelectSession}
          onNewSession={onNewSession}
          refreshTrigger={refreshTrigger}
        />
      )}
    </div>
  )
}

export default Sidebar
