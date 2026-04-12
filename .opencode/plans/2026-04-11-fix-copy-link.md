# 修复复制会话链接功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复复制会话链接功能，确保链接正确复制到剪贴板，并在失败时给用户明确的错误提示

**Architecture:** 在 `handleCopyLink` 函数中正确处理 Promise，添加 try-catch 错误处理，确保只有在真正复制成功时才显示成功消息

**Tech Stack:** React, TypeScript, Vitest, navigator.clipboard API

---

## File Structure

**修改的文件：**
- `packages/frontend/src/pages/Home.tsx` - 修复 handleCopyLink 函数

**创建的文件：**
- `packages/frontend/tests/pages/Home.test.tsx` - 新增测试文件

---

## Task 1: 编写失败的测试用例

**Files:**
- Create: `packages/frontend/tests/pages/Home.test.tsx`

- [ ] **Step 1: 创建测试文件并编写失败的测试**

创建 `packages/frontend/tests/pages/Home.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Home from '../../src/pages/Home'

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
    },
  }
})

// Mock window.navigator.clipboard
const mockClipboardWrite = vi.fn()
Object.assign(navigator, {
  clipboard: {
    writeText: mockClipboardWrite,
  },
})

// Mock window.location
const originalLocation = window.location
delete (window as any).location
window.location = {
  ...originalLocation,
  origin: 'http://localhost:3000',
  search: '?sessionId=test-session-id',
} as Location

const renderHome = () => {
  return render(
    <BrowserRouter>
      <Home />
    </BrowserRouter>
  )
}

describe('Home - handleCopyLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClipboardWrite.mockClear()
  })

  it('should copy session link to clipboard successfully', async () => {
    mockClipboardWrite.mockResolvedValueOnce(undefined)
    
    renderHome()
    
    // 找到复制链接按钮
    const copyButton = await screen.findByRole('button', { name: /复制链接/i })
    fireEvent.click(copyButton)
    
    await waitFor(() => {
      const { message } = require('antd')
      expect(mockClipboardWrite).toHaveBeenCalledWith('http://localhost:3000/session/test-session-id')
      expect(message.success).toHaveBeenCalledWith('会话链接已复制')
    })
  })

  it('should show error message when clipboard write fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockClipboardWrite.mockRejectedValueOnce(new Error('Permission denied'))
    
    renderHome()
    
    const copyButton = await screen.findByRole('button', { name: /复制链接/i })
    fireEvent.click(copyButton)
    
    await waitFor(() => {
      const { message } = require('antd')
      expect(mockClipboardWrite).toHaveBeenCalled()
      expect(message.error).toHaveBeenCalledWith('复制失败，请重试')
      expect(message.success).not.toHaveBeenCalled()
    })
    
    consoleErrorSpy.mockRestore()
  })

  it('should not attempt to copy if no sessionId', async () => {
    // 清除 sessionId
    window.location = {
      ...originalLocation,
      origin: 'http://localhost:3000',
      search: '',
    } as Location
    
    renderHome()
    
    // 复制按钮应该不存在或禁用
    const copyButton = screen.queryByRole('button', { name: /复制链接/i })
    
    await waitFor(() => {
      expect(copyButton).toBeNull()
      expect(mockClipboardWrite).not.toHaveBeenCalled()
    })
    
    // 恢复 location
    window.location = {
      ...originalLocation,
      origin: 'http://localhost:3000',
      search: '?sessionId=test-session-id',
    } as Location
  })
})
```

- [ ] **Step 2: 安装测试依赖（如果需要）**

检查 `packages/frontend/package.json` 是否已安装 `@testing-library/react` 和 `@testing-library/user-event`：

```bash
cd packages/frontend
npm list @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

如果未安装，运行：

```bash
cd packages/frontend
npm install --save-dev @testing-library/react @testing-library/user-event
```

- [ ] **Step 3: 运行测试确认失败**

运行：

```bash
cd packages/frontend
npm run test tests/pages/Home.test.tsx
```

预期结果：测试失败，因为 `handleCopyLink` 函数没有正确处理 Promise

---

## Task 2: 修复 handleCopyLink 实现

**Files:**
- Modify: `packages/frontend/src/pages/Home.tsx:294-299`

- [ ] **Step 1: 修改 handleCopyLink 函数**

打开 `packages/frontend/src/pages/Home.tsx`，找到第 294-299 行的 `handleCopyLink` 函数，替换为：

```typescript
const handleCopyLink = useCallback(async () => {
  if (!sessionId) return
  const link = `${window.location.origin}/session/${sessionId}`
  try {
    await navigator.clipboard.writeText(link)
    message.success('会话链接已复制')
  } catch (error) {
    console.error('复制链接失败:', error)
    message.error('复制失败，请重试')
  }
}, [sessionId])
```

**修改说明：**
1. 添加 `async` 关键字使函数成为异步函数
2. 使用 `await` 等待 `navigator.clipboard.writeText()` Promise 完成
3. 添加 `try-catch` 错误处理
4. 只有在 Promise 成功 resolve 时才显示成功消息
5. 在 catch 块中记录错误并显示错误消息

- [ ] **Step 2: 运行测试确认通过**

运行：

```bash
cd packages/frontend
npm run test tests/pages/Home.test.tsx
```

预期结果：所有测试通过

---

## Task 3: 手动测试验证

- [ ] **Step 1: 启动开发服务器**

运行：

```bash
npm run dev
```

- [ ] **Step 2: 测试正常复制场景**

1. 打开浏览器访问 http://localhost:3000
2. 创建一个新会话或选择现有会话
3. 点击"复制链接"按钮
4. 验证：
   - 看到"会话链接已复制"成功提示
   - 在浏览器地址栏粘贴，确认链接正确（格式：`http://localhost:3000/session/<sessionId>`）

- [ ] **Step 3: 测试错误场景（可选）**

1. 打开浏览器开发者工具 (F12)
2. 在 Console 中运行：`Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('Mock error')) } })`
3. 点击"复制链接"按钮
4. 验证：
   - 看到"复制失败，请重试"错误提示
   - Console 中有错误日志

- [ ] **Step 4: 清理并提交**

如果测试通过，准备提交：

```bash
git status
git add packages/frontend/src/pages/Home.tsx packages/frontend/tests/pages/Home.test.tsx
git commit -m "fix: 修复复制会话链接功能

- 修复 handleCopyLink 函数未正确等待 Promise 的问题
- 添加错误处理，在复制失败时显示错误消息
- 添加单元测试覆盖成功和失败场景"
```

---

## Verification Checklist

实施完成后，验证以下内容：

- [ ] 单元测试全部通过
- [ ] 手动测试成功复制场景正常工作
- [ ] 错误场景显示正确的错误提示
- [ ] 没有 TypeScript 类型错误
- [ ] 代码符合项目规范（无 console.log，适当的错误处理）

---

## Notes

1. **浏览器兼容性：** `navigator.clipboard` API 需要安全上下文（HTTPS 或 localhost）
2. **权限：** 某些浏览器可能需要用户授权才能访问剪贴板
3. **用户交互：** 剪贴板 API 需要在用户交互（如点击）的上下文中调用
4. **降级方案：** 如果需要支持旧浏览器，可以考虑使用 `document.execCommand('copy')` 作为降级方案
