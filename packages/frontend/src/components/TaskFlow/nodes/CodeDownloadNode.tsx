import { memo, useCallback } from 'react'
import { Card, Form, Input } from 'antd'
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
      title="代码下载"
      style={{
        width: 280,
        border: selected ? '2px solid #1890ff' : '1px solid #d9d9d9',
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Form layout="vertical" size="small">
        <Form.Item label="仓库地址" style={{ marginBottom: 8 }}>
          <Input
            placeholder="https://github.com/user/repo.git"
            defaultValue={data.repoUrl}
            onChange={(e) => updateData('repoUrl', e.target.value)}
          />
        </Form.Item>
        <Form.Item label="用户名" style={{ marginBottom: 8 }}>
          <Input
            placeholder="Git 用户名"
            defaultValue={data.username}
            onChange={(e) => updateData('username', e.target.value)}
          />
        </Form.Item>
        <Form.Item label="密码" style={{ marginBottom: 8 }}>
          <Password
            placeholder="Git 密码或 Token"
            defaultValue={data.password}
            onChange={(e) => updateData('password', e.target.value)}
          />
        </Form.Item>
        <Form.Item label="分支" style={{ marginBottom: 8 }}>
          <Input
            placeholder="main"
            defaultValue={data.branch}
            onChange={(e) => updateData('branch', e.target.value)}
          />
        </Form.Item>
        <Form.Item label="目标路径" style={{ marginBottom: 0 }}>
          <Input
            placeholder="./workspace"
            defaultValue={data.targetPath}
            onChange={(e) => updateData('targetPath', e.target.value)}
          />
        </Form.Item>
      </Form>
      <Handle type="source" position={Position.Right} />
    </Card>
  )
}

export default memo(CodeDownloadNode)
