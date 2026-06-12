// packages/shared/src/generation/provider.ts
// 中文注释：大模型供应商辅助处理工具

import type { GenerationProviderId } from './types.ts';

/**
 * 获取供应商的友好显示名称
 */
export function getProviderDisplayName(providerId: GenerationProviderId): string {
  const displayNames: Record<GenerationProviderId, string> = {
    google: 'Google Gemini',
    'gpt-best': 'GPT Best',
    '12ai': '12AI Compatible',
    suxi: 'Suxi OpenAI',
    wuyinkeji: '无垠科技 Suchuang',
    newapi: 'NewAPI Comfly',
    acedata: 'AceData Route',
    custom: '自定义服务商',
  };
  return displayNames[providerId] || '未知供应商';
}

/**
 * 校验字符串是否为合法的供应商ID
 */
export function isValidProviderId(provider: string): provider is GenerationProviderId {
  const validProviders: Set<string> = new Set([
    'google',
    'gpt-best',
    '12ai',
    'suxi',
    'wuyinkeji',
    'newapi',
    'acedata',
    'custom',
  ]);
  return validProviders.has(provider);
}
