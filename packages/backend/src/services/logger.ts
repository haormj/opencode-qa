import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'

const LOG_LEVEL = process.env.LOG_LEVEL || 'info'
const LOG_DIR = path.join(process.cwd(), 'logs')
const RETENTION_DAYS = process.env.LOG_RETENTION_DAYS || '7d'
const MAX_FILE_SIZE = process.env.LOG_MAX_FILE_SIZE || '10m'

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    if (stack) {
      return `[${timestamp}] ${level.toUpperCase().padEnd(5)} ${message}\n${stack}`
    }
    return `[${timestamp}] ${level.toUpperCase().padEnd(5)} ${message}`
  })
)

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    logFormat
  )
})

const appFileTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'app', 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: MAX_FILE_SIZE,
  maxFiles: RETENTION_DAYS,
  format: logFormat
})

const errorFileTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'error', 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: MAX_FILE_SIZE,
  maxFiles: RETENTION_DAYS,
  level: 'error',
  format: logFormat
})

const accessFileTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'access', 'access-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: MAX_FILE_SIZE,
  maxFiles: RETENTION_DAYS,
  format: logFormat
})

const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports: [
    ...(process.env.LOG_ENABLE_CONSOLE !== 'false' ? [consoleTransport] : []),
    ...(process.env.LOG_ENABLE_FILE !== 'false' ? [appFileTransport, errorFileTransport] : [])
  ]
})

const accessLoggerInstance = winston.createLogger({
  level: 'info',
  transports: [
    ...(process.env.LOG_ENABLE_FILE !== 'false' ? [accessFileTransport] : [])
  ]
})

export default {
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  error: (message: string, meta?: any) => logger.error(message, meta),
  
  access: (meta: any) => accessLoggerInstance.info(JSON.stringify(meta)),
  
  cleanupOldLogs: () => {
    logger.info('Log cleanup is handled by winston-daily-rotate-file')
  }
}
