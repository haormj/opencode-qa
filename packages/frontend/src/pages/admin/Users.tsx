import { useState, useEffect } from 'react'
import { Card, Table, Tag, Button, Space, Dropdown, message, Modal, Avatar } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getAdminUsers, addUserRole, removeUserRole, generateAvatarColor, type AdminUser } from '../../services/api'
import './Admin.css'

const roleColors: Record<string, string> = {
  admin: 'blue',
  user: 'green'
}

const roleLabels: Record<string, string> = {
  admin: '管理员',
  user: '普通用户'
}

const availableRoles = [
  { key: 'admin', label: '管理员' },
  { key: 'user', label: '普通用户' }
]

function AdminUsers() {
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<AdminUser[]>([])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const result = await getAdminUsers()
      setUsers(result)
    } catch (error) {
      message.error('加载用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleAddRole = async (userId: string, role: string, currentRoles: string[]) => {
    if (currentRoles.includes(role)) {
      message.warning('该用户已拥有此角色')
      return
    }

    try {
      await addUserRole(userId, role)
      message.success('添加角色成功')
      fetchUsers()
    } catch (error) {
      message.error('添加角色失败')
    }
  }

  const handleRemoveRole = async (userId: string, role: string) => {
    Modal.confirm({
      title: '确认移除角色',
      content: `确定要移除该用户的"${roleLabels[role] || role}"角色吗？`,
      onOk: async () => {
        try {
          await removeUserRole(userId, role)
          message.success('移除角色成功')
          fetchUsers()
        } catch (error) {
          message.error('移除角色失败')
        }
      }
    })
  }

  const columns: ColumnsType<AdminUser> = [
    {
      title: '用户',
      key: 'user',
      width: 200,
      render: (_, record) => (
        <Space>
          <Avatar
            size="small"
            style={{ backgroundColor: generateAvatarColor(record.displayName) }}
          >
            {record.displayName[0]}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{record.displayName}</div>
            <div style={{ fontSize: 12, color: '#999' }}>@{record.username}</div>
          </div>
        </Space>
      )
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      render: (email) => email || '-'
    },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      width: 200,
      render: (roles: string[], record) => (
        <Space size={[0, 8]} wrap>
          {roles.map(role => (
            <Tag
              key={role}
              color={roleColors[role] || 'default'}
              closable
              onClose={(e) => {
                e.preventDefault()
                handleRemoveRole(record.id, role)
              }}
            >
              {roleLabels[role] || role}
            </Tag>
          ))}
        </Space>
      )
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Dropdown
          menu={{
            items: availableRoles.map(r => ({
              key: r.key,
              label: r.label,
              onClick: () => handleAddRole(record.id, r.key, record.roles)
            }))
          }}
        >
          <Button type="link" icon={<PlusOutlined />}>
            添加角色
          </Button>
        </Dropdown>
      )
    }
  ]

  return (
    <Card
      title="用户管理"
      extra={
        <Button icon={<ReloadOutlined />} onClick={fetchUsers}>
          刷新
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`
        }}
      />
    </Card>
  )
}

export default AdminUsers
