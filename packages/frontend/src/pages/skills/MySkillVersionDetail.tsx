import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Tag, Tree, Spin, message, Space, Divider, Button } from 'antd'
import type { TreeDataNode } from 'antd'
import { ArrowLeftOutlined, FolderOutlined, FileOutlined } from '@ant-design/icons'
import { getMySkillVersionById, getMySkillVersionFiles, getMySkillVersionFileContent, type MyVersionDetail, type FileNode } from '../../services/api'
import './MySkills.css'

const versionTypeLabels: Record<string, string> = {
  major: '大版本',
  minor: '小版本',
  patch: '补丁'
}

function MySkillVersionDetail() {
  const { versionId } = useParams<{ versionId: string }>()
  const navigate = useNavigate()
  const [version, setVersion] = useState<MyVersionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [fileContent, setFileContent] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [fileLoading, setFileLoading] = useState(false)
  const [leftWidth, setLeftWidth] = useState(250)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchVersion()
  }, [versionId])

  const fetchVersion = async () => {
    if (!versionId) return
    setLoading(true)
    try {
      const data = await getMySkillVersionById(versionId)
      setVersion(data)
      const files = await getMySkillVersionFiles(versionId)
      setFileTree(files.tree)
    } catch {
      message.error('加载版本详情失败')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (path: string) => {
    if (!versionId) return
    setSelectedFile(path)
    setFileLoading(true)
    try {
      const content = await getMySkillVersionFileContent(versionId, path)
      setFileContent(content)
    } catch {
      message.error('加载文件内容失败')
    } finally {
      setFileLoading(false)
    }
  }

  const renderFileTree = (nodes: FileNode[]): TreeDataNode[] => {
    return nodes.map(node => ({
      key: node.path,
      title: node.name,
      icon: node.isDirectory ? <FolderOutlined /> : <FileOutlined />,
      children: node.children ? renderFileTree(node.children) : undefined,
      isLeaf: !node.isDirectory
    }))
  }

  const findNodeByPath = (nodes: FileNode[], path: string): FileNode | null => {
    for (const node of nodes) {
      if (node.path === path) return node
      if (node.children) {
        const found = findNodeByPath(node.children, path)
        if (found) return found
      }
    }
    return null
  }

  const handleMouseDown = useCallback(() => {
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newWidth = e.clientX - rect.left
      setLeftWidth(Math.max(150, Math.min(500, newWidth)))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  if (loading) return <Spin />
  if (!version) return <div>版本不存在</div>

  return (
    <div className="skill-my-page">
      <Card
        title={
          <Space split={<Divider type="vertical" />}>
            <Space>
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/skills/my/versions')} />
              <span style={{ fontSize: 16, fontWeight: 500 }}>{version.skillName} - v{version.version}</span>
              <Tag color="orange">待审核</Tag>
            </Space>
            <Space size="middle">
              <span>类型: {versionTypeLabels[version.versionType] || version.versionType}</span>
              <span>提交时间: {new Date(version.createdAt).toLocaleString()}</span>
            </Space>
          </Space>
        }
      >
        <Descriptions column={2}>
          <Descriptions.Item label="技能名称">
            <a onClick={() => navigate(`/skills/my/${version.skillSlug}`)}>{version.skillName}</a>
          </Descriptions.Item>
          <Descriptions.Item label="版本号">{version.version}</Descriptions.Item>
          <Descriptions.Item label="版本类型">{versionTypeLabels[version.versionType] || version.versionType}</Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color="orange">待审核</Tag></Descriptions.Item>
          <Descriptions.Item label="变更说明" span={2}>{version.changeLog || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card style={{ marginTop: 16 }} title="文件预览">
        <div ref={containerRef} style={{ display: 'flex', height: 'calc(100vh - 420px)' }}>
          <div style={{ width: leftWidth, overflow: 'auto' }}>
            <Tree
              showIcon
              expandAction="click"
              treeData={renderFileTree(fileTree)}
              onSelect={(keys) => {
                if (keys.length > 0 && typeof keys[0] === 'string') {
                  const node = findNodeByPath(fileTree, keys[0])
                  if (node && !node.isDirectory) {
                    handleFileSelect(keys[0])
                  }
                }
              }}
            />
          </div>
          <div
            style={{
              width: 5,
              cursor: 'col-resize',
              background: isDragging ? '#1890ff' : '#f0f0f0',
              transition: isDragging ? 'none' : 'background 0.2s'
            }}
            onMouseDown={handleMouseDown}
          />
          <div style={{ flex: 1, overflow: 'auto', paddingLeft: 16 }}>
            {fileLoading ? (
              <Spin />
            ) : selectedFile ? (
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12 }}>{fileContent}</pre>
            ) : (
              <div style={{ color: '#999' }}>请选择文件查看内容</div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

export default MySkillVersionDetail
