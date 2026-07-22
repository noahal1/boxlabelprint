import React from 'react';
import type { LabelTemplate } from './types';

const compactTemplate: LabelTemplate = {
  id: 'compact',
  name: '简洁模板',
  description: '精简信息，适用于小箱或零件盒标签',
  defaultSize: { width: 70, height: 50 },
  thumbnail: { width: 120, height: 86, color: '#f6ffed' },

  render(data, options) {
    const { companyName = '', labelWidth = 280 } = options || {};
    const firstFields = data.displayFields.slice(0, 4);

    return (
      <div style={{ width: labelWidth, padding: '8px 10px', background: '#fff', border: '2px solid #000', fontFamily: "'Courier New', 'Microsoft YaHei', monospace" }}>
        {companyName && (
          <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 'bold', marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid #000', letterSpacing: 1 }}>
            {companyName}
          </div>
        )}
        <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: 1, marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid #000' }}>
          {data.box_number}
        </div>

        <div style={{ fontSize: 9, lineHeight: 1.8 }}>
          {firstFields.map((f) => (
            <InlineRow key={f.key} label={f.label} value={f.value || '-'} />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 6, paddingTop: 4, borderTop: '1px dashed #ccc' }}>
          <div style={{ flex: 1, display: 'flex', gap: 1.5, alignItems: 'flex-end', height: 22 }}>
            {barcodePattern(data.box_number).map((h, i) => (
              <div key={i} style={{ width: 2, height: h, background: '#000' }} />
            ))}
          </div>
          <div id={`qr-container-${data.box_number}`} style={{ width: 44, height: 44, border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: '#999', flexShrink: 0 }}>
            二维码
          </div>
        </div>
        <div style={{ fontSize: 7, marginTop: 2, fontFamily: 'monospace', textAlign: 'center', letterSpacing: 1 }}>
          {data.box_number}
        </div>
      </div>
    );
  },
};

function InlineRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: '#666' }}>{label}</span>
      <span style={{ fontWeight: 'bold' }}>{value}</span>
    </div>
  );
}

function barcodePattern(code: string): number[] {
  let seed = code.length * 37;
  for (let i = 0; i < code.length; i++) seed = (seed + code.charCodeAt(i)) % 100;
  return Array.from({ length: 24 }, (_, i) => { seed = (seed * 3 + i * 7) % 100; return 4 + (seed % 18); });
}

export default compactTemplate;
