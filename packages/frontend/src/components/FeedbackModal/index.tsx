import { Modal, Form, Input, message } from 'antd'
import { useState } from 'react'

const { TextArea } = Input

interface FeedbackModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (reason: string, contact: string) => Promise<void>
}

function FeedbackModal({ open, onClose, onSubmit }: FeedbackModalProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      await onSubmit(values.reason, values.contact)
      form.resetFields()
    } catch {
      // validation failed
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="问题未解决？"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="提交反馈"
      cancelText="取消"
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="reason"
          label="请描述未解决的原因"
          rules={[{ required: true, message: '请输入未解决的原因' }]}
        >
          <TextArea 
            rows={4} 
            placeholder="请详细描述您的问题..." 
          />
        </Form.Item>
        <Form.Item
          name="contact"
          label="联系方式（选填）"
        >
          <Input placeholder="手机号或邮箱，方便我们联系您" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default FeedbackModal
