import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Card, Tag, Button, Space, Popconfirm, message, Input, Tooltip } from 'antd'
import { SearchOutlined, EditOutlined, CheckOutlined, StopOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getMyPublishedSkills, offlineSkill, onlineSkill, deleteSkill, type Skill } from '../../services/api'
import './MySkills.css'

const statusColors: Record<string, string> = { 
  pending: 'orange', 
  approved: 'green', 
  unpublished: 'default' 
}
const statusLabels: Record<string, string> = { 
  pending: '待发布', 
  approved: '已发布', 
  unpublished: '已下架' 
}

function MySkills() {
  const navigate = useNavigate()
  const [skills, setSkills] = useState<Skill[]>([])
  const [filteredSkills, setFilteredSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const loadSkills = () => {
    setLoading(true)
    getMyPublishedSkills()
      .then(result => {
        setSkills(result.items)
        setFilteredSkills(result.items)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadSkills()
  }, [])

  const handleSearch = () => {
    setPage(1)
    if (!searchText.trim()) {
      setFilteredSkills(skills)
    } else {
      const filtered = skills.filter(s => 
        s.displayName.toLowerCase().includes(searchText.toLowerCase()) ||
        s.name.toLowerCase().includes(searchText.toLowerCase())
      )
      setFilteredSkills(filtered)
    }
  }

  const handleUpdate = (skill: Skill) => {
    navigate(`/skills/update/${skill.slug}`)
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
      message.success('技能已上架')
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

  const columns: ColumnsType<Skill> = [
    { 
      title: '名称', 
      dataIndex: 'displayName', 
      key: 'name',
      width: 200,
      ellipsis: true,
      render: (name: string, record) => (
        <span
          style={{ color: '#1890ff', cursor: 'pointer' }}
          onClick={() => navigate(`/skills/my/${record.slug}`)}
        >
          {name}
        </span>
      )
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status', 
      width: 100,
      render: (status: string) => (
        <Tag color={statusColors[status]}>{statusLabels[status] || status}</Tag>
      )
    },
    { title: '下载量', dataIndex: 'downloadCount', key: 'downloadCount', width: 80, align: 'center' },
    { title: '收藏数', dataIndex: 'favoriteCount', key: 'favoriteCount', width: 80, align: 'center' },
    { title: '版本', dataIndex: 'version', key: 'version', width: 80, align: 'center' },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 120, render: (v: string) => new Date(v).toLocaleDateString() },
    { 
      title: '操作', 
      key: 'action',
      width: 140,
      render: (_, record) => {
        const actions = []
        
        if (record.status === 'approved') {
          actions.push(
            <Tooltip key="update" title="更新">
              <Button type="text" icon={<EditOutlined />} onClick={() => handleUpdate(record)} />
            </Tooltip>,
            <Popconfirm 
              key="offline"
              title="确定下架该技能？" 
              onConfirm={() => handleOffline(record)}
            >
              <Tooltip title="下架">
                <Button type="text" icon={<StopOutlined />} />
              </Tooltip>
            </Popconfirm>
          )
        } else if (record.status === 'unpublished') {
          actions.push(
            <Tooltip key="online" title="上架">
              <Button type="text" icon={<CheckOutlined />} onClick={() => handleOnline(record)} />
            </Tooltip>,
            <Popconfirm 
              key="delete"
              title="确定删除该技能？" 
              onConfirm={() => handleDelete(record)}
            >
              <Tooltip title="删除">
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )
        } else {
          actions.push(
            <Tooltip key="update" title="更新">
              <Button type="text" icon={<EditOutlined />} onClick={() => handleUpdate(record)} />
            </Tooltip>,
            <Popconfirm 
              key="delete"
              title="确定删除该技能？" 
              onConfirm={() => handleDelete(record)}
            >
              <Tooltip title="删除">
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )
        }
        
        return <Space>{actions}</Space>
      }
    },
  ]

  return (
    <div className="skill-my-page">
      <Card
        title="技能列表"
        extra={
          <Space>
            <Input
              placeholder="搜索技能名称"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
            />
            <Button onClick={handleSearch}>
              搜索
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={filteredSkills}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total: filteredSkills.length,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            }
          }}
        />
      </Card>
    </div>
  )
}

export default MySkills
