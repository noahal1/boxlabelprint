import React from 'react';
import type { LabelTemplate } from './types';

const standardTemplate: LabelTemplate = {
  id: 'standard',
  name: '标准模板',
  description: '经典布局，字段信息在左，二维码和底部全宽条码',
  defaultSize: { width: 100, height: 75 },
  thumbnail: { width: 120, height: 90, color: '#e6f4ff' },

  render(data, options) {
    const { companyName = '', labelWidth = 380 } = options || {};

    return (
      <div style={{ width: labelWidth, padding: '10px 14px', background: '#fff', border: '2px solid #000', borderRadius: 2, fontFamily: "'Courier New', 'Microsoft YaHei', monospace" }}>
        {companyName && (
          <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 'bold', marginBottom: 6, paddingBottom: 6, borderBottom: '2px solid #000', letterSpacing: 2 }}>
            {companyName}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {!companyName && (
              <div style={{ fontWeight: 'bold', fontSize: 11, marginBottom: 4, color: '#666', textAlign: 'center' }}>箱牌标签</div>
            )}
            {/* 字段按两列并排显示：供应商代码 | 物料编码 同一行 */}
            {data.displayFields.reduce<(typeof data.displayFields)[]>((rows, f, i) => {
              if (i % 2 === 0) rows.push([f]);
              else rows[rows.length - 1].push(f);
              return rows;
            }, []).map((pair, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 12, marginBottom: 2 }}>
                {pair.map((f) => (
                  <div key={f.key} style={{ flex: 1, minWidth: 0 }}>
                    <RowItem label={f.label} value={f.value} />
                  </div>
                ))}
                {/* 奇数个字段时补空白占位 */}
                {pair.length < 2 && <div style={{ flex: 1 }} />}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 80 }}>
            <div id={`qr-container-${data.box_number}`} style={{ width: 60, height: 60, border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#999' }}>
              二维码
            </div>
          </div>
        </div>

        {/* 底部全宽条码 */}
        <div style={{ padding: '6px 0', borderTop: '2px solid #000', textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'flex-end', height: 30 }}>
            {barcodePattern(data.box_number).map((h, i) => (
              <div key={i} style={{ width: 2.5, height: h, background: '#000' }} />
            ))}
          </div>
          <div style={{ fontSize: 9, marginTop: 3, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 2 }}>
            {data.box_number}
          </div>
        </div>

        <div style={{ marginTop: 4, fontSize: 7, color: '#999', textAlign: 'center' }}>
          {companyName} | {data.box_number}
        </div>
      </div>
    );
  },
};

function RowItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', fontSize: 10, marginBottom: 2, lineHeight: 1.7 }}>
      <span style={{ color: '#666', whiteSpace: 'nowrap', minWidth: 50 }}>{label}:</span>
      <span style={{ fontWeight: 'bold', marginLeft: 4, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value || '-'}
      </span>
    </div>
  );
}

function barcodePattern(code: string): number[] {
  let seed = 0;
  for (let i = 0; i < code.length; i++) seed = (seed + code.charCodeAt(i) * (i + 1)) % 100;
  return Array.from({ length: 32 }, (_, i) => { seed = (seed * 7 + 13) % 100; return 8 + (seed % 22); });
}

export default standardTemplate;
