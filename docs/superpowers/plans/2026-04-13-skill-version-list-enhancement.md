# 技能版本列表功能增强实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为用户侧技能版本列表增加 slug/显示名列、草稿状态、提交审核和取消操作功能

**Architecture:** 后端新增提交审核/取消审核 API，修改创建版本逻辑增加非终态版本检查；前端版本列表页新增列和操作按钮，创建版本页增加弹窗选择

**Tech Stack:** Express.js, Drizzle ORM, React, Ant Design

---

## Task 1: 后端 - 新增提交审核 API

**Files:**
- Modify: `packages/backend/src/routes/skill.ts`
- Modify: `packages/backend/src/services/skill.ts`

- [ ] **Step 1: 在 skill service 中新增 submitSkillVersion 函数**

在 `packages/backend/src/services/skill.ts` 中新增函数：

```typescript
export async function submitSkillVersion(versionId: string, userId: string) {
  const version = await getSkillVersionById(versionId)
  if (!version) {
    throw new Error('Version not found')
  }

  const skill = await getSkillById(version.skillId)
  if (!skill) {
    throw new Error('Skill not found')
  }

  if (skill.authorId !== userId) {
    throw new Error('Not authorized')
  }

  if (version.status !== 'draft') {
    throw new Error('Only draft versions can be submitted')
  }

  const now = new Date()
  await db.update(skillVersions).set({
    status: 'pending',
    updatedAt: now
  }).where(eq(skillVersions.id, versionId))

  return { success: true }
}
```

- [ ] **Step 2: 在 skill routes 中新增提交审核端点**

在 `packages/backend/src/routes/skill.ts` 中，在 `router.put('/:id/offline', ...)` 之前添加：

```typescript
router.put('/my/versions/:versionId/submit', async (req, res) => {
  try {
    const { versionId } = req.params
    await skillService.submitSkillVersion(versionId, req.user!.id)
    res.json({ success: true })
  } catch (error) {
    logger.error('Submit version error:', error)
    if (error instanceof Error) {
      if (error.message === 'Only draft versions can be submitted') {
        return res.status(400).json({ error: error.message })
      }
      if (error.message === 'Version not found' || error.message === 'Skill not found') {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === 'Not authorized') {
        return res.status(403).json({ error: error.message })
      }
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})
```

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/routes/skill.ts packages/backend/src/services/skill.ts
git commit -m "feat(backend): add submit skill version API"
```

---

## Task 2: 后端 - 新增取消审核 API

**Files:**
- Modify: `packages/backend/src/routes/skill.ts`
- Modify: `packages/backend/src/services/skill.ts`

- [ ] **Step 1: 在 skill service 中新增 cancelSkillVersion 函数**

在 `packages/backend/src/services/skill.ts` 中新增函数：

```typescript
export async function cancelSkillVersion(versionId: string, userId: string) {
  const version = await getSkillVersionById(versionId)
  if (!version) {
    throw new Error('Version not found')
  }

  const skill = await getSkillById(version.skillId)
  if (!skill) {
    throw new Error('Skill not found')
  }

  if (skill.authorId !== userId) {
    throw new Error('Not authorized')
  }

  if (version.status !== 'pending') {
    throw new Error('Only pending versions can be cancelled')
  }

  const now = new Date()
  await db.update(skillVersions).set({
    status: 'draft',
    updatedAt: now
  }).where(eq(skillVersions.id, versionId))

  return { success: true }
}
```

- [ ] **Step 2: 在 skill routes 中新增取消审核端点**

在 `packages/backend/src/routes/skill.ts` 中，在刚才添加的 submit 端点之后添加：

```typescript
router.put('/my/versions/:versionId/cancel', async (req, res) => {
  try {
    const { versionId } = req.params
    await skillService.cancelSkillVersion(versionId, req.user!.id)
    res.json({ success: true })
  } catch (error) {
    logger.error('Cancel version error:', error)
    if (error instanceof Error) {
      if (error.message === 'Only pending versions can be cancelled') {
        return res.status(400).json({ error: error.message })
      }
      if (error.message === 'Version not found' || error.message === 'Skill not found') {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === 'Not authorized') {
        return res.status(403).json({ error: error.message })
      }
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})
```

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/routes/skill.ts packages/backend/src/services/skill.ts
git commit -m "feat(backend): add cancel skill version API"
```

---

## Task 3: 后端 - 修改创建版本逻辑

**Files:**
- Modify: `packages/backend/src/services/skill.ts`
- Modify: `packages/backend/src/routes/skill.ts`

- [ ] **Step 1: 新增检查非终态版本的函数**

在 `packages/backend/src/services/skill.ts` 中新增函数：

```typescript
export async function hasActiveVersion(skillId: string): Promise<boolean> {
  const activeVersion = await db.select().from(skillVersions)
    .where(and(
      eq(skillVersions.skillId, skillId),
      inArray(skillVersions.status, ['draft', 'pending'])
    ))
    .get()
  return !!activeVersion
}
```

需要确保 `inArray` 已导入（已在文件中导入）。

- [ ] **Step 2: 修改 createSkillVersion 函数支持 status 参数和检查非终态版本**

修改 `packages/backend/src/services/skill.ts` 中的 `createSkillVersion` 函数：

```typescript
export async function createSkillVersion(data: {
  skillId: string
  versionType: 'major' | 'minor' | 'patch'
  changeLog: string
  createdBy: string
  displayName?: string
  description?: string
  status?: 'draft' | 'pending'
}) {
  const skill = await getSkillById(data.skillId)
  if (!skill) {
    throw new Error('Skill not found')
  }

  const activeVersionExists = await hasActiveVersion(data.skillId)
  if (activeVersionExists) {
    throw new Error('该技能已有一个版本正在处理中，请先处理或取消该版本')
  }

  const newVersion = incrementVersion(skill.version, data.versionType)
  const versionId = randomUUID()
  const now = new Date()

  await db.insert(skillVersions).values({
    id: versionId,
    skillId: data.skillId,
    version: newVersion,
    versionType: data.versionType,
    displayName: data.displayName ?? null,
    description: data.description ?? null,
    changeLog: data.changeLog,
    status: data.status || 'pending',
    createdBy: data.createdBy,
    createdAt: now,
    updatedAt: now
  })

  return { versionId, version: newVersion }
}
```

- [ ] **Step 3: 修改更新技能的路由支持 status 参数**

修改 `packages/backend/src/routes/skill.ts` 中的 `router.put('/:id', ...)` 路由：

在解构 body 后，添加对 status 参数的处理：

找到这一行：
```typescript
const { displayName, description, versionType, changeLog } = req.body
```

改为：
```typescript
const { displayName, description, versionType, changeLog, status } = req.body
```

找到调用 `createSkillVersion` 的地方：
```typescript
const result = await skillService.createSkillVersion({
  skillId: id,
  versionType,
  changeLog,
  createdBy: req.user!.id,
  displayName,
  description
})
```

改为：
```typescript
const result = await skillService.createSkillVersion({
  skillId: id,
  versionType,
  changeLog,
  createdBy: req.user!.id,
  displayName,
  description,
  status: status === 'draft' ? 'draft' : 'pending'
})
```

并在响应中返回正确的状态：
找到：
```typescript
res.json({
  id,
  versionId: result.versionId,
  newVersion: result.version,
  status: 'pending'
})
```

改为：
```typescript
res.json({
  id,
  versionId: result.versionId,
  newVersion: result.version,
  status: status === 'draft' ? 'draft' : 'pending'
})
```

同时在 `versionType` 验证之后添加 status 验证：
```typescript
if (status && !['draft', 'pending'].includes(status)) {
  return res.status(400).json({ error: 'status must be draft or pending' })
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/services/skill.ts packages/backend/src/routes/skill.ts
git commit -m "feat(backend): add draft status and active version check for skill version creation"
```

---

## Task 4: 前端 - API 客户端新增方法

**Files:**
- Modify: `packages/frontend/src/services/api.ts`

- [ ] **Step 1: 新增提交审核和取消审核 API 方法**

在 `packages/frontend/src/services/api.ts` 文件末尾添加：

```typescript
export async function submitSkillVersion(versionId: string): Promise<{ success: boolean }> {
  return request(`${API_BASE}/skills/my/versions/${versionId}/submit`, {
    method: 'PUT',
  })
}

export async function cancelSkillVersion(versionId: string): Promise<{ success: boolean }> {
  return request(`${API_BASE}/skills/my/versions/${versionId}/cancel`, {
    method: 'PUT',
  })
}
```

- [ ] **Step 2: 修改 updateSkillWithFiles 函数支持 status 参数**

修改 `packages/frontend/src/services/api.ts` 中的 `updateSkillWithFiles` 函数：

找到函数签名：
```typescript
export async function updateSkillWithFiles(id: string, data: {
  files: File[]
  paths: string[]
  displayName?: string
  description?: string
  versionType: 'major' | 'minor' | 'patch'
  changeLog: string
}): Promise<UpdateSkillResult>
```

添加 status 参数：
```typescript
export async function updateSkillWithFiles(id: string, data: {
  files: File[]
  paths: string[]
  displayName?: string
  description?: string
  versionType: 'major' | 'minor' | 'patch'
  changeLog: string
  status?: 'draft' | 'pending'
}): Promise<UpdateSkillResult>
```

在 formData 添加部分：
```typescript
formData.append('versionType', data.versionType)
formData.append('changeLog', data.changeLog)
```

之后添加：
```typescript
if (data.status) formData.append('status', data.status)
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/services/api.ts
git commit -m "feat(frontend): add submit and cancel skill version API methods"
```

---

## Task 5: 前端 - 版本列表页面增强

**Files:**
- Modify: `packages/frontend/src/pages/skills/MySkillVersions.tsx`

- [ ] **Step 1: 更新状态颜色和标签配置**

修改 `packages/frontend/src/pages/skills/MySkillVersions.tsx` 中的状态配置：

```typescript
const statusColors: Record<string, string> = {
  draft: 'default',
  pending: 'orange',
  approved: 'green',
  rejected: 'red'
}

const statusLabels: Record<string, string> = {
  draft: '草稿',
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝'
}
```

- [ ] **Step 2: 新增操作列**

在 columns 数组中，在"提交时间"列之前添加操作列：

```typescript
{
  title: '操作',
  key: 'action',
  width: 100,
  render: (_: unknown, record: MyPendingVersion) => {
    if (record.status === 'draft') {
      return (
        <Button 
          type="link" 
          size="small"
          onClick={(e) => { e.stopPropagation(); handleSubmit(record.id) }}
        >
          提交审核
        </Button>
      )
    }
    if (record.status === 'pending') {
      return (
        <Button 
          type="link" 
          size="small"
          onClick={(e) => { e.stopPropagation(); handleCancel(record.id) }}
        >
          取消
        </Button>
      )
    }
    return '-'
  }
}
```

需要在文件顶部添加 Button 导入：
```typescript
import { Table, Card, Tag, Select, Tooltip, Empty, message, Button, Modal } from 'antd'
```

- [ ] **Step 3: 添加操作处理函数和筛选选项**

在 `loadVersions` 函数之后添加：

```typescript
const handleSubmit = async (versionId: string) => {
  Modal.confirm({
    title: '确认提交审核？',
    content: '提交后将等待管理员审核',
    onOk: async () => {
      try {
        await submitSkillVersion(versionId)
        message.success('已提交审核')
        loadVersions()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '提交失败')
      }
    }
  })
}

const handleCancel = async (versionId: string) => {
  Modal.confirm({
    title: '确认取消审核？',
    content: '取消后版本将变回草稿状态',
    onOk: async () => {
      try {
        await cancelSkillVersion(versionId)
        message.success('已取消审核')
        loadVersions()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '取消失败')
      }
    }
  })
}
```

更新导入：
```typescript
import { getMySkillVersions, submitSkillVersion, cancelSkillVersion, type MyPendingVersion } from '../../services/api'
```

- [ ] **Step 4: 更新筛选选项**

修改 Select 的 options，添加草稿选项：

```typescript
options={[
  { value: 'draft', label: '草稿' },
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
  { value: '', label: '全部状态' }
]}
```

- [ ] **Step 5: 新增 slug 和显示名列**

在 columns 数组中，在"技能名称"列之后添加：

```typescript
{
  title: 'Slug',
  dataIndex: 'skillSlug',
  key: 'skillSlug',
  width: 150,
  ellipsis: true,
  render: (slug: string, record) => (
    <span
      style={{ color: '#1890ff', cursor: 'pointer' }}
      onClick={(e) => { e.stopPropagation(); navigate(`/skills/my/versions/${record.id}`) }}
    >
      {slug}
    </span>
  )
},
{
  title: '显示名',
  dataIndex: 'displayName',
  key: 'displayName',
  width: 150,
  ellipsis: true,
  render: (name: string | null) => name || '-'
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/pages/skills/MySkillVersions.tsx
git commit -m "feat(frontend): add slug, display name columns and action buttons to skill version list"
```

---

## Task 6: 前端 - 创建版本页面弹窗选择

**Files:**
- Modify: `packages/frontend/src/pages/skills/Update.tsx`

- [ ] **Step 1: 添加 Modal 导入和状态**

在文件顶部的导入中添加 Modal：
```typescript
import { Form, Input, Button, message, Radio, Spin, Modal } from 'antd'
```

在组件内，在 `const [versionType, ...]` 之后添加状态：
```typescript
const [submitModalVisible, setSubmitModalVisible] = useState(false)
```

- [ ] **Step 2: 修改提交按钮逻辑**

找到提交按钮：
```typescript
<Button type="primary" htmlType="submit" loading={submitting} size="large" disabled={!hasSkillMd}>
  提交更新
</Button>
```

改为：
```typescript
<Button 
  type="primary" 
  onClick={() => setSubmitModalVisible(true)} 
  loading={submitting} 
  size="large" 
  disabled={!hasSkillMd}
>
  提交更新
</Button>
```

同时移除 Form 的 `onFinish={handleSubmit}` 改为 `onFinish={() => setSubmitModalVisible(true)}`

- [ ] **Step 3: 添加 Modal 组件**

在 Form 关闭标签之后，`</div>` 之前添加：

```typescript
<Modal
  title="选择提交方式"
  open={submitModalVisible}
  onCancel={() => setSubmitModalVisible(false)}
  footer={null}
>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <Button 
      type="primary" 
      block 
      onClick={() => handleConfirmSubmit('pending')}
      loading={submitting}
    >
      直接提交审核
    </Button>
    <Button 
      block 
      onClick={() => handleConfirmSubmit('draft')}
      loading={submitting}
    >
      保存为草稿
    </Button>
    <Button 
      type="text" 
      block 
      onClick={() => setSubmitModalVisible(false)}
    >
      取消
    </Button>
  </div>
</Modal>
```

- [ ] **Step 4: 修改 handleSubmit 函数**

修改 `handleSubmit` 函数，添加 status 参数：

```typescript
const handleConfirmSubmit = async (status: 'draft' | 'pending') => {
  const values = await form.validateFields()
  
  if (!hasSkillMd) {
    message.error('必须包含 SKILL.md 文件')
    return
  }

  if (files.length === 0) {
    message.error('请上传文件')
    return
  }

  if (!values.changeLog) {
    message.error('请填写变更说明')
    return
  }

  if (!skill) return

  setSubmitting(true)
  try {
    await updateSkillWithFiles(skill.id, {
      files,
      paths,
      displayName: values.displayName,
      description: values.description,
      versionType,
      changeLog: values.changeLog,
      status,
    })
    message.success(status === 'draft' ? '已保存为草稿' : '技能更新成功，等待审核')
    setSubmitModalVisible(false)
    navigate('/skills/my/versions')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '更新失败')
  } finally {
    setSubmitting(false)
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/pages/skills/Update.tsx
git commit -m "feat(frontend): add modal for draft or submit choice when creating skill version"
```

---

## Task 7: 测试验证

- [ ] **Step 1: 启动后端服务**

```bash
npm run dev:backend
```

- [ ] **Step 2: 启动前端服务**

```bash
npm run dev:frontend
```

- [ ] **Step 3: 手动测试功能**

1. 登录系统
2. 进入我的技能页面，选择一个技能进行更新
3. 上传文件，填写变更说明
4. 点击提交更新，验证弹窗显示
5. 选择"保存为草稿"，验证版本列表显示草稿状态
6. 在版本列表点击"提交审核"，验证状态变为待审核
7. 在版本列表点击"取消"，验证状态变回草稿
8. 再次提交审核，验证状态变为待审核
9. 尝试再创建一个版本，验证提示"已有一个版本正在处理中"

- [ ] **Step 4: 运行单元测试**

```bash
npm run test
```

- [ ] **Step 5: Commit (如有修复)**

```bash
git add .
git commit -m "fix: resolve issues found in testing"
```
