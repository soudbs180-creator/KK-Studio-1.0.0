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

const router = express.Router();

const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1).max(8000),
});

const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(40),
  model: z.string().optional(), // 支持模型选择传递
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

    if (activeProvider === 'suchuang') {
      const modelName = parsed.data.model || 'chat_index';
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

      return res.json({
        role: 'assistant',
        content: result.text,
        credits: currentCredits,
        creditsCost: requiredCredits,
      });
    }

    // 2. 组装 Unified Internal Request payload
    const unifiedPayload = {
      task_type: 'chat',
      model: parsed.data.model || process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages: parsed.data.messages,
      temperature: 0.7
    };

    // 3. 彻底委托给统一派发器执行
    const result = await BackendDispatcher.dispatch(userId, unifiedPayload);

    res.setHeader('X-Refresh-Token', signJWT({ userId }));
    res.setHeader('X-Client-Request-Id', requestId);
    
    return res.json(result);
  } catch (err) {
    if (err.statusCode === 402) {
      return sendInsufficientCredits(res, err.credits, err.creditsCost, requestId);
    }
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Chat failed.',
      code: err.code || 'AI_CHAT_FAILED',
      requestId,
    });
  }
});

module.exports = router;
