import React from 'react';
import type { LabelTemplate } from './types';

/**
 * 工厂模板 — 按用户提供的布局示意图实现
 *
 * ┌──────────────────────────────────────────────┐
 * │         南宁产投铝基新材料集团有限责任公司       │
 * │                  铝箔事业一部                   │
 * ├──────┬──────┬──────┬──────┤
 * │供应商│值    │物料  │值    │
 * ├──────┼──────┼──────┼──────┤
 * │合金  │值    │规格  │值    │
 * ├──────┼──────┴──────┘      │
 * │箱号  │值           │ QR   │
 * ├──────┤             │      │
 * │批号  │值           │      │
 * ├──────┤             ├──────┤
 * │长度  │值           │手写  │
 * ├──────┤             │标注  │
 * │净重  │值           │      │
 * ├──────┤             │      │
 * │毛重  │值           │      │
 * └──────┴─────────────┴──────┘
 *          ═══ 条形码 ═══
 */

const factoryTemplate: LabelTemplate = {
  id: 'factory',
  name: '工厂模板',
  description: '四列表格 + 右侧二维码 + 底部条码，适配产投铝基标签',
  defaultSize: { width: 100, height: 80 },
  thumbnail: { width: 120, height: 96, color: '#e6f4ff' },

  render(data, options) {
    const { companyName = '', labelWidth = 420 } = options || {};
    const fields = data.displayFields;

    // border color
    const bc = '#000';

    // 公用单元格样式
    const labelStyle: React.CSSProperties = {
      padding: '3px 6px',
      fontSize: 8.5,
      fontWeight: 600,
      color: '#333',
      borderRight: `1px solid ${bc}`,
      borderBottom: `1px solid ${bc}`,
      whiteSpace: 'nowrap',
      background: '#f5f5f5',
    };
    const valueStyle: React.CSSProperties = {
      padding: '3px 6px',
      fontSize: 9,
      fontWeight: 'bold',
      fontFamily: "'Courier New', monospace",
      borderBottom: `1px solid ${bc}`,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    };

    // 取字段辅助
    const f = (idx: number) => fields[idx];
    const v = (idx: number) => f(idx)?.value || '-';
    const l = (idx: number) => f(idx)?.label || '';

    return (
      <div
        style={{
          width: labelWidth,
          background: '#fff',
          border: `2px solid ${bc}`,
          fontFamily: "'Microsoft YaHei', 'Segoe UI', sans-serif",
        }}
      >
        {/* ==============================================
            顶部标题区
            ============================================== */}
        <div
          style={{
            textAlign: 'center',
            padding: '10px 8px 6px',
            borderBottom: `2px solid ${bc}`,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 'bold', letterSpacing: 1.5, lineHeight: 1.4 }}>
            {companyName || '公司名称'}
          </div>
          <div style={{ fontSize: 10, color: '#555', marginTop: 2, letterSpacing: 1 }}>
            铝箔事业一部
          </div>
        </div>

        {/* ==============================================
            主体表格区
            ============================================== */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            borderLeft: `1px solid ${bc}`,
            borderRight: `1px solid ${bc}`,
            tableLayout: 'fixed',
          }}
        >
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '27%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '45%' }} />
          </colgroup>
          <tbody>
            {/* ---- Row 1: 供应商代码 | 值 | 物料编号 | 值 ---- */}
            <tr>
              <td style={labelStyle}>{l(0) || '供应商代码'}</td>
              <td style={valueStyle}>{v(0)}</td>
              <td style={labelStyle}>{l(1) || '物料编号'}</td>
              <td style={{ ...valueStyle, borderRight: 0 }}>{v(1)}</td>
            </tr>

            {/* ---- Row 2: 合金状态 | 值 | 规格 | 值 ---- */}
            <tr>
              <td style={labelStyle}>{l(2) || '合金状态'}</td>
              <td style={valueStyle}>{v(2)}</td>
              <td style={labelStyle}>{l(3) || '规格'}</td>
              <td style={{ ...valueStyle, borderRight: 0 }}>{v(3)}</td>
            </tr>

            {/* ---- Row 3: 箱号 | 值（占 col2）| QR 区（占 col3+col4，跨5行）---- */}
            <tr>
              <td style={labelStyle}>箱号</td>
              <td
                style={{
                  ...valueStyle,
                  padding: '3px 6px',
                  fontSize: 8.5,
                  fontFamily: "'Courier New', monospace",
                  fontWeight: 'bold',
                }}
              >
                {data.box_number}
              </td>
              <td
                colSpan={2}
                rowSpan={5}
                style={{
                  verticalAlign: 'middle',
                  textAlign: 'center',
                  borderBottom: 'none',
                  borderLeft: `1px solid ${bc}`,
                  padding: 0,
                }}
              >
                <div
                  id={`qr-container-${data.box_number}`}
                  style={{
                    width: 72,
                    height: 72,
                    margin: '0 auto',
                    border: '1px solid #ccc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 7,
                    color: '#999',
                    background: '#fff',
                  }}
                >
                  二维码
                </div>
                <div style={{ fontSize: 7, color: '#666', marginTop: 2, lineHeight: 1.4 }}>
                  BZ02
                  <br />
                  BZ09
                </div>
              </td>
            </tr>

            {/* ---- Row 4: 批号 | 值 ---- */}
            <tr>
              <td style={labelStyle}>{l(4) || '批号'}</td>
              <td style={valueStyle}>
                {v(4)}
              </td>
            </tr>

            {/* ---- Row 5: 长度 | 值 ---- */}
            <tr>
              <td style={labelStyle}>{l(5) || '长度（m）'}</td>
              <td style={valueStyle}>
                {v(5)}
              </td>
            </tr>

            {/* ---- Row 6: 净重 | 值 ---- */}
            <tr>
              <td style={labelStyle}>{l(6) || '净重(kg)'}</td>
              <td style={valueStyle}>
                {v(6)}
              </td>
            </tr>

            {/* ---- Row 7: 毛重 | 值 ---- */}
            <tr>
              <td style={{ ...labelStyle, borderBottom: 0 }}>{l(7) || '毛重(kg)'}</td>
              <td style={{ ...valueStyle, borderBottom: 0 }}>
                {v(7)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ==============================================
            底部条码区
            ============================================== */}
        <div
          style={{
            borderTop: `2px solid ${bc}`,
            padding: '8px 10px 6px',
            textAlign: 'center',
          }}
        >
          {/* 一维条码模拟 */}
          <div
            style={{
              display: 'flex',
              gap: 2,
              justifyContent: 'center',
              alignItems: 'flex-end',
              height: 28,
            }}
          >
            {barcodePattern(data.box_number).map((h, i) => (
              <div key={i} style={{ width: 2.5, height: h, background: bc }} />
            ))}
          </div>
          <div
            style={{
              fontSize: 9,
              marginTop: 3,
              fontFamily: 'monospace',
              fontWeight: 'bold',
              letterSpacing: 2,
            }}
          >
            {data.box_number}
          </div>
        </div>
      </div>
    );
  },
};

/** 伪条形码高度序列 */
function barcodePattern(code: string): number[] {
  let seed = 0;
  for (let i = 0; i < code.length; i++)
    seed = (seed + code.charCodeAt(i) * (i + 1)) % 100;
  return Array.from({ length: 36 }, (_, i) => {
    seed = (seed * 7 + 13) % 100;
    return 6 + (seed % 24);
  });
}

export default factoryTemplate;
