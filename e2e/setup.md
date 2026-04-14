# 测试环境配置

## 前置条件

### 1. OpenCode 服务

```bash
opencode serve --port 4096
```

OpenCode 服务必须先启动，用于 AI 对话功能。

### 2. 数据库

```bash
# 推送数据库结构
cd packages/backend
npm run db:push

# (可选) 填充种子数据
npm run db:seed
```

### 3. 环境变量

```bash
cp packages/backend/.env.dev packages/backend/.env
```

必须配置：
- `OPENCODE_SERVER_PASSWORD`: OpenCode 服务认证密码
- `JWT_SECRET`: JWT 密钥（生产环境必须修改）

### 4. 启动应用

```bash
# 同时启动前后端
npm run dev

# 或分别启动
npm run dev:backend  # http://localhost:8000
npm run dev:frontend # http://localhost:3000
```

## 测试浏览器

测试通过 Chrome DevTools Protocol 控制 Chrome 浏览器：

1. 确保安装了 Chrome 浏览器
2. MCP 服务器需要配置 chrome-devtools 工具

## 端口检查

```powershell
# Windows
netstat -ano | findstr ":3000 :8000" | findstr "LISTENING"

# 如果端口被占用
taskkill /F /PID <PID>
```

## 测试数据准备

### 测试账号

| 角色 | 用户名 | 密码 | 用途 |
|------|--------|------|------|
| 普通用户 | testuser | test123456 | 常规功能测试 |
| 管理员 | admin | admin123456 | 管理后台测试 |

### 创建测试账号

```bash
# 通过 API 创建
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123456"}'

# 创建管理员需要通过数据库或种子脚本
```

## 网络要求

- 前端：http://localhost:3000
- 后端：http://localhost:8000
- OpenCode：http://localhost:4096

所有服务应在本地运行，无需外部网络访问。

## 故障排除

### 数据库错误

```bash
# 重置数据库
rm packages/backend/data/data.db
npm run db:push
```

### 登录失败

1. 检查账号是否已创建
2. 检查密码是否正确
3. 检查后端日志

### AI 回复无响应

1. 检查 OpenCode 服务是否运行
2. 检查 OPENCODE_SERVER_PASSWORD 是否正确
3. 检查后端日志中的 OpenCode 连接错误
