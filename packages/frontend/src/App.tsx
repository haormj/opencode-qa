import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import { HistoryOutlined } from '@ant-design/icons'
import Home from './pages/Home'
import History from './pages/History'

const { Header, Content, Footer } = Layout

function App() {
  return (
    <BrowserRouter>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold', marginRight: '40px' }}>
            OpenCode QA
          </div>
          <Menu
            theme="dark"
            mode="horizontal"
            defaultSelectedKeys={['/']}
            items={[
              { key: '/', label: '问答' },
              { key: '/history', icon: <HistoryOutlined />, label: '历史记录' },
            ]}
          />
        </Header>
        <Content style={{ padding: '0' }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          OpenCode QA ©{new Date().getFullYear()} - 基于OpenCode的业务知识问答系统
        </Footer>
      </Layout>
    </BrowserRouter>
  )
}

export default App
