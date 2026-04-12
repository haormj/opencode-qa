# 技能管理页面设计方案

## 概述

为后台添加完整的技能管理功能，包括：
- 侧边栏菜单入口
- 技能列表页（高级筛选 + 批量操作）
- 技能详情页（详情查看 + 文件预览 + 审核）

## 路由设计

| 路径 | 页面 | 说明 |
|------|------|------|
| `/admin/skills` | Skills.tsx | 技能列表页 |
| `/admin/skills/:id` | SkillDetail.tsx | 技能详情页（新建） |
| `/admin/skills/categories` | SkillCategories.tsx | 分类管理（已有） |

## 前端实现

### 1. 侧边栏菜单

**文件**: `packages/frontend/src/components/AdminSidebar/index.tsx`

在菜单中添加"技能管理"入口，使用 `ToolOutlined` 图标，位于"助手管理"下方。

```typescript
{
  key: '/admin/skills',
  icon: <ToolOutlined />,
  label: '技能管理'
}
```

### 2. 技能列表页增强

**文件**: `packages/frontend/src/pages/admin/Skills.tsx`

#### 2.1 高级筛选

| 筛选项 | 组件 | 数据来源 |
|--------|------|----------|
| 状态 | Tabs（已有） | - |
| 分类 | Select | `getAdminSkillCategories()` |
| 作者 | Input.Search | 前端搜索 |
| 时间范围 | DatePicker.RangePicker | - |

#### 2.2 批量操作

- 表格添加多选列（`rowSelection`）
- 底部浮动操作栏（选中时显示）
- 操作：批量通过、批量拒绝、批量删除

#### 2.3 操作列

- 待审核状态：通过、拒绝、查看详情
- 已通过状态：查看详情、下架
- 已拒绝状态：查看详情、删除

### 3. 技能详情页

**文件**: `packages/frontend/src/pages/admin/SkillDetail.tsx`（新建）

#### 3.1 页面布局

```
┌─────────────────────────────────────────────────┐
│ 返回按钮  技能名称                    [审核按钮] │
├─────────────────────────────────────────────────┤
│ 基本信息卡片                                     │
│ - 名称、展示名称、Slug                           │
│ - 描述、分类                                     │
│ - 作者、创建时间、更新时间                       │
├─────────────────────────────────────────────────┤
│ 统计信息卡片                                     │
│ - 下载量、收藏数、评分、版本数                   │
├─────────────────────────────────────────────────┤
│ 版本历史 Tab                                     │
│ - 版本列表（可点击切换）                         │
├─────────────────────────────────────────────────┤
│ 文件预览 Tab                                     │
│ ┌──────────┬──────────────────────────────────┐ │
│ │ 文件树   │ 文件内容预览                      │ │
│ │          │ （代码高亮）                       │ │
│ └──────────┴──────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

#### 3.2 审核功能

- 状态为 pending 时显示审核按钮
- Modal 确认，通过/拒绝选项
- 拒绝时必填拒绝原因

### 4. API 函数

**文件**: `packages/frontend/src/services/api.ts`

```typescript
// 获取技能详情（管理员）
export async function getAdminSkillById(id: string): Promise<SkillDetail>

// 获取技能文件树
export async function getSkillFiles(skillId: string, version?: string): Promise<FileTreeNode[]>

// 获取技能文件内容
export async function getSkillFileContent(skillId: string, filePath: string, version?: string): Promise<string>

// 批量审核技能
export async function batchReviewSkills(ids: string[], status: 'approved' | 'rejected', rejectReason?: string): Promise<{ success: boolean }>

// 批量删除技能
export async function batchDeleteSkills(ids: string[]): Promise<{ success: boolean }>
```

## 后端实现

### 1. 新增 API

**文件**: `packages/backend/src/routes/admin-skill.ts`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/skills/:id` | 按 ID 获取技能详情 |
| GET | `/admin/skills/:id/files` | 获取技能文件树 |
| GET | `/admin/skills/:id/files/*` | 获取技能文件内容 |
| POST | `/admin/skills/batch-review` | 批量审核 |
| POST | `/admin/skills/batch-delete` | 批量删除 |

### 2. Service 层扩展

**文件**: `packages/backend/src/services/skill.ts`

```typescript
// 按 ID 获取技能详情（含作者、分类信息）
export async function getSkillDetailById(id: string): Promise<SkillDetail | null>

// 批量更新技能状态
export async function batchUpdateSkillStatus(ids: string[], status: string, rejectReason?: string): Promise<number>

// 批量删除技能
export async function batchDeleteSkills(ids: string[]): Promise<number>
```

### 3. 文件服务

已有 `skill-file.ts` 提供：
- `getSkillFileTree(slug, version)` - 获取文件树
- `readSkillFile(slug, version, path)` - 读取文件内容

## 数据模型

现有 schema 已满足需求，无需修改：
- `skills` - 技能主表
- `skillVersions` - 版本历史
- `skillCategories` - 分类

## 实现优先级

1. **P0 - 必须实现**
   - 侧边栏菜单入口
   - 技能详情页基本信息展示
   - 文件预览功能
   - 审核功能

2. **P1 - 应该实现**
   - 高级筛选（分类、作者）
   - 批量操作

3. **P2 - 可以延后**
   - 时间范围筛选
   - 代码高亮优化

## 验收标准

- [ ] 侧边栏显示"技能管理"菜单
- [ ] 列表页支持按分类、状态筛选
- [ ] 列表页支持批量选择和批量操作
- [ ] 详情页展示技能基本信息
- [ ] 详情页展示版本历史
- [ ] 详情页支持文件树导航和内容预览
- [ ] 详情页支持审核操作（通过/拒绝）
- [ ] 批量操作成功后列表自动刷新
