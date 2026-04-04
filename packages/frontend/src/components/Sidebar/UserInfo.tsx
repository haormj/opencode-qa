import { getUsername, generateAvatarColor } from '../../services/api'

interface UserInfoProps {
  collapsed: boolean
}

function UserInfo({ collapsed }: UserInfoProps) {
  const username = getUsername()
  const initial = username.charAt(0).toUpperCase()
  const bgColor = generateAvatarColor(username)

  return (
    <div className="user-info">
      <div className="user-avatar" style={{ backgroundColor: bgColor }}>
        {initial}
      </div>
      {!collapsed && <span className="user-name">{username}</span>}
    </div>
  )
}

export default UserInfo
