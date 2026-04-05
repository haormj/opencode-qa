import jwt from 'jsonwebtoken'
import { prisma } from '../index.js'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret'
const TOKEN_EXPIRES_DAYS = 7

export async function createToken(
  userId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<string> {
  await revokeAllUserTokens(userId)

  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: `${TOKEN_EXPIRES_DAYS}d` })
  
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRES_DAYS)

  await prisma.userToken.create({
    data: {
      userId,
      token,
      userAgent,
      ipAddress,
      expiresAt
    }
  })

  return token
}

export async function validateToken(token: string): Promise<boolean> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    
    const tokenRecord = await prisma.userToken.findUnique({
      where: { token }
    })

    if (!tokenRecord) return false
    if (tokenRecord.revokedAt) return false
    if (new Date() > tokenRecord.expiresAt) return false
    if (tokenRecord.userId !== decoded.userId) return false

    return true
  } catch {
    return false
  }
}

export async function revokeToken(token: string): Promise<void> {
  await prisma.userToken.update({
    where: { token },
    data: { revokedAt: new Date() }
  })
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.userToken.deleteMany({
    where: { userId }
  })
}

export async function cleanupExpiredTokens(): Promise<void> {
  await prisma.userToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { not: null } }
      ]
    }
  })
}
