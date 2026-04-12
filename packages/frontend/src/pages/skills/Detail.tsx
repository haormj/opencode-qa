import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Tag, Spin, message } from 'antd'
import { HeartOutlined, HeartFilled, DownloadOutlined, CopyOutlined, FolderOutlined, FileOutlined } from '@ant-design/icons'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'
import { mermaid } from '@streamdown/mermaid'
import { math } from '@streamdown/math'
import { cjk } from '@streamdown/cjk'
import { getSkillBySlug, toggleSkillFavorite, getSkillVersions, downloadSkill, getSkillFiles, type Skill, type SkillVersion, type FileNode } from '../../services/api'
import './Detail.css'

const streamdownPlugins = { cjk, code, math, mermaid }

function FileTreeNode({ node, level = 0 }: { node: FileNode; level?: number }) {
  return (
    <div className="file-tree-node">
      <div className="file-tree-item" style={{ paddingLeft: `${level * 16}px` }}>
        {node.isDirectory ? (
          <FolderOutlined className="file-tree-icon folder" />
        ) : (
          <FileOutlined className="file-tree-icon file" />
        )}
        <span className="file-tree-name">{node.name}</span>
      </div>
      {node.isDirectory && node.children?.map((child, index) => (
        <FileTreeNode key={`${child.path}-${index}`} node={child} level={level + 1} />
      ))}
    </div>
  )
}

function Detail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [skill, setSkill] = useState<Skill | null>(null)
  const [versions, setVersions] = useState<SkillVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [favorited, setFavorited] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'install' | 'versions'>('overview')
  const [installTab, setInstallTab] = useState<'dialog' | 'cli' | 'zip'>('dialog')
  const [fileTree, setFileTree] = useState<FileNode[]>([])

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    getSkillBySlug(slug)
      .then(data => {
        setSkill(data)
        if (data.authorId) {
          getSkillVersions(slug)
            .then(result => setVersions(result.items))
            .catch(() => {})
        }
      })
      .catch(() => message.error('加载技能详情失败'))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    if (installTab === 'zip' && slug && skill?.status === 'approved') {
      getSkillFiles(slug)
        .then(result => setFileTree(result.tree))
        .catch(() => setFileTree([]))
    }
  }, [installTab, slug, skill?.status])

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

  const handleDownload = () => {
    if (!skill) return
    const url = downloadSkill(skill.slug)
    const link = document.createElement('a')
    link.href = url
    link.download = `${skill.slug}-v${skill.version}.zip`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('开始下载')
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    message.success('已复制到剪贴板')
  }

  const formatCount = (count: number) => {
    if (count >= 10000) return `${(count / 10000).toFixed(1)}万`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}千`
    return count.toString()
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN')
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
          {skill.status === 'approved' && (
            <Button
              type="default"
              icon={<DownloadOutlined />}
              onClick={handleDownload}
              size="large"
            >
              下载
            </Button>
          )}
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
            {skill.readme ? (
              <Streamdown plugins={streamdownPlugins}>
                {skill.readme.replace(/^---[\s\S]*?---\n?/, '')}
              </Streamdown>
            ) : (
              <p className="skill-detail-no-content">暂无详细内容</p>
            )}
          </div>
        )}
        
        {activeTab === 'install' && (
          <div className="skill-detail-install">
            <div className="install-tabs">
              <button 
                className={`install-tab ${installTab === 'dialog' ? 'active' : ''}`}
                onClick={() => setInstallTab('dialog')}
              >
                通过对话安装
              </button>
              <button 
                className={`install-tab ${installTab === 'cli' ? 'active' : ''}`}
                onClick={() => setInstallTab('cli')}
              >
                命令行安装
              </button>
              <button 
                className={`install-tab ${installTab === 'zip' ? 'active' : ''}`}
                onClick={() => setInstallTab('zip')}
              >
                Zip包安装
              </button>
            </div>

            {installTab === 'dialog' && (
              <div className="install-content">
                <p className="install-desc">复制提示词，发送给 AI 助手即可安装技能。</p>
                <div className="install-code-block">
                  <code>请安装技能 {skill.slug}</code>
                  <Button 
                    icon={<CopyOutlined />} 
                    onClick={() => handleCopy(`请安装技能 ${skill.slug}`)}
                  >
                    复制
                  </Button>
                </div>
              </div>
            )}

            {installTab === 'cli' && (
              <div className="install-content">
                <p className="install-desc">在终端中执行以下命令安装技能：</p>
                <div className="install-code-block">
                  <code>opencode-skill install {skill.slug}</code>
                  <Button 
                    icon={<CopyOutlined />} 
                    onClick={() => handleCopy(`opencode-skill install ${skill.slug}`)}
                  >
                    复制
                  </Button>
                </div>
              </div>
            )}

            {installTab === 'zip' && (
              <div className="install-zip-layout">
                <div className="install-steps">
                  <div className="install-step">
                    <span className="step-number">1</span>
                    <div className="step-content">
                      <span className="step-title">下载</span>
                      <p className="step-desc">从我们的仓库获取最新的源码包。</p>
                      <Button type="primary" onClick={handleDownload}>下载Zip安装包</Button>
                    </div>
                  </div>
                  <div className="install-step">
                    <span className="step-number">2</span>
                    <div className="step-content">
                      <span className="step-title">解压</span>
                      <p className="step-desc">将压缩包解压到指定目录，请保持内部目录结构。</p>
                    </div>
                  </div>
                  <div className="install-step">
                    <span className="step-number">3</span>
                    <div className="step-content">
                      <span className="step-title">使用</span>
                      <p className="step-desc">参考 SKILL.md 中的说明使用技能。</p>
                    </div>
                  </div>
                </div>
                <div className="install-file-tree">
                  <h4 className="file-tree-title">目录树</h4>
                  <div className="file-tree-content">
                    {fileTree.length > 0 ? (
                      fileTree.map((node, index) => (
                        <FileTreeNode key={`${node.path}-${index}`} node={node} />
                      ))
                    ) : (
                      <p className="file-tree-empty">暂无文件</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'versions' && (
          <div className="skill-detail-versions">
            {versions.length === 0 ? (
              <p className="no-versions">暂无版本历史</p>
            ) : (
              versions.map((version) => (
                <div key={version.id} className="version-item">
                  <div className="version-header">
                    <div className="version-info">
                      <span className="version-number">v{version.version}</span>
                      <Tag color={
                        version.status === 'approved' ? 'green' :
                        version.status === 'pending' ? 'blue' :
                        version.status === 'rejected' ? 'red' : 'default'
                      }>
                        {version.status === 'approved' ? '已通过' :
                         version.status === 'pending' ? '待审核' :
                         version.status === 'rejected' ? '已拒绝' : version.status}
                      </Tag>
                      <span className="version-type">({version.versionType})</span>
                    </div>
                    <span className="version-date">{formatDate(version.createdAt)}</span>
                  </div>
                  {version.changeLog && (
                    <p className="version-changelog">{version.changeLog}</p>
                  )}
                  {version.rejectReason && (
                    <p className="version-reject-reason">拒绝原因：{version.rejectReason}</p>
                  )}
                  <div className="version-meta">
                    <span>提交者：{version.creatorName || 'Unknown'}</span>
                    {version.approvedAt && (
                      <span>审核时间：{formatDate(version.approvedAt)}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Detail
