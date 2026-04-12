import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button, Tooltip } from 'antd'
import { PlusOutlined, AppstoreOutlined, FileTextOutlined, StarOutlined, DownOutlined, RightOutlined } from '@ant-design/icons'
import SessionList from './SessionList'
import type { Session } from '../../services/api'
import { getPublicSettings } from '../../services/api'
import './Sidebar.css'

interface SidebarProps {
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
  refreshTrigger?: number
  onSessionsLoad?: (sessions: Session[]) => void
  assistantId?: string | null
  mode?: 'chat' | 'skill'
}

interface MenuItem {
  key: string
  label: string
  icon: React.ReactNode
  children?: { key: string; label: string }[]
}

const skillMenuItems: MenuItem[] = [
  { key: '/skills', label: '全部技能', icon: <AppstoreOutlined /> },
  { 
    key: '/skills/my', 
    label: '我的技能', 
    icon: <FileTextOutlined />,
    children: [
      { key: '/skills/publish', label: '发布技能' },
      { key: '/skills/my/published', label: '技能列表' },
      { key: '/skills/my/versions', label: '技能版本' }
    ]
  },
  { key: '/skills/my/favorites', label: '我的收藏', icon: <StarOutlined /> },
]

function Sidebar({ 
  currentSessionId, 
  onSelectSession, 
  onNewSession, 
  refreshTrigger, 
  onSessionsLoad, 
  assistantId,
  mode = 'chat'
}: SidebarProps) {
  const [siteTitle, setSiteTitle] = useState('OpenCode QA')
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['/skills/my'])
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    getPublicSettings().then(settings => {
      if (settings['site.title']) {
        setSiteTitle(settings['site.title'])
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const matchedParent = skillMenuItems.find(item => 
      item.children?.some(child => location.pathname === child.key)
    )
    if (matchedParent && !expandedKeys.includes(matchedParent.key)) {
      setExpandedKeys(prev => [...prev, matchedParent.key])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const isSkillMenuItemActive = (key: string) => {
    return location.pathname === key || location.pathname.startsWith(key + '/')
  }

  const isMenuItemOrChildActive = (item: MenuItem) => {
    if (isSkillMenuItemActive(item.key)) return true
    if (item.children) {
      return item.children.some(child => location.pathname === child.key)
    }
    return false
  }

  const handleSkillMenuClick = (key: string, hasChildren: boolean) => {
    if (hasChildren) {
      setExpandedKeys(prev => 
        prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      )
    } else {
      navigate(key)
    }
  }

  const renderMenuItem = (item: MenuItem) => {
    const isActive = isSkillMenuItemActive(item.key) || isMenuItemOrChildActive(item)
    const isExpanded = expandedKeys.includes(item.key)
    const hasChildren = item.children && item.children.length > 0

    return (
      <div key={item.key}>
        <div
          className={`session-item ${isActive && !hasChildren ? 'active' : ''}`}
          onClick={() => handleSkillMenuClick(item.key, hasChildren || false)}
        >
          <span className="session-icon">{item.icon}</span>
          <span className="session-title">{item.label}</span>
          {hasChildren && (
            <span className="session-expand-icon">
              {isExpanded ? <DownOutlined /> : <RightOutlined />}
            </span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="session-submenu">
            {item.children!.map(child => (
              <div
                key={child.key}
                className={`session-item session-submenu-item ${isSkillMenuItemActive(child.key) ? 'active' : ''}`}
                onClick={() => navigate(child.key)}
              >
                <span className="session-title">{child.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-text">{siteTitle}</span>
      </div>

      {mode === 'chat' && (
        <div className="sidebar-new-chat">
          <Tooltip title="新对话" placement="top">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={onNewSession}
              block
            >
              新对话
            </Button>
          </Tooltip>
        </div>
      )}

      {mode === 'chat' ? (
        <SessionList
          currentSessionId={currentSessionId}
          onSelectSession={onSelectSession}
          onNewSession={onNewSession}
          refreshTrigger={refreshTrigger}
          onSessionsLoad={onSessionsLoad}
          assistantId={assistantId}
        />
      ) : (
        <div className="session-list">
          <div className="session-list-content">
            {skillMenuItems.map(renderMenuItem)}
          </div>
        </div>
      )}
    </div>
  )
}

export default Sidebar
