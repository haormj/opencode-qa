import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Form, Input, Button, message, Radio, Spin, Modal } from 'antd'
import { FolderOpenOutlined, FileZipOutlined, ReloadOutlined, InboxOutlined } from '@ant-design/icons'
import JSZip from 'jszip'
import { updateSkillWithFiles, type Skill, type UploadFileNode } from '../../services/api'
import './Publish.css'

function incrementVersion(version: string, type: 'major' | 'minor' | 'patch'): string {
  const parts = version.split('.').map(Number)
  const [major = 0, minor = 0, patch = 0] = parts

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
    default:
      return `${major}.${minor}.${patch + 1}`
  }
}

function Update() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [skill, setSkill] = useState<Skill | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [paths, setPaths] = useState<string[]>([])
  const [totalSize, setTotalSize] = useState(0)
  const [hasSkillMd, setHasSkillMd] = useState(false)
  const [versionType, setVersionType] = useState<'major' | 'minor' | 'patch'>('patch')
  const [submitModalVisible, setSubmitModalVisible] = useState(false)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (slug) {
      loadSkill()
    }
  }, [slug])

  const loadSkill = async () => {
    try {
      const response = await fetch(`/api/skills/${slug}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('opencode-qa-token')}`
        }
      })
      if (!response.ok) {
        throw new Error('Skill not found')
      }
      const data = await response.json()
      setSkill(data)
      form.setFieldsValue({
        displayName: data.displayName,
        description: data.description
      })
    } catch (error) {
      message.error('加载技能失败')
      navigate('/skills/my/published')
    } finally {
      setLoading(false)
    }
  }

  const stripCommonPrefix = (paths: string[]): string[] => {
    if (paths.length === 0) return paths
    
    const firstPath = paths[0]
    const parts = firstPath.split('/')
    
    let commonPrefix = ''
    for (let i = 0; i < parts.length - 1; i++) {
      const prefix = parts.slice(0, i + 1).join('/') + '/'
      if (paths.every(p => p.startsWith(prefix))) {
        commonPrefix = prefix
      } else {
        break
      }
    }
    
    if (commonPrefix) {
      return paths.map(p => p.startsWith(commonPrefix) ? p.slice(commonPrefix.length) : p)
    }
    return paths
  }

  const processFiles = useCallback(async (filesWithPath: Array<{ file: File; path: string }>) => {
    const originalPaths = filesWithPath.map(f => f.path)
    const normalizedPaths = stripCommonPrefix(originalPaths)
    
    const allFiles: File[] = []
    const allPaths: string[] = []
    let total = 0
    let foundSkillMd = false

    for (let i = 0; i < filesWithPath.length; i++) {
      const { file } = filesWithPath[i]
      const normalizedPath = normalizedPaths[i]
      
      allFiles.push(file)
      allPaths.push(normalizedPath)
      total += file.size

      if (normalizedPath.endsWith('SKILL.md')) {
        foundSkillMd = true
      }
    }

    setFiles(allFiles)
    setPaths(allPaths)
    setTotalSize(total)
    setHasSkillMd(foundSkillMd)
  }, [])

  const handleUpload = useCallback(async (fileList: FileList) => {
    const filesWithPath: Array<{ file: File; path: string }> = []
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      
      if (file.name.toLowerCase().endsWith('.zip')) {
        const zip = new JSZip()
        const zipContent = await zip.loadAsync(file)
        
        for (const [relativePath, zipEntry] of Object.entries(zipContent.files)) {
          if (!zipEntry.dir) {
            const content = await zipEntry.async('blob')
            const extractedFile = new File([content], zipEntry.name, { type: 'application/octet-stream' })
            filesWithPath.push({ file: extractedFile, path: relativePath })
          }
        }
      } else {
        const relativePath = (file as any).webkitRelativePath || file.name
        filesWithPath.push({ file, path: relativePath })
      }
    }
    
    if (filesWithPath.length > 0) {
      await processFiles(filesWithPath)
    }
  }, [processFiles])

  const handleFolderSelect = () => {
    folderInputRef.current?.click()
  }

  const handleZipSelect = () => {
    zipInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (fileList && fileList.length > 0) {
      handleUpload(fileList)
    }
    e.target.value = ''
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const items = e.dataTransfer.items
    const filesWithPath: Array<{ file: File; path: string }> = []
    
    const processEntry = async (entry: FileSystemEntry): Promise<void> => {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry
        const file = await new Promise<File>((resolve) => {
          fileEntry.file(resolve)
        })
        
        if (file.name.toLowerCase().endsWith('.zip')) {
          const zip = new JSZip()
          const zipContent = await zip.loadAsync(file)
          
          for (const [relativePath, zipEntry] of Object.entries(zipContent.files)) {
            if (!zipEntry.dir) {
              const content = await zipEntry.async('blob')
              const extractedFile = new File([content], zipEntry.name, { type: 'application/octet-stream' })
              filesWithPath.push({ file: extractedFile, path: relativePath })
            }
          }
        } else {
          const relativePath = entry.fullPath.startsWith('/') 
            ? entry.fullPath.slice(1) 
            : entry.fullPath
          filesWithPath.push({ file, path: relativePath })
        }
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry
        const reader = dirEntry.createReader()
        let entries: FileSystemEntry[] = []
        let batch: FileSystemEntry[] = []
        
        do {
          batch = await new Promise<FileSystemEntry[]>((resolve) => {
            reader.readEntries(resolve)
          })
          entries = entries.concat(batch)
        } while (batch.length > 0)
        
        for (const subEntry of entries) {
          await processEntry(subEntry)
        }
      }
    }
    
    const processAll = async () => {
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry()
        if (entry) {
          await processEntry(entry)
        }
      }
      
      if (filesWithPath.length > 0) {
        await processFiles(filesWithPath)
      }
    }
    
    processAll()
  }, [processFiles])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleClearFiles = () => {
    setFiles([])
    setPaths([])
    setTotalSize(0)
    setHasSkillMd(false)
  }

  const handleConfirmSubmit = async (status: 'draft' | 'pending', overwriteDraft?: string) => {
    const values = await form.validateFields()
    
    if (!hasSkillMd) {
      message.error('必须包含 SKILL.md 文件')
      return
    }

    if (files.length === 0) {
      message.error('请上传文件')
      return
    }

    if (!values.changeLog) {
      message.error('请填写变更说明')
      return
    }

    if (!skill) return

    setSubmitting(true)
    try {
      await updateSkillWithFiles(skill.id, {
        files,
        paths,
        displayName: values.displayName,
        description: values.description,
        versionType,
        changeLog: values.changeLog,
        status,
        overwriteDraft,
      })
      message.success(status === 'draft' ? '已保存为草稿' : '技能更新成功，等待审核')
      setSubmitModalVisible(false)
      navigate('/skills/my/versions')
    } catch (error) {
      const err = error as Error & { draftVersion?: string; draftVersionId?: string }
      if (err.message === 'DRAFT_EXISTS' && err.draftVersion && err.draftVersionId) {
        setSubmitting(false)
        Modal.confirm({
          title: '存在未提交的草稿版本',
          content: `存在未提交的草稿版本 v${err.draftVersion}，是否覆盖？`,
          okText: '覆盖',
          cancelText: '取消',
          onOk: () => handleConfirmSubmit(status, err.draftVersionId)
        })
        return
      }
      message.error(error instanceof Error ? error.message : '更新失败')
    } finally {
      setSubmitting(false)
    }
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const buildFileTree = (filePaths: string[]): UploadFileNode[] => {
    if (filePaths.length === 0) return []

    let commonPrefix = ''
    const firstPath = filePaths[0]
    const parts = firstPath.split('/')
    
    for (let i = 0; i < parts.length - 1; i++) {
      const prefix = parts.slice(0, i + 1).join('/') + '/'
      if (filePaths.every(p => p.startsWith(prefix))) {
        commonPrefix = prefix
      } else {
        break
      }
    }

    const normalizedPaths = filePaths.map(p => 
      p.startsWith(commonPrefix) ? p.slice(commonPrefix.length) || p : p
    )

    const root: UploadFileNode[] = []
    const map = new Map<string, UploadFileNode>()

    for (const path of normalizedPaths) {
      const parts = path.split('/').filter(Boolean)
      let currentPath = ''

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const parentPath = currentPath
        currentPath = currentPath ? `${currentPath}/${part}` : part
        const isFile = i === parts.length - 1

        if (!map.has(currentPath)) {
          const node: UploadFileNode = {
            name: part,
            path: currentPath,
            size: isFile ? 0 : 0,
            isDirectory: !isFile,
            isSkillMd: isFile && part === 'SKILL.md'
          }
          map.set(currentPath, node)

          if (parentPath) {
            const parent = map.get(parentPath)
            if (parent) {
              if (!parent.children) parent.children = []
              parent.children.push(node)
            }
          } else {
            root.push(node)
          }
        }
      }
    }

    return root
  }

  const renderFileTree = (nodes: UploadFileNode[]): React.ReactNode => {
    return nodes.map((node) => (
      <div key={node.path}>
        <div className="file-item">
          {node.isDirectory ? (
            <>
              <span className="file-icon folder">📁</span>
              <span className="file-name">{node.name}</span>
              <span className="file-info">
                {node.children?.length || 0} 个文件
              </span>
            </>
          ) : (
            <>
              <span className="file-icon">{node.isSkillMd ? '📄' : '📄'}</span>
              <span className="file-name">
                {node.name}
                {node.isSkillMd && <span className="skill-md-badge">（必需）</span>}
              </span>
            </>
          )}
        </div>
        {node.children && node.children.length > 0 && (
          <div className="file-children">
            {renderFileTree(node.children)}
          </div>
        )}
      </div>
    ))
  }

  if (loading) {
    return (
      <div className="skill-publish" style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!skill) {
    return null
  }

  const newVersion = incrementVersion(skill.version, versionType)

  return (
    <div className="skill-publish">
      <div className="skill-publish-header">
        <h1>更新技能</h1>
        <p className="skill-publish-desc">{skill.displayName} ({skill.slug})</p>
      </div>

      <div className="version-info-section">
        <div className="version-current">
          当前版本：<strong>v{skill.version}</strong>
        </div>
        <div className="version-type-selector">
          <span>版本类型：</span>
          <Radio.Group value={versionType} onChange={(e) => setVersionType(e.target.value)}>
            <Radio.Button value="patch">补丁 (Patch)</Radio.Button>
            <Radio.Button value="minor">小版本 (Minor)</Radio.Button>
            <Radio.Button value="major">大版本 (Major)</Radio.Button>
          </Radio.Group>
        </div>
        <div className="version-new">
          新版本：<strong>v{newVersion}</strong>
        </div>
      </div>

      <div className="upload-section">
        <div className="upload-label">
          Skill 文件<span className="required">*</span>
        </div>
        
        {files.length === 0 ? (
          <div
            ref={dropRef}
            className="upload-area"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <div className="upload-content">
              <InboxOutlined className="upload-icon" />
              <p className="upload-title">拖拽文件夹或 zip 包到此处</p>
              <p className="upload-hint">
                请确保文件夹或压缩包中包含 SKILL.md 文件（最多 200 个，总大小不超过 50 MB）
              </p>
              <div className="upload-buttons">
                <Button icon={<FolderOpenOutlined />} onClick={handleFolderSelect}>
                  选择文件夹
                </Button>
                <Button icon={<FileZipOutlined />} onClick={handleZipSelect}>
                  选择 zip 文件
                </Button>
              </div>
            </div>
            <input
              ref={folderInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
              {...{ webkitdirectory: '', directory: '' }}
            />
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip,application/zip"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="file-list-section">
            <div className="file-list-header">
              <span>
                已选择 <strong>{files.length}</strong> 个文件，总大小 <strong>{formatSize(totalSize)}</strong>
              </span>
              <Button icon={<ReloadOutlined />} onClick={handleClearFiles} size="small">
                重新上传（清空）
              </Button>
            </div>
            <div className="file-list">
              {renderFileTree(buildFileTree(paths))}
            </div>
          </div>
        )}
        
        {files.length > 0 && !hasSkillMd && (
          <p className="skill-md-error">必须包含 SKILL.md 文件</p>
        )}
      </div>

      <Form
        form={form}
        layout="vertical"
      >
        <Form.Item name="displayName" label="显示名称">
          <Input placeholder="Skill 显示名称" />
        </Form.Item>
        
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={3} placeholder="技能描述" />
        </Form.Item>
        
        <Form.Item name="changeLog" label="变更说明" rules={[{ required: true, message: '请填写变更说明' }]}>
          <Input.TextArea rows={3} placeholder="描述本次版本的主要变更内容" />
        </Form.Item>
        
        <Form.Item>
          <Button 
            type="primary" 
            onClick={() => setSubmitModalVisible(true)} 
            loading={submitting} 
            size="large" 
            disabled={!hasSkillMd}
          >
            提交更新
          </Button>
        </Form.Item>
      </Form>

      <Modal
        title="选择提交方式"
        open={submitModalVisible}
        onCancel={() => setSubmitModalVisible(false)}
        footer={null}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Button 
            type="primary" 
            block 
            onClick={() => handleConfirmSubmit('pending')}
            loading={submitting}
          >
            直接提交审核
          </Button>
          <Button 
            block 
            onClick={() => handleConfirmSubmit('draft')}
            loading={submitting}
          >
            保存为草稿
          </Button>
          <Button 
            type="text" 
            block 
            onClick={() => setSubmitModalVisible(false)}
          >
            取消
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default Update
