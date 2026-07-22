import { useEffect, useRef, useState } from 'react';
import { Modal, Button, Space, message } from 'antd';
import { PrinterOutlined, CloseOutlined, DesktopOutlined } from '@ant-design/icons';
import QRCode from 'qrcode';
import { getTemplateById } from '../templates';
import type { LabelData } from '../templates';

interface PrintPreviewProps {
  visible: boolean;
  data: LabelData & { id?: number };
  onClose: () => void;
  onPrint: () => void;
}

export default function PrintPreview({ visible, data, onClose, onPrint }: PrintPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [settings, setSettings] = useState({
    companyName: '',
    companyLogo: '',
    templateId: 'factory',
    labelWidth: 100,
    labelHeight: 75,
  });
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoadingSettings(true);
    const load = async () => {
      try {
        if (!window.electronAPI) return;
        const [name, logo, lw, lh] = await Promise.all([
          window.electronAPI.getSetting('company_name'),
          window.electronAPI.getSetting('company_logo'),
          window.electronAPI.getSetting('label_width'),
          window.electronAPI.getSetting('label_height'),
        ]);
        setSettings({
          templateId: 'factory',
          companyName: name || '',
          companyLogo: logo || '',
          labelWidth: Number(lw) || 100,
          labelHeight: Number(lh) || 75,
        });
      } catch (err) {
        console.error('加载设置失败:', err);
      } finally {
        setLoadingSettings(false);
      }
    };
    load();
  }, [visible]);

  useEffect(() => {
    if (!visible || !data?.qr_content) return;
    QRCode.toDataURL(data.qr_content, { width: 100, margin: 1 })
      .then((url) => setQrDataUrl(url))
      .catch(console.error);
  }, [visible, data]);

  useEffect(() => {
    if (!qrDataUrl || !containerRef.current) return;
    const containerId = `qr-container-${data.box_number}`;
    const el = containerRef.current.querySelector(`#${containerId}`);
    if (el) {
      (el as HTMLElement).innerHTML =
        `<img src="${qrDataUrl}" alt="QR" style="width:100%;height:100%;object-fit:contain;display:block;" />`;
      (el as HTMLElement).style.border = 'none';
      (el as HTMLElement).style.display = 'block';
    }
  }, [qrDataUrl, data.box_number]);

  const handlePrint = async () => {
    try {
      if (!window.electronAPI) {
        message.warning('请在 Electron 环境中使用打印功能');
        return;
      }
      const printerName = await window.electronAPI.getSetting('printer_name');
      if (!printerName) {
        message.warning('请先在系统设置中配置打印机名称');
        return;
      }
      const zpl = generateZPL(data);
      const result = await window.electronAPI.printSend(zpl);
      if (result.success) {
        message.success(`打印指令已发送到 ${result.printerName}`);
        onPrint();
      } else {
        message.error(result.error || '打印失败');
      }
    } catch (err: any) {
      message.error('打印失败: ' + (err?.message || '未知错误'));
    }
  };

  const handleSystemPrintPreview = async () => {
    try {
      if (!window.electronAPI) {
        message.warning('请在 Electron 环境中使用此功能');
        return;
      }
      if (!containerRef.current) {
        message.error('预览内容未就绪');
        return;
      }

      // 直接从 DOM 中提取已渲染的模板 HTML（含内联样式和 QR 码）
      const templateHtml = containerRef.current.innerHTML;

      // 包裹成完整的 HTML 文档
      const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>标签打印 - ${escapeHtml(data.box_number)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    display: flex;
    justify-content: center;
    padding: 16px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
${templateHtml}
</body>
</html>`;

      const result = await window.electronAPI.printSystemPreview(fullHtml);
      if (result.success) {
        message.success('系统打印预览已打开');
      } else {
        message.error(result.error || '打开打印预览失败');
      }
    } catch (err: any) {
      message.error('系统打印预览失败: ' + (err?.message || '未知错误'));
    }
  };

  const factoryTemplate = getTemplateById('factory');
  const renderWidth = settings.labelWidth > 150 ? 420 : settings.labelWidth > 100 ? 380 : 280;

  return (
    <Modal
      title={
        <Space>
          <PrinterOutlined style={{ color: '#0078d4' }} />
          <span>标签预览</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={580}
      footer={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button
            icon={<DesktopOutlined />}
            onClick={handleSystemPrintPreview}
            disabled={loadingSettings || !qrDataUrl}
            style={{ borderRadius: 6, height: 34 }}
          >
            系统打印预览
          </Button>
          <Space>
            <Button
              icon={<CloseOutlined />}
              onClick={onClose}
              style={{ borderRadius: 6, height: 34 }}
            >
              关闭
            </Button>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={handlePrint}
              size="large"
              disabled={loadingSettings}
              style={{ borderRadius: 8, height: 42, padding: '0 24px', fontWeight: 600 }}
            >
              发送到标签打印机
            </Button>
          </Space>
        </Space>
      }
      centered
      styles={{
        body: {
          padding: '24px 24px 8px',
        },
      }}
    >
      {/* 预览区域 — 亚克力卡片 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: 24,
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
          borderRadius: 10,
          minHeight: 200,
          border: '1px solid rgba(255,255,255,0.6)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 高光线 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)',
            pointerEvents: 'none',
          }}
        />
        <div
          ref={containerRef}
          style={{ transform: 'scale(0.9)', transformOrigin: 'top center' }}
        >
          {factoryTemplate.render(data, {
            companyName: settings.companyName,
            companyLogo: settings.companyLogo,
            departmentName: (data as any).department_name || '',
            labelWidth: renderWidth,
            boxType: (data as any).box_type,
          })}
        </div>
      </div>
    </Modal>
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function generateZPL(data: LabelData): string {
  const header = '^XA\n^CF0,28\n';
  const footer = '^XZ';
  const qrContent = data.qr_content || data.box_number;
  const firstVal = data.displayFields[0]?.value || '';
  const secondVal = data.displayFields[1]?.value || '';
  const body = [
    `^CF0,30`,
    `^FO20,15^FD箱号: ${data.box_number}^FS`,
    `^FO20,50^FD${data.displayFields[0]?.label || ''}: ${firstVal}^FS`,
    `^FO20,80^FD${data.displayFields[1]?.label || ''}: ${secondVal}^FS`,
    `^FO280,15^BQN,2,6^FDQA,${qrContent}^FS`,
    `^FO20,200^BY2^BCN,40,Y,N^FD${data.box_number}^FS`,
  ]
    .filter(Boolean)
    .join('\n');

  return header + body + '\n' + footer;
}
