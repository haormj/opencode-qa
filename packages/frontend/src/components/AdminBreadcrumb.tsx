import { useLocation } from 'react-router-dom'
import './AdminBreadcrumb.css'

const breadcrumbMap: Record<string, { title: string; parent?: string }> = {
  '/admin/sessions': { title: '会话管理' },
  '/admin/users': { title: '用户管理' },
  '/admin/bots': { title: '机器人管理' },
  '/admin/assistants': { title: '助手管理' },
  '/admin/skills': { title: '技能列表', parent: '/admin/skills-menu' },
  '/admin/skills-menu': { title: '技能管理' },
  '/admin/skills/categories': { title: '技能分类', parent: '/admin/skills-menu' },
  '/admin/skill-versions': { title: '技能版本', parent: '/admin/skills-menu' },
  '/admin/statistics': { title: '数据统计' },
  '/admin/statistics/overview': { title: '概览', parent: '/admin/statistics' },
  '/admin/settings': { title: '系统设置' },
  '/admin/settings/system': { title: '系统配置', parent: '/admin/settings' },
  '/admin/settings/sso': { title: '统一登录', parent: '/admin/settings' },
  '/admin/tasks': { title: '任务列表', parent: '/admin/task-management' },
  '/admin/task-executions': { title: '执行记录', parent: '/admin/task-management' },
}

const taskManagementTitle = '任务管理'

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

    if (pathname.startsWith('/admin/skill-versions/') && pathname !== '/admin/skill-versions') {
      items.push({ title: '技能管理' })
      items.push({ title: '技能版本', path: '/admin/skill-versions' })
      items.push({ title: '版本详情' })
      return items
    }

    if (pathname.startsWith('/admin/skills/') && pathname !== '/admin/skills' && !pathname.includes('/categories')) {
      items.push({ title: '技能管理' })
      items.push({ title: '技能列表', path: '/admin/skills' })
      items.push({ title: '技能详情' })
      return items
    }

    if (pathname.startsWith('/admin/executions/') && pathname !== '/admin/executions') {
      items.push({ title: taskManagementTitle })
      items.push({ title: '执行记录', path: '/admin/task-executions' })
      items.push({ title: '执行详情' })
      return items
    }

    if (pathname.startsWith('/admin/tasks/') && pathname !== '/admin/tasks') {
      items.push({ title: taskManagementTitle })
      items.push({ title: '任务列表', path: '/admin/tasks' })
      
      if (pathname.endsWith('/edit')) {
        items.push({ title: '任务编辑' })
      } else if (pathname.endsWith('/executions')) {
        items.push({ title: '执行记录', path: '/admin/task-executions' })
      } else if (pathname.endsWith('/create')) {
        items.push({ title: '新建任务' })
      } else {
        items.push({ title: '任务详情' })
      }
      return items
    }

    const config = breadcrumbMap[pathname]
    if (!config) return items

    if (config.parent) {
      const parentConfig = breadcrumbMap[config.parent]
      if (parentConfig) {
        items.push({ title: parentConfig.title, path: config.parent })
      } else if (config.parent === '/admin/task-management') {
        items.push({ title: taskManagementTitle })
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
