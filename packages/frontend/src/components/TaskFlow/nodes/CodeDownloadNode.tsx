import { memo, useCallback } from 'react'
import { Input } from 'antd'
import { Handle, Position } from '@xyflow/react'

const { Password } = Input

export interface CodeDownloadNodeData {
  repoUrl?: string
  username?: string
  password?: string
  branch?: string
  targetPath?: string
}

interface CodeDownloadNodeProps {
  data: CodeDownloadNodeData
  selected?: boolean
}

const NODE_COLOR = '#10B981'

function CodeDownloadNode({ data, selected }: CodeDownloadNodeProps) {
  const updateData = useCallback((field: keyof CodeDownloadNodeData, value: string) => {
    data[field] = value as never
  }, [data])

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 8,
        overflow: 'visible',
        boxShadow: selected 
          ? '0 4px 12px rgba(0,0,0,0.1)'
          : '0 2px 8px rgba(0,0,0,0.08)',
        outline: selected ? '2px solid #10B981' : 'none',
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
        <span style={{ fontSize: 16 }}>📥</span>
        <span style={{ fontWeight: 500, fontSize: 14, color: '#1f2937' }}>
          代码下载
        </span>
      </div>
      
      {/* 内容区域 */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Input
          size="small"
          placeholder="仓库地址"
          defaultValue={data.repoUrl}
          onChange={(e) => updateData('repoUrl', e.target.value)}
        />
        <Input
          size="small"
          placeholder="用户名"
          defaultValue={data.username}
          onChange={(e) => updateData('username', e.target.value)}
        />
        <Password
          size="small"
          placeholder="密码/Token"
          defaultValue={data.password}
          onChange={(e) => updateData('password', e.target.value)}
        />
        <Input
          size="small"
          placeholder="分支 (默认 main)"
          defaultValue={data.branch}
          onChange={(e) => updateData('branch', e.target.value)}
        />
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export default memo(CodeDownloadNode)
