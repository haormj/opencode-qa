import { useNavigate, useLocation } from 'react-router-dom'
import { Menu } from 'antd'
import { MessageOutlined } from '@ant-design/icons'
import UserInfo from '../Sidebar/UserInfo'
import './AdminSidebar.css'

function AdminSidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    {
      key: '/admin',
      icon: <MessageOutlined />,
      label: '会话管理'
    }
  ]

  return (
    <div className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <span className="brand-text">OpenCode QA Admin</span>
      </div>

      <div className="admin-sidebar-menu">
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none', background: 'transparent' }}
        />
      </div>

      <UserInfo collapsed={false} />
    </div>
  )
}

export default AdminSidebar
