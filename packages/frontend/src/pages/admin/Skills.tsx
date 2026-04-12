import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Card, Tag, Input, Select, Button, Space, Tooltip, message, Modal, Form } from 'antd'
import { SearchOutlined, EyeOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getAdminSkills, getAdminSkillCategories, reviewSkill, type Skill, type SkillCategory } from '../../services/api'
import './Admin.css'

const statusColors: Record<string, string> = {
  pending: 'orange',
  approved: 'green',
  unpublished: 'default'
}

const statusLabels: Record<string, string> = {
  pending: '待发布',
  approved: '已发布',
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
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>()
  const [categories, setCategories] = useState<SkillCategory[]>([])

  const [reviewModal, setReviewModal] = useState(false)
  const [currentSkill, setCurrentSkill] = useState<Skill | null>(null)
  const [reviewForm] = Form.useForm()

  useEffect(() => {
    getAdminSkillCategories().then(setCategories).catch(() => {})
  }, [])

  const fetchSkills = async () => {
    setLoading(true)
    try {
      const result = await getAdminSkills({
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
  }, [page, pageSize, categoryFilter])

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
        title="技能列表"
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
    </>
  )
}

export default AdminSkills
