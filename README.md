# OpenCode QA

基于 OpenCode 的业务知识问答系统，支持 AI 流式响应、SSO 单点登录、管理后台等功能。

## 功能特性

- 💬 **智能问答** - 基于 OpenCode AI 能力，支持流式响应
- 🗂️ **会话管理** - 多会话支持，历史记录持久化
- 🤖 **助手管理** - 支持多助手配置，用户级 Bot 分配
- 👥 **用户管理** - 用户角色分配，权限控制
- 🔐 **SSO 认证** - 支持飞书等企业级单点登录
- 📊 **数据统计** - 会话统计、拦截率分析
- ⚙️ **系统设置** - 站点配置、登录选项配置
- 🔄 **实时消息** - SSE 实时消息推送
- 📢 **人工接入** - 管理员可直接回复用户

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

# 4. 启动 OpenCode Server（另开终端）
opencode serve --port 4096

# 5. 启动开发服务器
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
OPENCODE_SERVER_PASSWORD=your-password  # OpenCode 服务认证密码

# 日志配置
LOG_LEVEL=info
LOG_ENABLE_CONSOLE=true
LOG_ENABLE_FILE=true
LOG_MAX_FILE_SIZE=10m
LOG_RETENTION_DAYS=7d
```

## npm Scripts

```bash
# 安装依赖
npm run install:all        # 安装前后端所有依赖

# 开发
npm run dev                # 同时启动前后端
npm run dev:backend        # 仅启动后端
npm run dev:frontend       # 仅启动前端

# 构建
npm run build              # 构建生产版本
npm run start              # 启动生产服务器

# 测试
npm run test               # 运行所有测试
npm run test:backend       # 仅后端测试
npm run test:frontend      # 仅前端测试
npm run test:coverage      # 运行测试并生成覆盖率报告

# 数据库
npm run db:generate        # 生成 Drizzle 迁移文件
npm run db:push            # 推送数据库变更（开发）
npm run db:migrate         # 数据库迁移（生产）
```

<details>
<summary>后端/前端单独命令</summary>

```bash
# 后端
cd packages/backend
npm run dev                # tsx watch 热重载
npm run build              # 编译到 dist/
npm run db:studio          # 数据库 GUI

# 前端
cd packages/frontend
npm run dev                # Vite 开发服务器
npm run build              # 类型检查 + 构建
npm run preview            # 预览生产构建
```

</details>

## Docker 部署

### 拉取镜像

```bash
docker pull haormj/opencode-qa:latest
```

### 运行容器

```bash
# 基本运行
docker run -d -p 8000:8000 -v opencode-qa-data:/app/data haormj/opencode-qa:latest

# 生产环境运行
docker run -d \
  -p 8000:8000 \
  -v opencode-qa-data:/app/data \
  -e JWT_SECRET=your-secure-secret \
  -e ADMIN_PASSWORD=your-admin-password \
  haormj/opencode-qa:latest
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

## License

MIT
