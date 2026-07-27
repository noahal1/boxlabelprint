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

  const handleMinimize = () => window.electronAPI.windowMinimize();
  const handleMaximize = () => window.electronAPI.windowMaximize().then(checkMaximized);
  const handleClose = () => window.electronAPI.windowClose();

  return (
    <>
      {/* ==============================================================
          Fluent 2 标题栏 — 亚克力质感
          ============================================================== */}
      <div
        onDoubleClick={handleMaximize}
        style={{
          position: 'fixed' as const,
          top: 0,
          left: 0,
          right: 0,
          height: TITLE_BAR_HEIGHT,
          zIndex: 1000,
          display: 'flex' as const,
          alignItems: 'center' as const,
          justifyContent: 'space-between' as const,
          background: '#1b1a1e',
          userSelect: 'none' as const,
          WebkitAppRegion: 'drag',
        } as any}
      >
        <Space size={8} style={{ paddingLeft: 16 }}>
          <PrinterOutlined style={{ color: '#60cdff', fontSize: 14 }} />
          <span
            style={{
              color: 'rgba(255,255,255,0.9)',
              fontSize: 12.5,
              fontWeight: 600,
              letterSpacing: 0.3,
            }}
          >
            箱牌打印管理系统
          </span>
          <span
            style={{
              color: 'rgba(255,255,255,0.25)',
              fontSize: 10.5,
              padding: '0 4px',
            }}
          >
            v{pkg.version}
          </span>
        </Space>

        {/* 窗口控制 */}
        <div
          style={{
            display: 'flex' as const,
            height: '100%',
            WebkitAppRegion: 'no-drag',
          } as any}
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

      {/* ==============================================================
          Fluent 2 主布局
          ============================================================== */}
      <Layout style={{ height: '100vh', paddingTop: TITLE_BAR_HEIGHT }}>
        {/* ---- 侧边栏 (Acrylic Dark) ---- */}
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          trigger={null}
          theme="dark"
          width={240}
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: `calc(100vh - ${TITLE_BAR_HEIGHT}px)`,
            position: 'fixed',
            left: 0,
            top: TITLE_BAR_HEIGHT,
            bottom: 0,
            zIndex: 100,
            background: '#1b1a1e',
            borderRight: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          {/* 侧边栏品牌区 */}
          <div
            style={{
              padding: '20px 18px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              marginBottom: 4,
            }}
          >
            <div
              style={{
                width: collapsed ? 32 : 34,
                height: collapsed ? 32 : 34,
                background: 'linear-gradient(135deg, #0078d4, #60cdff)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.2s cubic-bezier(0.1, 0.9, 0.2, 1)',
              }}
            >
              <PrinterOutlined style={{ color: '#fff', fontSize: collapsed ? 14 : 16 }} />
            </div>
            {!collapsed && (
              <div style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: 14,
                    fontWeight: 600,
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                  }}
                >
                  箱牌打印
                </div>
                <div
                  style={{
                    color: 'rgba(255,255,255,0.3)',
                    fontSize: 10.5,
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Box Label Manager
                </div>
              </div>
            )}
          </div>

          {/* 菜单（撑满剩余空间） */}
          <div style={{ padding: '4px 0', flex: 1, overflow: 'auto' }}>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[currentKey]}
              items={menuItems}
              onClick={({ key }) => navigate(`/${key}`)}
              style={{
                background: 'transparent',
                borderRight: 0,
              }}
            />
          </div>

          {/* 侧边栏底部 */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            {/* 折叠按钮 */}
            <div
              onClick={() => setCollapsed(!collapsed)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.35)',
                fontSize: 12,
                transition: 'all 0.15s cubic-bezier(0.1, 0.9, 0.2, 1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'rgba(255,255,255,0.35)';
              }}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              {!collapsed && <span>折叠侧栏</span>}
            </div>
          </div>
        </Sider>

        {/* ---- 主内容区 ---- */}
        <Layout
          style={{
            marginLeft: collapsed ? 80 : 240,
            transition: 'margin-left 0.25s cubic-bezier(0.1, 0.9, 0.2, 1)',
          }}
        >
          {/* ---- Fluent 2 顶部栏 ---- */}
          <Header
            style={{
              padding: '0 28px',
              height: HEADER_HEIGHT,
              background: 'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(20px) saturate(1.2)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
              borderBottom: '1px solid #edebe9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'sticky',
              top: 0,
              zIndex: 50,
              lineHeight: `${HEADER_HEIGHT}px`,
            }}
          >
            <Space>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#1a1a1f',
                  letterSpacing: 0.2,
                }}
              >
                {menuItems.find((item) => item.key === currentKey)?.label || '箱牌打印管理系统'}
              </Text>
            </Space>

            <Space size={14}>
              {/* 用户头像 */}
              <div
                style={{
                  width: 1,
                  height: 18,
                  background: '#edebe9',
                }}
              />
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  background: 'linear-gradient(135deg, #0078d4, #60cdff)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'default',
                  transition: 'transform 0.15s cubic-bezier(0.1, 0.9, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>箱</span>
              </div>
            </Space>
          </Header>

          {/* ---- 页面内容 ---- */}
          <Content
            style={{
              padding: 24,
              overflow: 'auto',
              height: `calc(100vh - ${TITLE_BAR_HEIGHT + HEADER_HEIGHT}px)`,
              background: '#f0f2f5',
            }}
          >
            <div className="page-enter">{children}</div>
          </Content>
        </Layout>
      </Layout>
    </>
  );
}

/* ==============================================================
   Fluent 2 窗口控制按钮
   ============================================================== */

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
        color: hovered
          ? danger
            ? '#fff'
            : 'rgba(255,255,255,0.9)'
          : 'rgba(255,255,255,0.4)',
        background: hovered
          ? danger
            ? '#d13438'
            : 'rgba(255,255,255,0.08)'
          : 'transparent',
        transition: 'all 0.15s ease',
        fontSize: 11,
      }}
    >
      {icon}
    </div>
  );

  return tooltip ? <Tooltip title={tooltip}>{btn}</Tooltip> : btn;
}
