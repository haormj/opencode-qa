# 测试数据

## 测试账号

### 普通用户

| 字段 | 值 |
|------|-----|
| 用户名 | testuser |
| 密码 | test123456 |
| 邮箱 | test@example.com |
| 显示名 | 测试用户 |
| 角色 | user |

### 管理员

| 字段 | 值 |
|------|-----|
| 用户名 | admin |
| 密码 | admin123 |
| 邮箱 | admin@example.com |
| 显示名 | 管理员 |
| 角色 | admin, user |

## 测试会话

### 用于对话功能测试

| 字段 | 值 |
|------|-----|
| 标题 | E2E测试会话 |
| 状态 | active |

### 用于人工处理测试

| 字段 | 值 |
|------|-----|
| 标题 | 人工处理测试会话 |
| 状态 | human |

## 测试 Bot

### 用于 Bot 管理测试

| 字段 | 值 |
|------|-----|
| 名称 | e2e-test-bot |
| 显示名 | E2E测试Bot |
| 描述 | 用于E2E测试的Bot |
| API URL | http://localhost:4096 |
| Provider | opencode |
| Model | default |
| Agent | plan |

## 创建测试数据脚本

```bash
# 运行种子脚本创建测试数据
npm run db:seed -w @opencode-qa/backend
```

## 数据清理

测试完成后，建议清理创建的测试数据：

1. 删除测试用户创建的会话
2. 删除测试 Bot
3. 重置测试用户状态

## 敏感数据

⚠️ **注意**：以上测试数据仅用于开发环境测试，不要在生产环境使用。
