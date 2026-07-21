/**
 * @file pricing-proxy.js
 * @module api
 * @description Vercel serverless proxy for the public Wuyin model and pricing catalog.
 * @author KK-Studio Team
 * @version 1.5.8
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { listWuyinProducts } = require('../../services/api/lib/dispatcher/wuyinProducts.js');

const WUYIN_BASE_URL = process.env.SUCHUANG_BASE_URL || 'https://api.wuyinkeji.com';
const WUYIN_PRICE_CATALOG_URL = `${WUYIN_BASE_URL.replace(/\/+$/, '')}/themes/DigitalBlue/api?action=api_list`;

function isWuyinPricingProxyRequest(baseUrl, provider) {
  if (/wuyin/i.test(String(provider || ''))) return true;
  const raw = String(baseUrl || '').trim();
  if (!raw) return false;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    return /^api\.wuyinkeji\.com$/i.test(parsed.hostname) || /wuyinkeji/i.test(parsed.hostname);
  } catch {
    return /wuyinkeji/i.test(raw);
  }
}

function getFallbackCatalogItems() {
  return listWuyinProducts().map((product, index) => {
    const priceUnit = product.price?.unit === 'image'
      ? '张'
      : product.price?.unit === 'second'
        ? '秒'
        : product.price?.unit || '次';
    return {
      id: String(index + 1),
      name: product.displayName,
      url: product.endpoint,
      method: product.method || 'POST',
      price: product.price?.amount != null ? `${product.price.amount}元/${priceUnit}` : '0元/次',
      balance_sum: product.price?.amount ?? 0,
      pay_unit: priceUnit,
      api_type: '',
      the: product.displayName,
      modelId: product.id,
    };
  });
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body);
  }
  return {};
}

async function fetchWuyinCatalogPayload() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(WUYIN_PRICE_CATALOG_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'KK-Studio/1.0',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Wuyin catalog returned HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function sendJson(res, status, payload) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(payload);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed', data: [], group_ratio: {} });
    return;
  }

  const body = await readJsonBody(req).catch(() => ({}));
  if (!isWuyinPricingProxyRequest(body.baseUrl, body.provider)) {
    sendJson(res, 400, {
      error: 'Pricing proxy currently supports the Wuyin catalog endpoint only.',
      data: [],
      group_ratio: {},
    });
    return;
  }

  try {
    const payload = await fetchWuyinCatalogPayload();
    const data = payload && payload.data && Array.isArray(payload.data.api_list)
      ? payload.data.api_list
      : [];
    const apiTypeData = payload && payload.data && Array.isArray(payload.data.api_type_data)
      ? payload.data.api_type_data
      : [];
    sendJson(res, 200, {
      success: true,
      source: 'wuyinkeji',
      endpointUrl: WUYIN_PRICE_CATALOG_URL,
      data,
      api_type_data: apiTypeData,
      group_ratio: {},
    });
  } catch (error) {
    sendJson(res, 200, {
      success: true,
      source: 'wuyinkeji',
      endpointUrl: WUYIN_PRICE_CATALOG_URL,
      data: getFallbackCatalogItems(),
      api_type_data: [],
      group_ratio: {},
      fallback: true,
      message: error instanceof Error ? error.message : String(error || 'Wuyin catalog fetch failed.'),
    });
  }
}
