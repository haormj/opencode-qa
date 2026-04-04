import { Router } from 'express'
import { prisma } from '../index.js'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'

const router = Router()

router.use(authMiddleware)
router.use(requireAdmin)

router.get('/sessions', async (req, res) => {
  try {
    const { status, userId, search, page = '1', pageSize = '20' } = req.query

    const pageNum = parseInt(page as string) || 1
    const pageSizeNum = parseInt(pageSize as string) || 20
    const skip = (pageNum - 1) * pageSizeNum

    const where: Record<string, unknown> = {}

    if (status && typeof status === 'string') {
      where.status = status
    }

    if (userId && typeof userId === 'string') {
      where.userId = userId
    }

    if (search && typeof search === 'string') {
      where.title = {
        contains: search
      }
    }

    const [total, sessions] = await Promise.all([
      prisma.session.count({ where }),
      prisma.session.findMany({
        where,
        skip,
        take: pageSizeNum,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: { messages: true }
          }
        }
      })
    ])

    const userIds = [...new Set(sessions.map(s => s.userId))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, displayName: true }
    })
    const userMap = new Map(users.map(u => [u.id, u]))

    res.json({
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      items: sessions.map(s => ({
        id: s.id,
        title: s.title,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s._count.messages,
        user: userMap.get(s.userId) || { id: s.userId, username: 'Unknown', displayName: 'Unknown' }
      }))
    })
  } catch (error) {
    console.error('Admin get sessions error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: { id: true, displayName: true, username: true }
            },
            bot: {
              select: { id: true, displayName: true, avatar: true }
            }
          }
        }
      }
    })

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, displayName: true }
    })

    res.json({
      id: session.id,
      title: session.title,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      user: user || { id: session.userId, username: 'Unknown', displayName: 'Unknown' },
      messages: session.messages.map(m => ({
        id: m.id,
        senderType: m.senderType,
        content: m.content,
        createdAt: m.createdAt,
        user: m.user,
        bot: m.bot
      }))
    })
  } catch (error) {
    console.error('Admin get session error:', error)
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

    const session = await prisma.session.findUnique({
      where: { id }
    })

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    if (session.status === 'closed') {
      return res.status(400).json({ error: 'Cannot reply to a closed session' })
    }

    if (session.status !== 'human') {
      return res.status(400).json({ error: 'Cannot reply to a session that does not need human assistance' })
    }

    const message = await prisma.message.create({
      data: {
        sessionId: id,
        senderType: 'admin',
        content,
        userId: adminUser!.id
      }
    })

    await prisma.session.update({
      where: { id },
      data: { updatedAt: new Date() }
    })

    res.json({
      id: message.id,
      senderType: message.senderType,
      content: message.content,
      createdAt: message.createdAt
    })
  } catch (error) {
    console.error('Admin reply error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/sessions/:id/close', async (req, res) => {
  try {
    const { id } = req.params

    const session = await prisma.session.findUnique({
      where: { id }
    })

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    if (session.status === 'closed') {
      return res.status(400).json({ error: 'Session is already closed' })
    }

    const updated = await prisma.session.update({
      where: { id },
      data: { status: 'closed' }
    })

    res.json({
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt
    })
  } catch (error) {
    console.error('Admin close session error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        createdAt: true,
        userRoles: {
          include: {
            role: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json(users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      displayName: u.displayName,
      createdAt: u.createdAt,
      roles: u.userRoles.map(ur => ur.role.name)
    })))
  } catch (error) {
    console.error('Admin get users error:', error)
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

    const roleRecord = await prisma.role.findUnique({
      where: { name: role }
    })

    if (!roleRecord) {
      return res.status(404).json({ error: 'Role not found' })
    }

    const existingUserRole = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: id,
          roleId: roleRecord.id
        }
      }
    })

    if (existingUserRole) {
      return res.status(400).json({ error: 'User already has this role' })
    }

    await prisma.userRole.create({
      data: {
        userId: id,
        roleId: roleRecord.id
      }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Admin assign role error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/users/:id/roles/:role', async (req, res) => {
  try {
    const { id, role } = req.params

    const roleRecord = await prisma.role.findUnique({
      where: { name: role }
    })

    if (!roleRecord) {
      return res.status(404).json({ error: 'Role not found' })
    }

    await prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId: id,
          roleId: roleRecord.id
        }
      }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Admin remove role error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/statistics', async (req, res) => {
  try {
    const [total, active, human, closed] = await Promise.all([
      prisma.session.count(),
      prisma.session.count({ where: { status: 'active' } }),
      prisma.session.count({ where: { status: 'human' } }),
      prisma.session.count({ where: { status: 'closed' } })
    ])

    const closedWithNeedHuman = await prisma.session.count({
      where: { status: 'closed', needHuman: true }
    })
    const interceptionRate = closed > 0
      ? parseFloat(((1 - closedWithNeedHuman / closed) * 100).toFixed(1))
      : 100

    const usersTotal = await prisma.user.count()

    res.json({
      interceptionRate,
      sessions: { total, active, human, closed },
      users: { total: usersTotal }
    })
  } catch (error) {
    console.error('Get statistics error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
