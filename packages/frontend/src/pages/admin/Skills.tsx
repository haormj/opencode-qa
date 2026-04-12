import { useState, useEffect } from 'react'
import { Table, Tag, Button, Modal, Form, Select, Input, message, Tabs } from 'antd'
import { getAdminSkills, reviewSkill, type Skill } from '../../services/api'

function AdminSkills() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [reviewModal, setReviewModal] = useState(false)
  const [currentSkill, setCurrentSkill] = useState<Skill | null>(null)
  const [reviewForm] = Form.useForm()

  const fetchSkills = async (p: number, status: string) => {
    setLoading(true)
    try {
      const result = await getAdminSkills({ page: p, pageSize: 20, status })
      setSkills(result.items)
      setTotal(result.total)
    } catch {
      message.error('加载技能列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSkills(page, statusFilter)
  }, [page, statusFilter])

  const handleReview = (skill: Skill, status: 'approved' | 'rejected') => {
    setCurrentSkill(skill)
    reviewForm.setFieldsValue({
      status,
      name: skill.name,
      displayName: skill.displayName,
    })
    setReviewModal(true)
  }

  const submitReview = async () => {
    if (!currentSkill) return
    try {
      const values = await reviewForm.validateFields()
      await reviewSkill(currentSkill.id, values)
      message.success('审核完成')
      setReviewModal(false)
      fetchSkills(page, statusFilter)
    } catch {
      message.error('审核失败')
    }
  }

  const statusColors: Record<string, string> = { pending: 'orange', approved: 'green', rejected: 'red' }
  const statusLabels: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }

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
        <span style={{ display: 'flex', gap: 4 }}>
          {record.status === 'pending' && (
            <>
              <Button size="small" type="primary" onClick={() => handleReview(record, 'approved')}>通过</Button>
              <Button size="small" danger onClick={() => handleReview(record, 'rejected')}>拒绝</Button>
            </>
          )}
          {record.status === 'approved' && (
            <Button size="small" onClick={() => handleReview(record, 'approved')}>编辑</Button>
          )}
        </span>
      ),
    },
  ]

  return (
    <div>
      <h2>技能审核</h2>
      <Tabs activeKey={statusFilter} onChange={key => { setStatusFilter(key); setPage(1) }} items={[
        { key: 'pending', label: '待审核' },
        { key: 'approved', label: '已通过' },
        { key: 'rejected', label: '已拒绝' },
        { key: '', label: '全部' },
      ]} />
      <Table
        dataSource={skills}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
      />
      <Modal
        title={currentSkill?.status === 'pending' ? '审核技能' : '编辑技能'}
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
          <Form.Item name="rejectReason" label="拒绝原因（拒绝时填写）">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="name" label="技能名称">
            <Input />
          </Form.Item>
          <Form.Item name="displayName" label="展示名称">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AdminSkills