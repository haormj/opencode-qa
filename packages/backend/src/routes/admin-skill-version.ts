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
    const result = await skillService.getAllSkillVersions({
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      status: req.query.status as string,
      skillId: req.query.skillId as string
    })
    res.json(result)
  } catch (error) {
    logger.error('Admin get skill versions error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const version = await skillService.getSkillVersionById(id)
    if (!version) {
      return res.status(404).json({ error: 'Version not found' })
    }

    const skill = await skillService.getSkillById(version.skillId)
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' })
    }

    res.json({
      ...version,
      skillName: skill.displayName,
      skillSlug: skill.slug,
      skillId: skill.id,
      skillStatus: skill.status,
      skillDownloadCount: skill.downloadCount,
      skillFavoriteCount: skill.favoriteCount,
      skillDescription: skill.description,
      skillAuthorName: null
    })
  } catch (error) {
    logger.error('Get skill version detail error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id/files', async (req, res) => {
  try {
    const { id } = req.params
    const version = await skillService.getSkillVersionById(id)
    if (!version) {
      return res.status(404).json({ error: 'Version not found' })
    }

    const skill = await skillService.getSkillById(version.skillId)
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' })
    }

    const tree = await skillFileService.getSkillFileTree(skill.slug, 'pending')
    res.json({ tree })
  } catch (error) {
    logger.error('Get skill version files error:', error)
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

    const version = await skillService.getSkillVersionById(id)
    if (!version) {
      return res.status(404).json({ error: 'Version not found' })
    }

    const skill = await skillService.getSkillById(version.skillId)
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' })
    }

    const content = await skillFileService.readSkillFileFromLocation(skill.slug, filePath, 'pending')
    if (!content) {
      return res.status(404).json({ error: 'File not found' })
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send(content.toString('utf-8'))
  } catch (error) {
    logger.error('Get skill version file content error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params
    await skillService.approveSkillVersion(id, req.user!.id)
    res.json({ success: true })
  } catch (error) {
    logger.error('Approve skill version error:', error)
    if (error instanceof Error && error.message === 'Version not found') {
      return res.status(404).json({ error: error.message })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params
    const { rejectReason } = req.body

    if (!rejectReason) {
      return res.status(400).json({ error: 'rejectReason is required' })
    }

    await skillService.rejectSkillVersion(id, rejectReason)
    res.json({ success: true })
  } catch (error) {
    logger.error('Reject skill version error:', error)
    if (error instanceof Error && error.message === 'Version not found') {
      return res.status(404).json({ error: error.message })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
