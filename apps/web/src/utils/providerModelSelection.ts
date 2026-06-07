/**
 * @file providerModelSelection.ts
 * @description 前端 Provider 模型匹配与选择核心逻辑。
 * 提供对不同 Provider 的模型名称进行规范化和比对，支持别名与端点字段的模糊检索。
 */

import { getProviderModels, type ApiProviderId, type ProviderModelCategory, type UnifiedModel } from '../config/providerModelLibraries.ts';

/**
 * 规范化模型名称以便于做模糊匹配比对。
 * 清除空格、下划线、中划线和点号，并转为小写。
 */
export function normalizeModelName(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s._-]+/g, '');
}

/**
 * 在指定的 Provider 模型库中寻找最匹配的模型。
 * 匹配顺序：
 * 1. 精确/规范化匹配 name
 * 2. 精确/规范化匹配 modelId
 * 3. 精确/规范化匹配 别名 aliases
 * 4. 检查 endpoint 中的具体 model 映射关系
 */
export function findBestMatchingModel(
  provider: ApiProviderId,
  category: ProviderModelCategory,
  currentModelId: string
): UnifiedModel | null {
  const models = getProviderModels(provider, category);
  if (models.length === 0) {
    return null;
  }

  const targetNorm = normalizeModelName(currentModelId);

  // 1. 优先比对 name 和 modelId
  for (const m of models) {
    const name = 'name' in m ? m.name : m.label;
    const id = 'modelId' in m ? m.modelId : m.id;
    if (normalizeModelName(name) === targetNorm || normalizeModelName(id) === targetNorm) {
      return m;
    }
  }

  // 2. 检查 aliases 别名映射
  for (const m of models) {
    const aliases = (m as any).aliases;
    if (Array.isArray(aliases)) {
      for (const alias of aliases) {
        if (normalizeModelName(alias) === targetNorm) {
          return m;
        }
      }
    }
  }

  // 3. 检查 endpoint 中的 model 匹配
  for (const m of models) {
    const endpoints = (m as any).endpoint;
    if (endpoints && typeof endpoints === 'object') {
      for (const key in endpoints) {
        if (Object.prototype.hasOwnProperty.call(endpoints, key)) {
          const endpointModel = endpoints[key]?.model;
          if (endpointModel && normalizeModelName(endpointModel) === targetNorm) {
            return m;
          }
        }
      }
    }
  }

  // 4. 未能匹配时返回第一个可用模型
  return models[0];
}
