import factoryTemplate from './factory';

/** 所有可用模板（当前仅使用工厂模板） */
export const templates = [factoryTemplate];

/** 根据 ID 获取模板（始终返回工厂模板） */
export function getTemplateById(_id: string): typeof factoryTemplate {
  return factoryTemplate;
}

/** 获取默认模板 */
export function getDefaultTemplate(): typeof factoryTemplate {
  return factoryTemplate;
}

export type { LabelTemplate, LabelData, TemplateRenderOptions } from './types';
