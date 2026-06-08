/**
 * @file generate-image.js
 * @module server/routes
 * @description 平台代理图像生成与编辑路由。处理积分预扣、图像生成配置组装、安全过滤及错误发生时的退款链路。
 *              命中 Wuyin/速创时必须按 strictProviderContracts 中的官方文档契约执行，禁止旧模型/旧表单逻辑污染。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const { getPool } = require('../lib/db');
const { verifyJWT, signJWT } = require('../lib/jwt');
const credits = require('../lib/credits');
const { createFixedWindowRateLimiter } = require('../lib/fixedWindowRateLimiter');
const { assertStrictTaskSupported } = require('../lib/dispatcher/strictProviderContracts');

const router = express.Router();
const isTestRun = process.env.NODE_ENV === 'test' || process.argv.some((arg) => arg.includes('test'));

const GenerateRequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  referenceImageBase64: z.string().optional(),
  aspectRatio: z.enum(['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9']).default('1:1'),
  size: z.string().max(40).optional(),
  model: z.string().max(120).optional(),
  creditSettlement: z.enum(['server', 'client']).optional(),
  executionLane: z.enum(['local-user-api', 'cloud-credit-model']).optional(),
});

function rejectLocalUserApiRequest(res, requestId) {
  return res.status(409).json({
    error: 'User-owned API requests must use the local user API route. No credits were charged.',
    code: 'LOCAL_USER_API_REJECTED',
    requestId: requestId || require('crypto').randomUUID(),
  });
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

function assertWuyinImageContract(modelName) {
  const contractTask = assertStrictTaskSupported('wuyin-suchuang-form', 'image', { modelId: modelName });
  if (contractTask?.adapterId !== 'wuyin_async_task') {
    const error = new Error(`Wuyin 图片模型 ${modelName} 必须走 wuyin_async_task 文档化异步契约。`);
    error.code = 'WUYIN_IMAGE_CONTRACT_MISMATCH';
    error.statusCode = 400;
    throw error;
  }
  return contractTask;
}

const LIMIT_WINDOW_MS = 60 * 1000;
const MAX_IMAGE_LIMIT = 10;
const imageLimiter = createFixedWindowRateLimiter({
  windowMs: LIMIT_WINDOW_MS,
  max: MAX_IMAGE_LIMIT,
});

async function handleGenerateImage(req, res) {
  const requestId = String(req.headers['x-client-request-id'] || req.headers['x-request-id'] || '').trim() || require('crypto').randomUUID();
  const userId = verifyJWT(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({
      error: 'Unauthorized.',
      code: 'UNAUTHORIZED',
      requestId,
    });
  }

  const parsed = GenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid generation options or prompt too long.',
      code: 'INVALID_REQUEST',
      requestId,
      details: parsed.error.issues,
    });
  }

  const { prompt, referenceImageBase64, aspectRatio, executionLane, size } = parsed.data;
  const isLocalUserApi = executionLane === 'local-user-api';
  if (isLocalUserApi) {
    return rejectLocalUserApiRequest(res, requestId);
  }

  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const limitKey = `${ip}:${userId}`;
  const clientLimit = imageLimiter.check(limitKey);
  if (!clientLimit.allowed) {
    return res.status(429).json({
      error: `云端模型生成请求过于频繁，请在 ${clientLimit.retryAfter} 秒后重试。使用自带 API Key 模式不受限制。`,
      code: 'RATE_LIMITED',
      requestId,
    });
  }

  res.setHeader('X-Refresh-Token', signJWT({ userId }));

  const pool = getPool();
  const isEditMode = Boolean(referenceImageBase64);
  const operationKey = isEditMode ? 'image_edit' : 'image_generation';
  let requiredCredits = 0;
  let currentCredits = 0;
  let creditsDeducted = false;

  const { getActiveGatewayProvider } = require('../utils/apiGatewayConfig');
  const { SuchuangProvider } = require('../providers/suchuangProvider');
  const activeProvider = getActiveGatewayProvider();

  try {
    requiredCredits = await credits.getOperationCost(pool, operationKey);
    const availableCredits = await credits.getUserCredits(userId);
    if (availableCredits < 0) {
      return res.status(401).json({
        error: 'User not found.',
        code: 'USER_NOT_FOUND',
        requestId,
      });
    }
    if (availableCredits < requiredCredits) {
      return sendInsufficientCredits(res, availableCredits, requiredCredits, requestId);
    }

    currentCredits = await credits.deductCredits(userId, requiredCredits, operationKey);
    creditsDeducted = true;

    if (activeProvider === 'suchuang') {
      const modelName = parsed.data.model || 'image_nanoBanana2';
      const contractTask = assertWuyinImageContract(modelName);
      console.log(`Routing ${modelName} to Wuyin documented async image API`, {
        endpointPattern: contractTask.endpointPattern,
        resultEndpoint: contractTask.resultEndpoint,
      });

      const result = await SuchuangProvider.generateImage({
        prompt,
        modelId: modelName,
        aspectRatio,
        size,
        referenceImages: referenceImageBase64 ? [referenceImageBase64] : [],
        generateCount: 1,
      });

      const imageUrl = result.image;
      if (!imageUrl) {
        throw new Error('Wuyin API failed to return image URL.');
      }

      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        await fs.promises.mkdir(uploadsDir, { recursive: true });
      }

      const fileExt = imageUrl.split('.').pop()?.split('?')[0] || 'png';
      const filename = `kkai-gen-${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
      const filePath = path.join(uploadsDir, filename);

      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image from Wuyin upstream: ${imageResponse.statusText}`);
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      await fs.promises.writeFile(filePath, Buffer.from(arrayBuffer));
      const staticImageUrl = `/uploads/${filename}`;

      await pool.query(
        'INSERT INTO public.generations (user_id, prompt, image_url, model, type) VALUES ($1, $2, $3, $4, $5)',
        [userId, prompt, staticImageUrl, modelName, operationKey]
      );

      return res.json({
        success: true,
        image: staticImageUrl,
        text: '',
        credits: currentCredits,
        creditsCost: requiredCredits,
        route: {
          provider: 'wuyin-suchuang-form',
          model: modelName,
          strictContractChecked: true,
          adapter: 'wuyin_async_task',
          docUrl: result.wuyinDocUrl,
        },
      });
    }

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
        imageConfig: isEditMode ? undefined : { aspectRatio: ['1:1', '16:9', '9:16'].includes(aspectRatio) ? aspectRatio : '1:1' },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part) => part.inlineData);
    if (!imagePart?.inlineData) {
      throw new Error('Gemini API failed to return image data, possibly blocked by safety filters.');
    }

    const generatedMimeType = imagePart.inlineData.mimeType || 'image/png';
    const generatedText = parts.find((part) => part.text)?.text ?? '';
    const actionType = isEditMode ? 'image_edit' : 'image_generation';

    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      await fs.promises.mkdir(uploadsDir, { recursive: true });
    }

    const fileExt = generatedMimeType.split('/')[1] || 'png';
    const filename = `kkai-gen-${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
    const filePath = path.join(uploadsDir, filename);

    await fs.promises.writeFile(filePath, Buffer.from(imagePart.inlineData.data, 'base64'));
    const staticImageUrl = `/uploads/${filename}`;

    await pool.query(
      'INSERT INTO public.generations (user_id, prompt, image_url, model, type) VALUES ($1, $2, $3, $4, $5)',
      [userId, prompt, staticImageUrl, 'gemini-2.5-flash-image', actionType]
    );

    return res.json({
      success: true,
      image: staticImageUrl,
      text: generatedText,
      credits: currentCredits,
      creditsCost: requiredCredits,
      route: {
        provider: 'google-gemini-official',
        model: 'gemini-2.5-flash-image',
        sdk: '@google/genai',
      },
    });
  } catch (err) {
    console.error('[Image Generation Error]', err);
    if (!creditsDeducted && credits.isInsufficientCreditsError(err)) {
      return sendInsufficientCredits(res, currentCredits, requiredCredits, requestId);
    }

    let refundFailed = false;
    if (creditsDeducted) {
      try {
        await credits.refundCredits(userId, requiredCredits, operationKey, currentCredits);
      } catch (refundErr) {
        refundFailed = true;
        console.error('[P0 ALERT] 积分退款失败，需人工介入', {
          userId,
          cost: requiredCredits,
          originalError: err.message,
          refundError: refundErr.message,
          timestamp: new Date().toISOString(),
          requestId,
        });
      }
    }

    if (refundFailed) {
      return res.status(500).json({
        error: 'Image generation or edit failed. Credit refund failed and requires manual intervention.',
        code: 'REFUND_FAILED',
        requestId,
      });
    }

    return res.status(err.statusCode || 500).json({
      error: creditsDeducted
        ? 'Image generation or edit failed. Credits refunded.'
        : 'Image generation or edit failed. No credits were charged.',
      message: err.message,
      code: err.code || 'AI_GENERATION_FAILED',
      route: err.route,
      requestId,
    });
  }
}

router.post('/generate-image', handleGenerateImage);
router.post('/generate/image', handleGenerateImage);
router.post('/generate/edit', handleGenerateImage);

module.exports = router;
