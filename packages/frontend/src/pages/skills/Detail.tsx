import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Tag, Spin, message } from 'antd'
import { HeartOutlined, HeartFilled, DownloadOutlined } from '@ant-design/icons'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'
import { mermaid } from '@streamdown/mermaid'
import { math } from '@streamdown/math'
import { cjk } from '@streamdown/cjk'
import { getSkillBySlug, toggleSkillFavorite, type Skill } from '../../services/api'
import './Detail.css'

const streamdownPlugins = { cjk, code, math, mermaid }

function Detail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [skill, setSkill] = useState<Skill | null>(null)
  const [loading, setLoading] = useState(true)
  const [favorited, setFavorited] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'install' | 'versions'>('overview')

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

  const formatCount = (count: number) => {
    if (count >= 10000) return `${(count / 10000).toFixed(1)}万`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}千`
    return count.toString()
  }

  if (loading) return <div className="skill-detail-loading"><Spin /></div>
  if (!skill) return <div className="skill-detail-loading">技能未找到</div>

  return (
    <div className="skill-detail">
      <div className="skill-detail-breadcrumb">
        <span onClick={() => navigate('/skills')}>技能市场</span>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">{skill.slug}</span>
      </div>

      <div className="skill-detail-hero">
        <div className="skill-detail-hero-content">
          <h1>{skill.displayName}</h1>
          <p className="skill-detail-desc">{skill.description}</p>
          <div className="skill-detail-meta">
            <span className="skill-detail-author">作者: {skill.authorName || 'Unknown'}</span>
            <span className="skill-detail-version">V {skill.version}</span>
          </div>
          <div className="skill-detail-stats">
            <span><DownloadOutlined /> {formatCount(skill.downloadCount)} 下载</span>
            <span><HeartOutlined /> {formatCount(skill.favoriteCount)} 收藏</span>
          </div>
        </div>
        <div className="skill-detail-hero-actions">
          <Button
            type={favorited ? 'default' : 'primary'}
            icon={favorited ? <HeartFilled /> : <HeartOutlined />}
            onClick={handleFavorite}
            size="large"
          >
            {favorited ? '已收藏' : '收藏'}
          </Button>
        </div>
      </div>

      <div className="skill-detail-tabs">
        <button 
          className={`skill-detail-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          概述
        </button>
        <button 
          className={`skill-detail-tab ${activeTab === 'install' ? 'active' : ''}`}
          onClick={() => setActiveTab('install')}
        >
          安装方式
        </button>
        <button 
          className={`skill-detail-tab ${activeTab === 'versions' ? 'active' : ''}`}
          onClick={() => setActiveTab('versions')}
        >
          版本历史
        </button>
      </div>

      <div className="skill-detail-content">
        {activeTab === 'overview' && (
          <div className="skill-detail-markdown">
            {skill.content ? (
              <Streamdown content={skill.content} plugins={streamdownPlugins} />
            ) : (
              <p className="skill-detail-no-content">暂无详细内容</p>
            )}
          </div>
        )}
        
        {activeTab === 'install' && (
          <div className="skill-detail-install">
            <h3>安装说明</h3>
            <p>请参考概述中的安装说明。</p>
          </div>
        )}
        
        {activeTab === 'versions' && (
          <div className="skill-detail-versions">
            <div className="version-item">
              <div className="version-info">
                <span className="version-number">v{skill.version}</span>
                <span className="version-date">{new Date(skill.updatedAt).toLocaleDateString()}</span>
              </div>
              {skill.changeLog && <p className="version-changelog">{skill.changeLog}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Detail
