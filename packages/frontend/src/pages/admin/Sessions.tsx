import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Table, Card, Tag, Input, Select, Button, Space, Avatar, Tooltip, message, Popconfirm } from 'antd'
import { SearchOutlined, EyeOutlined, PoweroffOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getAdminSessions, closeAdminSession, getAssistants, generateAvatarColor, type AdminSession, type Assistant } from '../../services/api'
import './Admin.css'

const statusColors: Record<string, string> = {
  active: 'green',
  human: 'orange',
  closed: 'default'
}

const statusLabels: Record<string, string> = {
  active: '进行中',
  human: '待人工',
  closed: '已关闭'
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
  const [needHumanFilter, setNeedHumanFilter] = useState<boolean | undefined>(undefined)
  const [assistantFilter, setAssistantFilter] = useState<string | undefined>(undefined)
  const [assistants, setAssistants] = useState<Assistant[]>([])

  useEffect(() => {
    getAssistants().then(setAssistants).catch(() => {})
  }, [])

  const fetchSessions = async () => {
    setLoading(true)
    try {
      const result = await getAdminSessions({
        status: statusFilter,
        search: searchText || undefined,
        needHuman: needHumanFilter,
        assistantId: assistantFilter,
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
  }, [page, pageSize, statusFilter, needHumanFilter, assistantFilter])

  const handleSearch = () => {
    setPage(1)
    fetchSessions()
  }

  const handleCloseSession = async (sessionId: string) => {
    try {
      await closeAdminSession(sessionId)
      message.success('会话已关闭')
      fetchSessions()
    } catch {
      message.error('关闭会话失败')
    }
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
      title: '助手',
      dataIndex: 'assistant',
      key: 'assistant',
      width: 120,
      render: (assistant: AdminSession['assistant']) => assistant?.name || '-'
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
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/admin/sessions/${record.id}`)}
            />
          </Tooltip>
          {record.status !== 'closed' && (
            <Popconfirm
              title="确定关闭该会话？"
              description="关闭后用户将无法继续发送消息"
              onConfirm={() => handleCloseSession(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="关闭会话">
                <Button
                  type="text"
                  danger
                  icon={<PoweroffOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
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
              { value: 'human', label: '待人工' },
              { value: 'closed', label: '已关闭' }
            ]}
          />
          <Select
            placeholder="AI无法解决"
            value={needHumanFilter}
            onChange={(value) => {
              setNeedHumanFilter(value)
              setPage(1)
            }}
            allowClear
            style={{ width: 130 }}
            options={[
              { value: true, label: '是' },
              { value: false, label: '否' }
            ]}
          />
          <Select
            placeholder="助手筛选"
            value={assistantFilter}
            onChange={(value) => {
              setAssistantFilter(value)
              setPage(1)
            }}
            allowClear
            style={{ width: 150 }}
            options={assistants.map(a => ({ value: a.id, label: a.name }))}
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
