import React from 'react';
import type { LabelTemplate } from './types';

const detailedTemplate: LabelTemplate = {
  id: 'detailed',
  name: '详细模板',
  description: '三区块布局 + 全宽条码，适合大箱/托盘',
  defaultSize: { width: 120, height: 90 },
  thumbnail: { width: 120, height: 90, color: '#f0f5ff' },

  render(data, options) {
    const { companyName = '', companyLogo = '', labelWidth = 420 } = options || {};

    // 将字段分成三组
    const third = Math.ceil(data.displayFields.length / 3);
    const col1 = data.displayFields.slice(0, third);
    const col2 = data.displayFields.slice(third, third * 2);
    const col3 = data.displayFields.slice(third * 2);

    return (
      <div style={{ width: labelWidth, padding: '14px 16px', background: '#fff', border: '3px solid #000', fontFamily: "'Courier New', 'Microsoft YaHei', monospace" }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: '3px double #000' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {companyLogo ? (
              <img src={companyLogo} alt="logo" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 4 }} />
            ) : (
              <div style={{ width: 40, height: 40, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#bbb', borderRadius: 4 }}>Logo</div>
            )}
            <div>
              <div style={{ fontSize: 16, fontWeight: 'bold', letterSpacing: 2 }}>{companyName || '箱牌标签'}</div>
              <div style={{ fontSize: 8, color: '#999' }}>箱号: {data.box_number}</div>
            </div>
          </div>
          <div id={`qr-container-${data.box_number}`} style={{ width: 52, height: 52, border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: '#999', flexShrink: 0 }}>二维码</div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
          <SectionBox title="基本信息">
            {col1.map((f) => (
              <DetailRow key={f.key} label={f.label} value={f.value || '-'} />
            ))}
          </SectionBox>
          <SectionBox title="详细信息">
            {col2.map((f) => (
              <DetailRow key={f.key} label={f.label} value={f.value || '-'} />
            ))}
          </SectionBox>
          <SectionBox title="追溯信息">
            {col3.map((f) => (
              <DetailRow key={f.key} label={f.label} value={f.value || '-'} />
            ))}
            <DetailRow label="箱号" value={data.box_number} mono />
          </SectionBox>
        </div>

        <div style={{ padding: '6px 0', borderTop: '2px solid #000', borderBottom: '1px solid #000', textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'flex-end', height: 32 }}>
            {barcodePattern(data.box_number).map((h, i) => (
              <div key={i} style={{ width: 3, height: h, background: '#000' }} />
            ))}
          </div>
          <div style={{ fontSize: 10, marginTop: 4, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 3 }}>{data.box_number}</div>
        </div>
      </div>
    );
  },
};

function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, border: '1px solid #d9d9d9', borderRadius: 3, padding: '6px 8px', background: '#fafafa' }}>
      <div style={{ fontSize: 8, color: '#1677ff', fontWeight: 'bold', marginBottom: 4, paddingBottom: 3, borderBottom: '1px solid #e8e8e8' }}>{title}</div>
      {children}
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 1, lineHeight: 1.6 }}>
      <span style={{ color: '#999' }}>{label}</span>
      <span style={{ fontWeight: 'bold', fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right', marginLeft: 8 }}>{value}</span>
    </div>
  );
}

function barcodePattern(code: string): number[] {
  let seed = 42;
  for (let i = 0; i < code.length; i++) seed = (seed * 31 + code.charCodeAt(i)) % 1000;
  return Array.from({ length: 48 }, (_, i) => { seed = (seed * 17 + i * 13) % 1000; return 6 + (seed % 26); });
}

export default detailedTemplate;
