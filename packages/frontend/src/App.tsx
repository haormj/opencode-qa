import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { isAuthenticated, isAdmin } from './services/api'
import { PageTitle } from './components/PageTitle'
import Home from './pages/Home'
import Login from './pages/Login'
import SsoCallback from './pages/SsoCallback'
import SessionRedirect from './pages/SessionRedirect'
import AdminLayout from './pages/admin/Layout'
import AdminSessions from './pages/admin/Sessions'
import AdminSessionDetail from './pages/admin/SessionDetail'
import AdminUsers from './pages/admin/Users'
import AdminBots from './pages/admin/Bots'
import AdminAssistants from './pages/admin/Assistants'
import AdminSsoProviders from './pages/admin/SsoProviders'
import AdminSystemSettings from './pages/admin/SystemSettings'
import AdminSkills from './pages/admin/Skills'
import SkillDetail from './pages/admin/SkillDetail'
import SkillCategories from './pages/admin/SkillCategories'
import SkillVersions from './pages/admin/SkillVersions'
import SkillVersionDetail from './pages/admin/SkillVersionDetail'
import Tasks from './pages/admin/Tasks'
import TaskCreate from './pages/admin/TaskCreate'
import TaskDetail from './pages/admin/TaskDetail'
import TaskExecutions from './pages/admin/TaskExecutions'
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
    return <Navigate to="/skills" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <PageTitle />
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/skills" replace />}
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
          path="/assistants/:slug"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/skills"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/skills/publish"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/skills/update/:slug"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/skills/my/published"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/skills/my/favorites"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/skills/my/versions"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/skills/my/versions/:versionId"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/skills/my/:slug"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/skills/:slug"
          element={
            <PrivateRoute>
              <Home />
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
          <Route path="assistants" element={<AdminAssistants />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="tasks/create" element={<TaskCreate />} />
          <Route path="tasks/:id" element={<TaskDetail />} />
          <Route path="tasks/:id/edit" element={<TaskCreate />} />
          <Route path="tasks/:id/executions" element={<TaskExecutions />} />
          <Route path="skills" element={<AdminSkills />} />
          <Route path="skills/:id" element={<SkillDetail />} />
          <Route path="skills/categories" element={<SkillCategories />} />
          <Route path="skill-versions" element={<SkillVersions />} />
          <Route path="skill-versions/:id" element={<SkillVersionDetail />} />
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