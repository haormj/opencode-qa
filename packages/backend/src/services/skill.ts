import { db, skills, skillCategories, skillFavorites, skillRatings, skillVersions, users } from '../db/index.js'
import { eq, desc, asc, sql, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import * as skillFileService from './skill-file.js'

export async function getSkills(params: {
  page?: number
  pageSize?: number
  category?: string
  search?: string
  sort?: string
  status?: string
  authorId?: string
}) {
  const { page = 1, pageSize = 20, category, search, sort = 'newest', authorId } = params
  const status = params.status ?? (authorId ? undefined : 'approved')
  const offset = (page - 1) * pageSize

  const conditions = []
  if (status) conditions.push(eq(skills.status, status))
  if (authorId) conditions.push(eq(skills.authorId, authorId))
  if (category) {
    const cat = await db.select().from(skillCategories).where(eq(skillCategories.slug, category)).get()
    if (cat) conditions.push(eq(skills.categoryId, cat.id))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  let orderBy
  switch (sort) {
    case 'trending':
      orderBy = [desc(skills.downloadCount)]
      break
    case 'downloads':
      orderBy = [desc(skills.downloadCount)]
      break
    case 'rating':
      orderBy = [desc(skills.averageRating)]
      break
    case 'newest':
    default:
      orderBy = [desc(skills.createdAt)]
      break
  }

  const countResult = await db.select({ count: sql<number>`count(*)` }).from(skills).where(whereClause).get()
  const total = countResult?.count || 0

  const skillList = await db.select({
    id: skills.id,
    name: skills.name,
    displayName: skills.displayName,
    slug: skills.slug,
    description: skills.description,
    categoryId: skills.categoryId,
    authorId: skills.authorId,
    version: skills.version,
    status: skills.status,
    downloadCount: skills.downloadCount,
    favoriteCount: skills.favoriteCount,
    averageRating: skills.averageRating,
    ratingCount: skills.ratingCount,
    createdAt: skills.createdAt,
    updatedAt: skills.updatedAt,
    categoryName: skillCategories.name,
    categorySlug: skillCategories.slug,
    authorName: users.displayName
  }).from(skills)
    .leftJoin(skillCategories, eq(skills.categoryId, skillCategories.id))
    .leftJoin(users, eq(skills.authorId, users.id))
    .where(whereClause)
    .orderBy(...orderBy)
    .limit(pageSize)
    .offset(offset)

  if (search) {
    const filtered = skillList.filter(s =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase())
    )
    return { total: filtered.length, page, pageSize, items: filtered }
  }

  return { total, page, pageSize, items: skillList }
}

export async function getTrendingSkills(limit: number = 10) {
  const skillList = await db.select({
    id: skills.id,
    name: skills.name,
    displayName: skills.displayName,
    slug: skills.slug,
    description: skills.description,
    categoryId: skills.categoryId,
    authorId: skills.authorId,
    version: skills.version,
    status: skills.status,
    downloadCount: skills.downloadCount,
    favoriteCount: skills.favoriteCount,
    averageRating: skills.averageRating,
    ratingCount: skills.ratingCount,
    createdAt: skills.createdAt,
    updatedAt: skills.updatedAt,
    categoryName: skillCategories.name,
    categorySlug: skillCategories.slug,
    authorName: users.displayName
  }).from(skills)
    .leftJoin(skillCategories, eq(skills.categoryId, skillCategories.id))
    .leftJoin(users, eq(skills.authorId, users.id))
    .where(eq(skills.status, 'approved'))
    .orderBy(desc(skills.downloadCount), desc(skills.favoriteCount))
    .limit(limit)

  return skillList
}

export async function getSkillBySlug(slug: string) {
  const skill = await db.select({
    id: skills.id,
    name: skills.name,
    displayName: skills.displayName,
    slug: skills.slug,
    description: skills.description,
    categoryId: skills.categoryId,
    authorId: skills.authorId,
    version: skills.version,
    status: skills.status,
    rejectReason: skills.rejectReason,
    downloadCount: skills.downloadCount,
    favoriteCount: skills.favoriteCount,
    averageRating: skills.averageRating,
    ratingCount: skills.ratingCount,
    createdAt: skills.createdAt,
    updatedAt: skills.updatedAt,
    categoryName: skillCategories.name,
    categorySlug: skillCategories.slug,
    authorName: users.displayName
  }).from(skills)
    .leftJoin(skillCategories, eq(skills.categoryId, skillCategories.id))
    .leftJoin(users, eq(skills.authorId, users.id))
    .where(eq(skills.slug, slug))
    .get()

  if (!skill) {
    return null
  }

  let readme: string | null = null
  if (skill.status === 'approved' || skill.version) {
    try {
      const readmeBuffer = await skillFileService.readSkillFile(skill.slug, skill.version, 'SKILL.md')
      if (readmeBuffer) {
        readme = readmeBuffer.toString('utf-8')
      }
    } catch {
      // ignore
    }
  }

  return { ...skill, readme }
}

export async function getSkillById(id: string) {
  return db.select().from(skills).where(eq(skills.id, id)).get()
}

export async function getSkillDetailById(id: string) {
  const skill = await db.select({
    id: skills.id,
    name: skills.name,
    displayName: skills.displayName,
    slug: skills.slug,
    description: skills.description,
    categoryId: skills.categoryId,
    authorId: skills.authorId,
    version: skills.version,
    status: skills.status,
    rejectReason: skills.rejectReason,
    downloadCount: skills.downloadCount,
    favoriteCount: skills.favoriteCount,
    averageRating: skills.averageRating,
    ratingCount: skills.ratingCount,
    createdAt: skills.createdAt,
    updatedAt: skills.updatedAt,
    categoryName: skillCategories.name,
    categorySlug: skillCategories.slug,
    authorName: users.displayName,
    authorUsername: users.username
  }).from(skills)
    .leftJoin(skillCategories, eq(skills.categoryId, skillCategories.id))
    .leftJoin(users, eq(skills.authorId, users.id))
    .where(eq(skills.id, id))
    .get()

  return skill
}

export async function createSkill(data: {
  name: string
  displayName: string
  slug: string
  description?: string
  categoryId?: number
  authorId: string
  changeLog?: string
}) {
  const now = new Date()
  const skillId = randomUUID()
  const versionId = randomUUID()

  await db.insert(skills).values({
    id: skillId,
    name: data.name,
    displayName: data.displayName,
    slug: data.slug,
    description: data.description || '',
    categoryId: data.categoryId ?? null,
    authorId: data.authorId,
    version: '1.0.0',
    status: 'pending',
    createdAt: now,
    updatedAt: now
  })

  await db.insert(skillVersions).values({
    id: versionId,
    skillId: skillId,
    version: '1.0.0',
    versionType: 'patch',
    changeLog: data.changeLog || '初始版本',
    status: 'pending',
    createdBy: data.authorId,
    createdAt: now,
    updatedAt: now
  })

  return { skillId, versionId, version: '1.0.0' }
}

export function incrementVersion(currentVersion: string, type: 'major' | 'minor' | 'patch'): string {
  const parts = currentVersion.split('.').map(Number)
  const [major = 0, minor = 0, patch = 0] = parts

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
    default:
      return `${major}.${minor}.${patch + 1}`
  }
}

export async function createSkillVersion(data: {
  skillId: string
  versionType: 'major' | 'minor' | 'patch'
  changeLog: string
  createdBy: string
  displayName?: string
  description?: string
}) {
  const skill = await getSkillById(data.skillId)
  if (!skill) {
    throw new Error('Skill not found')
  }

  const newVersion = incrementVersion(skill.version, data.versionType)
  const versionId = randomUUID()
  const now = new Date()

  await db.insert(skillVersions).values({
    id: versionId,
    skillId: data.skillId,
    version: newVersion,
    versionType: data.versionType,
    changeLog: data.changeLog,
    status: 'pending',
    createdBy: data.createdBy,
    createdAt: now,
    updatedAt: now
  })

  if (data.displayName || data.description) {
    await db.update(skills).set({
      displayName: data.displayName ?? skill.displayName,
      description: data.description ?? skill.description,
      updatedAt: now
    }).where(eq(skills.id, data.skillId))
  }

  return { versionId, version: newVersion }
}

export async function getSkillVersions(skillId: string) {
  const versions = await db.select({
    id: skillVersions.id,
    version: skillVersions.version,
    versionType: skillVersions.versionType,
    changeLog: skillVersions.changeLog,
    status: skillVersions.status,
    rejectReason: skillVersions.rejectReason,
    createdBy: skillVersions.createdBy,
    approvedBy: skillVersions.approvedBy,
    createdAt: skillVersions.createdAt,
    approvedAt: skillVersions.approvedAt,
    creatorName: users.displayName
  }).from(skillVersions)
    .leftJoin(users, eq(skillVersions.createdBy, users.id))
    .where(eq(skillVersions.skillId, skillId))
    .orderBy(desc(skillVersions.createdAt))

  return versions
}

export async function getSkillVersionById(versionId: string) {
  return db.select().from(skillVersions).where(eq(skillVersions.id, versionId)).get()
}

export async function approveSkillVersion(versionId: string, approvedBy: string) {
  const version = await getSkillVersionById(versionId)
  if (!version) {
    throw new Error('Version not found')
  }

  const now = new Date()

  await db.update(skillVersions).set({
    status: 'approved',
    approvedBy,
    approvedAt: now,
    updatedAt: now
  }).where(eq(skillVersions.id, versionId))

  const skill = await getSkillById(version.skillId)
  const updateData: Record<string, unknown> = {
    version: version.version,
    updatedAt: now
  }

  if (skill?.status !== 'approved') {
    updateData.status = 'approved'
    updateData.rejectReason = null
  }

  await db.update(skills).set(updateData).where(eq(skills.id, version.skillId))

  return { success: true }
}

export async function rejectSkillVersion(versionId: string, rejectReason: string) {
  const version = await getSkillVersionById(versionId)
  if (!version) {
    throw new Error('Version not found')
  }

  const now = new Date()

  await db.update(skillVersions).set({
    status: 'rejected',
    rejectReason,
    updatedAt: now
  }).where(eq(skillVersions.id, versionId))

  return { success: true }
}

export async function updateSkill(id: string, data: Partial<{
  name: string
  displayName: string
  description: string
  categoryId: number | null
  version: string
  status: string
  rejectReason: string | null
}>) {
  const [skill] = await db.update(skills).set({
    ...data,
    updatedAt: new Date()
  }).where(eq(skills.id, id)).returning()

  return skill
}

export async function deleteSkill(id: string) {
  await db.delete(skillVersions).where(eq(skillVersions.skillId, id))
  await db.delete(skillFavorites).where(eq(skillFavorites.skillId, id))
  await db.delete(skillRatings).where(eq(skillRatings.skillId, id))
  await db.delete(skills).where(eq(skills.id, id))
}

export async function getCategories() {
  return db.select().from(skillCategories).orderBy(asc(skillCategories.sortOrder))
}

export async function createCategory(data: { name: string; slug: string; icon?: string; sortOrder?: number }) {
  const now = new Date()
  const [cat] = await db.insert(skillCategories).values({
    ...data,
    sortOrder: data.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now
  }).returning()
  return cat
}

export async function updateCategory(id: number, data: Partial<{ name: string; slug: string; icon: string; sortOrder: number }>) {
  const [cat] = await db.update(skillCategories).set({ ...data, updatedAt: new Date() }).where(eq(skillCategories.id, id)).returning()
  return cat
}

export async function deleteCategory(id: number) {
  const skillCount = await db.select({ count: sql<number>`count(*)` }).from(skills).where(eq(skills.categoryId, id)).get()
  if (skillCount && skillCount.count > 0) {
    throw new Error('该分类下还有技能，无法删除')
  }
  await db.delete(skillCategories).where(eq(skillCategories.id, id))
}

export async function toggleFavorite(userId: string, skillId: string) {
  const existing = await db.select().from(skillFavorites)
    .where(and(eq(skillFavorites.userId, userId), eq(skillFavorites.skillId, skillId)))
    .get()

  if (existing) {
    await db.delete(skillFavorites).where(eq(skillFavorites.id, existing.id))
    await db.update(skills).set({
      favoriteCount: sql`${skills.favoriteCount} - 1`,
      updatedAt: new Date()
    }).where(eq(skills.id, skillId))
    return { favorited: false }
  } else {
    await db.insert(skillFavorites).values({
      userId,
      skillId,
      createdAt: new Date()
    })
    await db.update(skills).set({
      favoriteCount: sql`${skills.favoriteCount} + 1`,
      updatedAt: new Date()
    }).where(eq(skills.id, skillId))
    return { favorited: true }
  }
}

export async function getUserFavorites(userId: string) {
  const favorites = await db.select({
    id: skills.id,
    name: skills.name,
    displayName: skills.displayName,
    slug: skills.slug,
    description: skills.description,
    categoryId: skills.categoryId,
    authorId: skills.authorId,
    version: skills.version,
    status: skills.status,
    downloadCount: skills.downloadCount,
    favoriteCount: skills.favoriteCount,
    averageRating: skills.averageRating,
    ratingCount: skills.ratingCount,
    createdAt: skills.createdAt,
    updatedAt: skills.updatedAt,
    categoryName: skillCategories.name,
    categorySlug: skillCategories.slug,
    authorName: users.displayName
  }).from(skillFavorites)
    .innerJoin(skills, eq(skillFavorites.skillId, skills.id))
    .leftJoin(skillCategories, eq(skills.categoryId, skillCategories.id))
    .leftJoin(users, eq(skills.authorId, users.id))
    .where(and(eq(skillFavorites.userId, userId), eq(skills.status, 'approved')))
    .orderBy(desc(skillFavorites.createdAt))

  return favorites
}

export async function rateSkill(userId: string, skillId: string, score: number, review?: string) {
  const existing = await db.select().from(skillRatings)
    .where(and(eq(skillRatings.userId, userId), eq(skillRatings.skillId, skillId)))
    .get()

  if (existing) {
    await db.update(skillRatings).set({ score, review, createdAt: new Date() })
      .where(eq(skillRatings.id, existing.id))
  } else {
    await db.insert(skillRatings).values({
      userId,
      skillId,
      score,
      review,
      createdAt: new Date()
    })
  }

  const ratingStats = await db.select({
    avgRating: sql<number>`avg(${skillRatings.score})`,
    count: sql<number>`count(*)`
  }).from(skillRatings).where(eq(skillRatings.skillId, skillId)).get()

  await db.update(skills).set({
    averageRating: Math.round((ratingStats?.avgRating || 0) * 10) / 10,
    ratingCount: ratingStats?.count || 0,
    updatedAt: new Date()
  }).where(eq(skills.id, skillId))

  return { score, review }
}

export async function incrementDownloadCount(skillId: string) {
  await db.update(skills).set({
    downloadCount: sql`${skills.downloadCount} + 1`,
    updatedAt: new Date()
  }).where(eq(skills.id, skillId))
}
