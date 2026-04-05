import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin, message } from 'antd'
import { ssoCallback, setToken, setStoredUser } from '../services/api'

function SsoCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const hasCalled = useRef(false)

  useEffect(() => {
    if (hasCalled.current) return
    hasCalled.current = true
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const state = urlParams.get('state')

    if (!code || !state) {
      setError('无效的回调参数')
      setTimeout(() => navigate('/login'), 2000)
      return
    }

    const storedProvider = sessionStorage.getItem('sso_provider')
    const storedState = sessionStorage.getItem('sso_state')
    const storedRedirectUri = sessionStorage.getItem('sso_redirect_uri')

    if (!storedProvider || state !== storedState || !storedRedirectUri) {
      setError('State 验证失败')
      setTimeout(() => navigate('/login'), 2000)
      return
    }

    ssoCallback(storedProvider, code, state, storedRedirectUri)
      .then(({ token, user }) => {
        setToken(token)
        setStoredUser(user)
        sessionStorage.removeItem('sso_provider')
        sessionStorage.removeItem('sso_state')
        sessionStorage.removeItem('sso_redirect_uri')
        
        const storedFrom = sessionStorage.getItem('sso_from') || '/'
        sessionStorage.removeItem('sso_from')
        
        message.success('登录成功')
        navigate(storedFrom, { replace: true })
      })
      .catch((error) => {
        setError(error instanceof Error ? error.message : '登录失败')
        message.error('登录失败')
        setTimeout(() => navigate('/login'), 2000)
      })
  }, [navigate])

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column'
      }}>
        <p style={{ color: 'red' }}>{error}</p>
        <p>正在跳转到登录页面...</p>
      </div>
    )
  }

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh' 
    }}>
      <Spin size="large" tip="登录中...">
      </Spin>
    </div>
  )
}

export default SsoCallback
