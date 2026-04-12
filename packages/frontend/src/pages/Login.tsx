import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Form, Input, Button, Card, message, Tabs, Divider, Space, Collapse } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined, DownOutlined } from '@ant-design/icons'
import { login, register, isAuthenticated, getSsoProviders, getSsoAuthorizeUrl, SsoProvider, getPublicSettings } from '../services/api'
import './Login.css'

interface LocationState {
  from?: string
}

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
  const [ssoProviders, setSsoProviders] = useState<SsoProvider[]>([])
  const [siteTitle, setSiteTitle] = useState('OpenCode QA')
  const [loginConfig, setLoginConfig] = useState<{
    showPasswordLogin: boolean
    showRegister: boolean
    passwordLoginCollapsed: boolean
  }>({
    showPasswordLogin: true,
    showRegister: true,
    passwordLoginCollapsed: false
  })

  const from = (location.state as LocationState)?.from || '/'

  useEffect(() => {
    getSsoProviders().then(setSsoProviders).catch(() => {})
    getPublicSettings().then(settings => {
      if (settings['site.title']) {
        setSiteTitle(settings['site.title'])
      }
      setLoginConfig({
        showPasswordLogin: settings['login.showPasswordLogin'] !== 'false',
        showRegister: settings['login.showRegister'] !== 'false',
        passwordLoginCollapsed: settings['login.passwordLoginCollapsed'] === 'true'
      })
    }).catch(() => {})
    
    if (from && from !== '/') {
      sessionStorage.setItem('sso_from', from)
    }
  }, [from])

  if (isAuthenticated()) {
    navigate(from, { replace: true })
    return null
  }

  const handleSsoLogin = async (providerName: string) => {
    try {
      const redirectUri = `${window.location.origin}/sso/callback`
      const { authorizeUrl, state } = await getSsoAuthorizeUrl(providerName, redirectUri)
      sessionStorage.setItem('sso_provider', providerName)
      sessionStorage.setItem('sso_state', state)
      sessionStorage.setItem('sso_redirect_uri', redirectUri)
      sessionStorage.setItem('sso_from', from)
      window.location.href = authorizeUrl
    } catch (error) {
      message.error('SSO 登录失败')
    }
  }

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      await login(values.username, values.password)
      message.success('登录成功')
      navigate(from, { replace: true })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (values: {
    username: string
    password: string
    email?: string
    displayName?: string
  }) => {
    setLoading(true)
    try {
      await register(values.username, values.password, values.email, values.displayName)
      message.success('注册成功')
      navigate(from, { replace: true })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '注册失败')
    } finally {
      setLoading(false)
    }
  }

  const PasswordLoginForm = () => (
    <Form onFinish={handleLogin} layout="vertical">
      <Form.Item
        name="username"
        rules={[{ required: true, message: '请输入用户名' }]}
      >
        <Input
          prefix={<UserOutlined />}
          placeholder="用户名"
          size="large"
        />
      </Form.Item>
      <Form.Item
        name="password"
        rules={[{ required: true, message: '请输入密码' }]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="密码"
          size="large"
        />
      </Form.Item>
      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          block
          size="large"
        >
          登录
        </Button>
      </Form.Item>
    </Form>
  )

  const SsoLoginButtons = () => (
    <Space direction="vertical" style={{ width: '100%' }}>
      {ssoProviders.map(provider => (
        <Button
          key={provider.name}
          block
          size="large"
          onClick={() => handleSsoLogin(provider.name)}
          icon={provider.icon ? (
            <img 
              src={`data:${provider.iconMimeType};base64,${provider.icon}`}
              alt={provider.displayName}
              style={{ width: 16, height: 16, marginRight: 8 }}
            />
          ) : undefined}
        >
          {provider.displayName}
        </Button>
      ))}
    </Space>
  )

  const RegisterForm = () => (
    <Form onFinish={handleRegister} layout="vertical">
      <Form.Item
        name="username"
        rules={[
          { required: true, message: '请输入用户名' },
          { min: 3, message: '用户名至少3个字符' },
          { max: 50, message: '用户名最多50个字符' }
        ]}
      >
        <Input
          prefix={<UserOutlined />}
          placeholder="用户名"
          size="large"
        />
      </Form.Item>
      <Form.Item
        name="password"
        rules={[
          { required: true, message: '请输入密码' },
          { min: 6, message: '密码至少6个字符' }
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="密码"
          size="large"
        />
      </Form.Item>
      <Form.Item name="email">
        <Input
          prefix={<MailOutlined />}
          placeholder="邮箱（选填）"
          size="large"
        />
      </Form.Item>
      <Form.Item name="displayName">
        <Input
          prefix={<UserOutlined />}
          placeholder="显示名称（选填）"
          size="large"
        />
      </Form.Item>
      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          block
          size="large"
        >
          注册
        </Button>
      </Form.Item>
    </Form>
  )

  const hasSso = ssoProviders.length > 0
  const showPassword = loginConfig.showPasswordLogin
  const collapsed = loginConfig.passwordLoginCollapsed && hasSso

  const renderLoginContent = () => {
    if (!showPassword && hasSso) {
      return <SsoLoginButtons />
    }

    if (collapsed) {
      return (
        <>
          <SsoLoginButtons />
          <Collapse
            ghost
            expandIcon={({ isActive }) => <DownOutlined rotate={isActive ? 0 : -90} />}
            items={[{
              key: '1',
              label: '其他登录方式',
              children: <PasswordLoginForm />
            }]}
          />
        </>
      )
    }

    return (
      <>
        <PasswordLoginForm />
        {hasSso && (
          <>
            <Divider>或</Divider>
            <SsoLoginButtons />
          </>
        )}
      </>
    )
  }

  const tabItems = [
    {
      key: 'login',
      label: '登录',
      children: renderLoginContent()
    }
  ]

  if (loginConfig.showRegister) {
    tabItems.push({
      key: 'register',
      label: '注册',
      children: <RegisterForm />
    })
  }

  return (
    <div className="login-container">
      <Card className="login-card">
        <h1 className="login-title">{siteTitle}</h1>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'login' | 'register')}
          centered
          items={tabItems}
        />
      </Card>
    </div>
  )
}

export default Login
