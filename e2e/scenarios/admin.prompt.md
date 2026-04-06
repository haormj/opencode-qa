# 管理后台 E2E 测试

## 测试环境

- 前端地址：http://localhost:3000
- 后端地址：http://localhost:8000
- 管理员账号：admin / admin123456
- 普通用户账号：testuser / test123456

---

## TC-ADMIN-001: 管理员登录并访问后台

**优先级：** P0

**前置条件：**
- 应用正常运行
- 管理员账号 admin 已存在

**测试步骤：**

1. 使用 `chrome-devtools_navigate_page` 打开登录页 http://localhost:3000/login
2. 使用 `chrome-devtools_fill` 填写用户名：`admin`
3. 使用 `chrome-devtools_fill` 填写密码：`admin123456`
4. 使用 `chrome-devtools_click` 点击登录
5. 使用 `chrome-devtools_wait_for` 等待跳转到首页
6. 使用 `chrome-devtools_navigate_page` 访问管理后台 http://localhost:3000/admin
7. 使用 `chrome-devtools_wait_for` 等待管理后台加载

**预期结果：**
- 登录成功
- 可以访问管理后台
- 显示会话管理页面

**验证点：**
- URL 变为 `http://localhost:3000/admin/sessions`
- 页面左侧显示管理导航菜单
- 页面显示会话列表表格

---

## TC-ADMIN-002: 普通用户无法访问管理后台

**优先级：** P0

**前置条件：**
- 应用正常运行
- 普通用户 testuser 已存在

**测试步骤：**

1. 以普通用户 testuser 登录
2. 使用 `chrome-devtools_navigate_page` 尝试访问 http://localhost:3000/admin
3. 观察页面跳转

**预期结果：**
- 自动跳转到首页
- 无法访问管理后台

**验证点：**
- URL 变为 `http://localhost:3000/`
- 不显示管理后台内容

---

## TC-ADMIN-003: 查看会话列表

**优先级：** P0

**前置条件：**
- 管理员已登录
- 系统中存在多个会话

**测试步骤：**

1. 访问管理后台会话管理页面 http://localhost:3000/admin/sessions
2. 使用 `chrome-devtools_take_snapshot` 获取页面快照
3. 验证会话列表显示

**预期结果：**
- 显示会话列表表格
- 表格包含：标题、用户、状态、消息数、创建时间等列
- 支持分页

**验证点：**
- 页面包含会话表格元素
- 显示会话数据
- 有分页控件或滚动加载

---

## TC-ADMIN-004: 会话筛选和搜索

**优先级：** P1

**前置条件：**
- 管理员已登录
- 存在多种状态的会话（active, human, closed）

**测试步骤：**

### 4.1 按状态筛选

1. 访问会话管理页面
2. 使用 `chrome-devtools_take_snapshot` 找到状态筛选下拉框
3. 使用 `chrome-devtools_click` 点击状态筛选
4. 选择"human"状态
5. 验证列表只显示需要人工处理的会话

### 4.2 按用户搜索

1. 找到搜索输入框
2. 使用 `chrome-devtools_fill` 输入用户名：`testuser`
3. 验证列表只显示该用户的会话

**预期结果：**
- 筛选功能正常
- 搜索结果正确

**验证点：**
- 筛选后列表数据符合筛选条件
- 搜索结果包含目标用户

---

## TC-ADMIN-005: 查看会话详情并回复

**优先级：** P0

**前置条件：**
- 管理员已登录
- 存在一个状态为"human"的会话

**测试步骤：**

1. 访问会话管理页面
2. 使用 `chrome-devtools_take_snapshot` 获取列表
3. 找到一个状态为"human"的会话
4. 使用 `chrome-devtools_click` 点击该会话进入详情页
5. 使用 `chrome-devtools_wait_for` 等待详情页加载
6. 查看会话历史消息
7. 使用 `chrome-devtools_fill` 在输入框输入回复：`您好，我是管理员，有什么可以帮助您的？`
8. 使用 `chrome-devtools_click` 点击发送
9. 使用 `chrome-devtools_wait_for` 等待消息发送成功

**预期结果：**
- 成功进入会话详情页
- 显示会话历史消息
- 管理员回复成功

**验证点：**
- URL 变为 `http://localhost:3000/admin/sessions/<sessionId>`
- 页面显示会话历史消息
- 新消息显示"管理员"标识
- 消息位置在右侧

---

## TC-ADMIN-006: 关闭会话

**优先级：** P1

**前置条件：**
- 管理员已登录
- 在会话详情页

**测试步骤：**

1. 在会话详情页
2. 使用 `chrome-devtools_take_snapshot` 找到"关闭会话"按钮
3. 使用 `chrome-devtools_click` 点击关闭会话
4. 确认操作（如有确认弹窗）
5. 使用 `chrome-devtools_wait_for` 等待状态更新

**预期结果：**
- 会话状态变为"closed"
- 显示成功提示

**验证点：**
- 页面显示"会话已关闭"
- 会话状态指示器变化

---

## TC-ADMIN-007: 用户管理 - 查看用户列表

**优先级：** P1

**前置条件：**
- 管理员已登录

**测试步骤：**

1. 访问用户管理页面 http://localhost:3000/admin/users
2. 使用 `chrome-devtools_wait_for` 等待页面加载
3. 使用 `chrome-devtools_take_snapshot` 获取用户列表

**预期结果：**
- 显示用户列表
- 每个用户显示用户名、显示名、角色等信息

**验证点：**
- 页面包含用户表格
- 显示用户数据

---

## TC-ADMIN-008: 用户管理 - 添加/删除角色

**优先级：** P1

**前置条件：**
- 管理员已登录
- 存在测试用户 testuser

**测试步骤：**

### 8.1 添加角色

1. 访问用户管理页面
2. 找到用户 testuser
3. 使用 `chrome-devtools_click` 点击"添加角色"或角色管理按钮
4. 选择或输入要添加的角色
5. 确认添加
6. 验证角色已添加

### 8.2 删除角色

1. 在同一用户行
2. 找到刚添加的角色
3. 使用 `chrome-devtools_click` 点击删除角色按钮
4. 确认删除
5. 验证角色已移除

**预期结果：**
- 角色操作成功
- 用户角色列表更新

**验证点：**
- 添加后用户显示新角色
- 删除后角色从列表中移除

---

## TC-ADMIN-009: Bot 管理 - 创建 Bot

**优先级：** P1

**前置条件：**
- 管理员已登录

**测试步骤：**

1. 访问 Bot 管理页面 http://localhost:3000/admin/bots
2. 使用 `chrome-devtools_take_snapshot` 获取页面快照
3. 使用 `chrome-devtools_click` 点击"创建 Bot"或"新建"按钮
4. 使用 `chrome-devtools_fill` 填写 Bot 名称：`e2e_test_bot`
5. 使用 `chrome-devtools_fill` 填写显示名：`E2E测试Bot`
6. 填写其他必要字段（API URL、Provider、Model 等）
7. 使用 `chrome-devtools_click` 点击保存/创建按钮
8. 使用 `chrome-devtools_wait_for` 等待创建成功

**预期结果：**
- Bot 创建成功
- 显示在 Bot 列表中

**验证点：**
- 页面显示成功提示
- Bot 列表包含新创建的 Bot

---

## TC-ADMIN-010: Bot 管理 - 编辑和删除 Bot

**优先级：** P2

**前置条件：**
- 管理员已登录
- 存在测试 Bot（可由 TC-ADMIN-009 创建）

**测试步骤：**

### 10.1 编辑 Bot

1. 访问 Bot 管理页面
2. 找到测试 Bot
3. 使用 `chrome-devtools_click` 点击编辑按钮
4. 修改显示名为：`E2E测试Bot-已编辑`
5. 保存
6. 验证修改成功

### 10.2 删除 Bot

1. 在 Bot 列表中找到测试 Bot
2. 使用 `chrome-devtools_click` 点击删除按钮
3. 确认删除操作
4. 验证 Bot 已从列表中移除

**预期结果：**
- 编辑成功
- 删除成功

**验证点：**
- 编辑后显示新名称
- 删除后 Bot 不再显示在列表中

---

## TC-ADMIN-011: SSO 提供商管理

**优先级：** P2

**前置条件：**
- 管理员已登录

**测试步骤：**

1. 访问 SSO 设置页面 http://localhost:3000/admin/settings/sso
2. 使用 `chrome-devtools_wait_for` 等待页面加载
3. 使用 `chrome-devtools_take_snapshot` 获取 SSO 提供商列表
4. 查看现有 SSO 配置

**预期结果：**
- 显示 SSO 提供商列表
- 支持启用/禁用操作

**验证点：**
- 页面显示 SSO 配置
- 有添加新 SSO 提供商的入口

---

## TC-ADMIN-012: 统计概览

**优先级：** P2

**前置条件：**
- 管理员已登录
- 系统有足够的历史数据

**测试步骤：**

1. 访问统计页面 http://localhost:3000/admin/statistics
2. 使用 `chrome-devtools_wait_for` 等待页面加载
3. 使用 `chrome-devtools_take_snapshot` 获取统计数据

**预期结果：**
- 显示拦截率统计
- 显示会话统计（总数、活跃、人工处理、已关闭）
- 显示用户统计

**验证点：**
- 页面包含统计图表或数字
- 数据正确显示

---

## 测试数据清理

测试完成后：
1. 删除测试创建的 Bot（e2e_test_bot）
2. 清理测试会话数据
3. 恢复测试用户的角色状态
