import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
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

const mockClipboardWrite = vi.fn()
vi.stubGlobal('navigator', {
  ...navigator,
  clipboard: {
    writeText: mockClipboardWrite,
  },
})

const originalLocation = window.location
delete (window as any).location
window.location = {
  ...originalLocation,
  origin: 'http://localhost:3000',
  search: '?sessionId=test-session-id',
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

const renderHome = () => {
  return render(
    <BrowserRouter>
      <Home />
    </BrowserRouter>
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
    mockClipboardWrite.mockClear()
    mockFetch.mockClear()
    
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/sessions/test-session-id')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-session-id',
            title: 'Test Session',
            status: 'active',
            messages: [],
          }),
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
    mockClipboardWrite.mockResolvedValueOnce(undefined)
    
    renderHome()
    
    const copyButton = await screen.findByRole('button', { name: /复制链接/i }, { timeout: 5000 })
    fireEvent.click(copyButton)
    
    await waitFor(() => {
      expect(mockClipboardWrite).toHaveBeenCalledWith('http://localhost:3000/session/test-session-id')
      expect(mockMessageSuccess).toHaveBeenCalledWith('会话链接已复制')
    })
  })

  it('should show error message when clipboard write fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockClipboardWrite.mockRejectedValueOnce(new Error('Permission denied'))
    
    renderHome()
    
    const copyButton = await screen.findByRole('button', { name: /复制链接/i }, { timeout: 5000 })
    fireEvent.click(copyButton)
    
    await waitFor(() => {
      expect(mockClipboardWrite).toHaveBeenCalled()
      expect(mockMessageError).toHaveBeenCalledWith('复制失败，请重试')
      expect(mockMessageSuccess).not.toHaveBeenCalled()
    })
    
    consoleErrorSpy.mockRestore()
  })

  it('should not attempt to copy if no sessionId', async () => {
    window.location = {
      ...originalLocation,
      origin: 'http://localhost:3000',
      search: '',
    } as Location
    
    renderHome()
    
    const copyButton = screen.queryByRole('button', { name: /复制链接/i })
    
    await waitFor(() => {
      expect(copyButton).toBeNull()
      expect(mockClipboardWrite).not.toHaveBeenCalled()
    })
    
    window.location = {
      ...originalLocation,
      origin: 'http://localhost:3000',
      search: '?sessionId=test-session-id',
    } as Location
  })
})
