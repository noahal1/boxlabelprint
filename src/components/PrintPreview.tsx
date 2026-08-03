import { useEffect, useRef, useState, useMemo } from 'react';
import { Modal, Button, Space, message, Spin } from 'antd';
import { PrinterOutlined, CloseOutlined, DesktopOutlined, EyeOutlined, CodeOutlined } from '@ant-design/icons';
import QRCode from 'qrcode';
import { getTemplateById } from '../templates';
import type { LabelData } from '../templates';
import { renderZplToPng } from '../utils/zplRenderer';
import { isValidIpv4 } from '../utils/ipValidation';

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
    departmentName: '',
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [previewTab, setPreviewTab] = useState<'template' | 'zpl'>('template');
  const [zplImageUrl, setZplImageUrl] = useState('');
  const [zplLoading, setZplLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoadingSettings(true);
    const load = async () => {
      try {
        if (!window.electronAPI) return;
        const [name, logo, lw, lh, dept] = await Promise.all([
          window.electronAPI.getSetting('company_name'),
          window.electronAPI.getSetting('company_logo'),
          window.electronAPI.getSetting('label_width'),
          window.electronAPI.getSetting('label_height'),
          window.electronAPI.getSetting('department_name'),
        ]);
        setSettings({
          templateId: 'factory',
          companyName: name || '',
          companyLogo: logo || '',
          labelWidth: Number(lw) || 100,
          labelHeight: Number(lh) || 75,
          departmentName: dept || '',
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
    const zpl = generateZPL(data, {
      widthMm: settings.labelWidth,
      heightMm: settings.labelHeight,
      companyName: settings.companyName,
      departmentName: settings.departmentName,
      boxType: (data as any).box_type,
    });
    renderZplToPng(zpl, settings.labelWidth, settings.labelHeight)
      .then((url) => setZplImageUrl(url))
      .catch((err) => {
        console.error('ZPL 渲染失败:', err);
      })
      .finally(() => setZplLoading(false));
  }, [visible, previewTab, data, settings.labelWidth, settings.labelHeight, settings.companyName, settings.departmentName]);

  const handlePrint = async () => {
    try {
      if (!window.electronAPI) {
        message.warning('请在 Electron 环境中使用打印功能');
        return;
      }
      const printerIp = (await window.electronAPI.getSetting('printer_ip')) || '';
      if (!printerIp.trim()) {
        message.warning('请先在系统设置中配置打印机的 IP 地址');
        return;
      }
      if (!isValidIpv4(printerIp)) {
        message.warning('打印机 IP 地址格式不正确，请到系统设置中检查');
        return;
      }
      const zpl = generateZPL(data, {
        widthMm: settings.labelWidth,
        heightMm: settings.labelHeight,
        companyName: settings.companyName,
        departmentName: settings.departmentName,
        boxType: (data as any).box_type,
      });
      setPrinting(true);
      const result = await window.electronAPI.printSend(zpl);
      if (result.success && result.confirmed) {
        // 已确认出纸才提示成功并登记为已打印
        message.success(result.message || '标签已打印完成（已确认出纸）');
        onPrint();
      } else if (result.success && !result.confirmed) {
        message.warning(result.message || '打印数据已发送，但未能确认打印机是否出纸，箱牌将保持「待打印」状态');
      } else {
        message.error(result.error || '打印失败');
      }
    } catch (err: any) {
      message.error('打印失败: ' + (err?.message || '未知错误'));
    } finally {
      setPrinting(false);
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
              loading={printing}
              disabled={loadingSettings}
              style={{ borderRadius: 8, height: 42, padding: '0 24px', fontWeight: 600 }}
            >
              {printing ? '打印中（等待出纸确认）' : '发送到标签打印机'}
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
              departmentName: settings.departmentName,
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
            {/* 中文提示横幅 */}
            <div
              style={{
                width: '100%',
                padding: '8px 12px',
                marginBottom: 12,
                borderRadius: 6,
                background: '#fffbe6',
                border: '1px solid #ffe58f',
                fontSize: 11,
                color: '#ad6800',
                lineHeight: 1.5,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 13, flexShrink: 0 }}>💡</span>
              <span>
                ZPL 渲染引擎不支持中文显示。如需查看正确的中文标签，请切换到
                <strong>「模板预览」</strong>标签页。
                物理打印机配合 <code>^CI28</code>（UTF-8）和已安装的中文字体可以正确打印中文。
              </span>
            </div>

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

/**
 * 获取指定索引的字段数据
 */
function getField(data: LabelData, idx: number) {
  return data.displayFields[idx];
}

/**
 * 估算 QR 码的模块数（字母数字模式），用于预览中预估二维码实际尺寸并居中定位。
 *
 * 容量边界为实测得到（本地 WASM 引擎逐长度渲染测量）：
 * 16→21、29→25、47→29、68→33、87→37、109→41、110+→45 模块。
 */
function estQrModules(content: string): number {
  const len = content.length;
  if (len <= 16) return 21;   // 版本 1
  if (len <= 29) return 25;   // 版本 2
  if (len <= 47) return 29;   // 版本 3
  if (len <= 68) return 33;   // 版本 4
  if (len <= 87) return 37;   // 版本 5
  if (len <= 109) return 41;  // 版本 6
  return 45;                  // 版本 7
}

/**
 * 生成 ZPL 指令（四列表格布局，与 factory 模板一致）
 *
 * 注：ZPL 预览使用 zpl-renderer-js（WASM 引擎），该引擎
 * 不支持中文渲染（字符显示为乱码），请使用「模板预览」查看正确效果。
 * 物理打印机配合 ^CI28（UTF-8）和已安装的中文字体可以正确打印中文。
 *
 * @param data    标签数据
 * @param options 渲染选项（标签尺寸、公司名、部门名、箱型等）
 */
function generateZPL(
  data: LabelData,
  options: {
    widthMm?: number;
    heightMm?: number;
    dpmm?: number;
    companyName?: string;
    departmentName?: string;
    boxType?: string;
  } = {}
): string {
  const {
    widthMm = 110,
    heightMm = 100,
    dpmm = 8,
    companyName = '',
    departmentName = '',
    boxType = '',
  } = options;

  const W = Math.round(widthMm * dpmm);    // 标签总宽（点）
  const MARGIN = Math.max(Math.round(1.5 * dpmm), 10); // 边距
  const usableW = W - 2 * MARGIN;

  // 列比例（与 factory 模板 colgroup 一致：17%, 28%, 15%, 40%）
  const colPcts = [17, 28, 15];
  const colEdges: number[] = [MARGIN];
  for (const pct of colPcts) {
    colEdges.push(colEdges[colEdges.length - 1] + Math.round((usableW * pct) / 100));
  }
  colEdges.push(MARGIN + usableW);

  // ========== 纵向布局：按标签高度自动缩放填满 ==========
  const ROWS = 7;
  // 基准高度（毫米）：标题区(0.4×2 + 公司名4 + 间距1 + 部门名2.5) + 表格 7×4 + 间距 1×2 + 条码 4 + 解读文字 2
  const BASE_HEADER = 0.4 * 2 + 4 + 1 + 2.5;   // 8.3
  const BASE_ROW = 4;
  const BASE_GAP = 1;
  const BASE_BARCODE = 4;
  const BASE_HUMAN = 2;
  const baseContentH = BASE_HEADER + BASE_GAP + ROWS * BASE_ROW + BASE_GAP + BASE_BARCODE + BASE_HUMAN;
  // 可用高度（去掉上下边距），限制缩放范围避免字体过大/过小
  const availableH = heightMm - 2 * 1.5;
  const s = Math.min(Math.max(availableH / baseContentH, 0.85), 2.2);

  const HEADER_H = Math.round(BASE_HEADER * dpmm * s);
  const ROW_H = Math.round(BASE_ROW * dpmm * s);
  const GAP = Math.max(Math.round(BASE_GAP * dpmm * s), 2);

  const tableTop = MARGIN + HEADER_H + GAP;
  const tableLeft = MARGIN;
  const tableW = usableW;
  const tableH = ROWS * ROW_H;

  // 字体大小
  const TITLE_FONT = Math.round(4 * dpmm * s);   // 公司名称
  const SUB_FONT = Math.round(2.5 * dpmm * s);   // 部门名称
  const CELL_FONT = Math.round(2.5 * dpmm * Math.min(s, 1.4)); // 单元格（封顶避免长值溢出列宽）
  const BARCODE_FONT = Math.round(2 * dpmm);     // 条码下方解读文字
  const BZ_FONT = Math.round(1 * dpmm * s);      // QR 下方 BZ 字样
  const BADGE_FONT = Math.round(2 * dpmm * s);   // 内箱/外箱角标

  // 线条粗细
  const STROKE = Math.max(Math.round(0.3 * dpmm), 1);
  const STROKE_OUTER = Math.max(STROKE + 1, 2);

  // 单元格内边距
  const PAD_X = Math.round(0.5 * dpmm);
  const PAD_Y = Math.max(Math.round(0.4 * dpmm * s), 1);

  // 获取字段
  const f = (idx: number) => getField(data, idx);
  const v = (idx: number) => f(idx)?.value || '';
  const l = (idx: number) => f(idx)?.label || '';

  // QR/条码内容 = 供应商代码 + 物料编码
  const combined = getCombinedCode(data);

  // QR 区域参数（跨第3~7行 的 第3~4列）
  const QR_ROW_START = 2;
  const QR_ROW_COUNT = 5;
  const qrX = colEdges[2];
  const qrY = tableTop + QR_ROW_START * ROW_H;
  const qrW = colEdges[4] - colEdges[2];
  const qrH = QR_ROW_COUNT * ROW_H;
  // ^BQN 的第三个参数是模块宽度（本地 WASM 引擎与 Labelary 实测一致）：
  // 模块宽度 10 点时，版本1 二维码 ≈ 21×10 = 210px ≈ 26mm，与 HTML 模板约 27.8mm 的设计接近。
  // 内容较长时自动缩小模块宽度，保证二维码不超过单元格（并给下方 BZ 字样留空间）
  const qrEstModules = estQrModules(combined);
  const qrMaxHeight = qrH - (BZ_FONT * 2 + Math.round(1.2 * dpmm * s) + PAD_Y);
  const QR_MODULE = qrEstModules * 10 > qrMaxHeight
    ? Math.max(Math.floor(qrMaxHeight / qrEstModules), 4)
    : 10;
  const qrSizeEst = QR_MODULE * qrEstModules;

  // ========== 构建 ZPL 指令 ==========
  const lines: string[] = [];

  lines.push('^XA');
  lines.push('^CI28');

  // ========== 标题区 ==========
  // 公司名称（居中）
  lines.push(`^CF0,${TITLE_FONT}`);
  lines.push(`^FO${MARGIN + PAD_X},${MARGIN + PAD_Y}^FB${usableW - 2 * PAD_X},1,0,C,0^FD${companyName || '公司名称'}^FS`);
  // 部门名称（居中，公司名下方）
  lines.push(`^CF0,${SUB_FONT}`);
  lines.push(`^FO${MARGIN + PAD_X},${MARGIN + PAD_Y + TITLE_FONT + Math.round(0.5 * dpmm * s)}^FB${usableW - 2 * PAD_X},1,0,C,0^FD${departmentName || ''}^FS`);
  // 标题区底部线条（标题与表格的分隔线）
  lines.push(`^FO${tableLeft},${MARGIN + HEADER_H}^GB${tableW},0,${STROKE_OUTER}^FS`);

  // ========== 表格 ==========
  // —— 绘制列分隔线 ——
  for (let c = 1; c < colEdges.length - 1; c++) {
    // 第 2、3 列的分隔线只画到第2行（因为第3行起右侧合并为QR区）
    const lineH = (c >= 2) ? Math.min(2 * ROW_H, qrY + qrH - tableTop) : tableH;
    lines.push(`^FO${colEdges[c]},${tableTop}^GB0,${lineH},${STROKE}^FS`);
  }

  // —— 绘制行分隔线（不画表格最顶部的外框线，从第 1 行开始） ——
  // 最后一行（r=ROWS）是表格与条码区的分隔线，与标题分隔线同样用粗线
  for (let r = 1; r <= ROWS; r++) {
    const y = tableTop + r * ROW_H;
    const isBottom = r === ROWS;
    // QR 区域内（r=3~6）的横线只画左侧两列，避免切割 QR 区域
    const insideQr = r > QR_ROW_START && r < QR_ROW_START + QR_ROW_COUNT;
    if (insideQr) {
      const leftW = colEdges[2] - tableLeft;
      lines.push(`^FO${tableLeft},${y}^GB${leftW},0,${STROKE}^FS`);
    } else {
      lines.push(`^FO${tableLeft},${y}^GB${tableW},0,${isBottom ? STROKE_OUTER : STROKE}^FS`);
    }
  }

  // ========== 填充表格单元格 ==========
  lines.push(`^CF0,${CELL_FONT}`);
  // 单元格文字垂直居中
  const cellY = (r: number) => tableTop + r * ROW_H + Math.round((ROW_H - CELL_FONT) / 2);
  // 行 0: 供应商代码 | value | 物料编号 | value
  lines.push(`^FO${colEdges[0] + PAD_X},${cellY(0)}^FD${l(0)}^FS`);
  lines.push(`^FO${colEdges[1] + PAD_X},${cellY(0)}^FD${v(0)}^FS`);
  lines.push(`^FO${colEdges[2] + PAD_X},${cellY(0)}^FD${l(1)}^FS`);
  lines.push(`^FO${colEdges[3] + PAD_X},${cellY(0)}^FD${v(1)}^FS`);

  // 行 1: 合金状态 | value | 规格 | value
  lines.push(`^FO${colEdges[0] + PAD_X},${cellY(1)}^FD${l(2)}^FS`);
  lines.push(`^FO${colEdges[1] + PAD_X},${cellY(1)}^FD${v(2)}^FS`);
  lines.push(`^FO${colEdges[2] + PAD_X},${cellY(1)}^FD${l(3)}^FS`);
  lines.push(`^FO${colEdges[3] + PAD_X},${cellY(1)}^FD${v(3)}^FS`);

  // 行 2~6: 左侧两列 [label|value]，右侧是 QR
  const qrLabelKeys = ['箱号', l(4), l(5), l(6), l(7)];
  const qrValueKeys = [data.box_number, v(4), v(5), v(6), v(7)];
  for (let i = 0; i < QR_ROW_COUNT; i++) {
    const rowIdx = QR_ROW_START + i;
    lines.push(`^FO${colEdges[0] + PAD_X},${cellY(rowIdx)}^FD${qrLabelKeys[i]}^FS`);
    lines.push(`^FO${colEdges[1] + PAD_X},${cellY(rowIdx)}^FD${qrValueKeys[i]}^FS`);
  }

  // —— QR 区域左侧边框线（第3~7行，col2 与 QR 之间的分隔线） ——
  lines.push(`^FO${colEdges[2]},${qrY}^GB0,${qrH},${STROKE}^FS`);

  // —— QR 码（右侧跨5行，模块宽度10，居中） ——
  const qrDrawX = Math.round(qrX + (qrW - qrSizeEst) / 2);
  const qrDrawY = qrY + PAD_Y;
  lines.push(`^FO${qrDrawX},${qrDrawY}^BQN,2,${QR_MODULE}^FDQA,${combined}^FS`);

  // —— QR 下方 BZ02 / BZ09 字样（与 factory 模板一致，仅当空间足够时绘制） ——
  const bzY1 = qrDrawY + qrSizeEst + Math.round(0.6 * dpmm * s);
  const bzY2 = bzY1 + BZ_FONT + Math.round(0.2 * dpmm * s);
  if (bzY2 + BZ_FONT <= qrY + qrH) {
    const bzX = Math.round(qrX + qrW / 2 - BZ_FONT);
    lines.push(`^CF0,${BZ_FONT}`);
    lines.push(`^FO${bzX},${bzY1}^FD BZ02 ^FS`);
    lines.push(`^FO${bzX},${bzY2}^FD BZ09 ^FS`);
  }

  // ========== 底部条码 ==========
  const barcodeTop = tableTop + tableH + GAP;
  const barcodeH = Math.round(BASE_BARCODE * dpmm * s);
  // Code128 宽度 = (起始符11 + 数据11×字符数 + 校验11 + 结束符13) 个模块 × 模块宽度
  // （本地 WASM 引擎与 Labelary 实测一致：常规内容均为纯子集 B 编码）
  const BY_MODULE = Math.max(Math.round(0.3 * dpmm), 1); // 窄条宽度（点），默认 2
  const barcodeModules = 35 + combined.length * 11;
  let byModule = BY_MODULE;
  let barcodeW = barcodeModules * byModule;
  if (barcodeW > usableW && byModule > 1) {
    // 超长内容时缩小模块宽度，保证条码不超出标签
    byModule = Math.max(Math.floor(usableW / barcodeModules), 1);
    barcodeW = barcodeModules * byModule;
  }
  const barcodeX = tableLeft + Math.round((usableW - barcodeW) / 2);

  lines.push(`^CF0,${BARCODE_FONT}`);
  // ^BCN: Code128, 正常方向, Y=打印解读文字
  lines.push(`^FO${barcodeX},${barcodeTop}^BY${byModule},3.0^BCN,${barcodeH},Y,N,N^FD${combined}^FS`);

  // ========== 内箱/外箱 角标（右下角，与 factory 模板一致） ==========
  if (boxType === 'inner' || boxType === 'outer') {
    const badgeText = boxType === 'inner' ? '内箱' : '外箱';
    const badgePadH = Math.round(0.6 * dpmm * s);
    const badgePadW = Math.round(1 * dpmm * s);
    const badgeH = BADGE_FONT + 2 * badgePadH;
    const badgeW = BADGE_FONT * 2 + 2 * badgePadW;
    const badgeX = W - MARGIN - badgeW;
    const humanH = Math.round(BASE_HUMAN * dpmm * s);
    const badgeY = barcodeTop + barcodeH + humanH - badgeH;
    lines.push(`^FO${badgeX},${badgeY}^GB${badgeW},${badgeH},${STROKE_OUTER}^FS`);
    lines.push(`^CF0,${BADGE_FONT}`);
    lines.push(`^FO${badgeX + Math.round(badgeW / 2 - BADGE_FONT)},${badgeY + Math.round((badgeH - BADGE_FONT) / 2)}^FD${badgeText}^FS`);
  }

  lines.push('^XZ');

  return lines.join('\n');
}
