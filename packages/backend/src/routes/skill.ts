import { Router } from 'express'
import multer from 'multer'
import { authMiddleware } from '../middleware/auth.js'
import * as skillService from '../services/skill.js'
import * as skillFileService from '../services/skill-file.js'
import logger from '../services/logger.js'

const router = Router()
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 200,
    fieldSize: 10 * 1024 * 1024
  }
})

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

router.get('/:slug/versions', async (req, res) => {
  try {
    const skill = await skillService.getSkillBySlug(req.params.slug)
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' })
    }
    if (skill.authorId !== req.user!.id && !req.user!.roles.includes('admin')) {
      return res.status(403).json({ error: 'Not authorized' })
    }
    const versions = await skillService.getSkillVersions(skill.id)
    res.json({ items: versions })
  } catch (error) {
    logger.error('Get skill versions error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:slug/download', async (req, res) => {
  try {
    const skill = await skillService.getSkillBySlug(req.params.slug)
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' })
    }
    if (skill.status !== 'approved') {
      return res.status(404).json({ error: 'Skill not found' })
    }

    const zipBuffer = await skillFileService.createSkillZip(skill.slug, skill.version)
    
    await skillService.incrementDownloadCount(skill.id)

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${skill.slug}-v${skill.version}.zip"`)
    res.send(zipBuffer)
  } catch (error) {
    logger.error('Download skill error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:slug/files', async (req, res) => {
  try {
    const skill = await skillService.getSkillBySlug(req.params.slug)
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' })
    }
    if (skill.status !== 'approved' && skill.authorId !== req.user!.id && !req.user!.roles.includes('admin')) {
      return res.status(404).json({ error: 'Skill not found' })
    }

    const tree = await skillFileService.getSkillFileTree(skill.slug, skill.version)
    res.json({ tree })
  } catch (error) {
    logger.error('Get skill files error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', upload.array('files', 200), async (req, res) => {
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

    const { name, displayName, slug, description, changeLog } = req.body

    if (!name || !displayName || !slug) {
      return res.status(400).json({ error: 'Missing required fields: name, displayName, slug' })
    }

    const skillMdFile = files.find((file, index) => {
      const filePath = paths[index] || file.originalname
      return filePath.endsWith('SKILL.md')
    })

    if (!skillMdFile) {
      return res.status(400).json({ error: 'SKILL.md file is required' })
    }

    const result = await skillService.createSkill({
      name,
      displayName,
      slug,
      description,
      authorId: req.user!.id,
      changeLog
    })

    const skillFiles = files.map((file, index) => ({
      path: paths[index] || file.originalname,
      content: file.buffer
    }))

    await skillFileService.saveSkillFiles(slug, result.version, skillFiles)

    res.json({
      id: result.skillId,
      versionId: result.versionId,
      slug,
      version: result.version,
      status: 'pending'
    })
  } catch (error) {
    logger.error('Create skill error:', error)
    if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: '技能名称或 slug 已存在' })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/:id', upload.array('files', 200), async (req, res) => {
  try {
    const { id } = req.params
    const existing = await skillService.getSkillById(id)

    if (!existing) {
      return res.status(404).json({ error: 'Skill not found' })
    }

    if (existing.authorId !== req.user!.id && !req.user!.roles.includes('admin')) {
      return res.status(403).json({ error: 'Not authorized' })
    }

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

    const { displayName, description, versionType, changeLog } = req.body

    if (!changeLog) {
      return res.status(400).json({ error: 'changeLog is required' })
    }

    if (!['major', 'minor', 'patch'].includes(versionType)) {
      return res.status(400).json({ error: 'versionType must be major, minor, or patch' })
    }

    const skillMdFile = files.find((file, index) => {
      const filePath = paths[index] || file.originalname
      return filePath.endsWith('SKILL.md')
    })

    if (!skillMdFile) {
      return res.status(400).json({ error: 'SKILL.md file is required' })
    }

    const result = await skillService.createSkillVersion({
      skillId: id,
      versionType,
      changeLog,
      createdBy: req.user!.id,
      displayName,
      description
    })

    const skillFiles = files.map((file, index) => ({
      path: paths[index] || file.originalname,
      content: file.buffer
    }))

    await skillFileService.saveSkillFiles(existing.slug, result.version, skillFiles)

    res.json({
      id,
      versionId: result.versionId,
      newVersion: result.version,
      status: 'pending'
    })
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

    await skillFileService.deleteSkillFiles(existing.slug)
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

export default router
