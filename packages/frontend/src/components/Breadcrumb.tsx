import type { Assistant } from '../services/api'
import './Breadcrumb.css'

interface BreadcrumbProps {
  assistantId: string | null
  assistants: Assistant[]
  mode?: 'chat' | 'skill'
  skillPathname?: string
}

interface BreadcrumbResult {
  root: string | null
  first: string
  second: string | null
  third?: string | null
}

function Breadcrumb({ assistantId, assistants, mode = 'chat', skillPathname }: BreadcrumbProps) {
  if (mode === 'skill') {
    const getSkillBreadcrumb = (): BreadcrumbResult => {
      if (!skillPathname) return { root: '技能市场', first: '全部技能', second: null }
      
      if (skillPathname === '/skills' || skillPathname === '/skills/') {
        return { root: '技能市场', first: '全部技能', second: null }
      }
      if (skillPathname === '/skills/publish') {
        return { root: '技能市场', first: '我的技能', second: '发布技能' }
      }
      
      if (skillPathname === '/skills/my/published') {
        return { root: '技能市场', first: '我的技能', second: '技能列表' }
      }
      if (skillPathname === '/skills/my/versions') {
        return { root: '技能市场', first: '我的技能', second: '技能版本' }
      }
      if (skillPathname === '/skills/my/favorites') {
        return { root: '技能市场', first: '我的收藏', second: null }
      }
      
      const mySkillMatch = skillPathname.match(/^\/skills\/my\/([^/]+)$/)
      if (mySkillMatch) {
        return { root: '技能市场', first: '我的技能', second: '技能列表', third: '技能详情' }
      }
      const versionDetailMatch = skillPathname.match(/^\/skills\/my\/versions\/[^/]+$/)
      if (versionDetailMatch) {
        return { root: '技能市场', first: '我的技能', second: '技能版本', third: '版本详情' }
      }
      
      if (skillPathname.match(/^\/skills\/update\/[^/]+$/)) {
        return { root: '技能市场', first: '我的技能', second: '更新技能' }
      }
      
      const slugMatch = skillPathname.match(/^\/skills\/([^/]+)$/)
      if (slugMatch) {
        return { root: '技能市场', first: '全部技能', second: '技能详情' }
      }
      
      return { root: '技能市场', first: '全部技能', second: null }
    }
    
    const { root, first, second, third } = getSkillBreadcrumb()
    
    return (
      <div className="breadcrumb-container">
        {root && (
          <>
            <span className="breadcrumb-item">{root}</span>
            <span className="breadcrumb-separator">/</span>
          </>
        )}
        <span className="breadcrumb-item">{first}</span>
        {second && (
          <>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-item">{second}</span>
          </>
        )}
        {third && (
          <>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{third}</span>
          </>
        )}
      </div>
    )
  }

  const currentAssistant = assistants.find(a => a.id === assistantId)

  return (
    <div className="breadcrumb-container">
      <span className="breadcrumb-item">智能助手</span>
      {currentAssistant && (
        <>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{currentAssistant.name}</span>
        </>
      )}
    </div>
  )
}

export default Breadcrumb
