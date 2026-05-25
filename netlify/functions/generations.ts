// netlify/functions/generations.ts
// 职责：处理获取用户多模态历史图像生成/编辑记录的业务。
// 1. 进行 JWT 鉴权以获取用户 ID。
// 2. 从数据库 generations 历史记录表中查询属于当前用户的所有记录。
// 3. 将结果按时间倒序排列并返回给前端。
// 所有注释均使用中文，错误描述采用脱敏的英文。

import type { Handler, HandlerEvent } from "@netlify/functions";
import { query } from "../lib/db";
import { verifyJWT } from "../lib/jwt";
import { makeResponse, makeErrorResponse, COMMON_HEADERS } from "../lib/response";

/**
 * 查询当前用户的图像生成/编辑历史记录
 */
async function handleGetGenerations(event: HandlerEvent) {
  const userId = verifyJWT(event.headers.authorization);
  if (!userId) {
    return makeErrorResponse(401, "Unauthorized.");
  }

  try {
    const historyRes = await query(
      "SELECT id, prompt, image_url as image, model, type, created_at as createdAt FROM public.generations WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );

    return makeResponse(200, {
      generations: historyRes.rows.map((row) => ({
        id: row.id,
        prompt: row.prompt,
        image: row.image,
        model: row.model,
        type: row.type,
        createdAt: row.createdat,
      })),
    });
  } catch (err: any) {
    console.error("[Get Generations Failed]", err);
    return makeErrorResponse(500, "Failed to retrieve generation history.");
  }
}

/**
 * Netlify Function 入口 handler
 */
export const handler: Handler = async (event) => {
  // 拦截 OPTIONS 预检请求以支持跨域
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: COMMON_HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return makeErrorResponse(405, "Method not allowed.");
  }

  return await handleGetGenerations(event);
};
