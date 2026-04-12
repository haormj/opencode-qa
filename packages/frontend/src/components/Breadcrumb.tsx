import type { Assistant } from '../services/api'
import './Breadcrumb.css'

interface BreadcrumbProps {
  assistantId: string | null
  assistants: Assistant[]
  mode?: 'chat' | 'skill'
  skillPathname?: string
}

function Breadcrumb({ assistantId, assistants, mode = 'chat', skillPathname }: BreadcrumbProps) {
  if (mode === 'skill') {
    const getSkillBreadcrumb = () => {
      if (!skillPathname) return { first: '技能市场', second: null }
      
      if (skillPathname === '/skills' || skillPathname === '/skills/') {
        return { first: '技能市场', second: null }
      }
      if (skillPathname === '/skills/publish') {
        return { first: '技能市场', second: '发布技能' }
      }
      if (skillPathname.match(/^\/skills\/update\/[^/]+$/)) {
        return { first: '技能市场', second: '更新技能' }
      }
      if (skillPathname === '/skills/my/published') {
        return { first: '技能市场', second: '我的技能' }
      }
      if (skillPathname === '/skills/my/favorites') {
        return { first: '技能市场', second: '我的收藏' }
      }
      
      const slugMatch = skillPathname.match(/^\/skills\/([^/]+)$/)
      if (slugMatch) {
        return { first: '技能市场', second: '技能详情' }
      }
      
      return { first: '技能市场', second: null }
    }
    
    const { first, second } = getSkillBreadcrumb()
    
    return (
      <div className="breadcrumb-container">
        <span className="breadcrumb-item">{first}</span>
        {second && (
          <>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{second}</span>
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
