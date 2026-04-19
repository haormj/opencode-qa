# Token 使用量统计设计

## 目标

按助手统计 Token 使用量，在管理后台统计页面展示。

## 范围

- 统计维度：按助手聚合
- Token 类型：input、output
- 展示位置：管理后台统计页面新增卡片

## 数据库变更

### 修改 messages 表

新增字段：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `inputTokens` | `integer` | `null` | 输入 token 数 |
| `outputTokens` | `integer` | `null` | 输出 token 数 |

### 迁移文件

位置：`packages/backend/drizzle/0002_add_token_fields.sql`

## 后端变更

### 1. 修改 OpenCode 服务 (`packages/backend/src/services/opencode.ts`)

**修改 `sendOpenCodeMessageStream` 返回类型：**

```typescript
interface StreamResult {
  sessionId: string
  answer: string
  tokens?: {
    input: number
    output: number
  }
}
```

**获取 token 数据：**

从 `client.session.prompt()` 返回结果中提取：
- `result.data.info.tokens.input`
- `result.data.info.tokens.output`

### 2. 修改消息路由 (`packages/backend/src/routes/message.ts`)

在存储 bot 消息时，保存 token 信息：

```typescript
const [botMessage] = await db.insert(messages).values({
  id: randomUUID(),
  sessionId,
  senderType: 'bot',
  content: answer || '抱歉，我无法回答这个问题。',
  reasoning: reasoningContent || null,
  botId: userBot.id,
  inputTokens: tokens?.input || null,
  outputTokens: tokens?.output || null,
  createdAt: new Date()
}).returning()
```

### 3. 修改管理统计接口 (`packages/backend/src/routes/admin.ts`)

新增 token 统计查询：

```typescript
// 按 assistantId 聚合 token
const tokenStats = await db
  .select({
    assistantId: sessions.assistantId,
    assistantName: assistants.name,
    totalInputTokens: sql<number>`sum(${messages.inputTokens})`,
    totalOutputTokens: sql<number>`sum(${messages.outputTokens})`
  })
  .from(messages)
  .innerJoin(sessions, eq(messages.sessionId, sessions.id))
  .innerJoin(assistants, eq(sessions.assistantId, assistants.id))
  .where(eq(messages.senderType, 'bot'))
  .groupBy(sessions.assistantId, assistants.name)
```

返回格式新增：

```typescript
{
  // ... 现有字段
  tokenStats: Array<{
    assistantId: string | null
    assistantName: string
    totalInputTokens: number
    totalOutputTokens: number
  }>
}
```

## 前端变更

### 1. 更新类型定义 (`packages/frontend/src/services/api.ts`)

```typescript
export interface TokenStat {
  assistantId: string | null
  assistantName: string
  totalInputTokens: number
  totalOutputTokens: number
}

export interface Statistics {
  // ... 现有字段
  tokenStats: TokenStat[]
}
```

### 2. 修改统计页面 (`packages/frontend/src/pages/admin/StatisticsOverview.tsx`)

新增「Token 使用量」卡片：

- 位置：在现有统计卡片下方
- 内容：表格展示每个助手的 input/output tokens
- 样式：与现有卡片风格一致

## 数据流

```
1. 用户发送消息
   ↓
2. OpenCode API 返回响应（含 tokens）
   ↓
3. sendOpenCodeMessageStream 提取 tokens 返回
   ↓
4. message.ts 存储 tokens 到 messages 表
   ↓
5. 管理后台请求 /admin/statistics
   ↓
6. 按 assistantId 聚合 tokens
   ↓
7. 前端展示统计结果
```

## 实现顺序

1. 数据库迁移文件（添加字段）
2. 更新 schema.ts（类型定义）
3. 修改 opencode.ts（返回 tokens）
4. 修改 message.ts（存储 tokens）
5. 修改 admin.ts（统计接口）
6. 修改前端类型定义
7. 修改前端统计页面

## 注意事项

- 历史数据的 tokens 字段为 null，不影响统计
- 仅统计 senderType='bot' 的消息
- assistantId 为 null 的消息归属于 default 助手
