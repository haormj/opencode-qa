import { memo, useCallback } from 'react'
import { Card, Select } from 'antd'
import { Handle, Position } from '@xyflow/react'

export interface SkillInstallNodeData {
  skillId?: string
  skillName?: string
  skillSlug?: string
}

interface SkillInstallNodeProps {
  data: SkillInstallNodeData
  selected?: boolean
}

const skills = [
  { value: 'skill-1', label: '代码审查助手' },
  { value: 'skill-2', label: '文档生成器' },
  { value: 'skill-3', label: '测试用例生成' },
]

function SkillInstallNode({ data, selected }: SkillInstallNodeProps) {
  const handleChange = useCallback((value: string) => {
    const skill = skills.find(s => s.value === value)
    if (skill) {
      data.skillId = value
      data.skillName = skill.label
      data.skillSlug = value
    }
  }, [data])

  return (
    <Card
      size="small"
      title="📦 技能安装"
      style={{
        width: 160,
        border: selected ? '2px solid #1890ff' : '1px solid #d9d9d9',
      }}
      bodyStyle={{ padding: 6 }}
    >
      <Handle type="target" position={Position.Left} />
      <Select
        size="small"
        placeholder="选择技能"
        options={skills}
        defaultValue={data.skillId}
        onChange={handleChange}
        style={{ width: '100%' }}
      />
      <Handle type="source" position={Position.Right} />
    </Card>
  )
}

export default memo(SkillInstallNode)
