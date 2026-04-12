# 技能存储结构重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 简化技能文件存储结构，从多版本目录改为 current/pending 两目录设计。

**Architecture:** 文件存储改为 `current/`（正式版本）和 `pending/`（待审核版本）。数据库保留 skillVersions 表用于 changelog 记录，但不再作为文件查找依据。

**Tech Stack:** Node.js, fs/promises, Drizzle ORM

---

## 新目录结构

```
data/skills/
├── {slug}/
│   ├── current/    # 当前正式版本（用户下载的）
│   └── pending/    # 待审核版本（审核通过后替换 current）
```

---

## Task 1: 重构 skill-file.ts 存储函数

**Files:**
- Modify: `packages/backend/src/services/skill-file.ts`

- [ ] **Step 1: 添加新的路径函数**

```typescript
export function getCurrentPath(slug: string): string {
  return path.join(SKILLS_DIR, slug, 'current')
}

export function getPendingPath(slug: string): string {
  return path.join(SKILLS_DIR, slug, 'pending')
}
```

- [ ] **Step 2: 修改 saveSkillFiles 函数**

保存到 pending，先删除整个 pending 目录确保无残留。

- [ ] **Step 3: 添加 approvePendingFiles 函数**

审核通过后，pending 替换 current。

- [ ] **Step 4: 添加 deletePendingFiles 函数**

审核拒绝时删除 pending。

- [ ] **Step 5: 添加 readSkillFileFromLocation 函数**

从 current 或 pending 读取文件。

- [ ] **Step 6: 修改 getSkillFileTree 函数**

支持从 current 或 pending 获取文件树。

- [ ] **Step 7: 修改 createSkillZip 函数**

支持从 current 或 pending 创建 zip。

- [ ] **Step 8: Commit**

```bash
git commit -m "refactor(backend): redesign skill storage with current/pending directories"
```

---

## Task 2: 调整 skill.ts 服务

**Files:**
- Modify: `packages/backend/src/services/skill.ts`

- [ ] **Step 1: 修改 createSkill**

文件保存到 pending。

- [ ] **Step 2: 修改 createSkillVersion**

文件保存到 pending。

- [ ] **Step 3: 修改 approveSkillVersion**

调用 approvePendingFiles 替换 current。

- [ ] **Step 4: 修改 rejectSkillVersion**

调用 deletePendingFiles 删除 pending。

- [ ] **Step 5: 修改 getSkillBySlug**

从 current 或 pending 读取 readme。

- [ ] **Step 6: Commit**

```bash
git commit -m "refactor(backend): update skill service for new storage structure"
```

---

## Task 3: 调整 skill.ts 路由

**Files:**
- Modify: `packages/backend/src/routes/skill.ts`

- [ ] **Step 1: 修改下载路由**

从 current 下载。

- [ ] **Step 2: 修改文件树路由**

根据状态选择 current 或 pending。

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(backend): update skill routes for new storage structure"
```

---

## Task 4: 调整 admin-skill.ts 路由

**Files:**
- Modify: `packages/backend/src/routes/admin-skill.ts`

- [ ] **Step 1: 修改文件预览路由**

管理员预览时，有 pending 看 pending，否则看 current。

- [ ] **Step 2: Commit**

```bash
git commit -m "refactor(backend): update admin skill routes for new storage structure"
```

---

## Task 5: 数据迁移

- [ ] **Step 1: 编写迁移脚本**

将现有版本目录迁移为 current/pending 结构。

- [ ] **Step 2: Commit**

---

## Task 6: 测试验证

- [ ] 类型检查
- [ ] 运行测试
- [ ] 手动测试创建、审核、下载流程
