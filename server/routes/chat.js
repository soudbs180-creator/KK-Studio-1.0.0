// server/routes/chat.js
// 职责：提供受积分事务保护的 OpenAI 对话接口，并对消息结构做强校验。

const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const { verifyJWT, signJWT } = require('../lib/jwt');
const { getPool } = require('../lib/db');
const credits = require('../lib/credits');

const router = express.Router();

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

  const pool = getPool();
  const operationKey = 'chat';
  let requiredCredits = 0;
  let currentCredits = 0;
  let creditsDeducted = false;

  try {
    requiredCredits = await credits.getOperationCost(pool, operationKey);
    currentCredits = await credits.deductCredits(userId, requiredCredits, operationKey);
    creditsDeducted = true;

    const requestId = resolveRequestId(req);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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

    return res.status(500).json({ error: 'Chat failed. Credits refunded.' });
  }
});

module.exports = router;
