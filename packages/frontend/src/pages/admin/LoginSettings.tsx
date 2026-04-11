import { useState, useEffect } from 'react'
import { Card, Switch, Spin, message } from 'antd'
import { getAdminSettings, updateSetting } from '../../services/api'
import './LoginSettings.css'

function LoginSettings() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const data = await getAdminSettings()
      const map: Record<string, string> = {}
      for (const s of data) {
        map[s.key] = s.value
      }
      setSettings(map)
    } catch (error) {
      message.error('加载设置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (key: string, checked: boolean) => {
    try {
      setUpdating(key)
      await updateSetting(key, checked ? 'true' : 'false')
      setSettings(prev => ({ ...prev, [key]: checked ? 'true' : 'false' }))
      message.success('设置已更新')
    } catch (error) {
      message.error('更新设置失败')
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return (
      <div className="login-settings-loading">
        <Spin />
      </div>
    )
  }

  return (
    <Card title="登录页面配置">
      <div className="setting-item">
        <div className="setting-info">
          <div className="setting-label">显示普通登录入口</div>
          <div className="setting-desc">关闭后登录页将隐藏用户名密码登录表单</div>
        </div>
        <Switch
          checked={settings['login.showPasswordLogin'] === 'true'}
          onChange={(checked) => handleToggle('login.showPasswordLogin', checked)}
          loading={updating === 'login.showPasswordLogin'}
        />
      </div>
      <div className="setting-item">
        <div className="setting-info">
          <div className="setting-label">普通登录默认折叠</div>
          <div className="setting-desc">开启后普通登录将折叠在"其他登录方式"下，点击展开</div>
        </div>
        <Switch
          checked={settings['login.passwordLoginCollapsed'] === 'true'}
          onChange={(checked) => handleToggle('login.passwordLoginCollapsed', checked)}
          loading={updating === 'login.passwordLoginCollapsed'}
          disabled={settings['login.showPasswordLogin'] !== 'true'}
        />
      </div>
      <div className="setting-item">
        <div className="setting-info">
          <div className="setting-label">显示注册入口</div>
          <div className="setting-desc">关闭后登录页将隐藏注册 Tab</div>
        </div>
        <Switch
          checked={settings['login.showRegister'] === 'true'}
          onChange={(checked) => handleToggle('login.showRegister', checked)}
          loading={updating === 'login.showRegister'}
        />
      </div>
    </Card>
  )
}

export default LoginSettings
