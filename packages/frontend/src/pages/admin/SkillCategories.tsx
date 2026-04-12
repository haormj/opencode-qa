import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, message, Popconfirm } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { getAdminSkillCategories, createSkillCategory, updateSkillCategory, deleteSkillCategory, type SkillCategory } from '../../services/api'

function SkillCategories() {
  const [categories, setCategories] = useState<SkillCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const cats = await getAdminSkillCategories()
      setCategories(cats)
    } catch {
      message.error('加载分类列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  const handleAdd = () => {
    setEditingId(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (cat: SkillCategory) => {
    setEditingId(cat.id)
    form.setFieldsValue(cat)
    setModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteSkillCategory(id)
      message.success('删除成功')
      fetchCategories()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingId) {
        await updateSkillCategory(editingId, values)
        message.success('更新成功')
      } else {
        await createSkillCategory(values)
        message.success('创建成功')
      }
      setModalOpen(false)
      fetchCategories()
    } catch {
      message.error('操作失败')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: '图标', dataIndex: 'icon', key: 'icon', render: (icon: string) => icon || '-' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: 'Slug', dataIndex: 'slug', key: 'slug' },
    { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder' },
    {
      title: '操作', key: 'action',
      render: (_: unknown, record: SkillCategory) => (
        <span style={{ display: 'flex', gap: 4 }}>
          <Button size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除此分类？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </span>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>分类管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增分类</Button>
      </div>
      <Table
        dataSource={categories}
        columns={columns}
        rowKey="id"
        loading={loading}
      />
      <Modal
        title={editingId ? '编辑分类' : '新增分类'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="slug" label="Slug" rules={[{ required: true, message: '请输入slug' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="icon" label="图标（emoji）">
            <Input placeholder="如 🤖" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SkillCategories