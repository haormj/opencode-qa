# 助手路由系统设计

## 概述

支持多助手路由，管理员可创建多个助手（如"技术助手"、"业务助手"），每个助手绑定默认机器人。用户可在前端切换助手进行问答，不同助手的会话数据隔离。同时支持为特定用户在某个助手下分配专属机器人，方便开发验证。

## 核心概念

**助手：** 独立的问答空间，拥有独立的会话历史和默认机器人。

**路由逻辑：**
1. 用户选择助手进入问答
2. 发送消息时，系统查找该用户在此助手是否有专属Bot分配
3. 有专属Bot → 使用专属Bot；无 → 使用助手默认Bot

## 数据库设计

### 1. assistants 表

```typescript
assistants: {
  id: text          // 主键
  name: text        // 助手名称，如"技术助手"
  slug: text        // 标识，如"tech-support"，唯一
  description: text // 描述
  defaultBotId: text // 默认Bot ID，外键 → bots.id
  isActive: boolean // 是否启用
  createdAt: timestamp
  updatedAt: timestamp
}
```

### 2. userAssistantBots 表

```typescript
userAssistantBots: {
  id: integer       // 主键，自增
  assistantId: text // 助手ID，外键 → assistants.id
  userId: text      // 用户ID，外键 → users.id
  botId: text       // Bot ID，外键 → bots.id
  createdAt: timestamp
  updatedAt: timestamp
}
// 唯一索引: (assistantId, userId)
```

### 3. 修改 sessions 表

新增字段：
```typescript
assistantId: text // 助手ID，外键 → assistants.id
```

## API 设计

### 管理端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/assistants` | 获取助手列表 |
| POST | `/api/admin/assistants` | 创建助手 |
| GET | `/api/admin/assistants/:id` | 获取助手详情 |
| PUT | `/api/admin/assistants/:id` | 更新助手 |
| DELETE | `/api/admin/assistants/:id` | 删除助手 |
| GET | `/api/admin/assistants/:id/user-bots` | 获取助手的用户Bot分配列表 |
| POST | `/api/admin/assistants/:id/user-bots` | 添加用户Bot分配 |
| PUT | `/api/admin/assistants/:id/user-bots/:userId` | 更新用户Bot分配 |
| DELETE | `/api/admin/assistants/:id/user-bots/:userId` | 删除用户Bot分配 |

### 用户端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/assistants` | 获取可用助手列表 |
| GET | `/api/sessions?assistantId=xxx` | 获取指定助手的会话列表（修改现有接口） |

## 前端设计

### 管理后台

**新增页面：** `packages/frontend/src/pages/admin/Assistants.tsx`

**功能：**
1. 助手列表（表格展示：名称、标识、默认Bot、状态、操作）
2. 新增/编辑助手弹窗
3. 助手详情中的"用户Bot分配"列表
4. 添加/编辑用户Bot分配弹窗（选择用户 + 选择Bot）

**菜单调整：** 在管理后台侧边栏添加"助手"菜单项

### 用户端

**改动点：**

1. **顶部导航栏：** 添加助手切换下拉菜单
   - 显示当前助手名称
   - 下拉列表显示所有可用助手

2. **会话列表：** 按当前助手过滤
   - 修改会话列表查询，传入 `assistantId`
   - 创建新会话时关联当前助手

3. **聊天界面：** 
   - 获取当前助手信息
   - 显示助手名称/标识

## 路由实现逻辑

```typescript
// 伪代码：获取用户应使用的Bot
async function getUserBot(assistantId: string, userId: string): Promise<Bot> {
  // 1. 查询用户专属Bot分配
  const userBot = await db.select()
    .from(userAssistantBots)
    .where(and(
      eq(userAssistantBots.assistantId, assistantId),
      eq(userAssistantBots.userId, userId)
    ))
    .get()

  if (userBot) {
    // 有专属分配，返回配置的Bot
    return await db.select().from(bots).where(eq(bots.id, userBot.botId)).get()
  }

  // 2. 无专属分配，返回助手默认Bot
  const assistant = await db.select().from(assistants)
    .where(eq(assistants.id, assistantId))
    .get()

  return await db.select().from(bots)
    .where(eq(bots.id, assistant.defaultBotId))
    .get()
}
```

## 数据隔离

- 会话通过 `assistantId` 字段关联助手
- 查询会话列表时按 `assistantId` 过滤
- 不同助手的会话完全隔离，用户切换助手后看到不同的历史记录

## 实施步骤

1. **数据库层：**
   - 新增 `assistants` 表
   - 新增 `userAssistantBots` 表
   - 修改 `sessions` 表，添加 `assistantId` 字段
   - 生成迁移文件

2. **后端 API：**
   - 新增管理端助手相关路由
   - 新增管理端用户Bot分配路由
   - 新增用户端助手列表路由
   - 修改会话列表路由，支持按助手过滤
   - 修改消息发送逻辑，实现Bot路由

3. **管理后台前端：**
   - 新建助手管理页面
   - 添加菜单项

4. **用户端前端：**
   - 添加助手切换组件
   - 修改会话列表逻辑
   - 修改会话创建逻辑

5. **测试：**
   - 后端单元测试
   - E2E 测试

## 注意事项

1. **默认助手：** 系统初始化时创建一个默认助手，确保现有用户不受影响
2. **数据迁移：** 现有会话需要关联到默认助手
3. **Bot 删除：** 删除Bot时需检查是否有助手/用户分配在使用
4. **助手删除：** 删除助手时需处理关联的会话和用户分配
