// apps/web/src/services/llm/wuyinCatalog.ts
// 职责：提供速创 API 的共享模型目录定义、内置 Fallback 目录以及“只填 Key”的一键接入配置构造逻辑。

export type WuyinModelKind = 'image' | 'video' | 'audio' | 'chat' | 'utility';

export type WuyinSubmitContentType =
  | 'application/json'
  | 'application/x-www-form-urlencoded';

export interface WuyinCatalogItem {
  id: string;
  name: string;
  kind: WuyinModelKind;
  endpointPath: string;
  method: 'GET' | 'POST';
  submitContentType: WuyinSubmitContentType;
  detailPath?: string;
  price?: number;
  priceUnit?: string;
  aliases: string[];
  enabled: boolean;
}

export const WUYIN_DEFAULT_BASE_URL = 'https://api.wuyinkeji.com';
export const WUYIN_ASYNC_DETAIL_PATH = '/api/async/detail';

export const WUYIN_DEFAULT_CATALOG: WuyinCatalogItem[] = [
  {
    id: 'image_gpt',
    name: 'GPT-Image-2',
    kind: 'image',
    endpointPath: '/api/async/image_gpt',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.1,
    priceUnit: '张',
    aliases: ['gpt-image-2', 'gpt image 2', 'image_gpt'],
    enabled: true,
  },
  {
    id: 'image_nanoBanana2',
    name: 'NanoBanana2',
    kind: 'image',
    endpointPath: '/api/async/image_nanoBanana2',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.1,
    priceUnit: '张',
    aliases: ['nanobanana2', 'nano-banana-2', 'nano banana 2', 'gemini-3.1-flash-image-preview', 'gemini-3.1-flash-image', 'image_nanoBanana2'],
    enabled: true,
  },
  {
    id: 'image_grok_imagine',
    name: 'grok_imagine',
    kind: 'image',
    endpointPath: '/api/async/image_grok_imagine',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.1,
    priceUnit: '张',
    aliases: ['grok_imagine', 'grok imagine', 'image_grok_imagine'],
    enabled: true,
  },
  {
    id: 'image_nanoBanana_pro',
    name: 'NanoBanana_pro',
    kind: 'image',
    endpointPath: '/api/async/image_nanoBanana_pro',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.3,
    priceUnit: '张',
    aliases: ['nanobanana_pro', 'nanobanana-pro', 'nano-banana-pro', 'nano banana pro', 'gemini-3-pro-image-preview', 'image_nanoBanana_pro'],
    enabled: true,
  },
  {
    id: 'image_nanoBanana',
    name: 'NanoBanana',
    kind: 'image',
    endpointPath: '/api/async/image_nanoBanana',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.1,
    priceUnit: '张',
    aliases: ['nanobanana', 'nano-banana', 'nano banana', 'gemini-2.5-flash-image', 'image_nanoBanana'],
    enabled: true,
  },
  {
    id: 'image_wan2.6',
    name: 'Wan2.6',
    kind: 'image',
    endpointPath: '/api/async/image_wan2.6',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.2,
    priceUnit: '张',
    aliases: ['wan2.6', 'wan26', 'wan image', 'image_wan2.6'],
    enabled: true,
  },
  {
    id: 'video_google_omni',
    name: 'google_omni',
    kind: 'video',
    endpointPath: '/api/async/video_google_omni',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.1,
    priceUnit: '秒',
    aliases: ['google_omni', 'google omni', 'video_google_omni'],
    enabled: true,
  },
  {
    id: 'video_vidu',
    name: 'video_vidu',
    kind: 'video',
    endpointPath: '/api/async/video_vidu',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 1,
    priceUnit: '秒',
    aliases: ['vidu', 'video_vidu'],
    enabled: true,
  },
  {
    id: 'video_omni',
    name: 'video_omni',
    kind: 'video',
    endpointPath: '/api/async/video_omni',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 1,
    priceUnit: '秒',
    aliases: ['video_omni', 'omni video'],
    enabled: true,
  },
  {
    id: 'video_digital_humans',
    name: 'Digital_Humans',
    kind: 'video',
    endpointPath: '/api/async/video_digital_humans',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.02,
    priceUnit: '秒',
    aliases: ['digital_humans', 'digital humans', 'video_digital_humans'],
    enabled: true,
  },
  {
    id: 'video_package',
    name: 'Package_1.0',
    kind: 'video',
    endpointPath: '/api/async/video_package',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.01,
    priceUnit: '秒',
    aliases: ['package_1.0', 'video_package'],
    enabled: true,
  },
  {
    id: 'video_veo3.1_fast',
    name: 'veo3.1_fast',
    kind: 'video',
    endpointPath: '/api/async/video_veo3.1_fast',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.05,
    priceUnit: '秒',
    aliases: ['veo3.1_fast', 'veo 3.1 fast', 'video_veo3.1_fast'],
    enabled: true,
  },
  {
    id: 'video_grok_imagine',
    name: 'grok_imagine',
    kind: 'video',
    endpointPath: '/api/async/video_grok_imagine',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.05,
    priceUnit: '秒',
    aliases: ['grok_imagine', 'grok imagine video', 'video_grok_imagine'],
    enabled: true,
  },
  {
    id: 'video_wan2.6',
    name: 'Wan2.6',
    kind: 'video',
    endpointPath: '/api/async/video_wan2.6',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.8,
    priceUnit: '秒',
    aliases: ['wan2.6', 'wan26', 'wan video', 'video_wan2.6'],
    enabled: true,
  },
  {
    id: 'chat_index',
    name: 'ChatAPI',
    kind: 'chat',
    endpointPath: '/api/chat/index',
    method: 'POST',
    submitContentType: 'application/x-www-form-urlencoded',
    price: 0,
    priceUnit: 'token',
    aliases: ['chatapi', 'chat_index', 'api/chat/index'],
    enabled: true,
  },
  {
    id: 'audio_tts',
    name: '语音合成',
    kind: 'audio',
    endpointPath: '/api/async/audio_tts',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/async/detail',
    price: 0.0006,
    priceUnit: '字符',
    aliases: ['audio_tts', 'tts'],
    enabled: true,
  },
  {
    id: 'voice_composite',
    name: '语音合成（同步）',
    kind: 'audio',
    endpointPath: '/api/voice/composite',
    method: 'POST',
    submitContentType: 'application/x-www-form-urlencoded',
    price: 0.0006,
    priceUnit: '字符',
    aliases: ['voice_composite', 'voice composite'],
    enabled: true,
  },
  {
    id: 'voice_clone',
    name: '语音克隆（同步）',
    kind: 'audio',
    endpointPath: '/api/voice/clone',
    method: 'POST',
    submitContentType: 'application/x-www-form-urlencoded',
    price: 6,
    priceUnit: '次',
    aliases: ['voice_clone', 'voice clone'],
    enabled: true,
  },
  {
    id: 'sora2-new',
    name: 'sora2-new',
    kind: 'video',
    endpointPath: '/api/sora2-new/submit',
    method: 'POST',
    submitContentType: 'application/json',
    detailPath: '/api/sora2/detail',
    price: 1.2,
    priceUnit: '次',
    aliases: ['sora2-new', 'sora2'],
    enabled: true,
  },
  {
    id: 'img_split',
    name: '智能拼图',
    kind: 'utility',
    endpointPath: '/api/img/split',
    method: 'POST',
    submitContentType: 'application/x-www-form-urlencoded',
    price: 0.03,
    priceUnit: '次',
    aliases: ['img_split', 'split'],
    enabled: false,
  },
];

export function buildWuyinOneKeyProvider(apiKey: string, catalog: WuyinCatalogItem[] = WUYIN_DEFAULT_CATALOG) {
  const key = String(apiKey || '').trim();
  if (!key) throw new Error('请填写速创 API 密钥');

  const supportedModels = catalog
    .filter(item => item.enabled)
    .map(item => item.id);

  const provider = {
    id: 'provider_wuyin',
    name: '速创 API',
    provider: 'Wuyin',
    baseUrl: WUYIN_DEFAULT_BASE_URL,
    apiKey: key,
    format: 'openai' as const,
    authMethod: 'header' as const,
    headerName: 'Authorization',
    authorizationValueFormat: 'raw',
    compatibilityMode: 'standard' as const,
    models: catalog.filter(item => item.enabled).map(item => item.id), // 保存为模型ID的数组
    pricingSnapshot: {
      fetchedAt: Date.now(),
      source: 'wuyin-catalog',
      rows: catalog as any[],
      updatedAt: new Date().toISOString(),
    },
  };

  const keySlot = {
    id: 'slot_wuyin',
    name: '速创 API',
    provider: 'Wuyin',
    type: 'third-party' as const,
    key,
    baseUrl: WUYIN_DEFAULT_BASE_URL,
    format: 'openai' as const,
    authMethod: 'header' as const,
    headerName: 'Authorization',
    compatibilityMode: 'standard' as const,
    supportedModels,
    status: 'valid' as const,
    pricingSnapshot: provider.pricingSnapshot,
  };

  return { provider, keySlot };
}
