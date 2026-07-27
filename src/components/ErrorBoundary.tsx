import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button, Space, Typography } from 'antd';
import { ReloadOutlined, BugOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] 捕获到未处理错误:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: '#f0f2f5',
            padding: 24,
          }}
        >
          <div
            style={{
              textAlign: 'center',
              maxWidth: 420,
              padding: '48px 40px',
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(20px) saturate(1.2)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.6)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: 'linear-gradient(135deg, #d13438, #e74852)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <BugOutlined style={{ fontSize: 26, color: '#fff' }} />
            </div>

            <Title level={4} style={{ margin: '0 0 8px', color: '#1a1a1f' }}>
              页面出现异常
            </Title>

            <Text style={{ color: '#605e5c', display: 'block', marginBottom: 8, fontSize: 13 }}>
              应用遇到了一个意外错误，请尝试刷新或重试。
            </Text>

            {this.state.error && (
              <div
                style={{
                  margin: '12px 0 20px',
                  padding: '8px 12px',
                  background: '#fdf6f6',
                  borderRadius: 6,
                  border: '1px solid #fce4e4',
                  fontSize: 11,
                  color: '#8a8886',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  textAlign: 'left',
                  maxHeight: 80,
                  overflow: 'auto',
                }}
              >
                {this.state.error.message}
              </div>
            )}

            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={this.handleRetry}
                style={{ borderRadius: 6, height: 36, padding: '0 20px' }}
              >
                重试
              </Button>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={this.handleReload}
                style={{ borderRadius: 6, height: 36, padding: '0 20px' }}
              >
                刷新页面
              </Button>
            </Space>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
