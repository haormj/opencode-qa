import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input, Tag, Row, Col, Card, Segmented, Spin, Empty } from 'antd'
import { SearchOutlined, DownloadOutlined, HeartOutlined, StarOutlined } from '@ant-design/icons'
import { getSkills, getTrendingSkills, getSkillCategories, type Skill, type SkillCategory } from '../../services/api'
import './Market.css'

function Market() {
  const navigate = useNavigate()
  const [skills, setSkills] = useState<Skill[]>([])
  const [, setTrending] = useState<Skill[]>([])
  const [categories, setCategories] = useState<SkillCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [searchText, setSearchText] = useState('')
  const [sortBy, setSortBy] = useState<string>('newest')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  useEffect(() => {
    getSkillCategories().then(setCategories).catch(() => {})
    getTrendingSkills(20).then(setTrending).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    getSkills({ page, pageSize: 20, category: selectedCategory || undefined, search: searchText || undefined, sort: sortBy })
      .then(result => {
        setSkills(result.items)
        setTotal(result.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, selectedCategory, sortBy, searchText])

  const formatCount = (count: number) => {
    if (count >= 10000) return `${(count / 10000).toFixed(1)}万`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}千`
    return count.toString()
  }

  return (
    <div className="skill-market">
      <div className="skill-market-header">
        <h2>技能市场</h2>
        <Input
          placeholder="搜索技能..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ maxWidth: 400 }}
          allowClear
        />
      </div>

      <div className="skill-market-categories">
        <Tag
          className={`category-tag ${!selectedCategory ? 'active' : ''}`}
          onClick={() => { setSelectedCategory(''); setPage(1) }}
        >
          全部
        </Tag>
        {categories.map(cat => (
          <Tag
            key={cat.id}
            className={`category-tag ${selectedCategory === cat.slug ? 'active' : ''}`}
            onClick={() => { setSelectedCategory(cat.slug); setPage(1) }}
          >
            {cat.icon && <span className="category-icon">{cat.icon}</span>}
            {cat.name}
          </Tag>
        ))}
      </div>

      <div className="skill-market-sort">
        <Segmented
          value={sortBy}
          onChange={val => { setSortBy(val as string); setPage(1) }}
          options={[
            { label: '最新', value: 'newest' },
            { label: '热榜', value: 'trending' },
            { label: '下载量', value: 'downloads' },
            { label: '评分', value: 'rating' },
          ]}
        />
      </div>

      <Spin spinning={loading}>
        {skills.length === 0 && !loading ? (
          <Empty description="暂无技能" />
        ) : (
          <Row gutter={[16, 16]}>
            {skills.map(skill => (
              <Col key={skill.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  className="skill-card"
                  hoverable
                  onClick={() => navigate(`/skills/${skill.slug}`)}
                >
                  <div className="skill-card-header">
                    <div className="skill-card-icon">
                      {skill.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="skill-card-info">
                      <div className="skill-card-name">{skill.displayName}</div>
                      <div className="skill-card-author">{skill.authorName || 'Unknown'}</div>
                    </div>
                  </div>
                  <div className="skill-card-desc">{skill.description}</div>
                  <div className="skill-card-footer">
                    {skill.categoryName && <Tag>{skill.categoryName}</Tag>}
                    <div className="skill-card-stats">
                      <span><DownloadOutlined /> {formatCount(skill.downloadCount)}</span>
                      <span><HeartOutlined /> {formatCount(skill.favoriteCount)}</span>
                      <span><StarOutlined /> {skill.averageRating > 0 ? skill.averageRating : '-'}</span>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      {total > 20 && (
        <div className="skill-market-pagination">
          <Segmented
            value={page}
            onChange={val => setPage(val as number)}
            options={Array.from({ length: Math.ceil(total / 20) }, (_, i) => ({ label: `${i + 1}`, value: i + 1 }))}
          />
        </div>
      )}
    </div>
  )
}

export default Market