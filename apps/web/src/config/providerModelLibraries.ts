/**
 * @file providerModelLibraries.ts
 * @description 整合多 Provider 模型配置。汇聚 yunwu、comfly、suchuang 的前端模型清单，为设置和模型选择界面提供统一入口。
 */

import { MODEL_PRESETS, CHAT_MODEL_PRESETS, type ModelPreset } from '../services/model/modelPresets.ts';
import {
  SUCHUANG_TEXT_MODELS,
  SUCHUANG_IMAGE_MODELS,
  SUCHUANG_VIDEO_MODELS,
  SUCHUANG_AUDIO_MODELS,
  type SuchuangModel
} from './suchuangModels.ts';

export type ApiProviderId = 'yunwu' | 'comfly' | 'suchuang';
export type ProviderModelCategory = 'text' | 'image' | 'video' | 'audio';

// 转换为通用展示所需要的接口定义类型，使其与 ModelPreset 兼容
export type UnifiedModel = ModelPreset | SuchuangModel;

// 动态提取或定义静态的云雾和 comfly 模型列表，以配合统一库
export const YUNWU_TEXT_MODELS = CHAT_MODEL_PRESETS;
export const YUNWU_IMAGE_MODELS = MODEL_PRESETS.filter(m => m.type === 'image');
export const YUNWU_VIDEO_MODELS = MODEL_PRESETS.filter(m => m.type === 'video');
export const YUNWU_AUDIO_MODELS = MODEL_PRESETS.filter(m => m.type === 'audio');

export const COMFLY_TEXT_MODELS = CHAT_MODEL_PRESETS;
export const COMFLY_IMAGE_MODELS = MODEL_PRESETS.filter(m => m.type === 'image');
export const COMFLY_VIDEO_MODELS = MODEL_PRESETS.filter(m => m.type === 'video');
export const COMFLY_AUDIO_MODELS = MODEL_PRESETS.filter(m => m.type === 'audio');

export const PROVIDER_MODEL_LIBRARIES = {
  yunwu: {
    displayName: '云雾 API',
    docsUrl: 'https://api.wlai.vip/',
    text: YUNWU_TEXT_MODELS,
    image: YUNWU_IMAGE_MODELS,
    video: YUNWU_VIDEO_MODELS,
    audio: YUNWU_AUDIO_MODELS
  },
  comfly: {
    displayName: 'Comfly API',
    docsUrl: 'https://ai.comfly.org/',
    text: COMFLY_TEXT_MODELS,
    image: COMFLY_IMAGE_MODELS,
    video: COMFLY_VIDEO_MODELS,
    audio: COMFLY_AUDIO_MODELS
  },
  suchuang: {
    displayName: '速创 API',
    docsUrl: 'https://api.wuyinkeji.com/user/api-list',
    text: SUCHUANG_TEXT_MODELS,
    image: SUCHUANG_IMAGE_MODELS,
    video: SUCHUANG_VIDEO_MODELS,
    audio: SUCHUANG_AUDIO_MODELS
  }
};

export const getProviderModels = (provider: ApiProviderId, category: ProviderModelCategory): UnifiedModel[] => {
  const lib = PROVIDER_MODEL_LIBRARIES[provider];
  if (!lib) return [];
  return lib[category] || [];
};

export function getProviderModelPriceLabel(model: any): string {
  if (typeof model?.priceLabel === 'string' && model.priceLabel.trim()) return model.priceLabel;
  if (typeof model?.cost === 'number' && model?.priceUnit) return `${model.cost} ${model.priceUnit}`;
  return '价格待同步';
}
