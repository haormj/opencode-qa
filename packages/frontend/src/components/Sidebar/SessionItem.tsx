import { useState } from 'react'
import { Button, Input, Popconfirm, Tooltip } from 'antd'
import { DeleteOutlined, EditOutlined, MessageOutlined } from '@ant-design/icons'
import type { Session } from '../../services/api'

interface SessionItemProps {
  session: Session
  isActive: boolean
  onClick: () => void
  onDelete: () => void
  onRename: (title: string) => void
}

function SessionItem({ session, isActive, onClick, onDelete, onRename }: SessionItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(session.title)

  const handleSubmit = () => {
    if (editTitle.trim() && editTitle !== session.title) {
      onRename(editTitle.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      setEditTitle(session.title)
      setIsEditing(false)
    }
  }

  return (
    <div
      className={`session-item ${isActive ? 'active' : ''}`}
      onClick={() => !isEditing && onClick()}
    >
      <MessageOutlined className="session-icon" />
      {isEditing ? (
        <Input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          autoFocus
          size="small"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <Tooltip title={session.title} placement="right">
          <span className="session-title">{session.title}</span>
        </Tooltip>
      )}
      <div className="session-actions" onClick={(e) => e.stopPropagation()}>
        <Button
          type="text"
          size="small"
          icon={<EditOutlined />}
          onClick={() => setIsEditing(true)}
        />
        <Popconfirm
          title="确认删除？"
          description="删除后将无法恢复该会话"
          onConfirm={onDelete}
          okText="删除"
          cancelText="取消"
        >
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
          />
        </Popconfirm>
      </div>
    </div>
  )
}

export default SessionItem
