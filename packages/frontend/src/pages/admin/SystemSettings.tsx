import { useState, useEffect } from 'react'
import { Card, Switch, Spin, message, Input, Tabs } from 'antd'
import { getAdminSettings, updateSetting } from '../../services/api'
import './SystemSettings.css'

function SystemSettings() {
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

  const handleInputChange = async (key: string, value: string) => {
    try {
      setUpdating(key)
      await updateSetting(key, value)
      setSettings(prev => ({ ...prev, [key]: value }))
      message.success('设置已更新')
    } catch (error) {
      message.error('更新设置失败')
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return (
      <div className="system-settings-loading">
        <Spin />
      </div>
    )
  }

  return (
    <Tabs defaultActiveKey="site">
      <Tabs.TabPane tab="站点配置" key="site">
        <Card>
          <div className="setting-item">
            <div className="setting-info">
              <div className="setting-label">用户端标题</div>
              <div className="setting-desc">显示在登录页和用户端侧边栏</div>
            </div>
            <Input
              value={settings['site.title'] || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, 'site.title': e.target.value }))}
              onBlur={(e) => handleInputChange('site.title', e.target.value)}
              onPressEnter={(e) => handleInputChange('site.title', (e.target as HTMLInputElement).value)}
              style={{ width: 200 }}
              placeholder="请输入用户端标题"
              disabled={updating === 'site.title'}
            />
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <div className="setting-label">管理后台标题</div>
              <div className="setting-desc">显示在管理后台侧边栏</div>
            </div>
            <Input
              value={settings['site.adminTitle'] || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, 'site.adminTitle': e.target.value }))}
              onBlur={(e) => handleInputChange('site.adminTitle', e.target.value)}
              onPressEnter={(e) => handleInputChange('site.adminTitle', (e.target as HTMLInputElement).value)}
              style={{ width: 200 }}
              placeholder="请输入管理后台标题"
              disabled={updating === 'site.adminTitle'}
            />
          </div>
        </Card>
      </Tabs.TabPane>
      <Tabs.TabPane tab="安装配置" key="install">
        <Card>
          <div className="setting-item">
            <div className="setting-info">
              <div className="setting-label">服务器地址</div>
              <div className="setting-desc">安装脚本服务器地址，用于生成技能安装命令（如 https://example.com）</div>
            </div>
            <Input
              value={settings['install.serverUrl'] || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, 'install.serverUrl': e.target.value }))}
              onBlur={(e) => handleInputChange('install.serverUrl', e.target.value)}
              onPressEnter={(e) => handleInputChange('install.serverUrl', (e.target as HTMLInputElement).value)}
              style={{ width: 300 }}
              placeholder="请输入服务器地址"
              disabled={updating === 'install.serverUrl'}
            />
          </div>
        </Card>
      </Tabs.TabPane>
      <Tabs.TabPane tab="登录配置" key="login">
        <Card>
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
      </Tabs.TabPane>
    </Tabs>
  )
}

export default SystemSettings
