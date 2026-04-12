import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import archiver from 'archiver'
import { Readable } from 'stream'

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

export function getSkillVersionPath(slug: string, version: string): string {
  return path.join(SKILLS_DIR, slug, `v${version}`)
}

export function getSkillDir(slug: string): string {
  return path.join(SKILLS_DIR, slug)
}

export async function saveSkillFiles(
  slug: string,
  version: string,
  files: SkillFile[]
): Promise<void> {
  const versionDir = getSkillVersionPath(slug, version)
  await ensureDir(versionDir)

  for (const file of files) {
    const filePath = path.join(versionDir, file.path)
    const dir = path.dirname(filePath)
    await ensureDir(dir)
    await fs.writeFile(filePath, file.content)
  }
}

export async function deleteSkillVersion(
  slug: string,
  version: string
): Promise<void> {
  const versionDir = getSkillVersionPath(slug, version)
  try {
    await fs.rm(versionDir, { recursive: true, force: true })
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

export async function createSkillZip(
  slug: string,
  version: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const versionDir = getSkillVersionPath(slug, version)
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

    archive.directory(versionDir, false)
    archive.finalize()
  })
}

export async function getSkillFilesList(
  slug: string,
  version: string
): Promise<string[]> {
  const versionDir = getSkillVersionPath(slug, version)
  const files: string[] = []

  async function walk(dir: string, base: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relativePath = path.relative(base, fullPath)
      if (entry.isDirectory()) {
        await walk(fullPath, base)
      } else {
        files.push(relativePath.replace(/\\/g, '/'))
      }
    }
  }

  try {
    await walk(versionDir, versionDir)
    return files
  } catch {
    return []
  }
}

export async function skillVersionExists(
  slug: string,
  version: string
): Promise<boolean> {
  const versionDir = getSkillVersionPath(slug, version)
  try {
    const stat = await fs.stat(versionDir)
    return stat.isDirectory()
  } catch {
    return false
  }
}

export async function readSkillFile(
  slug: string,
  version: string,
  filePath: string
): Promise<Buffer | null> {
  const versionDir = getSkillVersionPath(slug, version)
  const fullPath = path.join(versionDir, filePath)
  try {
    return await fs.readFile(fullPath)
  } catch {
    return null
  }
}

export interface FileTreeNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileTreeNode[]
}

export async function getSkillFileTree(
  slug: string,
  version: string
): Promise<FileTreeNode[]> {
  const versionDir = getSkillVersionPath(slug, version)

  async function buildTree(dir: string, basePath: string): Promise<FileTreeNode[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const nodes: FileTreeNode[] = []

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
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
  }

  try {
    return await buildTree(versionDir, '')
  } catch {
    return []
  }
}
