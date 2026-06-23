/**
 * @file chat.js
 * @module server/routes
 * @description 受积分事务保护的 OpenAI 对话 API 路由。提供请求格式强校验、积分扣除/退款时序控制，并可串联记录 Token 用量审计。
 */

const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const { verifyJWT, signJWT } = require('../lib/jwt');
const { getPool } = require('../lib/db');
const credits = require('../lib/credits');
const { createFixedWindowRateLimiter } = require('../lib/fixedWindowRateLimiter');
const BackendDispatcher = require('../lib/dispatcher'); // 引入统一派发器
const metricsCollector = require('../lib/dispatcher/metricsCollector');

const router = express.Router();

const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1).max(8000),
});

const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(40),
  model: z.string().trim().min(1).max(256).optional(), // 支持模型/供应商选择传递，例如 gpt-4o-mini@system_openai
  creditSettlement: z.enum(['server', 'client']).optional(),
  executionLane: z.enum(['local-user-api', 'cloud-credit-model']).optional(),
});

function resolveRequestId(req) {
  const incoming = String(req.headers['x-client-request-id'] || '').trim();
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(incoming) ? incoming : crypto.randomUUID();
}

function sendInsufficientCredits(res, currentCredits, requiredCredits, requestId) {
  return res.status(402).json({
    error: 'Insufficient credits.',
    code: 'INSUFFICIENT_CREDITS',
    requestId: requestId || require('crypto').randomUUID(),
    credits: Math.max(0, Number(currentCredits) || 0),
    creditsCost: requiredCredits,
  });
}

const LIMIT_WINDOW_MS = 60 * 1000;
const MAX_CHAT_LIMIT = 20;
const chatLimiter = createFixedWindowRateLimiter({
  windowMs: LIMIT_WINDOW_MS,
  max: MAX_CHAT_LIMIT,
});

router.post('/chat', async (req, res) => {
  const startTime = Date.now();
  const requestId = resolveRequestId(req);
  const userId = verifyJWT(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({
      error: 'Unauthorized.',
      code: 'UNAUTHORIZED',
      requestId,
    });
  }

  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid chat messages.',
      code: 'INVALID_REQUEST',
      requestId,
    });
  }

  const isLocalUserApi = parsed.data.executionLane === 'local-user-api';
  if (isLocalUserApi) {
    return res.status(409).json({
      error: 'User-owned API requests must use the local user API route. No credits were charged.',
      code: 'LOCAL_USER_API_REJECTED',
      requestId,
    });
  }

  // 1. 云端积分模型限流器（只对非 local-user-api 生效）
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const limitKey = `${ip}:${userId}`;
  const clientLimit = chatLimiter.check(limitKey);

  if (!clientLimit.allowed) {
    const retryAfter = clientLimit.retryAfter;
    return res.status(429).json({
      error: `云端模型对话请求过于频繁，请在 ${retryAfter} 秒后重试。使用自带 API Key 模式不受限制。`,
      code: 'RATE_LIMITED',
      requestId,
    });
  }

  res.setHeader('X-Refresh-Token', signJWT({ userId }));

  try {
    const { getActiveGatewayProvider } = require('../utils/apiGatewayConfig');
    const { SuchuangProvider } = require('../providers/suchuangProvider');
    const activeProvider = getActiveGatewayProvider();
    const requestedModel = String(parsed.data.model || '').trim();

    // 简体中文注释：仅在用户没有显式选择模型/供应商时保留 ACTIVE_API_PROVIDER= suchuang 的旧全局兜底；
    // 一旦前端传入 model 或 model@provider，必须交给 BackendDispatcher 按用户选择路由，避免全局开关覆盖用户选择。
    if (activeProvider === 'suchuang' && !requestedModel) {
      const modelName = 'chat_index';
      console.log(`Routing ${modelName} to Suchuang API Gateway`);

      const pool = getPool();
      const requiredCredits = await credits.getOperationCost(pool, 'chat');
      const availableCredits = await credits.getUserCredits(userId);
      if (availableCredits < requiredCredits) {
        return sendInsufficientCredits(res, availableCredits, requiredCredits, requestId);
      }

      const currentCredits = await credits.deductCredits(userId, requiredCredits, 'chat');
      let result;
      try {
        const lastMsg = parsed.data.messages[parsed.data.messages.length - 1]?.content || '';
        result = await SuchuangProvider.generateText({
          prompt: lastMsg,
          modelId: modelName,
          stream: false
        });
      } catch (err) {
        try {
          await credits.refundCredits(userId, requiredCredits, 'chat', currentCredits);
        } catch (refundErr) {
          console.error('[P0 ALERT] 积分退款失败，需人工介入', refundErr);
        }
        throw err;
      }

      res.setHeader('X-Refresh-Token', signJWT({ userId }));
      res.setHeader('X-Client-Request-Id', requestId);

      metricsCollector.recordRouteCall({ routePath: '/api/chat', success: true, latency: Date.now() - startTime });
      return res.json({
        role: 'assistant',
        content: result.text,
        credits: currentCredits,
        creditsCost: requiredCredits,
        provider: 'suchuang',
        providerName: '速创 API Gateway',
        model: modelName,
      });
    }

    // 2. 组装 Unified Internal Request payload
    const unifiedPayload = {
      task_type: 'chat',
      model: requestedModel || process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages: parsed.data.messages,
      temperature: 0.7,
      requestId
    };

    // 3. 彻底委托给统一派发器执行
    const result = await BackendDispatcher.dispatch(userId, unifiedPayload);

    res.setHeader('X-Refresh-Token', signJWT({ userId }));
    res.setHeader('X-Client-Request-Id', requestId);

    metricsCollector.recordRouteCall({ routePath: '/api/chat', success: true, latency: Date.now() - startTime });
    return res.json(result);
  } catch (err) {
    metricsCollector.recordRouteCall({ routePath: '/api/chat', success: false, latency: Date.now() - startTime });
    if (err.statusCode === 402) {
      return sendInsufficientCredits(res, err.credits, err.creditsCost, requestId);
    }
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Chat failed.',
      code: err.code || 'AI_CHAT_FAILED',
      requestId,
      route: err.route,
    });
  }
});

module.exports = router;
