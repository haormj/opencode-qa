import { useState, useEffect } from 'react'
import { Card, Row, Col, Spin, Empty } from 'antd'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { getStatistics, type Statistics } from '../../services/api'
import './Admin.css'

const COLORS = {
  active: '#52c41a',
  human: '#fa8c16',
  closed: '#d9d9d9'
}

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

  return (
    <div className="statistics-overview">
      <Row gutter={24} className="stats-cards">
        <Col span={8}>
          <Card className="stat-card">
            <div className="stat-card-title">问题拦截率</div>
            <div className="stat-card-value">
              {stats.interceptionRate}%
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card className="stat-card">
            <div className="stat-card-title">会话总数</div>
            <div className="stat-card-value">
              {stats.sessions.total}
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card className="stat-card">
            <div className="stat-card-title">用户总数</div>
            <div className="stat-card-value">
              {stats.users.total}
            </div>
          </Card>
        </Col>
      </Row>

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
