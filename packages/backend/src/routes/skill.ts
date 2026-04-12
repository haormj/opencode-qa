import { Router } from 'express'
import multer from 'multer'
import { authMiddleware } from '../middleware/auth.js'
import * as skillService from '../services/skill.js'
import logger from '../services/logger.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

router.use(authMiddleware)

router.get('/categories', async (_req, res) => {
  try {
    const categories = await skillService.getCategories()
    res.json(categories)
  } catch (error) {
    logger.error('Get skill categories error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/trending', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10
    const trendingSkills = await skillService.getTrendingSkills(limit)
    res.json(trendingSkills)
  } catch (error) {
    logger.error('Get trending skills error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/my/published', async (req, res) => {
  try {
    const result = await skillService.getSkills({
      authorId: req.user!.id,
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      sort: req.query.sort as string
    })
    res.json(result)
  } catch (error) {
    logger.error('Get my published skills error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/my/favorites', async (req, res) => {
  try {
    const favorites = await skillService.getUserFavorites(req.user!.id)
    res.json(favorites)
  } catch (error) {
    logger.error('Get my favorites error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/', async (req, res) => {
  try {
    const result = await skillService.getSkills({
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      category: req.query.category as string,
      search: req.query.search as string,
      sort: req.query.sort as string,
      status: 'approved'
    })
    res.json(result)
  } catch (error) {
    logger.error('Get skills error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:slug', async (req, res) => {
  try {
    const skill = await skillService.getSkillBySlug(req.params.slug)
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' })
    }
    if (skill.status !== 'approved' && skill.authorId !== req.user!.id && !req.user!.roles.includes('admin')) {
      return res.status(404).json({ error: 'Skill not found' })
    }
    res.json(skill)
  } catch (error) {
    logger.error('Get skill detail error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { name, displayName, slug, description, content, categoryId, version, changeLog } = req.body

    if (!name || !displayName || !slug) {
      return res.status(400).json({ error: 'Missing required fields: name, displayName, slug' })
    }

    const skill = await skillService.createSkill({
      name,
      displayName,
      slug,
      description,
      content,
      categoryId,
      authorId: req.user!.id,
      version,
      changeLog
    })

    res.json(skill)
  } catch (error) {
    logger.error('Create skill error:', error)
    if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: '技能名称或 slug 已存在' })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const existing = await skillService.getSkillById(id)

    if (!existing) {
      return res.status(404).json({ error: 'Skill not found' })
    }

    if (existing.authorId !== req.user!.id && !req.user!.roles.includes('admin')) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    const { name, displayName, description, content, categoryId, version, changeLog } = req.body

    const updated = await skillService.updateSkill(id, {
      name,
      displayName,
      description,
      content,
      categoryId,
      version,
      changeLog,
      status: 'pending',
      rejectReason: null
    })

    res.json(updated)
  } catch (error) {
    logger.error('Update skill error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/:id/offline', async (req, res) => {
  try {
    const { id } = req.params
    const existing = await skillService.getSkillById(id)

    if (!existing) {
      return res.status(404).json({ error: 'Skill not found' })
    }

    if (existing.authorId !== req.user!.id && !req.user!.roles.includes('admin')) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    const updated = await skillService.updateSkill(id, { status: 'unpublished' })
    res.json(updated)
  } catch (error) {
    logger.error('Offline skill error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/:id/online', async (req, res) => {
  try {
    const { id } = req.params
    const existing = await skillService.getSkillById(id)

    if (!existing) {
      return res.status(404).json({ error: 'Skill not found' })
    }

    if (existing.authorId !== req.user!.id && !req.user!.roles.includes('admin')) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    const updated = await skillService.updateSkill(id, { status: 'pending' })
    res.json(updated)
  } catch (error) {
    logger.error('Online skill error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const existing = await skillService.getSkillById(id)

    if (!existing) {
      return res.status(404).json({ error: 'Skill not found' })
    }

    if (existing.authorId !== req.user!.id && !req.user!.roles.includes('admin')) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    await skillService.deleteSkill(id)
    res.json({ success: true })
  } catch (error) {
    logger.error('Delete skill error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/favorite', async (req, res) => {
  try {
    const { id } = req.params
    const result = await skillService.toggleFavorite(req.user!.id, id)
    res.json(result)
  } catch (error) {
    logger.error('Toggle favorite error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/rate', async (req, res) => {
  try {
    const { id } = req.params
    const { score, review } = req.body

    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ error: 'Score must be between 1 and 5' })
    }

    const result = await skillService.rateSkill(req.user!.id, id, score, review)
    res.json(result)
  } catch (error) {
    logger.error('Rate skill error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/download', async (req, res) => {
  try {
    const { id } = req.params
    await skillService.incrementDownloadCount(id)
    res.json({ success: true })
  } catch (error) {
    logger.error('Download count error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/upload', upload.array('files', 200), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' })
    }

    const pathsData = req.body.paths as string | undefined
    let paths: string[] = []
    if (pathsData) {
      try {
        paths = JSON.parse(pathsData)
      } catch {
        paths = []
      }
    }

    const allFiles: Array<{
      name: string
      path: string
      size: number
      content?: string
    }> = []

    files.forEach((file, index) => {
      const filePath = paths[index] || file.originalname
      
      const content = filePath.endsWith('.md') || filePath.endsWith('.json')
        ? file.buffer.toString('utf-8')
        : undefined
      const fileName = filePath.split('/').pop() || filePath
      allFiles.push({
        name: fileName,
        path: filePath,
        size: file.size,
        content
      })
    })

    const skillMdFile = allFiles.find(f => 
      f.name === 'SKILL.md' || f.path.endsWith('/SKILL.md')
    )

    let metadata: {
      name?: string
      displayName?: string
      description?: string
      version?: string
      icon?: string
    } = {}

    if (skillMdFile?.content) {
      metadata = parseSkillMd(skillMdFile.content)
    }

    const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0)

    const fileList = buildFileTree(allFiles)

    res.json({
      files: fileList,
      totalSize,
      fileCount: allFiles.length,
      hasSkillMd: !!skillMdFile,
      metadata
    })
  } catch (error) {
    logger.error('Upload skill files error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

function parseSkillMd(content: string): {
  name?: string
  displayName?: string
  description?: string
  version?: string
  icon?: string
} {
  const result: {
    name?: string
    displayName?: string
    description?: string
    version?: string
    icon?: string
  } = {}

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
          case 'version':
            result.version = value
            break
          case 'icon':
            result.icon = value
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

interface FileNode {
  name: string
  path: string
  size: number
  isDirectory: boolean
  children?: FileNode[]
  isSkillMd?: boolean
}

function buildFileTree(files: Array<{ name: string; path: string; size: number }>): FileNode[] {
  if (files.length === 0) return []

  const paths = files.map(f => f.path)
  let commonPrefix = ''
  
  const firstPath = paths[0]
  const parts = firstPath.split('/')
  
  for (let i = 0; i < parts.length - 1; i++) {
    const prefix = parts.slice(0, i + 1).join('/') + '/'
    if (paths.every(p => p.startsWith(prefix))) {
      commonPrefix = prefix
    } else {
      break
    }
  }
  
  const normalizedFiles = files.map(f => ({
    ...f,
    path: f.path.startsWith(commonPrefix) 
      ? f.path.slice(commonPrefix.length) || f.name
      : f.path
  }))

  const root: FileNode[] = []
  const map = new Map<string, FileNode>()

  const sortedFiles = [...normalizedFiles].sort((a, b) => a.path.localeCompare(b.path))

  for (const file of sortedFiles) {
    const parts = file.path.split('/').filter(Boolean)
    let currentPath = ''

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const parentPath = currentPath
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isFile = i === parts.length - 1

      if (!map.has(currentPath)) {
        const node: FileNode = {
          name: part,
          path: currentPath,
          size: isFile ? file.size : 0,
          isDirectory: !isFile,
          isSkillMd: isFile && (part === 'SKILL.md' || file.path.endsWith('/SKILL.md'))
        }
        map.set(currentPath, node)

        if (parentPath) {
          const parent = map.get(parentPath)
          if (parent) {
            if (!parent.children) parent.children = []
            parent.children.push(node)
            parent.size += node.size
          }
        } else {
          root.push(node)
        }
      } else if (isFile) {
        const existingNode = map.get(currentPath)
        if (existingNode) {
          existingNode.size = file.size
          existingNode.isSkillMd = part === 'SKILL.md' || file.path.endsWith('/SKILL.md')
        }
      }
    }
  }

  return root
}

export default router