import { Router } from 'express'
import { prisma } from '../index.js'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'
import multer from 'multer'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const providers = await prisma.ssoProvider.findMany({
      orderBy: { sortOrder: 'asc' }
    })
    res.json(providers.map(p => ({
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      icon: p.icon,
      iconMimeType: p.iconMimeType,
      enabled: p.enabled,
      sortOrder: p.sortOrder,
      authorizeUrl: p.authorizeUrl,
      tokenUrl: p.tokenUrl,
      userInfoUrl: p.userInfoUrl,
      clientId: p.clientId,
      scope: p.scope,
      userIdField: p.userIdField,
      usernameField: p.usernameField,
      emailField: p.emailField,
      displayNameField: p.displayNameField,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    })))
  } catch (error) {
    console.error('Get SSO providers error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const data = req.body
    const provider = await prisma.ssoProvider.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        authorizeUrl: data.authorizeUrl,
        tokenUrl: data.tokenUrl,
        userInfoUrl: data.userInfoUrl,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        scope: data.scope || 'openid profile email',
        userIdField: data.userIdField || 'sub',
        usernameField: data.usernameField || 'preferred_username',
        emailField: data.emailField || 'email',
        displayNameField: data.displayNameField || 'name',
        enabled: data.enabled ?? true,
        sortOrder: data.sortOrder ?? 0
      }
    })
    res.json(provider)
  } catch (error) {
    console.error('Create SSO provider error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const data = req.body
    const provider = await prisma.ssoProvider.update({
      where: { id },
      data: {
        displayName: data.displayName,
        authorizeUrl: data.authorizeUrl,
        tokenUrl: data.tokenUrl,
        userInfoUrl: data.userInfoUrl,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        scope: data.scope,
        userIdField: data.userIdField,
        usernameField: data.usernameField,
        emailField: data.emailField,
        displayNameField: data.displayNameField,
        enabled: data.enabled,
        sortOrder: data.sortOrder
      }
    })
    res.json(provider)
  } catch (error) {
    console.error('Update SSO provider error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    await prisma.ssoProvider.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    console.error('Delete SSO provider error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/icon', authMiddleware, requireAdmin, upload.single('icon'), async (req, res) => {
  try {
    const { id } = req.params
    const file = req.file

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const base64 = file.buffer.toString('base64')
    const provider = await prisma.ssoProvider.update({
      where: { id },
      data: {
        icon: base64,
        iconMimeType: file.mimetype
      }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Upload icon error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
