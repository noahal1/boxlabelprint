import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './styles/global.css';

/**
 * Fluent 2 Ant Design Theme
 * Windows 11 设计语言 · 亚克力质感 · 柔和系统氛围
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#0078d4',
          colorSuccess: '#107c10',
          colorWarning: '#ff8c00',
          colorError: '#d13438',
          colorInfo: '#0078d4',
          colorBgLayout: '#f0f2f5',
          colorBgContainer: 'rgba(255,255,255,0.85)',
          colorBgElevated: '#ffffff',
          colorBorder: '#edebe9',
          colorBorderSecondary: '#f0f0f0',
          colorText: '#1a1a1f',
          colorTextSecondary: '#605e5c',
          colorTextTertiary: '#8a8886',
          borderRadius: 6,
          borderRadiusLG: 12,
          borderRadiusSM: 4,
          fontSize: 14,
          controlHeight: 34,
          fontFamily: "'Segoe UI Variable', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          boxShadowSecondary: '0 2px 8px rgba(0,0,0,0.06)',
          motionDurationFast: '0.15s',
          motionDurationMid: '0.2s',
          motionDurationSlow: '0.3s',
          motionEaseInOut: 'cubic-bezier(0.1, 0.9, 0.2, 1)',
        },
        components: {
          Card: {
            paddingLG: 22,
            borderRadiusLG: 12,
            boxShadowTertiary: '0 1px 2px rgba(0,0,0,0.04)',
            colorBorderSecondary: 'rgba(255,255,255,0.6)',
          },
          Table: {
            borderRadius: 8,
            headerBg: '#faf9f8',
            bodySortBg: '#f3f2f1',
            rowHoverBg: '#f0f6fc',
            padding: 12,
            borderColor: '#edebe9',
          },
          Form: {
            itemMarginBottom: 18,
            verticalLabelPadding: '0 0 4px',
            labelFontSize: 13,
            labelColor: '#605e5c',
            labelRequiredMarkColor: '#d13438',
          },
          Menu: {
            itemBorderRadius: 6,
            subMenuItemBg: 'transparent',
            itemMarginInline: 10,
            itemMarginBlock: 2,
            itemHeight: 42,
            itemColor: 'rgba(255,255,255,0.65)',
            itemSelectedColor: '#ffffff',
            itemHoverColor: 'rgba(255,255,255,0.85)',
            itemSelectedBg: 'rgba(0,120,212,0.5)',
            itemHoverBg: 'rgba(255,255,255,0.06)',
            colorItemBgSelected: 'rgba(0,120,212,0.4)',
            colorItemBgHover: 'rgba(255,255,255,0.06)',
            popupBg: '#1b1a1e',
          },
          Button: {
            borderRadius: 6,
            borderRadiusLG: 8,
            controlHeight: 34,
            controlHeightLG: 42,
            controlHeightSM: 26,
            primaryShadow: '0 1px 2px rgba(0,120,212,0.25)',
            defaultBorderColor: '#d2d0ce',
            defaultHoverBorderColor: '#8a8886',
            defaultHoverBg: '#f3f2f1',
          },
          Tag: {
            borderRadius: 4,
          },
          Input: {
            borderRadius: 6,
            borderRadiusLG: 8,
            controlHeight: 34,
            controlHeightLG: 42,
            hoverBorderColor: '#8a8886',
            activeBorderColor: '#0078d4',
          },
          Select: {
            borderRadius: 6,
            borderRadiusLG: 8,
            controlHeight: 34,
            controlHeightLG: 42,
            optionSelectedBg: '#deecf9',
            hoverBorderColor: '#8a8886',
            activeBorderColor: '#0078d4',
          },
          Modal: {
            borderRadiusLG: 12,
            headerBg: '#faf9f8',
            contentBg: '#ffffff',
          },
          Segmented: {
            borderRadius: 8,
            trackBg: '#f3f2f1',
            itemSelectedBg: '#ffffff',
            itemColor: '#605e5c',
            itemHoverColor: '#1a1a1f',
            boxShadowTertiary: '0 1px 2px rgba(0,0,0,0.04)',
          },
          Switch: {
            trackHeight: 20,
            handleSize: 16,
          },
          Tabs: {
            horizontalMargin: '0',
            inkBarColor: '#0078d4',
          },
          Notification: {
            borderRadiusLG: 10,
          },
          Popconfirm: {
            borderRadiusLG: 8,
          },
          Tooltip: {
            borderRadius: 4,
            colorBgSpotlight: '#1a1a1f',
          },
          Progress: {
            borderRadius: 4,
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
