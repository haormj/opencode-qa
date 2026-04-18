import { db, systemSettings, skills } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { decrypt } from './encryption.js'
import type { FlowData, Node, SkillInstallNodeData, CodeDownloadNodeData, StepNodeData } from '../types/task.js'

async function getServerUrl(): Promise<string> {
  const setting = await db.select().from(systemSettings)
    .where(eq(systemSettings.key, 'install.serverUrl'))
    .get()
  
  if (!setting?.value) {
    throw new Error('请先在系统设置中配置服务器地址')
  }
  
  return setting.value
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

function skillInstallToMarkdown(data: SkillInstallNodeData, serverUrl: string): string {
  const slug = data.skillSlug || ''
  if (!slug) {
    return `## 技能安装\n\n请选择要安装的技能。`
  }
  
  return `## 技能安装

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

安装完成后，列出安装的文件确认安装成功。安装成功后请告知用户重新打开 OpenCode，可通过 /skills 命令查看技能是否安装成功。`
}

function codeDownloadToMarkdown(data: CodeDownloadNodeData): string {
  let content = `## 代码下载\n\n`
  content += `- **仓库地址**: ${data.repoUrl || '-'}\n`
  content += `- **分支**: ${data.branch || 'main'}\n`
  content += `- **目标路径**: ${data.targetPath || '/tmp/repo'}\n`
  
  if (data.username) {
    let password = data.password
    if (password) {
      try {
        password = decrypt(password)
      } catch {
        // 解密失败，使用原始值
      }
    }
    content += `- **凭证**: 用户名: ${data.username}${password ? ', 密码: ***' : ''}\n`
  }
  
  content += `\n请将仓库克隆到指定路径。\n`
  return content
}

function stepToMarkdown(data: StepNodeData, stepNumber: number): string {
  let content = `## 步骤 ${stepNumber}\n\n`
  content += `${data.instruction || ''}\n`
  return content
}

async function nodeToMarkdown(node: Node, getNextStepIndex: () => number, serverUrl: string): Promise<string> {
  switch (node.type) {
    case 'skillInstall':
      return skillInstallToMarkdown(node.data as SkillInstallNodeData, serverUrl)
    case 'codeDownload':
      return codeDownloadToMarkdown(node.data as CodeDownloadNodeData)
    case 'step':
      return stepToMarkdown(node.data as StepNodeData, getNextStepIndex())
    case 'output':
      return ''
    default:
      return ''
  }
}

export async function generateTaskMarkdown(flowData: FlowData): Promise<string> {
  const serverUrl = await getServerUrl()
  const sortedNodes = topologicalSort(flowData.nodes, flowData.edges)
  const parts: string[] = ['# 任务执行计划\n']
  
  let stepIndex = 0
  for (const node of sortedNodes) {
    const content = await nodeToMarkdown(node, () => ++stepIndex, serverUrl)
    if (content) {
      parts.push(content)
    }
  }
  
  return parts.join('\n\n')
}
