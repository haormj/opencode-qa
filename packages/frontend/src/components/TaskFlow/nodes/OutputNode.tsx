import { memo, useCallback } from 'react'
import { Card, Input, Select } from 'antd'
import { Handle, Position } from '@xyflow/react'

export interface OutputNodeData {
  type?: 'email' | 'file' | 'webhook'
  email?: string
  filePath?: string
  webhookUrl?: string
}

interface OutputNodeProps {
  data: OutputNodeData
  selected?: boolean
}

const outputTypes = [
  { value: 'email', label: '📧 邮件' },
  { value: 'file', label: '📁 文件' },
  { value: 'webhook', label: '🔗 Webhook' },
]

function OutputNode({ data, selected }: OutputNodeProps) {
  const updateData = useCallback((field: keyof OutputNodeData, value: string) => {
    data[field] = value as never
  }, [data])

  const renderConfigField = () => {
    switch (data.type) {
      case 'email':
        return (
          <Input
            size="small"
            type="email"
            placeholder="邮箱地址"
            defaultValue={data.email}
            onChange={(e) => updateData('email', e.target.value)}
          />
        )
      case 'file':
        return (
          <Input
            size="small"
            placeholder="保存路径"
            defaultValue={data.filePath}
            onChange={(e) => updateData('filePath', e.target.value)}
          />
        )
      case 'webhook':
        return (
          <Input
            size="small"
            placeholder="Webhook URL"
            defaultValue={data.webhookUrl}
            onChange={(e) => updateData('webhookUrl', e.target.value)}
          />
        )
      default:
        return null
    }
  }

  return (
    <Card
      size="small"
      title="📤 输出配置"
      style={{
        width: 160,
        border: selected ? '2px solid #1890ff' : '1px solid #d9d9d9',
      }}
      bodyStyle={{ padding: 6 }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Select
          size="small"
          placeholder="输出类型"
          options={outputTypes}
          defaultValue={data.type}
          onChange={(value) => updateData('type', value)}
        />
        {renderConfigField()}
      </div>
      <Handle type="source" position={Position.Right} />
    </Card>
  )
}

export default memo(OutputNode)
