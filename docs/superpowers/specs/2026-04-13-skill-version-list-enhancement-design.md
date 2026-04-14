# 技能版本列表功能增强设计

## 概述

为用户侧技能版本列表增加以下功能：
1. 显示 slug（可点击）和显示名
2. 新增草稿状态，支持提交审核和取消操作
3. 约束同一技能只能有一个非终态版本

## 状态流转

```
创建版本 → draft（草稿）
    ↓ 提交审核
pending（待审核）
    ↓ 审核通过          ↓ 审核拒绝         ↓ 取消
approved（已通过）  rejected（已拒绝）  → draft（草稿）
```

## API 设计

### 新增端点

| 方法 | 端点 | 功能 | 状态变更 |
|-----|------|------|---------|
| PUT | `/api/skills/my/versions/:versionId/submit` | 提交审核 | draft → pending |
| PUT | `/api/skills/my/versions/:versionId/cancel` | 取消审核 | pending → draft |

### 修改端点

| 方法 | 端点 | 变更 |
|-----|------|------|
| PUT | `/api/skills/:id` | 新增 `status` 参数，支持创建时指定状态（draft/pending） |

## 业务约束

1. 创建版本时检查是否已有非终态版本（draft/pending），如有则拒绝创建
2. 提交审核时检查版本状态必须为 draft
3. 取消审核时检查版本状态必须为 pending

## 前端变更

### 版本列表页面 (MySkillVersions.tsx)

- 新增列：slug（链接到 `/skills/my/versions/:versionId`）、显示名
- 新增操作列：提交审核/取消按钮
- 筛选增加"草稿"选项

### 创建版本页面 (Update.tsx)

- 提交时弹窗选择：保存为草稿 / 直接提交审核

## 文件影响范围

| 文件 | 变更内容 |
|-----|---------|
| `packages/backend/src/routes/skill.ts` | 新增提交/取消审核端点 |
| `packages/backend/src/services/skill.ts` | 新增提交/取消审核逻辑，创建版本时增加约束检查 |
| `packages/frontend/src/pages/skills/MySkillVersions.tsx` | 新增列、操作按钮、筛选 |
| `packages/frontend/src/pages/skills/Update.tsx` | 提交时弹窗选择 |
| `packages/frontend/src/services/api.ts` | 新增 API 方法 |

## 实现步骤

1. 后端：新增提交审核 API
2. 后端：新增取消审核 API
3. 后端：修改创建版本逻辑，增加非终态版本检查，支持 status 参数
4. 前端：API 客户端新增方法
5. 前端：版本列表页面新增列和操作
6. 前端：创建版本页面弹窗选择
