import { useNavigate, useLocation } from 'react-router-dom'
import { Menu } from 'antd'
import { MessageOutlined, UserOutlined, BarChartOutlined, RobotOutlined, SettingOutlined } from '@ant-design/icons'
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
      key: '/admin/bots',
      icon: <RobotOutlined />,
      label: '机器人管理'
    },
    {
      key: '/admin/statistics',
      icon: <BarChartOutlined />,
      label: '数据统计',
      children: [
        {
          key: '/admin/statistics/overview',
          label: '概览'
        }
      ]
    },
    {
      key: '/admin/settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      children: [
        {
          key: '/admin/settings/sso',
          label: '统一登录'
        }
      ]
    }
  ]

  const getSelectedKey = () => {
    const pathname = location.pathname
    if (pathname.startsWith('/admin/sessions')) return '/admin/sessions'
    if (pathname.startsWith('/admin/users')) return '/admin/users'
    if (pathname.startsWith('/admin/bots')) return '/admin/bots'
    if (pathname.startsWith('/admin/statistics/overview')) return '/admin/statistics/overview'
    if (pathname.startsWith('/admin/settings/sso')) return '/admin/settings/sso'
    return pathname
  }

  const getOpenKeys = () => {
    const pathname = location.pathname
    const openKeys = []
    if (pathname.startsWith('/admin/statistics')) openKeys.push('/admin/statistics')
    if (pathname.startsWith('/admin/settings')) openKeys.push('/admin/settings')
    return openKeys
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
          defaultOpenKeys={getOpenKeys()}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none', background: 'transparent' }}
        />
      </div>
    </div>
  )
}

export default AdminSidebar
