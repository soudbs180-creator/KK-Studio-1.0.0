/**
 * @file providerNodeModelNormalization.ts
 * @description 根据切换后的 ApiProviderId，规范化已有画布节点（如 PromptNode 或 GeneratedImage）的模型配置。
 * 确保节点指向的模型是当前新 Provider 确实支持的，并带有合适的价格/文档字段。
 */

import { findBestMatchingModel } from './providerModelSelection.ts';
import type { ApiProviderId, ProviderModelCategory } from '../config/providerModelLibraries.ts';

/**
 * 规范化节点模型和提供商配置信息。
 * @param currentModel 当前节点上的 model 字段
 * @param currentProvider 当前节点上的 provider 字段
 * @param nextProviderId 即将切换到的目标 Provider ID (suchuang, yunwu, comfly)
 * @param mode 节点生成模式：'image' | 'video' | 'audio' | 'text' | 'chat'等
 * @param isGenerating 节点是否正在执行任务（进行中的任务应当跳过规范化，防止破坏生成链路）
 */
export function normalizeNodeModelForProvider(
  currentModel: string,
  currentProvider: string,
  nextProviderId: ApiProviderId,
  mode: 'image' | 'video' | 'audio' | 'text' | 'chat' | string,
  isGenerating?: boolean
): { model: string; provider?: string; modelLabel?: string } {
  // 进行中的任务跳过规范化，直接返回原值
  if (isGenerating) {
    return { model: currentModel, provider: currentProvider };
  }

  // 映射节点类别
  let category: ProviderModelCategory = 'image';
  if (mode === 'video') {
    category = 'video';
  } else if (mode === 'audio') {
    category = 'audio';
  } else if (mode === 'text' || mode === 'chat') {
    category = 'text';
  }

  // 获取匹配模型
  const matched = findBestMatchingModel(nextProviderId, category, currentModel);
  if (!matched) {
    // 如果该品类下无可用模型（例如速创下文本模型数为 0），则清空模型与 provider 字段
    return { model: '', provider: '', modelLabel: '' };
  }

  // 这里的 matched.id 对应 ModelPreset 的 id，而 matched.modelId 对应 SuchuangModel 的 modelId
  const finalModelId = 'modelId' in matched ? matched.modelId : matched.id;
  const finalModelLabel = 'name' in matched ? matched.name : matched.label;

  // 将 provider 适配成适合前端调用的名称
  const finalProvider = nextProviderId === 'suchuang' ? 'SuchuangProvider' : matched.provider || 'Google';

  return {
    model: finalModelId,
    provider: finalProvider,
    modelLabel: finalModelLabel
  };
}
