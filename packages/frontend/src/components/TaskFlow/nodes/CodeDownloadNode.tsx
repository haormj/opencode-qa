import { memo, useCallback } from 'react'
import { Card, Input } from 'antd'
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

function CodeDownloadNode({ data, selected }: CodeDownloadNodeProps) {
  const updateData = useCallback((field: keyof CodeDownloadNodeData, value: string) => {
    data[field] = value as never
  }, [data])

  return (
    <Card
      size="small"
      title="📥 代码下载"
      style={{
        width: 160,
        border: selected ? '2px solid #1890ff' : '1px solid #d9d9d9',
      }}
      bodyStyle={{ padding: 6 }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
    </Card>
  )
}

export default memo(CodeDownloadNode)
