import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import * as skillService from '../services/skill.js'
import logger from '../services/logger.js'

const router = Router()

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
    const { name, displayName, slug, description, content, categoryId, version, icon, tags, installCommand } = req.body

    if (!name || !displayName || !slug || !categoryId) {
      return res.status(400).json({ error: 'Missing required fields: name, displayName, slug, categoryId' })
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
      icon,
      tags: typeof tags === 'object' ? JSON.stringify(tags) : tags,
      installCommand
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

    const { name, displayName, description, content, categoryId, version, icon, tags, installCommand } = req.body

    const updated = await skillService.updateSkill(id, {
      name,
      displayName,
      description,
      content,
      categoryId,
      version,
      icon,
      tags: typeof tags === 'object' ? JSON.stringify(tags) : tags,
      installCommand,
      status: 'pending',
      rejectReason: null
    })

    res.json(updated)
  } catch (error) {
    logger.error('Update skill error:', error)
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

export default router