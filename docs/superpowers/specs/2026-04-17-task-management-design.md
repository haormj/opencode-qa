# 任务管理功能设计文档

## 概述

在管理后台新增任务管理模块，支持通过拖拽式流程图创建任务，任务可设置为定时执行或手动触发。任务执行时将流程图转换为 Markdown 发送给大模型处理，并记录执行日志和结果。

## 功能范围

### 包含功能

1. **新建任务** - 拖拽式流程图编辑器
2. **任务列表** - 查看所有任务，支持编辑、删除、手动执行
3. **执行记录** - 查看任务执行历史、日志、结果

### 不包含功能

- 分支、并行等复杂流程逻辑（后续扩展）
- Cron 表达式支持（仅支持简单定时）

## 数据模型

### 新增表

#### tasks 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | text (PK) | 任务 ID (UUID) |
| name | text (not null) | 任务名称 |
| description | text | 任务描述 |
| flowData | text (JSON) | 流程图数据（节点 + 连接） |
| scheduleType | text | 定时类型：none / interval / daily |
| scheduleConfig | text (JSON) | 定时配置 |
| isActive | boolean (default: true) | 是否启用 |
| createdBy | text (FK → users) | 创建者 ID |
| createdAt | timestamp | 创建时间 |
| updatedAt | timestamp | 更新时间 |

**scheduleConfig 结构：**

```typescript
// interval 类型
{
  value: number;    // 间隔值
  unit: 'minutes' | 'hours';
}

// daily 类型
{
  time: string;     // 执行时间，如 "00:00"
}
```

#### taskExecutions 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | text (PK) | 执行记录 ID (UUID) |
| taskId | text (FK → tasks) | 任务 ID |
| status | text | 状态：pending / running / success / failed |
| startedAt | timestamp | 开始时间 |
| completedAt | timestamp | 完成时间 |
| result | text | 执行结果（Markdown 格式） |
| logs | text | 执行日志 |
| triggerType | text | 触发类型：manual / scheduled |
| triggeredBy | text (FK → users) | 触发者 ID（手动执行时） |
| createdAt | timestamp | 创建时间 |

#### taskExecutionMessages 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | text (PK) | 消息 ID (UUID) |
| executionId | text (FK → taskExecutions) | 执行记录 ID |
| role | text | 角色：user / assistant |
| content | text | 消息内容 |
| createdAt | timestamp | 创建时间 |

### 索引

- `task_executions_task_id_idx` - taskExecutions.taskId
- `task_execution_messages_execution_id_idx` - taskExecutionMessages.executionId

## 流程图数据结构

### FlowData 类型

```typescript
interface FlowData {
  nodes: Node[];
  edges: Edge[];
}

interface Node {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
}

interface Edge {
  id: string;
  source: string;
  target: string;
}
```

### 节点类型

#### 1. 技能安装节点 (skillInstall)

从技能市场选择已审核的技能进行安装。

```typescript
interface SkillInstallNodeData {
  skillId: string;      // 技能 ID（关联 skills 表）
  skillName: string;    // 技能名称（用于显示）
  skillSlug: string;    // 技能标识
}
```

#### 2. 代码下载节点 (codeDownload)

从 Git 仓库下载代码。

```typescript
interface CodeDownloadNodeData {
  repoUrl: string;      // 仓库地址
  username: string;     // 用户名
  password: string;     // 密码（加密存储）
  branch: string;       // 分支名称
  targetPath: string;   // 目标路径
}
```

#### 3. 步骤定义节点 (step)

定义具体的执行步骤指令。

```typescript
interface StepNodeData {
  name: string;         // 步骤名称
  instruction: string;  // 执行指令（Markdown 格式）
}
```

#### 4. 输出配置节点 (output)

配置任务结果的输出方式。

```typescript
interface OutputNodeData {
  type: 'email' | 'file' | 'webhook';
  config: EmailConfig | FileConfig | WebhookConfig;
}

interface EmailConfig {
  to: string;           // 收件人邮箱
  subject: string;      // 邮件主题
}

interface FileConfig {
  path: string;         // 文件路径
  format: 'txt' | 'markdown' | 'json';
}

interface WebhookConfig {
  url: string;          // Webhook URL
  method: 'GET' | 'POST';
  headers: Record<string, string>;
}
```

## 流程图转 Markdown

执行任务时，将流程图 JSON 转换为 Markdown 格式发送给大模型。

### 转换规则

1. 按节点连接顺序（从左到右）依次处理
2. 每个节点生成对应的 Markdown 片段
3. 组合成完整的任务描述

### 示例输出

```markdown
# 任务：代码审查助手

## 技能安装

请安装以下技能：
- 技能名称：代码审查
- 技能标识：code-review

## 代码下载

请从以下仓库下载代码：
- 仓库地址：https://github.com/example/repo
- 分支：main
- 目标路径：/tmp/repo

## 步骤 1：分析代码

请分析下载的代码，重点关注：
- 代码质量
- 潜在问题
- 改进建议

## 输出配置

请将结果通过邮件发送至：admin@example.com
```

## 前端架构

### 文件结构

```
packages/frontend/src/
├── pages/admin/
│   ├── Tasks.tsx              # 任务列表页
│   ├── TaskCreate.tsx         # 新建任务页
│   ├── TaskEdit.tsx           # 编辑任务页
│   ├── TaskDetail.tsx         # 任务详情页
│   └── TaskExecutions.tsx     # 执行记录列表页
│
├── components/TaskFlow/
│   ├── Editor.tsx             # 流程图编辑器主组件
│   ├── Sidebar.tsx            # 左侧节点拖拽面板
│   ├── Toolbar.tsx            # 工具栏
│   ├── FlowToMarkdown.ts      # 流程图转 Markdown 工具
│   └── nodes/
│       ├── SkillInstallNode.tsx
│       ├── CodeDownloadNode.tsx
│       ├── StepNode.tsx
│       └── OutputNode.tsx
│
├── components/TaskSchedule/
│   └── ScheduleForm.tsx       # 定时配置表单
│
└── services/api.ts            # 新增任务相关 API 调用
```

### 路由配置

```typescript
// 新增路由
<Route path="tasks" element={<Tasks />} />
<Route path="tasks/create" element={<TaskCreate />} />
<Route path="tasks/:id" element={<TaskDetail />} />
<Route path="tasks/:id/edit" element={<TaskEdit />} />
<Route path="tasks/:id/executions" element={<TaskExecutions />} />
```

### 依赖新增

```json
{
  "dependencies": {
    "@xyflow/react": "^12.0.0"
  }
}
```

## 后端架构

### 文件结构

```
packages/backend/src/
├── routes/
│   └── admin-task.ts          # 任务管理 API 路由
│
├── services/
│   ├── task.ts                # 任务业务逻辑
│   ├── task-executor.ts       # 任务执行引擎
│   └── task-scheduler.ts      # 定时任务调度
│
└── db/
    └── schema.ts              # 新增任务相关表定义
```

### API 设计

#### 任务管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/tasks | 获取任务列表（分页） |
| POST | /api/admin/tasks | 创建任务 |
| GET | /api/admin/tasks/:id | 获取任务详情 |
| PUT | /api/admin/tasks/:id | 更新任务 |
| DELETE | /api/admin/tasks/:id | 删除任务 |
| POST | /api/admin/tasks/:id/execute | 手动执行任务 |
| PATCH | /api/admin/tasks/:id/toggle | 启用/禁用任务 |

#### 执行记录

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/tasks/:id/executions | 获取执行记录列表 |
| GET | /api/admin/executions/:id | 获取执行记录详情 |
| GET | /api/admin/executions/:id/messages | 获取执行对话记录 |

### 执行引擎

```typescript
// task-executor.ts
class TaskExecutor {
  async execute(taskId: string, triggerType: 'manual' | 'scheduled', userId?: string) {
    // 1. 创建执行记录
    const execution = await this.createExecution(taskId, triggerType, userId);
    
    // 2. 加载任务流程数据
    const task = await this.loadTask(taskId);
    
    // 3. 转换流程图为 Markdown
    const markdown = FlowToMarkdown.convert(task.flowData);
    
    // 4. 调用 OpenCode API
    const result = await this.callOpenCode(markdown, execution.id);
    
    // 5. 处理输出配置
    await this.handleOutput(task.flowData, result);
    
    // 6. 更新执行记录
    await this.updateExecution(execution.id, result);
  }
}
```

### 定时调度

复用现有 `node-schedule` 库，在 `scheduler.ts` 中新增任务调度逻辑。

```typescript
// task-scheduler.ts
class TaskScheduler {
  private jobs: Map<string, Job> = new Map();
  
  // 应用启动时加载所有活跃的定时任务
  async init() {
    const tasks = await db.select().from(tasks).where(eq(tasks.isActive, true));
    for (const task of tasks) {
      if (task.scheduleType !== 'none') {
        this.registerTask(task);
      }
    }
  }
  
  // 注册定时任务
  registerTask(task: Task) {
    const job = schedule.scheduleJob(this.getCronExpression(task), async () => {
      await taskExecutor.execute(task.id, 'scheduled');
    });
    this.jobs.set(task.id, job);
  }
  
  // 取消定时任务
  cancelTask(taskId: string) {
    const job = this.jobs.get(taskId);
    if (job) {
      job.cancel();
      this.jobs.delete(taskId);
    }
  }
  
  // 清理 30 天前的执行记录
  async cleanupOldExecutions() {
    const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await db.delete(taskExecutions).where(lt(taskExecutions.createdAt, threshold));
  }
}
```

## 执行流程

```
┌─────────────┐
│  触发执行   │ ← 手动触发 / 定时触发
└──────┬──────┘
       ↓
┌─────────────┐
│ 创建执行记录 │ → status: pending
└──────┬──────┘
       ↓
┌─────────────┐
│ 解析流程图  │ → JSON 转换为 Markdown
└──────┬──────┘
       ↓
┌─────────────┐
│ 调用 OpenCode│ → 发送 Markdown 给大模型
└──────┬──────┘
       ↓
┌─────────────┐
│ 流式接收响应 │ → 记录消息到 taskExecutionMessages
└──────┬──────┘
       ↓
┌─────────────┐
│ 处理输出    │ → 邮件 / 文件 / Webhook
└──────┬──────┘
       ↓
┌─────────────┐
│ 更新执行记录 │ → status: success / failed
└─────────────┘
```

## 安全考虑

### 敏感数据处理

- Git 仓库密码：加密存储，执行时解密
- Webhook 密钥：加密存储
- 邮箱配置：可选加密

### 权限控制

- 所有任务管理 API 需要 admin 权限
- 执行记录查看需要 admin 权限

## 测试策略

### 单元测试

- FlowToMarkdown 转换逻辑
- TaskScheduler 定时逻辑
- TaskExecutor 执行流程

### 集成测试

- API 端点测试
- 数据库操作测试

### E2E 测试

- 创建任务流程
- 执行任务流程
- 查看执行记录

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 流程图编辑器学习成本 | 用户上手困难 | 提供默认模板和引导 |
| 任务执行时间过长 | 用户等待 | 异步执行 + 进度通知 |
| 执行记录数据量大 | 存储压力 | 30 天自动清理 |

## 后续扩展

1. **分支和并行流程** - 支持条件分支、并行执行
2. **Cron 表达式** - 支持更灵活的定时配置
3. **任务模板** - 预定义常用任务模板
4. **执行监控** - 实时查看执行进度
5. **任务依赖** - 任务间依赖关系
