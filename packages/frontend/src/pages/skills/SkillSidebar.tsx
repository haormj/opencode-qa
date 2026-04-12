import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from 'antd'
import { AppstoreOutlined, PlusOutlined, HeartOutlined, FileTextOutlined } from '@ant-design/icons'
import './SkillSidebar.css'

function SkillSidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    { key: '/skills', label: '技能市场', icon: <AppstoreOutlined /> },
    { key: '/skills/my/published', label: '我的技能', icon: <FileTextOutlined /> },
    { key: '/skills/my/favorites', label: '我的收藏', icon: <HeartOutlined /> },
  ]

  const isActive = (key: string) => {
    if (key === '/skills') {
      return location.pathname === '/skills' || location.pathname === '/skills/'
    }
    return location.pathname.startsWith(key)
  }

  return (
    <div className="skill-sidebar">
      <div className="skill-sidebar-menu">
        {menuItems.map(item => (
          <div
            key={item.key}
            className={`skill-sidebar-item ${isActive(item.key) ? 'active' : ''}`}
            onClick={() => navigate(item.key)}
          >
            {item.icon}
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <div className="skill-sidebar-publish">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          block
          onClick={() => navigate('/skills/publish')}
        >
          发布技能
        </Button>
      </div>
    </div>
  )
}

export default SkillSidebar