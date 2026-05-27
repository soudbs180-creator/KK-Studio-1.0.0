// server/routes/generate-image.js
// 职责：平台代理 Gemini 图像生成/编辑入口，所有成功调用都必须先扣积分，失败再退款。

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
  if (executionLane === 'local-user-api') {
    return rejectLocalUserApiRequest(res);
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
    });
  } catch (err) {
    console.error('[Gemini Image Generation Error]', err);
    if (creditsDeducted) {
      try {
        await credits.refundCredits(userId, requiredCredits, operationKey, currentCredits);
      } catch (refundErr) {
        console.error('[Gemini Image Generation Error] refund failed, manual intervention required:', refundErr);
      }
    }

    return res.status(500).json({ error: 'Image generation or edit failed. Credits refunded.' });
  }
}

router.post('/generate-image', handleGenerateImage);
router.post('/generate/image', handleGenerateImage);
router.post('/generate/edit', handleGenerateImage);

module.exports = router;
