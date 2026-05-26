// netlify/functions/generate-image.ts
// 职责：Gemini 图像生成中转接口，实现严格防篡改的“先扣后退”积分逻辑与日志落库。
// 所有注释必须使用中文，解释在做什么、为什么这么做

import type { Handler } from "@netlify/functions";
import { GoogleGenAI } from "@google/genai";
import { query } from "../lib/db";
import { verifyJWT } from "../lib/jwt";

// 初始化 Gemini 客户端，API Key 只能从后端环境变量读取
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const handler: Handler = async (event) => {
  const COMMON_HEADERS = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };

  // 1. 处理 OPTIONS 预检请求以支持跨域
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: COMMON_HEADERS, body: "" };
  }

  // 2. 鉴权，验证 JWT
  const userId = verifyJWT(event.headers.authorization);
  if (!userId) {
    return {
      statusCode: 401,
      headers: COMMON_HEADERS,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  const { prompt, referenceImageBase64 } = JSON.parse(event.body || "{}");

  // 3. 检查积分，必须有至少 1 积分才可继续
  const userRes = await query("SELECT credits FROM public.users WHERE id = $1", [userId]);
  const user = userRes.rows[0];
  if (!user || parseInt(user.credits) < 1) {
    return {
      statusCode: 402,
      headers: COMMON_HEADERS,
      body: JSON.stringify({ error: "积分不足，请充值后重试" }),
    };
  }

  const currentCredits = parseInt(user.credits);

  // 4. 先扣积分：真正调用 Gemini API 之前，扣除 1 积分
  await query("UPDATE public.users SET credits = credits - 1 WHERE id = $1", [userId]);

  try {
    // 5. 组装多模态输入内容以调用 Gemini (模型为 gemini-2.5-flash-image)
    // 中文注释：Gemini 要求 base64 字符串不能带 data URI 前缀，否则会报 400 错误
    const contents: any[] = [{ text: prompt }];
    if (referenceImageBase64) {
      const cleanBase64 = referenceImageBase64.replace(/^data:image\/\w+;base64,/, "");
      contents.push({
        inlineData: { mimeType: "image/png", data: cleanBase64 },
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents,
      config: {
        // 必须声明 responseModalities，否则 Gemini 不会返回图像数据
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p.inlineData);
    if (!imagePart?.inlineData) {
      throw new Error("Gemini 未返回图像");
    }

    const generatedBase64 = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;

    // 成功：记录日志
    await query(
      "INSERT INTO public.generations (user_id, prompt, image_url, status, model) VALUES ($1, $2, $3, $4, $5)",
      [userId, prompt, generatedBase64, "done", "gemini-2.5-flash-image"]
    );

    return {
      statusCode: 200,
      headers: COMMON_HEADERS,
      body: JSON.stringify({
        image: generatedBase64,
        creditsRemaining: currentCredits - 1,
      }),
    };

  } catch (err: any) {
    // 失败：退回积分，并记录失败日志
    await query("UPDATE public.users SET credits = credits + 1 WHERE id = $1", [userId]);
    await query(
      "INSERT INTO public.generations (user_id, prompt, status, model) VALUES ($1, $2, $3, $4)",
      [userId, prompt, "failed", "gemini-2.5-flash-image"]
    );
    console.error("[Gemini 生成失败，已退回积分]", err instanceof Error ? err.message : String(err));

    return {
      statusCode: 500,
      headers: COMMON_HEADERS,
      body: JSON.stringify({ error: "Generation failed. Credits refunded." }),
    };
  }
};
