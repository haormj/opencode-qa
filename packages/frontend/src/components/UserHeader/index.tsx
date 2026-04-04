import { Button, Tooltip } from 'antd'
import { MenuFoldOutlined, MenuUnfoldOutlined, LinkOutlined, UserSwitchOutlined } from '@ant-design/icons'
import UserInfo from '../Sidebar/UserInfo'
import './UserHeader.css'

interface UserHeaderProps {
  sessionTitle: string
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  sessionId?: string
  sessionStatus?: string
  onCopyLink?: () => void
  onMarkNeedHuman?: () => void
}

function UserHeader({ 
  sessionTitle, 
  sidebarCollapsed, 
  onToggleSidebar,
  sessionId,
  sessionStatus = 'active',
  onCopyLink,
  onMarkNeedHuman
}: UserHeaderProps) {
  const isHuman = sessionStatus === 'human'
  const isClosed = sessionStatus === 'closed'
  const showActions = sessionId && sessionTitle

  const truncateTitle = (title: string, maxLen: number = 20) => {
    if (title.length <= maxLen) return title
    return title.slice(0, maxLen) + '...'
  }

  const displayTitle = sessionTitle || '新对话'
  const truncatedTitle = truncateTitle(displayTitle)

  return (
    <div className="user-header">
      <div className="user-header-left">
        <Tooltip title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}>
          <Button
            type="text"
            className="sidebar-toggle-btn"
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={onToggleSidebar}
          />
        </Tooltip>
      </div>
      <div className="user-header-content">
        <Tooltip title={displayTitle !== truncatedTitle ? displayTitle : ''}>
          <h2 className="user-header-title">{truncatedTitle}</h2>
        </Tooltip>
        <p className="user-header-subtitle">由 OpenCode AI 生成</p>
      </div>
      <div className="user-header-right">
        {showActions && (
          <>
            <Tooltip title="复制会话链接">
              <Button 
                type="text"
                icon={<LinkOutlined />}
                onClick={onCopyLink}
              >
                复制链接
              </Button>
            </Tooltip>
            {!isClosed && (
              <Tooltip title={isHuman ? '可以点击复制链接发给支撑人员进一步定位' : '点击之后，AI将不再回复消息，可以点击复制链接发给支撑人员进一步定位'}>
                <Button 
                  type="primary"
                  danger
                  icon={<UserSwitchOutlined />}
                  onClick={onMarkNeedHuman}
                  disabled={isHuman}
                >
                  人工
                </Button>
              </Tooltip>
            )}
          </>
        )}
        <UserInfo collapsed={false} />
      </div>
    </div>
  )
}

export default UserHeader
