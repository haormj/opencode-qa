# opencode-qa

基于 OpenCode 的业务知识问答系统。

## 功能特性

- 💬 智能问答：基于 OpenCode 的 AI 能力回答业务问题
- 📝 历史记录：保存所有问答记录，支持查看和检索
- 📢 反馈系统：用户可提交未解决问题的反馈
- 🔐 SSO 认证：预留 SSO 单点登录接口

## 技术栈

- **前端**: React + Vite + TypeScript + Ant Design
- **后端**: Express + TypeScript + Prisma
- **SDK**: @opencode-ai/sdk
- **数据库**: SQLite (开发) / PostgreSQL (生产)

## 快速开始

### 前置要求

- Node.js >= 18
- npm >= 9
- OpenCode CLI 已安装并配置

### 安装依赖

```bash
npm install
```

### 启动 OpenCode Server

```bash
opencode serve --port 4096
```

### 启动开发服务器

```bash
# 初始化数据库
npm run db:push

# 启动前后端
npm run dev
```

- 前端: http://localhost:3000
- 后端: http://localhost:8000

### 环境变量

复制 `packages/backend/.env.example` 为 `packages/backend/.env`：

```env
PORT=8000
DATABASE_URL="file:./data.db"
OPENCODE_HOST=127.0.0.1
OPENCODE_PORT=4096
```

## 项目结构

```
opencode-qa/
├── packages/
│   ├── frontend/          # React 前端
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   └── services/
│   │   └── package.json
│   │
│   └── backend/           # Express 后端
│       ├── src/
│       │   ├── routes/    # API 路由
│       │   ├── services/  # 业务逻辑
│       │   ├── middleware/
│       │   └── prisma/    # 数据模型
│       └── package.json
│
├── docker-compose.yml
└── package.json
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat` | 发送问题 |
| GET | `/api/chat/:sessionId` | 获取对话详情 |
| GET | `/api/history` | 获取历史记录 |
| POST | `/api/feedback` | 提交反馈 |
| GET | `/api/health` | 健康检查 |

## Docker 部署

```bash
docker-compose up -d
```

## 后续规划

- [ ] 集成 WeLink 通知
- [ ] 对接内部 SSO 系统
- [ ] 支持切换 PostgreSQL 数据库
- [ ] 管理后台

## License

MIT
