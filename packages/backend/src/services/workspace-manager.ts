import { mkdir, rm, readdir, stat } from 'fs/promises'
import { join, resolve } from 'path'
import logger from './logger.js'

function getWorkspacesRootPath(): string {
  return process.env.WORKSPACES_ROOT 
    ? resolve(process.env.WORKSPACES_ROOT)
    : resolve(process.cwd(), 'data', 'workspaces')
}

function getRetentionHours(): number {
  return parseInt(process.env.WORKSPACE_RETENTION_HOURS || '24', 10)
}

function isAutoCleanupEnabled(): boolean {
  return process.env.AUTO_CLEANUP_WORKSPACE !== 'false'
}

export function getWorkspacePath(executionId: string): string {
  const workspaceId = executionId.slice(0, 8)
  return join(getWorkspacesRootPath(), workspaceId)
}

export async function createWorkspace(executionId: string): Promise<string> {
  const workspacePath = getWorkspacePath(executionId)
  await mkdir(workspacePath, { recursive: true })
  logger.info(`[Workspace] Created: ${workspacePath}`)
  return workspacePath
}

export async function cleanupWorkspace(executionId: string): Promise<void> {
  const workspacePath = getWorkspacePath(executionId)
  try {
    await rm(workspacePath, { recursive: true, force: true })
    logger.info(`[Workspace] Cleaned up: ${workspacePath}`)
  } catch (error) {
    logger.error(`[Workspace] Cleanup failed: ${workspacePath}`, error)
  }
}

export async function workspaceExists(executionId: string): Promise<boolean> {
  const workspacePath = getWorkspacePath(executionId)
  try {
    const stats = await stat(workspacePath)
    return stats.isDirectory()
  } catch {
    return false
  }
}

export async function getWorkspacesRoot(): Promise<string> {
  const root = getWorkspacesRootPath()
  await mkdir(root, { recursive: true })
  return root
}

export async function cleanupOldWorkspaces(): Promise<number> {
  if (!isAutoCleanupEnabled()) {
    logger.info('[Workspace] Auto cleanup disabled')
    return 0
  }

  const WORKSPACES_ROOT = getWorkspacesRootPath()
  const WORKSPACE_RETENTION_HOURS = getRetentionHours()
  
  let cleanedCount = 0
  const now = Date.now()
  const retentionMs = WORKSPACE_RETENTION_HOURS * 60 * 60 * 1000

  try {
    await mkdir(WORKSPACES_ROOT, { recursive: true })
    const entries = await readdir(WORKSPACES_ROOT, { withFileTypes: true })
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      
      const workspacePath = join(WORKSPACES_ROOT, entry.name)
      try {
        const stats = await stat(workspacePath)
        const age = now - stats.mtime.getTime()
        
        if (age > retentionMs) {
          await rm(workspacePath, { recursive: true, force: true })
          logger.info(`[Workspace] Auto cleaned: ${workspacePath} (age: ${Math.round(age / 1000 / 60 / 60)}h)`)
          cleanedCount++
        }
      } catch (error) {
        logger.error(`[Workspace] Failed to check/clean ${workspacePath}:`, error)
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`[Workspace] Auto cleanup completed: ${cleanedCount} workspaces removed`)
    }
  } catch (error) {
    logger.error('[Workspace] Auto cleanup failed:', error)
  }
  
  return cleanedCount
}

export function getConfig() {
  return {
    workspacesRoot: getWorkspacesRootPath(),
    retentionHours: getRetentionHours(),
    autoCleanupEnabled: isAutoCleanupEnabled()
  }
}
