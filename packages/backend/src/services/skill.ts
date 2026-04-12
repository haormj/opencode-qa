import { db, skills, skillCategories, skillFavorites, skillRatings, users } from '../db/index.js'
import { eq, desc, asc, sql, and, like } from 'drizzle-orm'
import { randomUUID } from 'crypto'

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
    changeLog: skills.changeLog,
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
    changeLog: skills.changeLog,
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
    content: skills.content,
    categoryId: skills.categoryId,
    authorId: skills.authorId,
    version: skills.version,
    changeLog: skills.changeLog,
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

  return skill
}

export async function getSkillById(id: string) {
  return db.select().from(skills).where(eq(skills.id, id)).get()
}

export async function createSkill(data: {
  name: string
  displayName: string
  slug: string
  description?: string
  content?: string
  categoryId?: number
  authorId: string
  version?: string
  changeLog?: string
}) {
  const now = new Date()
  const [skill] = await db.insert(skills).values({
    id: randomUUID(),
    name: data.name,
    displayName: data.displayName,
    slug: data.slug,
    description: data.description || '',
    content: data.content || '',
    categoryId: data.categoryId ?? null,
    authorId: data.authorId,
    version: data.version || '1.0.0',
    changeLog: data.changeLog,
    status: 'pending',
    createdAt: now,
    updatedAt: now
  }).returning()

  return skill
}

export async function updateSkill(id: string, data: Partial<{
  name: string
  displayName: string
  description: string
  content: string
  categoryId: number | null
  version: string
  changeLog: string
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
    changeLog: skills.changeLog,
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