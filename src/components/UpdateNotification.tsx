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

  // 注册更新事件监听
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
        // 短暂显示后重置
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
    // 终态时重置状态，清除 badge
    if (updateState === 'not-available' || updateState === 'error') {
      setTimeout(() => setUpdateState('idle'), 300);
    }
  };

  // 是否显示右上角更新提示徽标
  const showBadge = updateState === 'available' || updateState === 'downloaded';

  return (
    <>
      {/* 右上角更新按钮 */}
      <Tooltip title="检查更新">
        <Badge dot={showBadge} color={updateState === 'downloaded' ? '#52c41a' : '#1677ff'}>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={handleCheckUpdate}
            loading={updateState === 'checking'}
            style={{ color: '#999' }}
          />
        </Badge>
      </Tooltip>

      {/* 更新对话框 */}
      <Modal
        title="软件更新"
        open={modalVisible}
        onCancel={handleClose}
        width={480}
        footer={
          <Space>
            <Button onClick={handleClose}>关闭</Button>
            {updateState === 'available' && (
              <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
                下载更新
              </Button>
            )}
            {updateState === 'downloaded' && (
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleInstall}>
                立即安装
              </Button>
            )}
            {updateState === 'downloading' && (
              <Button disabled>下载中...</Button>
            )}
          </Space>
        }
      >
        {updateState === 'checking' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <ReloadOutlined spin style={{ fontSize: 36, color: '#1677ff' }} />
            <Paragraph style={{ marginTop: 12 }}>正在检查更新...</Paragraph>
          </div>
        )}

        {updateState === 'available' && updateInfo && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <DownloadOutlined style={{ fontSize: 36, color: '#1677ff' }} />
              <Title level={5} style={{ marginTop: 8 }}>
                发现新版本 v{updateInfo.version}
              </Title>
              <Text type="secondary">
                当前版本: v{version} → 新版本: v{updateInfo.version}
              </Text>
            </div>
            {updateInfo.releaseNotes && (
              <div
                style={{
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 12,
                  maxHeight: 150,
                  overflow: 'auto',
                }}
              >
                <Text strong>更新内容：</Text>
                <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>
                  {updateInfo.releaseNotes}
                </div>
              </div>
            )}
          </div>
        )}

        {updateState === 'downloading' && progress && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Progress
              type="circle"
              percent={Math.round(progress.percent)}
              size={100}
              status="active"
            />
            <Paragraph style={{ marginTop: 12 }}>
              正在下载更新...
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
              </Text>
            </Paragraph>
          </div>
        )}

        {updateState === 'downloaded' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
            <Title level={5} style={{ marginTop: 12 }}>
              更新已就绪
            </Title>
            <Paragraph type="secondary">
              新版本 v{updateInfo?.version} 已下载完成，点击立即安装重启应用
            </Paragraph>
          </div>
        )}

        {updateState === 'error' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <CloseOutlined style={{ fontSize: 36, color: '#ff4d4f' }} />
            <Paragraph style={{ marginTop: 12, color: '#ff4d4f' }}>
              检查更新失败
            </Paragraph>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {errorMsg || '请检查网络后重试'}
            </Text>
          </div>
        )}

        {updateState === 'not-available' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <CheckCircleOutlined style={{ fontSize: 36, color: '#52c41a' }} />
            <Paragraph style={{ marginTop: 12 }}>
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
