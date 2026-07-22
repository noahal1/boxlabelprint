import type { LabelTemplate } from './types';
import standardTemplate from './standard';
import compactTemplate from './compact';
import withLogoTemplate from './withLogo';
import detailedTemplate from './detailed';
import factoryTemplate from './factory';

/** 所有可用模板 */
export const templates: LabelTemplate[] = [
  standardTemplate,
  compactTemplate,
  withLogoTemplate,
  detailedTemplate,
  factoryTemplate,
];

/** 根据 ID 获取模板 */
export function getTemplateById(id: string): LabelTemplate {
  const tpl = templates.find((t) => t.id === id);
  return tpl || standardTemplate;
}

/** 获取默认模板 */
export function getDefaultTemplate(): LabelTemplate {
  return standardTemplate;
}

export type { LabelTemplate, LabelData, TemplateRenderOptions } from './types';
