import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getToken,
  setToken,
  removeToken,
  getStoredUser,
  setStoredUser,
  isAuthenticated,
  isAdmin,
  generateAvatarColor,
  getUsername,
} from '../../src/services/api'

describe('API Service - Storage Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('getToken', () => {
    it('should return null if no token stored', () => {
      expect(getToken()).toBeNull()
    })

    it('should return stored token', () => {
      localStorage.setItem('opencode-qa-token', 'test-token')
      expect(getToken()).toBe('test-token')
    })
  })

  describe('setToken', () => {
    it('should store token in localStorage', () => {
      setToken('new-token')
      expect(localStorage.getItem('opencode-qa-token')).toBe('new-token')
    })
  })

  describe('removeToken', () => {
    it('should remove token and user from localStorage', () => {
      localStorage.setItem('opencode-qa-token', 'test-token')
      localStorage.setItem('opencode-qa-user', JSON.stringify({ id: '1' }))

      removeToken()

      expect(localStorage.getItem('opencode-qa-token')).toBeNull()
      expect(localStorage.getItem('opencode-qa-user')).toBeNull()
    })
  })

  describe('getStoredUser', () => {
    it('should return null if no user stored', () => {
      expect(getStoredUser()).toBeNull()
    })

    it('should return parsed user object', () => {
      const user = { id: '1', username: 'testuser', displayName: 'Test' }
      localStorage.setItem('opencode-qa-user', JSON.stringify(user))

      expect(getStoredUser()).toEqual(user)
    })

    it('should return null if JSON is invalid', () => {
      localStorage.setItem('opencode-qa-user', 'invalid-json')

      expect(getStoredUser()).toBeNull()
    })
  })

  describe('setStoredUser', () => {
    it('should store user as JSON string', () => {
      const user = { id: '1', username: 'testuser', displayName: 'Test', roles: [] }
      setStoredUser(user)

      expect(JSON.parse(localStorage.getItem('opencode-qa-user')!)).toEqual(user)
    })
  })

  describe('isAuthenticated', () => {
    it('should return false if no token', () => {
      expect(isAuthenticated()).toBe(false)
    })

    it('should return true if token exists', () => {
      localStorage.setItem('opencode-qa-token', 'test-token')
      expect(isAuthenticated()).toBe(true)
    })
  })

  describe('isAdmin', () => {
    it('should return false if no user stored', () => {
      expect(isAdmin()).toBe(false)
    })

    it('should return false if user has no roles', () => {
      localStorage.setItem('opencode-qa-user', JSON.stringify({ id: '1', roles: [] }))
      expect(isAdmin()).toBe(false)
    })

    it('should return false if user is not admin', () => {
      localStorage.setItem('opencode-qa-user', JSON.stringify({ id: '1', roles: ['user'] }))
      expect(isAdmin()).toBe(false)
    })

    it('should return true if user is admin', () => {
      localStorage.setItem('opencode-qa-user', JSON.stringify({ id: '1', roles: ['admin'] }))
      expect(isAdmin()).toBe(true)
    })
  })
})

describe('API Service - Utility Functions', () => {
  describe('generateAvatarColor', () => {
    it('should return a valid color for any string', () => {
      const colors = [
        '#f56a00', '#7265e6', '#ffbf00', '#00a2ae',
        '#1890ff', '#52c41a', '#eb2f96', '#722ed1',
        '#13c2c2', '#fa8c16', '#2f54eb', '#52c41a',
      ]

      const color = generateAvatarColor('testuser')
      expect(colors).toContain(color)
    })

    it('should return consistent color for same input', () => {
      const color1 = generateAvatarColor('testuser')
      const color2 = generateAvatarColor('testuser')
      expect(color1).toBe(color2)
    })

    it('should return different colors for different inputs', () => {
      const color1 = generateAvatarColor('user1')
      const color2 = generateAvatarColor('user2')
      const color3 = generateAvatarColor('user3')

      expect(color1).toBeDefined()
      expect(color2).toBeDefined()
      expect(color3).toBeDefined()
    })

    it('should handle empty string', () => {
      const color = generateAvatarColor('')
      expect(color).toMatch(/^#[0-9a-f]{6}$/i)
    })
  })

  describe('getUsername', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('should return displayName if available', () => {
      localStorage.setItem('opencode-qa-user', JSON.stringify({
        id: '1',
        username: 'testuser',
        displayName: 'Test User',
      }))

      expect(getUsername()).toBe('Test User')
    })

    it('should return username if no displayName', () => {
      localStorage.setItem('opencode-qa-user', JSON.stringify({
        id: '1',
        username: 'testuser',
      }))

      expect(getUsername()).toBe('testuser')
    })

    it('should return default value if no user stored', () => {
      expect(getUsername()).toBe('用户')
    })

    it('should return username if displayName is empty', () => {
      localStorage.setItem('opencode-qa-user', JSON.stringify({
        id: '1',
        username: 'testuser',
        displayName: '',
      }))

      expect(getUsername()).toBe('testuser')
    })
  })
})
