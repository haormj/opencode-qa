# AGENTS.md

OpenCode QA 是基于 npm workspaces 的 monorepo 业务知识问答系统。

## 开发命令

```bash
npm install                    # 安装依赖
npm run dev                    # 同时启动前后端
npm run build                  # 构建生产版本
npm run db:push                # 推送数据库结构（开发环境）

# 单独启动
npm run dev:backend            # 仅后端 (http://localhost:8000)
npm run dev:frontend           # 仅前端 (http://localhost:3000)

# 测试
npm run test                   # 运行所有测试
npm run test:backend           # 仅后端测试
npm run test:frontend          # 仅前端测试
npm run test:coverage          # 运行测试并生成覆盖率报告
```

## 测试规范

**测试框架：** Vitest

**测试原则：** 先写测试，再写功能（TDD）

**测试文件位置：**
- 后端：`packages/backend/tests/`
- 前端：`packages/frontend/tests/`

**测试命名规范：**
- 测试文件：`*.test.ts` 或 `*.test.tsx`
- 测试目录结构应与源码结构对应

**运行测试：**
```bash
npm run test                   # 运行所有测试
npm run test:watch             # 监听模式，文件变化自动重新运行
npm run test:coverage          # 生成覆盖率报告
```

## E2E 端到端测试

**测试方式：** MCP 浏览器自动化 + 提示词驱动

**测试目录：** `e2e/`

**测试场景：**
- `e2e/scenarios/auth.prompt.md` - 用户认证流程（5 个用例）
- `e2e/scenarios/chat.prompt.md` - 对话功能（8 个用例）
- `e2e/scenarios/admin.prompt.md` - 管理后台（12 个用例）

**执行测试：**
```
# 启动服务后，通过提示词执行：
执行 e2e/scenarios/auth.prompt.md 中的 AUTH-002 测试用例

# 或执行整个场景：
执行 e2e/scenarios/auth.prompt.md 所有测试用例
```

**测试原则：**
1. 功能改动前先编写或更新 E2E 测试用例
2. 每个测试用例独立可执行
3. 测试完成后清理数据

**详细文档：**
- 环境配置：`e2e/setup.md`
- 测试数据：`e2e/fixtures/test-data.md`

## 前置条件

**OpenCode 服务器必须先启动：**
```bash
opencode serve --port 4096
```

## 环境配置

```bash
cp packages/backend/.env.dev packages/backend/.env
```

必须配置 `OPENCODE_SERVER_PASSWORD`（OpenCode 服务认证密码）。

## 架构要点

### npm workspaces

根目录 `node_modules` 包含所有依赖，子包 `node_modules` 仅有缓存文件。这是正确设计。

### 后端 ES Modules

本地导入**必须**加 `.js` 后缀：
```typescript
import { prisma } from '../index.js'  // 正确
import { prisma } from '../index'     // 错误
```

### 前端路径别名

`@` 映射到 `packages/frontend/src`：
```typescript
import { Button } from '@/components/ui/button'
```

### Tailwind CSS v4 + Streamdown

Streamdown 使用的动态类名无法被 Tailwind 扫描，需要在 `packages/frontend/src/index.css` 手动添加：
```css
@source inline("-mt-10");
```

或直接定义缺失的 utility classes。

## 常见问题

### 端口占用（Windows）

```powershell
netstat -ano | findstr ":3000 :8000" | findstr "LISTENING"
taskkill /F /PID <PID>
```

### Prisma 数据库 GUI

```bash
cd packages/backend && npx prisma studio
```

## 提交前检查

```bash
# 类型检查
cd packages/backend && npx tsc --noEmit
cd packages/frontend && npx tsc --noEmit

# 构建
npm run build
```

## 项目结构

```
packages/
├── backend/
│   ├── src/
│   │   ├── index.ts          # 入口
│   │   ├── routes/           # API 路由
│   │   └── services/         # 业务逻辑
│   └── prisma/schema.prisma  # 数据模型
└── frontend/
    └── src/
        ├── components/       # 组件（ChatBox 使用 Streamdown）
        ├── pages/            # 页面
        └── services/api.ts   # API 客户端
```
