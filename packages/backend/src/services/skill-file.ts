import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import archiver from 'archiver'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SKILLS_DIR = path.join(__dirname, '../../data/skills')

export interface SkillFile {
  path: string
  content: Buffer
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch {
    // ignore
  }
}

// ========== 新的路径函数 ==========

export function getCurrentPath(slug: string): string {
  return path.join(SKILLS_DIR, slug, 'current')
}

export function getPendingPath(slug: string): string {
  return path.join(SKILLS_DIR, slug, 'pending')
}

export function getSkillDir(slug: string): string {
  return path.join(SKILLS_DIR, slug)
}

// ========== 新的存储函数 ==========

export async function saveSkillFiles(
  slug: string,
  files: SkillFile[]
): Promise<void> {
  const pendingDir = getPendingPath(slug)
  const resolvedPendingDir = path.resolve(pendingDir)
  
  // 先删除整个 pending 目录，确保无残留
  try {
    await fs.rm(pendingDir, { recursive: true, force: true })
  } catch {
    // ignore if not exists
  }
  
  await ensureDir(pendingDir)

  for (const file of files) {
    const fullPath = path.join(pendingDir, file.path)
    const resolvedPath = path.resolve(fullPath)
    
    // 安全检查：确保文件路径在 pending 目录内
    if (!resolvedPath.startsWith(resolvedPendingDir + path.sep)) {
      throw new Error('Invalid file path')
    }
    
    const dir = path.dirname(fullPath)
    await ensureDir(dir)
    await fs.writeFile(fullPath, file.content)
  }
}

export async function approvePendingFiles(slug: string): Promise<void> {
  const currentDir = getCurrentPath(slug)
  const pendingDir = getPendingPath(slug)
  
  // 删除 current
  try {
    await fs.rm(currentDir, { recursive: true, force: true })
  } catch {
    // ignore if not exists
  }
  
  // 重命名 pending 为 current
  await fs.rename(pendingDir, currentDir)
}

export async function deletePendingFiles(slug: string): Promise<void> {
  const pendingDir = getPendingPath(slug)
  try {
    await fs.rm(pendingDir, { recursive: true, force: true })
  } catch {
    // ignore if not exists
  }
}

export async function deleteSkillFiles(slug: string): Promise<void> {
  const skillDir = getSkillDir(slug)
  try {
    await fs.rm(skillDir, { recursive: true, force: true })
  } catch {
    // ignore if not exists
  }
}

// ========== 文件读取函数 ==========

export async function readSkillFileFromLocation(
  slug: string,
  filePath: string,
  location: 'current' | 'pending'
): Promise<Buffer | null> {
  const dir = location === 'current' ? getCurrentPath(slug) : getPendingPath(slug)
  const resolvedDir = path.resolve(dir)
  const fullPath = path.join(dir, filePath)
  const resolvedPath = path.resolve(fullPath)
  
  // 安全检查
  if (!resolvedPath.startsWith(resolvedDir + path.sep)) {
    return null
  }
  
  try {
    return await fs.readFile(resolvedPath)
  } catch {
    return null
  }
}

// ========== 文件树和压缩 ==========

export interface FileTreeNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileTreeNode[]
}

export async function getSkillFileTree(
  slug: string,
  location: 'current' | 'pending'
): Promise<FileTreeNode[]> {
  const dir = location === 'current' ? getCurrentPath(slug) : getPendingPath(slug)

  async function buildTree(dirPath: string, basePath: string): Promise<FileTreeNode[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      const nodes: FileTreeNode[] = []

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        const relativePath = path.join(basePath, entry.name).replace(/\\/g, '/')

        if (entry.isDirectory()) {
          const children = await buildTree(fullPath, relativePath)
          nodes.push({
            name: entry.name,
            path: relativePath,
            isDirectory: true,
            children
          })
        } else {
          nodes.push({
            name: entry.name,
            path: relativePath,
            isDirectory: false
          })
        }
      }

      return nodes.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
    } catch {
      return []
    }
  }

  try {
    return await buildTree(dir, '')
  } catch {
    return []
  }
}

export async function createSkillZip(
  slug: string,
  location: 'current' | 'pending'
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const dir = location === 'current' ? getCurrentPath(slug) : getPendingPath(slug)
    const chunks: Buffer[] = []

    const archive = archiver('zip', { zlib: { level: 9 } })

    archive.on('data', (chunk) => {
      chunks.push(chunk)
    })

    archive.on('end', () => {
      resolve(Buffer.concat(chunks))
    })

    archive.on('error', (err) => {
      reject(err)
    })

    archive.directory(dir, false)
    archive.finalize()
  })
}

// ========== 向后兼容函数（deprecated） ==========

/** @deprecated Use getCurrentPath or getPendingPath instead */
export function getSkillVersionPath(slug: string, version: string): string {
  return path.join(SKILLS_DIR, slug, `v${version}`)
}

/** @deprecated Use deletePendingFiles instead */
export async function deleteSkillVersion(
  slug: string,
  _version: string
): Promise<void> {
  await deletePendingFiles(slug)
}

/** @deprecated Use readSkillFileFromLocation instead */
export async function readSkillFile(
  slug: string,
  _version: string,
  filePath: string
): Promise<Buffer | null> {
  return readSkillFileFromLocation(slug, filePath, 'current')
}

/** @deprecated Use getSkillFileTree with location instead */
export async function getSkillFileTreeByVersion(
  slug: string,
  _version: string
): Promise<FileTreeNode[]> {
  return getSkillFileTree(slug, 'current')
}

/** @deprecated Not needed in new storage model */
export async function skillVersionExists(
  _slug: string,
  _version: string
): Promise<boolean> {
  return true
}

/** @deprecated Not needed in new storage model */
export async function getSkillFilesList(
  _slug: string,
  _version: string
): Promise<string[]> {
  return []
}
