import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin, message } from 'antd'
import { ssoCallback } from '../services/api'

function SsoCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(user))
        sessionStorage.removeItem('sso_provider')
        sessionStorage.removeItem('sso_state')
        sessionStorage.removeItem('sso_redirect_uri')
        message.success('登录成功')
        navigate('/')
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
