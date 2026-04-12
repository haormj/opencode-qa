import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Tag, Button, Tree, Spin, message, Modal, Form, Input, Space, Divider } from 'antd'
import type { TreeDataNode } from 'antd'
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, FolderOutlined, FileOutlined } from '@ant-design/icons'
import { getAdminSkillVersionById, getSkillVersionFiles, getSkillVersionFileContent, approveSkillVersion, rejectSkillVersion, type AdminSkillVersionDetail, type FileNode } from '../../services/api'

const statusColors: Record<string, string> = { pending: 'orange', approved: 'green', rejected: 'red' }
const statusLabels: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }
const versionTypeLabels: Record<string, string> = { major: '大版本', minor: '小版本', patch: '补丁' }

function SkillVersionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [version, setVersion] = useState<AdminSkillVersionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [fileContent, setFileContent] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [fileLoading, setFileLoading] = useState(false)
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [leftWidth, setLeftWidth] = useState(250)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchVersion()
  }, [id])

  const fetchVersion = async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await getAdminSkillVersionById(id)
      setVersion(data)
      const files = await getSkillVersionFiles(id)
      setFileTree(files.tree)
    } catch {
      message.error('加载版本详情失败')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (path: string) => {
    if (!id) return
    setSelectedFile(path)
    setFileLoading(true)
    try {
      const content = await getSkillVersionFileContent(id, path)
      setFileContent(content)
    } catch {
      message.error('加载文件内容失败')
    } finally {
      setFileLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!id) return
    try {
      await approveSkillVersion(id)
      message.success('版本已通过')
      fetchVersion()
    } catch {
      message.error('操作失败')
    }
  }

  const handleReject = async () => {
    if (!id || !rejectReason.trim()) {
      message.error('请填写拒绝原因')
      return
    }
    try {
      await rejectSkillVersion(id, rejectReason.trim())
      message.success('版本已拒绝')
      setRejectModal(false)
      fetchVersion()
    } catch {
      message.error('操作失败')
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
    <div>
      <Card
        title={
          <Space split={<Divider type="vertical" />}>
            <Space>
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/skill-versions')} />
              <span style={{ fontSize: 16, fontWeight: 500 }}>{version.skillName} - v{version.version}</span>
              <Tag color={statusColors[version.status]}>{statusLabels[version.status]}</Tag>
            </Space>
            <Space size="middle">
              <span>类型: {versionTypeLabels[version.versionType] || version.versionType}</span>
              <span>提交者: {version.creatorName || '-'}</span>
              <span>提交时间: {new Date(version.createdAt).toLocaleString()}</span>
            </Space>
          </Space>
        }
        extra={
          version.status === 'pending' && (
            <Space>
              <Button type="primary" icon={<CheckOutlined />} onClick={handleApprove}>通过</Button>
              <Button danger icon={<CloseOutlined />} onClick={() => setRejectModal(true)}>拒绝</Button>
            </Space>
          )
        }
      >
        <Descriptions column={2}>
          <Descriptions.Item label="技能名称">
            <a onClick={() => navigate(`/admin/skills/${version.skillId}`)}>{version.skillName}</a>
          </Descriptions.Item>
          <Descriptions.Item label="技能 Slug">{version.skillSlug}</Descriptions.Item>
          <Descriptions.Item label="版本号">{version.version}</Descriptions.Item>
          <Descriptions.Item label="版本类型">{versionTypeLabels[version.versionType] || version.versionType}</Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={statusColors[version.status]}>{statusLabels[version.status]}</Tag></Descriptions.Item>
          <Descriptions.Item label="提交者">{version.creatorName || '-'}</Descriptions.Item>
          <Descriptions.Item label="变更说明" span={2}>{version.changeLog || '-'}</Descriptions.Item>
          {version.rejectReason && <Descriptions.Item label="拒绝原因" span={2}>{version.rejectReason}</Descriptions.Item>}
        </Descriptions>
      </Card>

      <Card style={{ marginTop: 16 }} title="文件预览 (待审核版本)">
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

      <Modal
        title="拒绝版本"
        open={rejectModal}
        onOk={handleReject}
        onCancel={() => setRejectModal(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form.Item label="拒绝原因" required>
          <Input.TextArea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="请填写拒绝原因"
            rows={3}
          />
        </Form.Item>
      </Modal>
    </div>
  )
}

export default SkillVersionDetail
