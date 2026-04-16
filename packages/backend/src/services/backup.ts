import fs from 'fs'
import path from 'path'
import logger from './logger.js'

const DEFAULT_BACKUP_PATH = './backups'
const DEFAULT_RETENTION_DAYS = 7

interface BackupOptions {
  backupPath?: string
  retentionDays?: number
  dbPath?: string
}

export async function backupDatabase(options: BackupOptions = {}): Promise<{ success: boolean; backupFile?: string; error?: string }> {
  const backupPath = options.backupPath || process.env.BACKUP_PATH || DEFAULT_BACKUP_PATH
  const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || String(options.retentionDays || DEFAULT_RETENTION_DAYS))
  const dbPath = options.dbPath || process.env.DATABASE_URL || 'file:./data/data.db'

  try {
    let dbFilePath: string
    if (dbPath.startsWith('file:')) {
      dbFilePath = path.resolve(process.cwd(), dbPath.replace('file:', ''))
    } else {
      dbFilePath = dbPath
    }

    if (!fs.existsSync(dbFilePath)) {
      const error = `数据库文件不存在: ${dbFilePath}`
      logger.error(error)
      return { success: false, error }
    }

    const absoluteBackupPath = path.resolve(process.cwd(), backupPath)
    if (!fs.existsSync(absoluteBackupPath)) {
      fs.mkdirSync(absoluteBackupPath, { recursive: true })
      logger.info(`创建备份目录: ${absoluteBackupPath}`)
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
    const backupFileName = `data.db.${timestamp}`
    const backupFilePath = path.join(absoluteBackupPath, backupFileName)

    fs.copyFileSync(dbFilePath, backupFilePath)
    logger.info(`数据库备份成功: ${backupFilePath}`)

    await cleanupOldBackups(absoluteBackupPath, retentionDays)

    return { success: true, backupFile: backupFilePath }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('数据库备份失败', error instanceof Error ? error : new Error(errorMessage))
    return { success: false, error: errorMessage }
  }
}

async function cleanupOldBackups(backupPath: string, retentionDays: number): Promise<void> {
  try {
    const files = fs.readdirSync(backupPath)
    const now = Date.now()
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000
    let deletedCount = 0

    for (const file of files) {
      if (!file.startsWith('data.db.') && !file.endsWith('.db')) {
        continue
      }

      const filePath = path.join(backupPath, file)
      const stat = fs.statSync(filePath)
      const fileAge = now - stat.mtimeMs

      if (fileAge > retentionMs) {
        fs.unlinkSync(filePath)
        logger.info(`删除过期备份: ${file}`)
        deletedCount++
      }
    }

    if (deletedCount > 0) {
      logger.info(`清理完成，删除 ${deletedCount} 个过期备份文件`)
    }
  } catch (error) {
    logger.error('清理过期备份失败', error instanceof Error ? error : new Error(String(error)))
  }
}

export function getBackupStatus(): { enabled: boolean; backupPath: string; retentionDays: number } {
  return {
    enabled: process.env.BACKUP_ENABLED !== 'false',
    backupPath: process.env.BACKUP_PATH || DEFAULT_BACKUP_PATH,
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || String(DEFAULT_RETENTION_DAYS))
  }
}
