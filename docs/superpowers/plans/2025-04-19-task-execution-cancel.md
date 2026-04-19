# 任务执行终止功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现任务执行终止功能，支持停止正在运行的任务并删除对应的 OpenCode session

**Architecture:** 后端新增 cancel API，数据库新增字段，前端列表页和详情页添加终止按钮

**Tech Stack:** TypeScript, Drizzle ORM, React, Ant Design, SSE

---

## Task 1: 数据库 Schema 变更

**Files:**
- Modify: `packages/backend/src/db/schema.ts`
- Create: `packages/backend/drizzle/0006_add_cancel_fields.sql` (自动生成)

- [ ] **Step 1: 修改 schema.ts，新增字段**

在 `taskExecutions` 表定义中新增两个字段：

```typescript
// 在 taskExecutions 表定义中，createdAt 字段之前添加：
opencodeSessionId: text('opencode_session_id'),
cancelledBy: text('cancelled_by').references(() => users.id, { onDelete: 'set null' }),
```

- [ ] **Step 2: 生成迁移文件**

```bash
cd packages/backend
npm run db:generate
```

Expected: 生成新的迁移文件，包含 ALTER TABLE 语句

- [ ] **Step 3: 验证迁移文件内容**

检查生成的 SQL 文件，确保包含：
- `ALTER TABLE task_executions ADD COLUMN opencode_session_id text;`
- `ALTER TABLE task_executions ADD COLUMN cancelled_by text REFERENCES users(id);`

---

## Task 2: 修改 task-executor 保存 OpenCode Session ID

**Files:**
- Modify: `packages/backend/src/services/task-executor.ts`

- [ ] **Step 1: 修改 executeTaskStream 函数，保存 opencodeSessionId**

在 `executeTaskStream` 函数中，找到创建 session 后的位置（约第 418 行），将 sessionId 保存到数据库：

```typescript
// 在 onSessionId(sessionId) 调用后添加
await db.update(taskExecutions)
  .set({ opencodeSessionId: sessionId })
  .where(eq(taskExecutions.id, executionId))
```

完整的修改位置：

```typescript
const sessionId = sessionResult.data.id
onSessionId(sessionId)
logger.info('[OpenCode] Isolated session created:', sessionId)

// 新增：保存 opencodeSessionId
await db.update(taskExecutions)
  .set({ opencodeSessionId: sessionId })
  .where(eq(taskExecutions.id, executionId))
```

- [ ] **Step 2: 验证类型检查**

```bash
cd packages/backend
npx tsc --noEmit
```

Expected: 无类型错误

---

## Task 3: 新增 cancel API 接口

**Files:**
- Modify: `packages/backend/src/routes/admin-task.ts`
- Modify: `packages/backend/src/services/task-executor.ts`

- [ ] **Step 1: 在 task-executor.ts 新增 cancelExecution 函数**

在文件末尾添加：

```typescript
export async function cancelExecution(
  executionId: string,
  cancelledBy: string,
  botConfig: BotConfig
): Promise<{ success: boolean; error?: string }> {
  const execution = await db.select().from(taskExecutions).where(eq(taskExecutions.id, executionId)).get()
  
  if (!execution) {
    return { success: false, error: '执行记录不存在' }
  }
  
  if (execution.status !== 'running') {
    return { success: false, error: '只有运行中的任务可以终止' }
  }
  
  if (execution.opencodeSessionId) {
    try {
      await abortOpenCodeSession(botConfig.apiUrl, execution.opencodeSessionId)
      await deleteOpenCodeSession(botConfig.apiUrl, execution.opencodeSessionId)
    } catch (error) {
      logger.error('[TaskExecutor] Failed to abort/delete OpenCode session:', error)
    }
  }
  
  await db.update(taskExecutions)
    .set({
      status: 'cancelled',
      cancelledBy,
      completedAt: new Date()
    })
    .where(eq(taskExecutions.id, executionId))
  
  executionEventManager.emitStatus(executionId, 'cancelled')
  
  return { success: true }
}
```

同时需要在文件顶部添加导入：

```typescript
import { abortOpenCodeSession, deleteOpenCodeSession } from './opencode.js'
```

- [ ] **Step 2: 在 admin-task.ts 新增 cancel 路由**

在 `router.get('/executions/:id/messages', ...)` 之后添加：

```typescript
router.post('/executions/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.id
    
    const execution = await getExecutionById(id)
    if (!execution) {
      return res.status(404).json({ error: '执行记录不存在' })
    }
    
    if (execution.status !== 'running') {
      return res.status(400).json({ error: '只有运行中的任务可以终止' })
    }
    
    const task = await getTaskById(execution.taskId)
    if (!task || !task.botId) {
      return res.status(400).json({ error: '任务配置异常' })
    }
    
    const bot = await db.select().from(bots).where(eq(bots.id, task.botId)).get()
    if (!bot) {
      return res.status(400).json({ error: '机器人配置不存在' })
    }
    
    const botConfig = {
      apiUrl: bot.apiUrl,
      provider: bot.provider,
      model: bot.model,
      agent: bot.agent,
      apiKey: bot.apiKey ?? undefined
    }
    
    const result = await cancelExecution(id, userId, botConfig)
    
    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }
    
    res.json({ success: true, id, status: 'cancelled' })
  } catch (error) {
    logger.error('Cancel execution error:', error)
    res.status(500).json({ error: '服务器内部错误' })
  }
})
```

需要在文件顶部添加导入：

```typescript
import { cancelExecution } from '../services/task-executor.js'
```

- [ ] **Step 3: 验证类型检查**

```bash
cd packages/backend
npx tsc --noEmit
```

Expected: 无类型错误

---

## Task 4: 前端 API 新增 cancelExecution

**Files:**
- Modify: `packages/frontend/src/services/api.ts`

- [ ] **Step 1: 更新 TaskExecution 类型，添加 cancelled 状态**

修改 `TaskExecution` 接口：

```typescript
export interface TaskExecution {
  id: string
  taskId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  triggerType: 'manual' | 'schedule' | 'webhook'
  triggeredBy: string | null
  triggeredByUser: {
    id: string
    username: string
    displayName: string
  } | null
  startedAt?: string | null
  completedAt?: string | null
  createdAt: string
}
```

- [ ] **Step 2: 新增 cancelExecution 函数**

在文件末尾添加：

```typescript
export async function cancelExecution(id: string): Promise<{ success: boolean; id: string; status: string }> {
  return request(`${API_BASE}/admin/tasks/executions/${id}/cancel`, {
    method: 'POST',
  })
}
```

- [ ] **Step 3: 验证类型检查**

```bash
cd packages/frontend
npx tsc --noEmit
```

Expected: 无类型错误

---

## Task 5: 前端 - 执行记录列表页添加终止按钮

**Files:**
- Modify: `packages/frontend/src/pages/admin/TaskExecutionsGlobal.tsx`

- [ ] **Step 1: 添加终止状态配置**

在 `statusColors` 和 `statusLabels` 中添加 cancelled：

```typescript
const statusColors: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'success',
  failed: 'error',
  cancelled: 'warning'
}

const statusLabels: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已终止'
}
```

- [ ] **Step 2: 导入需要的组件和 API**

修改导入语句：

```typescript
import { Table, Card, Tag, Space, message, Typography, Select, Button, Popconfirm } from 'antd'
import { ReloadOutlined, EyeOutlined, StopOutlined } from '@ant-design/icons'
import { getAllExecutions, getTasks, cancelExecution, type TaskExecution, type Task } from '../../services/api'
```

- [ ] **Step 3: 添加终止处理函数**

在 `handleViewDetail` 函数后添加：

```typescript
const handleCancel = async (executionId: string) => {
  try {
    await cancelExecution(executionId)
    message.success('任务已终止')
    fetchExecutions()
  } catch (error) {
    message.error('终止任务失败')
  }
}
```

- [ ] **Step 4: 修改操作列，添加终止按钮**

修改 columns 中的操作列：

```typescript
{
  title: '操作',
  key: 'action',
  width: 100,
  render: (_, record) => (
    <Space size="small">
      <Button
        type="text"
        icon={<EyeOutlined />}
        onClick={() => handleViewDetail(record.id)}
      />
      {record.status === 'running' && (
        <Popconfirm
          title="确认终止该任务执行？"
          onConfirm={() => handleCancel(record.id)}
          okText="确认"
          cancelText="取消"
        >
          <Button
            type="text"
            danger
            icon={<StopOutlined />}
          />
        </Popconfirm>
      )}
    </Space>
  )
}
```

---

## Task 6: 前端 - 执行详情页添加终止按钮

**Files:**
- Modify: `packages/frontend/src/pages/admin/TaskExecutionDetail.tsx`

- [ ] **Step 1: 更新 statusConfig 添加 cancelled**

```typescript
const statusConfig: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
  pending: { color: 'default', icon: <ClockCircleOutlined />, text: '等待中' },
  running: { color: 'processing', icon: <SyncOutlined spin />, text: '执行中' },
  completed: { color: 'success', icon: <CheckCircleOutlined />, text: '已完成' },
  failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
  cancelled: { color: 'warning', icon: <StopOutlined />, text: '已终止' }
}
```

- [ ] **Step 2: 导入所需组件和 API**

修改导入：

```typescript
import { Tag, Button, Spin, Typography, Avatar, Empty, Popconfirm, message } from 'antd'
import { ArrowLeftOutlined, RobotOutlined, UserOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, StopOutlined } from '@ant-design/icons'
import type { TaskExecution, ExecutionMessage } from '../../services/api'
import { cancelExecution } from '../../services/api'
```

- [ ] **Step 3: 添加终止处理函数**

在组件内添加：

```typescript
const handleCancel = async () => {
  if (!id) return
  try {
    await cancelExecution(id)
    message.success('任务已终止')
    setExecution(prev => prev ? { ...prev, status: 'cancelled' } : null)
  } catch (error) {
    message.error('终止任务失败')
  }
}
```

- [ ] **Step 4: 在头部添加终止按钮**

修改 `execution-header` 部分：

```tsx
<div className="execution-header">
  <div className="execution-header-left">
    <Button
      type="text"
      icon={<ArrowLeftOutlined />}
      onClick={() => navigate(-1)}
    />
    <div className="execution-info">
      <Typography.Title level={4} className="execution-title">
        执行详情
      </Typography.Title>
      <div className="execution-meta">
        <Tag color={statusInfo.color} icon={statusInfo.icon}>
          {statusInfo.text}
        </Tag>
        <span className="execution-duration">
          耗时: {formatDuration(execution.startedAt, execution.completedAt)}
        </span>
        {execution.startedAt && (
          <span className="execution-time">
            开始: {new Date(execution.startedAt).toLocaleString()}
          </span>
        )}
        {triggerInfo && (
          <span className="execution-trigger">
            {triggerInfo}
          </span>
        )}
      </div>
    </div>
  </div>
  {execution.status === 'running' && (
    <Popconfirm
      title="确认终止该任务执行？"
      onConfirm={handleCancel}
      okText="确认"
      cancelText="取消"
    >
      <Button
        type="primary"
        danger
        icon={<StopOutlined />}
      >
        终止任务
      </Button>
    </Popconfirm>
  )}
</div>
```

---

## Task 7: 提交代码

- [ ] **Step 1: 验证后端类型检查**

```bash
cd packages/backend && npx tsc --noEmit
```

- [ ] **Step 2: 验证前端类型检查**

```bash
cd packages/frontend && npx tsc --noEmit
```

- [ ] **Step 3: 提交变更**

```bash
git add packages/backend/src/db/schema.ts \
  packages/backend/drizzle/ \
  packages/backend/src/services/task-executor.ts \
  packages/backend/src/routes/admin-task.ts \
  packages/frontend/src/services/api.ts \
  packages/frontend/src/pages/admin/TaskExecutionsGlobal.tsx \
  packages/frontend/src/pages/admin/TaskExecutionDetail.tsx

git commit -m "feat: add task execution cancel feature"
```

---

## 验证清单

- [ ] 终止按钮仅在 running 状态显示
- [ ] 点击终止后确认弹窗正常弹出
- [ ] 确认终止后状态变为 cancelled
- [ ] SSE 正常推送状态变更
- [ ] OpenCode session 被正确清理
