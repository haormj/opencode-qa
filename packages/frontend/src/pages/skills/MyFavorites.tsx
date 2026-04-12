import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Spin, Empty } from 'antd'
import { DownloadOutlined, StarOutlined } from '@ant-design/icons'
import { getMyFavoriteSkills, type Skill } from '../../services/api'
import './Market.css'

function MyFavorites() {
  const navigate = useNavigate()
  const [favorites, setFavorites] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getMyFavoriteSkills()
      .then(setFavorites)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const formatCount = (count: number) => {
    if (count >= 10000) return `${(count / 10000).toFixed(1)}万`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}千`
    return count.toString()
  }

  return (
    <div className="skill-market">
      <Spin spinning={loading}>
        {favorites.length === 0 && !loading ? (
          <Empty description="还没有收藏任何技能" />
        ) : (
          <div className="skill-list">
            {favorites.map(skill => (
              <Card
                key={skill.id}
                className="skill-card"
                hoverable
                onClick={() => navigate(`/skills/${skill.slug}`)}
              >
                <div className="skill-card-content">
                  <div className="skill-card-icon">
                    {skill.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="skill-card-info">
                    <div className="skill-card-name">{skill.displayName}</div>
                    <div className="skill-card-desc">{skill.description}</div>
                  </div>
                  <div className="skill-card-stats">
                    <span><DownloadOutlined /> {formatCount(skill.downloadCount)}</span>
                    <span><StarOutlined /> {formatCount(skill.favoriteCount)}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Spin>
    </div>
  )
}

export default MyFavorites
