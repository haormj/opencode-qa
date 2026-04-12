import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Tag, Rate, Input, message, Spin } from 'antd'
import { ArrowLeftOutlined, HeartOutlined, HeartFilled, CopyOutlined, DownloadOutlined } from '@ant-design/icons'
import { getSkillBySlug, toggleSkillFavorite, rateSkill, incrementSkillDownload, type Skill } from '../../services/api'
import './Detail.css'

function Detail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [skill, setSkill] = useState<Skill | null>(null)
  const [loading, setLoading] = useState(true)
  const [favorited, setFavorited] = useState(false)
  const [rating, setRating] = useState(0)
  const [review, setReview] = useState('')

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    getSkillBySlug(slug)
      .then(data => {
        setSkill(data)
      })
      .catch(() => message.error('加载技能详情失败'))
      .finally(() => setLoading(false))
  }, [slug])

  const handleFavorite = async () => {
    if (!skill) return
    try {
      const result = await toggleSkillFavorite(skill.id)
      setFavorited(result.favorited)
      message.success(result.favorited ? '已收藏' : '已取消收藏')
    } catch {
      message.error('操作失败')
    }
  }

  const handleRate = async (score: number) => {
    if (!skill) return
    try {
      await rateSkill(skill.id, score, review || undefined)
      setRating(score)
      message.success('评分成功')
    } catch {
      message.error('评分失败')
    }
  }

  const handleCopyInstall = () => {
    if (!skill?.installCommand) return
    navigator.clipboard.writeText(skill.installCommand)
    message.success('安装命令已复制')
    incrementSkillDownload(skill.id).catch(() => {})
  }

  const formatCount = (count: number) => {
    if (count >= 10000) return `${(count / 10000).toFixed(1)}万`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}千`
    return count.toString()
  }

  if (loading) return <div className="skill-detail-loading"><Spin /></div>
  if (!skill) return <div className="skill-detail-loading">技能未找到</div>

  return (
    <div className="skill-detail">
      <div className="skill-detail-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/skills')}>返回</Button>
      </div>

      <div className="skill-detail-hero">
        <div className="skill-detail-icon">
          {skill.icon || skill.displayName.charAt(0).toUpperCase()}
        </div>
        <div className="skill-detail-hero-info">
          <h1>{skill.displayName}</h1>
          <div className="skill-detail-meta">
            {skill.categoryName && <Tag>{skill.categoryName}</Tag>}
            <span className="skill-detail-version">v{skill.version}</span>
            <span className="skill-detail-author">by {skill.authorName || 'Unknown'}</span>
          </div>
          <p className="skill-detail-desc">{skill.description}</p>
          <div className="skill-detail-stats">
            <span><DownloadOutlined /> {formatCount(skill.downloadCount)} 下载</span>
            <span><HeartOutlined /> {formatCount(skill.favoriteCount)} 收藏</span>
            <Rate disabled value={skill.averageRating} allowHalf style={{ fontSize: 14 }} />
            <span>({skill.ratingCount})</span>
          </div>
        </div>
        <div className="skill-detail-actions">
          <Button
            type={favorited ? 'default' : 'primary'}
            icon={favorited ? <HeartFilled /> : <HeartOutlined />}
            onClick={handleFavorite}
          >
            {favorited ? '已收藏' : '收藏'}
          </Button>
          {skill.installCommand && (
            <Button icon={<CopyOutlined />} onClick={handleCopyInstall}>
              复制安装命令
            </Button>
          )}
        </div>
      </div>

      {skill.tags && (
        <div className="skill-detail-tags">
          {JSON.parse(skill.tags).map((tag: string) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      )}

      <div className="skill-detail-content">
        <h3>技能详情</h3>
        <div className="skill-detail-markdown">
          {skill.content ? (
            <pre className="skill-detail-content-text">{skill.content}</pre>
          ) : (
            <p className="skill-detail-no-content">暂无详细内容</p>
          )}
        </div>
      </div>

      <div className="skill-detail-rating">
        <h3>评价此技能</h3>
        <Rate onChange={handleRate} value={rating} />
        <Input.TextArea
          placeholder="写下你的评价..."
          value={review}
          onChange={e => setReview(e.target.value)}
          rows={3}
          style={{ marginTop: 8, maxWidth: 500 }}
        />
      </div>
    </div>
  )
}

export default Detail