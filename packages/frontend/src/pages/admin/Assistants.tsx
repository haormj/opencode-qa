import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Switch, message, Popconfirm, Select } from 'antd'
import { ReloadOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { 
  getAdminAssistants, createAssistant, updateAssistant, deleteAssistant,
  getAssistantUserBots, createAssistantUserBot, deleteAssistantUserBot,
  getBots, getAdminUsers,
  type Assistant, type Bot, type AdminUser, type UserAssistantBot
} from '../../services/api'
import './Admin.css'

function AdminAssistants() {
  const [loading, setLoading] = useState(false)
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [bots, setBots] = useState<Bot[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [userBotModalOpen, setUserBotModalOpen] = useState(false)
  const [editingAssistant, setEditingAssistant] = useState<Assistant | null>(null)
  const [currentAssistantId, setCurrentAssistantId] = useState<string | null>(null)
  const [userBots, setUserBots] = useState<UserAssistantBot[]>([])
  const [form] = Form.useForm()
  const [userBotForm] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [assistantsResult, botsResult, usersResult] = await Promise.all([
        getAdminAssistants(),
        getBots(),
        getAdminUsers()
      ])
      setAssistants(assistantsResult)
      setBots(botsResult)
      setUsers(usersResult)
    } catch (error) {
      message.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleEdit = (assistant: Assistant) => {
    setEditingAssistant(assistant)
    form.setFieldsValue({
      name: assistant.name,
      slug: assistant.slug,
      description: assistant.description,
      defaultBotId: assistant.defaultBotId,
      isActive: assistant.isActive
    })
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAssistant(id)
      message.success('删除成功')
      fetchData()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingAssistant) {
        await updateAssistant(editingAssistant.id, values)
        message.success('更新成功')
      } else {
        await createAssistant(values)
        message.success('创建成功')
      }
      setModalOpen(false)
      fetchData()
    } catch (error) {
      message.error(editingAssistant ? '更新失败' : '创建失败')
    }
  }

  const handleManageUserBots = async (assistantId: string) => {
    setCurrentAssistantId(assistantId)
    try {
      const result = await getAssistantUserBots(assistantId)
      setUserBots(result)
      setUserBotModalOpen(true)
    } catch (error) {
      message.error('加载用户Bot分配失败')
    }
  }

  const handleAddUserBot = async () => {
    try {
      const values = await userBotForm.validateFields()
      await createAssistantUserBot(currentAssistantId!, values)
      message.success('添加成功')
      userBotForm.resetFields()
      const result = await getAssistantUserBots(currentAssistantId!)
      setUserBots(result)
    } catch (error) {
      message.error('添加失败')
    }
  }

  const handleDeleteUserBot = async (userId: string) => {
    try {
      await deleteAssistantUserBot(currentAssistantId!, userId)
      message.success('删除成功')
      const result = await getAssistantUserBots(currentAssistantId!)
      setUserBots(result)
    } catch (error) {
      message.error('删除失败')
    }
  }

  const columns: ColumnsType<Assistant> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150
    },
    {
      title: '标识',
      dataIndex: 'slug',
      key: 'slug',
      width: 120
    },
    {
      title: '默认机器人',
      dataIndex: 'defaultBot',
      key: 'defaultBot',
      width: 150,
      render: (bot) => bot?.displayName || '-'
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>
          {active ? '启用' : '禁用'}
        </Tag>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<UserOutlined />}
            onClick={() => handleManageUserBots(record.id)}
          >
            用户分配
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {record.slug !== 'default' && (
            <Popconfirm
              title="确认删除"
              description="确定要删除此助手吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  const userBotColumns: ColumnsType<UserAssistantBot> = [
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
      width: 150,
      render: (user) => user?.displayName || user?.username || '-'
    },
    {
      title: '机器人',
      dataIndex: 'bot',
      key: 'bot',
      width: 150,
      render: (bot) => bot?.displayName || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="确认删除"
          description="确定要删除此分配吗？"
          onConfirm={() => handleDeleteUserBot(record.userId)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      )
    }
  ]

  return (
    <Card
      title="助手管理"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            刷新
          </Button>
          <Button type="primary" onClick={() => { setEditingAssistant(null); form.resetFields(); setModalOpen(true) }}>
            新增助手
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={assistants}
        rowKey="id"
        loading={loading}
        pagination={{
          showTotal: (total) => `共 ${total} 条`
        }}
      />

      <Modal
        title={editingAssistant ? '编辑助手' : '新增助手'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="确定"
        cancelText="取消"
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入助手名称' }]}>
            <Input placeholder="如：技术助手" />
          </Form.Item>
          <Form.Item name="slug" label="标识" rules={[{ required: true, message: '请输入助手标识' }]}>
            <Input placeholder="如：tech-support" disabled={!!editingAssistant} />
          </Form.Item>
          <Form.Item name="defaultBotId" label="默认机器人" rules={[{ required: true, message: '请选择默认机器人' }]}>
            <Select placeholder="选择默认机器人">
              {bots.map(bot => (
                <Select.Option key={bot.id} value={bot.id}>{bot.displayName}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="助手描述" />
          </Form.Item>
          <Form.Item name="isActive" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="用户Bot分配"
        open={userBotModalOpen}
        onCancel={() => setUserBotModalOpen(false)}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Form form={userBotForm} layout="inline">
            <Form.Item name="userId" rules={[{ required: true, message: '请选择用户' }]}>
              <Select placeholder="选择用户" style={{ width: 200 }} showSearch optionFilterProp="children">
                {users.map(user => (
                  <Select.Option key={user.id} value={user.id}>{user.displayName} ({user.username})</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="botId" rules={[{ required: true, message: '请选择机器人' }]}>
              <Select placeholder="选择机器人" style={{ width: 200 }}>
                {bots.map(bot => (
                  <Select.Option key={bot.id} value={bot.id}>{bot.displayName}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={handleAddUserBot}>添加</Button>
            </Form.Item>
          </Form>
        </div>
        <Table
          columns={userBotColumns}
          dataSource={userBots}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Modal>
    </Card>
  )
}

export default AdminAssistants
