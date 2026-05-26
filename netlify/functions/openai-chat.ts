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

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: COMMON_HEADERS,
      body: JSON.stringify({ error: "Method not allowed." }),
    };
  }

  // 2. JWT 鉴权
  const userId = verifyJWT(event.headers.authorization);
  if (!userId) {
    return {
      statusCode: 401,
      headers: COMMON_HEADERS,
      body: JSON.stringify({ error: "Unauthorized." }),
    };
  }

  // 3. 校验参数
  try {
    const payload = JSON.parse(event.body || "{}");
    const parsed = ChatRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        statusCode: 400,
        headers: COMMON_HEADERS,
        body: JSON.stringify({ error: "Invalid chat messages payload." }),
      };
    }
    const { messages } = parsed.data;

    const requiredCredits = 2; // 对话统一扣减 2 积分

    // 4. 校验用户积分余额
    const userRes = await query("SELECT credits FROM public.users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) {
      return {
        statusCode: 401,
        headers: COMMON_HEADERS,
        body: JSON.stringify({ error: "User not found." }),
      };
    }

    const currentCredits = parseInt(userRes.rows[0].credits);
    if (currentCredits < requiredCredits) {
      return {
        statusCode: 402,
        headers: COMMON_HEADERS,
        body: JSON.stringify({ error: "Insufficient credits. Please recharge." }),
      };
    }

    // 5. 调用 OpenAI API
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

    // 6. 扣减积分
    const nextCredits = currentCredits - requiredCredits;
    await query("UPDATE public.users SET credits = $1, updated_at = NOW() WHERE id = $2", [nextCredits, userId]);

    // 7. 返回回复消息与最新余额
    return {
      statusCode: 200,
      headers: COMMON_HEADERS,
      body: JSON.stringify({
        message: replyMessage,
        credits: nextCredits,
      }),
    };
  } catch (err: any) {
    console.error("[OpenAI Chat Error]", err);
    // 处理 429 速率限制
    if (err?.status === 429) {
      return {
        statusCode: 429,
        headers: COMMON_HEADERS,
        body: JSON.stringify({ error: "Rate limit reached. Please try again later." }),
      };
    }
    return {
      statusCode: 500,
      headers: COMMON_HEADERS,
      body: JSON.stringify({ error: "Chat request failed. Server error." }),
    };
  }
};
