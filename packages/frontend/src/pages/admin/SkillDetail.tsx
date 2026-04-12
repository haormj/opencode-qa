import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Tag, Button, Tabs, Tree, Spin, message, Modal, Form, Input, Select, Space, Statistic, Row, Col } from 'antd'
import type { TreeDataNode } from 'antd'
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, FolderOutlined, FileOutlined } from '@ant-design/icons'
import { getAdminSkillById, getAdminSkillFiles, getSkillFileContent, batchReviewSkills, type SkillDetail, type FileNode } from '../../services/api'

const statusColors: Record<string, string> = { pending: 'orange', approved: 'green', rejected: 'red', unpublished: 'default' }
const statusLabels: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已拒绝', unpublished: '已下架' }

function SkillDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [skill, setSkill] = useState<SkillDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [fileContent, setFileContent] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [fileLoading, setFileLoading] = useState(false)
  const [reviewModal, setReviewModal] = useState(false)
  const [reviewForm] = Form.useForm()

  useEffect(() => {
    fetchSkill()
  }, [id])

  const fetchSkill = async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await getAdminSkillById(id)
      setSkill(data)
      const files = await getAdminSkillFiles(id)
      setFileTree(files.tree)
    } catch {
      message.error('加载技能详情失败')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (path: string) => {
    if (!id) return
    setSelectedFile(path)
    setFileLoading(true)
    try {
      const content = await getSkillFileContent(id, path)
      setFileContent(content)
    } catch {
      message.error('加载文件内容失败')
    } finally {
      setFileLoading(false)
    }
  }

  const handleReview = (status: 'approved' | 'rejected') => {
    reviewForm.setFieldsValue({ status })
    setReviewModal(true)
  }

  const submitReview = async () => {
    if (!id) return
    try {
      const values = await reviewForm.validateFields()
      await batchReviewSkills([id], values.status, values.rejectReason)
      message.success('审核完成')
      setReviewModal(false)
      fetchSkill()
    } catch {
      message.error('审核失败')
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

  if (loading) return <Spin />
  if (!skill) return <div>技能不存在</div>

  return (
    <div>
      <Card
        title={
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/skills')} />
            <span style={{ fontSize: 16, fontWeight: 500 }}>{skill.displayName}</span>
            <Tag color={statusColors[skill.status]}>{statusLabels[skill.status]}</Tag>
          </Space>
        }
        extra={
          skill.status === 'pending' && (
            <Space>
              <Button type="primary" icon={<CheckOutlined />} onClick={() => handleReview('approved')}>通过</Button>
              <Button danger icon={<CloseOutlined />} onClick={() => handleReview('rejected')}>拒绝</Button>
            </Space>
          )
        }
      >
        <Descriptions column={2}>
          <Descriptions.Item label="名称">{skill.name}</Descriptions.Item>
          <Descriptions.Item label="Slug">{skill.slug}</Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={statusColors[skill.status]}>{statusLabels[skill.status] || skill.status}</Tag></Descriptions.Item>
          <Descriptions.Item label="版本">{skill.version}</Descriptions.Item>
          <Descriptions.Item label="分类">{skill.categoryName || '-'}</Descriptions.Item>
          <Descriptions.Item label="作者">{skill.authorName || '-'}</Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>{skill.description || '-'}</Descriptions.Item>
          {skill.rejectReason && <Descriptions.Item label="拒绝原因" span={2}>{skill.rejectReason}</Descriptions.Item>}
        </Descriptions>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Row gutter={24}>
          <Col span={6}><Statistic title="下载量" value={skill.downloadCount} /></Col>
          <Col span={6}><Statistic title="收藏数" value={skill.favoriteCount} /></Col>
          <Col span={6}><Statistic title="评分" value={skill.averageRating} suffix={`/ 5 (${skill.ratingCount} 评价)`} /></Col>
          <Col span={6}><Statistic title="更新时间" value={new Date(skill.updatedAt).toLocaleDateString()} /></Col>
        </Row>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Tabs items={[
          {
            key: 'files',
            label: '文件预览',
            children: (
              <div style={{ display: 'flex', gap: 16, minHeight: 400 }}>
                <div style={{ width: 250, borderRight: '1px solid #f0f0f0', paddingRight: 16 }}>
                  <Tree
                    showIcon
                    treeData={renderFileTree(fileTree)}
                    onSelect={(keys) => {
                      if (keys.length > 0 && typeof keys[0] === 'string') {
                        handleFileSelect(keys[0])
                      }
                    }}
                  />
                </div>
                <div style={{ flex: 1, overflow: 'auto' }}>
                  {fileLoading ? (
                    <Spin />
                  ) : selectedFile ? (
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12 }}>{fileContent}</pre>
                  ) : (
                    <div style={{ color: '#999' }}>请选择文件查看内容</div>
                  )}
                </div>
              </div>
            )
          }
        ]} />
      </Card>

      <Modal title="审核技能" open={reviewModal} onOk={submitReview} onCancel={() => setReviewModal(false)}>
        <Form form={reviewForm} layout="vertical">
          <Form.Item name="status" label="审核结果" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="approved">通过</Select.Option>
              <Select.Option value="rejected">拒绝</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item shouldUpdate={(prev, cur) => prev.status !== cur.status}>
            {({ getFieldValue }) => (
              <Form.Item 
                name="rejectReason" 
                label="拒绝原因"
                rules={[{ required: getFieldValue('status') === 'rejected', message: '拒绝时必填' }]}
              >
                <Input.TextArea rows={3} />
              </Form.Item>
            )}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SkillDetail
