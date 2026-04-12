import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, message } from 'antd'
import { FolderOpenOutlined, FileZipOutlined, ReloadOutlined, InboxOutlined } from '@ant-design/icons'
import JSZip from 'jszip'
import { createSkill, type FileNode, type UploadResult } from '../../services/api'
import { getToken } from '../../services/api'
import './Publish.css'

const API_BASE = '/api'

function Publish() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<FileNode[]>([])
  const [totalSize, setTotalSize] = useState(0)
  const [fileCount, setFileCount] = useState(0)
  const [hasSkillMd, setHasSkillMd] = useState(false)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const handleUpload = useCallback(async (fileList: FileList) => {
    setUploading(true)
    try {
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
        const formData = new FormData()
        const paths: string[] = []
        
        filesWithPath.forEach(({ file, path }, index) => {
          const safeName = `file_${index}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
          const newFile = new File([file], safeName, { type: file.type })
          formData.append('files', newFile)
          paths.push(path)
        })
        
        formData.append('paths', JSON.stringify(paths))
        
        const token = getToken()
        const response = await fetch(`${API_BASE}/skills/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        })
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(error.error || `HTTP error! status: ${response.status}`)
        }
        
        const result: UploadResult = await response.json()
        setFiles(result.files)
        setTotalSize(result.totalSize)
        setFileCount(result.fileCount)
        setHasSkillMd(result.hasSkillMd)
        
        if (result.metadata) {
          form.setFieldsValue({
            slug: result.metadata.name || '',
            displayName: result.metadata.displayName || '',
            description: result.metadata.description || '',
            version: result.metadata.version || '1.0.0',
            icon: result.metadata.icon || '',
          })
        }
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }, [form])

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
        const formData = new FormData()
        const paths: string[] = []
        
        filesWithPath.forEach(({ file, path }, index) => {
          const safeName = `file_${index}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
          const newFile = new File([file], safeName, { type: file.type })
          formData.append('files', newFile)
          paths.push(path)
        })
        
        formData.append('paths', JSON.stringify(paths))
        
        setUploading(true)
        try {
          const token = getToken()
          const response = await fetch(`${API_BASE}/skills/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: formData,
          })
          
          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(error.error || `HTTP error! status: ${response.status}`)
          }
          
          const result: UploadResult = await response.json()
          setFiles(result.files)
          setTotalSize(result.totalSize)
          setFileCount(result.fileCount)
          setHasSkillMd(result.hasSkillMd)
          
          if (result.metadata) {
            form.setFieldsValue({
              slug: result.metadata.name || '',
              displayName: result.metadata.displayName || '',
              description: result.metadata.description || '',
              version: result.metadata.version || '1.0.0',
              icon: result.metadata.icon || '',
            })
          }
        } catch (error) {
          message.error(error instanceof Error ? error.message : '上传失败')
        } finally {
          setUploading(false)
        }
      }
    }
    
    processAll()
  }, [form])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleClearFiles = () => {
    setFiles([])
    setTotalSize(0)
    setFileCount(0)
    setHasSkillMd(false)
    form.resetFields()
  }

  const handleSubmit = async (values: Record<string, string>) => {
    if (!hasSkillMd) {
      message.error('必须包含 SKILL.md 文件')
      return
    }

    if (!values.slug || !values.displayName) {
      message.error('请填写必填字段')
      return
    }

    setSubmitting(true)
    try {
      await createSkill({
        name: values.slug,
        displayName: values.displayName,
        slug: values.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        description: values.description,
        content: '',
        version: values.version || '1.0.0',
        changeLog: values.changeLog,
      })
      message.success('技能发布成功，等待审核')
      navigate('/skills/my/published')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const renderFileTree = (nodes: FileNode[]): React.ReactNode => {
    return nodes.map((node) => (
      <div key={node.path}>
        <div className="file-item">
          {node.isDirectory ? (
            <>
              <span className="file-icon folder">📁</span>
              <span className="file-name">{node.name}</span>
              <span className="file-info">
                {node.children?.length || 0} 个文件 · {formatSize(node.size)}
              </span>
            </>
          ) : (
            <>
              <span className="file-icon">{node.isSkillMd ? '📄' : '📄'}</span>
              <span className="file-name">
                {node.name}
                {node.isSkillMd && <span className="skill-md-badge">（必需）</span>}
              </span>
              <span className="file-info">{formatSize(node.size)}</span>
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
                请确保文件夹或压缩包中包含 SKILL.md 文件（最多 200 个，总大小不超过 10 MB）
              </p>
              <div className="upload-buttons">
                <Button icon={<FolderOpenOutlined />} onClick={handleFolderSelect} loading={uploading}>
                  选择文件夹
                </Button>
                <Button icon={<FileZipOutlined />} onClick={handleZipSelect} loading={uploading}>
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
                已选择 <strong>{fileCount}</strong> 个文件，总大小 <strong>{formatSize(totalSize)}</strong>
              </span>
              <Button icon={<ReloadOutlined />} onClick={handleClearFiles} size="small">
                重新上传（清空）
              </Button>
            </div>
            <div className="file-list">
              {renderFileTree(files)}
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
        initialValues={{ version: '1.0.0' }}
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
        
        <Form.Item name="version" label="版本号" rules={[{ required: true, message: '请输入版本号' }]}>
          <Input placeholder="1.0.0" />
        </Form.Item>
        
        <Form.Item name="changeLog" label="变更说明">
          <Input.TextArea rows={3} placeholder="描述本次版本的主要变更内容" />
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
