import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Select, Button, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { getSkillCategories, createSkill, type SkillCategory } from '../../services/api'

function Publish() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [categories, setCategories] = useState<SkillCategory[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getSkillCategories().then(setCategories).catch(() => {})
  }, [])

  const handleSubmit = async (values: Record<string, string>) => {
    setSubmitting(true)
    try {
      await createSkill({
        name: values.name,
        displayName: values.displayName,
        slug: values.slug,
        description: values.description,
        content: values.content,
        categoryId: Number(values.categoryId),
        version: values.version || '1.0.0',
        icon: values.icon,
        tags: values.tags || undefined,
        installCommand: values.installCommand || undefined,
      })
      message.success('技能发布成功，等待审核')
      navigate('/skills/my/published')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  return (
    <div className="skill-publish">
      <div className="skill-publish-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/skills')}>返回</Button>
        <h2>发布技能</h2>
      </div>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ version: '1.0.0' }}
        style={{ maxWidth: 600 }}
      >
        <Form.Item name="name" label="技能名称（英文）" rules={[{ required: true, message: '请输入技能名称' }]}>
          <Input placeholder="如 self-improving-agent" onChange={e => {
            form.setFieldsValue({ slug: generateSlug(e.target.value) })
          }} />
        </Form.Item>
        <Form.Item name="displayName" label="展示名称" rules={[{ required: true, message: '请输入展示名称' }]}>
          <Input placeholder="如 Self-Improving Agent" />
        </Form.Item>
        <Form.Item name="slug" label="Slug（URL标识）" rules={[{ required: true, message: '请输入slug' }]}>
          <Input placeholder="自动生成" />
        </Form.Item>
        <Form.Item name="categoryId" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
          <Select placeholder="选择分类">
            {categories.map(cat => (
              <Select.Option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="description" label="简短描述">
          <Input.TextArea rows={2} placeholder="简短描述技能功能" />
        </Form.Item>
        <Form.Item name="content" label="SKILL.md 内容">
          <Input.TextArea rows={10} placeholder="粘贴 SKILL.md 完整内容..." style={{ fontFamily: 'monospace' }} />
        </Form.Item>
        <Form.Item name="installCommand" label="安装命令">
          <Input placeholder="如 opencode skill install self-improving-agent" />
        </Form.Item>
        <Form.Item name="icon" label="图标（emoji 或 URL）">
          <Input placeholder="如 🤖 或图标URL" />
        </Form.Item>
        <Form.Item name="tags" label="标签（逗号分隔）">
          <Input placeholder="如 AI,自动化,开发" />
        </Form.Item>
        <Form.Item name="version" label="版本号">
          <Input placeholder="1.0.0" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            提交审核
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default Publish