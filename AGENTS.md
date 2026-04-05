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
```

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
