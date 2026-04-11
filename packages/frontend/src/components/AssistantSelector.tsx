import { useMemo } from 'react'
import { Dropdown, Button } from 'antd'
import type { MenuProps } from 'antd'
import type { Assistant } from '../services/api'
import './AssistantSelector.css'

interface AssistantSelectorProps {
  value?: string | null
  onChange?: (assistantId: string | null) => void
  assistants: Assistant[]
}

function AssistantSelector({ value, onChange, assistants }: AssistantSelectorProps) {
  const menuItems: MenuProps['items'] = useMemo(() => {
    return assistants.map(assistant => ({
      key: assistant.id,
      label: assistant.name,
    }))
  }, [assistants])

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    onChange?.(key === value ? null : key)
  }

  return (
    <Dropdown
      menu={{ items: menuItems, onClick: handleMenuClick, selectedKeys: value ? [value] : [] }}
      trigger={['hover']}
      dropdownRender={(menu) => (
        <div className="assistant-selector-dropdown">{menu}</div>
      )}
    >
      <Button type="text" className="assistant-selector-btn">
        智能助手
      </Button>
    </Dropdown>
  )
}

export default AssistantSelector
