// netlify/functions/generate-image.ts
// 职责：处理图像生成和图像编辑请求。
// 1. 进行 JWT 鉴权以获取用户 ID。
// 2. 校验入参，并计算所需积分（普通生成需 10 积分，编辑需 15 积分）。
// 3. 判断是否为系统积分结算模式 (creditSettlement !== 'client')。如果是用户设置的 API，则跳过积分扣减与退款。
// 4. 从数据库中检查用户积分，不足则拦截（仅积分结算模式下生效）。
// 5. “先扣积分”机制：调用 Gemini 之前先扣除积分，确保在高并发或异常下防篡改（仅积分结算模式下生效）。
// 6. 调用可信后端 @google/genai 客户端，模型选用 gemini-2.5-flash-image。
// 7. 将生成的图像 base64 存入数据库历史记录表 public.generations。
// 8. 若成功生成，向用户返回图片及扣减后的最新余额（非积分模式返回当前余额）。
// 9. “后退积分”机制：若调用 Gemini API 失败或抛出异常，在 catch 块中向用户退回扣除的积分，保证交易安全性（仅积分结算模式下生效）。

import type { Handler } from "@netlify/functions";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { query } from "../lib/db";
import { verifyJWT } from "../lib/jwt";
import { makeResponse, makeErrorResponse, COMMON_HEADERS } from "../lib/response";

// 初始化 Gemini 客户端，只能使用后端环境变量
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// 请求入参校验 schema
const GenerateRequestSchema = z.object({
  prompt: z.string().min(1).max(1000), // 限制提示词长度在 1-1000 字符内
  referenceImageBase64: z.string().optional(), // 图像编辑时传入的参考图 base64
  aspectRatio: z.enum(["1:1", "16:9", "9:16"]).default("1:1"), // 输出比例
  creditSettlement: z.enum(["server", "client"]).optional(), // 结算模式，'client' 代表用户自定义 API
});

export const handler: Handler = async (event) => {
  // 拦截 OPTIONS 预检请求以支持跨域
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: COMMON_HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return makeErrorResponse(405, "Method not allowed.");
  }

  // 1. JWT 鉴权
  const userId = verifyJWT(event.headers.authorization);
  if (!userId) {
    return makeErrorResponse(401, "Unauthorized.");
  }

  // 声明积分状态变量以辅助在 catch 中进行退款
  let creditsDeducted = false;
  let requiredCredits = 10;

  try {
    // 2. 校验参数
    const payload = JSON.parse(event.body || "{}");
    const parsed = GenerateRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return makeErrorResponse(400, "Invalid generation options or prompt too long.");
    }
    const { prompt, referenceImageBase64, aspectRatio, creditSettlement } = parsed.data;

    const isEditMode = !!referenceImageBase64;
    requiredCredits = isEditMode ? 15 : 10; // 普通生成扣 10 积分，编辑扣 15 积分

    // 判断是否为平台系统积分结算模式。如果用户传入 client 则说明使用的是用户设置的自定义 API，不扣积分。
    const isServerSettlement = creditSettlement !== "client";

    // 3. 校验用户余额 (仅在系统积分模型下进行)
    let currentCredits = 0;
    const userRes = await query("SELECT credits FROM public.users WHERE id = $1", [userId]);
    if (userRes.rows.length > 0) {
      currentCredits = parseInt(userRes.rows[0].credits);
    } else {
      return makeErrorResponse(401, "User not found.");
    }

    if (isServerSettlement) {
      if (currentCredits < requiredCredits) {
        return makeErrorResponse(402, "Insufficient credits. Please recharge.");
      }

      // 4. “先扣”机制：在真正请求 Gemini 之前扣除积分 (仅在系统积分模型下进行)
      const nextCredits = currentCredits - requiredCredits;
      await query("UPDATE public.users SET credits = $1, updated_at = NOW() WHERE id = $2", [nextCredits, userId]);
      creditsDeducted = true;
      currentCredits = nextCredits;
    }

    // 5. 组装多模态输入内容
    const contents: any[] = [{ text: prompt }];
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

    // 6. 调用 Gemini API
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image", // nano-banana 模型，保持契约一致
      contents,
      config: {
        // 声明期望返回 of 媒体类型为 IMAGE 和 TEXT
        responseModalities: ["IMAGE", "TEXT"],
        aspectRatio: isEditMode ? undefined : aspectRatio, // 编辑模式由参考图决定比例
      },
    });

    // 提取图像 part
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p.inlineData);
    if (!imagePart?.inlineData) {
      throw new Error("Gemini API failed to return image data, possibly blocked by safety filters.");
    }

    const generatedMimeType = imagePart.inlineData.mimeType || "image/png";
    const generatedBase64 = `data:${generatedMimeType};base64,${imagePart.inlineData.data}`;
    const generatedText = parts.find((p: any) => p.text)?.text ?? "";

    // 7. 保存生成历史到数据库
    const actionType = isEditMode ? "image_edit" : "image_generation";
    await query(
      "INSERT INTO public.generations (user_id, prompt, image_url, model, type) VALUES ($1, $2, $3, $4, $5)",
      [userId, prompt, generatedBase64, "gemini-2.5-flash-image", actionType]
    );

    // 返回最新余额和生成的图像
    return makeResponse(200, {
      success: true,
      image: generatedBase64,
      text: generatedText,
      credits: currentCredits,
    });
  } catch (err: any) {
    console.error("[Gemini Image Generation Error]", err);
    if (isServerSettlement && creditsDeducted) {
      try {
        // “后退”机制：调用 Gemini 发生错误时，向用户退回扣除的积分
        await query("UPDATE public.users SET credits = credits + $1, updated_at = NOW() WHERE id = $2", [requiredCredits, userId]);
        console.log(`[Gemini Image Generation Error] 已成功退回用户 ${userId} 的 ${requiredCredits} 积分。`);
      } catch (refundErr) {
        console.error("[Gemini Image Generation Error] 异常退回积分失败！", refundErr);
      }
    }
    return makeErrorResponse(500, isServerSettlement ? "Image generation or edit failed. Credits refunded." : "Image generation or edit failed.");
  }
};
