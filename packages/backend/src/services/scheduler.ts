import schedule from 'node-schedule'
import { prisma } from '../index.js'
import { deleteOpenCodeSession } from './opencode.js'
import * as logger from './logger.js'

const HOURS_24 = 24 * 60 * 60 * 1000

async function closeInactiveSessions(): Promise<number> {
  logger.info('开始执行关闭不活跃会话任务...')

  const now = new Date()
  const threshold = new Date(now.getTime() - HOURS_24)

  const sessions = await prisma.session.findMany({
    where: {
      status: { not: 'closed' },
      isDeleted: false
    },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })

  let closedCount = 0

  for (const session of sessions) {
    const lastMessage = session.messages[0]
    if (!lastMessage) continue

    if (new Date(lastMessage.createdAt) < threshold) {
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'closed' }
      })

      if (session.opencodeSessionId) {
        const deleted = await deleteOpenCodeSession(session.opencodeSessionId)
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
