import React from 'react';
import type { LabelTemplate } from './types';

const withLogoTemplate: LabelTemplate = {
  id: 'withLogo',
  name: 'Logo模板',
  description: '专业布局，左上角展示公司Logo，适合正式场景',
  defaultSize: { width: 100, height: 75 },
  thumbnail: { width: 120, height: 90, color: '#fff7e6' },

  render(data, options) {
    const { companyName = '', companyLogo = '', labelWidth = 380 } = options || {};

    return (
      <div style={{ width: labelWidth, padding: '12px 14px', background: '#fff', border: '2px solid #000', fontFamily: "'Courier New', 'Microsoft YaHei', monospace" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, paddingBottom: 8, borderBottom: '2px solid #000' }}>
          {companyLogo ? (
            <img src={companyLogo} alt="logo" style={{ width: 36, height: 36, objectFit: 'contain', border: '1px solid #f0f0f0', borderRadius: 4 }} />
          ) : (
            <div style={{ width: 36, height: 36, background: '#f5f5f5', border: '1px dashed #d9d9d9', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#ccc' }}>Logo</div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 'bold', letterSpacing: 1 }}>{companyName || '箱牌标签'}</div>
            <div style={{ fontSize: 8, color: '#999', marginTop: 1 }}>箱号: {data.box_number}</div>
          </div>
          <div id={`qr-container-${data.box_number}`} style={{ width: 48, height: 48, border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: '#999', flexShrink: 0 }}>二维码</div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            {data.displayFields.filter((_, i) => i % 2 === 0).map((f) => (
              <InfoBlock key={f.key} label={f.label} value={f.value || '-'} />
            ))}
          </div>
          <div style={{ flex: 1 }}>
            {data.displayFields.filter((_, i) => i % 2 === 1).map((f) => (
              <InfoBlock key={f.key} label={f.label} value={f.value || '-'} />
            ))}
          </div>
        </div>

        <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px dashed #ccc', textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: 1.5, justifyContent: 'center', alignItems: 'flex-end', height: 24 }}>
            {barcodePattern(data.box_number).map((h, i) => (
              <div key={i} style={{ width: 2, height: h, background: '#000' }} />
            ))}
          </div>
          <div style={{ fontSize: 7, marginTop: 2, fontFamily: 'monospace', letterSpacing: 1 }}>{data.box_number}</div>
        </div>
      </div>
    );
  },
};

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 3 }}>
      <div style={{ fontSize: 8, color: '#999', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 11, fontWeight: 'bold', lineHeight: 1.4 }}>{value}</div>
    </div>
  );
}

function barcodePattern(code: string): number[] {
  let seed = code.length * 37;
  for (let i = 0; i < code.length; i++) seed = (seed + code.charCodeAt(i)) % 100;
  return Array.from({ length: 32 }, (_, i) => { seed = (seed * 3 + i * 7) % 100; return 6 + (seed % 18); });
}

export default withLogoTemplate;
