import schedule from 'node-schedule'
import { db, bots, sessions, messages } from '../db/index.js'
import { eq, and, not, desc } from 'drizzle-orm'
import { deleteOpenCodeSession } from './opencode.js'
import logger from './logger.js'

const HOURS_24 = 24 * 60 * 60 * 1000

async function closeInactiveSessions(): Promise<number> {
  logger.info('开始执行关闭不活跃会话任务...')

  const defaultBot = await db.select().from(bots).where(eq(bots.isActive, true)).get()

  const now = new Date()
  const threshold = new Date(now.getTime() - HOURS_24)

  const sessionList = await db.select().from(sessions).where(and(not(eq(sessions.status, 'closed')), eq(sessions.isDeleted, false)))

  let closedCount = 0

  for (const session of sessionList) {
    const lastMessage = await db.select().from(messages).where(eq(messages.sessionId, session.id)).orderBy(desc(messages.createdAt)).limit(1).get()

    if (!lastMessage) continue

    if (new Date(lastMessage.createdAt) < threshold) {
      await db.update(sessions).set({ status: 'closed', updatedAt: new Date() }).where(eq(sessions.id, session.id))

      if (session.opencodeSessionId && defaultBot) {
        const deleted = await deleteOpenCodeSession(defaultBot.apiUrl, session.opencodeSessionId)
        if (deleted) {
          logger.info(`会话 ${session.id} 已关闭，OpenCode Session ${session.opencodeSessionId} 已删除`)
        } else {
          logger.error(`会话 ${session.id} 已关闭，但 OpenCode Session ${session.opencodeSessionId} 删除失败`)
        }
      } else {
        logger.info(`会话 ${session.id} 已关闭`)
      }

      closedCount++
    }
  }

  logger.info(`任务执行完成，共关闭 ${closedCount} 个会话`)
  return closedCount
}

export function startScheduler(): void {
  const now = new Date()
  const nextRun = new Date()
  nextRun.setHours(0, 5, 0, 0)
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1)
  }

  const hoursUntilNextRun = (nextRun.getTime() - now.getTime()) / (60 * 60 * 1000)

  if (hoursUntilNextRun > 1) {
    closeInactiveSessions().catch(err => logger.error('启动时执行关闭任务失败', err))
  }

  schedule.scheduleJob('5 0 * * *', async () => {
    try {
      await closeInactiveSessions()
      logger.cleanupOldLogs()
    } catch (error) {
      logger.error('定时任务执行失败', error instanceof Error ? error : new Error(String(error)))
    }
  })

  logger.info('定时任务服务已启动，将在每天 00:05 执行')
}
