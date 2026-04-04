import { useNavigate, useLocation } from 'react-router-dom'
import { Menu } from 'antd'
import { MessageOutlined, UserOutlined, BarChartOutlined } from '@ant-design/icons'
import UserInfo from '../Sidebar/UserInfo'
import './AdminSidebar.css'

function AdminSidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    {
      key: '/admin/sessions',
      icon: <MessageOutlined />,
      label: '会话管理'
    },
    {
      key: '/admin/users',
      icon: <UserOutlined />,
      label: '用户管理'
    },
    {
      key: '/admin/statistics',
      icon: <BarChartOutlined />,
      label: '数据统计'
    }
  ]

  const getSelectedKey = () => {
    const pathname = location.pathname
    if (pathname.startsWith('/admin/sessions')) return '/admin/sessions'
    if (pathname.startsWith('/admin/users')) return '/admin/users'
    if (pathname.startsWith('/admin/statistics')) return '/admin/statistics'
    return pathname
  }

  return (
    <div className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <span className="brand-text">OpenCode QA Admin</span>
      </div>

      <div className="admin-sidebar-menu">
        <Menu
          mode="inline"
          selectedKeys={[getSelectedKey()]}
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
