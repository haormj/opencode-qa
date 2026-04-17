import { memo, useCallback } from 'react'
import { Card, Input } from 'antd'
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

function StepNode({ data, selected }: StepNodeProps) {
  const updateData = useCallback((field: keyof StepNodeData, value: string) => {
    data[field] = value as never
  }, [data])

  return (
    <Card
      size="small"
      title="📝 步骤定义"
      style={{
        width: 200,
        border: selected ? '2px solid #1890ff' : '1px solid #d9d9d9',
      }}
      bodyStyle={{ padding: 8 }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
    </Card>
  )
}

export default memo(StepNode)
