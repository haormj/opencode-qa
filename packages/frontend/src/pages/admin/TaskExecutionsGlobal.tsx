import { useState, useEffect } from 'react'
import { Table, Card, Tag, Space, message, Typography, Modal, List, Empty, Spin, Select } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getAllExecutions, getExecutionMessages, getTasks, type TaskExecution, type ExecutionMessage, type Task } from '../../services/api'

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

function TaskExecutionsGlobal() {
  const [loading, setLoading] = useState(false)
  const [executions, setExecutions] = useState<TaskExecution[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedExecution, setSelectedExecution] = useState<TaskExecution | null>(null)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messages, setMessages] = useState<ExecutionMessage[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined)

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

  const handleViewMessages = async (execution: TaskExecution) => {
    setSelectedExecution(execution)
    setModalVisible(true)
    setMessagesLoading(true)
    setMessages([])

    try {
      const result = await getExecutionMessages(execution.id)
      setMessages(result)
    } catch {
      message.error('加载执行消息失败')
    } finally {
      setMessagesLoading(false)
    }
  }

  const getTaskName = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    return task?.name || taskId
  }

  const columns: ColumnsType<TaskExecution> = [
    {
      title: '任务名称',
      dataIndex: 'taskId',
      key: 'taskId',
      width: 200,
      render: (taskId: string) => (
        <Typography.Link onClick={() => setSelectedTaskId(taskId)}>
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
        <Typography.Link onClick={() => handleViewMessages(record)}>
          查看详情
        </Typography.Link>
      )
    }
  ]

  const roleColors: Record<string, string> = {
    user: 'blue',
    assistant: 'green',
    system: 'orange'
  }

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
          <Tag
            className="cursor-pointer"
            onClick={fetchExecutions}
          >
            <ReloadOutlined /> 刷新
          </Tag>
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

      <Modal
        title={`执行详情 - ${selectedExecution?.id || ''}`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedExecution && (
          <div className="mb-4">
            <Space>
              <Tag color={statusColors[selectedExecution.status]}>
                {statusLabels[selectedExecution.status]}
              </Tag>
              {selectedExecution.startedAt && (
                <Typography.Text type="secondary">
                  开始: {new Date(selectedExecution.startedAt).toLocaleString()}
                </Typography.Text>
              )}
              {selectedExecution.completedAt && (
                <Typography.Text type="secondary">
                  完成: {new Date(selectedExecution.completedAt).toLocaleString()}
                </Typography.Text>
              )}
            </Space>
          </div>
        )}

        {messagesLoading ? (
          <div className="flex justify-center py-8">
            <Spin />
          </div>
        ) : messages.length > 0 ? (
          <List
            dataSource={messages}
            renderItem={(item) => (
              <List.Item>
                <div className="w-full">
                  <div className="mb-2">
                    <Tag color={roleColors[item.role] || 'default'}>
                      {item.role}
                    </Tag>
                    <Typography.Text type="secondary" className="ml-2 text-xs">
                      {new Date(item.createdAt).toLocaleString()}
                    </Typography.Text>
                  </div>
                  <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap break-words">
                    {item.content}
                  </div>
                </div>
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无执行消息" />
        )}
      </Modal>
    </Card>
  )
}

export default TaskExecutionsGlobal
