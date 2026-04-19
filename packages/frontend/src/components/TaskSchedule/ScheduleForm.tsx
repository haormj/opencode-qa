import { useCallback } from 'react'
import { Card, Form, Select, InputNumber, TimePicker } from 'antd'
import dayjs from 'dayjs'

export interface ScheduleConfig {
  scheduleType: 'none' | 'interval' | 'daily'
  intervalValue?: number
  intervalUnit?: 'minutes' | 'hours'
  dailyTime?: string
}

export interface ScheduleFormProps {
  value?: ScheduleConfig
  onChange?: (value: ScheduleConfig) => void
}

const scheduleTypes = [
  { value: 'none', label: '不调度' },
  { value: 'interval', label: '间隔执行' },
  { value: 'daily', label: '每日执行' },
]

const intervalUnits = [
  { value: 'minutes', label: '分钟' },
  { value: 'hours', label: '小时' },
]

function ScheduleForm({ value, onChange }: ScheduleFormProps) {
  const updateValue = useCallback((field: keyof ScheduleConfig, fieldValue: unknown) => {
    onChange?.({
      ...value,
      scheduleType: value?.scheduleType || 'none',
      [field]: fieldValue,
    })
  }, [value, onChange])

  const handleTypeChange = (type: 'none' | 'interval' | 'daily') => {
    onChange?.({
      scheduleType: type,
      intervalValue: type === 'interval' ? value?.intervalValue : undefined,
      intervalUnit: type === 'interval' ? (value?.intervalUnit || 'minutes') : undefined,
      dailyTime: type === 'daily' ? value?.dailyTime : undefined,
    })
  }

  const handleTimeChange = (time: dayjs.Dayjs | null) => {
    if (time) {
      updateValue('dailyTime', time.format('HH:mm'))
    }
  }

  return (
    <Card size="small" title="调度配置">
      <Form layout="vertical" size="small">
        <Form.Item label="调度类型" style={{ marginBottom: 12 }}>
          <Select
            value={value?.scheduleType || 'none'}
            options={scheduleTypes}
            onChange={handleTypeChange}
          />
        </Form.Item>

        {value?.scheduleType === 'interval' && (
          <Form.Item label="执行间隔" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <InputNumber
                min={1}
                max={10080}
                value={value?.intervalValue || 1}
                onChange={(v) => updateValue('intervalValue', v || 1)}
                style={{ flex: 1 }}
              />
              <Select
                value={value?.intervalUnit || 'minutes'}
                options={intervalUnits}
                onChange={(v) => updateValue('intervalUnit', v)}
                style={{ width: 80 }}
              />
            </div>
          </Form.Item>
        )}

        {value?.scheduleType === 'daily' && (
          <Form.Item label="执行时间" style={{ marginBottom: 0 }}>
            <TimePicker
              format="HH:mm"
              value={value?.dailyTime ? dayjs(value.dailyTime, 'HH:mm') : undefined}
              onChange={handleTimeChange}
              style={{ width: '100%' }}
            />
          </Form.Item>
        )}
      </Form>
    </Card>
  )
}

export default ScheduleForm
