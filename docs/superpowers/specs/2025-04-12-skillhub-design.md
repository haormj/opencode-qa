# SkillHub 设计文档

## 概述

在现有 opencode-qa 系统中集成 SkillHub 模块，为用户提供 AI Skills 社区功能，包括技能浏览/发现、技能详情、技能发布与审核、评分收藏统计。

## 定位

- 集成到现有系统，共享用户体系、JWT 认证、SQLite 数据库、Ant Design UI
- 数据来源为纯用户自创发布
- 技能内容格式为 SKILL.md（YAML frontmatter + 正文）
- 发布流程需管理员审核，审核时可编辑元信息
- 安装方式为复制命令

## 数据模型

### skills 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | text (PK) | UUID |
| name | text (unique) | 技能名称，如 self-improving-agent |
| displayName | text | 展示名称 |
| slug | text (unique) | URL 友好标识 |
| description | text | 简短描述 |
| content | text | SKILL.md 完整内容 |
| categoryId | integer (FK) | 所属分类 |
| authorId | text (FK → users) | 发布者 |
| version | text | 版本号，如 1.0.0 |
| icon | text | 图标 URL 或 emoji |
| tags | text | JSON 数组，标签 |
| installCommand | text | 安装命令 |
| status | text | pending / approved / rejected |
| downloadCount | integer | 下载量，默认 0 |
| favoriteCount | integer | 收藏数，默认 0 |
| averageRating | real | 平均评分，默认 0 |
| ratingCount | integer | 评分人数，默认 0 |
| rejectReason | text | 拒绝原因 |
| createdAt | timestamp | 创建时间 |
| updatedAt | timestamp | 更新时间 |

### skill_categories 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer (PK, auto) | 分类 ID |
| name | text | 分类名 |
| slug | text (unique) | URL slug |
| icon | text | 分类图标 |
| sortOrder | integer | 排序权重 |

初始分类（参照 skillhub.cn）：

1. AI增强 (ai-enhancement)
2. 工具 (tools)
3. 开发工具 (dev-tools)
4. 搜索研究 (search-research)
5. 知识管理 (knowledge-management)
6. 信息处理 (information-processing)
7. 浏览器自动化 (browser-automation)
8. 办公协同 (office-collaboration)
9. 垂直场景 (vertical-scenarios)
10. 多媒体 (multimedia)
11. 数据分析 (data-analysis)
12. 自动化 (automation)

### skill_favorites 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer (PK, auto) | 自增 ID |
| userId | text (FK → users) | 用户 ID |
| skillId | text (FK → skills) | 技能 ID |
| createdAt | timestamp | 收藏时间 |

唯一约束：(userId, skillId)

### skill_ratings 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer (PK, auto) | 自增 ID |
| userId | text (FK → users) | 用户 ID |
| skillId | text (FK → skills) | 技能 ID |
| score | integer | 评分 1-5 |
| review | text | 评价内容（可选） |
| createdAt | timestamp | 评分时间 |

唯一约束：(userId, skillId)

## API 路由

### 公开 API（需登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/skills | 技能列表，支持分页、分类筛选、搜索、排序 |
| GET | /api/skills/trending | 热榜推荐 |
| GET | /api/skills/categories | 所有分类 |
| GET | /api/skills/:slug | 技能详情 |
| POST | /api/skills | 发布新技能 |
| PUT | /api/skills/:id | 更新自己发布的技能（被拒绝的技能编辑后重新提交审核，status 重置为 pending） |
| POST | /api/skills/:id/favorite | 收藏/取消收藏 |
| POST | /api/skills/:id/rate | 评分 |
| POST | /api/skills/:id/download | 记录下载 |
| GET | /api/skills/my/published | 我发布的技能 |
| GET | /api/skills/my/favorites | 我收藏的技能 |

GET /api/skills 查询参数：
- page: 页码（默认 1）
- pageSize: 每页数量（默认 20）
- category: 分类 slug 筛选
- search: 搜索关键词（匹配名称、描述、标签）
- sort: 排序方式 - trending / newest / downloads / rating

### 管理 API（需管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/skills | 所有技能（含待审核） |
| PUT | /api/admin/skills/:id/review | 审核通过/拒绝 + 可编辑元信息 |
| PUT | /api/admin/skills/:id | 编辑技能信息 |
| DELETE | /api/admin/skills/:id | 删除技能 |
| GET | /api/admin/skills/categories | 分类管理列表 |
| POST | /api/admin/skills/categories | 创建分类 |
| PUT | /api/admin/skills/categories/:id | 编辑分类 |
| DELETE | /api/admin/skills/categories/:id | 删除分类 |

## 前端页面设计

### 导航入口

在 AssistantSelector（智能助手）右侧新增"技能市场"按钮。点击后：
- 侧边栏从会话列表切换为技能导航
- 主内容区切换为对应技能页面
- 点击"智能助手"可切回对话模式

### 侧边栏技能模式内容

- 技能市场（热榜/发现）
- 我的技能
- 我的收藏
- 发布技能

### 用户端页面

1. **技能市场首页** (`/skills`)
   - 搜索框
   - 热榜技能卡片列表（名称、图标、分类、下载量、收藏数）
   - 分类筛选标签
   - 排序切换（热榜/最新/下载量/评分）

2. **技能详情页** (`/skills/:slug`)
   - 技能基本信息（名称、作者、版本、分类、标签）
   - SKILL.md 内容渲染（Markdown 渲染）
   - 安装命令（可复制）
   - 评分组件（1-5 星 + 评价内容）
   - 收藏按钮
   - 下载量/收藏数统计

3. **发布技能页** (`/skills/publish`)
   - 表单：名称、展示名称、分类、标签、简短描述
   - SKILL.md 内容编辑（代码编辑器）
   - 版本号、安装命令
   - 图标（emoji 选择或 URL）
   - 提交审核按钮

4. **我的技能** (`/skills/my/published`)
   - 我发布的技能列表，显示审核状态
   - 状态标签：待审核/已通过/已拒绝（附拒绝原因）

5. **我的收藏** (`/skills/my/favorites`)
   - 收藏的技能列表，可取消收藏

### 管理端页面

1. **技能审核** (`/admin/skills`)
   - 待审核技能列表（默认筛选 pending）
   - 审核操作：通过/拒绝 + 拒绝原因
   - 审核时可编辑元信息（分类、标签、展示名称等）

2. **分类管理** (`/admin/skills/categories`)
   - 分类列表（增删改排序）

## 技术实现要点

### 后端

- 新增路由文件：`packages/backend/src/routes/skill.ts`、`packages/backend/src/routes/admin-skill.ts`
- 新增服务文件：`packages/backend/src/services/skill.ts`
- 修改 `packages/backend/src/db/schema.ts` 新增 4 张表和关联关系
- 修改 `packages/backend/src/index.ts` 注册新路由
- 修改 `packages/backend/src/db/seed.ts` 添加分类种子数据
- 生成迁移文件：`npm run db:generate`

### 前端

- 新增页面组件：`packages/frontend/src/pages/skills/` 目录
  - `Market.tsx` - 技能市场首页
  - `Detail.tsx` - 技能详情
  - `Publish.tsx` - 发布技能
  - `MySkills.tsx` - 我的技能
  - `MyFavorites.tsx` - 我的收藏
- 新增管理页面：`packages/frontend/src/pages/admin/Skills.tsx`、`SkillCategories.tsx`
- 修改 `Sidebar` 组件：新增技能模式侧边栏内容
- 修改 `AssistantSelector`：新增"技能市场"按钮
- 修改 `App.tsx`：新增技能相关路由
- 修改 `api.ts`：新增技能相关 API 调用