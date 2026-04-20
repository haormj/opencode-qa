# 任务调试模式设计文档

## 概述

为任务执行新增调试模式，支持开发者在任务执行过程中进行多轮交互，实时调整任务方向。

## 功能需求

### 用户场景

1. **任务调试**：开发者执行任务时，可以继续输入，与正在运行的 AI 进行多轮对话，实时调整任务方向
2. **单轮对话调试**：针对单个消息的调试，发送后保持输入框可用，可以追加指令或纠正 AI 理解

### 触发方式

- **任务详情页**：显示"调试"按钮（替换"运行"按钮）
- **任务列表页**：保留"运行"按钮（非调试模式）

## 改动点概览

| 页面 | 文件 | 改动 |
|------|------|------|
| 任务列表 | `Tasks.tsx` | 保持不变，保留"运行"按钮 |
| 任务详情 | `TaskCreate.tsx` | "运行"按钮改为"调试"按钮 |
| 执行详情 | `TaskExecutionDetail.tsx` | 调试模式下显示输入框 + "关闭会话"按钮 |
| 后端 API | `execution.ts` | 新增追加消息、关闭会话 API |
| 后端服务 | `task-executor.ts` | 支持调试模式的消息追加 |

## UI 设计

### 执行详情页 - 调试模式

```
┌─────────────────────────────────────┐
│ ← 执行详情                  [关闭会话] │  ← 调试模式下显示关闭按钮
├─────────────────────────────────────┤
│ ID: xxx | 执行中 | 耗时: 30s         │
├─────────────────────────────────────┤
│                                     │
│  [用户消息] 任务指令                 │
│                                     │
│  [AI 回复] 正在执行...               │
│                                     │
│  [用户消息] 请修改 xxx               │  ← 追加的用户消息
│                                     │
│  [AI 回复中...]        [停止]        │  ← AI 回复中显示停止按钮
│                                     │
├─────────────────────────────────────┤
│ [输入框]                    [发送]   │  ← 调试模式下显示输入框
└─────────────────────────────────────┘
```

### 执行详情页 - 普通模式

```
┌─────────────────────────────────────┐
│ ← 执行详情                  [终止任务] │  ← 非调试模式显示终止按钮
├─────────────────────────────────────┤
│ ID: xxx | 执行中 | 耗时: 30s         │
├─────────────────────────────────────┤
│                                     │
│  [用户消息] 任务指令                 │
│                                     │
│  [AI 回复] 正在执行...               │
│                                     │
└─────────────────────────────────────┘
                                    （无输入框）
```

## 前端实现

### 1. TaskCreate.tsx 改动

**改动内容**：
- 将"运行"按钮改为"调试"按钮
- 点击调试时 URL 带参数 `?debug=true`

**代码改动**：

```tsx
// 原来
<Button
  type="primary"
  icon={<PlayCircleOutlined />}
  onClick={handleExecute}
>
  运行
</Button>

// 改为
<Button
  type="primary"
  icon={<BugOutlined />}
  onClick={handleDebug}
>
  调试
</Button>
```

```tsx
// 新增 handleDebug 函数
const handleDebug = async () => {
  if (!id) return
  
  try {
    await handleSave()
    const result = await executeTask(id)
    message.success('任务开始执行')
    navigate(`/admin/executions/${result.executionId}?debug=true`)
  } catch (error) {
    // 错误处理
  }
}
```

### 2. TaskExecutionDetail.tsx 改动

**改动内容**：
- 检测 URL 参数 `debug`
- 调试模式下显示输入框和关闭会话按钮
- 复用 `CustomComposer` 组件作为输入框

**新增状态**：

```tsx
const [debug] = useState(() => {
  const params = new URLSearchParams(window.location.search)
  return params.get('debug') === 'true'
})
const [inputText, setInputText] = useState('')
const [sending, setSending] = useState(false)
```

**新增 API 调用**：

```tsx
// 发送消息
const handleSendMessage = async () => {
  if (!inputText.trim() || !id || sending) return
  
  setSending(true)
  try {
    await appendExecutionMessage(id, inputText.trim())
    setInputText('')
  } catch (error) {
    message.error('发送失败')
  } finally {
    setSending(false)
  }
}

// 关闭会话
const handleCloseSession = async () => {
  if (!id) return
  
  try {
    await closeExecutionSession(id)
    message.success('会话已关闭')
    navigate('/admin/tasks')
  } catch (error) {
    message.error('关闭失败')
  }
}
```

**UI 改动**：

```tsx
// Header 右侧按钮
{execution.status === 'running' && (
  debug ? (
    <Button type="primary" onClick={handleCloseSession}>
      关闭会话
    </Button>
  ) : (
    <Popconfirm
      title="确认终止"
      onConfirm={handleCancel}
    >
      <Button danger icon={<StopOutlined />}>
        终止任务
      </Button>
    </Popconfirm>
  )
)}

// 消息列表下方输入框（调试模式）
{debug && execution.status === 'running' && (
  <div className="execution-input">
    <Input
      value={inputText}
      onChange={e => setInputText(e.target.value)}
      onPressEnter={handleSendMessage}
      placeholder="输入消息..."
    />
    <Button 
      type="primary" 
      onClick={handleSendMessage}
      loading={sending}
      disabled={!inputText.trim()}
    >
      发送
    </Button>
  </div>
)}
```

### 3. 新增 API 函数

**文件**：`packages/frontend/src/services/api.ts`

```tsx
// 追加消息到执行中
export async function appendExecutionMessage(executionId: string, content: string): Promise<void> {
  const response = await fetch(`/api/executions/${executionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  })
  if (!response.ok) throw new Error('Failed to append message')
}

// 关闭调试会话
export async function closeExecutionSession(executionId: string): Promise<void> {
  const response = await fetch(`/api/executions/${executionId}/close`, {
    method: 'POST'
  })
  if (!response.ok) throw new Error('Failed to close session')
}
```

## 后端实现

### 1. 新增 API 路由

**文件**：`packages/backend/src/routes/execution.ts`（新建或修改现有文件）

```typescript
// POST /api/executions/:id/messages - 追加消息
router.post('/:id/messages', requireAuth, async (req, res) => {
  const { id } = req.params
  const { content } = req.body
  
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Content is required' })
  }
  
  try {
    await appendExecutionMessage(id, content, req.user!.id)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to append message' })
  }
})

// POST /api/executions/:id/close - 关闭调试会话
router.post('/:id/close', requireAuth, async (req, res) => {
  const { id } = req.params
  
  try {
    await closeExecutionSession(id, req.user!.id)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to close session' })
  }
})
```

### 2. 修改 task-executor.ts

**新增函数**：

```typescript
// 追加消息到执行中
export async function appendExecutionMessage(
  executionId: string,
  content: string,
  userId: string
): Promise<void> {
  const execution = await db.select()
    .from(taskExecutions)
    .where(eq(taskExecutions.id, executionId))
    .get()
  
  if (!execution) {
    throw new Error('执行记录不存在')
  }
  
  if (execution.status !== 'running') {
    throw new Error('只有运行中的任务可以追加消息')
  }
  
  if (!execution.opencodeSessionId) {
    throw new Error('OpenCode 会话不存在')
  }
  
  // 保存用户消息
  const userMessageId = randomUUID()
  await db.insert(taskExecutionMessages).values({
    id: userMessageId,
    executionId,
    role: 'user',
    content,
    createdAt: new Date()
  })
  
  // 广播用户消息
  executionEventManager.emitMessage(executionId, {
    id: userMessageId,
    executionId,
    role: 'user',
    content,
    createdAt: new Date()
  })
  
  // 获取 bot 配置
  const bot = execution.botId 
    ? await db.select().from(bots).where(eq(bots.id, execution.botId)).get()
    : null
  
  const botConfig: BotConfig = {
    apiUrl: process.env.OPENCODE_SERVER_URL || 'http://localhost:4096',
    provider: bot?.provider || 'openai',
    model: bot?.model || 'gpt-4',
    agent: bot?.agent || 'opencode'
  }
  
  // 创建 AI 消息占位
  const assistantMessageId = randomUUID()
  await db.insert(taskExecutionMessages).values({
    id: assistantMessageId,
    executionId,
    role: 'assistant',
    content: '',
    createdAt: new Date()
  })
  
  executionEventManager.emitStreamStart(executionId, assistantMessageId)
  
  // 发送消息到 OpenCode（使用现有 session）
  let accumulatedContent = ''
  let reasoningContent = ''
  
  const { answer } = await sendOpenCodeMessageStreamWithWorkspace(
    content,
    botConfig,
    getWorkspacePath(executionId),
    (chunk: string, type: string) => {
      if (type === 'text') {
        accumulatedContent += chunk
        executionEventManager.emitText(executionId, chunk)
      } else if (type === 'reasoning') {
        reasoningContent += chunk
        executionEventManager.emitReasoning(executionId, chunk)
      }
    },
    async (sessionId: string) => {
      // session 已存在，无需处理
    },
    execution.opencodeSessionId  // 复用现有 session
  )
  
  executionEventManager.emitStreamEnd(executionId)
  
  // 更新 AI 消息
  await db.update(taskExecutionMessages)
    .set({ content: answer, reasoning: reasoningContent || null })
    .where(eq(taskExecutionMessages.id, assistantMessageId))
  
  executionEventManager.emitMessage(executionId, {
    id: assistantMessageId,
    executionId,
    role: 'assistant',
    content: answer,
    reasoning: reasoningContent || null,
    createdAt: new Date()
  })
}

// 关闭调试会话
export async function closeExecutionSession(
  executionId: string,
  userId: string
): Promise<void> {
  const execution = await db.select()
    .from(taskExecutions)
    .where(eq(taskExecutions.id, executionId))
    .get()
  
  if (!execution) {
    throw new Error('执行记录不存在')
  }
  
  if (execution.status !== 'running') {
    throw new Error('只有运行中的任务可以关闭')
  }
  
  // 删除 OpenCode session
  if (execution.opencodeSessionId) {
    const bot = execution.botId 
      ? await db.select().from(bots).where(eq(bots.id, execution.botId)).get()
      : null
    
    const apiUrl = process.env.OPENCODE_SERVER_URL || 'http://localhost:4096'
    
    try {
      await deleteOpenCodeSession(apiUrl, execution.opencodeSessionId)
    } catch (error) {
      logger.error('[TaskExecutor] Failed to delete OpenCode session:', error)
    }
  }
  
  // 标记执行完成
  await db.update(taskExecutions)
    .set({
      status: 'completed',
      completedAt: new Date()
    })
    .where(eq(taskExecutions.id, executionId))
  
  // 清理 workspace
  if (shouldCleanupImmediately()) {
    await cleanupWorkspace(executionId)
  }
  
  executionEventManager.emitStatus(executionId, 'completed')
}
```

### 3. 修改 opencode.ts

**修改 `sendOpenCodeMessageStreamWithWorkspace` 函数**，支持传入现有 sessionId：

```typescript
export async function sendOpenCodeMessageStreamWithWorkspace(
  message: string,
  botConfig: BotConfig,
  workspacePath: string,
  onChunk: (chunk: string, type: string) => void,
  onSessionCreated?: (sessionId: string) => Promise<void>,
  existingSessionId?: string  // 新增：复用现有 session
): Promise<{ answer: string }> {
  const client = createIsolatedClient({
    apiUrl: botConfig.apiUrl,
    workspacePath
  })
  
  let sessionId = existingSessionId
  
  // 如果没有现有 session，创建新的
  if (!sessionId) {
    const sessionResult = await client.session.create({
      title: 'OpenCode QA Task Execution'
    })
    sessionId = sessionResult.data!.id
    if (onSessionCreated) {
      await onSessionCreated(sessionId)
    }
  }
  
  // ... 后续流式处理逻辑
}
```

### 4. 修改执行完成逻辑

**修改 `executeTaskStream` 函数**，调试模式下不删除 session：

```typescript
// 在执行完成时判断是否为调试模式
const isDebugMode = /* 从某处获取调试模式标记 */

if (!isDebugMode && currentSessionId) {
  try {
    await deleteOpenCodeSession(botConfig.apiUrl, currentSessionId)
  } catch (error) {
    logger.error('[TaskExecutor] Failed to delete OpenCode session:', error)
  }
}
```

**方案**：在 `taskExecutions` 表新增 `isDebug` 字段，或通过 URL 参数 `debug` 在前端控制关闭时机。

## 数据流

### 调试执行流程

```
1. 用户点击"调试"
   ↓
2. 创建执行记录（status=running, opencodeSessionId=xxx）
   ↓
3. 跳转执行详情页（?debug=true）
   ↓
4. 任务初始消息发送，AI 开始回复
   ↓
5. 用户输入新消息
   ↓
6. POST /api/executions/:id/messages
   ↓
7. 使用 opencodeSessionId 继续对话
   ↓
8. 流式返回 AI 回复
   ↓
（步骤 5-8 可重复多次）
   ↓
9. 用户点击"关闭会话"
   ↓
10. POST /api/executions/:id/close
   ↓
11. 删除 OpenCode session，标记执行完成
   ↓
12. 跳转回任务列表
```

## 测试用例

### 1. 调试模式入口测试

**测试步骤**：
1. 进入任务详情页
2. 确认显示"调试"按钮，无"运行"按钮
3. 点击"调试"按钮
4. 确认跳转到执行详情页，URL 包含 `?debug=true`

### 2. 调试模式输入框测试

**测试步骤**：
1. 在调试模式的执行详情页
2. 确认显示输入框和"关闭会话"按钮
3. 输入消息并发送
4. 确认消息出现在对话列表中
5. 确认 AI 开始回复

### 3. 停止回复测试

**测试步骤**：
1. 在调试模式，AI 正在回复时
2. 确认显示"停止"按钮
3. 点击"停止"按钮
4. 确认 AI 回复被中断

### 4. 关闭会话测试

**测试步骤**：
1. 在调试模式，执行进行中
2. 点击"关闭会话"按钮
3. 确认执行状态变为"已完成"
4. 确认跳转回任务列表

### 5. 普通模式测试

**测试步骤**：
1. 在任务列表页点击"运行"按钮
2. 确认跳转到执行详情页，URL 不包含 `?debug=true`
3. 确认不显示输入框
4. 确认显示"终止任务"按钮

## 风险与考虑

1. **Session 管理**：调试模式下 OpenCode session 长时间保持，需要注意资源释放
2. **并发控制**：同一执行同时只能有一个消息在处理，需要加锁或队列机制
3. **错误恢复**：如果追加消息失败，需要给用户明确提示
4. **超时处理**：调试会话长时间未关闭，是否需要自动超时关闭

## 后续优化

1. 支持查看历史调试会话
2. 支持调试会话的分享和导出
3. 支持在调试模式下修改任务流程节点参数
