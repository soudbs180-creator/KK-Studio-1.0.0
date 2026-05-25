// netlify/functions/openai-chat.ts
// 职责：处理 OpenAI 对话请求。
// 1. 进行 JWT 鉴权获取用户 ID。
// 2. 从数据库中检查用户积分，每次对话需扣减 2 积分。
// 3. 调用官方 openai SDK，从环境变量中读取模型（默认为 gpt-4o-mini）进行文本对话。
// 4. 对话成功后扣减积分并记录日志。
// 5. 返回对话回复内容和扣减后的用户余额。

import type { Handler } from "@netlify/functions";
import OpenAI from "openai";
import { z } from "zod";
import { query } from "../lib/db";
import { verifyJWT } from "../lib/jwt";
import { makeResponse, makeErrorResponse, COMMON_HEADERS } from "../lib/response";

// 初始化 OpenAI 客户端
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

// 对话消息格式的校验 schema
const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1),
});

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema),
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
    const parsed = ChatRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return makeErrorResponse(400, "Invalid chat messages payload.");
    }
    const { messages } = parsed.data;

    const requiredCredits = 2; // 对话统一扣减 2 积分

    // 3. 校验用户积分余额
    const userRes = await query("SELECT credits FROM public.users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) {
      return makeErrorResponse(401, "User not found.");
    }

    const currentCredits = parseInt(userRes.rows[0].credits);
    if (currentCredits < requiredCredits) {
      return makeErrorResponse(402, "Insufficient credits. Please recharge.");
    }

    // 4. 调用 OpenAI API
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const completion = await openai.chat.completions.create(
      {
        model,
        messages,
        max_tokens: 1000,
      },
      {
        headers: { "X-Client-Request-Id": crypto.randomUUID() },
      }
    );

    const replyMessage = completion.choices[0].message;
    if (!replyMessage || !replyMessage.content) {
      throw new Error("OpenAI API failed to return content.");
    }

    // 5. 扣减积分
    const nextCredits = currentCredits - requiredCredits;
    await query("UPDATE public.users SET credits = $1, updated_at = NOW() WHERE id = $2", [nextCredits, userId]);

    // 6. 返回回复消息与最新余额
    return makeResponse(200, {
      message: replyMessage,
      credits: nextCredits,
    });
  } catch (err: any) {
    console.error("[OpenAI Chat Error]", err);
    // 处理 429 速率限制
    if (err?.status === 429) {
      return makeErrorResponse(429, "Rate limit reached. Please try again later.");
    }
    return makeErrorResponse(500, "Chat request failed. Server error.");
  }
};
