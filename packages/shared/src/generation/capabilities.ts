// packages/shared/src/generation/capabilities.ts
// 中文注释：大模型供应商能力特征判断

import type { GenerationProviderId, GenerationSurface } from './types.ts';

/**
 * 校验模型是否为 Gemini 风格或 Imagen 风格的生成模型
 */
export function isGeminiImageModel(modelId?: string): boolean {
  if (!modelId) return false;
  const lower = modelId.toLowerCase();
  return (
    lower.includes('gemini') ||
    lower.includes('imagen') ||
    lower.includes('nano-banana') ||
    lower.includes('banana')
  );
}

/**
 * 判断指定供应商在特定模型下是否必须使用异步任务链路
 */
export function isAsyncPreferredProvider(
  providerId: GenerationProviderId,
  modelId?: string
): boolean {
  if (providerId === 'wuyinkeji') {
    return true; // 无垠科技的模型必须走 documented async 契约
  }
  if (providerId === '12ai') {
    // 12ai 模型可能优先支持异步生成，但可配置
    if (modelId && modelId.toLowerCase().includes('async')) {
      return true;
    }
  }
  return false;
}

/**
 * 映射特定的 Surface 是否为异步
 */
export function isAsyncSurface(surface: GenerationSurface): boolean {
  return surface === 'async-image';
}
