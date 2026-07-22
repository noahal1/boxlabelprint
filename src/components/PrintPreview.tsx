import { useEffect, useRef, useState } from 'react';
import { Modal, Button, Space, message, Segmented, Tooltip } from 'antd';
import { PrinterOutlined, CloseOutlined } from '@ant-design/icons';
import QRCode from 'qrcode';
import { getTemplateById, templates } from '../templates';
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
  const [selectedTemplate, setSelectedTemplate] = useState('factory');
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoadingSettings(true);
    const load = async () => {
      try {
        if (!window.electronAPI) return;
        const [tmpl, name, logo, lw, lh] = await Promise.all([
          window.electronAPI.getSetting('label_template'),
          window.electronAPI.getSetting('company_name'),
          window.electronAPI.getSetting('company_logo'),
          window.electronAPI.getSetting('label_width'),
          window.electronAPI.getSetting('label_height'),
        ]);
        const tplId = tmpl || 'factory';
        setSettings({
          templateId: tplId,
          companyName: name || '',
          companyLogo: logo || '',
          labelWidth: Number(lw) || 100,
          labelHeight: Number(lh) || 75,
        });
        setSelectedTemplate(tplId);
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
  }, [qrDataUrl, data.box_number, selectedTemplate]);

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
      await window.electronAPI.setSetting('label_template', selectedTemplate);
      const zpl = generateZPL(data, selectedTemplate);
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

  const currentTemplate = getTemplateById(selectedTemplate);
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
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
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
            确认打印
          </Button>
        </Space>
      }
      centered
      styles={{
        body: {
          padding: '24px 24px 8px',
        },
      }}
    >
      {/* 模板选择器 */}
      <div
        style={{
          marginBottom: 18,
          textAlign: 'center',
          padding: '8px 12px',
          background: '#f3f2f1',
          borderRadius: 8,
        }}
      >
        <Segmented
          value={selectedTemplate}
          onChange={(val) => setSelectedTemplate(val as string)}
          options={templates.map((t) => ({
            value: t.id,
            label: (
              <Tooltip title={t.description}>
                <Space size={4}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 14,
                      height: 11,
                      background: t.thumbnail.color,
                      border: '1px solid #d2d0ce',
                      borderRadius: 2,
                    }}
                  />
                  <span>{t.name}</span>
                </Space>
              </Tooltip>
            ),
          }))}
        />
      </div>

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
          {currentTemplate.render(data, {
            companyName: settings.companyName,
            companyLogo: settings.companyLogo,
            departmentName: (data as any).department_name || '',
            labelWidth: renderWidth,
          })}
        </div>
      </div>
    </Modal>
  );
}

function generateZPL(data: LabelData, templateId: string): string {
  const header = '^XA\n^CF0,28\n';
  const footer = '^XZ';
  const qrContent = data.qr_content || data.box_number;
  const firstVal = data.displayFields[0]?.value || '';
  const secondVal = data.displayFields[1]?.value || '';
  let body = '';

  switch (templateId) {
    case 'compact':
      body = [
        `^FO20,10^FD${data.box_number}^FS`,
        `^FO20,40^FD${data.displayFields[0]?.label || ''}: ${firstVal}^FS`,
        `^FO20,60^FD${data.displayFields[1]?.label || ''}: ${secondVal}^FS`,
        `^FO160,40^BQN,2,6^FDQA,${qrContent}^FS`,
        `^FO20,130^BY2^BCN,30,Y,N^FD${data.box_number}^FS`,
      ]
        .filter(Boolean)
        .join('\n');
      break;
    default:
      body = [
        `^CF0,30`,
        `^FO20,15^FD箱号: ${data.box_number}^FS`,
        `^FO20,50^FD${data.displayFields[0]?.label || ''}: ${firstVal}^FS`,
        `^FO20,80^FD${data.displayFields[1]?.label || ''}: ${secondVal}^FS`,
        `^FO280,15^BQN,2,6^FDQA,${qrContent}^FS`,
        `^FO20,200^BY2^BCN,40,Y,N^FD${data.box_number}^FS`,
      ]
        .filter(Boolean)
        .join('\n');
      break;
  }

  return header + body + '\n' + footer;
}
