import { db, users, roles, userRoles, bots, ssoProviders } from './index.js'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'
import { FEISHU_DEFAULTS } from '../services/sso-processors/feishu.js'
import { SSO_PROVIDER_TYPES } from '../services/sso-processor.js'

const FEISHU_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3370FF">
  <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.5L19 8l-7 3.5L5 8l7-3.5zM4 9.5l7 3.5v6.5l-7-3.5V9.5zm16 0v6.5l-7 3.5v-6.5l7-3.5z"/>
</svg>`
const FEISHU_ICON_BASE64 = Buffer.from(FEISHU_ICON_SVG).toString('base64')

export async function seed() {
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
    : process.env.OPENCODE_HOST 
      ? `http://${process.env.OPENCODE_HOST}:4096`
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

  // Upsert Feishu SSO provider
  const existingFeishuProvider = await db.select().from(ssoProviders)
    .where(eq(ssoProviders.name, 'feishu'))
    .get()

  if (!existingFeishuProvider) {
    await db.insert(ssoProviders).values({
      id: randomUUID(),
      name: 'feishu',
      displayName: '飞书',
      type: SSO_PROVIDER_TYPES.FEISHU,
      authorizeUrl: FEISHU_DEFAULTS.AUTHORIZE_URL,
      tokenUrl: FEISHU_DEFAULTS.TOKEN_URL,
      userInfoUrl: FEISHU_DEFAULTS.USER_INFO_URL,
      icon: FEISHU_ICON_BASE64,
      iconMimeType: 'image/svg+xml',
      enabled: false,
      sortOrder: 0,
      scope: 'openid',
      userIdField: 'open_id',
      usernameField: 'en_name',
      emailField: 'email',
      displayNameField: 'name',
      createdAt: now,
      updatedAt: now
    })
    console.log('Feishu SSO provider created (disabled by default)')
  } else {
    console.log('Feishu SSO provider already exists, skipping')
  }
}

// Run seed if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
