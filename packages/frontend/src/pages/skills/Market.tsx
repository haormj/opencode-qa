import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input, Card, Segmented, Spin, Empty } from 'antd'
import { SearchOutlined, DownloadOutlined, StarOutlined } from '@ant-design/icons'
import { getSkills, type Skill } from '../../services/api'
import './Market.css'

function Market() {
  const navigate = useNavigate()
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [sortBy, setSortBy] = useState<string>('newest')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  const loadSkills = useCallback((pageNum: number, reset: boolean = false) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    
    getSkills({ page: pageNum, pageSize: 15, search: searchText || undefined, sort: sortBy })
      .then(result => {
        if (reset) {
          setSkills(result.items)
        } else {
          setSkills(prev => [...prev, ...result.items])
        }
        setHasMore(result.items.length === 15)
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false)
        loadingRef.current = false
      })
  }, [searchText, sortBy])

  useEffect(() => {
    setPage(1)
    setSkills([])
    setHasMore(true)
    loadSkills(1, true)
  }, [sortBy, searchText, loadSkills])

  useEffect(() => {
    if (page > 1) {
      loadSkills(page, false)
    }
  }, [page, loadSkills])

  const handleScroll = useCallback(() => {
    if (loading || !hasMore) return
    
    const container = contentRef.current
    if (!container) return
    
    const { scrollTop, scrollHeight, clientHeight } = container
    if (scrollHeight - scrollTop - clientHeight < 100) {
      setPage(prev => prev + 1)
    }
  }, [loading, hasMore])

  const formatCount = (count: number) => {
    if (count >= 10000) return `${(count / 10000).toFixed(1)}万`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}千`
    return count.toString()
  }

  const handleSortChange = (val: string | number) => {
    setSortBy(val as string)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value)
  }

  return (
    <div className="skill-market">
      <div className="skill-market-header">
        <Input
          placeholder="搜索 skill 名称、描述、标签..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={handleSearchChange}
          style={{ maxWidth: 400 }}
          allowClear
        />
        <Segmented
          value={sortBy}
          onChange={handleSortChange}
          options={[
            { label: '最新', value: 'newest' },
            { label: '下载量', value: 'downloads' },
            { label: '收藏量', value: 'favorites' },
          ]}
        />
      </div>

      <div 
        className="skill-market-content" 
        ref={contentRef}
        onScroll={handleScroll}
      >
        {skills.length === 0 && !loading ? (
          <Empty description="暂无技能" />
        ) : (
          <div className="skill-list">
            {skills.map(skill => (
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
        
        {loading && skills.length > 0 && (
          <div className="skill-market-loading-more">
            <Spin size="small" />
          </div>
        )}
        
        {!hasMore && skills.length > 0 && (
          <div className="skill-market-no-more">没有更多了</div>
        )}
      </div>
    </div>
  )
}

export default Market
