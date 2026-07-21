/**
 * @file generate-v1.js
 * @module services/api/routes
 * @description 统一的同步与异步生成网关路由模块。
 *              整合原有分散路由，实现零直连前端、BYOK 安全域名白名单、统一派发与直接执行。
 */

const express = require('express');
const { verifyJWT } = require('../lib/jwt');
const { listProviders } = require('../lib/dispatcher/providerRegistry');
const metricsCollector = require('../lib/dispatcher/metricsCollector');
const generationV3 = require('../lib/generation-v3');

const router = express.Router();

// 辅助方法：发送统一的错误响应信封
function sendError(res, status, code, message) {
  return res.status(status).json({
    success: false,
    error: message,
    code
  });
}

function requireAuth(req, res, next) {
  const userId = verifyJWT(req.headers.authorization);
  if (!userId) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized.');
  }
  req.userId = userId;
  next();
}

/**
 * 安全过滤：校验自带 Key API 路由目标地址是否属于系统供应商白名单域名 (WS-5)
 */
function validateProxyTargetHost(baseUrl) {
  if (!baseUrl) return false;
  try {
    const url = new URL(baseUrl);
    const hostname = url.hostname.toLowerCase();
    
    // 本地开发回环地址允许放行
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }

    const providers = listProviders();
    const allowedHosts = providers.map(p => p.host.toLowerCase());
    
    // 精准匹配或子域名匹配
    return allowedHosts.some(allowed => {
      return hostname === allowed || hostname.endsWith('.' + allowed);
    });
  } catch {
    return false;
  }
}

// 统一同步生成端点 (WS-3)
router.post('/v1/generate', requireAuth, async (req, res) => {
  const startTime = Date.now();
  const routeId = req.body?.routeId || req.headers['x-key-slot-id'];
  const taskType = req.body?.task_type || req.body?.taskType;
  const isChat = taskType === 'chat' || Array.isArray(req.body?.messages);

  // 1. 用户自带 Key (BYOK) 派发路径
  if (routeId) {
    const { resolveLocalUserRoute } = require('../lib/dispatcher/localUserRouteStore');
    const route = await resolveLocalUserRoute(req.userId, routeId);
    if (!route) {
      return sendError(res, 404, 'USER_ROUTE_NOT_FOUND', 'User API route not found.');
    }

    // 域名白名单安全过滤
    if (!validateProxyTargetHost(route.baseUrl)) {
      metricsCollector.recordRouteCall({ routePath: '/api/v1/generate', success: false, latency: Date.now() - startTime });
      return sendError(
        res,
        403,
        'FORBIDDEN_PROXY_TARGET',
        `访问被拒绝。该 API 路由目标 '${route.baseUrl || ''}' 未在系统安全白名单域名中。`
      );
    }

    if (isChat) {
      const userAiRouteHandler = require('../lib/dispatcher/userAiRouteHandler');
      return userAiRouteHandler.handleUnifiedUserChatMode(req, res, req.userId);
    } else {
      const wuyinRouteHandler = require('../lib/dispatcher/adapters/wuyin/wuyinRouteHandler');
      const handled = await wuyinRouteHandler.handleSubmitMode(req, res, req.userId, taskType || 'image');
      if (handled) return handled;

      return sendError(res, 400, 'UNSUPPORTED_TASK', 'Unsupported task type for this user route.');
    }
  }

  // 2. 系统积分模型派发路径
  if (isChat) {
    const BackendDispatcher = require('../lib/dispatcher');
    try {
      const unifiedPayload = {
        task_type: 'chat',
        model: req.body?.model || 'gpt-4o-mini',
        messages: req.body?.messages,
        temperature: req.body?.temperature || 0.7,
        requestId: req.headers['x-client-request-id'] || req.body?.requestId
      };
      const result = await BackendDispatcher.dispatch(req.userId, unifiedPayload);
      metricsCollector.recordRouteCall({ routePath: '/api/v1/generate', success: true, latency: Date.now() - startTime });
      return res.json(result);
    } catch (err) {
      metricsCollector.recordRouteCall({ routePath: '/api/v1/generate', success: false, latency: Date.now() - startTime });
      return sendError(res, err.statusCode || 500, err.code || 'AI_CHAT_FAILED', err.message || 'Chat failed.');
    }
  } else {
    const generationController = require('../lib/generation/generationController');
    return generationController.handleGenerate(req, res);
  }
});

function mapModeToMediaType(mode) {
  if (mode === 'image' || mode === 'video' || mode === 'audio') return mode;
  return null;
}

function defaultModelForMediaType(mediaType) {
  if (mediaType === 'image') return 'image_nanoBanana2';
  if (mediaType === 'video') return 'sora';
  if (mediaType === 'audio') return 'voice';
  return 'image_nanoBanana2';
}

function buildAsyncMeta(req) {
  return {
    requestId: req.headers['x-request-id'] || req.body?.requestId || `req-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
}

function determineJobStatus(items) {
  if (items.length === 0) return 'pending';
  if (items.every((i) => i.status === 'completed')) return 'success';
  if (items.every((i) => i.status === 'failed' || i.status === 'cancelled')) return 'failed';
  if (items.some((i) => i.status === 'completed')) return 'success';
  return 'pending';
}

async function submitAsyncViaGenerationV3(userId, req) {
  const mode = req.body?.mode;
  const mediaType = mapModeToMediaType(mode);
  const model = String(req.body?.model || req.body?.modelId || defaultModelForMediaType(mediaType)).trim();
  const count = Math.max(1, Number(req.body?.count || req.body?.n || 1));
  const prompt = String(req.body?.prompt || req.body?.text || '').trim();

  const quote = await generationV3.createQuote(userId, {
    mediaType,
    model,
    count,
    preferredChannel: 'platform-credits',
  });

  const job = await generationV3.createJobFromQuote(userId, {
    quoteId: quote.quoteId,
    payload: { prompt, ...(req.body || {}) },
  });

  const submitted = await generationV3.submitJob(userId, job.jobId);
  const status = determineJobStatus(submitted.items);
  const completedItems = submitted.items.filter((i) => i.status === 'completed');
  const pendingLikeItems = submitted.items.filter((i) => ['pending', 'submitted', 'running'].includes(i.status));
  const representativeItem = completedItems[0] || pendingLikeItems[0] || submitted.items[0];

  return {
    success: true,
    data: {
      urls: completedItems.map((i) => i.assetId || '').filter(Boolean),
      url: completedItems[0]?.assetId || '',
      taskId: job.jobId,
      providerTaskId: representativeItem?.providerTaskId || '',
      status,
      endpointType: `generation-v3-${mediaType}`,
      modelId: model,
      requestId: req.body?.requestId,
      quoteId: quote.quoteId,
      jobId: job.jobId,
      route: quote.routeSnapshot,
    },
    meta: buildAsyncMeta(req),
  };
}

async function queryAsyncStatusViaGenerationV3(userId, req) {
  const localTaskId = String(req.body?.localTaskId || req.body?.taskId || '').trim();
  if (!localTaskId) {
    const err = new Error('localTaskId/taskId is required.');
    err.code = 'INVALID_REQUEST';
    err.statusCode = 400;
    throw err;
  }

  const job = await generationV3.getJob(localTaskId, userId);
  if (!job) {
    const err = new Error('Job not found.');
    err.code = 'JOB_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  const status = determineJobStatus(job.items);
  const completedItems = job.items.filter((i) => i.status === 'completed');
  const pendingLikeItems = job.items.filter((i) => ['pending', 'submitted', 'running'].includes(i.status));
  const representativeItem = completedItems[0] || pendingLikeItems[0] || job.items[0];
  const failedItem = job.items.find((i) => i.status === 'failed');

  return {
    success: true,
    data: {
      taskId: job.jobId,
      providerTaskId: representativeItem?.providerTaskId || '',
      status,
      url: completedItems[0]?.assetId || '',
      urls: completedItems.map((i) => i.assetId || '').filter(Boolean),
      message: failedItem?.errorMessage,
      error: failedItem ? (failedItem.errorMessage || 'Task failed.') : undefined,
      endpointType: `generation-v3-${job.model}`,
      modelId: job.model,
      route: { provider: job.provider, adapter: job.provider },
    },
    meta: buildAsyncMeta(req),
  };
}

// 统一异步与轮询状态端点 (WS-3)
router.post('/v1/generate/async', requireAuth, async (req, res) => {
  const startTime = Date.now();
  const mode = req.body?.mode;
  let routeId = req.body?.routeId || req.headers['x-key-slot-id'];

  // 状态轮询时自动解析 taskId 中内嵌 of routeId
  if (mode === 'task_status') {
    const localTaskId = req.body?.localTaskId || req.body?.taskId;
    const { decodeLocalProxyTaskId } = require('../lib/dispatcher/adapters/wuyin/wuyinModelExecutor');
    const parsed = decodeLocalProxyTaskId(localTaskId);
    if (parsed.routeId) {
      routeId = parsed.routeId;
    }
  }

  // 无 routeId 时走 generation-v3 平台积分通道，移除"必须带 routeId"的限制
  if (!routeId) {
    try {
      let result;
      if (mode === 'task_status') {
        result = await queryAsyncStatusViaGenerationV3(req.userId, req);
      } else if (['image', 'video', 'audio'].includes(mode)) {
        result = await submitAsyncViaGenerationV3(req.userId, req);
      } else {
        return sendError(res, 400, 'UNSUPPORTED_MODE', 'Unsupported async mode.');
      }
      metricsCollector.recordRouteCall({ routePath: '/api/v1/generate/async', success: true, latency: Date.now() - startTime });
      return res.json(result);
    } catch (err) {
      metricsCollector.recordRouteCall({ routePath: '/api/v1/generate/async', success: false, latency: Date.now() - startTime });
      if (err.code === 'INSUFFICIENT_CREDITS') {
        return sendError(res, 402, err.code, err.message, { currentCredits: err.currentCredits, requiredCredits: err.requiredCredits });
      }
      if (err.code === 'SETUP_REQUIRED') {
        return sendError(res, 403, err.code, err.message);
      }
      return sendError(res, err.statusCode || 500, err.code || 'INTERNAL_ERROR', err.message);
    }
  }

  if (routeId) {
    const { resolveLocalUserRoute } = require('../lib/dispatcher/localUserRouteStore');
    const route = await resolveLocalUserRoute(req.userId, routeId);
    if (!route) {
      return sendError(res, 404, 'USER_ROUTE_NOT_FOUND', 'User API route not found.');
    }

    // 域名白名单安全过滤
    if (!validateProxyTargetHost(route.baseUrl)) {
      metricsCollector.recordRouteCall({ routePath: '/api/v1/generate/async', success: false, latency: Date.now() - startTime });
      return sendError(
        res,
        403,
        'FORBIDDEN_PROXY_TARGET',
        `访问被拒绝。该任务 API 路由目标 '${route.baseUrl || ''}' 未在系统安全白名单域名中。`
      );
    }
  }

  const wuyinRouteHandler = require('../lib/dispatcher/adapters/wuyin/wuyinRouteHandler');
  if (mode === 'task_status') {
    return wuyinRouteHandler.handleStatusMode(req, res, req.userId);
  } else if (mode === 'video' || mode === 'audio' || mode === 'image') {
    return wuyinRouteHandler.handleSubmitMode(req, res, req.userId, mode);
  }

  return sendError(res, 400, 'UNSUPPORTED_MODE', 'Unsupported async mode.');
});

module.exports = router;
module.exports._helpers = {
  mapModeToMediaType,
  defaultModelForMediaType,
  determineJobStatus,
  submitAsyncViaGenerationV3,
  queryAsyncStatusViaGenerationV3,
};
