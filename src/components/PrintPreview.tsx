import { useEffect, useRef, useState, useMemo } from 'react';
import { Modal, Button, Space, message, Spin } from 'antd';
import { PrinterOutlined, CloseOutlined, DesktopOutlined, EyeOutlined, CodeOutlined } from '@ant-design/icons';
import QRCode from 'qrcode';
import { getTemplateById } from '../templates';
import type { LabelData } from '../templates';
import { renderZplToPng } from '../utils/zplRenderer';

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
  const [previewTab, setPreviewTab] = useState<'template' | 'zpl'>('template');
  const [zplImageUrl, setZplImageUrl] = useState('');
  const [zplLoading, setZplLoading] = useState(false);

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

  // 供应商代码 + 物料编码（二维码和条码共用）
  const combinedCode = useMemo(() => {
    const getVal = (key: string) => data.displayFields.find(f => f.key === key)?.value || '';
    return [getVal('supplier_code'), getVal('material_code')].filter(Boolean).join(' ') || data.box_number;
  }, [data]);

  useEffect(() => {
    if (!visible) return;
    QRCode.toDataURL(combinedCode, { width: 100, margin: 1 })
      .then((url) => setQrDataUrl(url))
      .catch(console.error);
  }, [visible, combinedCode]);

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

  // ========== ZPL 预览渲染 ==========
  useEffect(() => {
    if (!visible || previewTab !== 'zpl') return;
    setZplLoading(true);
    setZplImageUrl('');
    const zpl = generateZPL(data);
    renderZplToPng(zpl, settings.labelWidth, settings.labelHeight)
      .then((url) => setZplImageUrl(url))
      .catch((err) => {
        console.error('ZPL 渲染失败:', err);
      })
      .finally(() => setZplLoading(false));
  }, [visible, previewTab, data, settings.labelWidth, settings.labelHeight]);

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
        message.success('PDF 预览已生成，请在 PDF 查看器中使用打印功能');
      } else {
        message.error(result.error || '生成 PDF 预览失败');
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
            PDF 打印预览
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
      {/* 预览切换标签 */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 12,
          padding: 3,
          background: 'rgba(0,0,0,0.04)',
          borderRadius: 8,
        }}
      >
        <div
          onClick={() => setPreviewTab('template')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12.5,
            fontWeight: previewTab === 'template' ? 600 : 400,
            color:
              previewTab === 'template'
                ? '#1a1a1f'
                : 'rgba(0,0,0,0.45)',
            background:
              previewTab === 'template'
                ? '#fff'
                : 'transparent',
            boxShadow:
              previewTab === 'template'
                ? '0 1px 3px rgba(0,0,0,0.08)'
                : 'none',
            transition: 'all 0.2s cubic-bezier(0.1, 0.9, 0.2, 1)',
          }}
          onMouseEnter={(e) => {
            if (previewTab !== 'template') {
              e.currentTarget.style.color = 'rgba(0,0,0,0.65)';
            }
          }}
          onMouseLeave={(e) => {
            if (previewTab !== 'template') {
              e.currentTarget.style.color = 'rgba(0,0,0,0.45)';
            }
          }}
        >
          <EyeOutlined />
          <span>模板预览</span>
        </div>
        <div
          onClick={() => setPreviewTab('zpl')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12.5,
            fontWeight: previewTab === 'zpl' ? 600 : 400,
            color:
              previewTab === 'zpl'
                ? '#1a1a1f'
                : 'rgba(0,0,0,0.45)',
            background:
              previewTab === 'zpl'
                ? '#fff'
                : 'transparent',
            boxShadow:
              previewTab === 'zpl'
                ? '0 1px 3px rgba(0,0,0,0.08)'
                : 'none',
            transition: 'all 0.2s cubic-bezier(0.1, 0.9, 0.2, 1)',
          }}
          onMouseEnter={(e) => {
            if (previewTab !== 'zpl') {
              e.currentTarget.style.color = 'rgba(0,0,0,0.65)';
            }
          }}
          onMouseLeave={(e) => {
            if (previewTab !== 'zpl') {
              e.currentTarget.style.color = 'rgba(0,0,0,0.45)';
            }
          }}
        >
          <CodeOutlined />
          <span>ZPL 预览</span>
        </div>
      </div>

      {/* 预览区域 — 亚克力卡片 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: previewTab === 'zpl' ? 'center' : 'flex-start',
          padding: previewTab === 'zpl' ? 12 : 24,
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
          borderRadius: 10,
          minHeight: previewTab === 'zpl' ? 320 : 200,
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

        {previewTab === 'template' ? (
          /* — 模板预览 — */
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
        ) : (
          /* — ZPL 预览 — */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              minHeight: 280,
            }}
          >
            {zplLoading ? (
              <div style={{ textAlign: 'center' }}>
                <Spin size="large" />
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    color: 'rgba(0,0,0,0.45)',
                  }}
                >
                  正在渲染 ZPL…
                </div>
              </div>
            ) : zplImageUrl ? (
              <img
                src={zplImageUrl}
                alt="ZPL 预览"
                style={{
                  maxWidth: '100%',
                  maxHeight: 420,
                  objectFit: 'contain',
                  borderRadius: 4,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  background: '#fff',
                }}
              />
            ) : (
              <div
                style={{
                  fontSize: 12,
                  color: 'rgba(0,0,0,0.3)',
                  textAlign: 'center',
                }}
              >
                ZPL 渲染失败
              </div>
            )}
          </div>
        )}
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

/** 供应商代码 + 物料编码的组合，用于二维码和条码 */
function getCombinedCode(data: LabelData): string {
  const getVal = (key: string) => data.displayFields.find(f => f.key === key)?.value || '';
  return [getVal('supplier_code'), getVal('material_code')].filter(Boolean).join(' ') || data.box_number;
}

function generateZPL(data: LabelData): string {
  const header = '^XA\n^CF0,28\n';
  const footer = '^XZ';
  const combined = getCombinedCode(data);

  const LINE_HEIGHT = 30; // 每行间距（点）
  const START_Y = 50;     // 第一个字段起始 Y

  // 动态生成所有字段行
  const fieldLines = data.displayFields.map((field, i) => {
    const y = START_Y + i * LINE_HEIGHT;
    return `^FO20,${y}^FD${field.label}: ${field.value || ''}^FS`;
  });

  // 条码位置在所有字段下方
  const barcodeY = START_Y + data.displayFields.length * LINE_HEIGHT + 20;

  const body = [
    `^CF0,30`,
    `^FO20,15^FD箱号: ${data.box_number}^FS`,
    ...fieldLines,
    `^FO280,15^BQN,2,6^FDQA,${combined}^FS`,
    `^FO20,${barcodeY}^BY2^BCN,40,Y,N^FD${combined}^FS`,
  ]
    .filter(Boolean)
    .join('\n');

  return header + body + '\n' + footer;
}
