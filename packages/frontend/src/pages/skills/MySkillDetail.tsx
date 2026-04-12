import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Tag, Button, Tree, Spin, message, Popconfirm, Space, Divider } from 'antd'
import type { TreeDataNode } from 'antd'
import { ArrowLeftOutlined, CheckOutlined, StopOutlined, DeleteOutlined, EditOutlined, FolderOutlined, FileOutlined } from '@ant-design/icons'
import { getSkillBySlug, getSkillFiles, getSkillFileContentBySlug, offlineSkill, onlineSkill, deleteSkill, type Skill, type FileNode } from '../../services/api'
import './MySkillDetail.css'

const statusColors: Record<string, string> = { pending: 'orange', approved: 'green', unpublished: 'default' }
const statusLabels: Record<string, string> = { pending: '待发布', approved: '已发布', unpublished: '已下架' }

function MySkillDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [skill, setSkill] = useState<Skill | null>(null)
  const [loading, setLoading] = useState(true)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [fileContent, setFileContent] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [fileLoading, setFileLoading] = useState(false)
  const [leftWidth, setLeftWidth] = useState(250)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchSkill()
  }, [slug])

  const fetchSkill = async () => {
    if (!slug) return
    setLoading(true)
    try {
      const data = await getSkillBySlug(slug)
      setSkill(data)
      const files = await getSkillFiles(slug)
      setFileTree(files.tree)
    } catch {
      message.error('加载技能详情失败')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (path: string) => {
    if (!slug) return
    setSelectedFile(path)
    setFileLoading(true)
    try {
      const content = await getSkillFileContentBySlug(slug, path)
      setFileContent(content)
    } catch {
      message.error('加载文件内容失败')
    } finally {
      setFileLoading(false)
    }
  }

  const handleUpdate = () => {
    if (!skill) return
    navigate(`/skills/update/${skill.slug}`)
  }

  const handleOffline = async () => {
    if (!skill) return
    try {
      await offlineSkill(skill.id)
      message.success('技能已下架')
      fetchSkill()
    } catch {
      message.error('下架失败')
    }
  }

  const handleOnline = async () => {
    if (!skill) return
    try {
      await onlineSkill(skill.id)
      message.success('技能已上架')
      fetchSkill()
    } catch {
      message.error('上架失败')
    }
  }

  const handleDelete = async () => {
    if (!skill) return
    try {
      await deleteSkill(skill.id)
      message.success('技能已删除')
      navigate('/skills/my/published')
    } catch {
      message.error('删除失败')
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

  const renderActionButtons = () => {
    if (!skill) return null
    
    const actions = []
    
    if (skill.status === 'approved') {
      actions.push(
        <Button key="update" type="primary" icon={<EditOutlined />} onClick={handleUpdate}>更新</Button>,
        <Popconfirm key="offline" title="确定下架该技能？" onConfirm={handleOffline}>
          <Button icon={<StopOutlined />}>下架</Button>
        </Popconfirm>
      )
    } else if (skill.status === 'unpublished') {
      actions.push(
        <Button key="online" type="primary" icon={<CheckOutlined />} onClick={handleOnline}>上架</Button>,
        <Popconfirm key="delete" title="确定删除该技能？" onConfirm={handleDelete}>
          <Button danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      )
    } else {
      actions.push(
        <Button key="update" type="primary" icon={<EditOutlined />} onClick={handleUpdate}>更新</Button>,
        <Popconfirm key="delete" title="确定删除该技能？" onConfirm={handleDelete}>
          <Button danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      )
    }
    
    return <Space>{actions}</Space>
  }

  if (loading) return <Spin />
  if (!skill) return <div>技能不存在</div>

  return (
    <div className="my-skill-detail">
      <Card
        title={
          <Space split={<Divider type="vertical" />}>
            <Space>
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/skills/my/published')} />
              <span style={{ fontSize: 16, fontWeight: 500 }}>{skill.displayName}</span>
              <Tag color={statusColors[skill.status]}>{statusLabels[skill.status]}</Tag>
            </Space>
            <Space size="middle">
              <span>下载量: {skill.downloadCount}</span>
              <span>收藏数: {skill.favoriteCount}</span>
              <span>更新时间: {new Date(skill.updatedAt).toLocaleDateString()}</span>
            </Space>
          </Space>
        }
        extra={renderActionButtons()}
      >
        <Descriptions column={2}>
          <Descriptions.Item label="名称">{skill.name}</Descriptions.Item>
          <Descriptions.Item label="Slug">{skill.slug}</Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={statusColors[skill.status]}>{statusLabels[skill.status]}</Tag></Descriptions.Item>
          <Descriptions.Item label="版本">{skill.version}</Descriptions.Item>
          <Descriptions.Item label="分类">{skill.categoryName || '-'}</Descriptions.Item>
          <Descriptions.Item label="作者">{skill.authorName || '-'}</Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>{skill.description || '-'}</Descriptions.Item>
          {skill.rejectReason && <Descriptions.Item label="拒绝原因" span={2}>{skill.rejectReason}</Descriptions.Item>}
        </Descriptions>
      </Card>

      <Card style={{ marginTop: 16 }} title="文件预览">
        <div ref={containerRef} style={{ display: 'flex', height: 'calc(100vh - 450px)' }}>
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

export default MySkillDetail
