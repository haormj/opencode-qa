import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Spin, message, Segmented } from 'antd'
import { StarOutlined, StarFilled, DownloadOutlined, CopyOutlined, FolderOutlined, FileOutlined } from '@ant-design/icons'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'
import { mermaid } from '@streamdown/mermaid'
import { math } from '@streamdown/math'
import { cjk } from '@streamdown/cjk'
import copy from 'copy-to-clipboard'
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
  const [skill, setSkill] = useState<Skill | null>(null)
  const [versions, setVersions] = useState<SkillVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [favorited, setFavorited] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'install' | 'versions'>('overview')
  const [installTab, setInstallTab] = useState<'prompt' | 'cli' | 'zip'>('prompt')
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [platform, setPlatform] = useState<'linux' | 'windows'>('linux')
  const [serverUrl, setServerUrl] = useState('')

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    getSkillBySlug(slug)
      .then(data => {
        setSkill(data)
        setFavorited(data.favorited || false)
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

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setServerUrl(data['install.serverUrl'] || window.location.origin)
      })
      .catch(() => {
        setServerUrl(window.location.origin)
      })
  }, [])

  const getInstallCommand = () => {
    if (!skill) return ''
    if (platform === 'linux') {
      return `curl -sSL "${serverUrl}/api/public/scripts/install-skill.sh" | bash -s -- ${skill.slug}`
    }
    return `powershell -ExecutionPolicy Bypass -Command "& ([ScriptBlock]::Create((Invoke-RestMethod '${serverUrl}/api/public/scripts/install-skill.ps1'))) -Slug '${skill.slug}'"`
  }

  const getPromptInstallCommand = () => {
    if (!skill) return ''
    return `Install the skill "${skill.slug}" from the internal skill server.

First, check if the skill already exists at ~/.opencode/skills/${skill.slug}/SKILL.md

If it already exists, inform the user and ask if they want to overwrite.

If it doesn't exist or user confirms, execute the appropriate command based on the current platform:

For Linux/macOS:
curl -sSL "${serverUrl}/api/public/scripts/install-skill.sh" | bash -s -- -y ${skill.slug}

For Windows PowerShell:
powershell -ExecutionPolicy Bypass -Command "& ([ScriptBlock]::Create((Invoke-RestMethod '${serverUrl}/api/public/scripts/install-skill.ps1'))) -Slug '${skill.slug}' -Force"

After installation, verify by listing the installed files.`
  }

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

  const handleDownload = async () => {
    if (!skill) return
    try {
      const blob = await downloadSkill(skill.slug)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${skill.slug}-v${skill.version}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      message.success('下载成功')
    } catch {
      message.error('下载失败')
    }
  }

  const handleCopy = (text: string) => {
    copy(text)
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
      <div className="skill-detail-hero">
        <div className="skill-detail-hero-content">
          <h1>{skill.displayName}</h1>
          <p className="skill-detail-desc">{skill.description}</p>
          <div className="skill-detail-meta">
            <span className="skill-detail-author">作者: {skill.authorName || 'Unknown'}</span>
            <span className="skill-detail-version">V{skill.version}</span>
          </div>
          <div className="skill-detail-stats">
            <span><DownloadOutlined /> {formatCount(skill.downloadCount)} 下载</span>
            <span><StarOutlined /> {formatCount(skill.favoriteCount)} 收藏</span>
          </div>
        </div>
        <div className="skill-detail-hero-actions">
          <Button
            type={favorited ? 'default' : 'primary'}
            icon={favorited ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
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
              <Segmented
                value={installTab}
                onChange={value => setInstallTab(value as 'prompt' | 'cli' | 'zip')}
                options={[
                  { label: '通过对话安装', value: 'prompt' },
                  { label: '命令行安装', value: 'cli' },
                  { label: 'Zip包安装', value: 'zip' },
                ]}
              />
            </div>

            {installTab === 'prompt' && (
              <div className="install-content">
                <p className="install-desc">将以下提示词复制到 OpenCode CLI 中，AI 会自动执行安装命令。安装成功后请重新打开 OpenCode，可通过 /skills 命令查看技能是否安装成功。</p>
                <div className="install-prompt-block">
                  <Button 
                    icon={<CopyOutlined />} 
                    onClick={() => handleCopy(getPromptInstallCommand())}
                    className="copy-button"
                  >
                    复制
                  </Button>
                  <pre>{getPromptInstallCommand()}</pre>
                </div>
              </div>
            )}

            {installTab === 'cli' && (
              <div className="install-content">
                <p className="install-desc">选择平台，在终端中执行以下命令安装技能：</p>
                <div className="install-platform-selector">
                  <Segmented
                    value={platform}
                    onChange={value => setPlatform(value as 'linux' | 'windows')}
                    options={[
                      { label: 'Linux/macOS', value: 'linux' },
                      { label: 'Windows', value: 'windows' },
                    ]}
                  />
                </div>
                <div className="install-code-block">
                  <code>{getInstallCommand()}</code>
                  <Button 
                    icon={<CopyOutlined />} 
                    onClick={() => handleCopy(getInstallCommand())}
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
                      <p className="step-desc">将压缩包解压到 <code>~/.opencode/skills/</code> 目录下，请保持内部目录结构。</p>
                    </div>
                  </div>
                  <div className="install-step">
                    <span className="step-number">3</span>
                    <div className="step-content">
                      <span className="step-title">使用</span>
                      <p className="step-desc">重启 OpenCode 后，技能会自动加载。可在对话中询问"有哪些可用技能"来验证。</p>
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
                    <span className="version-number">v{version.version}</span>
                    <span className="version-date">{formatDate(version.createdAt)}</span>
                  </div>
                  {version.changeLog && (
                    <p className="version-changelog">{version.changeLog}</p>
                  )}
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
