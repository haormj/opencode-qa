import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ReactFlow, ReactFlowProvider, useNodesState, useEdgesState, addEdge, Background, MiniMap, Panel, useReactFlow } from '@xyflow/react'
import type { Connection, Node, Edge, NodeTypes, EdgeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, Form, Input, Button, message, Typography, Divider, Menu } from 'antd'
import type { MenuProps } from 'antd'
import { SaveOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { getTask, createTask, updateTask, executeTask, type Task } from '../../services/api'

import SkillInstallNode from '../../components/TaskFlow/nodes/SkillInstallNode'
import CodeDownloadNode from '../../components/TaskFlow/nodes/CodeDownloadNode'
import StepNode from '../../components/TaskFlow/nodes/StepNode'
import OutputNode from '../../components/TaskFlow/nodes/OutputNode'
import CustomEdge from '../../components/TaskFlow/edges/CustomEdge'
import { SkillProvider } from '../../contexts/SkillContext'

const nodeTypes: NodeTypes = {
  skillInstall: SkillInstallNode,
  codeDownload: CodeDownloadNode,
  step: StepNode,
  output: OutputNode,
}

const edgeTypes: EdgeTypes = {
  default: CustomEdge,
}

const nodeLibrary = [
  { 
    category: '基础节点',
    items: [
      { type: 'skillInstall', label: '技能安装', icon: '📦' },
      { type: 'codeDownload', label: '代码下载', icon: '📥' },
    ]
  },
  { 
    category: '流程控制',
    items: [
      { type: 'step', label: '步骤定义', icon: '📝' },
    ]
  },
  { 
    category: '输出',
    items: [
      { type: 'output', label: '输出配置', icon: '📤' },
    ]
  },
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

const initialNodes: Node[] = []
const initialEdges: Edge[] = []

function TaskEditorContent() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const initialLoadRef = useRef(true)

  const [form] = Form.useForm()
  const formValues = Form.useWatch([], form)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null)

  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    x: number;
    y: number;
    edgeId: string;
  } | null>(null)

  const contextMenuItems: MenuProps['items'] = [
    {
      key: 'duplicate',
      label: '复制',
      onClick: () => {
        if (contextMenu?.nodeId) {
          const node = nodes.find(n => n.id === contextMenu.nodeId)
          if (node) {
            const newNode: Node = {
              ...node,
              id: `${node.type}-${Date.now()}`,
              position: { x: node.position.x + 30, y: node.position.y + 30 },
              selected: false,
              data: { ...node.data }
            }
            setNodes([...nodes, newNode])
          }
          setContextMenu(null)
        }
      }
    },
    {
      key: 'delete',
      label: (
        <div className="flex justify-between items-center w-full">
          <span className="text-red-500">删除</span>
          <span className="text-gray-400 text-xs ml-6">Del</span>
        </div>
      ),
      onClick: () => {
        if (contextMenu?.nodeId) {
          setNodes(nodes.filter(n => n.id !== contextMenu.nodeId))
          setEdges(edges.filter(e =>
            e.source !== contextMenu.nodeId && e.target !== contextMenu.nodeId
          ))
          setContextMenu(null)
        }
      }
    },
  ]

  const edgeContextMenuItems: MenuProps['items'] = [
    {
      key: 'delete',
      label: (
        <div className="flex justify-between items-center w-full">
          <span className="text-red-500">删除</span>
          <span className="text-gray-400 text-xs ml-6">Del</span>
        </div>
      ),
      onClick: () => {
        if (edgeContextMenu?.edgeId) {
          setEdges(edges.filter(e => e.id !== edgeContextMenu.edgeId))
          setEdgeContextMenu(null)
        }
      }
    },
  ]

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const activeElement = document.activeElement
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          return
        }
        
        const selectedNodes = nodes.filter(n => n.selected)
        const selectedEdges = edges.filter(e => e.selected)
        
        if (selectedEdges.length > 0) {
          setEdges(edges.filter(e => !e.selected))
        }
        
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
    setContextMenu({
      x: event.clientX + 4,
      y: event.clientY + 4,
      nodeId: node.id
    })
  }, [])

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault()
    setEdgeContextMenu({
      x: event.clientX + 4,
      y: event.clientY + 4,
      edgeId: edge.id
    })
  }, [])

  const onPaneClick = useCallback(() => {
    setContextMenu(null)
    setEdgeContextMenu(null)
  }, [])

  const onNodeMouseEnter = useCallback((_event: React.MouseEvent, node: Node) => {
    setHoveredNode(node.id)
  }, [])

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNode(null)
  }, [])

  const edgesWithHighlight = edges.map(edge => ({
    ...edge,
    style: {
      stroke: hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode)
        ? '#296DFF'
        : '#D0D5DC',
      strokeWidth: 2
    }
  }))

  const onConnect = useCallback(
    (params: Connection) => {
      const hasSourceEdge = edges.some(e => e.source === params.source)
      const hasTargetEdge = edges.some(e => e.target === params.target)
      
      if (hasSourceEdge && hasTargetEdge) {
        message.warning('两个节点都已连接，请先删除现有连接')
        return
      }
      if (hasSourceEdge) {
        message.warning('每个节点只能连接一个下游节点')
        return
      }
      if (hasTargetEdge) {
        message.warning('每个节点只能接收一个上游节点')
        return
      }
      
      setEdges((eds) => addEdge(params, eds))
    },
    [edges, setEdges]
  )

  useEffect(() => {
    if (isEdit && id) {
      setLoading(true)
      getTask(id)
        .then((task: Task) => {
          form.setFieldsValue({
            name: task.name,
            description: task.description
          })
          if (task.flowData) {
            try {
              const flowData = JSON.parse(task.flowData)
              if (flowData.nodes) setNodes(flowData.nodes)
              if (flowData.edges) setEdges(flowData.edges)
            } catch {
              console.error('Failed to parse flow data')
            }
          }
          initialLoadRef.current = false
        })
        .catch(() => {
          message.error('加载任务失败')
          navigate('/admin/tasks')
        })
        .finally(() => setLoading(false))
    } else {
      initialLoadRef.current = false
    }
  }, [id, isEdit, form, navigate, setNodes, setEdges])

  const handleSave = async (silent = false) => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const flowData = JSON.stringify({ nodes, edges })
      const data = {
        name: values.name,
        description: values.description,
        flowData
      }

      if (isEdit && id) {
        await updateTask(id, data)
        if (!silent) message.success('保存成功')
      } else {
        await createTask(data)
        if (!silent) message.success('创建成功')
        setLastSavedAt(new Date())
        setHasUnsavedChanges(false)
        navigate('/admin/tasks')
        return
      }
      setLastSavedAt(new Date())
      setHasUnsavedChanges(false)
    } catch (error) {
      if (!silent && error instanceof Error) {
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
        const result = await executeTask(id)
        message.success(`任务已开始执行，执行ID: ${result.executionId}`)
        navigate(`/admin/tasks/${id}/executions`)
      } catch {
        // Error already handled
      }
    }
  }

  // 自动保存
  useEffect(() => {
    if (!isEdit || initialLoadRef.current) return

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    setHasUnsavedChanges(true)
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave(true)
    }, 3000)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [nodes, edges, formValues])

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
      <div className="absolute left-0 top-0 bottom-0 w-52 bg-white shadow-lg z-20 overflow-auto">
        <div className="p-3">
          {/* 节点库 */}
          <Typography.Title level={5} className="mb-3">
            节点库
          </Typography.Title>
          {nodeLibrary.map((category) => (
            <div key={category.category} className="mb-3">
              <Typography.Text type="secondary" className="text-xs">
                {category.category}
              </Typography.Text>
              <div className="space-y-1 mt-1">
                {category.items.map((item) => (
                  <div
                    key={item.type}
                    className="px-3 py-2 cursor-move hover:bg-gray-100 flex items-center gap-2 transition-colors rounded"
                    draggable
                    onDragStart={(e) => onDragStart(e, item.type)}
                  >
                    <span>{item.icon}</span>
                    <span className="text-sm">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <Divider className="my-3" />

          {/* 任务信息 */}
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
          </Form>
        </div>
      </div>

      {/* 顶部工具栏 */}
      <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow px-4 py-2 flex items-center gap-3">
        <div className="text-sm text-gray-500">
          {saving ? (
            <span className="text-blue-500">保存中...</span>
          ) : hasUnsavedChanges ? (
            <span className="text-orange-500">未保存</span>
          ) : lastSavedAt ? (
            <span>已保存 {lastSavedAt.toLocaleTimeString()}</span>
          ) : null}
        </div>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={() => handleSave(false)}
        >
          保存
        </Button>
        {isEdit && (
          <Button
            icon={<PlayCircleOutlined />}
            onClick={handleExecute}
          >
            运行
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
              edges={edgesWithHighlight}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeContextMenu={onNodeContextMenu}
              onEdgeContextMenu={onEdgeContextMenu}
              onNodeMouseEnter={onNodeMouseEnter}
              onNodeMouseLeave={onNodeMouseLeave}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultEdgeOptions={{
                type: 'default',
                animated: false,
                style: { stroke: '#D0D5DC', strokeWidth: 2 },
              }}
              defaultViewport={{ x: 0, y: 0, zoom: 1 }}
              minZoom={0.3}
              maxZoom={2}
              selectNodesOnDrag={false}
            >
            <MiniMap />
            <Background />
            <Panel position="bottom-center">
              <Typography.Text type="secondary">
                拖拽左侧节点到画布中创建流程
              </Typography.Text>
            </Panel>
          </ReactFlow>

          {contextMenu && (
            <div
              className="fixed z-50"
              style={{ 
                left: contextMenu.x, 
                top: contextMenu.y,
              }}
            >
              <Menu
                items={contextMenuItems}
                style={{ 
                  background: '#fafafa',
                  border: 'none',
                  borderRadius: 8,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  minWidth: 120,
                  padding: '4px 0'
                }}
              />
            </div>
          )}

          {edgeContextMenu && (
            <div
              className="fixed z-50"
              style={{ 
                left: edgeContextMenu.x, 
                top: edgeContextMenu.y,
              }}
            >
              <Menu
                items={edgeContextMenuItems}
                style={{ 
                  background: '#fafafa',
                  border: 'none',
                  borderRadius: 8,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  minWidth: 120,
                  padding: '4px 0'
                }}
              />
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
      <SkillProvider>
        <TaskEditorContent />
      </SkillProvider>
    </ReactFlowProvider>
  )
}

export default TaskCreate
