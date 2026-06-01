/**
 * @file generate-image.js
 * @module server/routes
 * @description 平台代理 Google Gemini 图像生成与编辑路由。处理积分预扣、图像生成配置组装、安全过滤及错误发生时的退款链路。
 */

const express = require('express');
const { z } = require('zod');
const { getPool } = require('../lib/db');
const { verifyJWT, signJWT } = require('../lib/jwt');
const credits = require('../lib/credits');

const router = express.Router();
const isTestRun = process.env.NODE_ENV === 'test' || process.argv.some((arg) => arg.includes('test'));

const GenerateRequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  referenceImageBase64: z.string().optional(),
  aspectRatio: z.enum(['1:1', '16:9', '9:16']).default('1:1'),
  creditSettlement: z.enum(['server', 'client']).optional(),
  executionLane: z.enum(['local-user-api', 'cloud-credit-model']).optional(),
});

function rejectLocalUserApiRequest(res) {
  return res.status(409).json({
    error: 'User-owned API requests must use the local user API route. No credits were charged.',
  });
}

function sendInsufficientCredits(res, currentCredits, requiredCredits) {
  return res.status(402).json({
    error: 'Insufficient credits.',
    credits: Math.max(0, Number(currentCredits) || 0),
    creditsCost: requiredCredits,
  });
}

const imageLimiterMap = new Map();
const LIMIT_WINDOW_MS = 60 * 1000;
const MAX_IMAGE_LIMIT = 10;

async function handleGenerateImage(req, res) {
  const userId = verifyJWT(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const parsed = GenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid generation options or prompt too long.' });
  }

  const { prompt, referenceImageBase64, aspectRatio, executionLane } = parsed.data;
  const isLocalUserApi = executionLane === 'local-user-api';
  if (isLocalUserApi) {
    return rejectLocalUserApiRequest(res);
  }

  // 1. 云端积分模型限流器（只对非 local-user-api 生效）
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const limitKey = `${ip}:${userId}`;
  const now = Date.now();
  let clientLimit = imageLimiterMap.get(limitKey);

  if (!clientLimit || now > clientLimit.resetTime) {
    clientLimit = { count: 1, resetTime: now + LIMIT_WINDOW_MS };
    imageLimiterMap.set(limitKey, clientLimit);
  } else {
    clientLimit.count += 1;
    if (clientLimit.count > MAX_IMAGE_LIMIT) {
      const retryAfter = Math.ceil((clientLimit.resetTime - now) / 1000);
      return res.status(429).json({
        error: `云端模型生成请求过于频繁，请在 ${retryAfter} 秒后重试。使用自带 API Key 模式不受限制。`,
      });
    }
  }

  res.setHeader('X-Refresh-Token', signJWT({ userId }));

  const pool = getPool();
  const isEditMode = Boolean(referenceImageBase64);
  const operationKey = isEditMode ? 'image_edit' : 'image_generation';
  let requiredCredits = 0;
  let currentCredits = 0;
  let creditsDeducted = false;

  try {
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

    const contents = [{ text: prompt }];
    if (referenceImageBase64) {
      const cleanBase64 = referenceImageBase64.replace(/^data:image\/\w+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: 'image/png',
          data: cleanBase64,
        },
      });
    }

    if (!process.env.GEMINI_API_KEY && !isTestRun) {
      throw new Error('[严重] GEMINI_API_KEY 未配置，服务拒绝启动');
    }

    const { GoogleGenAI, Modality } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock-key-for-testing-only' });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents,
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
        imageConfig: isEditMode ? undefined : { aspectRatio },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part) => part.inlineData);
    if (!imagePart?.inlineData) {
      throw new Error('Gemini API failed to return image data, possibly blocked by safety filters.');
    }

    const generatedMimeType = imagePart.inlineData.mimeType || 'image/png';
    const generatedBase64 = `data:${generatedMimeType};base64,${imagePart.inlineData.data}`;
    const generatedText = parts.find((part) => part.text)?.text ?? '';
    const actionType = isEditMode ? 'image_edit' : 'image_generation';

    await pool.query(
      'INSERT INTO public.generations (user_id, prompt, image_url, model, type) VALUES ($1, $2, $3, $4, $5)',
      [userId, prompt, generatedBase64, 'gemini-2.5-flash-image', actionType]
    );

    return res.json({
      success: true,
      image: generatedBase64,
      text: generatedText,
      credits: currentCredits,
      creditsCost: requiredCredits,
    });
  } catch (err) {
    console.error('[Gemini Image Generation Error]', err);
    if (!creditsDeducted && credits.isInsufficientCreditsError(err)) {
      return sendInsufficientCredits(res, currentCredits, requiredCredits);
    }

    let refundFailed = false;
    if (creditsDeducted) {
      try {
        await credits.refundCredits(userId, requiredCredits, operationKey, currentCredits);
      } catch (refundErr) {
        refundFailed = true;
        console.error('[Gemini Image Generation Error] refund failed, manual intervention required:', refundErr);
      }
    }

    if (refundFailed) {
      return res.status(500).json({
        error: 'Image generation or edit failed. Credit refund failed and requires manual intervention.',
        refundStatus: 'manual_intervention_required',
      });
    }

    return res.status(500).json({
      error: creditsDeducted
        ? 'Image generation or edit failed. Credits refunded.'
        : 'Image generation or edit failed. No credits were charged.',
    });
  }
}

router.post('/generate-image', handleGenerateImage);
router.post('/generate/image', handleGenerateImage);
router.post('/generate/edit', handleGenerateImage);

module.exports = router;
