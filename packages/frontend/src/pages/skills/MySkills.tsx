import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Tag, Button, Empty, Space, Popconfirm, message } from 'antd'
import { getMyPublishedSkills, offlineSkill, onlineSkill, deleteSkill, type Skill } from '../../services/api'

function MySkills() {
  const navigate = useNavigate()
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)

  const loadSkills = () => {
    setLoading(true)
    getMyPublishedSkills()
      .then(result => setSkills(result.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadSkills()
  }, [])

  const statusColors: Record<string, string> = { 
    pending: 'orange', 
    approved: 'green', 
    rejected: 'red', 
    unpublished: 'default' 
  }
  const statusLabels: Record<string, string> = { 
    pending: '待审核', 
    approved: '已通过', 
    rejected: '已拒绝', 
    unpublished: '已下架' 
  }

  const handleUpdate = (skill: Skill) => {
    navigate(`/skills/publish?id=${skill.id}`)
  }

  const handleOffline = async (skill: Skill) => {
    try {
      await offlineSkill(skill.id)
      message.success('技能已下架')
      loadSkills()
    } catch {
      message.error('下架失败')
    }
  }

  const handleOnline = async (skill: Skill) => {
    try {
      await onlineSkill(skill.id)
      message.success('技能已提交审核')
      loadSkills()
    } catch {
      message.error('上架失败')
    }
  }

  const handleDelete = async (skill: Skill) => {
    try {
      await deleteSkill(skill.id)
      message.success('技能已删除')
      loadSkills()
    } catch {
      message.error('删除失败')
    }
  }

  const columns = [
    { 
      title: '名称', 
      dataIndex: 'displayName', 
      key: 'name',
      render: (name: string, record: Skill) => (
        <a onClick={(e) => { e.stopPropagation(); navigate(`/skills/${record.slug}`) }} style={{ color: '#1890ff' }}>
          {name}
        </a>
      )
    },
    { title: '状态', dataIndex: 'status', key: 'status', render: (status: string) => (
      <Tag color={statusColors[status]}>{statusLabels[status] || status}</Tag>
    )},
    { title: '下载量', dataIndex: 'downloadCount', key: 'downloadCount' },
    { title: '收藏数', dataIndex: 'favoriteCount', key: 'favoriteCount' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => new Date(v).toLocaleDateString() },
    { 
      title: '操作', 
      key: 'action',
      render: (_: unknown, record: Skill) => {
        const actions = []
        
        if (record.status === 'approved') {
          actions.push(
            <Button key="update" type="link" onClick={() => handleUpdate(record)}>更新</Button>,
            <Popconfirm 
              key="offline"
              title="确定下架该技能？" 
              onConfirm={() => handleOffline(record)}
            >
              <Button type="link">下架</Button>
            </Popconfirm>
          )
        } else if (record.status === 'unpublished') {
          actions.push(
            <Button key="online" type="link" onClick={() => handleOnline(record)}>上架</Button>,
            <Popconfirm 
              key="delete"
              title="确定删除该技能？" 
              onConfirm={() => handleDelete(record)}
            >
              <Button type="link" danger>删除</Button>
            </Popconfirm>
          )
        } else {
          actions.push(
            <Button key="update" type="link" onClick={() => handleUpdate(record)}>更新</Button>,
            <Popconfirm 
              key="delete"
              title="确定删除该技能？" 
              onConfirm={() => handleDelete(record)}
            >
              <Button type="link" danger>删除</Button>
            </Popconfirm>
          )
        }
        
        return <Space>{actions}</Space>
      }
    },
  ]

  return (
    <div className="skill-mypage">
      <Table
        dataSource={skills}
        columns={columns}
        rowKey="id"
        loading={loading}
        locale={{ emptyText: <Empty description="您还没有发布技能" /> }}
      />
    </div>
  )
}

export default MySkills
