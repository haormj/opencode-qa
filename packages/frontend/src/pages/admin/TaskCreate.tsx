import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ReactFlow, ReactFlowProvider, useNodesState, useEdgesState, addEdge, Controls, Background, MiniMap, Panel, useReactFlow } from '@xyflow/react'
import type { Connection, Node, Edge, NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, Form, Input, Select, Button, message, Typography, Divider, InputNumber } from 'antd'
import { SaveOutlined, PlayCircleOutlined, ArrowLeftOutlined, MenuFoldOutlined, MenuUnfoldOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons'
import { getTask, createTask, updateTask, type Task } from '../../services/api'

import SkillInstallNode from '../../components/TaskFlow/nodes/SkillInstallNode'
import CodeDownloadNode from '../../components/TaskFlow/nodes/CodeDownloadNode'
import StepNode from '../../components/TaskFlow/nodes/StepNode'
import OutputNode from '../../components/TaskFlow/nodes/OutputNode'

const nodeTypes: NodeTypes = {
  skillInstall: SkillInstallNode,
  codeDownload: CodeDownloadNode,
  step: StepNode,
  output: OutputNode,
}

const nodeLibrary = [
  { type: 'skillInstall', label: '技能安装', icon: '📦' },
  { type: 'codeDownload', label: '代码下载', icon: '📥' },
  { type: 'step', label: '步骤定义', icon: '📝' },
  { type: 'output', label: '输出配置', icon: '📤' },
]

function getDefaultNodeData(type: string): Record<string, unknown> {
  switch (type) {
    case 'skillInstall':
      return { skillId: '', skillName: '', skillSlug: '' }
    case 'codeDownload':
      return { repoUrl: '', username: '', password: '', branch: 'main', targetPath: '/tmp/repo' }
    case 'step':
      return { name: '', instruction: '' }
    case 'output':
      return { type: 'email', config: { to: '', subject: '' } }
    default:
      return {}
  }
}

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
  const [leftPanelVisible, setLeftPanelVisible] = useState(true)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)

  // 键盘删除功能
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const activeElement = document.activeElement
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          return
        }
        
        const selectedNodes = nodes.filter(n => n.selected)
        if (selectedNodes.length > 0) {
          setNodes(nodes.filter(n => !n.selected))
          setEdges(edges.filter(e =>
            !selectedNodes.some(n => n.id === e.source || n.id === e.target)
          ))
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nodes, edges, setNodes, setEdges])

  // 右键菜单
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id })
  }, [])

  const onPaneClick = useCallback(() => {
    setContextMenu(null)
  }, [])

  const handleDeleteNode = useCallback(() => {
    if (contextMenu?.nodeId) {
      setNodes(nodes.filter(n => n.id !== contextMenu.nodeId))
      setEdges(edges.filter(e =>
        e.source !== contextMenu.nodeId && e.target !== contextMenu.nodeId
      ))
      setContextMenu(null)
    }
  }, [contextMenu, nodes, edges, setNodes, setEdges])

  const handleDuplicateNode = useCallback(() => {
    if (contextMenu?.nodeId) {
      const node = nodes.find(n => n.id === contextMenu.nodeId)
      if (node) {
        const newNode: Node = {
          ...node,
          id: `${node.type}-${Date.now()}`,
          position: { x: node.position.x + 20, y: node.position.y + 20 },
          selected: false,
          data: { ...node.data }
        }
        setNodes([...nodes, newNode])
      }
      setContextMenu(null)
    }
  }, [contextMenu, nodes, setNodes])

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
        type,
        position,
        data: getDefaultNodeData(type)
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
    <div className="relative w-full h-[calc(100vh-120px)]">
      {/* 左侧悬浮面板 */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-72 bg-white shadow-lg z-20 transition-transform duration-300 overflow-auto ${
          leftPanelVisible ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4">
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
              <Input.TextArea rows={2} placeholder="请输入任务描述" />
            </Form.Item>

            <Divider className="my-3" />

            <Typography.Title level={5} className="mb-3">
              调度配置
            </Typography.Title>
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

          <Divider className="my-3" />

          <Typography.Title level={5} className="mb-3">
            节点库
          </Typography.Title>
          <div className="space-y-2">
            {nodeLibrary.map((item) => (
              <div
                key={item.type}
                className="p-3 bg-gray-50 border rounded cursor-move hover:border-blue-400 hover:bg-blue-50 flex items-center gap-2 transition-colors"
                draggable
                onDragStart={(e) => onDragStart(e, item.type)}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 左侧面板收起/展开按钮 */}
      <Button
        className="absolute top-4 z-30 shadow"
        style={{ left: leftPanelVisible ? 280 : 16 }}
        icon={leftPanelVisible ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
        onClick={() => setLeftPanelVisible(!leftPanelVisible)}
      />

      {/* 顶部工具栏 */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white rounded-lg shadow px-4 py-2 flex items-center gap-4">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/tasks')}>
          返回
        </Button>
        <Divider type="vertical" />
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
      </div>

      {/* 画布区域 */}
      <div className="absolute inset-0" ref={reactFlowWrapper}>
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
              onNodeContextMenu={onNodeContextMenu}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              defaultViewport={{ x: 0, y: 0, zoom: 1 }}
              minZoom={0.3}
              maxZoom={2}
            >
            <Controls />
            <MiniMap />
            <Background />
            <Panel position="bottom-center">
              <Typography.Text type="secondary">
                拖拽左侧节点到画布中创建流程
              </Typography.Text>
            </Panel>
          </ReactFlow>

          {/* 右键菜单 */}
          {contextMenu && (
            <div
              className="absolute bg-white border border-gray-200 rounded shadow-lg py-1 z-50"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <div
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
                onClick={handleDuplicateNode}
              >
                <CopyOutlined />
                复制节点
              </div>
              <div
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2 text-red-500"
                onClick={handleDeleteNode}
              >
                <DeleteOutlined />
                删除节点
              </div>
            </div>
          )}
        </div>
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
