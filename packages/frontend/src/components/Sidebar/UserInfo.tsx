import { useNavigate } from 'react-router-dom'
import { Dropdown, Space, Avatar } from 'antd'
import { UserOutlined, SettingOutlined, LogoutOutlined } from '@ant-design/icons'
import { getStoredUser, isAdmin, logout, generateAvatarColor } from '../../services/api'

interface UserInfoProps {
  collapsed: boolean
  isAdminPage?: boolean
}

function UserInfo({ collapsed, isAdminPage = false }: UserInfoProps) {
  const navigate = useNavigate()
  const user = getStoredUser()
  const username = user?.displayName || user?.username || '用户'
  const initial = username.charAt(0).toUpperCase()
  const bgColor = generateAvatarColor(username)

  const menuItems = []

  if (isAdminPage) {
    menuItems.push({
      key: 'user-side',
      icon: <UserOutlined />,
      label: '返回用户侧',
      onClick: () => navigate('/')
    })
  } else if (isAdmin()) {
    menuItems.push({
      key: 'admin',
      icon: <SettingOutlined />,
      label: '管理后台',
      onClick: () => navigate('/admin')
    })
  }

  menuItems.push({
    key: 'logout',
    icon: <LogoutOutlined />,
    label: '退出登录',
    onClick: () => {
      logout()
    }
  })

  return (
    <div className="user-info">
      <Dropdown menu={{ items: menuItems }} placement="topRight" disabled={collapsed}>
        <Space className="user-info-content">
          <Avatar
            size="small"
            style={{ backgroundColor: bgColor }}
            icon={<UserOutlined />}
          >
            {initial}
          </Avatar>
          {!collapsed && <span className="user-name">{username}</span>}
        </Space>
      </Dropdown>
    </div>
  )
}

export default UserInfo
