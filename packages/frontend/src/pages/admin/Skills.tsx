import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Card, Tag, Input, Select, Button, Space, Tooltip, message, Popconfirm, Modal, Form } from 'antd'
import { SearchOutlined, EyeOutlined, CheckOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getAdminSkills, getAdminSkillCategories, reviewSkill, batchReviewSkills, batchDeleteSkills, type Skill, type SkillCategory } from '../../services/api'
import './Admin.css'

const statusColors: Record<string, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  unpublished: 'default'
}

const statusLabels: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  unpublished: '已下架'
}

function AdminSkills() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [skills, setSkills] = useState<Skill[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>()
  const [categories, setCategories] = useState<SkillCategory[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])

  const [reviewModal, setReviewModal] = useState(false)
  const [currentSkill, setCurrentSkill] = useState<Skill | null>(null)
  const [reviewForm] = Form.useForm()
  const [batchModal, setBatchModal] = useState(false)
  const [batchForm] = Form.useForm()

  useEffect(() => {
    getAdminSkillCategories().then(setCategories).catch(() => {})
  }, [])

  const fetchSkills = async () => {
    setLoading(true)
    try {
      const result = await getAdminSkills({
        status: statusFilter || undefined,
        search: searchText || undefined,
        page,
        pageSize
      })
      let items = result.items
      if (categoryFilter) {
        items = items.filter(s => s.categoryId === categoryFilter)
      }
      setSkills(items)
      setTotal(categoryFilter ? items.length : result.total)
    } catch {
      message.error('加载技能列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSkills()
    setSelectedRowKeys([])
  }, [page, pageSize, statusFilter, categoryFilter])

  const handleSearch = () => {
    setPage(1)
    fetchSkills()
  }

  const handleReview = (skill: Skill, status: 'approved' | 'rejected') => {
    setCurrentSkill(skill)
    reviewForm.setFieldsValue({ status, rejectReason: '' })
    setReviewModal(true)
  }

  const submitReview = async () => {
    if (!currentSkill) return
    try {
      const values = await reviewForm.validateFields()
      await reviewSkill(currentSkill.id, values)
      message.success('审核完成')
      setReviewModal(false)
      fetchSkills()
    } catch {
      message.error('审核失败')
    }
  }

  const handleBatchReview = (status: 'approved' | 'rejected') => {
    batchForm.setFieldsValue({ status, rejectReason: '' })
    setBatchModal(true)
  }

  const submitBatchReview = async () => {
    try {
      const values = await batchForm.validateFields()
      await batchReviewSkills(selectedRowKeys, values.status, values.rejectReason)
      message.success(`已处理 ${selectedRowKeys.length} 个技能`)
      setBatchModal(false)
      setSelectedRowKeys([])
      fetchSkills()
    } catch {
      message.error('批量操作失败')
    }
  }

  const handleBatchDelete = async () => {
    try {
      await batchDeleteSkills(selectedRowKeys)
      message.success(`已删除 ${selectedRowKeys.length} 个技能`)
      setSelectedRowKeys([])
      fetchSkills()
    } catch {
      message.error('批量删除失败')
    }
  }

  const columns: ColumnsType<Skill> = [
    {
      title: '技能名称',
      dataIndex: 'displayName',
      key: 'name',
      width: 200,
      ellipsis: true,
      render: (name: string, record) => (
        <span
          style={{ color: '#1890ff', cursor: 'pointer' }}
          onClick={() => navigate(`/admin/skills/${record.id}`)}
        >
          {name}
        </span>
      )
    },
    {
      title: 'Slug',
      dataIndex: 'slug',
      key: 'slug',
      width: 150,
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusColors[status] || 'default'}>
          {statusLabels[status] || status}
        </Tag>
      )
    },
    {
      title: '下载量',
      dataIndex: 'downloadCount',
      key: 'downloadCount',
      width: 80,
      align: 'center'
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      align: 'center'
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/admin/skills/${record.id}`)}
            />
          </Tooltip>
          {record.status === 'pending' && (
            <>
              <Tooltip title="通过">
                <Button
                  type="text"
                  style={{ color: '#52c41a' }}
                  icon={<CheckOutlined />}
                  onClick={() => handleReview(record, 'approved')}
                />
              </Tooltip>
              <Tooltip title="拒绝">
                <Button
                  type="text"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => handleReview(record, 'rejected')}
                />
              </Tooltip>
            </>
          )}
        </Space>
      )
    }
  ]

  return (
    <>
      <Card
        title={
          selectedRowKeys.length > 0 
            ? `已选择 ${selectedRowKeys.length} 项` 
            : '技能管理'
        }
        extra={
          <Space>
            <Input
              placeholder="搜索技能名称"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
            />
            <Select
              placeholder="状态筛选"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value)
                setPage(1)
              }}
              allowClear
              style={{ width: 120 }}
              options={[
                { value: 'pending', label: '待审核' },
                { value: 'approved', label: '已通过' },
                { value: 'rejected', label: '已拒绝' }
              ]}
            />
            <Select
              placeholder="分类筛选"
              value={categoryFilter}
              onChange={(value) => {
                setCategoryFilter(value)
                setPage(1)
              }}
              allowClear
              style={{ width: 150 }}
              options={categories.map(c => ({ value: c.id, label: c.name }))}
            />
            <Button type="primary" onClick={handleSearch}>
              搜索
            </Button>
          </Space>
        }
        actions={
          selectedRowKeys.length > 0
            ? [
                <Space key="batch-actions">
                  <Button type="primary" icon={<CheckOutlined />} onClick={() => handleBatchReview('approved')}>
                    批量通过
                  </Button>
                  <Button danger icon={<CloseOutlined />} onClick={() => handleBatchReview('rejected')}>
                    批量拒绝
                  </Button>
                  <Popconfirm
                    title="确定删除选中的技能吗？"
                    description="删除后无法恢复"
                    onConfirm={handleBatchDelete}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button danger icon={<DeleteOutlined />}>
                      批量删除
                    </Button>
                  </Popconfirm>
                  <Button onClick={() => setSelectedRowKeys([])}>
                    取消选择
                  </Button>
                </Space>
              ]
            : undefined
        }
      >
        <Table
          columns={columns}
          dataSource={skills}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            }
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[])
          }}
        />
      </Card>

      <Modal
        title="审核技能"
        open={reviewModal}
        onOk={submitReview}
        onCancel={() => setReviewModal(false)}
      >
        <Form form={reviewForm} layout="vertical">
          <Form.Item name="status" label="审核结果">
            <Select>
              <Select.Option value="approved">通过</Select.Option>
              <Select.Option value="rejected">拒绝</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="rejectReason" label="拒绝原因">
            <Input.TextArea rows={3} placeholder="拒绝时建议填写原因" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量审核"
        open={batchModal}
        onOk={submitBatchReview}
        onCancel={() => setBatchModal(false)}
      >
        <Form form={batchForm} layout="vertical">
          <Form.Item name="status" label="审核结果" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="approved">通过</Select.Option>
              <Select.Option value="rejected">拒绝</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="rejectReason" label="拒绝原因">
            <Input.TextArea rows={3} placeholder="拒绝时建议填写原因" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default AdminSkills
