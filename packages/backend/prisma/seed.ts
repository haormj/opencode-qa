import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Administrator with full permissions',
      permissions: JSON.stringify(['all'])
    }
  })

  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: {
      name: 'user',
      description: 'Regular user',
      permissions: JSON.stringify(['chat', 'feedback'])
    }
  })

  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@opencode-qa.local'

  const hashedPassword = await bcrypt.hash(adminPassword, 10)

  const adminUser = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      password: hashedPassword,
      email: adminEmail,
      displayName: 'Administrator'
    }
  })

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id
      }
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id
    }
  })

  const defaultBot = await prisma.bot.upsert({
    where: { name: 'default' },
    update: {},
    create: {
      name: 'default',
      displayName: 'AI 助手',
      avatar: '#52c41a',
      apiUrl: process.env.OPENCODE_HOST && process.env.OPENCODE_PORT 
        ? `http://${process.env.OPENCODE_HOST}:${process.env.OPENCODE_PORT}`
        : 'http://127.0.0.1:4096',
      provider: process.env.OPENCODE_PROVIDER || 'baiduqianfancodingplan',
      model: process.env.OPENCODE_MODEL || 'glm-5',
      description: '默认AI助手',
      isActive: true
    }
  })

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
  .finally(async () => {
    await prisma.$disconnect()
  })
