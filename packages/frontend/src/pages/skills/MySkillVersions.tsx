import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Card, Tag, Select, Tooltip, Empty, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { getMySkillVersions, type MyPendingVersion } from '../../services/api'
import './MySkills.css'

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
