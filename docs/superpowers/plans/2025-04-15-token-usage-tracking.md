# Token 使用量统计实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按助手统计 Token 使用量，在管理后台统计页面展示。

**Architecture:** 在 messages 表添加 token 字段，从 OpenCode API 响应中提取 tokens 并存储，按 assistantId 聚合统计后在前端展示。

**Tech Stack:** Drizzle ORM, SQLite, Express, React, Ant Design

---

## 文件结构

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `packages/backend/drizzle/0009_add_token_fields.sql` | 新建 | 数据库迁移文件 |
| `packages/backend/src/db/schema.ts` | 修改 | 添加 token 字段定义 |
| `packages/backend/src/services/opencode.ts` | 修改 | 返回 tokens 数据 |
| `packages/backend/src/routes/message.ts` | 修改 | 存储 tokens |
| `packages/backend/src/routes/admin.ts` | 修改 | 添加 token 统计接口 |
| `packages/frontend/src/services/api.ts` | 修改 | 添加类型定义 |
| `packages/frontend/src/pages/admin/StatisticsOverview.tsx` | 修改 | 展示 token 统计 |

---

### Task 1: 数据库迁移 - 添加 Token 字段

**Files:**
- Create: `packages/backend/drizzle/0009_add_token_fields.sql`

- [ ] **Step 1: 创建迁移文件**

```sql
ALTER TABLE `messages` ADD `input_tokens` integer;
ALTER TABLE `messages` ADD `output_tokens` integer;
```

- [ ] **Step 2: 提交**

```bash
git add packages/backend/drizzle/0009_add_token_fields.sql
git commit -m "feat(db): add input_tokens and output_tokens to messages table"
```

---

### Task 2: 更新数据库 Schema

**Files:**
- Modify: `packages/backend/src/db/schema.ts:85-95`

- [ ] **Step 1: 修改 messages 表定义**

在 `messages` 表定义中添加 token 字段（在第 91 行 `metadata` 后面添加）：

```typescript
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  senderType: text('sender_type').notNull(),
  content: text('content').notNull(),
  reasoning: text('reasoning'),
  metadata: text('metadata'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  botId: text('bot_id').references(() => bots.id, { onDelete: 'set null' })
})
```

- [ ] **Step 2: 提交**

```bash
git add packages/backend/src/db/schema.ts
git commit -m "feat(schema): add inputTokens and outputTokens to messages"
```

---

### Task 3: 修改 OpenCode 服务 - 返回 Tokens

**Files:**
- Modify: `packages/backend/src/services/opencode.ts`

- [ ] **Step 1: 修改 sendOpenCodeMessageStream 返回类型和实现**

将第 159-270 行的 `sendOpenCodeMessageStream` 函数修改为返回 tokens：

```typescript
export async function sendOpenCodeMessageStream(
  message: string,
  botConfig: BotConfig,
  opencodeSessionId: string | undefined,
  onChunk: (chunk: string, type: ChunkType) => void,
  onSessionId: (sessionId: string) => void
): Promise<{ sessionId: string; answer: string; tokens?: { input: number; output: number } }> {
  logger.debug('[OpenCode] sendOpenCodeMessageStream called:', { message: message.substring(0, 50), opencodeSessionId })
  
  const { sessionId } = await checkOrCreateOpenCodeSession(botConfig.apiUrl, opencodeSessionId)
  onSessionId(sessionId)
  
  const client = getClient(botConfig.apiUrl)
  
  let answer = ''
  let messageCompleted = false
  let completionResolver: () => void
  let intervalId: NodeJS.Timeout | null = null
  let lastActivityTime = Date.now()
  let timeoutCount = 0
  const MAX_TIMEOUT_COUNT = 3
  let tokensData: { input: number; output: number } | undefined = undefined
  
  const completionPromise = new Promise<void>(resolve => {
    completionResolver = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
      resolve()
    }
  })
  
  const wrappedOnChunk = (chunk: string, type: ChunkType) => {
    lastActivityTime = Date.now()
    timeoutCount = 0
    if (type === 'text') {
      answer += chunk
    }
    onChunk(chunk, type)
  }
  
  const onComplete = () => {
    logger.info('[OpenCode] Message completed via event')
    messageCompleted = true
    completionResolver()
  }
  
  eventSubscriptionManager.register(botConfig.apiUrl, sessionId, wrappedOnChunk, onComplete)

  intervalId = setInterval(() => {
    const idleTime = Date.now() - lastActivityTime
    if (idleTime >= 60000) {
      timeoutCount++
      logger.warn(`[OpenCode] Timeout check ${timeoutCount}/${MAX_TIMEOUT_COUNT} for session: ${sessionId}, idleTime: ${Math.round(idleTime / 1000)}s`)
      if (timeoutCount >= MAX_TIMEOUT_COUNT) {
        logger.warn(`[OpenCode] Stream timeout after ${MAX_TIMEOUT_COUNT} idle periods for session: ${sessionId}, answer length: ${answer.length}`)
        completionResolver()
      }
    }
  }, 60000)
  
  try {
    logger.debug('[OpenCode] Sending message to session:', sessionId)
    const promptPromise = client.session.prompt({
      sessionID: sessionId,
      model: {
        providerID: botConfig.provider,
        modelID: botConfig.model
      },
      agent: botConfig.agent,
      parts: [{ type: 'text', text: message }]
    })
    
    await completionPromise
    
    if (!answer) {
      logger.info(`[OpenCode] No answer from stream for session: ${sessionId}, trying prompt result`)
      try {
        const result = await promptPromise
        if (!result.data?.parts || result.data.parts.length === 0) {
          logger.warn(`[OpenCode] Prompt result empty for session: ${sessionId}, error: ${result.error ? JSON.stringify(result.error) : 'none'}`)
        }
        if (result.data?.parts) {
          for (const part of result.data.parts) {
            if (part.type === 'text' && 'text' in part && part.text) {
              answer += part.text
              onChunk(part.text, 'text')
            }
          }
        }
        if (result.data?.info?.tokens) {
          tokensData = {
            input: result.data.info.tokens.input || 0,
            output: result.data.info.tokens.output || 0
          }
        }
      } catch (error: any) {
        logger.error(`[OpenCode] Prompt request failed for session: ${sessionId}, error: ${error.message || error}`)
      }
    } else {
      try {
        const result = await promptPromise
        if (result.data?.info?.tokens) {
          tokensData = {
            input: result.data.info.tokens.input || 0,
            output: result.data.info.tokens.output || 0
          }
        }
      } catch (error: any) {
        logger.debug(`[OpenCode] Could not get tokens for session: ${sessionId}`)
      }
    }
  } finally {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    eventSubscriptionManager.unregister(botConfig.apiUrl, sessionId)
    logger.info(`[OpenCode] Stream completed for session: ${sessionId}, answer length: ${answer.length}`)
    
    if (!answer) {
      logger.warn(`[OpenCode] Empty stream answer for session: ${sessionId}`)
    }
  }
  
  return {
    sessionId,
    answer: answer || '抱歉，我无法回答这个问题。',
    tokens: tokensData
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/backend/src/services/opencode.ts
git commit -m "feat(opencode): return tokens from sendOpenCodeMessageStream"
```

---

### Task 4: 修改消息路由 - 存储 Tokens

**Files:**
- Modify: `packages/backend/src/routes/message.ts`

- [ ] **Step 1: 修改消息存储逻辑**

将第 180-207 行修改为：

```typescript
    const { sessionId: returnedSessionId, answer, tokens } = await sendOpenCodeMessageStream(
      content,
      botConfig,
      opencodeSessionId,
      (chunk: string, type: ChunkType) => {
        sendEvent(type, { text: chunk })
        if (type === 'reasoning') {
          reasoningContent += chunk
        }
      },
      (sid: string) => {
        opencodeSessionIdFromStream = sid
      }
    )

    if (opencodeSessionIdFromStream && opencodeSessionIdFromStream !== session.opencodeSessionId) {
      await db.update(sessions).set({ opencodeSessionId: opencodeSessionIdFromStream }).where(eq(sessions.id, sessionId))
    }

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

- [ ] **Step 2: 提交**

```bash
git add packages/backend/src/routes/message.ts
git commit -m "feat(message): store input and output tokens"
```

---

### Task 5: 修改管理统计接口 - 添加 Token 统计

**Files:**
- Modify: `packages/backend/src/routes/admin.ts`

- [ ] **Step 1: 在 /statistics 接口中添加 token 统计**

在第 395 行 `assistantStats` 构建完成后，返回响应前，添加 token 统计：

```typescript
    const tokenStats = await db.select({
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

    res.json({
      interceptionRate,
      sessions: { total, active, human, closed },
      users: { total: usersTotal },
      bots: { total: botsTotal },
      assistants: { total: assistantsTotal },
      assistantStats,
      tokenStats: tokenStats.map(stat => ({
        assistantId: stat.assistantId,
        assistantName: stat.assistantName,
        totalInputTokens: Number(stat.totalInputTokens) || 0,
        totalOutputTokens: Number(stat.totalOutputTokens) || 0
      }))
    })
```

- [ ] **Step 2: 提交**

```bash
git add packages/backend/src/routes/admin.ts
git commit -m "feat(admin): add token statistics endpoint"
```

---

### Task 6: 更新前端类型定义

**Files:**
- Modify: `packages/frontend/src/services/api.ts:658-686`

- [ ] **Step 1: 添加 TokenStat 类型并更新 Statistics**

```typescript
export interface AssistantStat {
  id: string | null
  name: string
  total: number
  active: number
  human: number
  closed: number
  interceptionRate: number
}

export interface TokenStat {
  assistantId: string
  assistantName: string
  totalInputTokens: number
  totalOutputTokens: number
}

export interface Statistics {
  interceptionRate: number
  sessions: {
    total: number
    active: number
    human: number
    closed: number
  }
  users: {
    total: number
  }
  bots: {
    total: number
  }
  assistants: {
    total: number
  }
  assistantStats: AssistantStat[]
  tokenStats: TokenStat[]
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/frontend/src/services/api.ts
git commit -m "feat(api): add TokenStat type for statistics"
```

---

### Task 7: 更新统计页面 - 展示 Token 统计

**Files:**
- Modify: `packages/frontend/src/pages/admin/StatisticsOverview.tsx`

- [ ] **Step 1: 在会话状态分布卡片后添加 Token 使用量卡片**

在 `</Card>` (会话状态分布卡片结束) 后添加：

```tsx
      <Card title="Token 使用量统计" className="pie-chart-card">
        {stats.tokenStats && stats.tokenStats.length > 0 ? (
          <div className="token-stats-table">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <th style={{ padding: '12px 8px', textAlign: 'left' }}>助手名称</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>输入 Tokens</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>输出 Tokens</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>总计</th>
                </tr>
              </thead>
              <tbody>
                {stats.tokenStats.map((stat, index) => (
                  <tr key={stat.assistantId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: ASSISTANT_COLORS[index % ASSISTANT_COLORS.length],
                        marginRight: '8px'
                      }}></span>
                      {stat.assistantName}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>{stat.totalInputTokens.toLocaleString()}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>{stat.totalOutputTokens.toLocaleString()}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 'bold' }}>
                      {(stat.totalInputTokens + stat.totalOutputTokens).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty description="暂无 Token 使用数据" />
        )}
      </Card>
```

- [ ] **Step 2: 提交**

```bash
git add packages/frontend/src/pages/admin/StatisticsOverview.tsx
git commit -m "feat(ui): add token usage statistics card"
```

---

### Task 8: 测试验证

**Files:**
- 无新建文件

- [ ] **Step 1: 运行类型检查**

```bash
cd packages/backend && npx tsc --noEmit
cd ../frontend && npx tsc --noEmit
```

- [ ] **Step 2: 构建项目**

```bash
npm run build
```

- [ ] **Step 3: 提交最终修改**

```bash
git add -A
git commit -m "feat: complete token usage tracking implementation"
```

---

## 自检清单

1. **Spec coverage:** 
   - 数据库字段 ✓ Task 1, 2
   - Token 获取 ✓ Task 3
   - Token 存储 ✓ Task 4
   - 统计接口 ✓ Task 5
   - 前端类型 ✓ Task 6
   - 前端展示 ✓ Task 7

2. **Placeholder scan:** 无 TBD/TODO

3. **Type consistency:**
   - `tokens?: { input: number; output: number }` 在 Task 3 定义
   - `TokenStat` 类型在 Task 6 定义
   - `tokenStats` 字段在 Task 5 返回，Task 6 定义，Task 7 使用
