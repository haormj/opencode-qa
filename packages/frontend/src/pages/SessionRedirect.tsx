import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { message, Spin } from 'antd'
import { isAuthenticated, isAdmin, getStoredUser, getSessionInfo } from '../services/api'

function SessionRedirect() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      navigate('/')
      return
    }

    if (!isAuthenticated()) {
      navigate('/login', { state: { from: `/session/${id}` } })
      return
    }

    const redirect = async () => {
      try {
        const sessionInfo = await getSessionInfo(id)
        const currentUser = getStoredUser()

        if (sessionInfo.userId === currentUser?.id) {
          navigate(`/?sessionId=${id}`, { replace: true })
        } else if (isAdmin()) {
          navigate(`/admin/sessions/${id}`, { replace: true })
        } else {
          message.error('无权访问此会话')
          navigate('/', { replace: true })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '获取会话信息失败'
        if (errorMessage.includes('Session not found')) {
          message.error('会话不存在')
        } else {
          message.error(errorMessage)
        }
        navigate('/', { replace: true })
      } finally {
        setLoading(false)
      }
    }

    redirect()
  }, [id, navigate])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="正在跳转..." />
      </div>
    )
  }

  return null
}

export default SessionRedirect
