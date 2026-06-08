/**
 * @file wuyinProducts.js
 * @module server/lib/dispatcher
 * @description Wuyin/速创 API 文档化产品定义。这里不做猜测，只记录已核对文档中的 endpoint、请求方法、
 *              Content-Type、鉴权、参数字段、结果查询和价格信息。
 */

const WUYIN_ASYNC_DETAIL_ENDPOINT = 'https://api.wuyinkeji.com/api/async/detail';
const WUYIN_CATALOG_URL = 'https://api.wuyinkeji.com/type/all';

const WUYIN_PRODUCTS = {
  image_nanoBanana2: {
    id: 'image_nanoBanana2',
    displayName: 'NanoBanana2',
    docUrl: 'https://api.wuyinkeji.com/doc/65',
    category: 'image',
    endpoint: 'https://api.wuyinkeji.com/api/async/image_nanoBanana2',
    method: 'POST',
    contentType: 'application/json',
    auth: 'Authorization header and key query parameter',
    resultEndpoint: WUYIN_ASYNC_DETAIL_ENDPOINT,
    price: { amount: 0.1, currency: 'CNY', unit: 'image', points: 10 },
    qps: 100,
    requestFields: {
      prompt: { required: true, type: 'string' },
      size: { required: false, type: 'string', default: '1K', enum: ['1K', '2K', '4K'] },
      aspectRatio: { required: false, type: 'string', default: 'auto', enum: ['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'] },
      urls: { required: false, type: 'array<string>', description: '参考图 URL，必须公网可访问，最高 14 张参考图' },
    },
  },
  image_nanoBanana_pro: {
    id: 'image_nanoBanana_pro',
    displayName: 'NanoBanana_pro',
    docUrl: 'https://api.wuyinkeji.com/doc/55',
    category: 'image',
    endpoint: 'https://api.wuyinkeji.com/api/async/image_nanoBanana_pro',
    method: 'POST',
    contentType: 'application/json',
    auth: 'Authorization header and key query parameter',
    resultEndpoint: WUYIN_ASYNC_DETAIL_ENDPOINT,
    price: { amount: 0.3, currency: 'CNY', unit: 'image', points: 30 },
    qps: 100,
    requestFields: {
      prompt: { required: true, type: 'string' },
      size: { required: false, type: 'string', default: '1K', enum: ['1K', '2K', '4K'] },
      aspectRatio: { required: false, type: 'string', default: 'auto', enum: ['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'] },
      urls: { required: false, type: 'array<string>', description: '参考图 URL，必须公网可访问，最高 14 张参考图' },
    },
  },
  image_gpt: {
    id: 'image_gpt',
    displayName: 'GPT-Image-2',
    docUrl: 'https://api.wuyinkeji.com/doc/53',
    category: 'image',
    endpoint: 'https://api.wuyinkeji.com/api/async/image_gpt',
    method: 'POST',
    contentType: 'application/json',
    auth: 'Authorization header and key query parameter',
    resultEndpoint: WUYIN_ASYNC_DETAIL_ENDPOINT,
    price: { amount: 0.1, currency: 'CNY', unit: 'image', points: 10 },
    qps: 100,
    requestFields: {
      prompt: { required: true, type: 'string' },
      size: { required: false, type: 'string', default: 'auto', enum: ['auto', '1:1', '3:2', '2:3', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21', '1:3', '3:1', '2:1', '1:2'] },
      urls: { required: false, type: 'array<string>', description: '参考图片 URL，支持多张图片' },
    },
  },
  video_google_omni: {
    id: 'video_google_omni',
    displayName: 'google_omni',
    docUrl: 'https://api.wuyinkeji.com/doc/72',
    category: 'video',
    endpoint: 'https://api.wuyinkeji.com/api/async/video_google_omni',
    method: 'POST',
    contentType: 'application/json',
    auth: 'Authorization header and key query parameter',
    resultEndpoint: WUYIN_ASYNC_DETAIL_ENDPOINT,
    price: { amount: 0.1, currency: 'CNY', unit: 'second', points: 10 },
    qps: 100,
    requestFields: {
      prompt: { required: true, type: 'string' },
      size: { required: false, type: 'string', default: '1280x720', examples: ['1280x720', '720x1280', '1920x1080', '1080x1920'] },
      images: { required: false, type: 'string', description: '参考图 URL，多个用英文逗号分隔，上限 7 张' },
      duration: { required: false, type: 'string|number', default: '10' },
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
  auth: 'Authorization header and key query parameter',
  requestFields: {
    id: { required: true, type: 'string' },
  },
  responseStatusMap: {
    0: 'initializing',
    1: 'processing',
    2: 'succeeded',
    3: 'failed',
  },
};

function getWuyinProduct(modelId) {
  return WUYIN_PRODUCTS[String(modelId || '').trim()] || null;
}

function listWuyinProducts() {
  return Object.values(WUYIN_PRODUCTS);
}

module.exports = {
  WUYIN_ASYNC_DETAIL_ENDPOINT,
  WUYIN_CATALOG_URL,
  WUYIN_DETAIL_PRODUCT,
  WUYIN_PRODUCTS,
  getWuyinProduct,
  listWuyinProducts,
};
