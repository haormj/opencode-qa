import { memo, useCallback } from 'react'
import { Card, Form, Input, Select } from 'antd'
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
  { value: 'email', label: '邮件通知' },
  { value: 'file', label: '文件保存' },
  { value: 'webhook', label: 'Webhook 回调' },
]

function OutputNode({ data, selected }: OutputNodeProps) {
  const updateData = useCallback((field: keyof OutputNodeData, value: string) => {
    data[field] = value as never
  }, [data])

  const renderConfigFields = () => {
    switch (data.type) {
      case 'email':
        return (
          <Form.Item label="收件邮箱" style={{ marginBottom: 0 }}>
            <Input
              type="email"
              placeholder="example@email.com"
              defaultValue={data.email}
              onChange={(e) => updateData('email', e.target.value)}
            />
          </Form.Item>
        )
      case 'file':
        return (
          <Form.Item label="保存路径" style={{ marginBottom: 0 }}>
            <Input
              placeholder="./output/result.json"
              defaultValue={data.filePath}
              onChange={(e) => updateData('filePath', e.target.value)}
            />
          </Form.Item>
        )
      case 'webhook':
        return (
          <Form.Item label="Webhook URL" style={{ marginBottom: 0 }}>
            <Input
              placeholder="https://api.example.com/webhook"
              defaultValue={data.webhookUrl}
              onChange={(e) => updateData('webhookUrl', e.target.value)}
            />
          </Form.Item>
        )
      default:
        return null
    }
  }

  return (
    <Card
      size="small"
      title="输出配置"
      style={{
        width: 260,
        border: selected ? '2px solid #1890ff' : '1px solid #d9d9d9',
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Form layout="vertical" size="small">
        <Form.Item label="输出类型" style={{ marginBottom: 8 }}>
          <Select
            placeholder="选择输出类型"
            options={outputTypes}
            defaultValue={data.type}
            onChange={(value) => updateData('type', value)}
          />
        </Form.Item>
        {renderConfigFields()}
      </Form>
      <Handle type="source" position={Position.Right} />
    </Card>
  )
}

export default memo(OutputNode)
