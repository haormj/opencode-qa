import { Router } from 'express'
import { getSsoProviders, buildAuthorizeUrl, verifyState, ssoLogin } from '../services/sso.js'
import { revokeToken } from '../services/token.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

router.get('/providers', async (req, res) => {
  try {
    const providers = await getSsoProviders()
    res.json(providers)
  } catch (error) {
    console.error('Get SSO providers error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:provider', async (req, res) => {
  try {
    const { provider } = req.params
    const redirectUri = `${req.protocol}://${req.get('host')}/sso/callback`
    
    const result = await buildAuthorizeUrl(provider, redirectUri)
    res.json(result)
  } catch (error) {
    console.error('Build authorize URL error:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

router.post('/:provider/callback', async (req, res) => {
  try {
    const { provider } = req.params
    const { code, state } = req.body

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' })
    }

    const stateResult = verifyState(state)
    if (!stateResult.valid || stateResult.provider !== provider) {
      return res.status(400).json({ error: 'Invalid state' })
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/sso/callback`
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
    console.error('SSO callback error:', error)
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
    console.error('Logout error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
