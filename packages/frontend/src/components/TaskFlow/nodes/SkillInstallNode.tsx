import { memo, useCallback, useState, useMemo } from 'react'
import { Select } from 'antd'
import { Handle, Position } from '@xyflow/react'
import { useSkills } from '../../../contexts/SkillContext'

export interface SkillInstallNodeData {
  skillId?: string
  skillName?: string
  skillSlug?: string
}

interface SkillInstallNodeProps {
  data: SkillInstallNodeData
  selected?: boolean
  id: string
}

const NODE_COLOR = '#3B82F6'

function SkillInstallNode({ data, selected }: SkillInstallNodeProps) {
  const { skills, loading } = useSkills()
  const [open, setOpen] = useState(false)

  const options = useMemo(() => 
    skills.map(s => ({
      value: s.id,
      label: s.displayName
    })),
    [skills]
  )

  const handleChange = useCallback((value: string) => {
    const skill = skills.find(s => s.id === value)
    if (skill) {
      data.skillId = skill.id
      data.skillName = skill.displayName
      data.skillSlug = skill.slug
    }
    setOpen(false)
  }, [data, skills])

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 8,
        overflow: 'visible',
        boxShadow: selected 
          ? '0 4px 12px rgba(0,0,0,0.1)'
          : '0 2px 8px rgba(0,0,0,0.08)',
        outline: selected ? '2px solid #3B82F6' : 'none',
        outlineOffset: -2,
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
      <div style={{ padding: 12 }} className="nodrag">
        <Select
          size="small"
          showSearch
          filterOption={(input, option) => {
            const label = option?.label
            if (typeof label === 'string') {
              return label.toLowerCase().includes(input.toLowerCase())
            }
            return false
          }}
          placeholder={loading ? "加载中..." : "搜索并选择技能"}
          options={options}
          value={data.skillId}
          onChange={handleChange}
          style={{ width: '100%' }}
          getPopupContainer={() => document.body}
          open={open}
          onDropdownVisibleChange={setOpen}
          className="nodrag"
          loading={loading}
        />
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export default memo(SkillInstallNode)
