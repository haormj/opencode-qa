import { Button, Tooltip } from 'antd'
import { LinkOutlined, UserSwitchOutlined } from '@ant-design/icons'
import UserInfo from '../Sidebar/UserInfo'
import './UserHeader.css'

interface UserHeaderProps {
  sessionId?: string
  sessionStatus?: string
  onCopyLink?: () => void
  onMarkNeedHuman?: () => void
  assistantSelector?: React.ReactNode
}

function UserHeader({ 
  sessionId,
  sessionStatus = 'active',
  onCopyLink,
  onMarkNeedHuman,
  assistantSelector
}: UserHeaderProps) {
  const isHuman = sessionStatus === 'human'
  const isClosed = sessionStatus === 'closed'
  const showActions = sessionId

  return (
    <div className="user-header">
      <div className="user-header-left">
        {assistantSelector}
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
