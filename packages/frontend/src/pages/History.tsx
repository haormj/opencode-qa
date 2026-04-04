import { useEffect, useState } from 'react'
import { Card, Table, Tag, Typography, Button, Modal, Descriptions } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getHistory, type HistoryItem } from '../services/api'

const { Title } = Typography

function History() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<HistoryItem[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [currentItem, setCurrentItem] = useState<HistoryItem | null>(null)

  const fetchData = async (page: number, pageSize: number) => {
    setLoading(true)
    try {
      const result = await getHistory(page, pageSize)
      setData(result.items)
      setPagination(prev => ({ ...prev, current: page, pageSize, total: result.total }))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(1, 20)
  }, [])

  const columns: ColumnsType<HistoryItem> = [
    {
      title: '问题',
      dataIndex: 'question',
      key: 'question',
      ellipsis: true,
      width: 300,
    },
    {
      title: '回答',
      dataIndex: 'answer',
      key: 'answer',
      ellipsis: true,
      width: 400,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'solved' ? 'green' : status === 'unsolved' ? 'red' : 'orange'}>
          {status === 'solved' ? '已解决' : status === 'unsolved' ? '未解决' : '待处理'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />}
          onClick={() => {
            setCurrentItem(record)
            setDetailModalOpen(true)
          }}
        >
          详情
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Card>
        <Title level={3} style={{ marginBottom: 24 }}>
          历史记录
        </Title>
        
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => fetchData(page, pageSize),
          }}
        />
      </Card>

      <Modal
        title="对话详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={800}
      >
        {currentItem && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="问题">{currentItem.question}</Descriptions.Item>
            <Descriptions.Item label="回答">
              <div style={{ whiteSpace: 'pre-wrap' }}>{currentItem.answer}</div>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={currentItem.status === 'solved' ? 'green' : 'red'}>
                {currentItem.status === 'solved' ? '已解决' : '未解决'}
              </Tag>
            </Descriptions.Item>
            {currentItem.feedback && (
              <Descriptions.Item label="反馈原因">
                {currentItem.feedback.reason}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="创建时间">
              {new Date(currentItem.createdAt).toLocaleString('zh-CN')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

export default History
