import { db, users, roles, userRoles, bots } from './index.js'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'

async function main() {
  const existingUsers = await db.select().from(users).limit(1)
  
  if (existingUsers.length > 0) {
    console.log('Database already initialized, skipping seed')
    return
  }

  console.log('Initializing database...')
  const now = new Date()
  
  // Upsert admin role
  const [adminRole] = await db.insert(roles).values({
    name: 'admin',
    description: 'Administrator with full permissions',
    permissions: JSON.stringify(['all'])
  }).onConflictDoUpdate({
    target: roles.name,
    set: { description: 'Administrator with full permissions', permissions: JSON.stringify(['all']) }
  }).returning()

  // Upsert user role
  const [userRole] = await db.insert(roles).values({
    name: 'user',
    description: 'Regular user',
    permissions: JSON.stringify(['chat'])
  }).onConflictDoUpdate({
    target: roles.name,
    set: { description: 'Regular user', permissions: JSON.stringify(['chat']) }
  }).returning()

  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@opencode-qa.local'

  const hashedPassword = await bcrypt.hash(adminPassword, 10)

  // Upsert admin user
  const [adminUser] = await db.insert(users).values({
    id: randomUUID(),
    username: adminUsername,
    password: hashedPassword,
    email: adminEmail,
    displayName: 'Administrator',
    createdAt: now,
    updatedAt: now
  }).onConflictDoUpdate({
    target: users.username,
    set: { password: hashedPassword, email: adminEmail, updatedAt: now }
  }).returning()

  // Upsert admin user role
  const existingUserRole = await db.select().from(userRoles)
    .where(eq(userRoles.userId, adminUser.id))
    .get()
  
  if (!existingUserRole) {
    await db.insert(userRoles).values({
      userId: adminUser.id,
      roleId: adminRole.id,
      assignedAt: now
    })
  }

  // Upsert default bot
  const apiUrl = process.env.OPENCODE_HOST && process.env.OPENCODE_PORT 
    ? `http://${process.env.OPENCODE_HOST}:${process.env.OPENCODE_PORT}`
    : 'http://127.0.0.1:4096'

  const [defaultBot] = await db.insert(bots).values({
    id: randomUUID(),
    name: 'default',
    displayName: 'AI 助手',
    avatar: '#52c41a',
    apiUrl,
    provider: process.env.OPENCODE_PROVIDER || 'baiduqianfancodingplan',
    model: process.env.OPENCODE_MODEL || 'glm-5',
    description: '默认AI助手',
    isActive: true,
    createdAt: now,
    updatedAt: now
  }).onConflictDoUpdate({
    target: bots.name,
    set: { 
      displayName: 'AI 助手',
      avatar: '#52c41a',
      apiUrl,
      provider: process.env.OPENCODE_PROVIDER || 'baiduqianfancodingplan',
      model: process.env.OPENCODE_MODEL || 'glm-5',
      description: '默认AI助手',
      isActive: true,
      updatedAt: now
    }
  }).returning()

  console.log('Seed data created successfully')
  console.log(`Admin user: ${adminUsername}`)
  console.log(`Admin password: ${adminPassword}`)
  console.log(`Default bot ID: ${defaultBot.id}`)
  console.log(`Default bot name: ${defaultBot.displayName}`)
  console.log(`Default bot API: ${defaultBot.apiUrl}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
