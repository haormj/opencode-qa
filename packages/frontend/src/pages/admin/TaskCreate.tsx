import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ReactFlow, ReactFlowProvider, useNodesState, useEdgesState, addEdge, Controls, Background, MiniMap, Panel, useReactFlow } from '@xyflow/react'
import type { Connection, Node, Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, Form, Input, Select, Button, Space, message, Typography, Divider, InputNumber } from 'antd'
import { SaveOutlined, PlayCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { getTask, createTask, updateTask, type Task } from '../../services/api'

const scheduleTypeOptions = [
  { value: 'none', label: '手动执行' },
  { value: 'cron', label: '定时任务 (Cron)' },
  { value: 'interval', label: '间隔执行' }
]

const initialNodes: Node[] = []
const initialEdges: Edge[] = []

function TaskEditorContent() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()

  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [scheduleType, setScheduleType] = useState<string>('none')

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  useEffect(() => {
    if (isEdit && id) {
      setLoading(true)
      getTask(id)
        .then((task: Task) => {
          form.setFieldsValue({
            name: task.name,
            description: task.description,
            scheduleType: task.scheduleType,
            scheduleConfig: task.scheduleConfig
          })
          setScheduleType(task.scheduleType)
          if (task.flowData) {
            try {
              const flowData = JSON.parse(task.flowData)
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
    }
  }, [id, isEdit, form, navigate, setNodes, setEdges])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const flowData = JSON.stringify({ nodes, edges })
      const data = {
        ...values,
        flowData,
        scheduleConfig: values.scheduleType !== 'none' ? values.scheduleConfig : null
      }

      if (isEdit && id) {
        await updateTask(id, data)
        message.success('更新成功')
      } else {
        await createTask(data)
        message.success('创建成功')
        navigate('/admin/tasks')
      }
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleExecute = async () => {
    if (isEdit && id) {
      try {
        await handleSave()
        navigate(`/admin/tasks/${id}/executions`)
      } catch {
        // Error already handled in handleSave
      }
    }
  }

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow')
      if (!type) return

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      })

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: 'default',
        position,
        data: { label: type }
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [screenToFlowPosition, setNodes]
  )

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  if (loading) {
    return <Card loading />
  }

  return (
    <div className="flex h-[calc(100vh-120px)]">
      <div className="w-64 border-r bg-gray-50 p-4 overflow-auto">
        <Typography.Title level={5} className="mb-4">
          {isEdit ? '编辑任务' : '新建任务'}
        </Typography.Title>
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="任务名称"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="请输入任务名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入任务描述" />
          </Form.Item>
        </Form>

        <Divider className="my-4" />

        <Typography.Title level={5} className="mb-4">
          节点库
        </Typography.Title>
        <div className="space-y-2">
          {['开始', '结束', 'API调用', '条件判断', '消息发送'].map((type) => (
            <div
              key={type}
              className="p-2 bg-white border rounded cursor-move hover:border-blue-400"
              draggable
              onDragStart={(e) => onDragStart(e, type)}
            >
              {type}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="h-12 border-b bg-white flex items-center px-4 justify-between">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/tasks')}>
              返回
            </Button>
          </Space>
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
            >
              保存
            </Button>
            {isEdit && (
              <Button
                icon={<PlayCircleOutlined />}
                onClick={handleExecute}
              >
                保存并执行
              </Button>
            )}
          </Space>
        </div>

        <div className="flex-1" ref={reactFlowWrapper}>
          <div
            className="w-full h-full"
            onDrop={onDrop}
            onDragOver={onDragOver}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
            >
              <Controls />
              <MiniMap />
              <Background />
              <Panel position="top-center">
                <Typography.Text type="secondary">
                  拖拽左侧节点到画布中创建流程
                </Typography.Text>
              </Panel>
            </ReactFlow>
          </div>
        </div>
      </div>

      <div className="w-80 border-l bg-gray-50 p-4 overflow-auto">
        <Typography.Title level={5} className="mb-4">
          调度配置
        </Typography.Title>
        <Form form={form} layout="vertical">
          <Form.Item
            name="scheduleType"
            label="调度类型"
            rules={[{ required: true }]}
          >
            <Select
              options={scheduleTypeOptions}
              onChange={(value) => setScheduleType(value)}
            />
          </Form.Item>
          {scheduleType === 'cron' && (
            <Form.Item
              name="scheduleConfig"
              label="Cron 表达式"
              rules={[{ required: true, message: '请输入 Cron 表达式' }]}
              extra="例如: 0 0 * * * (每天凌晨执行)"
            >
              <Input placeholder="0 0 * * *" />
            </Form.Item>
          )}
          {scheduleType === 'interval' && (
            <Form.Item
              name="scheduleConfig"
              label="间隔时间(分钟)"
              rules={[{ required: true, message: '请输入间隔时间' }]}
            >
              <InputNumber min={1} className="w-full" placeholder="60" />
            </Form.Item>
          )}
        </Form>
      </div>
    </div>
  )
}

function TaskCreate() {
  return (
    <ReactFlowProvider>
      <TaskEditorContent />
    </ReactFlowProvider>
  )
}

export default TaskCreate
