import path from 'path'
import { Router } from 'express'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'
import * as skillService from '../services/skill.js'
import * as skillFileService from '../services/skill-file.js'
import logger from '../services/logger.js'

const router = Router()

router.use(authMiddleware)
router.use(requireAdmin)

router.get('/', async (req, res) => {
  try {
    const result = await skillService.getSkills({
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      status: req.query.status as string,
      search: req.query.search as string,
      sort: req.query.sort as string
    })
    res.json(result)
  } catch (error) {
    logger.error('Admin get skills error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/categories', async (_req, res) => {
  try {
    const categories = await skillService.getCategories()
    res.json(categories)
  } catch (error) {
    logger.error('Get skill categories error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/categories', async (req, res) => {
  try {
    const { name, slug, icon, sortOrder } = req.body
    if (!name || !slug) {
      return res.status(400).json({ error: 'Missing required fields: name, slug' })
    }
    const category = await skillService.createCategory({ name, slug, icon, sortOrder })
    res.json(category)
  } catch (error) {
    logger.error('Create skill category error:', error)
    if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: '分类 slug 已存在' })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, slug, icon, sortOrder } = req.body
    const category = await skillService.updateCategory(parseInt(id), { name, slug, icon, sortOrder })
    if (!category) {
      return res.status(404).json({ error: 'Category not found' })
    }
    res.json(category)
  } catch (error) {
    logger.error('Update skill category error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params
    await skillService.deleteCategory(parseInt(id))
    res.json({ success: true })
  } catch (error) {
    logger.error('Delete skill category error:', error)
    if (error instanceof Error && error.message.includes('还有技能')) {
      return res.status(400).json({ error: error.message })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/batch-review', async (req, res) => {
  try {
    const { ids, status, rejectReason } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' })
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' })
    }

    if (status === 'rejected' && !rejectReason) {
      return res.status(400).json({ error: 'rejectReason is required when rejecting' })
    }

    const count = await skillService.batchUpdateSkillStatus(ids, status, rejectReason)
    res.json({ success: true, count })
  } catch (error) {
    logger.error('Batch review skills error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' })
    }

    const count = await skillService.batchDeleteSkills(ids)
    res.json({ success: true, count })
  } catch (error) {
    logger.error('Batch delete skills error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const skill = await skillService.getSkillDetailById(id)
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' })
    }
    res.json(skill)
  } catch (error) {
    logger.error('Get skill detail error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id/files', async (req, res) => {
  try {
    const { id } = req.params
    const skill = await skillService.getSkillById(id)
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' })
    }

    const tree = await skillFileService.getSkillFileTree(skill.slug, skill.version)
    res.json({ tree })
  } catch (error) {
    logger.error('Get skill files error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id/files/*', async (req, res) => {
  try {
    const { id } = req.params
    const filePath = (req.params as Record<string, string>)[0]
    
    if (filePath.includes('..') || path.isAbsolute(filePath)) {
      return res.status(400).json({ error: 'Invalid file path' })
    }

    const skill = await skillService.getSkillById(id)
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' })
    }

    const content = await skillFileService.readSkillFile(skill.slug, skill.version, filePath)
    if (!content) {
      return res.status(404).json({ error: 'File not found' })
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send(content.toString('utf-8'))
  } catch (error) {
    logger.error('Get skill file content error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/:id/versions/:versionId/review', async (req, res) => {
  try {
    const { id, versionId } = req.params
    const { status, rejectReason } = req.body

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' })
    }

    if (status === 'rejected' && !rejectReason) {
      return res.status(400).json({ error: 'rejectReason is required when rejecting' })
    }

    const version = await skillService.getSkillVersionById(versionId)
    if (!version) {
      return res.status(404).json({ error: 'Version not found' })
    }

    if (version.skillId !== id) {
      return res.status(400).json({ error: 'Version does not belong to this skill' })
    }

    if (status === 'approved') {
      await skillService.approveSkillVersion(versionId, req.user!.id)
    } else {
      await skillService.rejectSkillVersion(versionId, rejectReason)
    }

    const skill = await skillService.getSkillById(id)
    res.json({ success: true, skill })
  } catch (error) {
    logger.error('Review skill version error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, displayName, description, categoryId } = req.body

    const skill = await skillService.updateSkill(id, {
      name, displayName, description, categoryId
    })
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' })
    }
    res.json(skill)
  } catch (error) {
    logger.error('Admin update skill error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const skill = await skillService.getSkillById(id)
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' })
    }
    
    await skillFileService.deleteSkillFiles(skill.slug)
    await skillService.deleteSkill(id)
    res.json({ success: true })
  } catch (error) {
    logger.error('Admin delete skill error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
