import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Card, Tag, Select, Tooltip, Empty, message, Button, Modal } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { getMySkillVersions, submitSkillVersion, cancelSkillVersion, type MyPendingVersion } from '../../services/api'
import './MySkills.css'

const statusColors: Record<string, string> = {
  draft: 'default',
  pending: 'orange',
  approved: 'green',
  rejected: 'red'
}

const statusLabels: Record<string, string> = {
  draft: '草稿',
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝'
}

const versionTypeLabels: Record<string, string> = {
  major: '大版本',
  minor: '小版本',
  patch: '补丁'
}

function MySkillVersions() {
  const navigate = useNavigate()
  const [versions, setVersions] = useState<MyPendingVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('pending')

  useEffect(() => {
    loadVersions()
  }, [statusFilter])

  const loadVersions = () => {
    setLoading(true)
    getMySkillVersions(statusFilter || undefined)
      .then(result => setVersions(result.items))
      .catch(() => message.error('加载版本列表失败'))
      .finally(() => setLoading(false))
  }

  const handleSubmit = async (versionId: string) => {
    Modal.confirm({
      title: '确认提交审核？',
      content: '提交后将等待管理员审核',
      onOk: async () => {
        try {
          await submitSkillVersion(versionId)
          message.success('已提交审核')
          loadVersions()
        } catch (error) {
          message.error(error instanceof Error ? error.message : '提交失败')
        }
      }
    })
  }

  const handleCancel = async (versionId: string) => {
    Modal.confirm({
      title: '确认取消审核？',
      content: '取消后版本将变回草稿状态',
      onOk: async () => {
        try {
          await cancelSkillVersion(versionId)
          message.success('已取消审核')
          loadVersions()
        } catch (error) {
          message.error(error instanceof Error ? error.message : '取消失败')
        }
      }
    })
  }

  const columns: ColumnsType<MyPendingVersion> = [
    {
      title: '技能名称',
      dataIndex: 'skillName',
      key: 'skillName',
      width: 200,
      ellipsis: true,
      render: (name: string, record) => (
        <span
          style={{ color: '#1890ff', cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); navigate(`/skills/my/${record.skillSlug}`) }}
        >
          {name}
        </span>
      )
    },
    {
      title: 'Slug',
      dataIndex: 'skillSlug',
      key: 'skillSlug',
      width: 150,
      ellipsis: true,
      render: (slug: string, record) => (
        <span
          style={{ color: '#1890ff', cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); navigate(`/skills/my/versions/${record.id}`) }}
        >
          {slug}
        </span>
      )
    },
    {
      title: '显示名',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 150,
      ellipsis: true,
      render: (name: string | null) => name || '-'
    },
    {
      title: '版本号',
      dataIndex: 'version',
      key: 'version',
      width: 100,
      render: (version: string, record) => (
        <Tag
          style={{ cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); navigate(`/skills/my/versions/${record.id}`) }}
        >
          v{version}
        </Tag>
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
      title: '拒绝原因',
      dataIndex: 'rejectReason',
      key: 'rejectReason',
      width: 150,
      ellipsis: true,
      render: (reason: string | null) => reason ? (
        <Tooltip title={reason}>
          <span style={{ color: '#ff4d4f' }}>{reason}</span>
        </Tooltip>
      ) : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: MyPendingVersion) => {
        if (record.status === 'draft') {
          return (
            <Button 
              type="link" 
              size="small"
              onClick={(e) => { e.stopPropagation(); handleSubmit(record.id) }}
            >
              提交审核
            </Button>
          )
        }
        if (record.status === 'pending') {
          return (
            <Button 
              type="link" 
              size="small"
              onClick={(e) => { e.stopPropagation(); handleCancel(record.id) }}
            >
              取消
            </Button>
          )
        }
        return '-'
      }
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString()
    }
  ]

  return (
    <div className="skill-my-page">
      <Card 
        title="技能版本"
        extra={
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            style={{ width: 120 }}
            options={[
              { value: 'draft', label: '草稿' },
              { value: 'pending', label: '待审核' },
              { value: 'approved', label: '已通过' },
              { value: 'rejected', label: '已拒绝' },
              { value: '', label: '全部状态' }
            ]}
          />
        }
      >
        <Table
          dataSource={versions}
          columns={columns}
          rowKey="id"
          loading={loading}
          locale={{ emptyText: <Empty description="暂无版本记录" /> }}
          onRow={(record) => ({
            onClick: () => navigate(`/skills/my/versions/${record.id}`),
            style: { cursor: 'pointer' }
          })}
          pagination={versions.length > 15 ? {
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          } : false}
        />
      </Card>
    </div>
  )
}

export default MySkillVersions
