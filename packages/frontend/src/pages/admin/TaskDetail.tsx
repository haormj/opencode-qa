import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ReactFlow, ReactFlowProvider, Controls, Background, MiniMap, Panel } from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, Descriptions, Button, Space, Tag, message, Spin, Typography } from 'antd'
import { EditOutlined, PlayCircleOutlined, HistoryOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { getTask, executeTask, type Task } from '../../services/api'

const triggerTypeLabels: Record<string, string> = {
  manual: '手动执行',
  schedule: '定时触发',
  webhook: 'Webhook 触发'
}

const statusColors = {
  active: 'green',
  inactive: 'default'
}

function TaskDetailContent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [task, setTask] = useState<Task | null>(null)
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])

  useEffect(() => {
    if (!id) return

    setLoading(true)
    getTask(id)
      .then((data: Task) => {
        setTask(data)
        if (data.flowData) {
          try {
            const flowData = JSON.parse(data.flowData)
            if (flowData.nodes) setNodes(flowData.nodes)
            if (flowData.edges) setEdges(flowData.edges)
          } catch {
            console.error('Failed to parse flow data')
          }
        }
      })
      .catch(() => {
        message.error('加载任务失败')
        navigate('/admin/tasks')
      })
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleExecute = async () => {
    if (!id) return
    try {
      const result = await executeTask(id)
      message.success(`任务已开始执行，执行ID: ${result.executionId}`)
      navigate(`/admin/tasks/${id}/executions`)
    } catch {
      message.error('执行失败')
    }
  }

  if (loading) {
    return (
      <Card>
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      </Card>
    )
  }

  if (!task) {
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/tasks')}>
              返回
            </Button>
            <Typography.Title level={4} className="!mb-0">
              任务详情
            </Typography.Title>
          </Space>
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => navigate(`/admin/tasks/${id}/edit`)}
            >
              编辑
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecute}
            >
              执行
            </Button>
            <Button
              icon={<HistoryOutlined />}
              onClick={() => navigate(`/admin/tasks/${id}/executions`)}
            >
              执行记录
            </Button>
          </Space>
        </div>

        <Descriptions column={2} bordered>
          <Descriptions.Item label="任务名称">{task.name}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={task.isActive ? statusColors.active : statusColors.inactive}>
              {task.isActive ? '启用' : '禁用'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="触发类型">
            {triggerTypeLabels[task.triggerType] || task.triggerType}
          </Descriptions.Item>
          <Descriptions.Item label="调度配置">
            {task.triggerType === 'schedule' && task.scheduleConfig
              ? task.scheduleConfig
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {task.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {new Date(task.createdAt).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {new Date(task.updatedAt).toLocaleString()}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="流程图">
        <div className="h-[400px]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
          >
            <Controls showInteractive={false} />
            <MiniMap />
            <Background />
            <Panel position="top-center">
              <Typography.Text type="secondary">
                只读视图
              </Typography.Text>
            </Panel>
          </ReactFlow>
        </div>
      </Card>
    </div>
  )
}

function TaskDetail() {
  return (
    <ReactFlowProvider>
      <TaskDetailContent />
    </ReactFlowProvider>
  )
}

export default TaskDetail
