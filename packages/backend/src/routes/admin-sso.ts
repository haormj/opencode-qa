import { Router } from 'express'
import { prisma } from '../index.js'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'
import multer from 'multer'
import { SSO_PROVIDER_TYPES } from '../services/sso-processor.js'
import { FEISHU_DEFAULTS } from '../services/sso-processors/feishu.js'

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
      type: p.type,
      authorizeUrl: p.authorizeUrl,
      tokenUrl: p.tokenUrl,
      userInfoUrl: p.userInfoUrl,
      clientId: p.clientId,
      appId: p.appId,
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
    const type = data.type || SSO_PROVIDER_TYPES.GENERIC

    if (type === SSO_PROVIDER_TYPES.GENERIC) {
      if (!data.clientId || !data.clientSecret) {
        return res.status(400).json({ error: 'Client ID and Client Secret are required for GENERIC type' })
      }
    } else if (type === SSO_PROVIDER_TYPES.FEISHU) {
      if (!data.appId || !data.appSecret) {
        return res.status(400).json({ error: 'App ID and App Secret are required for FEISHU type' })
      }
    }

    const provider = await prisma.ssoProvider.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        type: type,
        authorizeUrl: type === SSO_PROVIDER_TYPES.FEISHU ? FEISHU_DEFAULTS.AUTHORIZE_URL : data.authorizeUrl,
        tokenUrl: type === SSO_PROVIDER_TYPES.FEISHU ? FEISHU_DEFAULTS.TOKEN_URL : data.tokenUrl,
        userInfoUrl: type === SSO_PROVIDER_TYPES.FEISHU ? FEISHU_DEFAULTS.USER_INFO_URL : data.userInfoUrl,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        appId: data.appId,
        appSecret: data.appSecret,
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
    const type = data.type || SSO_PROVIDER_TYPES.GENERIC

    if (data.type) {
      if (data.type === SSO_PROVIDER_TYPES.GENERIC) {
        if (!data.clientId || !data.clientSecret) {
          return res.status(400).json({ error: 'Client ID and Client Secret are required for GENERIC type' })
        }
      } else if (data.type === SSO_PROVIDER_TYPES.FEISHU) {
        if (!data.appId || !data.appSecret) {
          return res.status(400).json({ error: 'App ID and App Secret are required for FEISHU type' })
        }
      }
    }

    const provider = await prisma.ssoProvider.update({
      where: { id },
      data: {
        displayName: data.displayName,
        type: data.type,
        authorizeUrl: type === SSO_PROVIDER_TYPES.FEISHU ? FEISHU_DEFAULTS.AUTHORIZE_URL : data.authorizeUrl,
        tokenUrl: type === SSO_PROVIDER_TYPES.FEISHU ? FEISHU_DEFAULTS.TOKEN_URL : data.tokenUrl,
        userInfoUrl: type === SSO_PROVIDER_TYPES.FEISHU ? FEISHU_DEFAULTS.USER_INFO_URL : data.userInfoUrl,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        appId: data.appId,
        appSecret: data.appSecret,
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
    await prisma.ssoProvider.update({
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
