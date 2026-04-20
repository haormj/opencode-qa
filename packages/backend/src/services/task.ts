import { db, tasks, taskExecutions, taskExecutionMessages, bots, users } from '../db/index.js'
import { eq, desc, lt, sql, and } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { randomUUID } from 'crypto'

export async function getTasks(options: { page: number; pageSize: number }) {
  const { page, pageSize } = options
  const offset = (page - 1) * pageSize
  
  const list = await db.select({
    id: tasks.id,
    name: tasks.name,
    description: tasks.description,
    flowData: tasks.flowData,
    triggerType: tasks.triggerType,
    scheduleConfig: tasks.scheduleConfig,
    webhookToken: tasks.webhookToken,
    isActive: tasks.isActive,
    botId: tasks.botId,
    createdBy: tasks.createdBy,
    createdAt: tasks.createdAt,
    updatedAt: tasks.updatedAt,
    botName: bots.displayName,
    createdById: users.id,
    createdByUsername: users.username,
    createdByDisplayName: users.displayName
  })
    .from(tasks)
    .leftJoin(bots, eq(tasks.botId, bots.id))
    .leftJoin(users, eq(tasks.createdBy, users.id))
    .orderBy(desc(tasks.createdAt))
    .limit(pageSize)
    .offset(offset)
  
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(tasks).get()
  const count = countResult?.count || 0
  
  const formattedList = list.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    flowData: item.flowData,
    triggerType: item.triggerType,
    scheduleConfig: item.scheduleConfig,
    webhookToken: item.webhookToken,
    isActive: item.isActive,
    botId: item.botId,
    botName: item.botName,
    createdBy: item.createdBy,
    createdByUser: item.createdById ? {
      id: item.createdById,
      username: item.createdByUsername,
      displayName: item.createdByDisplayName
    } : null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }))
  
  return { list: formattedList, total: count }
}

export async function getTaskById(id: string) {
  const result = await db.select({
    id: tasks.id,
    name: tasks.name,
    description: tasks.description,
    flowData: tasks.flowData,
    triggerType: tasks.triggerType,
    scheduleConfig: tasks.scheduleConfig,
    webhookToken: tasks.webhookToken,
    isActive: tasks.isActive,
    botId: tasks.botId,
    createdBy: tasks.createdBy,
    createdAt: tasks.createdAt,
    updatedAt: tasks.updatedAt,
    botName: bots.displayName
  })
    .from(tasks)
    .leftJoin(bots, eq(tasks.botId, bots.id))
    .where(eq(tasks.id, id))
    .get()
  return result
}

export async function createTask(data: {
  name: string
  description?: string
  flowData: string
  triggerType: string
  scheduleConfig?: string
  webhookToken?: string
  botId?: string
  createdBy: string
}) {
  const now = new Date()
  const [task] = await db.insert(tasks).values({
    id: randomUUID(),
    name: data.name,
    description: data.description ?? null,
    flowData: data.flowData,
    triggerType: data.triggerType,
    scheduleConfig: data.scheduleConfig ?? null,
    webhookToken: data.webhookToken ?? null,
    isActive: false,
    botId: data.botId ?? null,
    createdBy: data.createdBy,
    createdAt: now,
    updatedAt: now
  }).returning()
  
  return task
}

export async function updateTask(id: string, data: Partial<{
  name: string
  description: string
  flowData: string
  triggerType: string
  scheduleConfig: string
  webhookToken: string
  isActive: boolean
  botId: string
}>) {
  const [task] = await db.update(tasks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning()
  
  return task
}

export async function deleteTask(id: string) {
  await db.delete(tasks).where(eq(tasks.id, id))
}

export async function toggleTask(id: string) {
  const task = await getTaskById(id)
  if (!task) throw new Error('Task not found')
  
  return updateTask(id, { isActive: !task.isActive })
}

export async function getExecutionsByTaskId(taskId: string, options: { page: number; pageSize: number }) {
  const { page, pageSize } = options
  const offset = (page - 1) * pageSize
  
  const list = await db.select()
    .from(taskExecutions)
    .where(eq(taskExecutions.taskId, taskId))
    .orderBy(desc(taskExecutions.createdAt))
    .limit(pageSize)
    .offset(offset)
  
  return list
}

export async function getAllExecutions(options: { page: number; pageSize: number; taskId?: string; status?: string }) {
  const { page, pageSize, taskId, status } = options
  const offset = (page - 1) * pageSize
  
  const selectFields = {
    id: taskExecutions.id,
    taskId: taskExecutions.taskId,
    status: taskExecutions.status,
    triggerType: taskExecutions.triggerType,
    triggeredBy: taskExecutions.triggeredBy,
    startedAt: taskExecutions.startedAt,
    completedAt: taskExecutions.completedAt,
    isDebug: taskExecutions.isDebug,
    createdAt: taskExecutions.createdAt,
    triggeredByUserId: users.id,
    triggeredByUsername: users.username,
    triggeredByDisplayName: users.displayName
  }
  
  const conditions = []
  if (taskId) {
    conditions.push(eq(taskExecutions.taskId, taskId))
  }
  if (status) {
    conditions.push(eq(taskExecutions.status, status))
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined
  
  const list = await db.select(selectFields)
    .from(taskExecutions)
    .leftJoin(users, eq(taskExecutions.triggeredBy, users.id))
    .where(whereClause)
    .orderBy(desc(taskExecutions.createdAt))
    .limit(pageSize)
    .offset(offset)
  
  const countResult = await db.select({ count: sql<number>`count(*)` })
    .from(taskExecutions)
    .where(whereClause)
    .get()
  
  const count = countResult?.count || 0
  
  const formattedList = list.map(item => ({
    id: item.id,
    taskId: item.taskId,
    status: item.status,
    triggerType: item.triggerType,
    triggeredBy: item.triggeredBy,
    triggeredByUser: item.triggeredByUserId ? {
      id: item.triggeredByUserId,
      username: item.triggeredByUsername,
      displayName: item.triggeredByDisplayName
    } : null,
    startedAt: item.startedAt,
    completedAt: item.completedAt,
    isDebug: item.isDebug,
    createdAt: item.createdAt
  }))
  
  return { items: formattedList, total: count }
}

export async function getExecutionById(id: string) {
  const cancelledByUsers = alias(users, 'cancelled_by_users')
  
  const result = await db.select({
    id: taskExecutions.id,
    taskId: taskExecutions.taskId,
    status: taskExecutions.status,
    triggerType: taskExecutions.triggerType,
    triggeredBy: taskExecutions.triggeredBy,
    cancelledBy: taskExecutions.cancelledBy,
    startedAt: taskExecutions.startedAt,
    completedAt: taskExecutions.completedAt,
    result: taskExecutions.result,
    logs: taskExecutions.logs,
    botId: taskExecutions.botId,
    isDebug: taskExecutions.isDebug,
    createdAt: taskExecutions.createdAt,
    triggeredByUserId: users.id,
    triggeredByUsername: users.username,
    triggeredByDisplayName: users.displayName,
    cancelledByUserId: cancelledByUsers.id,
    cancelledByUsername: cancelledByUsers.username,
    cancelledByDisplayName: cancelledByUsers.displayName
  })
    .from(taskExecutions)
    .leftJoin(users, eq(taskExecutions.triggeredBy, users.id))
    .leftJoin(cancelledByUsers, eq(taskExecutions.cancelledBy, cancelledByUsers.id))
    .where(eq(taskExecutions.id, id))
    .get()
  
  if (!result) return null
  
  return {
    id: result.id,
    taskId: result.taskId,
    status: result.status,
    triggerType: result.triggerType,
    triggeredBy: result.triggeredBy,
    triggeredByUser: result.triggeredByUserId ? {
      id: result.triggeredByUserId,
      username: result.triggeredByUsername,
      displayName: result.triggeredByDisplayName
    } : null,
    cancelledBy: result.cancelledBy,
    cancelledByUser: result.cancelledByUserId ? {
      id: result.cancelledByUserId,
      username: result.cancelledByUsername,
      displayName: result.cancelledByDisplayName
    } : null,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    result: result.result,
    logs: result.logs,
    botId: result.botId,
    isDebug: result.isDebug,
    createdAt: result.createdAt
  }
}

export async function getExecutionMessages(executionId: string) {
  return db.select()
    .from(taskExecutionMessages)
    .where(eq(taskExecutionMessages.executionId, executionId))
    .orderBy(taskExecutionMessages.createdAt)
}

export async function cleanupOldExecutions() {
  const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  await db.delete(taskExecutions).where(lt(taskExecutions.createdAt, threshold))
}
