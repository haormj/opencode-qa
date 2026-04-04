import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import { MessageOutlined, HistoryOutlined } from '@ant-design/icons'
import Home from './pages/Home'
import History from './pages/History'

const { Header, Content, Footer } = Layout

function App() {
  return (
    <BrowserRouter>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold', marginRight: '40px' }}>
            OpenCode QA
          </div>
          <Menu
            theme="dark"
            mode="horizontal"
            defaultSelectedKeys={['/']}
            items={[
              { key: '/', icon: <MessageOutlined />, label: <Link to="/">问答</Link> },
              { key: '/history', icon: <HistoryOutlined />, label: <Link to="/history">历史记录</Link> },
            ]}
          />
        </Header>
        <Content style={{ padding: '24px 50px' }}>
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
