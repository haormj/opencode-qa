import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isAuthenticated, isAdmin } from './services/api'
import Home from './pages/Home'
import Login from './pages/Login'
import SessionRedirect from './pages/SessionRedirect'
import AdminLayout from './pages/admin/Layout'
import AdminSessions from './pages/admin/Sessions'
import AdminSessionDetail from './pages/admin/SessionDetail'
import AdminUsers from './pages/admin/Users'
import AdminBots from './pages/admin/Bots'
import StatisticsLayout from './pages/admin/StatisticsLayout'
import StatisticsOverview from './pages/admin/StatisticsOverview'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
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
