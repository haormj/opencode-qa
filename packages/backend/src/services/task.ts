import { db, tasks, taskExecutions, taskExecutionMessages } from '../db/index.js'
import { eq, desc, lt, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function getTasks(options: { page: number; pageSize: number }) {
  const { page, pageSize } = options
  const offset = (page - 1) * pageSize
  
  const list = await db.select()
    .from(tasks)
    .orderBy(desc(tasks.createdAt))
    .limit(pageSize)
    .offset(offset)
  
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(tasks).get()
  const count = countResult?.count || 0
  
  return { list, total: count }
}

export async function getTaskById(id: string) {
  const task = await db.select().from(tasks).where(eq(tasks.id, id)).get()
  return task
}

export async function createTask(data: {
  name: string
  description?: string
  flowData: string
  scheduleType: string
  scheduleConfig?: string
  createdBy: string
}) {
  const now = new Date()
  const [task] = await db.insert(tasks).values({
    id: randomUUID(),
    name: data.name,
    description: data.description ?? null,
    flowData: data.flowData,
    scheduleType: data.scheduleType,
    scheduleConfig: data.scheduleConfig ?? null,
    isActive: true,
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
  scheduleType: string
  scheduleConfig: string
  isActive: boolean
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

export async function getAllExecutions(options: { page: number; pageSize: number; taskId?: string }) {
  const { page, pageSize, taskId } = options
  const offset = (page - 1) * pageSize
  
  let list
  let countResult
  
  if (taskId) {
    list = await db.select()
      .from(taskExecutions)
      .where(eq(taskExecutions.taskId, taskId))
      .orderBy(desc(taskExecutions.createdAt))
      .limit(pageSize)
      .offset(offset)
    
    countResult = await db.select({ count: sql<number>`count(*)` })
      .from(taskExecutions)
      .where(eq(taskExecutions.taskId, taskId))
      .get()
  } else {
    list = await db.select()
      .from(taskExecutions)
      .orderBy(desc(taskExecutions.createdAt))
      .limit(pageSize)
      .offset(offset)
    
    countResult = await db.select({ count: sql<number>`count(*)` })
      .from(taskExecutions)
      .get()
  }
  
  const count = countResult?.count || 0
  
  return { items: list, total: count }
}

export async function getExecutionById(id: string) {
  const execution = await db.select().from(taskExecutions).where(eq(taskExecutions.id, id)).get()
  return execution
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
