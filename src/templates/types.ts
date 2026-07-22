import type { ReactNode } from 'react';

/** 模板中显示的字段条目 */
export interface DisplayField {
  key: string;
  label: string;
  value: string;
}

/** 标签模板渲染数据 */
export interface LabelData {
  box_number: string;
  qr_content: string;
  /** 按顺序排列的显示字段列表 */
  displayFields: DisplayField[];
}

/** 标签模板定义 */
export interface LabelTemplate {
  id: string;
  name: string;
  description: string;
  defaultSize: { width: number; height: number };
  thumbnail: { width: number; height: number; color: string };
  render: (data: LabelData, options?: TemplateRenderOptions) => ReactNode;
}

/** 模板渲染选项 */
export interface TemplateRenderOptions {
  companyName?: string;
  companyLogo?: string;
  labelWidth?: number;
}
