import { Button, Space } from 'antd'
import { SaveOutlined, PlayCircleOutlined } from '@ant-design/icons'

export interface ToolbarProps {
  onSave?: () => void
  onExecute?: () => void
  saving?: boolean
}

function Toolbar({ onSave, onExecute, saving }: ToolbarProps) {
  return (
    <div
      style={{
        padding: '12px 16px',
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <Space>
        <Button
          type="default"
          icon={<SaveOutlined />}
          onClick={onSave}
          loading={saving}
        >
          保存
        </Button>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={onExecute}
        >
          执行
        </Button>
      </Space>
    </div>
  )
}

export default Toolbar
