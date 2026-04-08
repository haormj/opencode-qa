import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Switch, message, Popconfirm } from 'antd'
import { ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getBots, createBot, updateBot, deleteBot, type Bot } from '../../services/api'
import './Admin.css'

function AdminBots() {
  const [loading, setLoading] = useState(false)
  const [bots, setBots] = useState<Bot[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBot, setEditingBot] = useState<Bot | null>(null)
  const [form] = Form.useForm()

  const fetchBots = async () => {
    setLoading(true)
    try {
      const result = await getBots()
      setBots(result)
    } catch (error) {
      message.error('加载机器人列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBots()
  }, [])

  const handleEdit = (bot: Bot) => {
    setEditingBot(bot)
    form.setFieldsValue(bot)
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteBot(id)
      message.success('删除成功')
      fetchBots()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingBot) {
        await updateBot(editingBot.id, values)
        message.success('更新成功')
      } else {
        await createBot(values)
        message.success('创建成功')
      }
      setModalOpen(false)
      fetchBots()
    } catch (error) {
      message.error(editingBot ? '更新失败' : '创建失败')
    }
  }

  const columns: ColumnsType<Bot> = [
    {
      title: '名称',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 150,
      render: (text, record) => (
        <Space>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: record.avatar || '#52c41a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 12
            }}
          >
            {text[0]}
          </div>
          <span>{text}</span>
        </Space>
      )
    },
    {
      title: '标识',
      dataIndex: 'name',
      key: 'name',
      width: 120
    },
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      width: 150
    },
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model',
      width: 120
    },
    {
      title: 'Agent',
      dataIndex: 'agent',
      key: 'agent',
      width: 100
    },
    {
      title: 'API 地址',
      dataIndex: 'apiUrl',
      key: 'apiUrl',
      width: 200,
      ellipsis: true
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
      width: 150,
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {record.name !== 'default' && (
            <Popconfirm
              title="确认删除"
              description="确定要删除此机器人吗？"
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

  return (
    <Card
      title="机器人管理"
      extra={
        <Button icon={<ReloadOutlined />} onClick={fetchBots}>
          刷新
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={bots}
        rowKey="id"
        loading={loading}
        pagination={{
          showTotal: (total) => `共 ${total} 条`
        }}
      />

      <Modal
        title={editingBot ? '编辑机器人' : '新增机器人'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="确定"
        cancelText="取消"
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="标识"
            rules={[{ required: true, message: '请输入机器人标识' }]}
          >
            <Input placeholder="如：default、assistant" disabled={!!editingBot} />
          </Form.Item>
          <Form.Item
            name="displayName"
            label="显示名称"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="如：AI 助手" />
          </Form.Item>
          <Form.Item
            name="avatar"
            label="头像颜色"
          >
            <Input type="color" style={{ width: 100 }} />
          </Form.Item>
          <Form.Item
            name="apiUrl"
            label="API 地址"
            rules={[{ required: true, message: '请输入 API 地址' }]}
          >
            <Input placeholder="如：http://127.0.0.1:4096" />
          </Form.Item>
          <Form.Item
            name="apiKey"
            label="API 密钥"
          >
            <Input.Password placeholder="可选" />
          </Form.Item>
          <Form.Item
            name="provider"
            label="提供商"
            rules={[{ required: true, message: '请输入提供商' }]}
          >
            <Input placeholder="如：baiduqianfancodingplan" />
          </Form.Item>
          <Form.Item
            name="model"
            label="模型"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="如：glm-5" />
          </Form.Item>
          <Form.Item
            name="agent"
            label="Agent"
            rules={[{ required: true, message: '请输入 Agent 名称' }]}
          >
            <Input placeholder="如：plan、explore、build" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={2} placeholder="机器人描述" />
          </Form.Item>
          <Form.Item
            name="isActive"
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

export default AdminBots
