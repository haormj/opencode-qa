import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import { Router } from 'express'
import { db, systemSettings } from '../db/index.js'
import { eq } from 'drizzle-orm'
import * as skillService from '../services/skill.js'
import * as skillFileService from '../services/skill-file.js'
import logger from '../services/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()
const SCRIPTS_DIR = path.join(__dirname, '../../scripts')

async function getServerUrl(): Promise<string> {
  const setting = await db.select().from(systemSettings)
    .where(eq(systemSettings.key, 'install.serverUrl'))
    .get()
  
  if (setting && setting.value) {
    return setting.value
  }
  
  return ''
}

router.get('/skills/:slug/download', async (req, res) => {
  try {
    const { slug } = req.params
    const source = req.query.source as string | undefined
    
    const skill = await skillService.getSkillBySlug(slug)
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' })
    }
    
    if (skill.status !== 'approved') {
      return res.status(404).json({ error: 'Skill not found' })
    }
    
    const zipBuffer = await skillFileService.createSkillZip(slug, 'current')
    
    if (source !== 'task') {
      await skillService.incrementDownloadCount(skill.id)
    }
    
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${slug}-v${skill.version}.zip"`)
    res.send(zipBuffer)
  } catch (error) {
    logger.error('Public download skill error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/scripts/install-skill.sh', async (req, res) => {
  try {
    const scriptPath = path.join(SCRIPTS_DIR, 'install-skill.sh')
    let content = await fs.readFile(scriptPath, 'utf-8')
    
    const serverUrl = await getServerUrl()
    const resolvedUrl = serverUrl || `${req.protocol}://${req.get('host')}`
    
    content = content.replace(/\{\{SERVER_URL\}\}/g, resolvedUrl)
    
    res.setHeader('Content-Type', 'text/x-sh; charset=utf-8')
    res.send(content)
  } catch (error) {
    logger.error('Get install script error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/scripts/install-skill.ps1', async (req, res) => {
  try {
    const scriptPath = path.join(SCRIPTS_DIR, 'install-skill.ps1')
    let content = await fs.readFile(scriptPath, 'utf-8')
    
    const serverUrl = await getServerUrl()
    const resolvedUrl = serverUrl || `${req.protocol}://${req.get('host')}`
    
    content = content.replace(/\{\{SERVER_URL\}\}/g, resolvedUrl)
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send(content)
  } catch (error) {
    logger.error('Get install script error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
