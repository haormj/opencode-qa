import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { isAuthenticated, isAdmin } from './services/api'
import Home from './pages/Home'
import Login from './pages/Login'
import SsoCallback from './pages/SsoCallback'
import SessionRedirect from './pages/SessionRedirect'
import AdminLayout from './pages/admin/Layout'
import AdminSessions from './pages/admin/Sessions'
import AdminSessionDetail from './pages/admin/SessionDetail'
import AdminUsers from './pages/admin/Users'
import AdminBots from './pages/admin/Bots'
import AdminSsoProviders from './pages/admin/SsoProviders'
import AdminSystemSettings from './pages/admin/SystemSettings'
import StatisticsLayout from './pages/admin/StatisticsLayout'
import StatisticsOverview from './pages/admin/StatisticsOverview'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (!isAdmin()) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/sso/callback" element={<SsoCallback />} />
        <Route
          path="/session/:id"
          element={
            <PrivateRoute>
              <SessionRedirect />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<Navigate to="/admin/sessions" replace />} />
          <Route path="sessions" element={<AdminSessions />} />
          <Route path="sessions/:id" element={<AdminSessionDetail />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="bots" element={<AdminBots />} />
          <Route path="settings/sso" element={<AdminSsoProviders />} />
          <Route path="settings/system" element={<AdminSystemSettings />} />
          <Route path="statistics" element={<StatisticsLayout />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<StatisticsOverview />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
