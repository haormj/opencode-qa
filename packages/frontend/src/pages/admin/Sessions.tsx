import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Table, Card, Tag, Input, Select, Button, Space, Avatar, Tooltip, message } from 'antd'
import { SearchOutlined, EyeOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getAdminSessions, generateAvatarColor, type AdminSession } from '../../services/api'
import './Admin.css'

const statusColors: Record<string, string> = {
  active: 'green',
  need_human: 'orange',
  resolved: 'blue'
}

const statusLabels: Record<string, string> = {
  active: '进行中',
  need_human: '待人工',
  resolved: '已解决'
}

function AdminSessions() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [sessions, setSessions] = useState<AdminSession[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    searchParams.get('status') || undefined
  )

  const fetchSessions = async () => {
    setLoading(true)
    try {
      const result = await getAdminSessions({
        status: statusFilter,
        search: searchText || undefined,
        page,
        pageSize
      })
      setSessions(result.items)
      setTotal(result.total)
    } catch (error) {
      message.error('加载会话列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [page, pageSize, statusFilter])

  const handleSearch = () => {
    setPage(1)
    fetchSessions()
  }

  const columns: ColumnsType<AdminSession> = [
    {
      title: '会话标题',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      ellipsis: true,
      render: (title: string, record) => (
        <span
          style={{
            color: '#1890ff',
            cursor: 'pointer'
          }}
          onClick={() => navigate(`/admin/sessions/${record.id}`)}
        >
          {title}
        </span>
      )
    },
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
      width: 150,
      render: (user: AdminSession['user']) => (
        <Space>
          <Avatar
            size="small"
            style={{ backgroundColor: generateAvatarColor(user.displayName) }}
          >
            {user.displayName[0]}
          </Avatar>
          <span>{user.displayName}</span>
        </Space>
      )
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
      title: '问题数',
      dataIndex: 'questionCount',
      key: 'questionCount',
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
      width: 80,
      render: (_, record) => (
        <Tooltip title="查看详情">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/admin/sessions/${record.id}`)}
          />
        </Tooltip>
      )
    }
  ]

  return (
    <Card
      title="会话管理"
      extra={
        <Space>
          <Input
            placeholder="搜索会话标题"
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
              { value: 'active', label: '进行中' },
              { value: 'need_human', label: '待人工' },
              { value: 'resolved', label: '已解决' }
            ]}
          />
          <Button type="primary" onClick={handleSearch}>
            搜索
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={sessions}
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
  )
}

export default AdminSessions
