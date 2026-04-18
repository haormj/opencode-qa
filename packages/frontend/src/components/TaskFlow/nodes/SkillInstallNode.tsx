import { memo, useCallback } from 'react'
import { Select } from 'antd'
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

const NODE_COLOR = '#3B82F6'

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
    <div
      style={{
        position: 'relative',
        borderRadius: 8,
        overflow: 'visible',
        boxShadow: selected 
          ? 'inset 0 0 0 2px #3B82F6, 0 4px 12px rgba(0,0,0,0.1)'
          : '0 2px 8px rgba(0,0,0,0.08)',
        backgroundColor: '#fff',
        width: 240,
      }}
    >
      <Handle type="target" position={Position.Left} />
      
      {/* 左侧彩色条 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 8,
          backgroundColor: NODE_COLOR,
          borderTopLeftRadius: 8,
          borderBottomLeftRadius: 8,
        }}
      />
      
      {/* 标题区域 */}
      <div
        style={{
          padding: '10px 12px 10px 16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 16 }}>📦</span>
        <span style={{ fontWeight: 500, fontSize: 14, color: '#1f2937' }}>
          技能安装
        </span>
      </div>
      
      {/* 内容区域 */}
      <div style={{ padding: 12 }}>
        <Select
          size="small"
          placeholder="选择要安装的技能"
          options={skills}
          defaultValue={data.skillId}
          onChange={handleChange}
          style={{ width: '100%' }}
        />
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export default memo(SkillInstallNode)
