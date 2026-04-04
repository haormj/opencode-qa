import { useLocation } from 'react-router-dom'
import './AdminHeader.css'

function AdminHeader() {
  const location = useLocation()

  const getTitle = (pathname: string): string | null => {
    if (pathname.startsWith('/admin/statistics/overview')) return '概览'
    return null
  }

  const title = getTitle(location.pathname)

  return (
    <div className="admin-header">
      <div className="admin-header-left">
        {title && <span className="admin-header-title">{title}</span>}
      </div>
      <div className="admin-header-content">
      </div>
      <div className="admin-header-right">
      </div>
    </div>
  )
}

export default AdminHeader
