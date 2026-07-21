// Wuyin owns the public catalog, refresh, and pricing-proxy endpoints.

const express = require('express');
const {
  getCachedWuyinCatalog,
  refreshWuyinCatalog,
  WUYIN_FALLBACK_CATALOG,
} = require('../../lib/dispatcher/adapters/wuyin/wuyinCatalogCrawler');
const { WUYIN_CATALOG_URL } = require('../../lib/dispatcher/wuyinProducts');

const router = express.Router();

function isWuyinPricingProxyRequest(baseUrl, provider) {
  if (/wuyin/i.test(String(provider || ''))) return true;
  const rawBaseUrl = String(baseUrl || '').trim();
  if (!rawBaseUrl) return false;

  const normalizedUrl = /^https?:\/\//i.test(rawBaseUrl) ? rawBaseUrl : `https://${rawBaseUrl}`;
  try {
    return /wuyinkeji/i.test(new URL(normalizedUrl).hostname);
  } catch {
    return /wuyinkeji/i.test(rawBaseUrl);
  }
}

function getWuyinFallbackCatalogItems() {
  return WUYIN_FALLBACK_CATALOG.map((entry, index) => ({
    id: String(index + 1),
    name: entry.displayName,
    url: entry.endpointUrl,
    method: entry.method,
    price: `${entry.price || 0}${entry.priceUnit || '次'}`,
    balance_sum: entry.price || 0,
    pay_unit: entry.priceUnit || '次',
    api_type: '',
    the: entry.displayName,
  }));
}

async function fetchWuyinCatalogPayload() {
  const response = await fetch(WUYIN_CATALOG_URL, {
    method: 'GET',
    headers: { Accept: 'application/json', 'User-Agent': 'KK-Studio/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Wuyin catalog returned HTTP ${response.status}`);
  }
  return response.json();
}

function sendCatalog(res, catalog, source) {
  return res.json({ success: true, data: catalog, source });
}

async function handleGetCatalog(req, res) {
  try {
    if (req.query.refresh === 'true') {
      return sendCatalog(res, await refreshWuyinCatalog(), 'remote');
    }
    return sendCatalog(res, getCachedWuyinCatalog(), 'cache');
  } catch (error) {
    console.warn('[wuyin-catalog] 获取速创 Catalog 发生异常，回退静态 fallback:', error.message);
    return sendCatalog(res, getCachedWuyinCatalog(), 'fallback');
  }
}

async function handleRefreshCatalog(_req, res) {
  try {
    return sendCatalog(res, await refreshWuyinCatalog(), 'remote');
  } catch (error) {
    console.error('[wuyin-catalog] 刷新 Catalog 接口执行失败:', error.message);
    return res.status(502).json({ success: false, error: `文档爬取刷新失败: ${error.message}` });
  }
}

function buildPricingResponse(payload) {
  const responseData = payload && payload.data;
  return {
    success: true,
    source: 'wuyinkeji',
    endpointUrl: WUYIN_CATALOG_URL,
    data: Array.isArray(responseData && responseData.api_list) ? responseData.api_list : [],
    api_type_data: Array.isArray(responseData && responseData.api_type_data) ? responseData.api_type_data : [],
    group_ratio: {},
  };
}

function buildFallbackPricingResponse() {
  return {
    success: true,
    source: 'wuyinkeji',
    endpointUrl: WUYIN_CATALOG_URL,
    data: getWuyinFallbackCatalogItems(),
    api_type_data: [],
    group_ratio: {},
    fallback: true,
  };
}

async function handlePricingProxy(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', data: [], group_ratio: {} });
  }

  const baseUrl = String(req.body && req.body.baseUrl || '');
  const provider = String(req.body && req.body.provider || '');
  if (!isWuyinPricingProxyRequest(baseUrl, provider)) {
    return res.status(400).json({
      error: 'Pricing proxy currently supports the Wuyin catalog endpoint only.',
      data: [],
      group_ratio: {},
    });
  }

  try {
    return res.json(buildPricingResponse(await fetchWuyinCatalogPayload()));
  } catch (error) {
    console.warn('[pricing-proxy] Failed to fetch Wuyin catalog, using fallback:', error && error.message || error);
    return res.json(buildFallbackPricingResponse());
  }
}

router.get('/v1/wuyin/catalog', handleGetCatalog);
router.post('/v1/wuyin/catalog/refresh', handleRefreshCatalog);
router.all('/pricing-proxy', handlePricingProxy);

module.exports = router;
