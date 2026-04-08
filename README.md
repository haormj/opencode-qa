# OpenCode QA

基于 OpenCode 的业务知识问答系统，支持 AI 流式响应、SSO 单点登录、管理后台等功能。

## 功能特性

- 💬 **智能问答** - 基于 OpenCode AI 能力，支持流式响应
- 📝 **Markdown 渲染** - 支持代码高亮、Mermaid 图表、数学公式、表格等
- 🗂️ **会话管理** - 多会话支持，历史记录持久化
- 🔐 **SSO 认证** - 支持飞书等企业级单点登录
- 🛡️ **管理后台** - Bot 管理、SSO 配置、系统监控
- 📢 **人工接入** - 支持 Mark 人工处理标记

## 技术栈

| 类型 | 技术 |
|------|------|
| **前端** | React 18 + Vite + TypeScript + Ant Design + Tailwind CSS v4 |
| **后端** | Express + TypeScript + Drizzle ORM + Winston Logger |
| **Markdown** | Streamdown (Shiki + Mermaid + KaTeX) |
| **数据库** | SQLite (开发) / PostgreSQL (生产) |
| **SDK** | @opencode-ai/sdk |

## 快速开始

### 前置要求

- Node.js >= 18
- npm >= 9
- OpenCode CLI 已安装并配置

### 安装与启动

```bash
# 1. 克隆项目
git clone https://github.com/haormj/opencode-qa.git
cd opencode-qa

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp packages/backend/.env.dev packages/backend/.env
# 编辑 .env 文件，配置必要参数

# 4. 初始化数据库
npm run db:push

# 5. 启动 OpenCode Server（另开终端）
opencode serve --port 4096

# 6. 启动开发服务器
npm run dev
```

访问地址：
- 前端：http://localhost:3000
- 后端：http://localhost:8000
- 管理后台：http://localhost:3000/admin

### 默认管理员账号

- 用户名：`admin`
- 密码：`admin123`

## 环境变量

### 后端配置 (`packages/backend/.env`)

```env
# 服务配置
PORT=8000
DATABASE_URL="file:./data.db"          # 生产环境使用 PostgreSQL 连接串

# JWT 认证
JWT_SECRET=your-jwt-secret-key          # 生产环境必须修改

# 管理员配置
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123                  # 生产环境必须修改
ADMIN_EMAIL=admin@opencode-qa.local

# OpenCode 服务器
OPENCODE_SERVER_USERNAME=opencode
OPENCODE_SERVER_PASSWORD=your-password  # OpenCode 服务认证密码

# 日志配置
LOG_LEVEL=info
LOG_ENABLE_CONSOLE=true
LOG_ENABLE_FILE=true
LOG_MAX_FILE_SIZE=10m
LOG_RETENTION_DAYS=7d
```

## 项目结构

```
opencode-qa/
├── packages/
│   ├── frontend/                    # React 前端
│   │   ├── src/
│   │   │   ├── components/          # 可复用组件
│   │   │   │   ├── ChatBox/         # 聊天组件（Streamdown 渲染）
│   │   │   │   ├── ai-elements/     # AI Elements 组件
│   │   │   │   └── ui/              # shadcn/ui 组件
│   │   │   ├── pages/               # 页面组件
│   │   │   │   ├── Home.tsx         # 用户聊天页面
│   │   │   │   ├── Login.tsx        # 登录页面
│   │   │   │   ├── admin/           # 管理后台页面
│   │   │   │   └── SsoCallback.tsx  # SSO 回调页面
│   │   │   ├── services/            # API 客户端
│   │   │   └── hooks/               # 自定义 Hooks
│   │   └── package.json
│   │
│   └── backend/                     # Express 后端
│       ├── src/
│       │   ├── index.ts             # 应用入口
│       │   ├── routes/              # API 路由
│       │   │   ├── message.ts       # 消息流式接口
│       │   │   ├── session.ts       # 会话管理
│       │   │   ├── auth.ts          # 认证接口
│       │   │   ├── auth-sso.ts      # SSO 认证
│       │   │   ├── admin.ts         # 管理接口
│       │   │   ├── admin-sso.ts     # SSO 配置管理
│       │   │   └── bot.ts           # Bot 管理
│       │   ├── services/            # 业务逻辑
│       │   │   ├── opencode.ts      # OpenCode 集成
│       │   │   ├── sso.ts           # SSO 处理
│       │   │   ├── logger.ts        # 日志服务
│       │   │   └── event-subscription-manager.ts
│       │   └── middleware/          # 中间件
│       ├── data/                    # 数据库文件
│       │   └── data.db              # SQLite 数据库
│       └── src/db/                  # 数据库模块
│           ├── schema.ts            # 数据模型
│           └── seed.ts              # 种子数据
│
├── AGENTS.md                        # AI Agent 开发指南
└── package.json                     # 根目录配置
```

## API 接口

### 用户端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/messages/stream` | 发送问题（SSE 流式响应） |
| GET | `/api/sessions/:id` | 获取会话详情 |
| GET | `/api/sessions` | 获取会话列表 |
| PUT | `/api/sessions/:id/title` | 更新会话标题 |
| DELETE | `/api/sessions/:id` | 删除会话 |
| PUT | `/api/sessions/:id/status` | 更新会话状态（标记人工） |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/logout` | 用户登出 |
| GET | `/api/auth/me` | 获取当前用户 |

### 管理端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/login` | 管理员登录 |
| GET | `/api/admin/bots` | 获取 Bot 列表 |
| POST | `/api/admin/bots` | 创建 Bot |
| PUT | `/api/admin/bots/:id` | 更新 Bot |
| DELETE | `/api/admin/bots/:id` | 删除 Bot |
| GET | `/api/admin/sso-providers` | 获取 SSO 配置 |
| POST | `/api/admin/sso-providers` | 创建 SSO 配置 |
| PUT | `/api/admin/sso-providers/:id` | 更新 SSO 配置 |
| DELETE | `/api/admin/sso-providers/:id` | 删除 SSO 配置 |

### SSO 回调接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sso/:provider/callback` | SSO 提供商回调 |
| GET | `/api/sso/:provider/login` | 发起 SSO 登录 |

## npm Scripts

```bash
# 根目录命令
npm run dev              # 同时启动前后端
npm run dev:backend      # 仅启动后端
npm run dev:frontend     # 仅启动前端
npm run build            # 构建生产版本
npm run start            # 启动生产服务器
npm run db:generate      # 生成 Drizzle 迁移文件
npm run db:push          # 推送数据库变更（开发）
npm run db:migrate       # 数据库迁移（生产）

# 后端单独命令
cd packages/backend
npm run dev              # tsx watch 热重载
npm run build            # 编译到 dist/
npm run db:studio        # 数据库 GUI

# 前端单独命令
cd packages/frontend
npm run dev              # Vite 开发服务器
npm run build            # 类型检查 + 构建
npm run preview          # 预览生产构建
```

## Docker 部署

### 构建镜像

```bash
docker build -t opencode-qa .
```

### 运行容器

```bash
# 基本运行
docker run -d -p 8000:8000 -v opencode-qa-data:/app/data opencode-qa

# 生产环境运行
docker run -d \
  -p 8000:8000 \
  -v opencode-qa-data:/app/data \
  -e JWT_SECRET=your-secure-secret \
  -e ADMIN_PASSWORD=your-admin-password \
  opencode-qa
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | 8000 |
| `DATABASE_URL` | 数据库路径 | `file:./data/data.db` |
| `JWT_SECRET` | JWT 密钥 | **生产必须配置** |
| `ADMIN_USERNAME` | 管理员用户名 | admin |
| `ADMIN_PASSWORD` | 管理员密码 | **生产必须配置** |
| `ADMIN_EMAIL` | 管理员邮箱 | - |
| `LOG_*` | 日志配置 | 见 `.env.example` |

### 数据持久化

容器内数据库位于 `/app/data/data.db`，建议挂载 volume 保证数据安全。

### 注意事项

1. OpenCode 服务需独立运行（不在容器内）
2. 生产环境必须修改 `JWT_SECRET` 和 `ADMIN_PASSWORD`
3. 建议配置 HTTPS 反向代理

## Markdown 渲染支持

基于 Streamdown 渲染引擎，支持：

- ✅ 代码块语法高亮（Shiki）
- ✅ Mermaid 流程图/时序图
- ✅ KaTeX 数学公式
- ✅ 表格、引用、列表
- ✅ GFM（GitHub Flavored Markdown）
- ✅ CJK 文本优化

## SSO 集成

支持以下 SSO 提供商：

- 飞书（Lark）
- 自定义 OAuth 2.0 提供商

配置方式：登录管理后台 → SSO 管理 → 添加提供商

## 后续规划

- [ ] 支持更多 SSO 提供商（企业微信、钉钉）
- [ ] 对话导出功能
- [ ] 知识库管理
- [ ] 数据统计分析
- [ ] WebSocket 实时通信

## License

MIT
