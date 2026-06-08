/**
 * @file user-ai-router.js
 * @module server/routes
 * @description 用户自带 Key 的统一 AI Router。该路由不做系统积分扣费，只复用通用 Provider Profile + Adapter
 *              执行用户自己的接口。当前优先接管 mode=chat，其它图片/视频/音频继续交给 legacy user.js。
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');
const fetch = require('node-fetch');
const { verifyJWT, signJWT } = require('../lib/jwt');
const { getAdapter, normalizeAdapterId } = require('../lib/dispatcher/adapterRegistry');

const router = express.Router();
const LOCAL_STORAGE_PATH = path.resolve(__dirname, '../../.kk-local/local-user-apis.json');
const TEMP_USER_ID_HEADER = 'x-kk-temp-user-id';

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 80,
  maxFreeSockets: 10,
  timeout: 60000,
  freeSocketTimeout: 30000,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 80,
  maxFreeSockets: 10,
  timeout: 60000,
  freeSocketTimeout: 30000,
});

function buildMeta(req) {
  return {
    requestId: req.headers['x-request-id'] || req.body?.requestId || `req-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
}

function okEnvelope(data, req) {
  return {
    success: true,
    data,
    meta: buildMeta(req),
  };
}

function errorEnvelope(req, code, message) {
  return {
    success: false,
    error: { code, message },
    meta: buildMeta(req),
  };
}

function sendUserRouterError(res, req, status, code, message) {
  return res.status(status).json(errorEnvelope(req, code, message));
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeProfileState(value) {
  const source = isObjectRecord(value) ? value : {};
  return {
    version: Number.parseInt(source.version, 10) || 2,
    slots: Array.isArray(source.slots) ? source.slots : [],
    providers: Array.isArray(source.providers) ? source.providers : [],
    entries: Array.isArray(source.entries) ? source.entries : [],
  };
}

function readLocalStorage() {
  try {
    const raw = fs.readFileSync(LOCAL_STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return isObjectRecord(parsed) ? parsed : { version: 2, profiles: {} };
  } catch {
    return { version: 2, profiles: {} };
  }
}

function readProfileState(data, userId) {
  if (!isObjectRecord(data.profiles)) {
    data.profiles = {};
  }
  if (isObjectRecord(data.profiles[userId])) {
    return normalizeProfileState(data.profiles[userId]);
  }
  return normalizeProfileState(data);
}

function verifyRequestJwt(req) {
  const authHeader = req.headers.authorization || '';
  return verifyJWT(authHeader);
}

function resolveProfileUserId(req) {
  const verifiedUserId = verifyRequestJwt(req);
  if (verifiedUserId) {
    return {
      userId: verifiedUserId,
      refreshToken: signJWT({ userId: verifiedUserId }),
    };
  }

  const tempUserId = String(req.headers[TEMP_USER_ID_HEADER] || '').trim();
  const allowLocalTempUser = process.env.KKAI_LOCAL_ONLY === 'true' || process.env.NODE_ENV !== 'production';
  if (allowLocalTempUser && /^temp-[a-zA-Z0-9_.-]{4,128}$/.test(tempUserId)) {
    return { userId: tempUserId, refreshToken: null };
  }

  return null;
}

function normalizeRouteValue(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeProviderLinkValue(value) {
  return String(value || '').trim().replace(/\/+$/, '').toLowerCase();
}

function resolveRouteIdCandidate(value) {
  const decoded = (() => {
    try {
      return decodeURIComponent(String(value || '').trim());
    } catch {
      return String(value || '').trim();
    }
  })();
  const normalized = decoded.toLowerCase();
  if (normalized.startsWith('slot_key_')) return normalized.slice(5);
  if (normalized.startsWith('slot_')) return normalized.slice(5);
  if (normalized.startsWith('provider_')) return normalized.slice('provider_'.length);
  return normalized;
}

function recordAliases(record) {
  return [
    String(record?.id || '').trim(),
    ...(Array.isArray(record?.legacyIds) ? record.legacyIds : []),
  ].map(normalizeRouteValue).filter(Boolean);
}

function recordMatchesRoute(record, routeTarget, rawRouteId) {
  const aliases = recordAliases(record);
  const name = normalizeRouteValue(record?.name);
  return aliases.includes(routeTarget) || aliases.includes(rawRouteId) || name === routeTarget;
}

function findProviderLinkedToSlot(slot, providers) {
  const slotBaseUrl = normalizeProviderLinkValue(slot?.baseUrl);
  const slotKey = String(slot?.key || '').trim();
  const slotName = normalizeRouteValue(slot?.name);

  const strongMatch = providers.find((provider) => {
    const providerBaseUrl = normalizeProviderLinkValue(provider?.baseUrl);
    if (!providerBaseUrl || providerBaseUrl !== slotBaseUrl) return false;
    const providerKey = String(provider?.apiKey || '').trim();
    const providerName = normalizeRouteValue(provider?.name);
    return (slotKey && providerKey && slotKey === providerKey) || (slotName && providerName && slotName === providerName);
  });
  if (strongMatch) return strongMatch;

  const sameBaseProviders = providers.filter((provider) => (
    slotBaseUrl && normalizeProviderLinkValue(provider?.baseUrl) === slotBaseUrl
  ));
  return sameBaseProviders.length === 1 ? sameBaseProviders[0] : null;
}

function buildRouteFromProvider(provider) {
  return {
    id: String(provider?.id || '').trim(),
    legacyIds: Array.isArray(provider?.legacyIds) ? provider.legacyIds : [],
    name: String(provider?.name || '').trim(),
    baseUrl: String(provider?.baseUrl || '').trim(),
    apiKey: String(provider?.apiKey || '').trim(),
    models: Array.isArray(provider?.models) ? provider.models : [],
    format: String(provider?.format || 'auto').trim() || 'auto',
    endpointType: String(provider?.endpointType || provider?.adapterId || '').trim(),
    requestProfileId: String(provider?.requestProfileId || provider?.profileId || '').trim(),
  };
}

function buildRouteFromSlot(slot, providers) {
  const linkedProvider = findProviderLinkedToSlot(slot, providers);
  return {
    id: String(slot?.id || '').trim(),
    legacyIds: Array.isArray(slot?.legacyIds) ? slot.legacyIds : [],
    name: String(linkedProvider?.name || slot?.name || '').trim(),
    baseUrl: String(linkedProvider?.baseUrl || slot?.baseUrl || '').trim(),
    apiKey: String(linkedProvider?.apiKey || slot?.key || '').trim(),
    models: Array.isArray(linkedProvider?.models)
      ? linkedProvider.models
      : Array.isArray(slot?.supportedModels)
        ? slot.supportedModels
        : [],
    format: String(linkedProvider?.format || slot?.format || 'auto').trim() || 'auto',
    endpointType: String(linkedProvider?.endpointType || slot?.endpointType || linkedProvider?.adapterId || '').trim(),
    requestProfileId: String(linkedProvider?.requestProfileId || slot?.requestProfileId || linkedProvider?.profileId || '').trim(),
  };
}

function resolveLocalUserRoute(profileState, routeId) {
  const routeTarget = resolveRouteIdCandidate(routeId);
  const rawRouteId = String(routeId || '').trim().toLowerCase();
  const providers = Array.isArray(profileState.providers) ? profileState.providers : [];
  const slots = Array.isArray(profileState.slots) ? profileState.slots : [];

  const provider = providers.find((item) => recordMatchesRoute(item, routeTarget, rawRouteId));
  if (provider) return buildRouteFromProvider(provider);

  const slot = slots.find((item) => recordMatchesRoute(item, routeTarget, rawRouteId));
  if (slot) return buildRouteFromSlot(slot, providers);

  return null;
}

function mapLegacyFormatToEndpointType(format) {
  const normalized = String(format || '').trim().toLowerCase();
  if (normalized === 'gemini') return 'google_gemini_generate_content';
  if (normalized === 'claude' || normalized === 'anthropic') return 'anthropic_messages';
  if (normalized === 'openai' || normalized === 'auto') return 'auto';
  return normalized || 'auto';
}

function normalizeMessagesFromBody(body) {
  if (Array.isArray(body?.messages) && body.messages.length > 0) {
    return body.messages;
  }
  const content = String(body?.prompt || body?.content || body?.message || '').trim();
  if (content) {
    return [{ role: 'user', content }];
  }
  return [];
}

function resolveModelId(route, body) {
  const requested = String(body?.modelId || body?.model || '').trim();
  if (requested) return requested;
  const firstModel = Array.isArray(route.models) ? route.models[0] : null;
  if (typeof firstModel === 'string') return firstModel;
  if (firstModel && typeof firstModel === 'object') {
    return String(firstModel.id || firstModel.modelId || firstModel.name || '').trim();
  }
  return 'gpt-4o-mini';
}

async function handleUnifiedUserChatMode(req, res, profileState) {
  const routeId = String(req.body?.routeId || req.headers['x-key-slot-id'] || '').trim();
  const route = resolveLocalUserRoute(profileState, routeId);
  if (!route) {
    return sendUserRouterError(res, req, 404, 'USER_ROUTE_NOT_FOUND', 'User API route was not found.');
  }

  const apiKey = String(route.apiKey || '').trim();
  if (!apiKey) {
    return sendUserRouterError(res, req, 400, 'USER_ROUTE_SECRET_REQUIRED', 'API key is required.');
  }
  if (!route.baseUrl) {
    return sendUserRouterError(res, req, 400, 'USER_ROUTE_BASE_URL_REQUIRED', 'Base URL is required.');
  }

  const messages = normalizeMessagesFromBody(req.body || {});
  if (messages.length === 0) {
    return sendUserRouterError(res, req, 400, 'INVALID_CHAT_PAYLOAD', 'Chat messages or prompt is required.');
  }

  const endpointType = route.endpointType || mapLegacyFormatToEndpointType(route.format);
  const channel = {
    provider_id: route.id || route.name || routeId || 'user-owned-api',
    provider_name: route.name || 'User API',
    base_url: route.baseUrl,
    endpoint_type: endpointType,
    request_profile_id: route.requestProfileId || route.format || '',
    provider_kind: 'user',
  };
  const adapterId = normalizeAdapterId(endpointType, channel);
  const adapter = getAdapter(endpointType, channel);
  const modelId = resolveModelId(route, req.body || {});
  const unifiedPayload = {
    task_type: 'chat',
    model: modelId,
    messages,
    temperature: req.body?.temperature,
    max_tokens: req.body?.max_tokens || req.body?.maxTokens,
    stream: false,
    requestId: req.body?.requestId,
    attemptId: req.body?.attemptId,
  };

  const transportReq = adapter.buildRequest({
    base_url: route.baseUrl,
    api_key: apiKey,
  }, modelId, unifiedPayload);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  const startedAt = Date.now();

  try {
    const isHttps = transportReq.url.startsWith('https');
    const upstream = await fetch(transportReq.url, {
      method: transportReq.method,
      headers: transportReq.headers,
      body: transportReq.body,
      signal: controller.signal,
      agent: isHttps ? httpsAgent : httpAgent,
    });
    const rawText = await upstream.text();
    let payload = null;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      payload = null;
    }

    if (!upstream.ok) {
      const cleanMessage = rawText.replaceAll(apiKey, '[REDACTED]').slice(0, 600);
      return sendUserRouterError(
        res,
        req,
        upstream.status,
        'USER_AI_ROUTER_UPSTREAM_ERROR',
        `User-owned API returned ${upstream.status}: ${cleanMessage}`,
      );
    }

    const content = adapter.extractContent(payload);
    return res.json(okEnvelope({
      content,
      role: 'assistant',
      endpointType: adapterId,
      requestProfileId: channel.request_profile_id || null,
      provider: channel.provider_id,
      providerName: channel.provider_name,
      model: modelId,
      requestId: req.body?.requestId,
      attemptId: req.body?.attemptId,
      execTime: Date.now() - startedAt,
      billingMode: 'user-owned-api-no-system-credit',
      route: {
        ownerKind: 'user',
        providerId: channel.provider_id,
        adapter: adapterId,
        requestProfileId: channel.request_profile_id || null,
        model: modelId,
      },
    }, req));
  } catch (err) {
    const message = err?.name === 'AbortError' ? 'User-owned API request timed out.' : err?.message || 'User-owned API request failed.';
    return sendUserRouterError(res, req, 502, 'USER_AI_ROUTER_REQUEST_FAILED', message.replaceAll(apiKey, '[REDACTED]'));
  } finally {
    clearTimeout(timeoutId);
  }
}

router.all('/v1/model-proxy/user', async (req, res, next) => {
  const mode = String(req.body?.mode || '').trim();
  if (mode !== 'chat') {
    return next();
  }

  const authState = resolveProfileUserId(req);
  if (!authState) {
    return sendUserRouterError(res, req, 401, 'UNAUTHORIZED', 'Authentication is required for user-owned AI routing.');
  }
  if (authState.refreshToken) {
    res.setHeader('X-Refresh-Token', authState.refreshToken);
  }

  const data = readLocalStorage();
  const profileState = readProfileState(data, authState.userId);
  return handleUnifiedUserChatMode(req, res, profileState);
});

module.exports = router;
