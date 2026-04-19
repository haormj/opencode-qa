import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { db, systemSettings, skills } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { decrypt } from './encryption.js'
import { normalizeServerUrl } from '../utils/url.js'
import type { FlowData, Node, SkillInstallNodeData, CodeDownloadNodeData, StepNodeData, CloneScriptInfo } from '../types/task.js'

async function getServerUrl(): Promise<string> {
  const setting = await db.select().from(systemSettings)
    .where(eq(systemSettings.key, 'install.serverUrl'))
    .get()
  
  if (!setting?.value) {
    throw new Error('请先在系统设置中配置服务器地址')
  }
  
  return normalizeServerUrl(setting.value)
}

function topologicalSort(nodes: Node[], edges: { source: string; target: string }[]): Node[] {
  const nodeMap = new Map<string, Node>()
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const node of nodes) {
    nodeMap.set(node.id, node)
    inDegree.set(node.id, 0)
    adjacency.set(node.id, [])
  }

  for (const edge of edges) {
    const current = inDegree.get(edge.target) ?? 0
    inDegree.set(edge.target, current + 1)
    adjacency.get(edge.source)?.push(edge.target)
  }

  const queue: string[] = []
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId)
    }
  }

  const result: Node[] = []
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    const node = nodeMap.get(nodeId)
    if (node) {
      result.push(node)
    }

    for (const neighbor of adjacency.get(nodeId) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) {
        queue.push(neighbor)
      }
    }
  }

  return result
}

function extractRepoName(repoUrl: string): string {
  if (!repoUrl) return 'repo'
  
  // https://github.com/org/repo-name.git → repo-name
  // https://github.com/org/repo-name → repo-name
  // git@github.com:org/repo-name.git → repo-name
  const match = repoUrl.match(/\/([^\/]+?)(\.git)?$/)
  return match ? match[1] : 'repo'
}

function injectCredentials(repoUrl: string, username: string, password: string): string {
  // SSH 格式: git@github.com:org/repo.git → 转换为 HTTPS
  if (repoUrl.startsWith('git@')) {
    const match = repoUrl.match(/^git@([^:]+):(.+)$/)
    if (match) {
      const [, host, path] = match
      repoUrl = `https://${host}/${path}`
    }
  }
  
  // HTTPS 格式注入凭据
  try {
    const url = new URL(repoUrl)
    url.username = username
    url.password = password
    return url.toString()
  } catch {
    return repoUrl
  }
}

function skillInstallToMarkdown(data: SkillInstallNodeData, serverUrl: string, stepNumber: number, workspacePath?: string): string {
  const slug = data.skillSlug || ''
  if (!slug) {
    return `## 步骤 ${stepNumber}: 技能安装\n\n请选择要安装的技能。`
  }
  
  if (workspacePath) {
    const skillsDir = join(workspacePath, '.opencode', 'skills')
    const unixPath = skillsDir.replace(/\\/g, '/')
    const windowsPath = skillsDir.replace(/\\/g, '\\\\')
    
    return `## 步骤 ${stepNumber}: 技能安装

安装技能 "${slug}" 到当前工作区。

根据当前平台执行以下命令：

Linux/macOS:
\`\`\`bash
curl -sSL "${serverUrl}/api/public/scripts/install-skill.sh" | bash -s -- -y -s task -d '${unixPath}' ${slug}
\`\`\`

Windows PowerShell:
\`\`\`powershell
powershell -ExecutionPolicy Bypass -Command "& ([ScriptBlock]::Create((Invoke-RestMethod '${serverUrl}/api/public/scripts/install-skill.ps1'))) -Slug '${slug}' -Force -Source 'task' -TargetDir '${windowsPath}'"
\`\`\`

安装完成后，列出安装的文件确认安装成功。`
  }
  
  return `## 步骤 ${stepNumber}: 技能安装

安装技能 "${slug}"。

根据当前平台执行以下命令：

Linux/macOS:
\`\`\`bash
curl -sSL "${serverUrl}/api/public/scripts/install-skill.sh" | bash -s -- -y -s task ${slug}
\`\`\`

Windows PowerShell:
\`\`\`powershell
powershell -ExecutionPolicy Bypass -Command "& ([ScriptBlock]::Create((Invoke-RestMethod '${serverUrl}/api/public/scripts/install-skill.ps1'))) -Slug '${slug}' -Force -Source 'task'"
\`\`\`

安装完成后，列出安装的文件确认安装成功。`
}

function codeDownloadToMarkdown(data: CodeDownloadNodeData, stepNumber: number, scriptInfo?: CloneScriptInfo): string {
  if (!scriptInfo) {
    return `## 步骤 ${stepNumber}: 代码下载

- **仓库地址**: ${data.repoUrl || '-'}
- **分支**: ${data.branch || 'main'}

请将仓库克隆到合适的位置。`
  }
  
  return `## 步骤 ${stepNumber}: 代码下载

- **仓库地址**: ${data.repoUrl}
- **分支**: ${data.branch || 'main'}
- **目标路径**: ${scriptInfo.targetPath}

根据当前平台执行克隆脚本：

Linux/macOS:
\`\`\`bash
bash ${scriptInfo.shPath}
\`\`\`

Windows PowerShell:
\`\`\`powershell
& ${scriptInfo.ps1Path}
\`\`\`
`
}

function stepToMarkdown(data: StepNodeData, stepNumber: number): string {
  let content = `## 步骤 ${stepNumber}\n\n`
  content += `${data.instruction || ''}\n`
  return content
}

async function nodeToMarkdown(
  node: Node, 
  getNextStepIndex: () => number, 
  serverUrl: string, 
  workspacePath?: string,
  scriptsMap?: Map<string, CloneScriptInfo>
): Promise<string> {
  switch (node.type) {
    case 'skillInstall':
      return skillInstallToMarkdown(node.data as SkillInstallNodeData, serverUrl, getNextStepIndex(), workspacePath)
    case 'codeDownload':
      return codeDownloadToMarkdown(
        node.data as CodeDownloadNodeData, 
        getNextStepIndex(), 
        scriptsMap?.get(node.id)
      )
    case 'step':
      return stepToMarkdown(node.data as StepNodeData, getNextStepIndex())
    case 'output':
      return ''
    default:
      return ''
  }
}

export async function prepareWorkspaceScripts(
  flowData: FlowData, 
  workspacePath: string
): Promise<Map<string, CloneScriptInfo>> {
  const scriptsMap = new Map<string, CloneScriptInfo>()
  const sortedNodes = topologicalSort(flowData.nodes, flowData.edges)
  
  const scriptsDir = join(workspacePath, 'scripts')
  await mkdir(scriptsDir, { recursive: true })
  
  const repoNameCount = new Map<string, number>()
  
  for (const node of sortedNodes) {
    if (node.type !== 'codeDownload') continue
    
    const data = node.data as CodeDownloadNodeData
    if (!data.repoUrl) continue
    
    let repoName = extractRepoName(data.repoUrl)
    
    // 处理重名
    const count = repoNameCount.get(repoName) || 0
    repoNameCount.set(repoName, count + 1)
    if (count > 0) {
      repoName = `${repoName}-${count + 1}`
    }
    
    const targetPath = `./repos/${repoName}`
    const shPath = `./scripts/clone-${repoName}.sh`
    const ps1Path = `./scripts/clone-${repoName}.ps1`
    
    // 构建带认证的 URL
    let authUrl = data.repoUrl
    if (data.username && data.password) {
      try {
        const decryptedPassword = decrypt(data.password)
        authUrl = injectCredentials(data.repoUrl, data.username, decryptedPassword)
      } catch {
        // 解密失败，使用原 URL
      }
    }
    
    const branch = data.branch || 'main'
    
    // 生成 .sh 脚本
    const shContent = `#!/bin/bash
set -e
git clone -b ${branch} "${authUrl}" "${targetPath}"
`
    await writeFile(join(workspacePath, `scripts/clone-${repoName}.sh`), shContent)
    
    // 生成 .ps1 脚本
    const ps1Content = `$ErrorActionPreference = "Stop"
git clone -b ${branch} "${authUrl}" "${targetPath}"
`
    await writeFile(join(workspacePath, `scripts/clone-${repoName}.ps1`), ps1Content)
    
    scriptsMap.set(node.id, { repoName, shPath, ps1Path, targetPath })
  }
  
  return scriptsMap
}

export async function generateTaskMarkdown(
  flowData: FlowData, 
  workspacePath?: string,
  scriptsMap?: Map<string, CloneScriptInfo>
): Promise<string> {
  const serverUrl = await getServerUrl()
  const sortedNodes = topologicalSort(flowData.nodes, flowData.edges)
  
  let stepIndex = 0
  const steps: string[] = []
  for (const node of sortedNodes) {
    const content = await nodeToMarkdown(node, () => ++stepIndex, serverUrl, workspacePath, scriptsMap)
    if (content) {
      steps.push(content)
    }
  }
  
  let markdown = `# 任务执行计划

**执行规则：**
1. 严格按顺序执行，完成当前步骤后再执行下一步
2. 遇到错误立即终止，不要继续执行后续步骤
3. 每完成一步，简要报告执行状态（成功/失败）

---`
  
  if (workspacePath) {
    markdown += `\n\n**工作区**: \`${workspacePath}\``
  }
  
  if (steps.length > 0) {
    markdown += '\n\n' + steps.join('\n\n')
  }
  
  return markdown
}
