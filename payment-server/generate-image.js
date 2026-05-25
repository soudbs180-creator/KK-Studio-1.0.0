// payment-server/generate-image.js
// 职责：在 VPS 端处理图像生成和重绘编辑请求，以取代原有的 Netlify Functions。
// 1. 进行 JWT 鉴权以获取用户 ID。
// 2. 校验入参，并计算所需积分（普通生成扣 10 积分，编辑扣 15 积分）。
// 3. 判断是否为系统积分结算模式 (creditSettlement !== 'client')。如果是用户设置的 API，则跳过积分扣减与退款。
// 4. 从数据库中检查用户积分，不足则拦截（仅积分结算模式下生效）。
// 5. “先扣”机制：调用 Gemini 之前先扣除积分，确保安全防篡减（仅积分结算模式下生效）。
// 6. 调用 Google Gemini 官方 Client，模型选用 gemini-2.5-flash-image。
// 7. 将生成的图像 base64 存入数据库历史记录表 public.generations。
// 8. 若成功生成，向用户返回图片及扣减后的最新余额（非积分模式返回当前余额）。
// 9. “后退”机制：若调用 Gemini API 失败或抛出异常，在 catch 块中向用户退回扣除的积分，保证交易安全性（仅积分结算模式下生效）。

const express = require('express');
const crypto = require('crypto');
const { Pool } = require('pg');
const { z } = require('zod');

// 防御性初始化 Router：解决单元测试中使用 mock express 导致 express.Router 缺失的问题
const router = typeof express.Router === 'function' ? express.Router() : (() => {
  const stub = (req, res, next) => next?.();
  stub.post = () => stub;
  stub.use = () => stub;
  return stub;
})();
let pgPool = null;

// 读取后端的 JWT 签名密钥
const JWT_SECRET = process.env.JWT_SECRET || "nano-banana-kk-super-secret-fallback-token-key-9988";

/**
 * 初始化并获取 PostgreSQL 数据库连接池
 */
function getPgPool() {
  if (!pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn('[payment-generate-image] DATABASE_URL 未配置。');
    }
    pgPool = new Pool({
      connectionString,
      ssl: connectionString && (connectionString.includes('sslmode=require') || process.env.NODE_ENV === 'production')
        ? { rejectUnauthorized: false }
        : false,
    });
  }
  return pgPool;
}

/**
 * Base64url 解码实现
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * 校验并解析 Authorization 头部中的 JWT
 * @param {string | undefined} authHeader 原始 Header（Bearer token）
 * @returns {string | null} 成功返回 userId，失败或过期返回 null
 */
function verifyJWT(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [header, payload, signature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");

  try {
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const decodedPayload = JSON.parse(base64UrlDecode(payload));
    const now = Math.floor(Date.now() / 1000);
    // 判断过期时间
    if (decodedPayload.exp && now > decodedPayload.exp) {
      return null;
    }
    return decodedPayload.userId || null;
  } catch {
    return null;
  }
}

// 请求入参校验 schema
const GenerateRequestSchema = z.object({
  prompt: z.string().min(1).max(1000), // 限制提示词长度在 1-1000 字符内
  referenceImageBase64: z.string().optional(), // 图像编辑时传入的参考图 base64
  aspectRatio: z.enum(["1:1", "16:9", "9:16"]).default("1:1"), // 输出比例
  creditSettlement: z.enum(["server", "client"]).optional(), // 结算模式，'client' 代表用户自定义 API
});

/**
 * 图像生成中转 Express 路由处理器
 */
router.post('/generate-image', async (req, res) => {
  // 1. JWT 鉴权
  const userId = verifyJWT(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  // 声明积分状态变量以辅助在 catch 中进行退款
  let creditsDeducted = false;
  let requiredCredits = 10;
  const pool = getPgPool();

  try {
    // 2. 校验参数
    const parsed = GenerateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid generation options or prompt too long." });
    }
    const { prompt, referenceImageBase64, aspectRatio, creditSettlement } = parsed.data;

    const isEditMode = !!referenceImageBase64;
    requiredCredits = isEditMode ? 15 : 10; // 普通生成扣 10 积分，编辑扣 15 积分

    // 判断是否为平台系统积分结算模式。如果用户传入 client 则说明使用的是用户设置的自定义 API，不扣积分。
    const isServerSettlement = creditSettlement !== "client";

    // 3. 校验用户余额 (仅在系统积分模型下进行)
    let currentCredits = 0;
    const userRes = await pool.query("SELECT credits FROM public.users WHERE id = $1", [userId]);
    if (userRes.rows.length > 0) {
      currentCredits = parseInt(userRes.rows[0].credits, 10);
    } else {
      return res.status(401).json({ error: "User not found." });
    }

    if (isServerSettlement) {
      if (currentCredits < requiredCredits) {
        return res.status(402).json({ error: "Insufficient credits. Please recharge." });
      }

      // 4. “先扣”机制：在真正请求 Gemini 之前扣除积分 (仅在系统积分模型下进行)
      const nextCredits = currentCredits - requiredCredits;
      await pool.query("UPDATE public.users SET credits = $1, updated_at = NOW() WHERE id = $2", [nextCredits, userId]);
      creditsDeducted = true;
      currentCredits = nextCredits;
    }

    // 5. 组装多模态输入内容
    const contents = [{ text: prompt }];
    if (referenceImageBase64) {
      // 图像编辑模式：去除 base64 的 data URI 前缀，防止 Gemini 报 400 错误
      const cleanBase64 = referenceImageBase64.replace(/^data:image\/\w+;base64,/, "");
      contents.push({
        inlineData: {
          mimeType: "image/png",
          data: cleanBase64,
        },
      });
    }

    // 6. 动态载入 GoogleGenAI ESM 客户端
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

    // 7. 调用 Gemini API
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image", // nano-banana 模型
      contents,
      config: {
        responseModalities: ["IMAGE", "TEXT"],
        aspectRatio: isEditMode ? undefined : aspectRatio, // 编辑模式由参考图决定比例
      },
    });

    // 提取图像 part
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData);
    if (!imagePart?.inlineData) {
      throw new Error("Gemini API failed to return image data, possibly blocked by safety filters.");
    }

    const generatedMimeType = imagePart.inlineData.mimeType || "image/png";
    const generatedBase64 = `data:${generatedMimeType};base64,${imagePart.inlineData.data}`;
    const generatedText = parts.find((p) => p.text)?.text ?? "";

    // 8. 保存生成历史到数据库
    const actionType = isEditMode ? "image_edit" : "image_generation";
    await pool.query(
      "INSERT INTO public.generations (user_id, prompt, image_url, model, type) VALUES ($1, $2, $3, $4, $5)",
      [userId, prompt, generatedBase64, "gemini-2.5-flash-image", actionType]
    );

    // 返回最新余额和生成的图像
    return res.json({
      success: true,
      image: generatedBase64,
      text: generatedText,
      credits: currentCredits,
    });
  } catch (err) {
    console.error("[Gemini Image Generation Error]", err);
    
    // 判断是否为系统积分结算模式
    const parsed = GenerateRequestSchema.safeParse(req.body);
    const isServerSettlement = parsed.success && parsed.data.creditSettlement !== "client";

    if (isServerSettlement && creditsDeducted) {
      try {
        // “后退”机制：调用 Gemini 发生错误时，向用户退回扣除的积分
        await pool.query("UPDATE public.users SET credits = credits + $1, updated_at = NOW() WHERE id = $2", [requiredCredits, userId]);
        console.log(`[Gemini Image Generation Error] 已成功退回用户 ${userId} 的 ${requiredCredits} 积分。`);
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
