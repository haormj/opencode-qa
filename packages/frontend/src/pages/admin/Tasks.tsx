import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Card, Button, Space, Tag, Switch, Popconfirm, Tooltip, message, Typography } from 'antd'
import { PlusOutlined, EditOutlined, PlayCircleOutlined, HistoryOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getTasks, deleteTask, toggleTask, executeTask, type Task } from '../../services/api'
import './Admin.css'

const scheduleTypeColors: Record<string, string> = {
  none: 'default',
  cron: 'blue',
  interval: 'green'
}

const scheduleTypeLabels: Record<string, string> = {
  none: '手动',
  cron: '定时',
  interval: '间隔'
}

function Tasks() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const result = await getTasks({ page, pageSize })
      setTasks(result.items)
      setTotal(result.total)
    } catch {
      message.error('加载任务列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [page, pageSize])

  const handleToggle = async (task: Task) => {
    try {
      await toggleTask(task.id)
      message.success(task.isActive ? '任务已禁用' : '任务已启用')
      fetchTasks()
    } catch {
      message.error('操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteTask(id)
      message.success('删除成功')
      fetchTasks()
    } catch {
      message.error('删除失败')
    }
  }

  const handleExecute = async (id: string) => {
    try {
      const result = await executeTask(id)
      message.success(`任务已开始执行，执行ID: ${result.executionId}`)
    } catch {
      message.error('执行失败')
    }
  }

  const columns: ColumnsType<Task> = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text, record) => (
        <Typography.Link onClick={() => navigate(`/admin/tasks/${record.id}/edit`)}>
          {text}
        </Typography.Link>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 250,
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: '调度类型',
      dataIndex: 'scheduleType',
      key: 'scheduleType',
      width: 100,
      render: (type: string) => (
        <Tag color={scheduleTypeColors[type] || 'default'}>
          {scheduleTypeLabels[type] || type}
        </Tag>
      )
    },
    {
      title: '启用状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (active: boolean, record) => (
        <Switch
          checked={active}
          onChange={() => handleToggle(record)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      )
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
      width: 160,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => navigate(`/admin/tasks/${record.id}/edit`)}
            />
          </Tooltip>
          <Tooltip title="执行">
            <Button
              type="text"
              icon={<PlayCircleOutlined />}
              onClick={() => handleExecute(record.id)}
            />
          </Tooltip>
          <Tooltip title="执行记录">
            <Button
              type="text"
              icon={<HistoryOutlined />}
              onClick={() => navigate(`/admin/tasks/${record.id}/executions`)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description="确定要删除此任务吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <Card
      title="任务管理"
      extra={
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/admin/tasks/create')}>
            新建任务
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={tasks}
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

export default Tasks
