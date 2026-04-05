import { config } from 'dotenv'
config()

import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'
import messageRoutes from './routes/message.js'
import sessionRoutes from './routes/session.js'
import historyRoutes from './routes/history.js'
import authRoutes from './routes/auth.js'
import authSsoRoutes from './routes/auth-sso.js'
import adminRoutes from './routes/admin.js'
import adminSsoRoutes from './routes/admin-sso.js'
import botRoutes from './routes/bot.js'
import { startScheduler } from './services/scheduler.js'
import { eventSubscriptionManager } from './services/event-subscription-manager.js'
import { accessLogger, errorLogger } from './middleware/logger.js'
import logger from './services/logger.js'

export const prisma = new PrismaClient()

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
app.use('/api/sessions', sessionRoutes)
app.use('/api/history', historyRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/admin/sso-providers', adminSsoRoutes)
app.use('/api/bots', botRoutes)

app.use(errorLogger)

app.listen(PORT, async () => {
  logger.info(`Server running on http://localhost:${PORT}`)
  await eventSubscriptionManager.initialize()
  startScheduler()
})

process.on('SIGINT', async () => {
  await eventSubscriptionManager.shutdown()
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await eventSubscriptionManager.shutdown()
  await prisma.$disconnect()
  process.exit(0)
})
