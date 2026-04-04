import { Router } from 'express'
import { prisma } from '../index.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id

    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const skip = (page - 1) * pageSize

    const [total, items] = await Promise.all([
      prisma.question.count({ where: { userId } }),
      prisma.question.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { feedback: true }
      })
    ])

    res.json({
      total,
      page,
      pageSize,
      items
    })
  } catch (error) {
    console.error('History error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
