// server/routes/generate-image.js
// 职责：处理图像生成和重绘编辑请求，基于 Express 提供端点。
// 1. 进行统一的 JWT 鉴权。
// 2. 校验参数并确定定价额度（调用 credits.getOperationCost）。
// 3. 并发安全的先扣减积分交易（调用 credits.deductCredits）。
// 4. 调用 Google Gemini SDK (gemini-2.5-flash-image 模型) 生成。
// 5. 保存历史记录至 public.generations。
// 6. 若 API 调用发生故障，后退款保障交易完整性（调用 credits.refundCredits）。
// 遵守规范：所有代码和变更使用中文注释，对外英文报错脱敏。

const express = require('express');
const { z } = require('zod');
const { getPool } = require('../lib/db');
const { verifyJWT } = require('../lib/jwt');
const credits = require('../lib/credits');

const router = express.Router();

// 判断是否为单元测试运行（防止测试环境下无配置报错）
const isTestRun = process.env.NODE_ENV === 'test' || process.argv.some(arg => arg.includes('test'));

// 参数格式校验 schema
const GenerateRequestSchema = z.object({
  prompt: z.string().min(1).max(1000), // 限制提示词在 1-1000 字符内
  referenceImageBase64: z.string().optional(), // 图像编辑参考图
  aspectRatio: z.enum(["1:1", "16:9", "9:16"]).default("1:1"), // 比例
  creditSettlement: z.enum(["server", "client"]).optional(), // 结算选项，client 代表使用用户自定义 API 密钥模式
});

/**
 * 图像生成中转 Express 路由处理器
 * 挂载后实际对应 POST /api/generate-image 端点
 */
router.post('/generate-image', async (req, res) => {
  // 1. 统一 JWT 鉴权
  const userId = verifyJWT(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  let creditsDeducted = false;
  let requiredCredits = 10;
  let currentCredits = 0;
  const pool = getPool();

  // 2. 参数结构安全校验
  const parsed = GenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid generation options or prompt too long." });
  }
  const { prompt, referenceImageBase64, aspectRatio, creditSettlement } = parsed.data;

  const isEditMode = !!referenceImageBase64;
  const operationKey = isEditMode ? "image_edit" : "image_generation";

  try {
    // 从数据库动态获取当前操作的积分扣减额度（降级自动容灾）
    requiredCredits = await credits.getOperationCost(pool, operationKey);
    const isServerSettlement = creditSettlement !== "client";

    if (isServerSettlement) {
      // 3. “先扣”机制：以原子事务形式安全扣减积分，避免并发导致的扣为负分
      currentCredits = await credits.deductCredits(userId, requiredCredits, operationKey);
      creditsDeducted = true;
    } else {
      // 若使用自带 API Key 模式，仅需要查询用户当前积分
      const queryCredits = await credits.getUserCredits(userId);
      if (queryCredits < 0) {
        return res.status(401).json({ error: "User not found." });
      }
      currentCredits = queryCredits;
    }

    // 4. 组装 Gemini 输入参数并执行去前缀
    const contents = [{ text: prompt }];
    if (referenceImageBase64) {
      // 图像编辑模式：剔除 base64 字符串中的 data URI 前缀，防止官方 SDK 报 400 参数格式错误
      const cleanBase64 = referenceImageBase64.replace(/^data:image\/\w+;base64,/, "");
      contents.push({
        inlineData: {
          mimeType: "image/png",
          data: cleanBase64,
        },
      });
    }

    // 校验 GEMINI_API_KEY，快速失败以保证环境安全，本地单元测试跳过
    if (!process.env.GEMINI_API_KEY && !isTestRun) {
      throw new Error("[严重] GEMINI_API_KEY 未配置，服务拒绝启动");
    }

    // 动态载入 GoogleGenAI ESM 依赖
    const { GoogleGenAI, Modality } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "mock-key-for-testing-only" });

    // 5. 调用 Gemini 官方 SDK
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image", // 锁定的文生图模型
      contents,
      config: {
        // 严格使用官方 Modality 枚举
        responseModalities: [Modality.IMAGE, Modality.TEXT],
        // 传递正确的 imageConfig aspectRatio，如果是编辑重绘模式则不设置特定比例（取决于参考图）
        imageConfig: isEditMode ? undefined : {
          aspectRatio: aspectRatio,
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData);

    // 拦截安全过滤触发或未返回图片的场景
    if (!imagePart?.inlineData) {
      throw new Error("Gemini API failed to return image data, possibly blocked by safety filters.");
    }

    const generatedMimeType = imagePart.inlineData.mimeType || "image/png";
    const generatedBase64 = `data:${generatedMimeType};base64,${imagePart.inlineData.data}`;
    const generatedText = parts.find((p) => p.text)?.text ?? "";

    // 6. 成功后写入用户生成历史记录
    const actionType = isEditMode ? "image_edit" : "image_generation";
    await pool.query(
      "INSERT INTO public.generations (user_id, prompt, image_url, model, type) VALUES ($1, $2, $3, $4, $5)",
      [userId, prompt, generatedBase64, "gemini-2.5-flash-image", actionType]
    );

    // 返回生成结果和剩余积分数
    return res.json({
      success: true,
      image: generatedBase64,
      text: generatedText,
      credits: currentCredits,
    });
  } catch (err) {
    console.error("[Gemini Image Generation Error]", err);

    // 7. “后退”异常安全退款机制
    const isServerSettlement = creditSettlement !== "client";
    if (isServerSettlement && creditsDeducted) {
      try {
        const refundedBalance = await credits.refundCredits(userId, requiredCredits, operationKey, currentCredits);
        console.log(`[Gemini Image Generation Error] 已成功退还用户 ${userId} 的 ${requiredCredits} 积分，最新余额为: ${refundedBalance}`);
      } catch (refundErr) {
        console.error("[Gemini Image Generation Error] 异常退回积分失败！", refundErr);
      }
    }

    return res.status(500).json({
      error: isServerSettlement ? "Image generation or edit failed. Credits refunded." : "Image generation or edit failed."
    });
  }
});

module.exports = router;
