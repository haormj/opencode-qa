import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Table, Card, Button, Tag, Space, message } from 'antd'
import { ArrowLeftOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getTaskExecutions, type TaskExecution } from '../../services/api'

const statusColors: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  success: 'success',
  failed: 'error'
}

const statusLabels: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  success: '成功',
  failed: '失败'
}

const triggerTypeLabels: Record<string, string> = {
  manual: '手动',
  schedule: '定时'
}

function TaskExecutions() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [executions, setExecutions] = useState<TaskExecution[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const fetchExecutions = async () => {
    if (!id) return

    setLoading(true)
    try {
      const result = await getTaskExecutions(id, { page, pageSize })
      setExecutions(result.items)
      setTotal(result.total)
    } catch {
      message.error('加载执行记录失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExecutions()
  }, [id, page, pageSize])

  const handleViewDetail = (executionId: string) => {
    navigate(`/admin/executions/${executionId}`)
  }

  const columns: ColumnsType<TaskExecution> = [
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
      title: '触发类型',
      dataIndex: 'triggerType',
      key: 'triggerType',
      width: 100,
      render: (type: string) => triggerTypeLabels[type] || type || '-'
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 180,
      render: (date: string | null) => date ? new Date(date).toLocaleString() : '-'
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 180,
      render: (date: string | null) => date ? new Date(date).toLocaleString() : '-'
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record.id)}
        >
          查看详情
        </Button>
      )
    }
  ]
  return (
    <Card
      title="执行记录"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchExecutions}>
            刷新
          </Button>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/tasks')}>
            返回任务列表
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={executions}
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

export default TaskExecutions
