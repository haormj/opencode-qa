import UserInfo from '../Sidebar/UserInfo'
import './AdminHeader.css'

function AdminHeader() {
  return (
    <div className="admin-header">
      <div className="admin-header-left"></div>
      <div className="admin-header-content"></div>
      <div className="admin-header-right">
        <UserInfo collapsed={false} isAdminPage />
      </div>
    </div>
  )
}

export default AdminHeader
