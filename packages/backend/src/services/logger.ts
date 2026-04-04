import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(process.cwd(), 'logs', 'scheduler')
const RETENTION_DAYS = 7

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
}

function getLogFilePath(): string {
  const date = new Date().toISOString().split('T')[0]
  return path.join(LOG_DIR, `scheduler-${date}.log`)
}

function formatTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19)
}

function writeLog(level: string, message: string, error?: Error): void {
  ensureLogDir()
  const logFile = getLogFilePath()
  const timestamp = formatTimestamp()
  let logLine = `[${timestamp}] ${level.padEnd(5)} ${message}`
  if (error) {
    logLine += ` | Error: ${error.message}`
    if (error.stack) {
      logLine += `\n${error.stack}`
    }
  }
  logLine += '\n'
  fs.appendFileSync(logFile, logLine)
  console.log(logLine.trim())
}

export function info(message: string): void {
  writeLog('INFO', message)
}

export function error(message: string, err?: Error): void {
  writeLog('ERROR', message, err)
}

export function cleanupOldLogs(): void {
  ensureLogDir()
  const now = Date.now()
  const threshold = RETENTION_DAYS * 24 * 60 * 60 * 1000

  const files = fs.readdirSync(LOG_DIR)
  for (const file of files) {
    if (!file.startsWith('scheduler-') || !file.endsWith('.log')) continue

    const filePath = path.join(LOG_DIR, file)
    const stat = fs.statSync(filePath)
    const fileAge = now - stat.mtime.getTime()

    if (fileAge > threshold) {
      fs.unlinkSync(filePath)
      console.log(`[Logger] Deleted old log file: ${file}`)
    }
  }
}
