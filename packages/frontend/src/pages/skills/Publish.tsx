import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, message, Modal } from 'antd'
import { FolderOpenOutlined, FileZipOutlined, ReloadOutlined, InboxOutlined } from '@ant-design/icons'
import JSZip from 'jszip'
import { createSkillWithFiles, type UploadFileNode } from '../../services/api'
import './Publish.css'

function Publish() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [paths, setPaths] = useState<string[]>([])
  const [totalSize, setTotalSize] = useState(0)
  const [hasSkillMd, setHasSkillMd] = useState(false)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const parseSkillMd = (content: string) => {
    const result: { name?: string; displayName?: string; description?: string } = {}
    
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1]
      const lines = frontmatter.split('\n')
      for (const line of lines) {
        const [key, ...valueParts] = line.split(':')
        if (key && valueParts.length > 0) {
          const value = valueParts.join(':').trim().replace(/^["']|["']$/g, '')
          switch (key.trim().toLowerCase()) {
            case 'name':
              result.name = value
              break
            case 'displayname':
            case 'display_name':
            case 'title':
              result.displayName = value
              break
            case 'description':
              result.description = value
              break
          }
        }
      }
    }

    if (!result.description) {
      const paragraphs = content.replace(/^---[\s\S]*?---\n?/, '').split('\n\n')
      const firstParagraph = paragraphs.find(p => p.trim() && !p.startsWith('#') && !p.startsWith('```'))
      if (firstParagraph) {
        result.description = firstParagraph.trim().substring(0, 500)
      }
    }

    const titleMatch = content.match(/^#\s+(.+)$/m)
    if (titleMatch && !result.displayName) {
      result.displayName = titleMatch[1].trim()
    }

    return result
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
    let metadata: { name?: string; displayName?: string; description?: string } = {}

    for (let i = 0; i < filesWithPath.length; i++) {
      const { file } = filesWithPath[i]
      const normalizedPath = normalizedPaths[i]
      
      allFiles.push(file)
      allPaths.push(normalizedPath)
      total += file.size

      if (normalizedPath.endsWith('SKILL.md')) {
        foundSkillMd = true
        try {
          const content = await file.text()
          metadata = parseSkillMd(content)
        } catch (e) {
          console.error('Failed to parse SKILL.md:', e)
        }
      }
    }

    setFiles(allFiles)
    setPaths(allPaths)
    setTotalSize(total)
    setHasSkillMd(foundSkillMd)

    if (metadata.name) {
      form.setFieldsValue({ slug: metadata.name })
    }
    if (metadata.displayName) {
      form.setFieldsValue({ displayName: metadata.displayName })
    }
    if (metadata.description) {
      form.setFieldsValue({ description: metadata.description })
    }
  }, [form])

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
    form.resetFields()
  }

  const handleSubmit = async (values: Record<string, string>) => {
    if (!hasSkillMd) {
      message.error('必须包含 SKILL.md 文件')
      return
    }

    if (files.length === 0) {
      message.error('请上传文件')
      return
    }

    if (!values.slug || !values.displayName) {
      message.error('请填写必填字段')
      return
    }

    setSubmitting(true)
    try {
      await createSkillWithFiles({
        files,
        paths,
        name: values.slug,
        displayName: values.displayName,
        slug: values.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        description: values.description,
        changeLog: values.changeLog,
      })
      message.success('技能发布成功，等待审核')
      navigate('/skills/my/published')
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('已存在')) {
          const slug = values.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
          Modal.confirm({
            title: '技能已存在',
            content: '该技能已存在，是否前往更新页面？',
            okText: '前往更新',
            cancelText: '取消',
            onOk: () => navigate(`/skills/update/${slug}`)
          })
          return
        }
        message.error(error.message)
      } else {
        message.error('发布失败')
      }
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

  return (
    <div className="skill-publish">
      <div className="skill-publish-header">
        <h1>发布新技能</h1>
        <p className="skill-publish-desc">上传您的 Skill 文件，审核通过后将展示在技能市场</p>
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
        onFinish={handleSubmit}
      >
        <Form.Item name="slug" label="Slug" rules={[{ required: true, message: '请输入 Slug' }]}>
          <Input placeholder="Skill 的唯一标识符，仅允许小写字母、数字和连字符" />
        </Form.Item>
        
        <Form.Item name="displayName" label="显示名称" rules={[{ required: true, message: '请输入显示名称' }]}>
          <Input placeholder="Skill 显示名称" />
        </Form.Item>
        
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={3} placeholder="该描述会从 SKILL.md 文件的 description 字段中自动提取，也支持手动修改" />
        </Form.Item>
        
        <Form.Item name="changeLog" label="变更说明">
          <Input.TextArea rows={3} placeholder="描述本次发布的主要内容" />
        </Form.Item>
        
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} size="large" disabled={!hasSkillMd}>
            发布技能
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default Publish
