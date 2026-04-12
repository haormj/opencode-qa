import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Tag, Button, Empty } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { getMyPublishedSkills, type Skill } from '../../services/api'

function MySkills() {
  const navigate = useNavigate()
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getMyPublishedSkills()
      .then(result => setSkills(result.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const statusColors: Record<string, string> = { pending: 'orange', approved: 'green', rejected: 'red' }
  const statusLabels: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }

  const columns = [
    { title: '名称', dataIndex: 'displayName', key: 'name' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (status: string) => (
      <Tag color={statusColors[status]}>{statusLabels[status] || status}</Tag>
    )},
    { title: '下载量', dataIndex: 'downloadCount', key: 'downloadCount' },
    { title: '收藏数', dataIndex: 'favoriteCount', key: 'favoriteCount' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => new Date(v).toLocaleDateString() },
  ]

  return (
    <div className="skill-mypage">
      <div className="skill-mypage-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/skills')}>返回</Button>
        <h2>我的技能</h2>
      </div>
      <Table
        dataSource={skills}
        columns={columns}
        rowKey="id"
        loading={loading}
        locale={{ emptyText: <Empty description="您还没有发布技能" /> }}
        onRow={(record) => ({
          onClick: () => navigate(`/skills/${record.slug}`),
          style: { cursor: 'pointer' }
        })}
      />
    </div>
  )
}

export default MySkills