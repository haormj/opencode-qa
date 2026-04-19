import { memo, useCallback } from 'react'
import { Input, Select } from 'antd'
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

const NODE_COLOR = '#8B5CF6'

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
    <div
      style={{
        position: 'relative',
        borderRadius: 8,
        overflow: 'visible',
        boxShadow: selected 
          ? '0 4px 12px rgba(0,0,0,0.1)'
          : '0 2px 8px rgba(0,0,0,0.08)',
        outline: selected ? '2px solid #8B5CF6' : 'none',
        outlineOffset: -2,
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
        <span style={{ fontSize: 16 }}>📤</span>
        <span style={{ fontWeight: 500, fontSize: 14, color: '#1f2937' }}>
          输出配置
        </span>
      </div>
      
      {/* 内容区域 */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Select
          size="small"
          placeholder="输出类型"
          options={outputTypes}
          defaultValue={data.type}
          onChange={(value) => updateData('type', value)}
          style={{ width: '100%' }}
        />
        {renderConfigField()}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export default memo(OutputNode)
