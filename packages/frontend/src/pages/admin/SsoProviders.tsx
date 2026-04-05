import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Switch, message, Popconfirm, Upload, Select } from 'antd'
import { ReloadOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getAdminSsoProviders, createSsoProvider, updateSsoProvider, deleteSsoProvider, uploadSsoProviderIcon, type SsoProvider } from '../../services/api'
import './Admin.css'

const SSO_TYPES = [
  { value: 'GENERIC', label: '通用 OAuth 2.0' },
  { value: 'FEISHU', label: '飞书' }
]

function AdminSsoProviders() {
  const [loading, setLoading] = useState(false)
  const [providers, setProviders] = useState<SsoProvider[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<SsoProvider | null>(null)
  const [form] = Form.useForm()
  const [selectedType, setSelectedType] = useState<string>('GENERIC')

  const fetchProviders = async () => {
    setLoading(true)
    try {
      const result = await getAdminSsoProviders()
      setProviders(result)
    } catch (error) {
      message.error('加载 SSO 配置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProviders()
  }, [])

  const handleEdit = (provider: SsoProvider) => {
    setEditingProvider(provider)
    setSelectedType(provider.type)
    form.setFieldsValue(provider)
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteSsoProvider(id)
      message.success('删除成功')
      fetchProviders()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingProvider) {
        await updateSsoProvider(editingProvider.id, values)
        message.success('更新成功')
      } else {
        await createSsoProvider(values)
        message.success('创建成功')
      }
      setModalOpen(false)
      fetchProviders()
    } catch (error) {
      message.error(editingProvider ? '更新失败' : '创建失败')
    }
  }

  const handleUploadIcon = async (providerId: string, file: File) => {
    try {
      await uploadSsoProviderIcon(providerId, file)
      message.success('图标上传成功')
      fetchProviders()
    } catch (error) {
      message.error('图标上传失败')
    }
  }

  const columns: ColumnsType<SsoProvider> = [
    {
      title: '名称',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 150,
    },
    {
      title: '标识',
      dataIndex: 'name',
      key: 'name',
      width: 120,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => {
        const typeInfo = SSO_TYPES.find(t => t.value === type)
        return <Tag color={type === 'FEISHU' ? 'blue' : 'green'}>{typeInfo?.label || type}</Tag>
      }
    },
    {
      title: '图标',
      dataIndex: 'icon',
      key: 'icon',
      width: 80,
      render: (icon: string, record: SsoProvider) => (
        icon ? (
          <img 
            src={`data:${record.iconMimeType};base64,${icon}`}
            alt={record.displayName}
            style={{ width: 32, height: 32, objectFit: 'contain' }}
          />
        ) : '-'
      )
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'default'}>
          {enabled ? '启用' : '禁用'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={(file) => {
              handleUploadIcon(record.id, file)
              return false
            }}
          >
            <Button type="link" icon={<UploadOutlined />}>
              图标
            </Button>
          </Upload>
          <Popconfirm
            title="确认删除"
            description="确定要删除此 SSO 配置吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <Card
      title="SSO 配置"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchProviders}>
            刷新
          </Button>
          <Button
            type="primary"
            onClick={() => {
              setEditingProvider(null)
              setSelectedType('GENERIC')
              form.resetFields()
              setModalOpen(true)
            }}
          >
            新增
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={providers}
        rowKey="id"
        loading={loading}
        pagination={{
          showTotal: (total) => `共 ${total} 条`
        }}
      />

      <Modal
        title={editingProvider ? '编辑 SSO 配置' : '新增 SSO 配置'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="确定"
        cancelText="取消"
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="标识"
            rules={[{ required: true, message: '请输入标识' }]}
          >
            <Input placeholder="如：company-sso" disabled={!!editingProvider} />
          </Form.Item>
          <Form.Item
            name="displayName"
            label="显示名称"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="如：企业统一登录" />
          </Form.Item>
          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: '请选择类型' }]}
          >
            <Select 
              options={SSO_TYPES}
              onChange={(value) => setSelectedType(value)}
            />
          </Form.Item>
          
          {selectedType === 'GENERIC' && (
            <>
              <Form.Item
                name="authorizeUrl"
                label="授权 URL"
                rules={[{ required: true, message: '请输入授权 URL' }]}
              >
                <Input placeholder="OAuth 授权端点 URL" />
              </Form.Item>
              <Form.Item
                name="tokenUrl"
                label="Token URL"
                rules={[{ required: true, message: '请输入 Token URL' }]}
              >
                <Input placeholder="OAuth Token 端点 URL" />
              </Form.Item>
              <Form.Item
                name="userInfoUrl"
                label="用户信息 URL"
              >
                <Input placeholder="用户信息端点 URL" />
              </Form.Item>
              <Form.Item
                name="clientId"
                label="Client ID"
                rules={[{ required: true, message: '请输入 Client ID' }]}
              >
                <Input placeholder="OAuth Client ID" />
              </Form.Item>
              <Form.Item
                name="clientSecret"
                label="Client Secret"
                rules={[{ required: !editingProvider, message: '请输入 Client Secret' }]}
              >
                <Input.Password placeholder="OAuth Client Secret" />
              </Form.Item>
              <Form.Item
                name="scope"
                label="Scope"
              >
                <Input placeholder="如：openid profile email" />
              </Form.Item>
              <Form.Item
                name="userIdField"
                label="用户 ID 字段"
              >
                <Input placeholder="默认：sub" />
              </Form.Item>
              <Form.Item
                name="usernameField"
                label="用户名字段"
              >
                <Input placeholder="默认：preferred_username" />
              </Form.Item>
              <Form.Item
                name="emailField"
                label="邮箱字段"
              >
                <Input placeholder="默认：email" />
              </Form.Item>
              <Form.Item
                name="displayNameField"
                label="显示名称字段"
              >
                <Input placeholder="默认：name" />
              </Form.Item>
            </>
          )}

          {selectedType === 'FEISHU' && (
            <>
              <Form.Item
                name="appId"
                label="App ID"
                rules={[{ required: true, message: '请输入 App ID' }]}
              >
                <Input placeholder="飞书应用 App ID" />
              </Form.Item>
              <Form.Item
                name="appSecret"
                label="App Secret"
                rules={[{ required: !editingProvider, message: '请输入 App Secret' }]}
              >
                <Input.Password placeholder="飞书应用 App Secret" />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="enabled"
            label="状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default AdminSsoProviders
