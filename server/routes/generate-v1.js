/**
 * @file generate-v1.js
 * @module server/routes
 * @description 统一的同步与异步生成网关路由模块。
 *              整合原有const express = require('express');
const { verifyJWT } = require('../lib/jwt');
const { listProviders } = require('../lib/dispatcher/providerRegistry');
const metricsCollector = require('../lib/dispatcher/metricsCollector');

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
