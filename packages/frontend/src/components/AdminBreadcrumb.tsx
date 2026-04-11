import { useLocation } from 'react-router-dom'
import './AdminBreadcrumb.css'

const breadcrumbMap: Record<string, { title: string; parent?: string }> = {
  '/admin/sessions': { title: '会话管理' },
  '/admin/users': { title: '用户管理' },
  '/admin/bots': { title: '机器人管理' },
  '/admin/assistants': { title: '助手管理' },
  '/admin/statistics': { title: '数据统计' },
  '/admin/statistics/overview': { title: '概览', parent: '/admin/statistics' },
  '/admin/settings': { title: '系统设置' },
  '/admin/settings/system': { title: '系统配置', parent: '/admin/settings' },
  '/admin/settings/sso': { title: '统一登录', parent: '/admin/settings' },
}

function AdminBreadcrumb() {
  const location = useLocation()
  const pathname = location.pathname

  const getBreadcrumbItems = () => {
    const items: { title: string; path?: string }[] = []
    
    if (pathname.startsWith('/admin/sessions/') && pathname !== '/admin/sessions') {
      items.push({ title: '会话管理', path: '/admin/sessions' })
      items.push({ title: '会话详情' })
      return items
    }

    const config = breadcrumbMap[pathname]
    if (!config) return items

    if (config.parent) {
      const parentConfig = breadcrumbMap[config.parent]
      if (parentConfig) {
        items.push({ title: parentConfig.title, path: config.parent })
      }
    }
    items.push({ title: config.title })

    return items
  }

  const items = getBreadcrumbItems()

  if (items.length === 0) return null

  return (
    <div className="admin-breadcrumb-container">
      {items.map((item, index) => (
        <span key={index}>
          {index > 0 && <span className="admin-breadcrumb-separator">/</span>}
          <span className={index === items.length - 1 ? 'admin-breadcrumb-current' : 'admin-breadcrumb-item'}>
            {item.title}
          </span>
        </span>
      ))}
    </div>
  )
}

export default AdminBreadcrumb
