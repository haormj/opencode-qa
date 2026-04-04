import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import AdminSidebar from '../../components/AdminSidebar'
import { isAdmin } from '../../services/api'
import './Admin.css'

function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/login', { state: { from: location.pathname } })
    }
  }, [navigate, location.pathname])

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  )
}

export default AdminLayout
