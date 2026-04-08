import { Router } from 'express'
import { getSsoProviders, buildAuthorizeUrl, verifyState, ssoLogin } from '../services/sso.js'
import { revokeToken } from '../services/token.js'
import { authMiddleware } from '../middleware/auth.js'

import logger from '../services/logger.js'
const router = Router()

router.get('/providers', async (req, res) => {
  try {
    const providers = await getSsoProviders()
    res.json(providers)
  } catch (error) {
    logger.error('Get SSO providers error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:provider', async (req, res) => {
  try {
    const { provider } = req.params
    const { redirectUri } = req.query
    
    if (!redirectUri || typeof redirectUri !== 'string') {
      return res.status(400).json({ error: 'redirectUri is required' })
    }
    
    const result = await buildAuthorizeUrl(provider, redirectUri)
    res.json(result)
  } catch (error) {
    logger.error('Build authorize URL error:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

router.post('/:provider/callback', async (req, res) => {
  try {
    const { provider } = req.params
    const { code, state, redirectUri } = req.body

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' })
    }
    
    if (!redirectUri) {
      return res.status(400).json({ error: 'Missing redirectUri' })
    }

    const stateResult = verifyState(state)
    if (!stateResult.valid || stateResult.provider !== provider) {
      return res.status(400).json({ error: 'Invalid state' })
    }

    const userAgent = req.get('user-agent')
    const ipAddress = req.ip || req.socket.remoteAddress

    const result = await ssoLogin(provider, code, redirectUri, userAgent, ipAddress)

    res.json({
      token: result.token,
      user: {
        id: result.user.id,
        username: result.user.username,
        displayName: result.user.displayName,
        email: result.user.email
      }
    })
  } catch (error) {
    logger.error('SSO callback error:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      await revokeToken(token)
    }
    res.json({ success: true })
  } catch (error) {
    logger.error('Logout error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
