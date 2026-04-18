import { memo, useCallback } from 'react'
import { Input } from 'antd'
import { Handle, Position } from '@xyflow/react'

const { TextArea } = Input

export interface StepNodeData {
  name?: string
  instruction?: string
}

interface StepNodeProps {
  data: StepNodeData
  selected?: boolean
}

const NODE_COLOR = '#F59E0B'

function StepNode({ data, selected }: StepNodeProps) {
  const updateData = useCallback((field: keyof StepNodeData, value: string) => {
    data[field] = value as never
  }, [data])

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 8,
        overflow: 'visible',
        boxShadow: selected 
          ? 'inset 0 0 0 2px #F59E0B, 0 4px 12px rgba(0,0,0,0.1)'
          : '0 2px 8px rgba(0,0,0,0.08)',
        backgroundColor: '#fff',
        width: 240,
      }}
    >
      <Handle type="target" position={Position.Left} />
      
      {/* 左侧彩色条 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 8,
          backgroundColor: NODE_COLOR,
          borderTopLeftRadius: 8,
          borderBottomLeftRadius: 8,
        }}
      />
      
      {/* 标题区域 */}
      <div
        style={{
          padding: '10px 12px 10px 16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 16 }}>📝</span>
        <span style={{ fontWeight: 500, fontSize: 14, color: '#1f2937' }}>
          步骤定义
        </span>
      </div>
      
      {/* 内容区域 */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Input
          size="small"
          placeholder="步骤名称"
          defaultValue={data.name}
          onChange={(e) => updateData('name', e.target.value)}
        />
        <TextArea
          size="small"
          placeholder="指令内容..."
          rows={2}
          defaultValue={data.instruction}
          onChange={(e) => updateData('instruction', e.target.value)}
        />
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export default memo(StepNode)
