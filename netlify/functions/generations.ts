// netlify/functions/generations.ts
// 职责：处理获取用户多模态历史图像生成/编辑记录的业务。
// 1. 进行 JWT 鉴权以获取用户 ID。
// 2. 从数据库 generations 历史记录表中查询属于当前用户的所有记录。
// 3. 将结果按时间倒序排列并返回给前端。
// 所有注释均使用中文，错误描述采用脱敏的英文。

import type { Handler } from "@netlify/functions";
import { query } from "../lib/db";
import { verifyJWT } from "../lib/jwt";

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

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: COMMON_HEADERS,
      body: JSON.stringify({ error: "Method not allowed." }),
    };
  }

  const userId = verifyJWT(event.headers.authorization);
  if (!userId) {
    return {
      statusCode: 401,
      headers: COMMON_HEADERS,
      body: JSON.stringify({ error: "Unauthorized." }),
    };
  }

  try {
    const historyRes = await query(
      "SELECT id, prompt, image_url as image, model, type, created_at as createdAt FROM public.generations WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );

    return {
      statusCode: 200,
      headers: COMMON_HEADERS,
      body: JSON.stringify({
        generations: historyRes.rows.map((row) => ({
          id: row.id,
          prompt: row.prompt,
          image: row.image,
          model: row.model,
          type: row.type,
          createdAt: row.createdat,
        })),
      }),
    };
  } catch (err: any) {
    console.error("[Get Generations Failed]", err);
    return {
      statusCode: 500,
      headers: COMMON_HEADERS,
      body: JSON.stringify({ error: "Failed to retrieve generation history." }),
    };
  }
};
