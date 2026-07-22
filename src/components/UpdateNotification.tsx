import { useState, useEffect, useCallback } from 'react';
import { Badge, Button, Modal, Progress, Space, Typography, message, Tooltip } from 'antd';
import { DownloadOutlined, ReloadOutlined, CheckCircleOutlined, CloseOutlined } from '@ant-design/icons';
import type { UpdateInfo, UpdateProgress } from '../types';
import pkg from '../../package.json';

const { Text, Title, Paragraph } = Typography;

type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'error';

export default function UpdateNotification() {
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const version = pkg.version;

  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubs: (() => void)[] = [];

    unsubs.push(
      window.electronAPI.onUpdateChecking(() => {
        setUpdateState('checking');
      })
    );

    unsubs.push(
      window.electronAPI.onUpdateAvailable((info) => {
        setUpdateInfo(info);
        setUpdateState('available');
        setModalVisible(true);
      })
    );

    unsubs.push(
      window.electronAPI.onUpdateNotAvailable(() => {
        setUpdateState('not-available');
        setTimeout(() => setUpdateState('idle'), 3000);
      })
    );

    unsubs.push(
      window.electronAPI.onUpdateProgress((p) => {
        setProgress(p);
        setUpdateState('downloading');
      })
    );

    unsubs.push(
      window.electronAPI.onUpdateDownloaded((info) => {
        setUpdateInfo(info);
        setUpdateState('downloaded');
        setProgress(null);
      })
    );

    unsubs.push(
      window.electronAPI.onUpdateError((err) => {
        setErrorMsg(err.message);
        setUpdateState('error');
      })
    );

    return () => unsubs.forEach((fn) => fn());
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    if (!window.electronAPI) {
      message.info('开发模式下不检查更新');
      return;
    }
    setUpdateState('checking');
    setModalVisible(true);
    const result = await window.electronAPI.updateCheck();
    if (!result.success) {
      setErrorMsg(result.error || '检查更新失败');
      setUpdateState('error');
    }
  }, []);

  const handleDownload = useCallback(async () => {
    if (!window.electronAPI) return;
    setUpdateState('downloading');
    setProgress({ percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 });
    await window.electronAPI.updateDownload();
  }, []);

  const handleInstall = useCallback(async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.updateInstall();
  }, []);

  const handleClose = () => {
    setModalVisible(false);
    if (updateState === 'not-available' || updateState === 'error') {
      setTimeout(() => setUpdateState('idle'), 300);
    }
  };

  const showBadge = updateState === 'available' || updateState === 'downloaded';

  return (
    <>
      {/* Fluent 2 更新按钮 */}
      <Tooltip title="检查更新">
        <Badge dot={showBadge} color={updateState === 'downloaded' ? '#107c10' : '#0078d4'}>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={handleCheckUpdate}
            loading={updateState === 'checking'}
            style={{
              color: '#605e5c',
              borderRadius: 6,
              transition: 'all 0.15s cubic-bezier(0.1, 0.9, 0.2, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f3f2f1';
              e.currentTarget.style.color = '#1a1a1f';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#605e5c';
            }}
          />
        </Badge>
      </Tooltip>

      {/* Fluent 2 更新对话框 */}
      <Modal
        title={
          <Space>
            <DownloadOutlined style={{ color: '#0078d4' }} />
            <span>软件更新</span>
          </Space>
        }
        open={modalVisible}
        onCancel={handleClose}
        width={480}
        footer={
          <Space>
            <Button
              onClick={handleClose}
              style={{ borderRadius: 6, height: 34 }}
            >
              关闭
            </Button>
            {updateState === 'available' && (
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleDownload}
                style={{ borderRadius: 6, height: 34 }}
              >
                下载更新
              </Button>
            )}
            {updateState === 'downloaded' && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleInstall}
                style={{ borderRadius: 6, height: 34 }}
              >
                立即安装
              </Button>
            )}
            {updateState === 'downloading' && (
              <Button disabled style={{ borderRadius: 6, height: 34 }}>
                下载中...
              </Button>
            )}
          </Space>
        }
        styles={{
          body: {
            padding: '16px 24px',
          },
        }}
      >
        {/* 检查中 */}
        {updateState === 'checking' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <ReloadOutlined spin style={{ fontSize: 36, color: '#0078d4' }} />
            <Paragraph style={{ marginTop: 12, color: '#605e5c' }}>
              正在检查更新...
            </Paragraph>
          </div>
        )}

        {/* 有可用更新 */}
        {updateState === 'available' && updateInfo && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <DownloadOutlined style={{ fontSize: 36, color: '#0078d4' }} />
              <Title level={5} style={{ marginTop: 8, color: '#1a1a1f' }}>
                发现新版本 v{updateInfo.version}
              </Title>
              <Text style={{ color: '#605e5c', fontSize: 13 }}>
                当前版本: v{version} → 新版本: v{updateInfo.version}
              </Text>
            </div>
            {updateInfo.releaseNotes && (
              <div
                style={{
                  background: '#faf9f8',
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 12,
                  maxHeight: 150,
                  overflow: 'auto',
                  border: '1px solid #edebe9',
                }}
              >
                <Text strong style={{ color: '#1a1a1f' }}>
                  更新内容：
                </Text>
                <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', color: '#605e5c' }}>
                  {updateInfo.releaseNotes}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 下载中 */}
        {updateState === 'downloading' && progress && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Progress
              type="circle"
              percent={Math.round(progress.percent)}
              size={100}
              strokeColor="#0078d4"
              trailColor="#edebe9"
              format={(p) => (
                <span style={{ color: '#1a1a1f', fontWeight: 600 }}>{p}%</span>
              )}
            />
            <Paragraph style={{ marginTop: 12, color: '#605e5c' }}>
              正在下载更新...
              <br />
              <Text style={{ color: '#8a8886', fontSize: 12 }}>
                {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
              </Text>
            </Paragraph>
          </div>
        )}

        {/* 下载完成 */}
        {updateState === 'downloaded' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: '#107c10' }} />
            <Title level={5} style={{ marginTop: 12, color: '#1a1a1f' }}>
              更新已就绪
            </Title>
            <Paragraph style={{ color: '#605e5c' }}>
              新版本 v{updateInfo?.version} 已下载完成，点击立即安装重启应用
            </Paragraph>
          </div>
        )}

        {/* 错误 */}
        {updateState === 'error' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <CloseOutlined style={{ fontSize: 36, color: '#d13438' }} />
            <Paragraph style={{ marginTop: 12, color: '#d13438' }}>
              检查更新失败
            </Paragraph>
            <Text style={{ color: '#8a8886', fontSize: 12 }}>
              {errorMsg || '请检查网络后重试'}
            </Text>
          </div>
        )}

        {/* 已是最新 */}
        {updateState === 'not-available' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <CheckCircleOutlined style={{ fontSize: 36, color: '#107c10' }} />
            <Paragraph style={{ marginTop: 12, color: '#605e5c' }}>
              当前已是最新版本 (v{version})
            </Paragraph>
          </div>
        )}
      </Modal>
    </>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
