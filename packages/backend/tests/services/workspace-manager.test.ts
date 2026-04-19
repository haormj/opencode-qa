import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

const { 
  getWorkspacePath, 
  createWorkspace, 
  cleanupWorkspace, 
  workspaceExists,
  cleanupOldWorkspaces,
  getConfig 
} = await import('../../src/services/workspace-manager.js')

describe('Workspace Manager', () => {
  let tempDir: string
  let originalWorkspacesRoot: string | undefined

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-test-'))
    originalWorkspacesRoot = process.env.WORKSPACES_ROOT
    process.env.WORKSPACES_ROOT = tempDir
    delete process.env.WORKSPACE_RETENTION_HOURS
    delete process.env.AUTO_CLEANUP_WORKSPACE
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
    if (originalWorkspacesRoot !== undefined) {
      process.env.WORKSPACES_ROOT = originalWorkspacesRoot
    } else {
      delete process.env.WORKSPACES_ROOT
    }
  })

  describe('getWorkspacePath', () => {
    it('should return path with executionId prefix (8 chars)', () => {
      const executionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      const workspacePath = getWorkspacePath(executionId)
      
      expect(workspacePath).toContain('a1b2c3d4')
      expect(workspacePath).toContain(tempDir)
    })

    it('should return consistent path for same executionId', () => {
      const executionId = '12345678-1234-1234-1234-123456789abc'
      const path1 = getWorkspacePath(executionId)
      const path2 = getWorkspacePath(executionId)
      
      expect(path1).toBe(path2)
    })
  })

  describe('createWorkspace', () => {
    it('should create workspace directory', async () => {
      const executionId = 'test-create-12345678'
      const workspacePath = await createWorkspace(executionId)
      
      expect(fs.existsSync(workspacePath)).toBe(true)
      expect(fs.statSync(workspacePath).isDirectory()).toBe(true)
    })

    it('should create workspace with correct name', async () => {
      const executionId = 'abcdef12-3456-7890-abcd-ef1234567890'
      const workspacePath = await createWorkspace(executionId)
      
      expect(path.basename(workspacePath)).toBe('abcdef12')
    })

    it('should create nested directories if needed', async () => {
      const nestedPath = path.join(tempDir, 'nested', 'deep')
      process.env.WORKSPACES_ROOT = nestedPath
      
      const executionId = 'nested-test-12345678'
      const workspacePath = await createWorkspace(executionId)
      
      expect(fs.existsSync(workspacePath)).toBe(true)
    })
  })

  describe('cleanupWorkspace', () => {
    it('should remove workspace directory', async () => {
      const executionId = 'test-cleanup-12345678'
      const workspacePath = await createWorkspace(executionId)
      
      expect(fs.existsSync(workspacePath)).toBe(true)
      
      await cleanupWorkspace(executionId)
      
      expect(fs.existsSync(workspacePath)).toBe(false)
    })

    it('should not throw if workspace does not exist', async () => {
      const executionId = 'nonexistent-12345678'
      
      await expect(cleanupWorkspace(executionId)).resolves.not.toThrow()
    })

    it('should remove workspace with files', async () => {
      const executionId = 'test-files-12345678'
      const workspacePath = await createWorkspace(executionId)
      
      const testFile = path.join(workspacePath, 'test.txt')
      fs.writeFileSync(testFile, 'test content')
      
      expect(fs.existsSync(testFile)).toBe(true)
      
      await cleanupWorkspace(executionId)
      
      expect(fs.existsSync(workspacePath)).toBe(false)
    })
  })

  describe('workspaceExists', () => {
    it('should return true for existing workspace', async () => {
      const executionId = 'test-exists-12345678'
      await createWorkspace(executionId)
      
      const exists = await workspaceExists(executionId)
      expect(exists).toBe(true)
    })

    it('should return false for non-existing workspace', async () => {
      const executionId = 'not-exist-12345678'
      
      const exists = await workspaceExists(executionId)
      expect(exists).toBe(false)
    })
  })

  describe('cleanupOldWorkspaces', () => {
    it('should clean up workspaces older than retention period', async () => {
      process.env.WORKSPACE_RETENTION_HOURS = '1'
      
      const oldExecutionId = 'old-workspace1234567'
      const oldPath = await createWorkspace(oldExecutionId)
      
      const oldDate = new Date()
      oldDate.setHours(oldDate.getHours() - 2)
      fs.utimesSync(oldPath, oldDate, oldDate)
      
      const newExecutionId = 'new-workspace1234567'
      const newPath = await createWorkspace(newExecutionId)
      
      const cleanedCount = await cleanupOldWorkspaces()
      
      expect(cleanedCount).toBe(1)
      expect(fs.existsSync(oldPath)).toBe(false)
      expect(fs.existsSync(newPath)).toBe(true)
    })

    it('should not clean up when auto cleanup disabled', async () => {
      process.env.AUTO_CLEANUP_WORKSPACE = 'false'
      process.env.WORKSPACE_RETENTION_HOURS = '1'
      
      const executionId = 'disabled-auto-1234567'
      const workspacePath = await createWorkspace(executionId)
      
      const oldDate = new Date()
      oldDate.setHours(oldDate.getHours() - 2)
      fs.utimesSync(workspacePath, oldDate, oldDate)
      
      const cleanedCount = await cleanupOldWorkspaces()
      
      expect(cleanedCount).toBe(0)
      expect(fs.existsSync(workspacePath)).toBe(true)
    })
  })

  describe('getConfig', () => {
    it('should return default configuration', () => {
      const config = getConfig()
      
      expect(config.workspacesRoot).toBe(tempDir)
      expect(config.retentionHours).toBe(24)
      expect(config.autoCleanupEnabled).toBe(true)
    })

    it('should return custom configuration from env', () => {
      process.env.WORKSPACE_RETENTION_HOURS = '48'
      process.env.AUTO_CLEANUP_WORKSPACE = 'false'
      
      const config = getConfig()
      
      expect(config.retentionHours).toBe(48)
      expect(config.autoCleanupEnabled).toBe(false)
    })
  })
})
