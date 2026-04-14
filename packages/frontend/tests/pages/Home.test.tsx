import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from '../../src/pages/Home'

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

const mockCopy = vi.hoisted(() => vi.fn())
vi.mock('copy-to-clipboard', () => ({
  default: mockCopy,
}))

const originalLocation = window.location
delete (window as any).location
window.location = {
  ...originalLocation,
  origin: 'http://localhost:3000',
} as Location

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const localStorageMock = (() => {
  let store: Record<string, string> = {
    'opencode_token': 'test-token',
  }
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

const renderHome = (initialPath = '/assistants/default') => {
  const searchParams = initialPath.includes('?') ? '' : ''
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Home />
    </MemoryRouter>
  )
}

describe('Home - handleCopyLink', () => {
  let mockMessageSuccess: ReturnType<typeof vi.fn>
  let mockMessageError: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    const { message } = await import('antd')
    mockMessageSuccess = message.success as ReturnType<typeof vi.fn>
    mockMessageError = message.error as ReturnType<typeof vi.fn>
    
    vi.clearAllMocks()
    mockCopy.mockClear()
    mockFetch.mockClear()
    
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/sessions/test-session-id')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-session-id',
            title: 'Test Session',
            status: 'active',
            assistantId: 'test-assistant-id',
            assistantSlug: 'default',
            messages: [],
          }),
        })
      }
      if (url.includes('/api/assistants')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'test-assistant-id', name: 'Default', slug: 'default' }
          ]),
        })
      }
      if (url.includes('/api/messages/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        })
      }
      if (url.includes('/api/sessions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        })
      }
      if (url.includes('/api/settings/public')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should copy session link to clipboard successfully', async () => {
    mockCopy.mockReturnValue(true)
    
    renderHome('/assistants/default?sessionId=test-session-id')
    
    const copyButton = await screen.findByRole('button', { name: /复制链接/i }, { timeout: 5000 })
    fireEvent.click(copyButton)
    
    await waitFor(() => {
      expect(mockCopy).toHaveBeenCalledWith('http://localhost:3000/session/test-session-id')
      expect(mockMessageSuccess).toHaveBeenCalledWith('会话链接已复制')
    })
  })

  it('should show error message when clipboard write fails', async () => {
    mockCopy.mockReturnValue(false)
    
    renderHome('/assistants/default?sessionId=test-session-id')
    
    const copyButton = await screen.findByRole('button', { name: /复制链接/i }, { timeout: 5000 })
    fireEvent.click(copyButton)
    
    await waitFor(() => {
      expect(mockCopy).toHaveBeenCalled()
      expect(mockMessageError).toHaveBeenCalledWith('复制失败，请重试')
      expect(mockMessageSuccess).not.toHaveBeenCalled()
    })
  })

  it('should not attempt to copy if no sessionId', async () => {
    renderHome('/assistants/default')
    
    await waitFor(() => {
      const copyButton = screen.queryByRole('button', { name: /复制链接/i })
      expect(copyButton).toBeNull()
      expect(mockCopy).not.toHaveBeenCalled()
    })
  })
})
