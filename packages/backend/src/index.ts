import { config } from 'dotenv'
config()

import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'
import messageRoutes from './routes/message.js'
import sessionRoutes from './routes/session.js'
import historyRoutes from './routes/history.js'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import botRoutes from './routes/bot.js'

export const prisma = new PrismaClient()

const app = express()
const PORT = process.env.PORT || 8000

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/sessions', sessionRoutes)
app.use('/api/history', historyRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/bots', botRoutes)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
