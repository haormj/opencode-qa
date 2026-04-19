import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu } from 'antd'
import { MessageOutlined, UserOutlined, BarChartOutlined, RobotOutlined, SettingOutlined, AppstoreOutlined, ToolOutlined, ScheduleOutlined } from '@ant-design/icons'
import { getPublicSettings } from '../../services/api'
import './AdminSidebar.css'

function AdminSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [adminTitle, setAdminTitle] = useState('OpenCode QA Admin')

  useEffect(() => {
    getPublicSettings().then(settings => {
      if (settings['site.adminTitle']) {
        setAdminTitle(settings['site.adminTitle'])
      }
    }).catch(() => {})
  }, [])

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
      key: '/admin/assistants',
      icon: <AppstoreOutlined />,
      label: '助手管理'
    },
    {
      key: '/admin/tasks-menu',
      icon: <ScheduleOutlined />,
      label: '任务管理',
      children: [
        {
          key: '/admin/tasks',
          label: '任务列表'
        },
        {
          key: '/admin/task-executions',
          label: '执行记录'
        }
      ]
    },
    {
      key: '/admin/skills-menu',
      icon: <ToolOutlined />,
      label: '技能管理',
      children: [
        {
          key: '/admin/skills',
          label: '技能列表'
        },
        {
          key: '/admin/skill-versions',
          label: '技能版本'
        }
      ]
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
          key: '/admin/settings/system',
          label: '系统配置'
        },
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
    if (pathname.startsWith('/admin/assistants')) return '/admin/assistants'
    if (pathname.startsWith('/admin/task-executions')) return '/admin/task-executions'
    if (pathname.startsWith('/admin/tasks')) return '/admin/tasks'
    if (pathname === '/admin/skills/categories') return '/admin/skills/categories'
    if (pathname.startsWith('/admin/skill-versions')) return '/admin/skill-versions'
    if (pathname.startsWith('/admin/skills')) return '/admin/skills'
    if (pathname.startsWith('/admin/statistics/overview')) return '/admin/statistics/overview'
    if (pathname.startsWith('/admin/settings/system')) return '/admin/settings/system'
    if (pathname.startsWith('/admin/settings/sso')) return '/admin/settings/sso'
    return pathname
  }

  const getOpenKeys = () => {
    const pathname = location.pathname
    const openKeys = []
    if (pathname.startsWith('/admin/tasks') || pathname.startsWith('/admin/task-executions')) openKeys.push('/admin/tasks-menu')
    if (pathname.startsWith('/admin/skills') || pathname.startsWith('/admin/skill-versions')) openKeys.push('/admin/skills-menu')
    if (pathname.startsWith('/admin/statistics')) openKeys.push('/admin/statistics')
    if (pathname.startsWith('/admin/settings')) openKeys.push('/admin/settings')
    return openKeys
  }

  return (
    <div className="admin-sidebar">
      <div className="admin-sidebar-brand" onClick={() => navigate('/admin/sessions')}>
        <span className="brand-text">{adminTitle}</span>
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
