import { useState, useEffect } from 'react'
import { Table, Tag, Button, Modal, Form, Select, Input, message, Tabs, Space, Popconfirm, Card } from 'antd'
import { getAdminSkills, getAdminSkillCategories, reviewSkill, batchReviewSkills, batchDeleteSkills, type Skill, type SkillCategory } from '../../services/api'
import { useNavigate } from 'react-router-dom'

const statusColors: Record<string, string> = { pending: 'orange', approved: 'green', rejected: 'red', unpublished: 'default' }
const statusLabels: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已拒绝', unpublished: '已下架' }

function AdminSkills() {
  const navigate = useNavigate()
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [categories, setCategories] = useState<SkillCategory[]>([])
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>()
  const [searchText, setSearchText] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [reviewModal, setReviewModal] = useState(false)
  const [currentSkill, setCurrentSkill] = useState<Skill | null>(null)
  const [reviewForm] = Form.useForm()
  const [batchModal, setBatchModal] = useState(false)
  const [batchForm] = Form.useForm()

  const fetchCategories = async () => {
    try {
      const cats = await getAdminSkillCategories()
      setCategories(cats)
    } catch (err) {
      console.error('Failed to fetch categories:', err)
    }
  }

  const fetchSkills = async (p: number, status: string, categoryId?: number, search?: string) => {
    setLoading(true)
    try {
      const result = await getAdminSkills({ 
        page: p, 
        pageSize: 20, 
        status: status || undefined, 
        search: search || undefined 
      })
      let items = result.items
      if (categoryId) {
        items = items.filter(s => s.categoryId === categoryId)
      }
      setSkills(items)
      setTotal(categoryId ? items.length : result.total)
    } catch {
      message.error('加载技能列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchSkills(page, statusFilter, categoryFilter, searchText)
    setSelectedRowKeys([])
  }, [page, statusFilter, categoryFilter, searchText])

  const handleSearch = () => {
    setPage(1)
    fetchSkills(1, statusFilter, categoryFilter, searchText)
  }

  const handleReview = (skill: Skill, status: 'approved' | 'rejected') => {
    setCurrentSkill(skill)
    reviewForm.setFieldsValue({ status, name: skill.name, displayName: skill.displayName })
    setReviewModal(true)
  }

  const submitReview = async () => {
    if (!currentSkill) return
    try {
      const values = await reviewForm.validateFields()
      await reviewSkill(currentSkill.id, values)
      message.success('审核完成')
      setReviewModal(false)
      fetchSkills(page, statusFilter, categoryFilter, searchText)
    } catch {
      message.error('审核失败')
    }
  }

  const handleBatchReview = (status: 'approved' | 'rejected') => {
    batchForm.setFieldsValue({ status })
    setBatchModal(true)
  }

  const submitBatchReview = async () => {
    try {
      const values = await batchForm.validateFields()
      await batchReviewSkills(selectedRowKeys, values.status, values.rejectReason)
      message.success(`已处理 ${selectedRowKeys.length} 个技能`)
      setBatchModal(false)
      setSelectedRowKeys([])
      fetchSkills(page, statusFilter, categoryFilter, searchText)
    } catch {
      message.error('批量操作失败')
    }
  }

  const handleBatchDelete = async () => {
    try {
      await batchDeleteSkills(selectedRowKeys)
      message.success(`已删除 ${selectedRowKeys.length} 个技能`)
      setSelectedRowKeys([])
      fetchSkills(page, statusFilter, categoryFilter, searchText)
    } catch {
      message.error('批量删除失败')
    }
  }

  const columns = [
    { title: '名称', dataIndex: 'displayName', key: 'name' },
    { title: 'Slug', dataIndex: 'slug', key: 'slug' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s] || s}</Tag> },
    { title: '下载量', dataIndex: 'downloadCount', key: 'downloadCount' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => new Date(v).toLocaleDateString() },
    {
      title: '操作', key: 'action',
      render: (_: unknown, record: Skill) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/admin/skills/${record.id}`)}>详情</Button>
          {record.status === 'pending' && (
            <>
              <Button size="small" type="primary" onClick={() => handleReview(record, 'approved')}>通过</Button>
              <Button size="small" danger onClick={() => handleReview(record, 'rejected')}>拒绝</Button>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="搜索技能名称"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 200 }}
          />
          <Select
            placeholder="分类筛选"
            allowClear
            value={categoryFilter}
            onChange={setCategoryFilter}
            style={{ width: 150 }}
            options={categories.map(c => ({ value: c.id, label: c.name }))}
          />
        </Space>

        <Tabs activeKey={statusFilter} onChange={key => { setStatusFilter(key); setPage(1) }} items={[
          { key: 'pending', label: '待审核' },
          { key: 'approved', label: '已通过' },
          { key: 'rejected', label: '已拒绝' },
          { key: '', label: '全部' },
        ]} />

        {selectedRowKeys.length > 0 && (
          <Card size="small" style={{ marginBottom: 16, background: '#f5f5f5' }}>
            <Space>
              <span>已选择 {selectedRowKeys.length} 项</span>
              <Button size="small" type="primary" onClick={() => handleBatchReview('approved')}>批量通过</Button>
              <Button size="small" danger onClick={() => handleBatchReview('rejected')}>批量拒绝</Button>
              <Popconfirm title="确定删除选中的技能吗？" onConfirm={handleBatchDelete}>
                <Button size="small" danger>批量删除</Button>
              </Popconfirm>
              <Button size="small" onClick={() => setSelectedRowKeys([])}>取消选择</Button>
            </Space>
          </Card>
        )}

        <Table
          dataSource={skills}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[])
          }}
        />
      </Card>

      <Modal title={currentSkill?.status === 'pending' ? '审核技能' : '编辑技能'} open={reviewModal} onOk={submitReview} onCancel={() => setReviewModal(false)}>
        <Form form={reviewForm} layout="vertical">
          <Form.Item name="status" label="审核结果">
            <Select>
              <Select.Option value="approved">通过</Select.Option>
              <Select.Option value="rejected">拒绝</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="rejectReason" label="拒绝原因（拒绝时填写）">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="批量审核" open={batchModal} onOk={submitBatchReview} onCancel={() => setBatchModal(false)}>
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
    </div>
  )
}

export default AdminSkills
