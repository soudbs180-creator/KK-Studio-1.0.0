// netlify/functions/generate-image.ts
// 职责：处理图像生成和图像编辑请求。
// 1. 进行 JWT 鉴权以获取用户 ID。
// 2. 从数据库中检查用户积分，不足则拦截（普通生成需 10 积分，编辑需 15 积分）。
// 3. 调用可信后端 @google/genai 客户端，模型选用 gemini-2.5-flash-image。
// 4. 将生成的图像 base64 存入数据库历史记录表 public.generations。
// 5. 扣减用户积分，并将图片及最新余额返回给前端。

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

  // 2. 校验参数
  try {
    const payload = JSON.parse(event.body || "{}");
    const parsed = GenerateRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return makeErrorResponse(400, "Invalid generation options or prompt too long.");
    }
    const { prompt, referenceImageBase64, aspectRatio } = parsed.data;

    const isEditMode = !!referenceImageBase64;
    const requiredCredits = isEditMode ? 15 : 10; // 普通生成扣 10 积分，编辑扣 15 积分

    // 3. 校验用户余额
    const userRes = await query("SELECT credits FROM public.users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) {
      return makeErrorResponse(401, "User not found.");
    }

    const currentCredits = parseInt(userRes.rows[0].credits);
    if (currentCredits < requiredCredits) {
      return makeErrorResponse(402, "Insufficient credits. Please recharge.");
    }

    // 4. 组装多模态输入内容
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

    // 5. 调用 Gemini API
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image", // nano-banana 模型
      contents,
      config: {
        // 声明期望返回的媒体类型为 IMAGE 和 TEXT
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

    // 6. 扣减用户积分
    const nextCredits = currentCredits - requiredCredits;
    await query("UPDATE public.users SET credits = $1, updated_at = NOW() WHERE id = $2", [nextCredits, userId]);

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
      credits: nextCredits,
    });
  } catch (err: any) {
    console.error("[Gemini Image Generation Error]", err);
    return makeErrorResponse(500, "Image generation or edit failed. Please check parameters and try again.");
  }
};
