import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Row, Col, Card, Button, Empty, Spin } from 'antd'
import { ArrowLeftOutlined, HeartFilled, DownloadOutlined } from '@ant-design/icons'
import { getMyFavoriteSkills, type Skill } from '../../services/api'

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
    <div className="skill-mypage">
      <div className="skill-mypage-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/skills')}>返回</Button>
        <h2>我的收藏</h2>
      </div>
      <Spin spinning={loading}>
        {favorites.length === 0 && !loading ? (
          <Empty description="还没有收藏任何技能" />
        ) : (
          <Row gutter={[16, 16]}>
            {favorites.map(skill => (
              <Col key={skill.id} xs={24} sm={12} md={8} lg={6}>
                <Card className="skill-card" hoverable onClick={() => navigate(`/skills/${skill.slug}`)}>
                  <div className="skill-card-header">
                    <div className="skill-card-icon">{skill.icon || skill.displayName.charAt(0).toUpperCase()}</div>
                    <div className="skill-card-info">
                      <div className="skill-card-name">{skill.displayName}</div>
                    </div>
                  </div>
                  <div className="skill-card-stats">
                    <span><DownloadOutlined /> {formatCount(skill.downloadCount)}</span>
                    <span><HeartFilled style={{color:'#ff4d4f'}} /> {formatCount(skill.favoriteCount)}</span>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>
    </div>
  )
}

export default MyFavorites