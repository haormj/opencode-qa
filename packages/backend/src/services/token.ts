import jwt from 'jsonwebtoken'
import { db, userTokens } from '../db/index.js'
import { eq, or, lt, isNotNull, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

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

  await db.insert(userTokens).values({
    id: randomUUID(),
    userId,
    token,
    userAgent,
    ipAddress,
    expiresAt,
    createdAt: new Date()
  })

  return token
}

export async function validateToken(token: string): Promise<boolean> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    
    const tokenRecord = await db.select().from(userTokens).where(eq(userTokens.token, token)).get()

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
  await db.update(userTokens).set({ revokedAt: new Date() }).where(eq(userTokens.token, token))
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await db.delete(userTokens).where(eq(userTokens.userId, userId))
}

export async function cleanupExpiredTokens(): Promise<void> {
  await db.delete(userTokens).where(
    or(
      lt(userTokens.expiresAt, new Date()),
      isNotNull(userTokens.revokedAt)
    )
  )
}
