import { config } from 'dotenv'
config()

import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { db } from './db/index.js'
import { autoMigrate } from './db/auto-migrate.js'
import { seed } from './db/seed.js'
import messageRoutes from './routes/message.js'
import sessionRoutes from './routes/session.js'
import historyRoutes from './routes/history.js'
import authRoutes from './routes/auth.js'
import authSsoRoutes from './routes/auth-sso.js'
import adminRoutes from './routes/admin.js'
import adminSsoRoutes from './routes/admin-sso.js'
import adminSettingsRoutes from './routes/admin-settings.js'
import settingsRoutes from './routes/settings.js'
import botRoutes from './routes/bot.js'
import sessionEventsRoutes from './routes/session-events.js'
import assistantRoutes from './routes/assistant.js'
import adminAssistantRoutes from './routes/admin-assistant.js'
import skillRoutes from './routes/skill.js'
import adminSkillRoutes from './routes/admin-skill.js'
import adminSkillVersionRoutes from './routes/admin-skill-version.js'
import adminTaskRoutes, { initScheduler } from './routes/admin-task.js'
import executionEventsRoutes from './routes/execution-events.js'
import webhookRoutes from './routes/webhook.js'
import publicSkillRoutes from './routes/public-skill.js'
import { startScheduler } from './services/scheduler.js'
import { eventSubscriptionManager } from './services/event-subscription-manager.js'
import { accessLogger, errorLogger } from './middleware/logger.js'
import logger from './services/logger.js'

export { db }

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 8000

app.set('trust proxy', true)

app.use(accessLogger)
app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/auth/sso', authSsoRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/sessions', sessionEventsRoutes)  // 必须先注册，避免被 /:id 捕获
app.use('/api/sessions', sessionRoutes)
app.use('/api/history', historyRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/admin/sso-providers', adminSsoRoutes)
app.use('/api/admin/settings', adminSettingsRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/bots', botRoutes)
app.use('/api/assistants', assistantRoutes)
app.use('/api/admin/assistants', adminAssistantRoutes)
app.use('/api/skills', skillRoutes)
app.use('/api/admin/skills', adminSkillRoutes)
app.use('/api/admin/skill-versions', adminSkillVersionRoutes)
app.use('/api/admin/tasks', adminTaskRoutes)
app.use('/api/admin/executions', executionEventsRoutes)
app.use('/api/webhook', webhookRoutes)
app.use('/api/public', publicSkillRoutes)

app.use(errorLogger)

const publicPath = path.join(__dirname, '../public')
app.use(express.static(publicPath))

app.get('*', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'))
})

app.listen(PORT, async () => {
  await autoMigrate()
  await seed()
  logger.info(`Server running on http://localhost:${PORT}`)
  await eventSubscriptionManager.initialize()
  startScheduler()
  await initScheduler()
})

process.on('SIGINT', async () => {
  await eventSubscriptionManager.shutdown()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await eventSubscriptionManager.shutdown()
  process.exit(0)
})

process.on('uncaughtException', (error) => {
  logger.error('[UncaughtException]', error)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[UnhandledRejection]', { reason, promise })
})
