import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Table, Card, Tag, Space, message, Typography, Select, Button } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getAllExecutions, getTasks, type TaskExecution, type Task } from '../../services/api'

const statusColors: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'success',
  failed: 'error'
}

const statusLabels: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败'
}

const triggerTypeLabels: Record<string, string> = {
  manual: '手动',
  schedule: '定时',
  webhook: 'Webhook'
}

function formatTriggerInfo(record: TaskExecution): string {
  if (record.triggerType === 'manual' && record.triggeredByUser) {
    return record.triggeredByUser.displayName || record.triggeredByUser.username
  }
  
  if (record.triggerType === 'schedule' && record.startedAt) {
    return new Date(record.startedAt).toLocaleString()
  }
  
  return triggerTypeLabels[record.triggerType] || record.triggerType || '-'
}

function TaskExecutionsGlobal() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [executions, setExecutions] = useState<TaskExecution[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(() => {
    return searchParams.get('taskId') || undefined
  })

  const fetchTasks = async () => {
    try {
      const result = await getTasks({ page: 1, pageSize: 1000 })
      setTasks(result.items)
    } catch {
      // ignore
    }
  }

  const fetchExecutions = async () => {
    setLoading(true)
    try {
      const result = await getAllExecutions({ page, pageSize, taskId: selectedTaskId })
      setExecutions(result.items)
      setTotal(result.total)
    } catch {
      message.error('加载执行记录失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  useEffect(() => {
    fetchExecutions()
  }, [page, pageSize, selectedTaskId])

  const handleViewDetail = (executionId: string) => {
    navigate(`/admin/executions/${executionId}`)
  }

  const getTaskName = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    return task?.name || taskId
  }

  const columns: ColumnsType<TaskExecution> = [
    {
      title: '执行ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => (
        <Typography.Link onClick={() => navigate(`/admin/executions/${id}`)}>
          {id.slice(0, 8)}
        </Typography.Link>
      )
    },
    {
      title: '任务名称',
      dataIndex: 'taskId',
      key: 'taskId',
      width: 200,
      render: (taskId: string) => (
        <Typography.Link onClick={() => navigate(`/admin/tasks/${taskId}`)}>
          {getTaskName(taskId)}
        </Typography.Link>
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
      title: '触发类型',
      dataIndex: 'triggerType',
      key: 'triggerType',
      width: 100,
      render: (type: string) => triggerTypeLabels[type] || type || '-'
    },
    {
      title: '触发者',
      key: 'triggeredBy',
      width: 150,
      render: (_, record) => formatTriggerInfo(record)
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
        <Typography.Link onClick={() => handleViewDetail(record.id)}>
          查看详情
        </Typography.Link>
      )
    }
  ]
  return (
    <Card
      title="执行记录"
      extra={
        <Space>
          <Select
            allowClear
            placeholder="按任务筛选"
            style={{ width: 200 }}
            value={selectedTaskId}
            onChange={(value) => {
              setSelectedTaskId(value)
              setPage(1)
            }}
            options={tasks.map(t => ({ value: t.id, label: t.name }))}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchExecutions}>
            刷新
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

export default TaskExecutionsGlobal
