# 任务执行终止功能设计

## 背景

当前任务管理系统支持任务的执行，但缺少终止运行中任务的能力。当任务执行时间过长或用户需要中止时，无法主动停止正在执行的任务。

## 目标

1. 支持终止正在执行的任务
2. 停止当前 OpenCode 会话
3. 删除对应的 OpenCode session
4. 记录终止操作者和时间

## 数据库设计

### taskExecutions 表变更

新增字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| opencodeSessionId | text | OpenCode 会话 ID，用于终止时调用 abort/delete |
| cancelledBy | text | 终止操作者 ID，外键关联 users 表 |

### 状态枚举扩展

当前状态：`pending`, `running`, `completed`, `failed`

新增状态：`cancelled`

## API 设计

### 终止任务执行

**接口：** `POST /api/admin/tasks/executions/:id/cancel`

**权限：** 需要管理员权限

**请求参数：** 无

**响应：**
```json
{
  "id": "execution-id",
  "status": "cancelled",
  "cancelledBy": "user-id",
  "completedAt": "2025-04-19T10:00:00Z"
}
```

**错误响应：**
- 404: 执行记录不存在
- 400: 执行状态不是 running，无法终止
- 500: 服务器内部错误

**处理流程：**
1. 验证执行记录存在
2. 验证状态为 `running`
3. 获取 `opencodeSessionId`
4. 调用 `abortOpenCodeSession()` 停止执行
5. 调用 `deleteOpenCodeSession()` 删除会话
6. 更新数据库状态为 `cancelled`
7. 通过 SSE 通知前端状态变更

## 前端设计

### 执行记录列表页 (TaskExecutionsGlobal.tsx)

**变更内容：**
- 操作列新增终止按钮
- 仅在 status=running 时显示
- 图标使用 `StopOutlined`
- 点击弹出确认框："确认终止该任务执行？"
- 成功后刷新列表

### 执行详情页 (TaskExecutionDetail.tsx)

**变更内容：**
- 头部区域新增终止按钮
- 仅在 status=running 时显示
- 与状态标签相邻放置
- 点击弹出确认框
- 成功后更新页面状态显示

## 需要修改的文件

| 文件路径 | 变更内容 |
|----------|----------|
| `packages/backend/src/db/schema.ts` | 新增 opencodeSessionId, cancelledBy 字段 |
| `packages/backend/drizzle/xxxx_add_cancel_fields.sql` | 数据库迁移文件（自动生成） |
| `packages/backend/src/services/task-executor.ts` | 执行时保存 opencodeSessionId |
| `packages/backend/src/routes/admin-task.ts` | 新增 POST /executions/:id/cancel 接口 |
| `packages/backend/src/services/execution-event-manager.ts` | 新增 cancelled 状态事件支持 |
| `packages/frontend/src/services/api.ts` | 新增 cancelExecution 函数 |
| `packages/frontend/src/pages/admin/TaskExecutionsGlobal.tsx` | 添加终止按钮 |
| `packages/frontend/src/pages/admin/TaskExecutionDetail.tsx` | 添加终止按钮 |

## 错误处理

1. **OpenCode API 调用失败**：记录日志，但仍然更新数据库状态为 cancelled（避免阻塞）
2. **数据库更新失败**：返回 500 错误，OpenCode session 可能已被清理
3. **执行记录不存在**：返回 404 错误
4. **状态不是 running**：返回 400 错误，提示用户当前状态无法终止

## 测试场景

1. 终止 running 状态的任务执行
2. 尝试终止非 running 状态的任务（应失败）
3. 终止不存在的执行记录（应返回 404）
4. 验证 SSE 状态推送正常工作
5. 验证终止按钮仅在 running 状态显示
