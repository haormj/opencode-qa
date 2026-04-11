import { useState, useEffect } from 'react'
import { Select, message } from 'antd'
import { getAssistants, type Assistant } from '../services/api'

interface AssistantSelectorProps {
  value?: string | null
  onChange?: (assistantId: string | null) => void
  style?: React.CSSProperties
}

function AssistantSelector({ value, onChange, style }: AssistantSelectorProps) {
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getAssistants()
      .then(setAssistants)
      .catch(() => message.error('加载助手列表失败'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Select
      value={value}
      onChange={onChange}
      loading={loading}
      style={{ minWidth: 150, ...style }}
      placeholder="选择助手"
    >
      {assistants.map(assistant => (
        <Select.Option key={assistant.id} value={assistant.id}>
          {assistant.name}
        </Select.Option>
      ))}
    </Select>
  )
}

export default AssistantSelector
