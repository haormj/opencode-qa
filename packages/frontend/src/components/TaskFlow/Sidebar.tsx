import { DragEvent } from 'react'
import { Card, Typography } from 'antd'

const { Text } = Typography

interface NodeCategory {
  type: string
  label: string
  icon: string
}

const nodeCategories: NodeCategory[] = [
  { type: 'skillInstall', label: '技能安装', icon: '🔧' },
  { type: 'codeDownload', label: '代码下载', icon: '📦' },
  { type: 'step', label: '步骤定义', icon: '📝' },
]

function Sidebar() {
  const onDragStart = (event: DragEvent<HTMLDivElement>, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div style={{ padding: '12px', width: '200px', background: '#f5f5f5', height: '100%' }}>
      <Text strong style={{ display: 'block', marginBottom: '12px' }}>节点面板</Text>
      {nodeCategories.map((category) => (
        <Card
          key={category.type}
          size="small"
          draggable
          onDragStart={(e) => onDragStart(e, category.type)}
          style={{ marginBottom: '8px', cursor: 'grab' }}
          hoverable
        >
          <Text>
            {category.icon} {category.label}
          </Text>
        </Card>
      ))}
    </div>
  )
}

export default Sidebar
