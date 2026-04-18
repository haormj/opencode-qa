import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Card, Button, Space, Tag, Switch, Popconfirm, Tooltip, message, Typography, Modal, Form, Input, Select, InputNumber, Checkbox, Divider } from 'antd'
import { PlusOutlined, EditOutlined, PlayCircleOutlined, HistoryOutlined, DeleteOutlined, ClockCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getTasks, createTask, updateTask, deleteTask, toggleTask, executeTask, type Task } from '../../services/api'
import './Admin.css'

const scheduleTypeColors: Record<string, string> = {
  none: 'default',
  cron: 'blue',
  interval: 'green'
}

const scheduleTypeLabels: Record<string, string> = {
  none: '手动',
  cron: '定时',
  interval: '间隔'
}

const cycleOptions = [
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' }
]

const weekDayOptions = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 0, label: '周日' }
]

function generateCron(cycle: string, hour: number, minute: number, weekDays: number[], monthDay: number): string {
  switch (cycle) {
    case 'daily':
      return `${minute} ${hour} * * *`
    case 'weekly':
      return `${minute} ${hour} * * ${weekDays.join(',')}`
    case 'monthly':
      return `${minute} ${hour} ${monthDay} * *`
    default:
      return `${minute} ${hour} * * *`
  }
}

function generatePreview(cycle: string, hour: number, minute: number, weekDays: number[], monthDay: number): string {
  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  switch (cycle) {
    case 'daily':
      return `每天 ${timeStr} 执行`
    case 'weekly':
      const days = weekDays.map(d => weekDayOptions.find(o => o.value === d)?.label).join('、')
      return `每${days} ${timeStr} 执行`
    case 'monthly':
      return `每月 ${monthDay} 号 ${timeStr} 执行`
    default:
      return `每天 ${timeStr} 执行`
  }
}

function parseCron(cron: string): { cycle: string; hour: number; minute: number; weekDays: number[]; monthDay: number } | null {
  if (!cron) return null
  const parts = cron.split(' ')
  if (parts.length !== 5) return null
  
  const [minute, hour, dayOfMonth, , dayOfWeek] = parts
  
  const minuteNum = parseInt(minute) || 0
  const hourNum = parseInt(hour) || 8
  
  if (dayOfMonth !== '*') {
    return {
      cycle: 'monthly',
      hour: hourNum,
      minute: minuteNum,
      weekDays: [1],
      monthDay: parseInt(dayOfMonth) || 1
    }
  }
  
  if (dayOfWeek !== '*') {
    return {
      cycle: 'weekly',
      hour: hourNum,
      minute: minuteNum,
      weekDays: dayOfWeek.split(',').map(Number),
      monthDay: 1
    }
  }
  
  return {
    cycle: 'daily',
    hour: hourNum,
    minute: minuteNum,
    weekDays: [1],
    monthDay: 1
  }
}

function Tasks() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [createForm] = Form.useForm()
  const [creating, setCreating] = useState(false)
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false)
  const [scheduleTask, setScheduleTask] = useState<Task | null>(null)
  const [scheduleType, setScheduleType] = useState<string>('none')
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [scheduleCycle, setScheduleCycle] = useState<string>('daily')
  const [scheduleHour, setScheduleHour] = useState(8)
  const [scheduleMinute, setScheduleMinute] = useState(0)
  const [scheduleWeekDays, setScheduleWeekDays] = useState<number[]>([1])
  const [scheduleMonthDay, setScheduleMonthDay] = useState(1)
  const [scheduleIntervalMinutes, setScheduleIntervalMinutes] = useState(60)

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const result = await getTasks({ page, pageSize })
      setTasks(result.items)
      setTotal(result.total)
    } catch {
      message.error('加载任务列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [page, pageSize])

  const handleToggle = async (task: Task) => {
    try {
      await toggleTask(task.id)
      message.success(task.isActive ? '任务已禁用' : '任务已启用')
      fetchTasks()
    } catch {
      message.error('操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteTask(id)
      message.success('删除成功')
      fetchTasks()
    } catch {
      message.error('删除失败')
    }
  }

  const handleExecute = async (id: string) => {
    try {
      const result = await executeTask(id)
      message.success(`任务已开始执行，执行ID: ${result.executionId}`)
    } catch {
      message.error('执行失败')
    }
  }

  const handleCreateTask = async () => {
    try {
      const values = await createForm.validateFields()
      setCreating(true)
      const task = await createTask({
        name: values.name,
        description: values.description || '',
        flowData: JSON.stringify({ nodes: [], edges: [] }),
        scheduleType: 'none',
        scheduleConfig: null
      })
      message.success('任务创建成功')
      setCreateModalVisible(false)
      createForm.resetFields()
      navigate(`/admin/tasks/${task.id}/edit`)
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    } finally {
      setCreating(false)
    }
  }

  const handleOpenSchedule = (task: Task) => {
    setScheduleTask(task)
    const scheduleTypeValue = task.scheduleType || 'none'
    setScheduleType(scheduleTypeValue)
    
    if (scheduleTypeValue === 'cron' && task.scheduleConfig) {
      const parsed = parseCron(task.scheduleConfig)
      if (parsed) {
        setScheduleCycle(parsed.cycle)
        setScheduleHour(parsed.hour)
        setScheduleMinute(parsed.minute)
        setScheduleWeekDays(parsed.weekDays)
        setScheduleMonthDay(parsed.monthDay)
      }
    }
    
    if (scheduleTypeValue === 'interval' && task.scheduleConfig) {
      setScheduleIntervalMinutes(parseInt(task.scheduleConfig) || 60)
    }
    
    setScheduleModalVisible(true)
  }

  const handleSaveSchedule = async () => {
    if (!scheduleTask) return
    try {
      setSavingSchedule(true)
      
      let scheduleConfigValue: string | null = null
      if (scheduleType === 'cron') {
        scheduleConfigValue = generateCron(scheduleCycle, scheduleHour, scheduleMinute, scheduleWeekDays, scheduleMonthDay)
      } else if (scheduleType === 'interval') {
        scheduleConfigValue = scheduleIntervalMinutes.toString()
      }
      
      await updateTask(scheduleTask.id, {
        scheduleType: scheduleType,
        scheduleConfig: scheduleConfigValue ?? undefined
      })
      message.success('调度配置保存成功')
      setScheduleModalVisible(false)
      fetchTasks()
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    } finally {
      setSavingSchedule(false)
    }
  }

  const columns: ColumnsType<Task> = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text, record) => (
        <Typography.Link onClick={() => navigate(`/admin/tasks/${record.id}/edit`)}>
          {text}
        </Typography.Link>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 250,
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: '调度类型',
      dataIndex: 'scheduleType',
      key: 'scheduleType',
      width: 100,
      render: (type: string) => (
        <Tag color={scheduleTypeColors[type] || 'default'}>
          {scheduleTypeLabels[type] || type}
        </Tag>
      )
    },
    {
      title: '启用状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (active: boolean, record) => (
        <Switch
          checked={active}
          onChange={() => handleToggle(record)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => navigate(`/admin/tasks/${record.id}/edit`)}
            />
          </Tooltip>
          <Tooltip title="调度">
            <Button
              type="text"
              icon={<ClockCircleOutlined />}
              onClick={() => handleOpenSchedule(record)}
            />
          </Tooltip>
          <Tooltip title="执行">
            <Button
              type="text"
              icon={<PlayCircleOutlined />}
              onClick={() => handleExecute(record.id)}
            />
          </Tooltip>
          <Tooltip title="执行记录">
            <Button
              type="text"
              icon={<HistoryOutlined />}
              onClick={() => navigate(`/admin/tasks/${record.id}/executions`)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description="确定要删除此任务吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <>
      <Card
        title="任务列表"
        extra={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
              新建任务
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            }
          }}
        />
      </Card>

      <Modal
        title="新建任务"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false)
          createForm.resetFields()
        }}
        onOk={handleCreateTask}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="name"
            label="任务名称"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="请输入任务名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入任务描述（选填）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="调度配置"
        open={scheduleModalVisible}
        onCancel={() => {
          setScheduleModalVisible(false)
          setScheduleTask(null)
        }}
        onOk={handleSaveSchedule}
        confirmLoading={savingSchedule}
        okText="保存"
        cancelText="取消"
      >
        <div className="space-y-4">
          <div>
            <Typography.Text type="secondary">调度类型</Typography.Text>
            <Select
              className="w-full mt-1"
              value={scheduleType}
              onChange={(value) => setScheduleType(value)}
              options={[
                { value: 'none', label: '手动执行' },
                { value: 'cron', label: '定时任务' },
                { value: 'interval', label: '间隔执行' }
              ]}
            />
          </div>

          {scheduleType === 'cron' && (
            <>
              <div>
                <Typography.Text type="secondary">执行周期</Typography.Text>
                <Select
                  className="w-full mt-1"
                  value={scheduleCycle}
                  onChange={(value) => setScheduleCycle(value)}
                  options={cycleOptions}
                />
              </div>

              <div>
                <Typography.Text type="secondary">执行时间</Typography.Text>
                <div className="flex items-center gap-2 mt-1">
                  <InputNumber
                    min={0}
                    max={23}
                    value={scheduleHour}
                    onChange={(v) => setScheduleHour(v ?? 8)}
                    className="w-20"
                  />
                  <span>时</span>
                  <InputNumber
                    min={0}
                    max={59}
                    value={scheduleMinute}
                    onChange={(v) => setScheduleMinute(v ?? 0)}
                    className="w-20"
                  />
                  <span>分</span>
                </div>
              </div>

              {scheduleCycle === 'weekly' && (
                <div>
                  <Typography.Text type="secondary">执行日期</Typography.Text>
                  <Checkbox.Group
                    className="mt-2"
                    value={scheduleWeekDays}
                    onChange={(values) => setScheduleWeekDays(values as number[])}
                  >
                    <Space wrap>
                      {weekDayOptions.map((item) => (
                        <Checkbox key={item.value} value={item.value}>
                          {item.label}
                        </Checkbox>
                      ))}
                    </Space>
                  </Checkbox.Group>
                </div>
              )}

              {scheduleCycle === 'monthly' && (
                <div>
                  <Typography.Text type="secondary">执行日期</Typography.Text>
                  <div className="flex items-center gap-2 mt-1">
                    <span>每月</span>
                    <InputNumber
                      min={1}
                      max={31}
                      value={scheduleMonthDay}
                      onChange={(v) => setScheduleMonthDay(v ?? 1)}
                      className="w-20"
                    />
                    <span>号</span>
                  </div>
                </div>
              )}

              <Divider className="my-3" />

              <div className="bg-gray-50 p-3 rounded">
                <div className="flex justify-between">
                  <Typography.Text type="secondary">预览</Typography.Text>
                  <Typography.Text>
                    {generatePreview(scheduleCycle, scheduleHour, scheduleMinute, scheduleWeekDays, scheduleMonthDay)}
                  </Typography.Text>
                </div>
                <div className="flex justify-between mt-1">
                  <Typography.Text type="secondary">Cron</Typography.Text>
                  <Typography.Text code>
                    {generateCron(scheduleCycle, scheduleHour, scheduleMinute, scheduleWeekDays, scheduleMonthDay)}
                  </Typography.Text>
                </div>
              </div>
            </>
          )}

          {scheduleType === 'interval' && (
            <div>
              <Typography.Text type="secondary">间隔时间</Typography.Text>
              <div className="flex items-center gap-2 mt-1">
                <span>每隔</span>
                <InputNumber
                  min={1}
                  value={scheduleIntervalMinutes}
                  onChange={(v) => setScheduleIntervalMinutes(v ?? 60)}
                  className="w-24"
                />
                <span>分钟执行一次</span>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}

export default Tasks
