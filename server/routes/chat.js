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

router.post('/chat', async (req, res) => {
  const userId = verifyJWT(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid chat messages.' });
  }

  if (parsed.data.executionLane === 'local-user-api') {
    return res.status(409).json({
      error: 'User-owned API requests must use the local user API route. No credits were charged.',
    });
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

    res.setHeader('X-Refresh-Token', signJWT({ userId }));
    res.setHeader('X-Client-Request-Id', requestId);
    return res.json({
      role: 'assistant',
      content,
      credits: currentCredits,
    });
  } catch (err) {
    console.error('[OpenAI Chat Error]', err);
    if (creditsDeducted) {
      try {
        await credits.refundCredits(userId, requiredCredits, operationKey, currentCredits);
      } catch (refundErr) {
        console.error('[OpenAI Chat Error] refund failed, manual intervention required:', refundErr);
      }
    }
    return res.status(500).json({ error: 'Chat failed. Credits refunded.' });
  }
});

module.exports = router;
