import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          colorSuccess: '#52c41a',
          colorWarning: '#faad14',
          colorError: '#ff4d4f',
          colorInfo: '#1677ff',
          borderRadius: 8,
          fontSize: 14,
          controlHeight: 36,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif",
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          boxShadowSecondary: '0 4px 12px rgba(0,0,0,0.08)',
        },
        components: {
          Card: {
            paddingLG: 20,
            borderRadiusLG: 10,
            boxShadowTertiary: '0 1px 2px rgba(0,0,0,0.04)',
          },
          Table: {
            borderRadius: 8,
            headerBg: '#fafafa',
            bodySortBg: '#f5f5f5',
            rowHoverBg: '#e6f4ff',
            padding: 12,
          },
          Form: {
            itemMarginBottom: 18,
            verticalLabelPadding: '0 0 4px',
          },
          Menu: {
            itemBorderRadius: 6,
            subMenuItemBg: 'transparent',
            itemMarginInline: 8,
            itemMarginBlock: 2,
          },
          Button: {
            borderRadius: 6,
            controlHeight: 36,
            controlHeightLG: 44,
            controlHeightSM: 28,
          },
          Tag: {
            borderRadius: 4,
          },
          Input: {
            borderRadius: 6,
            controlHeight: 36,
          },
          Select: {
            borderRadius: 6,
            controlHeight: 36,
          },
          Modal: {
            borderRadiusLG: 12,
          },
          Segmented: {
            borderRadius: 8,
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
