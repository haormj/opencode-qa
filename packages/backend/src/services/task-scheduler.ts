import schedule from 'node-schedule'
import { db, tasks, bots } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { executeTask } from './task-executor.js'
import { cleanupOldExecutions } from './task.js'
import logger from './logger.js'

interface IntervalSchedule {
  value: number
  unit: 'minutes' | 'hours'
}

interface DailySchedule {
  time: string
}

interface WeeklySchedule {
  days: number[]
  time: string
}

interface MonthlySchedule {
  day: number
  time: string
}

type ScheduleConfig = IntervalSchedule | DailySchedule | WeeklySchedule | MonthlySchedule

interface ScheduledTask {
  id: string
  name: string
  job: schedule.Job | null
  config: ScheduleConfig
}

const scheduledTasks = new Map<string, ScheduledTask>()

function getCronExpression(config: ScheduleConfig): string {
  if ('value' in config && 'unit' in config) {
    if (config.unit === 'minutes') {
      return `*/${config.value} * * * *`
    } else {
      return `0 */${config.value} * * *`
    }
  }
  
  if ('days' in config && 'time' in config) {
    const [hours, minutes] = config.time.split(':').map(Number)
    return `${minutes} ${hours} * * ${config.days.join(',')}`
  }
  
  if ('day' in config && 'time' in config) {
    const [hours, minutes] = config.time.split(':').map(Number)
    return `${minutes} ${hours} ${config.day} * *`
  }
  
  if ('time' in config) {
    const [hours, minutes] = config.time.split(':').map(Number)
    return `${minutes} ${hours} * * *`
  }
  
  return '0 8 * * *'
}

async function runTask(taskId: string): Promise<{ executionId: string; status: string; result?: string; error?: string } | null> {
  try {
    const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).get()
    if (!task) {
      logger.error(`[TaskScheduler] Task not found: ${taskId}`)
      return null
    }

    const bot = await db.select().from(bots).where(eq(bots.isActive, true)).get()
    if (!bot) {
      logger.error('[TaskScheduler] No default bot configured')
      return null
    }

    const botConfig = {
      apiUrl: bot.apiUrl,
      provider: bot.provider,
      model: bot.model,
      agent: bot.agent,
      apiKey: bot.apiKey ?? undefined
    }

    logger.info(`[TaskScheduler] Executing scheduled task: ${task.name} (${taskId})`)
    
    const result = await executeTask({
      taskId,
      triggerType: 'schedule',
      botConfig
    })

    if (result.status === 'completed') {
      logger.info(`[TaskScheduler] Task ${task.name} completed successfully`)
    } else {
      logger.error(`[TaskScheduler] Task ${task.name} failed: ${result.error}`)
    }

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`[TaskScheduler] Error executing task ${taskId}:`, errorMessage)
    return null
  }
}

async function scheduleCleanup(): Promise<void> {
  const cleanupJob = schedule.scheduleJob('0 3 * * *', async () => {
    try {
      logger.info('[TaskScheduler] Starting daily cleanup of old executions...')
      await cleanupOldExecutions()
      logger.info('[TaskScheduler] Cleanup completed')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('[TaskScheduler] Cleanup failed:', errorMessage)
    }
  })

  logger.info('[TaskScheduler] Daily cleanup scheduled at 03:00')
}

export async function init(): Promise<void> {
  logger.info('[TaskScheduler] Initializing task scheduler...')

  const activeTasks = await db.select()
    .from(tasks)
    .where(eq(tasks.isActive, true))

  for (const task of activeTasks) {
    if (task.scheduleType === 'none' || !task.scheduleConfig) {
      continue
    }

    try {
      const config: ScheduleConfig = JSON.parse(task.scheduleConfig)
      await registerTask(task.id, task.name, config)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`[TaskScheduler] Failed to parse schedule config for task ${task.id}:`, errorMessage)
    }
  }

  await scheduleCleanup()

  logger.info(`[TaskScheduler] Initialized with ${scheduledTasks.size} scheduled tasks`)
}

export async function registerTask(taskId: string, taskName: string, config: ScheduleConfig): Promise<void> {
  const existing = scheduledTasks.get(taskId)
  if (existing && existing.job) {
    existing.job.cancel()
  }

  const cronExpression = getCronExpression(config)
  
  const job = schedule.scheduleJob(cronExpression, async () => {
    await runTask(taskId)
  })

  scheduledTasks.set(taskId, {
    id: taskId,
    name: taskName,
    job,
    config
  })

  logger.info(`[TaskScheduler] Registered task "${taskName}" (${taskId}) with cron: ${cronExpression}`)
}

export function cancelTask(taskId: string): boolean {
  const scheduled = scheduledTasks.get(taskId)
  if (!scheduled) {
    return false
  }

  if (scheduled.job) {
    scheduled.job.cancel()
  }

  scheduledTasks.delete(taskId)
  logger.info(`[TaskScheduler] Cancelled task: ${taskId}`)
  return true
}

export async function updateTask(taskId: string, taskName: string, config: ScheduleConfig): Promise<void> {
  cancelTask(taskId)
  await registerTask(taskId, taskName, config)
}

export function getScheduledTasks(): ScheduledTask[] {
  return Array.from(scheduledTasks.values())
}

export function isTaskScheduled(taskId: string): boolean {
  return scheduledTasks.has(taskId)
}

export function shutdown(): void {
  for (const [taskId, scheduled] of scheduledTasks) {
    if (scheduled.job) {
      scheduled.job.cancel()
    }
  }
  scheduledTasks.clear()
  logger.info('[TaskScheduler] Scheduler shutdown complete')
}

export type { ScheduleConfig, IntervalSchedule, DailySchedule, WeeklySchedule, MonthlySchedule }
