# 技能管理页面实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为后台添加完整的技能管理功能，包括菜单入口、列表页增强、详情页和审核功能。

**Architecture:** 前端采用 React + Ant Design，复用现有管理页面模式。后端扩展现有 admin-skill 路由，新增批量操作和文件预览 API。

**Tech Stack:** React, Ant Design, TypeScript, Express, Drizzle ORM

---

## File Structure

### 前端文件
| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/frontend/src/components/AdminSidebar/index.tsx` | 修改 | 添加技能管理菜单入口 |
| `packages/frontend/src/pages/admin/Skills.tsx` | 修改 | 增强筛选和批量操作 |
| `packages/frontend/src/pages/admin/SkillDetail.tsx` | 新建 | 技能详情页 |
| `packages/frontend/src/services/api.ts` | 修改 | 新增 API 函数 |
| `packages/frontend/src/App.tsx` | 修改 | 添加详情页路由 |

### 后端文件
| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/backend/src/routes/admin-skill.ts` | 修改 | 新增 API 端点 |
| `packages/backend/src/services/skill.ts` | 修改 | 新增批量操作方法 |

---

## Task 1: 后端 - 获取技能详情 API

**Files:**
- Modify: `packages/backend/src/routes/admin-skill.ts`
- Modify: `packages/backend/src/services/skill.ts`

- [ ] **Step 1: 在 skill.ts 添加 getSkillDetailById 方法**

```typescript
export async function getSkillDetailById(id: string) {
  const skill = await db.select({
    id: skills.id,
    name: skills.name,
    displayName: skills.displayName,
    slug: skills.slug,
    description: skills.description,
    categoryId: skills.categoryId,
    authorId: skills.authorId,
    version: skills.version,
    status: skills.status,
    rejectReason: skills.rejectReason,
    downloadCount: skills.downloadCount,
    favoriteCount: skills.favoriteCount,
    averageRating: skills.averageRating,
    ratingCount: skills.ratingCount,
    createdAt: skills.createdAt,
    updatedAt: skills.updatedAt,
    categoryName: skillCategories.name,
    categorySlug: skillCategories.slug,
    authorName: users.displayName,
    authorUsername: users.username
  }).from(skills)
    .leftJoin(skillCategories, eq(skills.categoryId, skillCategories.id))
    .leftJoin(users, eq(skills.authorId, users.id))
    .where(eq(skills.id, id))
    .get()

  return skill
}
```

- [ ] **Step 2: 在 admin-skill.ts 添加 GET /:id 路由**

在 `router.delete('/:id', ...)` 之前添加：

```typescript
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const skill = await skillService.getSkillDetailById(id)
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' })
    }
    res.json(skill)
  } catch (error) {
    logger.error('Get skill detail error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
```

- [ ] **Step 3: 测试 API**

启动后端服务后测试：
```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/admin/skills/<skill-id>
```

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/routes/admin-skill.ts packages/backend/src/services/skill.ts
git commit -m "feat(backend): add get skill detail by id API"
```

---

## Task 2: 后端 - 文件预览 API

**Files:**
- Modify: `packages/backend/src/routes/admin-skill.ts`

- [ ] **Step 1: 添加 GET /:id/files 路由（文件树）**

在 `router.get('/:id', ...)` 之后添加：

```typescript
router.get('/:id/files', async (req, res) => {
  try {
    const { id } = req.params
    const skill = await skillService.getSkillById(id)
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' })
    }

    const tree = await skillFileService.getSkillFileTree(skill.slug, skill.version)
    res.json({ tree })
  } catch (error) {
    logger.error('Get skill files error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
```

- [ ] **Step 2: 添加 GET /:id/files/* 路由（文件内容）**

```typescript
router.get('/:id/files/*', async (req, res) => {
  try {
    const { id } = req.params
    const filePath = req.params[0]
    
    const skill = await skillService.getSkillById(id)
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' })
    }

    const content = await skillFileService.readSkillFile(skill.slug, skill.version, filePath)
    if (!content) {
      return res.status(404).json({ error: 'File not found' })
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send(content.toString('utf-8'))
  } catch (error) {
    logger.error('Get skill file content error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
```

- [ ] **Step 3: 测试文件预览 API**

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/admin/skills/<skill-id>/files
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/admin/skills/<skill-id>/files/SKILL.md
```

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/routes/admin-skill.ts
git commit -m "feat(backend): add skill file preview API"
```

---

## Task 3: 后端 - 批量操作 API

**Files:**
- Modify: `packages/backend/src/routes/admin-skill.ts`
- Modify: `packages/backend/src/services/skill.ts`

- [ ] **Step 1: 在 skill.ts 添加批量操作方法**

```typescript
export async function batchUpdateSkillStatus(
  ids: string[], 
  status: string, 
  rejectReason?: string
): Promise<number> {
  const updateData: Record<string, unknown> = { 
    status, 
    updatedAt: new Date() 
  }
  if (status === 'rejected' && rejectReason) {
    updateData.rejectReason = rejectReason
  } else if (status === 'approved') {
    updateData.rejectReason = null
  }

  const result = await db.update(skills)
    .set(updateData)
    .where(sql`${skills.id} IN ${ids}`)
    .run()
  
  return result.changes
}

export async function batchDeleteSkills(ids: string[]): Promise<number> {
  for (const id of ids) {
    const skill = await getSkillById(id)
    if (skill) {
      await skillFileService.deleteSkillFiles(skill.slug)
      await deleteSkill(id)
    }
  }
  return ids.length
}
```

- [ ] **Step 2: 在 admin-skill.ts 添加批量审核路由**

在现有路由之前添加：

```typescript
router.post('/batch-review', async (req, res) => {
  try {
    const { ids, status, rejectReason } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' })
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' })
    }

    if (status === 'rejected' && !rejectReason) {
      return res.status(400).json({ error: 'rejectReason is required when rejecting' })
    }

    const count = await skillService.batchUpdateSkillStatus(ids, status, rejectReason)
    res.json({ success: true, count })
  } catch (error) {
    logger.error('Batch review skills error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
```

- [ ] **Step 3: 添加批量删除路由**

```typescript
router.post('/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' })
    }

    const count = await skillService.batchDeleteSkills(ids)
    res.json({ success: true, count })
  } catch (error) {
    logger.error('Batch delete skills error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
```

- [ ] **Step 4: 测试批量操作 API**

```bash
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"ids":["id1","id2"],"status":"approved"}' \
  http://localhost:8000/api/admin/skills/batch-review
```

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/routes/admin-skill.ts packages/backend/src/services/skill.ts
git commit -m "feat(backend): add batch review and delete APIs"
```

---

## Task 4: 前端 - API 函数

**Files:**
- Modify: `packages/frontend/src/services/api.ts`

- [ ] **Step 1: 添加类型定义**

在文件中找到 `export type Skill` 附近，添加详情类型：

```typescript
export interface SkillDetail extends Skill {
  authorName?: string
  authorUsername?: string
  categoryName?: string
  categorySlug?: string
  readme?: string
}

export interface FileTreeNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileTreeNode[]
}
```

- [ ] **Step 2: 添加获取技能详情函数**

```typescript
export async function getAdminSkillById(id: string): Promise<SkillDetail> {
  return request(`${API_BASE}/admin/skills/${id}`)
}
```

- [ ] **Step 3: 添加文件预览函数**

```typescript
export async function getSkillFiles(skillId: string): Promise<{ tree: FileTreeNode[] }> {
  return request(`${API_BASE}/admin/skills/${skillId}/files`)
}

export async function getSkillFileContent(skillId: string, filePath: string): Promise<string> {
  const response = await fetch(`${API_BASE}/admin/skills/${skillId}/files/${filePath}`, {
    headers: {
      'Authorization': `Bearer ${getToken()}`
    }
  })
  if (!response.ok) {
    throw new Error('Failed to fetch file content')
  }
  return response.text()
}
```

- [ ] **Step 4: 添加批量操作函数**

```typescript
export async function batchReviewSkills(
  ids: string[], 
  status: 'approved' | 'rejected', 
  rejectReason?: string
): Promise<{ success: boolean; count: number }> {
  return request(`${API_BASE}/admin/skills/batch-review`, {
    method: 'POST',
    body: JSON.stringify({ ids, status, rejectReason }),
  })
}

export async function batchDeleteSkills(ids: string[]): Promise<{ success: boolean; count: number }> {
  return request(`${API_BASE}/admin/skills/batch-delete`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/services/api.ts
git commit -m "feat(frontend): add skill management API functions"
```

---

## Task 5: 前端 - 侧边栏菜单入口

**Files:**
- Modify: `packages/frontend/src/components/AdminSidebar/index.tsx`

- [ ] **Step 1: 导入图标**

修改第 4 行的 import：

```typescript
import { MessageOutlined, UserOutlined, BarChartOutlined, RobotOutlined, SettingOutlined, AppstoreOutlined, ToolOutlined } from '@ant-design/icons'
```

- [ ] **Step 2: 添加菜单项**

在 `menuItems` 数组中，"助手管理"项之后添加：

```typescript
{
  key: '/admin/skills',
  icon: <ToolOutlined />,
  label: '技能管理'
},
```

- [ ] **Step 3: 添加路由匹配**

在 `getSelectedKey` 函数中添加：

```typescript
if (pathname.startsWith('/admin/skills')) return '/admin/skills'
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/AdminSidebar/index.tsx
git commit -m "feat(frontend): add skill management menu entry"
```

---

## Task 6: 前端 - 技能详情页

**Files:**
- Create: `packages/frontend/src/pages/admin/SkillDetail.tsx`

- [ ] **Step 1: 创建详情页组件**

```typescript
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Tag, Button, Tabs, Tree, Spin, message, Modal, Form, Input, Select, Space, Statistic, Row, Col } from 'antd'
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, FolderOutlined, FileOutlined } from '@ant-design/icons'
import { getAdminSkillById, getSkillFiles, getSkillFileContent, batchReviewSkills, type SkillDetail, type FileTreeNode } from '../../services/api'

const statusColors: Record<string, string> = { pending: 'orange', approved: 'green', rejected: 'red', unpublished: 'default' }
const statusLabels: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已拒绝', unpublished: '已下架' }

function SkillDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [skill, setSkill] = useState<SkillDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
  const [fileContent, setFileContent] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [reviewModal, setReviewModal] = useState(false)
  const [reviewForm] = Form.useForm()

  useEffect(() => {
    fetchSkill()
  }, [id])

  const fetchSkill = async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await getAdminSkillById(id)
      setSkill(data)
      const files = await getSkillFiles(id)
      setFileTree(files.tree)
    } catch {
      message.error('加载技能详情失败')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (path: string) => {
    if (!id) return
    setSelectedFile(path)
    try {
      const content = await getSkillFileContent(id, path)
      setFileContent(content)
    } catch {
      message.error('加载文件内容失败')
    }
  }

  const handleReview = (status: 'approved' | 'rejected') => {
    reviewForm.setFieldsValue({ status })
    setReviewModal(true)
  }

  const submitReview = async () => {
    if (!id) return
    try {
      const values = await reviewForm.validateFields()
      await batchReviewSkills([id], values.status, values.rejectReason)
      message.success('审核完成')
      setReviewModal(false)
      fetchSkill()
    } catch {
      message.error('审核失败')
    }
  }

  const renderFileTree = (nodes: FileTreeNode[]): any[] => {
    return nodes.map(node => ({
      key: node.path,
      title: node.name,
      icon: node.isDirectory ? <FolderOutlined /> : <FileOutlined />,
      children: node.children ? renderFileTree(node.children) : undefined,
      isLeaf: !node.isDirectory
    }))
  }

  if (loading) return <Spin />
  if (!skill) return <div>技能不存在</div>

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/skills')}>返回列表</Button>
      </div>

      <Card title={skill.displayName} extra={
        skill.status === 'pending' && (
          <Space>
            <Button type="primary" icon={<CheckOutlined />} onClick={() => handleReview('approved')}>通过</Button>
            <Button danger icon={<CloseOutlined />} onClick={() => handleReview('rejected')}>拒绝</Button>
          </Space>
        )
      }>
        <Descriptions column={2}>
          <Descriptions.Item label="名称">{skill.name}</Descriptions.Item>
          <Descriptions.Item label="Slug">{skill.slug}</Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={statusColors[skill.status]}>{statusLabels[skill.status] || skill.status}</Tag></Descriptions.Item>
          <Descriptions.Item label="版本">{skill.version}</Descriptions.Item>
          <Descriptions.Item label="分类">{skill.categoryName || '-'}</Descriptions.Item>
          <Descriptions.Item label="作者">{skill.authorName || '-'}</Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>{skill.description || '-'}</Descriptions.Item>
          {skill.rejectReason && <Descriptions.Item label="拒绝原因" span={2}>{skill.rejectReason}</Descriptions.Item>}
        </Descriptions>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Row gutter={24}>
          <Col span={6}><Statistic title="下载量" value={skill.downloadCount} /></Col>
          <Col span={6}><Statistic title="收藏数" value={skill.favoriteCount} /></Col>
          <Col span={6}><Statistic title="评分" value={skill.averageRating} suffix={`/ 5 (${skill.ratingCount} 评价)`} /></Col>
          <Col span={6}><Statistic title="更新时间" value={new Date(skill.updatedAt).toLocaleDateString()} /></Col>
        </Row>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Tabs items={[
          {
            key: 'files',
            label: '文件预览',
            children: (
              <div style={{ display: 'flex', gap: 16, minHeight: 400 }}>
                <div style={{ width: 250, borderRight: '1px solid #f0f0f0', paddingRight: 16 }}>
                  <Tree
                    showIcon
                    treeData={renderFileTree(fileTree)}
                    onSelect={(keys) => {
                      if (keys.length > 0 && typeof keys[0] === 'string') {
                        handleFileSelect(keys[0])
                      }
                    }}
                  />
                </div>
                <div style={{ flex: 1, overflow: 'auto' }}>
                  {selectedFile ? (
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12 }}>{fileContent}</pre>
                  ) : (
                    <div style={{ color: '#999' }}>请选择文件查看内容</div>
                  )}
                </div>
              </div>
            )
          }
        ]} />
      </Card>

      <Modal title="审核技能" open={reviewModal} onOk={submitReview} onCancel={() => setReviewModal(false)}>
        <Form form={reviewForm} layout="vertical">
          <Form.Item name="status" label="审核结果" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="approved">通过</Select.Option>
              <Select.Option value="rejected">拒绝</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="rejectReason" label="拒绝原因" rules={[{ required: true, message: '拒绝时必填' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SkillDetail
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/pages/admin/SkillDetail.tsx
git commit -m "feat(frontend): add skill detail page"
```

---

## Task 7: 前端 - 添加详情页路由

**Files:**
- Modify: `packages/frontend/src/App.tsx`

- [ ] **Step 1: 导入详情页组件**

在文件顶部 import 区域添加：

```typescript
import SkillDetail from './pages/admin/SkillDetail'
```

- [ ] **Step 2: 添加路由配置**

在 `/admin/skills/categories` 路由之前添加：

```typescript
<Route path="skills/:id" element={<SkillDetail />} />
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/App.tsx
git commit -m "feat(frontend): add skill detail route"
```

---

## Task 8: 前端 - 增强技能列表页

**Files:**
- Modify: `packages/frontend/src/pages/admin/Skills.tsx`

- [ ] **Step 1: 添加分类筛选和批量操作**

完整替换文件内容：

```typescript
import { useState, useEffect } from 'react'
import { Table, Tag, Button, Modal, Form, Select, Input, message, Tabs, Space, Popconfirm, Card } from 'antd'
import { getAdminSkills, getAdminSkillCategories, reviewSkill, batchReviewSkills, batchDeleteSkills, type Skill, type SkillCategory } from '../../services/api'
import { useNavigate } from 'react-router-dom'

const statusColors: Record<string, string> = { pending: 'orange', approved: 'green', rejected: 'red', unpublished: 'default' }
const statusLabels: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已拒绝', unpublished: '已下架' }

function AdminSkills() {
  const navigate = useNavigate()
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [categories, setCategories] = useState<SkillCategory[]>([])
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>()
  const [searchText, setSearchText] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [reviewModal, setReviewModal] = useState(false)
  const [currentSkill, setCurrentSkill] = useState<Skill | null>(null)
  const [reviewForm] = Form.useForm()
  const [batchModal, setBatchModal] = useState(false)
  const [batchForm] = Form.useForm()

  const fetchCategories = async () => {
    try {
      const cats = await getAdminSkillCategories()
      setCategories(cats)
    } catch {
      // ignore
    }
  }

  const fetchSkills = async (p: number, status: string, categoryId?: number, search?: string) => {
    setLoading(true)
    try {
      const result = await getAdminSkills({ 
        page: p, 
        pageSize: 20, 
        status: status || undefined, 
        search: search || undefined 
      })
      let items = result.items
      if (categoryId) {
        items = items.filter(s => s.categoryId === categoryId)
      }
      setSkills(items)
      setTotal(categoryId ? items.length : result.total)
    } catch {
      message.error('加载技能列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchSkills(page, statusFilter, categoryFilter, searchText)
    setSelectedRowKeys([])
  }, [page, statusFilter, categoryFilter])

  const handleSearch = () => {
    setPage(1)
    fetchSkills(1, statusFilter, categoryFilter, searchText)
  }

  const handleReview = (skill: Skill, status: 'approved' | 'rejected') => {
    setCurrentSkill(skill)
    reviewForm.setFieldsValue({ status, name: skill.name, displayName: skill.displayName })
    setReviewModal(true)
  }

  const submitReview = async () => {
    if (!currentSkill) return
    try {
      const values = await reviewForm.validateFields()
      await reviewSkill(currentSkill.id, values)
      message.success('审核完成')
      setReviewModal(false)
      fetchSkills(page, statusFilter, categoryFilter, searchText)
    } catch {
      message.error('审核失败')
    }
  }

  const handleBatchReview = (status: 'approved' | 'rejected') => {
    batchForm.setFieldsValue({ status })
    setBatchModal(true)
  }

  const submitBatchReview = async () => {
    try {
      const values = await batchForm.validateFields()
      await batchReviewSkills(selectedRowKeys, values.status, values.rejectReason)
      message.success(`已处理 ${selectedRowKeys.length} 个技能`)
      setBatchModal(false)
      setSelectedRowKeys([])
      fetchSkills(page, statusFilter, categoryFilter, searchText)
    } catch {
      message.error('批量操作失败')
    }
  }

  const handleBatchDelete = async () => {
    try {
      await batchDeleteSkills(selectedRowKeys)
      message.success(`已删除 ${selectedRowKeys.length} 个技能`)
      setSelectedRowKeys([])
      fetchSkills(page, statusFilter, categoryFilter, searchText)
    } catch {
      message.error('批量删除失败')
    }
  }

  const columns = [
    { title: '名称', dataIndex: 'displayName', key: 'name' },
    { title: 'Slug', dataIndex: 'slug', key: 'slug' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s] || s}</Tag> },
    { title: '下载量', dataIndex: 'downloadCount', key: 'downloadCount' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => new Date(v).toLocaleDateString() },
    {
      title: '操作', key: 'action',
      render: (_: unknown, record: Skill) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/admin/skills/${record.id}`)}>详情</Button>
          {record.status === 'pending' && (
            <>
              <Button size="small" type="primary" onClick={() => handleReview(record, 'approved')}>通过</Button>
              <Button size="small" danger onClick={() => handleReview(record, 'rejected')}>拒绝</Button>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="搜索技能名称"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 200 }}
          />
          <Select
            placeholder="分类筛选"
            allowClear
            value={categoryFilter}
            onChange={setCategoryFilter}
            style={{ width: 150 }}
            options={categories.map(c => ({ value: c.id, label: c.name }))}
          />
        </Space>

        <Tabs activeKey={statusFilter} onChange={key => { setStatusFilter(key); setPage(1) }} items={[
          { key: 'pending', label: '待审核' },
          { key: 'approved', label: '已通过' },
          { key: 'rejected', label: '已拒绝' },
          { key: '', label: '全部' },
        ]} />

        {selectedRowKeys.length > 0 && (
          <Card size="small" style={{ marginBottom: 16, background: '#f5f5f5' }}>
            <Space>
              <span>已选择 {selectedRowKeys.length} 项</span>
              <Button size="small" type="primary" onClick={() => handleBatchReview('approved')}>批量通过</Button>
              <Button size="small" danger onClick={() => handleBatchReview('rejected')}>批量拒绝</Button>
              <Popconfirm title="确定删除选中的技能吗？" onConfirm={handleBatchDelete}>
                <Button size="small" danger>批量删除</Button>
              </Popconfirm>
              <Button size="small" onClick={() => setSelectedRowKeys([])}>取消选择</Button>
            </Space>
          </Card>
        )}

        <Table
          dataSource={skills}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[])
          }}
        />
      </Card>

      <Modal title={currentSkill?.status === 'pending' ? '审核技能' : '编辑技能'} open={reviewModal} onOk={submitReview} onCancel={() => setReviewModal(false)}>
        <Form form={reviewForm} layout="vertical">
          <Form.Item name="status" label="审核结果">
            <Select>
              <Select.Option value="approved">通过</Select.Option>
              <Select.Option value="rejected">拒绝</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="rejectReason" label="拒绝原因（拒绝时填写）">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="批量审核" open={batchModal} onOk={submitBatchReview} onCancel={() => setBatchModal(false)}>
        <Form form={batchForm} layout="vertical">
          <Form.Item name="status" label="审核结果" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="approved">通过</Select.Option>
              <Select.Option value="rejected">拒绝</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="rejectReason" label="拒绝原因">
            <Input.TextArea rows={3} placeholder="拒绝时建议填写原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AdminSkills
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/pages/admin/Skills.tsx
git commit -m "feat(frontend): enhance skill list with filters and batch operations"
```

---

## Task 9: 测试验证

- [ ] **Step 1: 启动后端服务**

```bash
cd packages/backend
npm run dev
```

- [ ] **Step 2: 启动前端服务**

```bash
cd packages/frontend
npm run dev
```

- [ ] **Step 3: 验证功能**

1. 登录管理员账号
2. 侧边栏应显示"技能管理"菜单
3. 进入技能列表页，验证筛选功能
4. 选择多个技能，验证批量操作
5. 点击详情按钮，进入详情页
6. 验证文件树和文件预览功能
7. 验证审核功能

- [ ] **Step 4: Final Commit**

```bash
git add -A
git commit -m "feat: complete skill management page implementation"
```
