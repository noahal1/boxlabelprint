import type { FieldDefinition, BoxLabel, BoxType } from '../types';

/** 从后端加载指定箱型的字段定义 */
export async function loadFieldDefinitions(boxType: BoxType = 'inner'): Promise<FieldDefinition[]> {
  if (!window.electronAPI) {
    return getDefaultFieldDefinitions(boxType);
  }
  try {
    return await window.electronAPI.getFieldDefinitions(boxType);
  } catch {
    return getDefaultFieldDefinitions(boxType);
  }
}

/** 默认字段定义（按箱型） */
export function getDefaultFieldDefinitions(boxType: BoxType): FieldDefinition[] {
  if (boxType === 'outer') {
    return [
      { key: 'supplier_code', label: '供应商代码', type: 'text', required: true, sort_order: 1 },
      { key: 'material_code', label: '物料编码', type: 'text', required: true, sort_order: 2 },
      { key: 'alloy_status', label: '合金状态', type: 'text', required: false, sort_order: 3 },
      { key: 'specification', label: '规格', type: 'text', required: true, sort_order: 4 },
      { key: 'batch_no', label: '批号', type: 'text', required: true, sort_order: 5 },
      { key: 'length', label: '长度', type: 'number', required: false, sort_order: 6 },
      { key: 'net_weight', label: '净重', type: 'number', required: true, sort_order: 7 },
      { key: 'gross_weight', label: '毛重', type: 'number', required: true, sort_order: 8 },
    ];
  }
  // 内箱默认
  return [
    { key: 'supplier_code', label: '供应商代码', type: 'text', required: true, sort_order: 1 },
    { key: 'material_code', label: '物料编码', type: 'text', required: true, sort_order: 2 },
    { key: 'alloy_status', label: '合金状态', type: 'text', required: false, sort_order: 3 },
    { key: 'specification', label: '规格', type: 'text', required: true, sort_order: 4 },
    { key: 'batch_no', label: '批号', type: 'text', required: true, sort_order: 5 },
    { key: 'length', label: '长度', type: 'number', required: false, sort_order: 6 },
    { key: 'net_weight', label: '净重', type: 'number', required: true, sort_order: 7 },
    { key: 'gross_weight', label: '毛重', type: 'number', required: true, sort_order: 8 },
  ];
}

export function getSortedFields(defs: FieldDefinition[]): FieldDefinition[] {
  return [...defs].sort((a, b) => a.sort_order - b.sort_order);
}

export function extractDisplayValues(
  label: BoxLabel,
  defs: FieldDefinition[]
): Array<{ label: string; value: string; key: string }> {
  return getSortedFields(defs).map((f) => ({
    key: f.key,
    label: f.label,
    value: label.custom_fields?.[f.key] || '',
  }));
}

export function buildSubmitData(
  boxNumber: string,
  boxType: BoxType,
  defs: FieldDefinition[],
  formValues: Record<string, string>
): {
  box_number: string;
  box_type: BoxType;
  custom_fields: Record<string, string>;
  qr_content: string;
} {
  const custom_fields: Record<string, string> = {};
  for (const field of defs) {
    custom_fields[field.key] = String(formValues[field.key] ?? '').trim();
  }
  return {
    box_number: boxNumber,
    box_type: boxType,
    custom_fields,
    qr_content: boxNumber,
  };
}
