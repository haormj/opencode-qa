import { Router } from 'express'
import { db, users, roles, userRoles, bots, sessions, messages, assistants } from '../db/index.js'
import { eq, and, or, desc, asc, sql, like, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'
import { deleteOpenCodeSession } from '../services/opencode.js'
import { sessionEventManager } from '../services/session-event-manager.js'
import logger from '../services/logger.js'

const router = Router()

router.use(authMiddleware)
router.use(requireAdmin)

router.get('/sessions', async (req, res) => {
  try {
    const { status, userId, search, needHuman, assistantId, page = '1', pageSize = '20' } = req.query

    const pageNum = parseInt(page as string) || 1
    const pageSizeNum = parseInt(pageSize as string) || 20
    const offset = (pageNum - 1) * pageSizeNum

    const conditions = []

    if (status && typeof status === 'string') {
      conditions.push(eq(sessions.status, status))
    }

    if (userId && typeof userId === 'string') {
      conditions.push(eq(sessions.userId, userId))
    }

    if (search && typeof search === 'string') {
      conditions.push(like(sessions.title, `%${search}%`))
    }

    if (needHuman !== undefined && typeof needHuman === 'string') {
      conditions.push(eq(sessions.needHuman, needHuman === 'true'))
    }

    if (assistantId && typeof assistantId === 'string') {
      conditions.push(eq(sessions.assistantId, assistantId))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(sessions).where(whereClause).get()
    const total = countResult?.count || 0

    const sessionList = await db.select().from(sessions).where(whereClause).orderBy(desc(sessions.updatedAt)).limit(pageSizeNum).offset(offset)

    const sessionsWithCounts = await Promise.all(sessionList.map(async (s) => {
      const countResult = await db.select({ count: sql<number>`count(*)` }).from(messages).where(eq(messages.sessionId, s.id)).get()
      return {
        ...s,
        messageCount: countResult?.count || 0
      }
    }))

    const userIds = [...new Set(sessionList.map(s => s.userId))]
    const userList = userIds.length > 0 
      ? await db.select({ id: users.id, username: users.username, displayName: users.displayName }).from(users).where(inArray(users.id, userIds))
      : []
    const userMap = new Map(userList.map(u => [u.id, u]))

    const assistantIds = [...new Set(sessionList.map(s => s.assistantId).filter(Boolean))] as string[]
    const assistantList = assistantIds.length > 0
      ? await db.select({ id: assistants.id, name: assistants.name }).from(assistants).where(inArray(assistants.id, assistantIds))
      : []
    const assistantMap = new Map(assistantList.map(a => [a.id, a]))

    res.json({
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      items: sessionsWithCounts.map(s => ({
        id: s.id,
        title: s.title,
        status: s.status,
        assistantId: s.assistantId,
        assistant: s.assistantId ? assistantMap.get(s.assistantId) || null : null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s.messageCount,
        user: userMap.get(s.userId) || { id: s.userId, username: 'Unknown', displayName: 'Unknown' }
      }))
    })
  } catch (error) {
    logger.error('Admin get sessions error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params

    const session = await db.select().from(sessions).where(eq(sessions.id, id)).get()

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const sessionMessages = await db.select({
      id: messages.id,
      senderType: messages.senderType,
      content: messages.content,
      reasoning: messages.reasoning,
      createdAt: messages.createdAt,
      userId: messages.userId,
      botId: messages.botId
    }).from(messages).where(eq(messages.sessionId, id)).orderBy(asc(messages.createdAt))

    const messagesWithDetails = await Promise.all(sessionMessages.map(async (m) => {
      let user = null
      let bot = null

      if (m.userId) {
        user = await db.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users).where(eq(users.id, m.userId)).get()
      }

      if (m.botId) {
        bot = await db.select({ id: bots.id, displayName: bots.displayName, avatar: bots.avatar }).from(bots).where(eq(bots.id, m.botId)).get()
      }

      return {
        id: m.id,
        senderType: m.senderType,
        content: m.content,
        reasoning: m.reasoning,
        createdAt: m.createdAt,
        user,
        bot
      }
    }))

    const sessionUser = await db.select({ id: users.id, username: users.username, displayName: users.displayName }).from(users).where(eq(users.id, session.userId)).get()

    res.json({
      id: session.id,
      title: session.title,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      user: sessionUser || { id: session.userId, username: 'Unknown', displayName: 'Unknown' },
      messages: messagesWithDetails
    })
  } catch (error) {
    logger.error('Admin get session error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/sessions/:id/reply', async (req, res) => {
  try {
    const { id } = req.params
    const { content } = req.body
    const adminUser = req.user

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' })
    }

    const session = await db.select().from(sessions).where(eq(sessions.id, id)).get()

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    if (session.status === 'closed') {
      return res.status(400).json({ error: 'Cannot reply to a closed session' })
    }

    if (session.status !== 'human') {
      return res.status(400).json({ error: 'Cannot reply to a session that does not need human assistance' })
    }

    const now = new Date()
    const [createdMessage] = await db.insert(messages).values({
      id: randomUUID(),
      sessionId: id,
      senderType: 'admin',
      content,
      userId: adminUser!.id,
      createdAt: now
    }).returning()

    const user = await db.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users).where(eq(users.id, adminUser!.id)).get()

    await db.update(sessions).set({ updatedAt: new Date() }).where(eq(sessions.id, id))

    sessionEventManager.emitMessage(id, {
      id: createdMessage.id,
      sessionId: createdMessage.sessionId,
      senderType: createdMessage.senderType,
      content: createdMessage.content,
      reasoning: createdMessage.reasoning,
      createdAt: createdMessage.createdAt,
      user: user ? { id: user.id, displayName: user.displayName, username: user.username } : null
    })

    res.json({
      id: createdMessage.id,
      senderType: createdMessage.senderType,
      content: createdMessage.content,
      createdAt: createdMessage.createdAt
    })
  } catch (error) {
    logger.error('Admin reply error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/sessions/:id/close', async (req, res) => {
  try {
    const { id } = req.params

    const session = await db.select().from(sessions).where(eq(sessions.id, id)).get()

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    if (session.status === 'closed') {
      return res.status(400).json({ error: 'Session is already closed' })
    }

    const [updated] = await db.update(sessions).set({ status: 'closed', updatedAt: new Date() }).where(eq(sessions.id, id)).returning()

    if (session.opencodeSessionId) {
      const defaultBot = await db.select().from(bots).where(eq(bots.isActive, true)).get()
      if (defaultBot) {
        await deleteOpenCodeSession(defaultBot.apiUrl, session.opencodeSessionId)
      }
    }

    res.json({
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt
    })
  } catch (error) {
    logger.error('Admin close session error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/users', async (req, res) => {
  try {
    const userList = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      displayName: users.displayName,
      createdAt: users.createdAt
    }).from(users).orderBy(desc(users.createdAt))

    const usersWithRoles = await Promise.all(userList.map(async (u) => {
      const roleList = await db.select({ roleName: roles.name }).from(userRoles).innerJoin(roles, eq(userRoles.roleId, roles.id)).where(eq(userRoles.userId, u.id))
      return {
        ...u,
        roles: roleList.map(r => r.roleName)
      }
    }))

    res.json(usersWithRoles)
  } catch (error) {
    logger.error('Admin get users error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/users/:id/roles', async (req, res) => {
  try {
    const { id } = req.params
    const { role } = req.body

    if (!role) {
      return res.status(400).json({ error: 'Role is required' })
    }

    const roleRecord = await db.select().from(roles).where(eq(roles.name, role)).get()

    if (!roleRecord) {
      return res.status(404).json({ error: 'Role not found' })
    }

    const existingUserRole = await db.select().from(userRoles).where(and(eq(userRoles.userId, id), eq(userRoles.roleId, roleRecord.id))).get()

    if (existingUserRole) {
      return res.status(400).json({ error: 'User already has this role' })
    }

    await db.insert(userRoles).values({
      userId: id,
      roleId: roleRecord.id,
      assignedAt: new Date()
    })

    res.json({ success: true })
  } catch (error) {
    logger.error('Admin assign role error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/users/:id/roles/:role', async (req, res) => {
  try {
    const { id, role } = req.params

    const roleRecord = await db.select().from(roles).where(eq(roles.name, role)).get()

    if (!roleRecord) {
      return res.status(404).json({ error: 'Role not found' })
    }

    await db.delete(userRoles).where(and(eq(userRoles.userId, id), eq(userRoles.roleId, roleRecord.id)))

    res.json({ success: true })
  } catch (error) {
    logger.error('Admin remove role error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/statistics', async (req, res) => {
  try {
    const totalResult = await db.select({ count: sql<number>`count(*)` }).from(sessions).get()
    const activeResult = await db.select({ count: sql<number>`count(*)` }).from(sessions).where(eq(sessions.status, 'active')).get()
    const humanResult = await db.select({ count: sql<number>`count(*)` }).from(sessions).where(eq(sessions.status, 'human')).get()
    const closedResult = await db.select({ count: sql<number>`count(*)` }).from(sessions).where(eq(sessions.status, 'closed')).get()

    const total = totalResult?.count || 0
    const active = activeResult?.count || 0
    const human = humanResult?.count || 0
    const closed = closedResult?.count || 0

    const closedWithNeedHumanResult = await db.select({ count: sql<number>`count(*)` }).from(sessions).where(and(eq(sessions.status, 'closed'), eq(sessions.needHuman, true))).get()
    const closedWithNeedHuman = closedWithNeedHumanResult?.count || 0

    const interceptionRate = closed > 0
      ? parseFloat(((1 - closedWithNeedHuman / closed) * 100).toFixed(1))
      : 100

    const usersTotalResult = await db.select({ count: sql<number>`count(*)` }).from(users).get()
    const usersTotal = usersTotalResult?.count || 0

    const botsTotalResult = await db.select({ count: sql<number>`count(*)` }).from(bots).get()
    const botsTotal = botsTotalResult?.count || 0

    const assistantsTotalResult = await db.select({ count: sql<number>`count(*)` }).from(assistants).get()
    const assistantsTotal = assistantsTotalResult?.count || 0

    const sessionStats = await db.select({
      assistantId: sessions.assistantId,
      status: sessions.status,
      needHuman: sessions.needHuman,
      count: sql<number>`count(*)`
    }).from(sessions).groupBy(sessions.assistantId, sessions.status, sessions.needHuman)

    const allAssistants = await db.select({
      id: assistants.id,
      name: assistants.name
    }).from(assistants)

    const assistantMap = new Map(allAssistants.map(a => [a.id, a.name]))

    const assistantGroups = new Map<string, { total: number; active: number; human: number; closed: number; closedWithNeedHuman: number }>()

    for (const stat of sessionStats) {
      const key = stat.assistantId || '__unassigned__'
      if (!assistantGroups.has(key)) {
        assistantGroups.set(key, { total: 0, active: 0, human: 0, closed: 0, closedWithNeedHuman: 0 })
      }
      const group = assistantGroups.get(key)!
      group.total += stat.count
      if (stat.status === 'active') group.active += stat.count
      if (stat.status === 'human') group.human += stat.count
      if (stat.status === 'closed') {
        group.closed += stat.count
        if (stat.needHuman) group.closedWithNeedHuman += stat.count
      }
    }

    const assistantStats = Array.from(assistantGroups.entries()).map(([id, stats]) => ({
      id: id === '__unassigned__' ? null : id,
      name: id === '__unassigned__' ? '未分配助手' : (assistantMap.get(id) || '未知助手'),
      total: stats.total,
      active: stats.active,
      human: stats.human,
      closed: stats.closed,
      interceptionRate: stats.closed > 0
        ? parseFloat(((1 - stats.closedWithNeedHuman / stats.closed) * 100).toFixed(1))
        : 100
    }))

    const tokenStats = await db.select({
      assistantId: sessions.assistantId,
      assistantName: assistants.name,
      totalInputTokens: sql<number>`sum(${messages.inputTokens})`,
      totalOutputTokens: sql<number>`sum(${messages.outputTokens})`
    })
      .from(messages)
      .innerJoin(sessions, eq(messages.sessionId, sessions.id))
      .innerJoin(assistants, eq(sessions.assistantId, assistants.id))
      .where(eq(messages.senderType, 'bot'))
      .groupBy(sessions.assistantId, assistants.name)

    res.json({
      interceptionRate,
      sessions: { total, active, human, closed },
      users: { total: usersTotal },
      bots: { total: botsTotal },
      assistants: { total: assistantsTotal },
      assistantStats,
      tokenStats: tokenStats.map(stat => ({
        assistantId: stat.assistantId,
        assistantName: stat.assistantName,
        totalInputTokens: Number(stat.totalInputTokens) || 0,
        totalOutputTokens: Number(stat.totalOutputTokens) || 0
      }))
    })
  } catch (error) {
    logger.error('Get statistics error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
