import { useState, useEffect, useCallback } from 'react';
import { Layout, Menu, Space, Typography, Tooltip } from 'antd';
import {
  DashboardOutlined,
  FileAddOutlined,
  UnorderedListOutlined,
  SettingOutlined,
  PrinterOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MinusOutlined,
  CloseOutlined,
  BorderOutlined,
  SwitcherOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import UpdateNotification from './UpdateNotification';
import pkg from '../../package.json';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const TITLE_BAR_HEIGHT = 36;
const HEADER_HEIGHT = 56;

const menuItems = [
  { key: 'dashboard', icon: <DashboardOutlined />, label: '工作台' },
  { key: 'create', icon: <FileAddOutlined />, label: '新建箱牌' },
  { key: 'list', icon: <UnorderedListOutlined />, label: '箱牌管理' },
  { key: 'settings', icon: <SettingOutlined />, label: '系统设置' },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const currentKey = location.pathname.replace('/', '') || 'dashboard';

  // 检查窗口是否最大化
  const checkMaximized = useCallback(async () => {
    try {
      const max = await window.electronAPI.windowIsMaximized();
      setIsMaximized(max);
    } catch {}
  }, []);

  useEffect(() => {
    checkMaximized();
    window.addEventListener('resize', checkMaximized);
    return () => window.removeEventListener('resize', checkMaximized);
  }, [checkMaximized]);

  // 窗口控制
  const handleMinimize = () => window.electronAPI.windowMinimize();
  const handleMaximize = () => window.electronAPI.windowMaximize().then(checkMaximized);
  const handleClose = () => window.electronAPI.windowClose();

  return (
    <>
      {/* ========== 自定义标题栏 ========== */}
      <div
        onDoubleClick={handleMaximize}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          height: TITLE_BAR_HEIGHT,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#001529',
          userSelect: 'none',
          WebkitAppRegion: 'drag',
        }}
      >
        {/* 左侧：应用信息 */}
        <Space size={8} style={{ paddingLeft: 16 }}>
          <PrinterOutlined style={{ color: '#69b1ff', fontSize: 15 }} />
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600, letterSpacing: 0.5 }}>
            箱牌打印管理系统
          </span>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>v{pkg.version}</span>
        </Space>

        {/* 右侧：窗口控制按钮 */}
        <div
          style={{
            display: 'flex',
            height: '100%',
            WebkitAppRegion: 'no-drag',
          }}
        >
          <WindowControlButton onClick={handleMinimize} icon={<MinusOutlined />} />
          <WindowControlButton
            onClick={handleMaximize}
            icon={isMaximized ? <SwitcherOutlined /> : <BorderOutlined />}
            tooltip={isMaximized ? '还原' : '最大化'}
          />
          <WindowControlButton
            onClick={handleClose}
            icon={<CloseOutlined />}
            danger
            tooltip="关闭"
          />
        </div>
      </div>

      {/* ========== 主布局 ========== */}
      <Layout style={{ height: '100vh', paddingTop: TITLE_BAR_HEIGHT }}>
        {/* 侧边栏 */}
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          trigger={null}
          theme="dark"
          width={240}
          style={{
            overflow: 'hidden',
            height: `calc(100vh - ${TITLE_BAR_HEIGHT}px)`,
            position: 'fixed',
            left: 0,
            top: TITLE_BAR_HEIGHT,
            bottom: 0,
            zIndex: 100,
            background: 'linear-gradient(180deg, #001529 0%, #002140 50%, #001529 100%)',
          }}
        >
          {/* Logo 区域（可拖动） */}
          <div
            style={{
              height: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: collapsed ? 0 : 10,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              padding: collapsed ? '0 8px' : '0 20px',
              WebkitAppRegion: 'drag',
            }}
          >
            <div style={{
              width: 32, height: 32,
              background: 'linear-gradient(135deg, #1677ff, #69b1ff)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <PrinterOutlined style={{ fontSize: 16, color: '#fff' }} />
            </div>
            {!collapsed && (
              <div style={{ textAlign: 'left' }}>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, lineHeight: 1.3, letterSpacing: 0.5 }}>
                  箱牌打印系统
                </div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 1 }}>
                  {isMaximized ? '已最大化' : '窗口模式'}
                </div>
              </div>
            )}
          </div>

          {/* 菜单 */}
          <div style={{ padding: '8px 0' }}>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[currentKey]}
              items={menuItems}
              onClick={({ key }) => navigate(`/${key}`)}
              style={{ background: 'transparent', borderRight: 0 }}
            />
          </div>

          {/* 折叠按钮 */}
          <div style={{
            position: 'absolute', bottom: 16, left: 0, right: 0,
            display: 'flex', justifyContent: 'center',
          }}>
            <div
              onClick={() => setCollapsed(!collapsed)}
              style={{
                width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8, cursor: 'pointer',
                color: 'rgba(255,255,255,0.35)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </div>
          </div>
        </Sider>

        {/* 主内容区 */}
        <Layout style={{
          marginLeft: collapsed ? 80 : 240,
          transition: 'margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          {/* 顶栏 */}
          <Header style={{
            padding: '0 28px',
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: HEADER_HEIGHT,
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }}>
            <Space>
              <Text style={{ fontSize: 16, fontWeight: 600, color: '#1f1f1f', letterSpacing: 0.3 }}>
                {menuItems.find((item) => item.key === currentKey)?.label || '箱牌打印管理系统'}
              </Text>
            </Space>
            <Space size={16}>
              <UpdateNotification />
              <div style={{ width: 1, height: 18, background: '#f0f0f0' }} />
              <div style={{
                width: 26, height: 26,
                background: 'linear-gradient(135deg, #1677ff, #69b1ff)',
                borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>箱</span>
              </div>
            </Space>
          </Header>

          {/* 页面内容 */}
          <Content style={{
            padding: 24,
            overflow: 'auto',
            height: `calc(100vh - ${TITLE_BAR_HEIGHT + HEADER_HEIGHT}px)`,
            background: '#f0f2f5',
          }}>
            <div className="page-enter">
              {children}
            </div>
          </Content>
        </Layout>
      </Layout>
    </>
  );
}

/* ========== 窗口控制按钮 ========== */

interface WindowControlButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  danger?: boolean;
  tooltip?: string;
}

function WindowControlButton({ onClick, icon, danger, tooltip }: WindowControlButtonProps) {
  const [hovered, setHovered] = useState(false);

  const btn = (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 46,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: hovered ? (danger ? '#fff' : 'rgba(255,255,255,0.85)') : 'rgba(255,255,255,0.5)',
        background: hovered ? (danger ? '#e81123' : 'rgba(255,255,255,0.1)') : 'transparent',
        transition: 'all 0.15s ease',
        fontSize: 12,
      }}
    >
      {icon}
    </div>
  );

  return tooltip ? <Tooltip title={tooltip}>{btn}</Tooltip> : btn;
}
