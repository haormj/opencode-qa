export interface FlowData {
  nodes: Node[];
  edges: Edge[];
}

export interface Node {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
}

export type NodeType = 'skillInstall' | 'codeDownload' | 'step' | 'output';

export type NodeData = SkillInstallNodeData | CodeDownloadNodeData | StepNodeData | OutputNodeData;

export interface SkillInstallNodeData {
  skillId: string;
  skillName: string;
  skillSlug: string;
}

export interface CodeDownloadNodeData {
  repoUrl: string;
  username: string;
  password?: string;
  branch: string;
}

export interface StepNodeData {
  name?: string
  instruction: string
}

export interface OutputNodeData {
  type: 'email' | 'file' | 'webhook';
  config: Record<string, string>;
}

export interface CloneScriptInfo {
  repoName: string
  shPath: string
  ps1Path: string
  targetPath: string
}
