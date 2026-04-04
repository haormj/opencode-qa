# AGENTS.md

本文档为在此仓库中工作的智能编程代理提供指导。

## 项目概述

OpenCode QA 是一个基于 npm workspaces 的 monorepo 业务知识问答系统。

- **前端**: React + Vite + TypeScript + Ant Design (`packages/frontend`)
- **后端**: Express + TypeScript + Prisma (`packages/backend`)
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **SDK**: @opencode-ai/sdk

## 构建/Lint/测试命令

### 根目录命令

```bash
npm install                    # 安装所有依赖
npm run dev                    # 同时启动前后端开发服务器
npm run dev:backend            # 仅启动后端
npm run dev:frontend           # 仅启动前端
npm run build                  # 构建生产版本
npm run start                  # 启动生产环境后端服务器
npm run db:generate            # 生成 Prisma 客户端
npm run db:push                # 推送数据库结构变更（开发环境）
npm run db:migrate             # 创建并应用数据库迁移
```

### 后端命令 (packages/backend)

```bash
npm run dev                    # 启动开发服务器（tsx watch 热重载）
npm run build                  # 编译 TypeScript 到 dist/
npm run start                  # 运行编译后的服务器
npx tsc --noEmit              # 类型检查（不输出文件）
npx prisma studio             # 打开 Prisma 数据库 GUI
```

### 前端命令 (packages/frontend)

```bash
npm run dev                    # 启动 Vite 开发服务器（端口 3000）
npm run build                  # 类型检查并构建生产版本
npm run preview                # 预览生产构建
npx tsc --noEmit              # 类型检查（不输出文件）
```

### 测试

当前项目未配置测试框架。添加测试时：
- 测试文件放在源文件旁边，使用 `.test.ts` 或 `.spec.ts` 后缀
- 前端推荐使用 Vitest，后端推荐使用 Jest
- 运行单个测试：`npx vitest run path/to/test.test.ts` 或 `npx jest path/to/test.test.ts`

## 代码风格指南

### 导入规范

**后端：**
- 使用 ES modules，本地导入必须加 `.js` 后缀
- 导入顺序：外部包 → 内部模块
```typescript
import { Router } from 'express'
import { prisma } from '../index.js'
import { askQuestion } from '../services/opencode.js'
```

**前端：**
- 使用 ES modules，不加后缀
- 先导入 React hooks 和组件
```typescript
import { useState, useEffect } from 'react'
import { Card, Button } from 'antd'
import { getUser } from '../services/api'
```

### TypeScript 配置

- 两个包都启用了严格模式
- 后端目标：ES2022，模块：NodeNext
- 前端目标：ES2022，模块：ESNext
- 函数必须显式定义返回类型
- 对象类型使用 interface，不使用 type 别名

### 命名规范

- **文件**: camelCase（如 `chat.ts`、`opencode.ts`）
- **组件**: PascalCase（如 `ChatBox`、`FeedbackModal`）
- **函数**: camelCase（如 `askQuestion`、`handleSubmit`）
- **接口**: PascalCase（如 `QuestionResponse`、`HistoryItem`）
- **常量**: SCREAMING_SNAKE_CASE（如 `OPENCODE_URL`）
- **数据库模型**: PascalCase（如 `Question`、`Feedback`）
- **数据库字段**: camelCase，通过 `@map` 映射为 snake_case

### 错误处理

**后端路由：**
- 路由处理器必须用 try/catch 包装
- 返回适当的 HTTP 状态码
- 带上下文记录错误日志
```typescript
router.post('/', async (req, res) => {
  try {
    // ... 业务逻辑
    res.json(data)
  } catch (error) {
    console.error('操作错误:', error)
    res.status(500).json({ error: '服务器内部错误' })
  }
})
```

**前端：**
- 异步事件处理器中使用 try/catch
- 通过 `message.error()` 显示用户友好的错误信息
- 使用 finally 块进行清理（如 setLoading(false)）

### React 组件

- 使用函数组件和 hooks
- 为 props 定义接口
- 组件默认导出
```typescript
interface ChatBoxProps {
  messages: Message[]
  loading: boolean
  onFeedback: (id: number) => void
}

function ChatBox({ messages, loading, onFeedback }: ChatBoxProps) {
  // ...
}

export default ChatBox
```

### Express 路由

- 使用 Router 实例组织路由组
- 默认导出 router
- 处理前验证请求体/参数
```typescript
import { Router } from 'express'
const router = Router()

router.post('/', async (req, res) => { /* ... */ })

export default router
```

### Prisma 使用

- 从 `../index.js` 导入共享的 PrismaClient
- 关联查询使用 `include`
- 相关操作使用事务
- snake_case 列名使用 `@map` 装饰器

### API 响应格式

**成功：**
```typescript
res.json({ id, sessionId, question, answer })
```

**分页：**
```typescript
res.json({ total, page, pageSize, items })
```

**错误：**
```typescript
res.status(400).json({ error: '问题不能为空' })
```

### 注释

- 生产代码中不添加注释
- 可接受 TODO 注释标记待办事项
- 使用清晰的命名实现自文档化代码

## 环境变量

后端需要（见 `packages/backend/.env.example`）：
- `PORT` - 服务器端口（默认：8000）
- `DATABASE_URL` - 数据库连接字符串
- `OPENCODE_HOST` - OpenCode 服务器主机
- `OPENCODE_PORT` - OpenCode 服务器端口
- `OPENCODE_PROVIDER` - AI 提供商（默认：baiduqianfancodingplan）
- `OPENCODE_MODEL` - AI 模型（默认：glm-5）
- `OPENCODE_AGENT` - 使用的 agent（默认：explore，只读模式）

## 文件结构

```
packages/
├── backend/
│   ├── src/
│   │   ├── index.ts          # 应用入口，Express 配置
│   │   ├── routes/           # API 路由处理器
│   │   ├── services/         # 业务逻辑
│   │   └── middleware/       # Express 中间件
│   └── prisma/
│       └── schema.prisma     # 数据库模型
└── frontend/
    └── src/
        ├── main.tsx          # React 入口
        ├── App.tsx           # 根组件，路由配置
        ├── pages/            # 页面组件
        ├── components/       # 可复用组件
        ├── services/         # API 客户端函数
        └── hooks/            # 自定义 React hooks
```

## 开发流程

1. 启动 OpenCode 服务器：`opencode serve --port 4096`
2. 初始化数据库：`npm run db:push`
3. 启动开发服务器：`npm run dev`
4. 前端访问：http://localhost:3000
5. 后端访问：http://localhost:8000

## 修改后验证

每次代码修改完成后，自动连接 Chrome 进行测试验证：
1. 确保前后端服务正常运行
2. 打开或刷新页面 http://localhost:3000
3. 检查控制台是否有错误
4. 根据修改内容进行功能测试

### 基础测试用例

**会话管理测试：**
1. 新建会话 - 点击"新建会话"按钮，URL 应变为 `/`，消息列表清空
2. 发送消息 - 输入问题并发送，显示"正在思考中"，然后显示回复
3. 多轮对话 - 在同一会话中发送第二条消息，验证上下文保持
4. 会话列表 - 侧边栏显示所有会话，按更新时间倒序排列
5. 切换会话 - 点击侧边栏会话项，URL 更新，消息列表切换到对应会话
6. 删除会话 - 悬停会话项点击删除，确认后从列表移除
7. 修改标题 - 悬停会话项点击编辑，修改标题后保存

**界面交互测试：**
1. 侧边栏折叠 - 点击折叠按钮，侧边栏收起，只显示展开按钮
2. 侧边栏展开 - 点击展开按钮，侧边栏展开，显示完整会话列表
3. 页面刷新 - 刷新页面后，当前会话保持，消息列表正确加载
4. URL 参数 - 会话 ID 通过 URL 参数传递，分享链接可直接打开对应会话

**错误检查：**
1. 控制台无 JavaScript 错误
2. 网络请求状态正常（200 或预期的错误码）
3. 用户友好的错误提示（如"提问失败，请稍后重试"）

## 提交前检查

**重要：代码提交前必须经过用户确认，不得自动提交。**

1. 运行 TypeScript 类型检查：`npx tsc --noEmit`（在每个包内）
2. 确保构建成功：`npm run build`
3. 在开发模式下手动测试
