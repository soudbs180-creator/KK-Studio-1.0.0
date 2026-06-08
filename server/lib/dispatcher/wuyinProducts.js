/**
 * @file wuyinProducts.js
 * @module server/lib/dispatcher
 * @description Wuyin/速创 API 文档化产品定义。这里只记录二次点击 /type/all 产品目录后核对到的 endpoint、
 *              请求方法、Content-Type、鉴权、参数字段、结果查询和价格信息。
 *              同一模型收到新文档时必须替换该模型定义，禁止与旧字段合并。
 */

const WUYIN_ASYNC_DETAIL_ENDPOINT = 'https://api.wuyinkeji.com/api/async/detail';
const WUYIN_SORA2_DETAIL_ENDPOINT = 'https://api.wuyinkeji.com/api/sora2/detail';
const WUYIN_CATALOG_URL = 'https://api.wuyinkeji.com/type/all';

const ASYNC_AUTH = 'Authorization header and key query parameter';
const HEADER_AUTH = 'Authorization header';
const IMAGE_ASPECTS = ['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'];
const GROK_ASPECTS = ['2:3', '3:2', '1:1', '16:9', '9:16'];

function field(required, type, extra = {}) {
  return { required, type, ...extra };
}

function asyncProduct(config) {
  return {
    method: 'POST',
    auth: ASYNC_AUTH,
    resultEndpoint: config.resultEndpoint || WUYIN_ASYNC_DETAIL_ENDPOINT,
    resultMode: config.resultMode || 'wuyin-async-detail',
    ...config,
  };
}

const WUYIN_PRODUCTS = {
  image_gpt: asyncProduct({
    id: 'image_gpt',
    displayName: 'GPT-Image-2',
    docUrl: 'https://api.wuyinkeji.com/doc/53',
    category: 'image',
    endpoint: 'https://api.wuyinkeji.com/api/async/image_gpt',
    contentType: 'application/json',
    price: { amount: 0.1, currency: 'CNY', unit: 'image', points: 10 },
    qps: 100,
    requestFields: {
      prompt: field(true, 'string'),
      size: field(false, 'string', { default: 'auto', enum: ['auto', '1:1', '3:2', '2:3', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21', '1:3', '3:1', '2:1', '1:2'] }),
      urls: field(false, 'array<string>', { publicUrl: true }),
    },
  }),
  image_nanoBanana2: asyncProduct({
    id: 'image_nanoBanana2',
    displayName: 'NanoBanana2',
    docUrl: 'https://api.wuyinkeji.com/doc/65',
    category: 'image',
    endpoint: 'https://api.wuyinkeji.com/api/async/image_nanoBanana2',
    contentType: 'application/json',
    price: { amount: 0.1, currency: 'CNY', unit: 'image', points: 10 },
    qps: 100,
    requestFields: {
      prompt: field(true, 'string'),
      size: field(false, 'string', { default: '1K', enum: ['1K', '2K', '4K'] }),
      aspectRatio: field(false, 'string', { default: 'auto', enum: IMAGE_ASPECTS }),
      urls: field(false, 'array<string>', { publicUrl: true, maxItems: 14 }),
    },
  }),
  image_grok_imagine: asyncProduct({
    id: 'image_grok_imagine',
    displayName: 'grok_imagine',
    docUrl: 'https://api.wuyinkeji.com/doc/63',
    category: 'image',
    endpoint: 'https://api.wuyinkeji.com/api/async/image_grok_imagine',
    contentType: 'application/json',
    price: { amount: 0.1, currency: 'CNY', unit: 'image', points: 10 },
    qps: 100,
    requestFields: {
      prompt: field(true, 'string'),
      aspect_ratio: field(false, 'string', { default: '2:3', enum: GROK_ASPECTS }),
      image_urls: field(false, 'array<string>', { publicUrl: true }),
    },
  }),
  image_nanoBanana_pro: asyncProduct({
    id: 'image_nanoBanana_pro',
    displayName: 'NanoBanana_pro',
    docUrl: 'https://api.wuyinkeji.com/doc/55',
    category: 'image',
    endpoint: 'https://api.wuyinkeji.com/api/async/image_nanoBanana_pro',
    contentType: 'application/json',
    price: { amount: 0.3, currency: 'CNY', unit: 'image', points: 30 },
    qps: 100,
    requestFields: {
      prompt: field(true, 'string'),
      size: field(false, 'string', { default: '1K', enum: ['1K', '2K', '4K'] }),
      aspectRatio: field(false, 'string', { default: 'auto', enum: IMAGE_ASPECTS }),
      urls: field(false, 'array<string>', { publicUrl: true, maxItems: 14 }),
    },
  }),
  image_nanoBanana: asyncProduct({
    id: 'image_nanoBanana',
    displayName: 'NanoBanana',
    docUrl: 'https://api.wuyinkeji.com/doc/54',
    category: 'image',
    endpoint: 'https://api.wuyinkeji.com/api/async/image_nanoBanana',
    contentType: 'application/json',
    price: { amount: 0.1, currency: 'CNY', unit: 'image', points: 10 },
    qps: 100,
    requestFields: {
      prompt: field(true, 'string'),
      imageSize: field(false, 'string', { default: '1K', enum: ['1K'] }),
      urls: field(false, 'array<string>', { publicUrl: true }),
      aspectRatio: field(false, 'string', { default: 'auto', enum: IMAGE_ASPECTS }),
    },
  }),
  'image_wan2.6': asyncProduct({
    id: 'image_wan2.6',
    displayName: 'Wan2.6',
    docUrl: 'https://api.wuyinkeji.com/doc/56',
    category: 'image',
    endpoint: 'https://api.wuyinkeji.com/api/async/image_wan2.6',
    contentType: 'application/x-www-form-urlencoded;charset:utf-8;',
    price: { amount: 0.2, currency: 'CNY', unit: 'image', points: 20 },
    qps: 100,
    requestFields: {
      prompt: field(true, 'string', { maxLength: 2000 }),
      urls: field(false, 'array<string>', { allowBase64: true }),
      negative_prompt: field(false, 'string', { maxLength: 500 }),
      size: field(false, 'string', { default: '1280*1280' }),
      prompt_extend: field(false, 'boolean', { default: true }),
      watermark: field(false, 'boolean', { default: false }),
      seed: field(false, 'string'),
    },
  }),
  video_google_omni: asyncProduct({
    id: 'video_google_omni',
    displayName: 'google_omni',
    docUrl: 'https://api.wuyinkeji.com/doc/72',
    category: 'video',
    endpoint: 'https://api.wuyinkeji.com/api/async/video_google_omni',
    contentType: 'application/json',
    price: { amount: 0.1, currency: 'CNY', unit: 'second', points: 10 },
    qps: 100,
    requestFields: {
      prompt: field(true, 'string'),
      size: field(false, 'string', { default: '1280x720' }),
      images: field(false, 'string', { publicUrlCsv: true, maxItems: 7 }),
      duration: field(false, 'string', { default: '10' }),
    },
  }),
  video_vidu: asyncProduct({
    id: 'video_vidu',
    displayName: 'video_vidu',
    docUrl: 'https://api.wuyinkeji.com/doc/71',
    category: 'video',
    endpoint: 'https://api.wuyinkeji.com/api/async/video_vidu',
    contentType: 'application/json',
    price: { amount: 1.0, currency: 'CNY', unit: 'second', points: 100 },
    qps: 20,
    requestFields: {
      prompt: field(true, 'string'),
      aspectRatio: field(false, 'string', { default: '16:9', enum: ['16:9', '9:16', '4:3', '3:4', '1:1'] }),
      resolution: field(false, 'string', { default: '720p', enum: ['540p', '720p', '1080p'] }),
      subjects: field(false, 'string', { publicUrlCsv: true, maxItems: 7 }),
      image_url: field(false, 'string', { publicUrlCsv: true, maxItems: 7 }),
    },
  }),
  video_omni: asyncProduct({
    id: 'video_omni',
    displayName: 'video_omni',
    docUrl: 'https://api.wuyinkeji.com/doc/70',
    category: 'video',
    endpoint: 'https://api.wuyinkeji.com/api/async/video_omni',
    contentType: 'application/json',
    price: { amount: 1.0, currency: 'CNY', unit: 'second', points: 100 },
    qps: 20,
    requestFields: {
      prompt: field(true, 'string'),
      aspectRatio: field(false, 'string', { default: '16:9', enum: ['16:9', '9:16', '1:1'] }),
      resolution: field(false, 'string', { default: 'pro', enum: ['std', 'pro', '4k'] }),
      sound: field(false, 'string', { default: 'on', enum: ['on', 'off'] }),
      image_url: field(false, 'string', { publicUrlCsv: true }),
      firstFrameUrl: field(false, 'string', { publicUrl: true }),
      lastFrameUrl: field(false, 'string', { publicUrl: true }),
      video_url: field(false, 'string', { publicUrl: true }),
      duration: field(false, 'string', { default: '5', enum: ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'] }),
    },
  }),
  video_digital_humans: asyncProduct({
    id: 'video_digital_humans',
    displayName: 'Digital_Humans',
    docUrl: 'https://api.wuyinkeji.com/doc/66',
    category: 'video',
    endpoint: 'https://api.wuyinkeji.com/api/async/video_digital_humans',
    contentType: 'application/json',
    price: { amount: 0.02, currency: 'CNY', unit: 'second', points: 2 },
    qps: 100,
    requiresRealName: true,
    requestFields: {
      videoName: field(true, 'string'),
      audioUrl: field(false, 'string', { publicUrl: true }),
      videoUrl: field(false, 'string', { publicUrl: true }),
    },
  }),
  video_package: asyncProduct({
    id: 'video_package',
    displayName: 'Package_1.0',
    docUrl: 'https://api.wuyinkeji.com/doc/57',
    category: 'video',
    endpoint: 'https://api.wuyinkeji.com/api/async/video_package',
    contentType: 'application/json',
    price: { amount: 0.02, currency: 'CNY', unit: 'second', points: 2 },
    qps: 100,
    requestFields: {
      video: field(true, 'string', { publicUrl: true }),
      template_id: field(false, 'string', { default: '1' }),
    },
  }),
  'video_veo3.1_fast': asyncProduct({
    id: 'video_veo3.1_fast',
    displayName: 'veo3.1_fast',
    docUrl: 'https://api.wuyinkeji.com/doc/48',
    category: 'video',
    endpoint: 'https://api.wuyinkeji.com/api/async/video_veo3.1_fast',
    contentType: 'application/json',
    status: 'maintenance',
    enabled: false,
    price: { amount: 0.05, currency: 'CNY', unit: 'second', points: 5 },
    qps: 100,
    requestFields: {
      prompt: field(true, 'string'),
      firstFrameUrl: field(false, 'string', { publicUrl: true }),
      lastFrameUrl: field(false, 'string', { publicUrl: true }),
      urls: field(false, 'array<string>', { publicUrl: true, maxItems: 3 }),
    },
  }),
  video_grok_imagine: asyncProduct({
    id: 'video_grok_imagine',
    displayName: 'grok_imagine',
    docUrl: 'https://api.wuyinkeji.com/doc/62',
    category: 'video',
    endpoint: 'https://api.wuyinkeji.com/api/async/video_grok_imagine',
    contentType: 'application/json',
    price: { amount: 0.05, currency: 'CNY', unit: 'second', points: 5 },
    qps: 100,
    requestFields: {
      prompt: field(true, 'string'),
      duration: field(false, 'string', { default: '10', enum: ['6', '10', '15'] }),
      aspect_ratio: field(false, 'string', { default: '2:3', enum: GROK_ASPECTS }),
      image_urls: field(false, 'array<string>', { publicUrl: true }),
    },
  }),
  'video_wan2.6': asyncProduct({
    id: 'video_wan2.6',
    displayName: 'Wan2.6',
    docUrl: 'https://api.wuyinkeji.com/doc/59',
    category: 'video',
    endpoint: 'https://api.wuyinkeji.com/api/async/video_wan2.6',
    contentType: 'application/json',
    price: { amount: 0.8, currency: 'CNY', unit: 'second', points: 80 },
    qps: 100,
    requestFields: {
      prompt: field(true, 'string', { maxLength: 200 }),
      negative_prompt: field(false, 'string', { maxLength: 500 }),
      audio_url: field(false, 'string', { publicUrl: true }),
      firstFrameUrl: field(false, 'string', { allowBase64: true }),
      size: field(false, 'string', { default: '1280*720' }),
      duration: field(false, 'string', { default: '5', enum: ['5', '10', '15'] }),
      prompt_extend: field(false, 'boolean', { default: true }),
    },
  }),
  audio_tts: asyncProduct({
    id: 'audio_tts',
    displayName: '语音合成',
    docUrl: 'https://api.wuyinkeji.com/doc/67',
    category: 'audio',
    endpoint: 'https://api.wuyinkeji.com/api/async/audio_tts',
    contentType: 'application/json',
    price: { amount: 0.0006, currency: 'CNY', unit: 'character', points: 0.06 },
    qps: 100,
    requestFields: {
      text: field(true, 'string'),
      voice_id: field(true, 'string'),
      speed: field(false, 'string', { default: '1' }),
      vol: field(false, 'string', { default: '1' }),
      language_boost: field(false, 'string', { default: 'auto' }),
    },
  }),
  voice_composite: {
    id: 'voice_composite',
    displayName: '语音合成（同步）',
    docUrl: 'https://api.wuyinkeji.com/doc/13',
    category: 'audio',
    executionMode: 'sync',
    endpoint: 'https://api.wuyinkeji.com/api/voice/composite',
    method: 'POST',
    contentType: 'application/json;charset:utf-8;',
    auth: HEADER_AUTH,
    price: { amount: 0.0006, currency: 'CNY', unit: 'character', points: 0.06 },
    qps: 30,
    requestFields: {
      text: field(true, 'string'),
      voice_id: field(true, 'string'),
      speed: field(false, 'float', { default: 1.0 }),
      vol: field(false, 'float', { default: 1.0 }),
      language_boost: field(false, 'string'),
    },
    responseFields: ['data.url', 'data.duration', 'data.subtitle', 'data.words'],
  },
  'sora2-new': {
    id: 'sora2-new',
    displayName: 'sora2-new',
    docUrl: 'https://api.wuyinkeji.com/doc/60',
    category: 'video',
    executionMode: 'sora2-special',
    endpoint: 'https://api.wuyinkeji.com/api/sora2-new/submit',
    method: 'POST',
    contentType: 'application/json',
    auth: ASYNC_AUTH,
    resultEndpoint: WUYIN_SORA2_DETAIL_ENDPOINT,
    resultMode: 'wuyin-sora2-detail',
    price: { amount: 1.2, currency: 'CNY', unit: 'request', points: null },
    qps: 300,
    requestFields: {
      prompt: field(true, 'string'),
      url: field(false, 'string', { publicUrl: true }),
      aspectRatio: field(false, 'string', { default: '9:16', enum: ['9:16', '16:9'] }),
      duration: field(false, 'string', { default: '8', enum: ['4', '8', '12'] }),
      size: field(false, 'string', { default: 'small', enum: ['small', 'large'] }),
      remixTargetId: field(false, 'string'),
    },
  },
  img_split: {
    id: 'img_split',
    displayName: '智能拼图',
    docUrl: 'https://api.wuyinkeji.com/doc/39',
    category: 'utility',
    executionMode: 'sync',
    endpoint: 'https://api.wuyinkeji.com/api/img/split',
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded;charset:utf-8;',
    auth: ASYNC_AUTH,
    price: { amount: 0.03, currency: 'CNY', unit: 'request', points: null },
    qps: 100,
    requestFields: {
      video_url: field(true, 'string', { publicUrlCsv: true }),
      key_words: field(false, 'string'),
    },
  },
};

const WUYIN_DETAIL_PRODUCT = {
  id: 'async_detail',
  displayName: '结果详情',
  docUrl: 'https://api.wuyinkeji.com/doc/47',
  endpoint: WUYIN_ASYNC_DETAIL_ENDPOINT,
  method: 'GET',
  contentType: 'application/json',
  auth: ASYNC_AUTH,
  requestFields: {
    id: field(true, 'string'),
  },
  responseStatusMap: {
    0: 'initializing',
    1: 'processing',
    2: 'succeeded',
    3: 'failed',
  },
};

const WUYIN_SORA2_DETAIL_PRODUCT = {
  id: 'sora2_detail',
  displayName: 'sora2 new 视频生成详情',
  docUrl: 'https://api.wuyinkeji.com/doc/36',
  endpoint: WUYIN_SORA2_DETAIL_ENDPOINT,
  method: 'GET',
  contentType: 'application/x-www-form-urlencoded;charset:utf-8;',
  auth: ASYNC_AUTH,
  requestFields: {
    id: field(true, 'string'),
  },
  responseStatusMap: {
    0: 'queued',
    1: 'succeeded',
    2: 'failed',
    3: 'processing',
  },
};

function getWuyinProduct(modelId) {
  return WUYIN_PRODUCTS[String(modelId || '').trim()] || null;
}

function listWuyinProducts(options = {}) {
  const products = Object.values(WUYIN_PRODUCTS);
  if (options.includeDisabled === true) return products;
  return products.filter((product) => product.enabled !== false);
}

module.exports = {
  WUYIN_ASYNC_DETAIL_ENDPOINT,
  WUYIN_SORA2_DETAIL_ENDPOINT,
  WUYIN_CATALOG_URL,
  WUYIN_DETAIL_PRODUCT,
  WUYIN_SORA2_DETAIL_PRODUCT,
  WUYIN_PRODUCTS,
  getWuyinProduct,
  listWuyinProducts,
};
