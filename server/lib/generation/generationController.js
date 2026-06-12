// server/lib/generation/generationController.js
// 中文注释：大模型图像生成与编辑核心控制器

const crypto = require('crypto');
const { getPool } = require('../db');
const { verifyJWT, signJWT } = require('../jwt');
const billingSaga = require('./generationBillingSaga');
const providerRouter = require('../dispatcher/providerRouter');
const envelope = require('./generationResponseEnvelope');
const { getActiveGatewayProvider } = require('../../utils/apiGatewayConfig');

/**
 * 核心请求处理入口
 */
async function handleGenerate(req, res) {
  const requestId = String(req.headers['x-client-request-id'] || req.headers['x-request-id'] || '').trim() || crypto.randomUUID();
  const authHeader = req.headers.authorization;
  const userId = verifyJWT(authHeader);

  if (!userId) {
    return res.status(401).json(
      envelope.wrapError(
        {
          code: 'UNAUTHORIZED',
          message: 'Unauthorized. Please login first.',
          statusCode: 401,
          requestId
        },
        { requestId }
      )
    );
  }

  // 刷新 token 并以响应头传回
  res.setHeader('X-Refresh-Token', signJWT({ userId }));

  // 1. 解析请求入参
  const {
    prompt,
    referenceImageBase64,
    aspectRatio = '1:1',
    size,
    model,
    executionLane = 'cloud-credit-model'
  } = req.body;

  // 简体中文：本地供应商通道直连请求（local-user-api）应当在进入计费前直接阻断拒绝
  if (executionLane === 'local-user-api') {
    return res.status(409).json(
      envelope.wrapError(
        {
          code: 'LOCAL_USER_API_REJECTED',
          message: 'User-owned API requests must use the local user API route. No credits were charged.',
          statusCode: 409,
          requestId
        },
        { requestId }
      )
    );
  }

  const isEditMode = !!referenceImageBase64;
  const operationKey = isEditMode ? 'image_edit' : 'image_generation';

  // 2. 映射供应商
  // 后端默认使用网关配置的主供应商，若入参有明确的 model 指定，可依据前缀匹配
  let providerId = getActiveGatewayProvider() || 'google';
  let modelId = model;
  
  if (providerId === 'suchuang' || modelId === 'image_nanoBanana2') {
    providerId = 'wuyinkeji';
  } else if (modelId?.includes('gemini') || modelId?.includes('imagen') || providerId === 'google') {
    providerId = 'google';
  }

  if (!modelId) {
    modelId = providerId === 'wuyinkeji' ? 'image_nanoBanana2' : 'gemini-2.5-flash-image';
  }

  // 构造标准输入
  const standardInput = {
    requestId,
    providerId,
    modelId,
    prompt,
    aspectRatio,
    size,
    referenceImages: referenceImageBase64 ? [referenceImageBase64] : [],
    executionLane
  };

  try {
    // 3. 执行 Billing Saga 管理的请求处理
    const result = await billingSaga.execute(
      userId,
      operationKey,
      standardInput,
      async (input) => {
        // 核心执行逻辑
        return providerRouter.generateImage(input);
      }
    );

    // 4. 图像生成落盘成功后写入历史数据库记录
    const pool = getPool();
    const staticImageUrl = result.urls[0] || '';
    if (staticImageUrl) {
      await pool.query(
        'INSERT INTO public.generations (user_id, prompt, image_url, model, type) VALUES ($1, $2, $3, $4, $5)',
        [userId, prompt, staticImageUrl, modelId, operationKey]
      );
    }

    // 5. 返回标准信封响应
    return res.json(envelope.wrapSuccess(result, { requestId, providerId, surface: result.surface }));
  } catch (err) {
    console.error('[Generation Controller Error]', err);
    
    // 如果是 Saga 抛出的带有退款明细的异常
    const payload = envelope.wrapError(err, {
      requestId,
      providerId,
      surface: standardInput.referenceImages.length > 0 ? 'image-edit' : 'image-generation'
    });
    
    // 注入扣减余额信息
    if (err.billing) {
      payload.billing = err.billing;
    }

    return res.status(err.statusCode || 500).json(payload);
  }
}

module.exports = {
  handleGenerate
};
