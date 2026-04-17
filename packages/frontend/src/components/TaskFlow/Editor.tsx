import '@xyflow/react/dist/style.css'
import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  NodeTypes,
} from '@xyflow/react'
import SkillInstallNode from './nodes/SkillInstallNode'
import CodeDownloadNode from './nodes/CodeDownloadNode'
import StepNode from './nodes/StepNode'
import OutputNode from './nodes/OutputNode'

const nodeTypes: NodeTypes = {
  skillInstall: SkillInstallNode,
  codeDownload: CodeDownloadNode,
  step: StepNode,
  output: OutputNode,
}

export interface FlowEditorProps {
  initialNodes?: Node[]
  initialEdges?: Edge[]
  onChange?: (nodes: Node[], edges: Edge[]) => void
}

function Editor({ initialNodes = [], initialEdges = [], onChange }: FlowEditorProps) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds))
    },
    [setEdges]
  )

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes)
      onChange?.(nodes, edges)
    },
    [onNodesChange, nodes, edges, onChange]
  )

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes)
      onChange?.(nodes, edges)
    },
    [onEdgesChange, nodes, edges, onChange]
  )

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}

export default Editor
