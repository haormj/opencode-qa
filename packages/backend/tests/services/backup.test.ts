import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

const { backupDatabase, getBackupStatus } = await import('../../src/services/backup.js')

describe('Backup Service', () => {
  let tempDir: string
  let dbFile: string
  let backupDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'))
    dbFile = path.join(tempDir, 'data.db')
    backupDir = path.join(tempDir, 'backups')
    
    fs.writeFileSync(dbFile, 'test database content')
    
    delete process.env.BACKUP_PATH
    delete process.env.BACKUP_RETENTION_DAYS
    delete process.env.BACKUP_ENABLED
    delete process.env.DATABASE_URL
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  describe('backupDatabase', () => {
    it('should backup database successfully', async () => {
      const result = await backupDatabase({ 
        dbPath: `file:${dbFile}`, 
        backupPath: backupDir 
      })

      expect(result.success).toBe(true)
      expect(result.backupFile).toBeDefined()
      expect(fs.existsSync(result.backupFile!)).toBe(true)
    })

    it('should fail if database file does not exist', async () => {
      const result = await backupDatabase({ 
        dbPath: 'file:./data/nonexistent.db', 
        backupPath: backupDir 
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('数据库文件不存在')
    })

    it('should use custom backup path from options', async () => {
      const customBackupDir = path.join(tempDir, 'custom-backups')
      
      const result = await backupDatabase({ 
        dbPath: `file:${dbFile}`, 
        backupPath: customBackupDir 
      })

      expect(result.success).toBe(true)
      expect(result.backupFile).toContain('custom-backups')
    })

    it('should create backup directory if not exists', async () => {
      const newBackupDir = path.join(tempDir, 'new-backups')
      
      expect(fs.existsSync(newBackupDir)).toBe(false)
      
      const result = await backupDatabase({ 
        dbPath: `file:${dbFile}`, 
        backupPath: newBackupDir 
      })

      expect(result.success).toBe(true)
      expect(fs.existsSync(newBackupDir)).toBe(true)
    })

    it('should cleanup old backups', async () => {
      const oldBackupFile = path.join(backupDir, 'data.db.old-backup')
      fs.mkdirSync(backupDir, { recursive: true })
      fs.writeFileSync(oldBackupFile, 'old backup')
      
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 10)
      const stat = fs.statSync(oldBackupFile)
      stat.mtime = oldDate
      
      const result = await backupDatabase({ 
        dbPath: `file:${dbFile}`, 
        backupPath: backupDir,
        retentionDays: 7
      })

      expect(result.success).toBe(true)
    }, 10000)

    it('should handle absolute database path', async () => {
      const result = await backupDatabase({ 
        dbPath: dbFile, 
        backupPath: backupDir 
      })

      expect(result.success).toBe(true)
    })
  })

  describe('getBackupStatus', () => {
    it('should return default values when env vars not set', () => {
      const status = getBackupStatus()

      expect(status.enabled).toBe(true)
      expect(status.backupPath).toBe('./backups')
      expect(status.retentionDays).toBe(7)
    })

    it('should return values from environment variables', () => {
      process.env.BACKUP_ENABLED = 'true'
      process.env.BACKUP_PATH = './custom-backups'
      process.env.BACKUP_RETENTION_DAYS = '14'

      const status = getBackupStatus()

      expect(status.enabled).toBe(true)
      expect(status.backupPath).toBe('./custom-backups')
      expect(status.retentionDays).toBe(14)
    })

    it('should return enabled=false when BACKUP_ENABLED=false', () => {
      process.env.BACKUP_ENABLED = 'false'

      const status = getBackupStatus()

      expect(status.enabled).toBe(false)
    })

    it('should return enabled=true by default', () => {
      const status = getBackupStatus()

      expect(status.enabled).toBe(true)
    })
  })
})
