# 助手路由系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现多助手路由系统，支持管理员创建助手、配置默认机器人，并为特定用户分配专属机器人。

**Architecture:** 数据库新增 assistants 和 userAssistantBots 表，sessions 表新增 assistantId 字段。后端新增助手管理 API 和用户Bot分配 API，修改会话和消息路由支持助手过滤和Bot路由。前端新增管理后台助手页面，用户端添加助手切换功能。

**Tech Stack:** Express + Drizzle ORM + React + Ant Design + TypeScript

---

## 文件结构

**新增文件：**
```
packages/backend/src/routes/admin-assistant.ts    # 管理端助手路由
packages/backend/src/routes/assistant.ts          # 用户端助手路由
packages/backend/tests/routes/assistant.test.ts   # 助手路由测试
packages/frontend/src/pages/admin/Assistants.tsx  # 管理后台助手页面
packages/frontend/src/components/AssistantSelector.tsx  # 用户端助手切换组件
```

**修改文件：**
```
packages/backend/src/db/schema.ts                 # 新增 assistants、userAssistantBots 表定义
packages/backend/src/db/seed.ts                   # 创建默认助手
packages/backend/src/routes/session.ts            # 支持 assistantId 过滤
packages/backend/src/routes/message.ts            # 实现 Bot 路由逻辑
packages/backend/src/index.ts                     # 注册新路由
packages/frontend/src/services/api.ts             # 新增助手相关 API
packages/frontend/src/components/AdminSidebar/index.tsx  # 添加助手菜单
packages/frontend/src/components/Sidebar/SessionList.tsx # 按助手过滤会话
packages/frontend/src/pages/Home.tsx              # 添加助手切换功能
```

---

## Task 1: 数据库 Schema 定义

**Files:**
- Modify: `packages/backend/src/db/schema.ts`

- [ ] **Step 1: 添加 assistants 表定义**

在 `schema.ts` 中，`bots` 表定义之后添加：

```typescript
export const assistants = sqliteTable('assistants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  defaultBotId: text('default_bot_id').notNull().references(() => bots.id, { onDelete: 'restrict' }),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})
```

- [ ] **Step 2: 添加 userAssistantBots 表定义**

在 `assistants` 表定义之后添加：

```typescript
export const userAssistantBots = sqliteTable('user_assistant_bots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  assistantId: text('assistant_id').notNull().references(() => assistants.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  botId: text('bot_id').notNull().references(() => bots.id, { onDelete: 'restrict' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  userAssistantUnique: uniqueIndex('user_assistant_unique').on(table.assistantId, table.userId)
}))
```

- [ ] **Step 3: 修改 sessions 表，添加 assistantId 字段**

在 `sessions` 表定义中，`userId` 字段之后添加：

```typescript
assistantId: text('assistant_id').references(() => assistants.id, { onDelete: 'set null' }),
```

- [ ] **Step 4: 添加表关联关系**

在文件末尾的 relations 定义区域添加：

```typescript
export const assistantsRelations = relations(assistants, ({ one, many }) => ({
  defaultBot: one(bots, {
    fields: [assistants.defaultBotId],
    references: [bots.id]
  }),
  sessions: many(sessions),
  userAssistantBots: many(userAssistantBots)
}))

export const userAssistantBotsRelations = relations(userAssistantBots, ({ one }) => ({
  assistant: one(assistants, {
    fields: [userAssistantBots.assistantId],
    references: [assistants.id]
  }),
  user: one(users, {
    fields: [userAssistantBots.userId],
    references: [users.id]
  }),
  bot: one(bots, {
    fields: [userAssistantBots.botId],
    references: [bots.id]
  })
}))
```

同时修改 `sessionsRelations`，添加 assistant 关联：

```typescript
assistant: one(assistants, {
  fields: [sessions.assistantId],
  references: [assistants.id]
}),
```

- [ ] **Step 5: 导出类型定义**

在文件末尾的类型导出区域添加：

```typescript
export type Assistant = typeof assistants.$inferSelect
export type NewAssistant = typeof assistants.$inferInsert
export type UserAssistantBot = typeof userAssistantBots.$inferSelect
export type NewUserAssistantBot = typeof userAssistantBots.$inferInsert
```

- [ ] **Step 6: 更新 db/index.ts 导出**

修改 `packages/backend/src/db/index.ts`，导出新的表和类型：

```typescript
export { 
  users, roles, userRoles, bots, sessions, messages, userTokens, systemSettings, ssoProviders,
  assistants, userAssistantBots
} from './schema.js'

export type {
  User, NewUser, Role, NewRole, UserRole, NewUserRole, Bot, NewBot,
  Session, NewSession, Message, NewMessage, UserToken, NewUserToken,
  SystemSetting, NewSystemSetting, SsoProvider, NewSsoProvider,
  Assistant, NewAssistant, UserAssistantBot, NewUserAssistantBot
} from './schema.js'
```

---

## Task 2: 生成数据库迁移

**Files:**
- Create: `packages/backend/drizzle/XXXX_add_assistants.sql`

- [ ] **Step 1: 生成迁移文件**

运行命令：
```bash
cd packages/backend && npm run db:generate
```

预期输出：生成迁移文件，包含创建 assistants、user_assistant_bots 表和修改 sessions 表的 SQL。

- [ ] **Step 2: 检查迁移文件内容**

确认迁移文件包含：
1. 创建 `assistants` 表
2. 创建 `user_assistant_bots` 表
3. 给 `sessions` 表添加 `assistant_id` 字段

---

## Task 3: 修改 seed.ts 创建默认助手

**Files:**
- Modify: `packages/backend/src/db/seed.ts`

- [ ] **Step 1: 导入 assistants 表**

在文件顶部的导入语句中添加 `assistants`：

```typescript
import { db, users, roles, userRoles, bots, ssoProviders, systemSettings, assistants } from './index.js'
```

- [ ] **Step 2: 在 seed 函数中创建默认助手**

在创建 defaultBot 之后，添加创建默认助手的逻辑：

```typescript
// Upsert default assistant
const [defaultAssistant] = await db.insert(assistants).values({
  id: randomUUID(),
  name: '默认助手',
  slug: 'default',
  description: '默认问答助手',
  defaultBotId: defaultBot.id,
  isActive: true,
  createdAt: now,
  updatedAt: now
}).onConflictDoUpdate({
  target: assistants.slug,
  set: {
    name: '默认助手',
    description: '默认问答助手',
    defaultBotId: defaultBot.id,
    isActive: true,
    updatedAt: now
  }
}).returning()

console.log(`Default assistant ID: ${defaultAssistant.id}`)
console.log(`Default assistant name: ${defaultAssistant.name}`)
```

---

## Task 4: 创建用户端助手路由

**Files:**
- Create: `packages/backend/src/routes/assistant.ts`
- Modify: `packages/backend/src/index.ts`

- [ ] **Step 1: 创建 assistant.ts 路由文件**

```typescript
import { Router } from 'express'
import { db, assistants } from '../db/index.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import logger from '../services/logger.js'

const router = Router()

router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const allAssistants = await db.select({
      id: assistants.id,
      name: assistants.name,
      slug: assistants.slug,
      description: assistants.description,
      isActive: assistants.isActive,
      createdAt: assistants.createdAt
    }).from(assistants).where(eq(assistants.isActive, true)).orderBy(assistants.name)

    res.json(allAssistants)
  } catch (error) {
    logger.error('Get assistants error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const assistant = await db.select({
      id: assistants.id,
      name: assistants.name,
      slug: assistants.slug,
      description: assistants.description,
      isActive: assistants.isActive,
      createdAt: assistants.createdAt
    }).from(assistants).where(and(eq(assistants.id, id), eq(assistants.isActive, true))).get()

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' })
    }

    res.json(assistant)
  } catch (error) {
    logger.error('Get assistant error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
```

- [ ] **Step 2: 在 index.ts 中注册路由**

在 `packages/backend/src/index.ts` 中，导入新路由：

```typescript
import assistantRoutes from './routes/assistant.js'
```

在现有路由注册之后添加：

```typescript
app.use('/api/assistants', assistantRoutes)
```

---

## Task 5: 创建管理端助手路由

**Files:**
- Create: `packages/backend/src/routes/admin-assistant.ts`
- Modify: `packages/backend/src/index.ts`

- [ ] **Step 1: 创建 admin-assistant.ts 路由文件**

```typescript
import { Router } from 'express'
import { db, assistants, bots, users, userAssistantBots } from '../db/index.js'
import { eq, and, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'
import logger from '../services/logger.js'

const router = Router()

router.use(authMiddleware)
router.use(requireAdmin)

// 获取助手列表
router.get('/', async (req, res) => {
  try {
    const allAssistants = await db.select({
      id: assistants.id,
      name: assistants.name,
      slug: assistants.slug,
      description: assistants.description,
      defaultBotId: assistants.defaultBotId,
      isActive: assistants.isActive,
      createdAt: assistants.createdAt,
      updatedAt: assistants.updatedAt
    }).from(assistants).orderBy(desc(assistants.createdAt))

    // 获取关联的 Bot 信息
    const assistantsWithBot = await Promise.all(allAssistants.map(async (assistant) => {
      const bot = await db.select({
        id: bots.id,
        name: bots.name,
        displayName: bots.displayName
      }).from(bots).where(eq(bots.id, assistant.defaultBotId)).get()

      return {
        ...assistant,
        defaultBot: bot
      }
    }))

    res.json(assistantsWithBot)
  } catch (error) {
    logger.error('Get assistants error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取助手详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const assistant = await db.select().from(assistants).where(eq(assistants.id, id)).get()

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' })
    }

    const bot = await db.select({
      id: bots.id,
      name: bots.name,
      displayName: bots.displayName
    }).from(bots).where(eq(bots.id, assistant.defaultBotId)).get()

    res.json({
      ...assistant,
      defaultBot: bot
    })
  } catch (error) {
    logger.error('Get assistant error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 创建助手
router.post('/', async (req, res) => {
  try {
    const { name, slug, description, defaultBotId, isActive } = req.body

    if (!name || !slug || !defaultBotId) {
      return res.status(400).json({ error: 'Missing required fields: name, slug, defaultBotId' })
    }

    const bot = await db.select().from(bots).where(eq(bots.id, defaultBotId)).get()
    if (!bot) {
      return res.status(400).json({ error: 'Bot not found' })
    }

    const now = new Date()
    const [assistant] = await db.insert(assistants).values({
      id: randomUUID(),
      name,
      slug,
      description,
      defaultBotId,
      isActive: isActive ?? true,
      createdAt: now,
      updatedAt: now
    }).returning()

    res.json(assistant)
  } catch (error) {
    logger.error('Create assistant error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 更新助手
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, slug, description, defaultBotId, isActive } = req.body

    if (defaultBotId) {
      const bot = await db.select().from(bots).where(eq(bots.id, defaultBotId)).get()
      if (!bot) {
        return res.status(400).json({ error: 'Bot not found' })
      }
    }

    const [assistant] = await db.update(assistants).set({
      name,
      slug,
      description,
      defaultBotId,
      isActive,
      updatedAt: new Date()
    }).where(eq(assistants.id, id)).returning()

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' })
    }

    res.json(assistant)
  } catch (error) {
    logger.error('Update assistant error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 删除助手
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const assistant = await db.select().from(assistants).where(eq(assistants.id, id)).get()

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' })
    }

    if (assistant.slug === 'default') {
      return res.status(400).json({ error: 'Cannot delete default assistant' })
    }

    await db.delete(assistants).where(eq(assistants.id, id))

    res.json({ success: true })
  } catch (error) {
    logger.error('Delete assistant error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取助手的用户Bot分配列表
router.get('/:id/user-bots', async (req, res) => {
  try {
    const { id } = req.params

    const assignments = await db.select({
      id: userAssistantBots.id,
      assistantId: userAssistantBots.assistantId,
      userId: userAssistantBots.userId,
      botId: userAssistantBots.botId,
      createdAt: userAssistantBots.createdAt
    }).from(userAssistantBots).where(eq(userAssistantBots.assistantId, id))

    // 获取关联的用户和Bot信息
    const assignmentsWithDetails = await Promise.all(assignments.map(async (assignment) => {
      const user = await db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName
      }).from(users).where(eq(users.id, assignment.userId)).get()

      const bot = await db.select({
        id: bots.id,
        name: bots.name,
        displayName: bots.displayName
      }).from(bots).where(eq(bots.id, assignment.botId)).get()

      return {
        ...assignment,
        user,
        bot
      }
    }))

    res.json(assignmentsWithDetails)
  } catch (error) {
    logger.error('Get user-bot assignments error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 添加用户Bot分配
router.post('/:id/user-bots', async (req, res) => {
  try {
    const { id } = req.params
    const { userId, botId } = req.body

    if (!userId || !botId) {
      return res.status(400).json({ error: 'Missing required fields: userId, botId' })
    }

    const assistant = await db.select().from(assistants).where(eq(assistants.id, id)).get()
    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' })
    }

    const user = await db.select().from(users).where(eq(users.id, userId)).get()
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const bot = await db.select().from(bots).where(eq(bots.id, botId)).get()
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' })
    }

    const now = new Date()
    const [assignment] = await db.insert(userAssistantBots).values({
      assistantId: id,
      userId,
      botId,
      createdAt: now,
      updatedAt: now
    }).onConflictDoUpdate({
      target: [userAssistantBots.assistantId, userAssistantBots.userId],
      set: { botId, updatedAt: now }
    }).returning()

    res.json(assignment)
  } catch (error) {
    logger.error('Create user-bot assignment error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 更新用户Bot分配
router.put('/:id/user-bots/:userId', async (req, res) => {
  try {
    const { id, userId } = req.params
    const { botId } = req.body

    if (!botId) {
      return res.status(400).json({ error: 'Missing required field: botId' })
    }

    const bot = await db.select().from(bots).where(eq(bots.id, botId)).get()
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' })
    }

    const [assignment] = await db.update(userAssistantBots).set({
      botId,
      updatedAt: new Date()
    }).where(and(
      eq(userAssistantBots.assistantId, id),
      eq(userAssistantBots.userId, userId)
    )).returning()

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' })
    }

    res.json(assignment)
  } catch (error) {
    logger.error('Update user-bot assignment error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 删除用户Bot分配
router.delete('/:id/user-bots/:userId', async (req, res) => {
  try {
    const { id, userId } = req.params

    await db.delete(userAssistantBots).where(and(
      eq(userAssistantBots.assistantId, id),
      eq(userAssistantBots.userId, userId)
    ))

    res.json({ success: true })
  } catch (error) {
    logger.error('Delete user-bot assignment error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
```

- [ ] **Step 2: 在 index.ts 中注册路由**

在 `packages/backend/src/index.ts` 中添加：

```typescript
import adminAssistantRoutes from './routes/admin-assistant.js'
```

```typescript
app.use('/api/admin/assistants', adminAssistantRoutes)
```

---

## Task 6: 修改会话路由支持助手过滤

**Files:**
- Modify: `packages/backend/src/routes/session.ts`

- [ ] **Step 1: 导入 assistants 和 userAssistantBots**

在文件顶部的导入语句中添加：

```typescript
import { db, sessions, messages, users, bots, assistants, userAssistantBots } from '../db/index.js'
```

- [ ] **Step 2: 修改创建会话接口，支持 assistantId**

修改 `router.post('/')` 处理函数：

```typescript
router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id
    const { title, assistantId } = req.body

    // 验证助手是否存在且启用
    let validAssistantId = assistantId
    if (assistantId) {
      const assistant = await db.select().from(assistants)
        .where(and(eq(assistants.id, assistantId), eq(assistants.isActive, true)))
        .get()
      if (!assistant) {
        return res.status(400).json({ error: 'Assistant not found or inactive' })
      }
    } else {
      // 如果没有指定助手，使用默认助手
      const defaultAssistant = await db.select().from(assistants)
        .where(eq(assistants.slug, 'default'))
        .get()
      validAssistantId = defaultAssistant?.id
    }

    const sessionTitle = title && typeof title === 'string' && title.trim()
      ? (title.length > 30 ? title.substring(0, 30) + '...' : title)
      : '新对话'

    const now = new Date()
    const [session] = await db.insert(sessions).values({
      id: randomUUID(),
      userId,
      assistantId: validAssistantId,
      title: sessionTitle,
      status: 'active',
      createdAt: now,
      updatedAt: now
    }).returning()

    res.json({
      id: session.id,
      assistantId: session.assistantId,
      title: session.title,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    })
  } catch (error) {
    logger.error('Create session error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
```

- [ ] **Step 3: 修改获取会话列表接口，支持 assistantId 过滤**

修改 `router.get('/')` 处理函数：

```typescript
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id
    const { assistantId } = req.query

    const conditions = [eq(sessions.userId, userId), eq(sessions.isDeleted, false)]
    
    if (assistantId && typeof assistantId === 'string') {
      conditions.push(eq(sessions.assistantId, assistantId))
    }

    const sessionList = await db.select().from(sessions)
      .where(and(...conditions))
      .orderBy(desc(sessions.updatedAt))

    const sessionsWithCounts = await Promise.all(sessionList.map(async (s) => {
      const countResult = await db.select({ count: sql<number>`count(*)` }).from(messages).where(eq(messages.sessionId, s.id)).get()
      return {
        id: s.id,
        assistantId: s.assistantId,
        title: s.title,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: countResult?.count || 0
      }
    }))

    res.json(sessionsWithCounts)
  } catch (error) {
    logger.error('Get sessions error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
```

---

## Task 7: 修改消息路由实现 Bot 路由逻辑

**Files:**
- Modify: `packages/backend/src/routes/message.ts`

- [ ] **Step 1: 导入 assistants 和 userAssistantBots**

在文件顶部的导入语句中添加：

```typescript
import { db, bots, sessions, messages, users, assistants, userAssistantBots } from '../db/index.js'
```

- [ ] **Step 2: 创建获取用户 Bot 的辅助函数**

在文件顶部添加辅助函数：

```typescript
async function getUserBot(assistantId: string | null, userId: string): Promise<{ bot: typeof bots.$inferSelect; isUserAssigned: boolean } | null> {
  if (!assistantId) {
    // 如果没有助手ID，获取默认助手
    const defaultAssistant = await db.select().from(assistants).where(eq(assistants.slug, 'default')).get()
    if (!defaultAssistant) {
      return null
    }
    assistantId = defaultAssistant.id
  }

  // 1. 查询用户专属Bot分配
  const userBotAssignment = await db.select()
    .from(userAssistantBots)
    .where(and(
      eq(userAssistantBots.assistantId, assistantId),
      eq(userAssistantBots.userId, userId)
    ))
    .get()

  if (userBotAssignment) {
    const bot = await db.select().from(bots).where(eq(bots.id, userBotAssignment.botId)).get()
    if (bot) {
      return { bot, isUserAssigned: true }
    }
  }

  // 2. 返回助手默认Bot
  const assistant = await db.select().from(assistants).where(eq(assistants.id, assistantId)).get()
  if (!assistant) {
    return null
  }

  const bot = await db.select().from(bots).where(eq(bots.id, assistant.defaultBotId)).get()
  if (bot) {
    return { bot, isUserAssigned: false }
  }

  return null
}
```

- [ ] **Step 3: 修改消息发送接口，使用新的 Bot 路由逻辑**

修改 `router.post('/stream')` 处理函数中的 Bot 获取逻辑：

将原来的：
```typescript
const defaultBot = await db.select().from(bots).where(eq(bots.isActive, true)).get()

if (!defaultBot) {
  return res.status(500).json({ error: 'No active bot found' })
}
```

替换为：
```typescript
// 获取会话关联的助手ID
const sessionAssistantId = session.assistantId

// 根据助手和用户获取对应的 Bot
const botResult = await getUserBot(sessionAssistantId, userId)

if (!botResult) {
  return res.status(500).json({ error: 'No bot found for this assistant' })
}

const { bot: userBot, isUserAssigned } = botResult
logger.info(`[Message] Using bot: ${userBot.displayName} (user assigned: ${isUserAssigned})`)
```

并将后续所有 `defaultBot` 引用替换为 `userBot`。

---

## Task 8: 前端 API 服务更新

**Files:**
- Modify: `packages/frontend/src/services/api.ts`

- [ ] **Step 1: 添加 Assistant 类型定义**

在 `Bot` 类型定义之后添加：

```typescript
export interface Assistant {
  id: string
  name: string
  slug: string
  description?: string
  defaultBotId: string
  defaultBot?: {
    id: string
    name: string
    displayName: string
  }
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface UserAssistantBot {
  id: number
  assistantId: string
  userId: string
  botId: string
  user?: {
    id: string
    username: string
    displayName: string
  }
  bot?: {
    id: string
    name: string
    displayName: string
  }
  createdAt: string
}
```

- [ ] **Step 2: 修改 Session 类型，添加 assistantId**

修改 `Session` 接口：

```typescript
export interface Session {
  id: string
  assistantId?: string | null
  title: string
  status: string
  createdAt: string
  updatedAt: string
  messageCount: number
}
```

- [ ] **Step 3: 添加用户端助手 API**

在文件末尾添加：

```typescript
// Assistant APIs
export async function getAssistants(): Promise<Assistant[]> {
  return request(`${API_BASE}/assistants`)
}

export async function getAssistant(id: string): Promise<Assistant> {
  return request(`${API_BASE}/assistants/${id}`)
}
```

- [ ] **Step 4: 添加管理端助手 API**

```typescript
// Admin Assistant APIs
export async function getAdminAssistants(): Promise<Assistant[]> {
  return request(`${API_BASE}/admin/assistants`)
}

export async function getAdminAssistant(id: string): Promise<Assistant> {
  return request(`${API_BASE}/admin/assistants/${id}`)
}

export async function createAssistant(data: Partial<Assistant>): Promise<Assistant> {
  return request(`${API_BASE}/admin/assistants`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateAssistant(id: string, data: Partial<Assistant>): Promise<Assistant> {
  return request(`${API_BASE}/admin/assistants/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteAssistant(id: string): Promise<void> {
  await request(`${API_BASE}/admin/assistants/${id}`, {
    method: 'DELETE',
  })
}

export async function getAssistantUserBots(assistantId: string): Promise<UserAssistantBot[]> {
  return request(`${API_BASE}/admin/assistants/${assistantId}/user-bots`)
}

export async function createAssistantUserBot(assistantId: string, data: { userId: string; botId: string }): Promise<UserAssistantBot> {
  return request(`${API_BASE}/admin/assistants/${assistantId}/user-bots`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateAssistantUserBot(assistantId: string, userId: string, botId: string): Promise<UserAssistantBot> {
  return request(`${API_BASE}/admin/assistants/${assistantId}/user-bots/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ botId }),
  })
}

export async function deleteAssistantUserBot(assistantId: string, userId: string): Promise<void> {
  await request(`${API_BASE}/admin/assistants/${assistantId}/user-bots/${userId}`, {
    method: 'DELETE',
  })
}
```

- [ ] **Step 5: 修改会话相关 API**

修改 `createSession` 函数：

```typescript
export async function createSession(title?: string, assistantId?: string): Promise<Session> {
  return request<Session>(`${API_BASE}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ title, assistantId }),
  })
}
```

修改 `getSessions` 函数：

```typescript
export async function getSessions(assistantId?: string): Promise<Session[]> {
  const query = assistantId ? `?assistantId=${assistantId}` : ''
  return request<Session[]>(`${API_BASE}/sessions${query}`)
}
```

---

## Task 9: 创建管理后台助手页面

**Files:**
- Create: `packages/frontend/src/pages/admin/Assistants.tsx`

- [ ] **Step 1: 创建 Assistants.tsx 页面组件**

```tsx
import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Switch, message, Popconfirm, Select } from 'antd'
import { ReloadOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { 
  getAdminAssistants, createAssistant, updateAssistant, deleteAssistant,
  getAssistantUserBots, createAssistantUserBot, deleteAssistantUserBot,
  getBots, getAdminUsers,
  type Assistant, type Bot, type AdminUser, type UserAssistantBot
} from '../../services/api'
import './Admin.css'

function AdminAssistants() {
  const [loading, setLoading] = useState(false)
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [bots, setBots] = useState<Bot[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [userBotModalOpen, setUserBotModalOpen] = useState(false)
  const [editingAssistant, setEditingAssistant] = useState<Assistant | null>(null)
  const [currentAssistantId, setCurrentAssistantId] = useState<string | null>(null)
  const [userBots, setUserBots] = useState<UserAssistantBot[]>([])
  const [form] = Form.useForm()
  const [userBotForm] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [assistantsResult, botsResult, usersResult] = await Promise.all([
        getAdminAssistants(),
        getBots(),
        getAdminUsers()
      ])
      setAssistants(assistantsResult)
      setBots(botsResult)
      setUsers(usersResult)
    } catch (error) {
      message.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleEdit = (assistant: Assistant) => {
    setEditingAssistant(assistant)
    form.setFieldsValue({
      name: assistant.name,
      slug: assistant.slug,
      description: assistant.description,
      defaultBotId: assistant.defaultBotId,
      isActive: assistant.isActive
    })
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAssistant(id)
      message.success('删除成功')
      fetchData()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingAssistant) {
        await updateAssistant(editingAssistant.id, values)
        message.success('更新成功')
      } else {
        await createAssistant(values)
        message.success('创建成功')
      }
      setModalOpen(false)
      fetchData()
    } catch (error) {
      message.error(editingAssistant ? '更新失败' : '创建失败')
    }
  }

  const handleManageUserBots = async (assistantId: string) => {
    setCurrentAssistantId(assistantId)
    try {
      const result = await getAssistantUserBots(assistantId)
      setUserBots(result)
      setUserBotModalOpen(true)
    } catch (error) {
      message.error('加载用户Bot分配失败')
    }
  }

  const handleAddUserBot = async () => {
    try {
      const values = await userBotForm.validateFields()
      await createAssistantUserBot(currentAssistantId!, values)
      message.success('添加成功')
      userBotForm.resetFields()
      const result = await getAssistantUserBots(currentAssistantId!)
      setUserBots(result)
    } catch (error) {
      message.error('添加失败')
    }
  }

  const handleDeleteUserBot = async (userId: string) => {
    try {
      await deleteAssistantUserBot(currentAssistantId!, userId)
      message.success('删除成功')
      const result = await getAssistantUserBots(currentAssistantId!)
      setUserBots(result)
    } catch (error) {
      message.error('删除失败')
    }
  }

  const columns: ColumnsType<Assistant> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150
    },
    {
      title: '标识',
      dataIndex: 'slug',
      key: 'slug',
      width: 120
    },
    {
      title: '默认机器人',
      dataIndex: 'defaultBot',
      key: 'defaultBot',
      width: 150,
      render: (bot) => bot?.displayName || '-'
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>
          {active ? '启用' : '禁用'}
        </Tag>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<UserOutlined />}
            onClick={() => handleManageUserBots(record.id)}
          >
            用户分配
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {record.slug !== 'default' && (
            <Popconfirm
              title="确认删除"
              description="确定要删除此助手吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  const userBotColumns: ColumnsType<UserAssistantBot> = [
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
      width: 150,
      render: (user) => user?.displayName || user?.username || '-'
    },
    {
      title: '机器人',
      dataIndex: 'bot',
      key: 'bot',
      width: 150,
      render: (bot) => bot?.displayName || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="确认删除"
          description="确定要删除此分配吗？"
          onConfirm={() => handleDeleteUserBot(record.userId)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      )
    }
  ]

  return (
    <Card
      title="助手管理"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            刷新
          </Button>
          <Button type="primary" onClick={() => { setEditingAssistant(null); form.resetFields(); setModalOpen(true) }}>
            新增助手
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={assistants}
        rowKey="id"
        loading={loading}
        pagination={{
          showTotal: (total) => `共 ${total} 条`
        }}
      />

      <Modal
        title={editingAssistant ? '编辑助手' : '新增助手'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="确定"
        cancelText="取消"
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入助手名称' }]}>
            <Input placeholder="如：技术助手" />
          </Form.Item>
          <Form.Item name="slug" label="标识" rules={[{ required: true, message: '请输入助手标识' }]}>
            <Input placeholder="如：tech-support" disabled={!!editingAssistant} />
          </Form.Item>
          <Form.Item name="defaultBotId" label="默认机器人" rules={[{ required: true, message: '请选择默认机器人' }]}>
            <Select placeholder="选择默认机器人">
              {bots.map(bot => (
                <Select.Option key={bot.id} value={bot.id}>{bot.displayName}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="助手描述" />
          </Form.Item>
          <Form.Item name="isActive" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="用户Bot分配"
        open={userBotModalOpen}
        onCancel={() => setUserBotModalOpen(false)}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Form form={userBotForm} layout="inline">
            <Form.Item name="userId" rules={[{ required: true, message: '请选择用户' }]}>
              <Select placeholder="选择用户" style={{ width: 200 }} showSearch optionFilterProp="children">
                {users.map(user => (
                  <Select.Option key={user.id} value={user.id}>{user.displayName} ({user.username})</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="botId" rules={[{ required: true, message: '请选择机器人' }]}>
              <Select placeholder="选择机器人" style={{ width: 200 }}>
                {bots.map(bot => (
                  <Select.Option key={bot.id} value={bot.id}>{bot.displayName}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={handleAddUserBot}>添加</Button>
            </Form.Item>
          </Form>
        </div>
        <Table
          columns={userBotColumns}
          dataSource={userBots}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Modal>
    </Card>
  )
}

export default AdminAssistants
```

---

## Task 10: 添加管理后台菜单项

**Files:**
- Modify: `packages/frontend/src/components/AdminSidebar/index.tsx`

- [ ] **Step 1: 导入新图标**

修改导入语句：

```typescript
import { MessageOutlined, UserOutlined, BarChartOutlined, RobotOutlined, SettingOutlined, AppstoreOutlined } from '@ant-design/icons'
```

- [ ] **Step 2: 添加助手菜单项**

在 `menuItems` 数组中，在 `机器人管理` 之后添加：

```typescript
{
  key: '/admin/assistants',
  icon: <AppstoreOutlined />,
  label: '助手管理'
},
```

- [ ] **Step 3: 更新路由匹配逻辑**

在 `getSelectedKey` 函数中添加：

```typescript
if (pathname.startsWith('/admin/assistants')) return '/admin/assistants'
```

---

## Task 11: 创建用户端助手切换组件

**Files:**
- Create: `packages/frontend/src/components/AssistantSelector.tsx`

- [ ] **Step 1: 创建 AssistantSelector 组件**

```tsx
import { useState, useEffect } from 'react'
import { Select, message } from 'antd'
import { getAssistants, type Assistant } from '../services/api'

interface AssistantSelectorProps {
  value?: string | null
  onChange?: (assistantId: string | null) => void
  style?: React.CSSProperties
}

function AssistantSelector({ value, onChange, style }: AssistantSelectorProps) {
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getAssistants()
      .then(setAssistants)
      .catch(() => message.error('加载助手列表失败'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Select
      value={value}
      onChange={onChange}
      loading={loading}
      style={{ minWidth: 150, ...style }}
      placeholder="选择助手"
    >
      {assistants.map(assistant => (
        <Select.Option key={assistant.id} value={assistant.id}>
          {assistant.name}
        </Select.Option>
      ))}
    </Select>
  )
}

export default AssistantSelector
```

---

## Task 12: 修改用户端主页集成助手功能

**Files:**
- Modify: `packages/frontend/src/pages/Home.tsx`
- Modify: `packages/frontend/src/components/Sidebar/SessionList.tsx`

- [ ] **Step 1: 修改 SessionList 组件支持助手过滤**

修改 `packages/frontend/src/components/Sidebar/SessionList.tsx`，添加 `assistantId` prop：

```typescript
interface SessionListProps {
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
  refreshTrigger?: number
  collapsed?: boolean
  onSessionsLoad?: (sessions: Session[]) => void
  assistantId?: string | null
}
```

修改 `getSessions` 调用：

```typescript
const sessionList = await getSessions(assistantId || undefined)
```

- [ ] **Step 2: 修改 Home.tsx，添加助手状态和切换功能**

在 `Home.tsx` 中：

1. 添加状态：
```typescript
const [currentAssistantId, setCurrentAssistantId] = useState<string | null>(() => {
  return localStorage.getItem('currentAssistantId')
})
```

2. 保存当前助手到 localStorage：
```typescript
const handleAssistantChange = (assistantId: string | null) => {
  setCurrentAssistantId(assistantId)
  if (assistantId) {
    localStorage.setItem('currentAssistantId', assistantId)
  } else {
    localStorage.removeItem('currentAssistantId')
  }
  // 切换助手时清除当前会话
  setSearchParams({})
  setMessages([])
  setSessionStatus('active')
}
```

3. 修改 `createSession` 调用：
```typescript
const newSession = await createSession(text, currentAssistantId || undefined)
```

4. 在 `UserHeader` 或侧边栏顶部添加 `AssistantSelector` 组件

5. 传递 `assistantId` 给 `Sidebar`：
```typescript
<Sidebar
  currentSessionId={sessionId}
  onSelectSession={handleSelectSession}
  onNewSession={handleNewSession}
  refreshTrigger={refreshTrigger}
  onSessionsLoad={handleSessionsLoad}
  collapsed={sidebarCollapsed}
  assistantId={currentAssistantId}
/>
```

- [ ] **Step 3: 修改 Sidebar 组件传递 assistantId**

修改 `packages/frontend/src/components/Sidebar/index.tsx`：

```typescript
interface SidebarProps {
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
  refreshTrigger?: number
  onSessionsLoad?: (sessions: Session[]) => void
  collapsed?: boolean
  assistantId?: string | null
}
```

传递给 `SessionList`：
```typescript
<SessionList
  currentSessionId={currentSessionId}
  onSelectSession={onSelectSession}
  onNewSession={onNewSession}
  refreshTrigger={refreshTrigger}
  collapsed={collapsed}
  onSessionsLoad={onSessionsLoad}
  assistantId={assistantId}
/>
```

---

## Task 13: 添加路由配置

**Files:**
- Check/Modify: `packages/frontend/src/App.tsx` 或路由配置文件

- [ ] **Step 1: 添加助手管理页面路由**

在管理后台路由配置中添加：

```typescript
{
  path: '/admin/assistants',
  element: <AdminAssistants />
}
```

---

## Task 14: 运行测试和验证

- [ ] **Step 1: 运行后端类型检查**

```bash
cd packages/backend && npx tsc --noEmit
```

- [ ] **Step 2: 运行前端类型检查**

```bash
cd packages/frontend && npx tsc --noEmit
```

- [ ] **Step 3: 运行构建**

```bash
npm run build
```

- [ ] **Step 4: 启动开发服务器进行手动测试**

```bash
npm run dev
```

测试内容：
1. 管理后台：创建/编辑/删除助手
2. 管理后台：为助手添加用户Bot分配
3. 用户端：切换助手
4. 用户端：创建会话，确认会话关联正确的助手
5. 用户端：发送消息，确认使用正确的Bot

---

## Task 15: 提交代码

- [ ] **Step 1: 提交所有更改**

```bash
git add .
git commit -m "feat: add assistant routing system

- Add assistants and userAssistantBots tables
- Add assistant management API (admin + user)
- Modify session and message routes to support assistant routing
- Add admin assistant management page
- Add user assistant selector component
- Support user-specific bot assignment per assistant"
```
