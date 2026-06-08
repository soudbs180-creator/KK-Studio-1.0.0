/**
 * @file wuyinCatalogCrawler.js
 * @description Wuyin/速创目录读取层。旧的“爬取全部目录 + fallback 合并”会把未核对文档的模型带入执行路径，
 *              现在改为只暴露 strict contract 中已经核对的官方文档模型。后续如用户提供同一模型的新文档，
 *              必须替换 wuyinProducts.js 中对应定义，不允许与旧字段混合。
 */

const fs = require('fs');
const path = require('path');
const {
  WUYIN_CATALOG_URL,
  WUYIN_DETAIL_PRODUCT,
  listWuyinProducts,
} = require('./dispatcher/wuyinProducts');

const CACHE_FILE_PATH = path.join(__dirname, 'wuyinCatalogCache.json');

function toCatalogItem(product) {
  const endpointPath = new URL(product.endpoint).pathname;
  const priceUnit = product.price?.unit === 'image'
    ? '张'
    : product.price?.unit === 'second'
      ? '秒'
      : product.price?.unit || '次';

  return {
    id: product.id,
    name: product.displayName,
    displayName: product.displayName,
    categoryName: product.category === 'image' ? '图片模型' : product.category === 'video' ? '视频模型' : '未分类模型',
    kind: product.category,
    executionMode: 'async-detail',
    docUrl: product.docUrl,
    endpointPath,
    endpointUrl: product.endpoint,
    method: product.method,
    contentType: product.contentType,
    submitContentType: product.contentType,
    detailPath: '/api/async/detail',
    detailUrl: product.resultEndpoint,
    detailStatusMode: 'wuyin-async',
    price: product.price?.amount ?? 0,
    priceText: product.price?.amount != null ? `${product.price.amount}元/${priceUnit}` : '',
    priceUnit,
    points: product.price?.points ?? null,
    aliases: [product.id, product.displayName].filter(Boolean),
    enabled: true,
    strictContractOnly: true,
    source: product.docUrl,
    catalogSource: WUYIN_CATALOG_URL,
    lastCrawledAt: new Date().toISOString(),
  };
}

const WUYIN_FALLBACK_CATALOG = listWuyinProducts().map(toCatalogItem);

function readWuyinCatalogModelId(item) {
  const explicit = String(item && (item.id || item.modelId) || '').trim();
  if (explicit) return explicit;
  const endpointPath = String(item && item.endpointPath || '').trim();
  const match = endpointPath.match(/\/api\/async\/([^/?#]+)$/i);
  return match ? decodeURIComponent(match[1]) : '';
}

const WUYIN_CATALOG_MODEL_PRIORITY = [
  'image_nanoBanana2',
  'image_nanoBanana_pro',
  'image_gpt',
  'video_google_omni',
];

function getWuyinCatalogPriority(item) {
  const modelId = readWuyinCatalogModelId(item);
  const index = WUYIN_CATALOG_MODEL_PRIORITY.findIndex(candidate => candidate.toLowerCase() === modelId.toLowerCase());
  return index >= 0 ? index : WUYIN_CATALOG_MODEL_PRIORITY.length + 1000;
}

function sortWuyinCatalogForDefaultUse(items) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const rankDiff = getWuyinCatalogPriority(left.item) - getWuyinCatalogPriority(right.item);
      return rankDiff || left.index - right.index;
    })
    .map(({ item }) => item);
}

function filterDocumentedOnly(items) {
  const allowed = new Set(WUYIN_FALLBACK_CATALOG.map((item) => item.id));
  return sortWuyinCatalogForDefaultUse(
    (Array.isArray(items) ? items : [])
      .filter((item) => allowed.has(String(item && item.id || '').trim()))
      .map((item) => ({
        ...item,
        strictContractOnly: true,
      }))
  );
}

async function refreshWuyinCatalog() {
  const sortedItems = sortWuyinCatalogForDefaultUse(WUYIN_FALLBACK_CATALOG);
  const payload = {
    version: 2,
    source: 'strict-documented-contract',
    catalogSource: WUYIN_CATALOG_URL,
    detailDoc: WUYIN_DETAIL_PRODUCT.docUrl,
    replacementPolicy: 'same-provider same-model docs replace previous contract; never merge old inferred fields',
    crawledAt: new Date().toISOString(),
    items: sortedItems,
  };

  fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(payload, null, 2), 'utf8');
  return sortedItems;
}

function getCachedWuyinCatalog() {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      const payload = JSON.parse(raw);
      if (payload && Array.isArray(payload.items) && payload.items.length > 0) {
        const documentedOnly = filterDocumentedOnly(payload.items);
        if (documentedOnly.length > 0) {
          return documentedOnly;
        }
      }
    }
  } catch (error) {
    console.warn('[wuyin-catalog] 加载本地缓存失败，使用严格文档 contract 目录:', error.message);
  }
  return sortWuyinCatalogForDefaultUse(WUYIN_FALLBACK_CATALOG);
}

module.exports = {
  refreshWuyinCatalog,
  getCachedWuyinCatalog,
  WUYIN_FALLBACK_CATALOG,
};
