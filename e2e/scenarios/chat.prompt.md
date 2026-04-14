# 对话功能 E2E 测试

## 测试环境

- 前端地址：http://localhost:3000
- 后端地址：http://localhost:8000
- OpenCode 地址：http://localhost:4096
- 测试账号：testuser / test123456

---

## TC-CHAT-001: 创建新会话并发送消息

**优先级：** P0

**前置条件：**
- 用户已登录（testuser）
- OpenCode 服务正常运行

**测试步骤：**

1. 使用 `chrome-devtools_navigate_page` 打开首页 http://localhost:3000/
2. 使用 `chrome-devtools_take_snapshot` 获取页面快照
3. 确认显示欢迎消息"有什么可以帮你的？"
4. 使用 `chrome-devtools_fill` 在输入框输入问题：`你好，请介绍一下自己`
5. 使用 `chrome-devtools_click` 点击发送按钮（或按 Enter）
6. 使用 `chrome-devtools_wait_for` 等待 AI 回复出现

**预期结果：**
- 会话创建成功
- 用户消息显示在右侧
- AI 回复流式显示在左侧
- 侧边栏出现新会话

**验证点：**
- URL 变为 `http://localhost:3000/?sessionId=<id>`
- 页面右侧显示用户消息"你好，请介绍一下自己"
- 页面左侧显示 AI 回复（绿色头像）
- 侧边栏会话列表包含新创建的会话

---

## TC-CHAT-002: 在已有会话中继续对话

**优先级：** P0

**前置条件：**
- 用户已登录
- 存在至少一个会话（可由 TC-CHAT-001 创建）

**测试步骤：**

1. 刷新页面确保在会话中
2. 使用 `chrome-devtools_take_snapshot` 获取页面快照
3. 使用 `chrome-devtools_fill` 输入后续问题：`你能做什么？`
4. 使用 `chrome-devtools_click` 点击发送
5. 使用 `chrome-devtools_wait_for` 等待 AI 回复

**预期结果：**
- 新消息添加到对话中
- AI 回复正常

**验证点：**
- 页面显示多条消息（历史消息 + 新消息）
- 消息顺序正确（用户消息在右，AI 消息在左）

---

## TC-CHAT-003: 停止 AI 生成

**优先级：** P1

**前置条件：**
- 用户已登录
- OpenCode 服务正常运行

**测试步骤：**

1. 打开首页，创建新会话或使用现有会话
2. 使用 `chrome-devtools_fill` 输入一个较复杂的问题：`请详细解释一下什么是机器学习，包括它的历史、应用和发展趋势`
3. 使用 `chrome-devtools_click` 点击发送
4. 等待 AI 开始回复（观察到流式输出）
5. 立即使用 `chrome-devtools_take_snapshot` 找到"停止"按钮
6. 使用 `chrome-devtools_click` 点击停止按钮

**预期结果：**
- AI 停止生成
- 已生成的内容保留
- 输入框恢复可用

**验证点：**
- 停止按钮消失或输入框不再显示 loading 状态
- AI 消息内容不完整（被中断）
- 可以继续发送新消息

---

## TC-CHAT-004: 复制会话链接

**优先级：** P1

**前置条件：**
- 用户已登录
- 存在至少一个会话

**测试步骤：**

1. 打开一个已有会话（URL 包含 sessionId）
2. 使用 `chrome-devtools_take_snapshot` 获取页面快照
3. 找到"复制链接"按钮（通常在页面顶部或更多菜单中）
4. 使用 `chrome-devtools_click` 点击复制链接
5. 使用 `chrome-devtools_evaluate_script` 验证剪贴板内容

**预期结果：**
- 显示"会话链接已复制"提示
- 剪贴板包含正确的会话链接

**验证点：**
- 页面显示成功提示消息
- 剪贴板内容格式：`http://localhost:3000/session/<sessionId>`

---

## TC-CHAT-005: 切换历史会话

**优先级：** P1

**前置条件：**
- 用户已登录
- 用户有多个历史会话

**测试步骤：**

1. 打开首页 http://localhost:3000/
2. 使用 `chrome-devtools_take_snapshot` 获取侧边栏快照
3. 在侧边栏会话列表中找到一个历史会话
4. 使用 `chrome-devtools_click` 点击该会话
5. 使用 `chrome-devtools_wait_for` 等待会话内容加载

**预期结果：**
- 成功切换到选中的会话
- 显示该会话的历史消息

**验证点：**
- URL 变为对应的 sessionId
- 页面显示该会话的历史消息
- 侧边栏高亮显示当前会话

---

## TC-CHAT-006: 标记需要人工处理

**优先级：** P1

**前置条件：**
- 用户已登录
- 存在一个活跃会话

**测试步骤：**

1. 打开一个活跃会话
2. 使用 `chrome-devtools_take_snapshot` 获取页面快照
3. 找到"标记为人工处理"按钮（可能在更多菜单中）
4. 使用 `chrome-devtools_click` 点击该按钮
5. 使用 `chrome-devtools_wait_for` 等待状态变化

**预期结果：**
- 会话状态变为"人工处理"
- 显示成功提示

**验证点：**
- 页面显示状态提示（如"已标记为需要人工处理"）
- 会话状态指示器变化
- 可能显示"复制链接发给支撑人员"提示

---

## TC-CHAT-007: 新建会话

**优先级：** P1

**前置条件：**
- 用户已登录
- 当前在某个会话中

**测试步骤：**

1. 使用 `chrome-devtools_take_snapshot` 获取页面快照
2. 找到"新建会话"按钮（通常在侧边栏顶部）
3. 使用 `chrome-devtools_click` 点击新建会话
4. 观察页面变化

**预期结果：**
- 清空当前消息
- 显示欢迎页面
- URL 移除 sessionId 参数

**验证点：**
- URL 变为 `http://localhost:3000/`
- 页面显示欢迎消息"有什么可以帮你的？"
- 消息列表为空

---

## TC-CHAT-008: 会话已关闭状态

**优先级：** P2

**前置条件：**
- 用户已登录
- 存在一个已关闭的会话（状态为 closed）

**测试步骤：**

1. 通过 URL 直接访问一个已关闭的会话
2. 使用 `chrome-devtools_take_snapshot` 获取页面快照
3. 尝试在输入框输入内容

**预期结果：**
- 显示"会话已关闭"提示
- 输入框禁用

**验证点：**
- 输入框 placeholder 显示"会话已关闭"
- 无法发送新消息

---

## 测试数据准备

执行测试前确保：
1. 测试用户 testuser 已创建
2. OpenCode 服务正常运行
3. 测试用户有至少 2 个历史会话（用于 TC-CHAT-005）
