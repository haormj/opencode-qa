import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Card, Tag, Select, Button, Space, message, Popconfirm, Modal, Form, Input, Tooltip } from 'antd'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getAdminSkillVersions, approveSkillVersion, rejectSkillVersion, type AdminSkillVersion } from '../../services/api'
import './Admin.css'

const statusColors: Record<string, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red'
}

const statusLabels: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝'
}

const versionTypeLabels: Record<string, string> = {
  major: '大版本',
  minor: '小版本',
  patch: '补丁'
}

function SkillVersions() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [versions, setVersions] = useState<AdminSkillVersion[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [statusFilter, setStatusFilter] = useState<string>('pending')

  const [rejectModal, setRejectModal] = useState(false)
  const [currentVersion, setCurrentVersion] = useState<AdminSkillVersion | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const fetchVersions = async () => {
    setLoading(true)
    try {
      const result = await getAdminSkillVersions({
        status: statusFilter || undefined,
        page,
        pageSize
      })
      setVersions(result.items)
      setTotal(result.total)
    } catch {
      message.error('加载版本列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVersions()
  }, [page, pageSize, statusFilter])

  const handleApprove = async (version: AdminSkillVersion) => {
    try {
      await approveSkillVersion(version.id)
      message.success('版本已通过')
      fetchVersions()
    } catch {
      message.error('操作失败')
    }
  }

  const openRejectModal = (version: AdminSkillVersion) => {
    setCurrentVersion(version)
    setRejectReason('')
    setRejectModal(true)
  }

  const handleReject = async () => {
    if (!currentVersion || !rejectReason.trim()) {
      message.error('请填写拒绝原因')
      return
    }
    try {
      await rejectSkillVersion(currentVersion.id, rejectReason.trim())
      message.success('版本已拒绝')
      setRejectModal(false)
      fetchVersions()
    } catch {
      message.error('操作失败')
    }
  }

  const columns: ColumnsType<AdminSkillVersion> = [
    {
      title: '技能名称',
      dataIndex: 'skillName',
      key: 'skillName',
      width: 200,
      ellipsis: true,
      render: (name: string, record) => (
        <a onClick={() => navigate(`/admin/skills/${record.skillId}`)}>{name}</a>
      )
    },
    {
      title: '版本号',
      dataIndex: 'version',
      key: 'version',
      width: 100,
      render: (version: string, record) => (
        <a onClick={() => navigate(`/admin/skill-versions/${record.id}`)}>
          <Tag>v{version}</Tag>
        </a>
      )
    },
    {
      title: '类型',
      dataIndex: 'versionType',
      key: 'versionType',
      width: 80,
      render: (type: string) => versionTypeLabels[type] || type
    },
    {
      title: '变更说明',
      dataIndex: 'changeLog',
      key: 'changeLog',
      width: 200,
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        <Tag color={statusColors[status]}>{statusLabels[status] || status}</Tag>
      )
    },
    {
      title: '提交者',
      dataIndex: 'creatorName',
      key: 'creatorName',
      width: 100
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Space>
          {record.status === 'pending' && (
            <>
              <Popconfirm title="确定通过该版本？" onConfirm={() => handleApprove(record)}>
                <Tooltip title="通过">
                  <Button type="text" icon={<CheckOutlined />} />
                </Tooltip>
              </Popconfirm>
              <Tooltip title="拒绝">
                <Button type="text" danger icon={<CloseOutlined />} onClick={() => openRejectModal(record)} />
              </Tooltip>
            </>
          )}
        </Space>
      )
    }
  ]

  return (
    <div className="admin-page">
      <Card 
        title="技能版本"
        extra={
          <Space>
            <Select
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1) }}
              style={{ width: 120 }}
              options={[
                { value: '', label: '全部状态' },
                { value: 'pending', label: '待审核' },
                { value: 'approved', label: '已通过' },
                { value: 'rejected', label: '已拒绝' }
              ]}
            />
          </Space>
        }
      >
        <Table
          dataSource={versions}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) }
          }}
        />
      </Card>

      <Modal
        title="拒绝版本"
        open={rejectModal}
        onOk={handleReject}
        onCancel={() => setRejectModal(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form.Item label="拒绝原因" required>
          <Input.TextArea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="请填写拒绝原因"
            rows={3}
          />
        </Form.Item>
      </Modal>
    </div>
  )
}

export default SkillVersions
