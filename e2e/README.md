# E2E 端到端测试

基于 MCP 浏览器自动化的端到端测试，通过提示词驱动测试执行。

## 测试架构

```
e2e/
├── README.md                    # 本文档
├── setup.md                     # 测试环境配置
├── scenarios/                   # 测试场景
│   ├── auth.prompt.md           # 用户认证流程
│   ├── chat.prompt.md           # 对话功能
│   └── admin.prompt.md          # 管理后台
└── fixtures/                    # 测试数据
    └── test-data.md             # 测试账号和数据
```

## 快速开始

### 1. 启动服务

```bash
# 启动 OpenCode 服务
opencode serve --port 4096

# 启动应用
npm run dev
```

### 2. 执行测试

通过提示词告诉 AI 执行测试：

```
执行 e2e/scenarios/auth.prompt.md 中的 AUTH-002 测试用例
```

或执行整个场景：

```
执行 e2e/scenarios/auth.prompt.md 所有测试用例
```

## 测试场景

| 场景 | 文件 | 用例数 |
|------|------|--------|
| 用户认证 | auth.prompt.md | 5 |
| 对话功能 | chat.prompt.md | 6 |
| 管理后台 | admin.prompt.md | 6 |

## 测试原则

1. **先写测试**：任何功能改动前先编写或更新 E2E 测试用例
2. **独立可重复**：每个测试用例可独立执行，不依赖其他用例
3. **明确验证点**：每个步骤都有清晰的预期结果
4. **清理数据**：测试完成后清理创建的测试数据

## MCP 工具

测试使用以下 chrome-devtools MCP 工具：

| 工具 | 用途 |
|------|------|
| `chrome-devtools_navigate_page` | 页面导航 |
| `chrome-devtools_take_snapshot` | 获取页面快照 |
| `chrome-devtools_fill` | 填写表单 |
| `chrome-devtools_click` | 点击元素 |
| `chrome-devtools_wait_for` | 等待文本出现 |
| `chrome-devtools_take_screenshot` | 截图 |

## 持续集成

测试可在 CI/CD 流水线中自动执行：

```yaml
# .github/workflows/e2e-test.yml
- name: Run E2E Tests
  run: |
    npm run dev &
    sleep 10
    # 执行测试场景...
```

## 常见问题

### Q: 测试执行失败？

1. 检查服务是否正常启动
2. 检查端口 3000 和 8000 是否被占用
3. 检查测试数据是否存在

### Q: 如何添加新测试？

1. 在对应的 `.prompt.md` 文件中添加测试用例
2. 按格式编写步骤和验证点
3. 更新测试数据（如需要）
