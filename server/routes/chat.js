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

const router = express.Router();
const isTestRun = process.env.NODE_ENV === 'test' || process.argv.some((arg) => arg.includes('test'));

const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1).max(8000),
});

const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(40),
  creditSettlement: z.enum(['server', 'client']).optional(),
  executionLane: z.enum(['local-user-api', 'cloud-credit-model']).optional(),
});

function resolveRequestId(req) {
  const incoming = String(req.headers['x-client-request-id'] || '').trim();
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(incoming) ? incoming : crypto.randomUUID();
}

function sendInsufficientCredits(res, currentCredits, requiredCredits) {
  return res.status(402).json({
    error: 'Insufficient credits.',
    credits: Math.max(0, Number(currentCredits) || 0),
    creditsCost: requiredCredits,
  });
}

const chatLimiterMap = new Map();
const LIMIT_WINDOW_MS = 60 * 1000;
const MAX_CHAT_LIMIT = 20;

router.post('/chat', async (req, res) => {
  const userId = verifyJWT(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid chat messages.' });
  }

  const isLocalUserApi = parsed.data.executionLane === 'local-user-api';
  if (isLocalUserApi) {
    return res.status(409).json({
      error: 'User-owned API requests must use the local user API route. No credits were charged.',
    });
  }

  // 1. 云端积分模型限流器（只对非 local-user-api 生效）
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const limitKey = `${ip}:${userId}`;
  const now = Date.now();
  let clientLimit = chatLimiterMap.get(limitKey);

  if (!clientLimit || now > clientLimit.resetTime) {
    clientLimit = { count: 1, resetTime: now + LIMIT_WINDOW_MS };
    chatLimiterMap.set(limitKey, clientLimit);
  } else {
    clientLimit.count += 1;
    if (clientLimit.count > MAX_CHAT_LIMIT) {
      const retryAfter = Math.ceil((clientLimit.resetTime - now) / 1000);
      return res.status(429).json({
        error: `云端模型对话请求过于频繁，请在 ${retryAfter} 秒后重试。使用自带 API Key 模式不受限制。`,
      });
    }
  }

  res.setHeader('X-Refresh-Token', signJWT({ userId }));

  const pool = getPool();
  const operationKey = 'chat';
  let requiredCredits = 0;
  let currentCredits = 0;
  let creditsDeducted = false;

  try {
    if (!process.env.OPENAI_API_KEY && !isTestRun) {
      throw new Error('[严重] OPENAI_API_KEY 未配置，服务拒绝处理对话请求');
    }

    requiredCredits = await credits.getOperationCost(pool, operationKey);
    const availableCredits = await credits.getUserCredits(userId);
    if (availableCredits < 0) {
      return res.status(401).json({ error: 'User not found.' });
    }
    if (availableCredits < requiredCredits) {
      return sendInsufficientCredits(res, availableCredits, requiredCredits);
    }

    currentCredits = await credits.deductCredits(userId, requiredCredits, operationKey);
    creditsDeducted = true;

    const requestId = resolveRequestId(req);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY || 'mock-key-for-testing-only'}`,
        'Content-Type': 'application/json',
        'X-Client-Request-Id': requestId,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
        messages: parsed.data.messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI chat failed: ${response.status} ${errorText.slice(0, 300)}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.length === 0) {
      throw new Error('OpenAI chat returned empty content.');
    }

    const totalTokens = data?.usage?.total_tokens || 0;
    // 整合逻辑：记录实际 token 消耗入库
    if (totalTokens > 0) {
      try {
        await credits.recordTokenUsage(userId, totalTokens, `chat:${requestId}`);
      } catch (tokenErr) {
        console.error('[OpenAI Chat] Failed to record token usage:', tokenErr);
      }
    }

    res.setHeader('X-Refresh-Token', signJWT({ userId }));
    res.setHeader('X-Client-Request-Id', requestId);
    return res.json({
      role: 'assistant',
      content,
      credits: currentCredits,
      creditsCost: requiredCredits,
      tokens: totalTokens,
    });
  } catch (err) {
    console.error('[OpenAI Chat Error]', err);
    if (!creditsDeducted && credits.isInsufficientCreditsError(err)) {
      return sendInsufficientCredits(res, currentCredits, requiredCredits);
    }

    let refundFailed = false;
    if (creditsDeducted) {
      try {
        await credits.refundCredits(userId, requiredCredits, operationKey, currentCredits);
      } catch (refundErr) {
        refundFailed = true;
        console.error('[OpenAI Chat Error] refund failed, manual intervention required:', refundErr);
      }
    }

    if (refundFailed) {
      return res.status(500).json({
        error: 'Chat failed. Credit refund failed and requires manual intervention.',
        refundStatus: 'manual_intervention_required',
      });
    }

    return res.status(500).json({
      error: creditsDeducted
        ? 'Chat failed. Credits refunded.'
        : 'Chat failed. No credits were charged.',
    });
  }
});

module.exports = router;
