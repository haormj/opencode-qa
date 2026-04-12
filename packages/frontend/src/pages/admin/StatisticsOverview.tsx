import { useState, useEffect } from 'react'
import { Card, Row, Col, Spin, Empty } from 'antd'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { getStatistics, type Statistics } from '../../services/api'
import './Admin.css'

const COLORS = {
  active: '#52c41a',
  human: '#fa8c16',
  closed: '#d9d9d9'
}

const ASSISTANT_COLORS = [
  '#1890ff',
  '#52c41a',
  '#fa8c16',
  '#722ed1',
  '#13c2c2',
  '#eb2f96',
  '#2f54eb',
  '#faad14'
]

const STATUS_LABELS: Record<string, string> = {
  active: '进行中',
  human: '待人工',
  closed: '已关闭'
}

function StatisticsOverview() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Statistics | null>(null)

  useEffect(() => {
    setLoading(true)
    getStatistics()
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="admin-loading">
        <Spin size="large" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="admin-empty">
        <Empty description="暂无数据" />
      </div>
    )
  }

  const pieData = [
    { name: STATUS_LABELS.active, value: stats.sessions.active, color: COLORS.active },
    { name: STATUS_LABELS.human, value: stats.sessions.human, color: COLORS.human },
    { name: STATUS_LABELS.closed, value: stats.sessions.closed, color: COLORS.closed }
  ].filter(item => item.value > 0)

  const barData = stats.assistantStats.map(stat => ({
    name: stat.name,
    拦截率: stat.interceptionRate
  }))

  return (
    <div className="statistics-overview">
      <Row gutter={24} className="stats-cards">
        <Col span={6}>
          <Card className="stat-card">
            <div className="stat-card-title">会话总数</div>
            <div className="stat-card-value">{stats.sessions.total}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <div className="stat-card-title">用户总数</div>
            <div className="stat-card-value">{stats.users.total}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <div className="stat-card-title">助手数量</div>
            <div className="stat-card-value">{stats.assistants.total}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <div className="stat-card-title">机器人数量</div>
            <div className="stat-card-value">{stats.bots.total}</div>
          </Card>
        </Col>
      </Row>

      <Card title="助手拦截率" className="pie-chart-card">
        {barData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} maxBarSize={60}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Bar dataKey="拦截率" radius={[4, 4, 0, 0]} maxBarSize={60}>
                {barData.map((_, index) => (
                  <Cell key={`bar-${index}`} fill={ASSISTANT_COLORS[index % ASSISTANT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Empty description="暂无数据" />
        )}
      </Card>

      <Card title="会话状态分布" className="pie-chart-card">
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <Empty description="暂无会话数据" />
        )}
      </Card>
    </div>
  )
}

export default StatisticsOverview