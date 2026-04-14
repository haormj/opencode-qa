import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import copy from 'copy-to-clipboard'
import App from './App'
import './index.css'

// Polyfill clipboard API for non-HTTPS environments
// Streamdown uses navigator.clipboard.write() which only works in HTTPS or localhost
if (typeof navigator !== 'undefined' && !navigator.clipboard) {
  (navigator as any).clipboard = {
    writeText: (text: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        try {
          copy(text)
          resolve()
        } catch (err) {
          reject(err)
        }
      })
    },
    write: async (items: ClipboardItem[]): Promise<void> => {
      for (const item of items) {
        if (item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain')
          const text = await blob.text()
          copy(text)
          return
        }
      }
      throw new Error('No supported clipboard type')
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
)
