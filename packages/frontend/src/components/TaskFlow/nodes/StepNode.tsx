import { memo, useCallback } from 'react'
import { Card, Form, Input } from 'antd'
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
      title="步骤定义"
      style={{
        width: 280,
        border: selected ? '2px solid #1890ff' : '1px solid #d9d9d9',
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Form layout="vertical" size="small">
        <Form.Item label="步骤名称" style={{ marginBottom: 8 }}>
          <Input
            placeholder="输入步骤名称"
            defaultValue={data.name}
            onChange={(e) => updateData('name', e.target.value)}
          />
        </Form.Item>
        <Form.Item label="指令内容" style={{ marginBottom: 0 }}>
          <TextArea
            placeholder="输入详细指令..."
            rows={4}
            defaultValue={data.instruction}
            onChange={(e) => updateData('instruction', e.target.value)}
          />
        </Form.Item>
      </Form>
      <Handle type="source" position={Position.Right} />
    </Card>
  )
}

export default memo(StepNode)
