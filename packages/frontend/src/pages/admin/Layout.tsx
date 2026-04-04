import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Button, Avatar, Dropdown, Space } from 'antd'
import { MessageOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons'
import { logout, getStoredUser, isAdmin } from '../../services/api'
import { useEffect, useState } from 'react'

const { Header, Sider, Content } = Layout

function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(getStoredUser())

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/login', { state: { from: location.pathname } })
    }
  }, [navigate, location.pathname])

  const handleLogout = () => {
    logout()
  }

  const menuItems = [
    {
      key: '/admin',
      icon: <MessageOutlined />,
      label: '会话管理'
    }
  ]

  const userMenuItems = [
    {
      key: 'home',
      icon: <UserOutlined />,
      label: '返回用户界面',
      onClick: () => navigate('/')
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout
    }
  ]

  return (
    <Layout className="admin-layout">
      <Sider width={200} className="admin-sider">
        <div className="admin-logo">
          <h2>OpenCode QA</h2>
          <span>管理后台</span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header className="admin-header">
          <div className="admin-header-right">
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space className="admin-user-info">
                <Avatar icon={<UserOutlined />} />
                <span>{user?.displayName || '管理员'}</span>
              </Space>
            </Dropdown>
          </div>
        </Header>
        <Content className="admin-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default AdminLayout
