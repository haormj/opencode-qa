import type { Assistant } from '../services/api'
import './Breadcrumb.css'

interface BreadcrumbProps {
  assistantId: string | null
  assistants: Assistant[]
}

function Breadcrumb({ assistantId, assistants }: BreadcrumbProps) {
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
