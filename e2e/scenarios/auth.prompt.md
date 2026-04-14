# 用户认证流程 E2E 测试

## 测试环境

- 前端地址：http://localhost:3000
- 后端地址：http://localhost:8000
- 测试账号：见 e2e/fixtures/test-data.md

---

## TC-AUTH-001: 用户注册

**优先级：** P0

**前置条件：**
- 应用正常运行
- 测试账号 testuser 不存在（或使用随机用户名）

**测试步骤：**

1. 使用 `chrome-devtools_navigate_page` 打开登录页面 http://localhost:3000/login
2. 使用 `chrome-devtools_take_snapshot` 获取页面快照
3. 找到"注册"标签页，使用 `chrome-devtools_click` 点击
4. 使用 `chrome-devtools_fill` 填写用户名输入框：`e2e_test_` + 时间戳
5. 使用 `chrome-devtools_fill` 填写密码输入框：`test123456`
6. 使用 `chrome-devtools_click` 点击"注册"按钮
7. 使用 `chrome-devtools_wait_for` 等待页面跳转

**预期结果：**
- 注册成功
- 自动登录并跳转到首页 (/)
- 页面显示用户名

**验证点：**
- URL 变为 `http://localhost:3000/`
- 页面包含欢迎消息"有什么可以帮你的？"
- 侧边栏显示新用户名

---

## TC-AUTH-002: 用户登录

**优先级：** P0

**前置条件：**
- 应用正常运行
- 测试账号 testuser 已存在

**测试步骤：**

1. 使用 `chrome-devtools_navigate_page` 打开登录页面 http://localhost:3000/login
2. 使用 `chrome-devtools_take_snapshot` 获取页面快照
3. 确认当前是"登录"标签页（如不是则点击"登录"标签）
4. 使用 `chrome-devtools_fill` 填写用户名输入框：`testuser`
5. 使用 `chrome-devtools_fill` 填写密码输入框：`test123456`
6. 使用 `chrome-devtools_click` 点击"登录"按钮
7. 使用 `chrome-devtools_wait_for` 等待文本"有什么可以帮你的？"出现

**预期结果：**
- 登录成功
- 跳转到首页
- 显示欢迎消息

**验证点：**
- URL 变为 `http://localhost:3000/`
- 页面包含元素 `.welcome-message`
- 侧边栏显示"测试用户"

---

## TC-AUTH-003: 登录失败（错误密码）

**优先级：** P1

**前置条件：**
- 应用正常运行
- 测试账号 testuser 已存在

**测试步骤：**

1. 使用 `chrome-devtools_navigate_page` 打开登录页面 http://localhost:3000/login
2. 使用 `chrome-devtools_fill` 填写用户名：`testuser`
3. 使用 `chrome-devtools_fill` 填写密码：`wrongpassword`
4. 使用 `chrome-devtools_click` 点击"登录"按钮
5. 使用 `chrome-devtools_wait_for` 等待错误提示出现

**预期结果：**
- 登录失败
- 显示错误提示
- 停留在登录页

**验证点：**
- URL 仍为 `http://localhost:3000/login`
- 页面显示错误消息（如"Invalid credentials"或"登录失败"）

---

## TC-AUTH-004: 用户登出

**优先级：** P0

**前置条件：**
- 用户已登录（testuser）

**测试步骤：**

1. 确保用户在首页 http://localhost:3000/
2. 使用 `chrome-devtools_take_snapshot` 获取页面快照
3. 找到用户头像或用户名区域，使用 `chrome-devtools_click` 点击
4. 在下拉菜单中找到"登出"按钮，使用 `chrome-devtools_click` 点击
5. 使用 `chrome-devtools_wait_for` 等待跳转到登录页

**预期结果：**
- 登出成功
- 跳转到登录页

**验证点：**
- URL 变为 `http://localhost:3000/login`
- localStorage 中的 token 已清除

---

## TC-AUTH-005: 未登录访问受保护页面

**优先级：** P1

**前置条件：**
- 用户未登录

**测试步骤：**

1. 确保用户未登录（清除 localStorage）
2. 使用 `chrome-devtools_navigate_page` 直接访问首页 http://localhost:3000/
3. 观察页面跳转

**预期结果：**
- 自动跳转到登录页

**验证点：**
- URL 变为 `http://localhost:3000/login`
- 登录页正常显示

---

## TC-AUTH-006: 表单验证

**优先级：** P2

**前置条件：**
- 应用正常运行

**测试步骤：**

### 6.1 用户名过短

1. 打开注册页面
2. 填写用户名：`ab`（少于3个字符）
3. 点击注册
4. 验证显示错误提示"用户名至少3个字符"

### 6.2 密码过短

1. 打开注册页面
2. 填写用户名：`testuser123`
3. 填写密码：`12345`（少于6个字符）
4. 点击注册
5. 验证显示错误提示"密码至少6个字符"

### 6.3 空表单提交

1. 打开登录页面
2. 不填写任何内容，直接点击登录
3. 验证显示错误提示"请输入用户名"和"请输入密码"

**预期结果：**
- 表单验证正确触发
- 显示对应错误提示

---

## 测试数据清理

测试完成后：
1. 删除注册创建的测试用户（如 e2e_test_*）
2. 清除浏览器 localStorage
