// netlify/functions/user.ts
// 职责：处理获取当前登录用户信息与更新资料/密码的业务。
// 1. GET /api/user/me (JWT 鉴权) -> 返回当前用户的邮箱和积分余额。
// 2. PATCH /api/user/me (JWT 鉴权) -> 仅允许更新密码或无害配置，严禁在此接口直接修改或接收积分，防篡改。
// 所有注释均使用中文，错误信息统一脱敏为英文返回前端。

import type { Handler, HandlerEvent } from "@netlify/functions";
import { z } from "zod";
import crypto from "crypto";
import { query } from "../lib/db";
import { verifyJWT } from "../lib/jwt";
import { makeResponse, makeErrorResponse, COMMON_HEADERS } from "../lib/response";

// 加盐哈希密钥，需与 auth.ts 保持一致
const PASSWORD_SALT = process.env.PASSWORD_SALT || "nano-banana-default-salt-key-8899";

function hashPassword(password: string): string {
  return crypto.createHmac("sha256", PASSWORD_SALT).update(password).digest("hex");
}

const UpdateUserSchema = z.object({
  password: z.string().min(8).optional(), // 可选：更新密码 (长度至少 8 位)
});

/**
 * 获取当前登录用户的详细信息 (包含安全脱敏和积分返回)
 */
async function handleGetMe(event: HandlerEvent) {
  const userId = verifyJWT(event.headers.authorization);
  if (!userId) {
    return makeErrorResponse(401, "Unauthorized.");
  }

  try {
    const userRes = await query("SELECT id, email, credits, created_at FROM public.users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) {
      return makeErrorResponse(404, "User not found.");
    }

    const user = userRes.rows[0];
    return makeResponse(200, {
      id: user.id,
      email: user.email,
      credits: parseInt(user.credits),
      createdAt: user.created_at,
    });
  } catch (err: any) {
    console.error("[Get Me Failed]", err);
    return makeErrorResponse(500, "Failed to retrieve user info.");
  }
}

/**
 * 更新用户密码 (防范积分篡改，严禁传递 credits 字段修改)
 */
async function handlePatchMe(event: HandlerEvent) {
  const userId = verifyJWT(event.headers.authorization);
  if (!userId) {
    return makeErrorResponse(401, "Unauthorized.");
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    // 拦截任何企图直接通过此接口篡改积分的行为
    if ("credits" in payload || "balance" in payload) {
      return makeErrorResponse(403, "Direct credit modification is forbidden.");
    }

    const parsed = UpdateUserSchema.safeParse(payload);
    if (!parsed.success) {
      return makeErrorResponse(400, "Password must be at least 8 characters.");
    }

    const { password } = parsed.data;

    if (password) {
      const passwordHash = hashPassword(password);
      await query("UPDATE public.users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [passwordHash, userId]);
    }

    // 查询更新后的最新状态并返回
    const userRes = await query("SELECT id, email, credits FROM public.users WHERE id = $1", [userId]);
    const user = userRes.rows[0];

    return makeResponse(200, {
      message: "Profile updated successfully.",
      user: {
        id: user.id,
        email: user.email,
        credits: parseInt(user.credits),
      },
    });
  } catch (err: any) {
    console.error("[Patch Me Failed]", err);
    return makeErrorResponse(500, "Failed to update user profile.");
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

  const path = event.path || "";

  if (event.httpMethod === "GET" && path.endsWith("/me")) {
    return await handleGetMe(event);
  }

  if (event.httpMethod === "PATCH" && path.endsWith("/me")) {
    return await handlePatchMe(event);
  }

  return makeErrorResponse(404, "User endpoint not found.");
};
