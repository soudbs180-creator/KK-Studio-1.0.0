/**
 * @file userAiRouteHandler.js
 * @module services/api/lib/dispatcher
 * @description 用户自带 Key 的统一 AI 对话处理函数。
 *              从旧路由模块 user-ai-router.js 剥离，以插件方式在统一影子路由中执行。
 */

const { getAdapter, normalizeAdapterId } = require('./adapterRegistry');
const { assertStrictTaskSupported } = require('./strictProviderContracts');
const { resolveLocalUserRoute, readLocalStorage, writeLocalStorage, readProfileState, writeProfileState } = require('./localUserRouteStore');
const metricsCollector = require('./metricsCollector');
const { fetchWithRetries } = require('../fetchClient');
const { verifyJWT, signJWT } = require('../jwt');

const TEMP_USER_ID_HEADER = 'x-kk-temp-user-id';

// 🚀 内存中 pending status 更新队列：防抖合并异步持久化，避免每次 401/429 都做完整 read→find→modify→write 周期
const pendingStatusUpdates = new Map(); // key: `${userId}:${routeId}` → status
let statusFlushTimer = null;
const STATUS_FLUSH_DELAY_MS = 2000; // 2秒防抖

function scheduleStatusFlush() {
  if (statusFlushTimer) return;
  statusFlushTimer = setTimeout(async () => {
    statusFlushTimer = null;
    const updates = new Map(pendingStatusUpdates);
    pendingStatusUpdates.clear();

    for (const [key, status] of updates.entries()) {
      const [userId, ...routeIdParts] = key.split(':');
      const routeId = routeIdParts.join(':');
      try {
        const data = await readLocalStorage();
        const profileState = readProfileState(data, userId);
        let found = false;

        for (const slot of profileState.slots) {
          const slotIdNormalized = String(slot.id || '').toLowerCase();
          const decodedRouteId = (() => {
            try { return decodeURIComponent(String(routeId || '')).trim(); } catch { return String(routeId || '').trim(); }
          })();
          const normalizedRouteId = decodedRouteId.toLowerCase();
          let strippedRouteId = normalizedRouteId;
          if (normalizedRouteId.startsWith('slot_key_')) strippedRouteId = normalizedRouteId.slice(9);
          else if (normalizedRouteId.startsWith('slot_')) strippedRouteId = normalizedRouteId.slice(5);
          else if (normalizedRouteId.startsWith('provider_')) strippedRouteId = normalizedRouteId.slice(9);

          if (slotIdNormalized === normalizedRouteId || slotIdNormalized === strippedRouteId) {
            slot.status = status;
            slot.updatedAt = Date.now();
            found = true;
            break;
          }
        }

        if (found) {
          writeProfileState(data, userId, profileState);
          await writeLocalStorage(data);
        }
      } catch (err) {
        console.error(`[UserAiRouter] 防抖写入 slot 状态失败 userId=${userId}:`, err);
      }
    }
  }, STATUS_FLUSH_DELAY_MS);
}

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

function errorEnvelope(req, code, message, extra = {}) {
  return {
    success: false,
    error: { code, message, ...extra },
    meta: buildMeta(req),
  };
}

function sendUserRouterError(res, req, status, code, message, extra = {}) {
  return res.status(status).json(errorEnvelope(req, code, message, extra));
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

function enforceStrictContract(req, res, { profileId, taskType, adapterId, modelId }) {
  try {
    const contractTask = assertStrictTaskSupported(profileId, taskType, { modelId });
    if (contractTask?.adapterId && contractTask.adapterId !== adapterId) {
      return sendUserRouterError(
        res,
        req,
        400,
        'STRICT_PROVIDER_ADAPTER_MISMATCH',
        `强预设 ${profileId} 的 ${taskType} 任务必须使用 ${contractTask.adapterId}，当前为 ${adapterId}。已阻止旧逻辑污染。`,
        { route: { profileId, taskType, adapterId, expectedAdapterId: contractTask.adapterId, modelId } },
      );
    }
    return null;
  } catch (err) {
    return sendUserRouterError(
      res,
      req,
      err.statusCode || 400,
      err.code || 'STRICT_PROVIDER_CONTRACT_REJECTED',
      err.message,
      { route: err.route || { profileId, taskType, modelId } },
    );
  }
}

async function updateLocalUserSlotStatus(userId, routeId, status) {
  // 🚀 优化：不再每次做完整 read→find→modify→write，改为内存队列 + 防抖异步持久化
  const key = `${userId}:${routeId}`;
  pendingStatusUpdates.set(key, status);
  scheduleStatusFlush();

  // 🚀 同时立即更新内存中的路由缓存（如有），保持状态即时一致性
  try {
    const { invalidateRouteCache } = require('./localUserRouteStore');
    invalidateRouteCache(userId);
  } catch {}
}

async function handleUnifiedUserChatMode(req, res, userId) {
  const routeId = String(req.body?.routeId || req.headers['x-key-slot-id'] || '').trim();
  const route = await resolveLocalUserRoute(userId, routeId);
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
  const modelId = resolveModelId(route, req.body || {});
  const adapterId = normalizeAdapterId(endpointType, channel);
  const strictErrorResponse = enforceStrictContract(req, res, {
    profileId: channel.request_profile_id,
    taskType: 'chat',
    adapterId,
    modelId,
  });
  if (strictErrorResponse) return strictErrorResponse;

  const adapter = getAdapter(endpointType, channel);
  const streamRequested = Boolean(req.body?.stream);
  const unifiedPayload = {
    task_type: 'chat',
    model: modelId,
    messages,
    temperature: req.body?.temperature,
    max_tokens: req.body?.max_tokens || req.body?.maxTokens,
    stream: streamRequested,
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
    const upstream = await fetchWithRetries(transportReq.url, {
      method: transportReq.method,
      headers: transportReq.headers,
      body: transportReq.body,
      signal: controller.signal,
      stream: streamRequested,
    });

    if (streamRequested) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      if (upstream.body) {
        const reader = upstream.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          metricsCollector.recordRequest({
            modelId,
            providerId: channel.provider_id,
            success: true,
            latency: Date.now() - startedAt,
          });
        } catch (streamErr) {
          console.error('[UserAiRouter Stream Error]', streamErr);
          res.write(`data: ${JSON.stringify({ error: { message: streamErr.message || 'Stream transmission failed.', code: 'STREAM_TRANSMIT_ERROR' } })}\n\n`);
          
          metricsCollector.recordRequest({
            modelId,
            providerId: channel.provider_id,
            success: false,
            latency: Date.now() - startedAt,
          });

          const streamStatus = streamErr.statusCode;
          if (streamStatus === 401) {
            await updateLocalUserSlotStatus(userId, routeId, 'invalid');
          } else if (streamStatus === 429) {
            await updateLocalUserSlotStatus(userId, routeId, 'rate_limited');
          }
        } finally {
          res.end();
          clearTimeout(timeoutId);
        }
      } else {
        res.end();
        clearTimeout(timeoutId);
      }
      return;
    }

    const rawText = await upstream.text();
    let payload = null;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      payload = null;
    }

    const content = adapter.extractContent(payload);

    metricsCollector.recordRequest({
      modelId,
      providerId: channel.provider_id,
      success: true,
      latency: Date.now() - startedAt,
    });

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
        strictContractChecked: Boolean(channel.request_profile_id),
      },
    }, req));
  } catch (err) {
    const status = err.statusCode || 502;
    const message = err?.name === 'AbortError' ? 'User-owned API request timed out.' : err?.message || 'User-owned API request failed.';
    
    metricsCollector.recordRequest({
      modelId,
      providerId: channel.provider_id,
      success: false,
      latency: Date.now() - startedAt,
    });

    if (status === 401) {
      await updateLocalUserSlotStatus(userId, routeId, 'invalid');
    } else if (status === 429) {
      await updateLocalUserSlotStatus(userId, routeId, 'rate_limited');
    }

    return sendUserRouterError(res, req, status, 'USER_AI_ROUTER_REQUEST_FAILED', message.replaceAll(apiKey, '[REDACTED]'));
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  handleUnifiedUserChatMode
};
