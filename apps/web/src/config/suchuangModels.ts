/**
 * @file suchuangModels.ts
 * @description 速创 API 的专属模型库定义。包含 0 个文本模型、6 个图片模型、8 个视频模型和 3 个音频模型。
 * 所有模型参数与官方价格同步至 2026-06-06 价格快照。
 */

export interface SuchuangModel {
  name: string;
  provider: 'SuchuangProvider';
  vendor: string;
  modelId: string;
  status: '正常' | '维护中';
  docId?: number;
  docUrl?: string;
  priceLabel?: string;
  priceUnit?: string;
  cost?: number;
  maxConcurrent?: number;
  maxInputs?: number;
  supportedReferenceTypes?: string[];
  resolutions?: string[];
  aspectRatios?: string[];
  aliases?: string[];
  endpoint: Record<string, { url: string; model: string }>;
}

// 文本模型数量为 0
export const SUCHUANG_TEXT_MODELS: SuchuangModel[] = [];

// 图片模型：6 个
export const SUCHUANG_IMAGE_MODELS: SuchuangModel[] = [
  {
    name: 'GPT-Image-2',
    provider: 'SuchuangProvider',
    vendor: 'OpenAI',
    modelId: 'image_gpt',
    status: '正常',
    docId: 53,
    docUrl: 'https://api.wuyinkeji.com/doc/53',
    priceLabel: '0.1 元/张',
    priceUnit: '元/张',
    cost: 0.1,
    maxConcurrent: 2,
    maxInputs: 10,
    supportedReferenceTypes: ['text', 'image'],
    aspectRatios: ['1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4'],
    endpoint: {
      'text-to-image': { url: '/api/async/image_gpt', model: 'image_gpt' },
      'image-to-image': { url: '/api/async/image_gpt', model: 'image_gpt' }
    }
  },
  {
    name: 'NanoBanana',
    provider: 'SuchuangProvider',
    vendor: 'Google',
    modelId: 'image_nanoBanana',
    status: '正常',
    docId: 54,
    docUrl: 'https://api.wuyinkeji.com/doc/54',
    priceLabel: '0.1 元/张',
    priceUnit: '元/张',
    cost: 0.1,
    maxConcurrent: 2,
    maxInputs: 14,
    supportedReferenceTypes: ['text', 'image'],
    resolutions: ['1K', '2K', '4K'],
    aspectRatios: ['1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4'],
    endpoint: {
      'text-to-image': { url: '/api/async/image_nanoBanana', model: 'image_nanoBanana' },
      'image-to-image': { url: '/api/async/image_nanoBanana', model: 'image_nanoBanana' }
    }
  },
  {
    name: 'NanoBanana_pro',
    provider: 'SuchuangProvider',
    vendor: 'Google',
    modelId: 'image_nanoBanana_pro',
    status: '正常',
    docId: 55,
    docUrl: 'https://api.wuyinkeji.com/doc/55',
    priceLabel: '0.3 元/张',
    priceUnit: '元/张',
    cost: 0.3,
    maxConcurrent: 2,
    maxInputs: 14,
    supportedReferenceTypes: ['text', 'image'],
    resolutions: ['1K', '2K', '4K'],
    aspectRatios: ['1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4', '1:4', '1:8', '4:1', '8:1'],
    endpoint: {
      'text-to-image': { url: '/api/async/image_nanoBanana_pro', model: 'image_nanoBanana_pro' },
      'image-to-image': { url: '/api/async/image_nanoBanana_pro', model: 'image_nanoBanana_pro' }
    }
  },
  {
    name: 'Wan2.6',
    provider: 'SuchuangProvider',
    vendor: 'Wan',
    modelId: 'image_wan2.6',
    status: '正常',
    docId: 56,
    docUrl: 'https://api.wuyinkeji.com/doc/56',
    priceLabel: '0.2 元/张',
    priceUnit: '元/张',
    cost: 0.2,
    maxConcurrent: 2,
    maxInputs: 4,
    supportedReferenceTypes: ['text', 'image'],
    resolutions: ['1K', '2K', '4K'],
    aspectRatios: ['1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4'],
    endpoint: {
      'text-to-image': { url: '/api/async/image_wan2.6', model: 'image_wan2.6' },
      'image-to-image': { url: '/api/async/image_wan2.6', model: 'image_wan2.6' }
    }
  },
  {
    name: 'grok_imagine',
    provider: 'SuchuangProvider',
    vendor: 'xAI',
    modelId: 'image_grok_imagine',
    status: '正常',
    docId: 63,
    docUrl: 'https://api.wuyinkeji.com/doc/63',
    priceLabel: '0.1 元/张',
    priceUnit: '元/张',
    cost: 0.1,
    maxConcurrent: 2,
    maxInputs: 10,
    supportedReferenceTypes: ['text', 'image'],
    resolutions: ['1K', '2K', '4K'],
    aspectRatios: ['1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4'],
    endpoint: {
      'text-to-image': { url: '/api/async/image_grok_imagine', model: 'image_grok_imagine' },
      'image-to-image': { url: '/api/async/image_grok_imagine', model: 'image_grok_imagine' }
    }
  },
  {
    name: 'NanoBanana2',
    provider: 'SuchuangProvider',
    vendor: 'Google',
    modelId: 'image_nanoBanana2',
    status: '正常',
    docId: 65,
    docUrl: 'https://api.wuyinkeji.com/doc/65',
    priceLabel: '0.1 元/张',
    priceUnit: '元/张',
    cost: 0.1,
    maxConcurrent: 2,
    maxInputs: 14,
    supportedReferenceTypes: ['text', 'image'],
    resolutions: ['1K', '2K', '4K'],
    aspectRatios: ['1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4', '1:4', '1:8', '4:1', '8:1'],
    endpoint: {
      'text-to-image': { url: '/api/async/image_nanoBanana2', model: 'image_nanoBanana2' },
      'image-to-image': { url: '/api/async/image_nanoBanana2', model: 'image_nanoBanana2' }
    }
  }
];

// 视频模型：8 个
export const SUCHUANG_VIDEO_MODELS: SuchuangModel[] = [
  {
    name: 'google_omni',
    provider: 'SuchuangProvider',
    vendor: 'Google',
    modelId: 'video_google_omni',
    status: '正常',
    docId: 72,
    docUrl: 'https://api.wuyinkeji.com/doc/72',
    priceLabel: '0.1 元/秒',
    priceUnit: '元/秒',
    cost: 0.1,
    maxConcurrent: 1,
    maxInputs: 7,
    supportedReferenceTypes: ['text', 'image'],
    resolutions: ['480p', '720p', '1080p'],
    aspectRatios: ['1:1', '2:3', '3:2', '9:16', '16:9', '3:4', '4:3', '5:4', '4:5', '21:9'],
    endpoint: {
      'text-to-video': { url: '/api/async/video_google_omni', model: 'video_google_omni' },
      'image-to-video': { url: '/api/async/video_google_omni', model: 'video_google_omni' }
    }
  },
  {
    name: 'video_vidu',
    provider: 'SuchuangProvider',
    vendor: 'Vidu',
    modelId: 'video_vidu',
    status: '正常',
    docId: 71,
    docUrl: 'https://api.wuyinkeji.com/doc/71',
    priceLabel: '1.0 元/秒',
    priceUnit: '元/秒',
    cost: 1.0,
    maxConcurrent: 1,
    maxInputs: 7,
    supportedReferenceTypes: ['text', 'image'],
    resolutions: ['480p', '720p', '1080p'],
    aspectRatios: ['1:1', '2:3', '3:2', '9:16', '16:9', '3:4', '4:3'],
    endpoint: {
      'text-to-video': { url: '/api/async/video_vidu', model: 'video_vidu' },
      'image-to-video': { url: '/api/async/video_vidu', model: 'video_vidu' }
    }
  },
  {
    name: 'video_omni',
    provider: 'SuchuangProvider',
    vendor: 'Google',
    modelId: 'video_omni',
    status: '正常',
    docId: 70,
    docUrl: 'https://api.wuyinkeji.com/doc/70',
    priceLabel: '1.0 元/秒',
    priceUnit: '元/秒',
    cost: 1.0,
    maxConcurrent: 1,
    maxInputs: 7,
    supportedReferenceTypes: ['text', 'image'],
    resolutions: ['480p', '720p', '1080p'],
    aspectRatios: ['1:1', '2:3', '3:2', '9:16', '16:9', '3:4', '4:3'],
    endpoint: {
      'text-to-video': { url: '/api/async/video_omni', model: 'video_omni' },
      'image-to-video': { url: '/api/async/video_omni', model: 'video_omni' }
    }
  },
  {
    name: 'Digital_Humans',
    provider: 'SuchuangProvider',
    vendor: 'Custom',
    modelId: 'video_digital_humans',
    status: '正常',
    docId: 66,
    docUrl: 'https://api.wuyinkeji.com/doc/66',
    priceLabel: '0.02 元/秒',
    priceUnit: '元/秒',
    cost: 0.02,
    maxConcurrent: 1,
    maxInputs: 2,
    supportedReferenceTypes: ['text', 'image'],
    resolutions: ['480p', '720p', '1080p'],
    aspectRatios: ['1:1', '2:3', '3:2', '9:16', '16:9', '3:4', '4:3'],
    endpoint: {
      'text-to-video': { url: '/api/async/video_digital_humans', model: 'video_digital_humans' },
      'image-to-video': { url: '/api/async/video_digital_humans', model: 'video_digital_humans' }
    }
  },
  {
    name: 'Package_1.0',
    provider: 'SuchuangProvider',
    vendor: 'Custom',
    modelId: 'video_package',
    status: '维护中',
    docId: 57,
    docUrl: 'https://api.wuyinkeji.com/doc/57',
    priceLabel: '0.02 元/秒',
    priceUnit: '元/秒',
    cost: 0.02,
    maxConcurrent: 1,
    maxInputs: 1,
    supportedReferenceTypes: ['text', 'image'],
    resolutions: ['480p', '720p'],
    aspectRatios: ['1:1', '16:9', '9:16'],
    endpoint: {
      'text-to-video': { url: '/api/async/video_package', model: 'video_package' },
      'image-to-video': { url: '/api/async/video_package', model: 'video_package' }
    }
  },
  {
    name: 'veo3.1_fast',
    provider: 'SuchuangProvider',
    vendor: 'Google',
    modelId: 'video_veo3.1_fast',
    status: '维护中',
    docId: 48,
    docUrl: 'https://api.wuyinkeji.com/doc/48',
    priceLabel: '0.05 元/秒',
    priceUnit: '元/秒',
    cost: 0.05,
    maxConcurrent: 1,
    maxInputs: 1,
    supportedReferenceTypes: ['text', 'image'],
    resolutions: ['480p', '720p'],
    aspectRatios: ['1:1', '16:9', '9:16'],
    aliases: ['veo-3.1', 'veo 3.1', 'veo3.1'],
    endpoint: {
      'text-to-video': { url: '/api/async/video_veo3.1_fast', model: 'video_veo3.1_fast' },
      'image-to-video': { url: '/api/async/video_veo3.1_fast', model: 'video_veo3.1_fast' }
    }
  },
  {
    name: 'grok_imagine',
    provider: 'SuchuangProvider',
    vendor: 'xAI',
    modelId: 'video_grok_imagine',
    status: '正常',
    docId: 62,
    docUrl: 'https://api.wuyinkeji.com/doc/62',
    priceLabel: '0.05 元/秒',
    priceUnit: '元/秒',
    cost: 0.05,
    maxConcurrent: 1,
    maxInputs: 1,
    supportedReferenceTypes: ['text', 'image'],
    resolutions: ['480p', '720p'],
    aspectRatios: ['1:1', '16:9', '9:16'],
    endpoint: {
      'text-to-video': { url: '/api/async/video_grok_imagine', model: 'video_grok_imagine' },
      'image-to-video': { url: '/api/async/video_grok_imagine', model: 'video_grok_imagine' }
    }
  },
  {
    name: 'Wan2.6',
    provider: 'SuchuangProvider',
    vendor: 'Wan',
    modelId: 'video_wan2.6',
    status: '正常',
    docId: 59,
    docUrl: 'https://api.wuyinkeji.com/doc/59',
    priceLabel: '0.8 元/秒',
    priceUnit: '元/秒',
    cost: 0.8,
    maxConcurrent: 1,
    maxInputs: 1,
    supportedReferenceTypes: ['text', 'image'],
    resolutions: ['480p', '720p', '1080p'],
    aspectRatios: ['1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4'],
    endpoint: {
      'text-to-video': { url: '/api/async/video_wan2.6', model: 'video_wan2.6' },
      'image-to-video': { url: '/api/async/video_wan2.6', model: 'video_wan2.6' }
    }
  }
];

// 音频模型：3 个
export const SUCHUANG_AUDIO_MODELS: SuchuangModel[] = [
  {
    name: '语音合成',
    provider: 'SuchuangProvider',
    vendor: 'Custom',
    modelId: 'audio_tts',
    status: '正常',
    docId: 67,
    docUrl: 'https://api.wuyinkeji.com/doc/67',
    priceLabel: '0.0006 元/字符',
    priceUnit: '元/字符',
    cost: 0.0006,
    endpoint: {
      'text-to-speech': { url: '/api/async/audio_tts', model: 'audio_tts' }
    }
  },
  {
    name: '语音合成（同步）',
    provider: 'SuchuangProvider',
    vendor: 'Custom',
    modelId: 'voice_composite',
    status: '正常',
    docId: 13,
    docUrl: 'https://api.wuyinkeji.com/doc/13',
    priceLabel: '0.0006 元/字符',
    priceUnit: '元/字符',
    cost: 0.0006,
    endpoint: {
      'text-to-speech': { url: '/api/voice/composite', model: 'voice_composite' }
    }
  },
  {
    name: '语音克隆（同步）',
    provider: 'SuchuangProvider',
    vendor: 'Custom',
    modelId: 'voice_clone',
    status: '正常',
    docId: 12,
    docUrl: 'https://api.wuyinkeji.com/doc/12',
    priceLabel: '6.0 元/次',
    priceUnit: '元/次',
    cost: 6.0,
    endpoint: {
      'voice-clone': { url: '/api/voice/clone', model: 'voice_clone' }
    }
  }
];
