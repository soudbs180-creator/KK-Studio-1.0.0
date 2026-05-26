// netlify/functions/user.ts
// 职责：处理获取当前登录用户信息与更新资料/密码的业务。
// 1. GET /api/user/me (JWT 鉴权) -> 返回当前用户的邮箱和积分余额。
// 2. PATCH /api/user/me (JWT 鉴权) -> 仅允许更新密码或无害配置，严禁在此接口直接修改或接收积分，防篡改。
// 所有注释均使用中文，错误信息统一脱敏为英文返回前端。

import type { Handler } from "@netlify/functions";
import { z } from "zod";
import crypto from "crypto";
import { query } from "../lib/db";
import { verifyJWT } from "../lib/jwt";

// 加盐哈希密钥，需与 auth.ts 保持一致
const PASSWORD_SALT = process.env.PASSWORD_SALT || "nano-banana-default-salt-key-8899";

function hashPassword(password: string): string {
  return crypto.createHmac("sha256", PASSWORD_SALT).update(password).digest("hex");
}

const UpdateUserSchema = z.object({
  password: z.string().min(8).optional(), // 可选：更新密码 (长度至少 8 位)
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

  const path = event.path || "";

  // GET /me 路由
  if (event.httpMethod === "GET" && path.endsWith("/me")) {
    const userId = verifyJWT(event.headers.authorization);
    if (!userId) {
      return {
        statusCode: 401,
        headers: COMMON_HEADERS,
        body: JSON.stringify({ error: "Unauthorized." }),
      };
    }

    try {
      const userRes = await query("SELECT id, email, credits, created_at FROM public.users WHERE id = $1", [userId]);
      if (userRes.rows.length === 0) {
        return {
          statusCode: 404,
          headers: COMMON_HEADERS,
          body: JSON.stringify({ error: "User not found." }),
        };
      }

      const user = userRes.rows[0];
      return {
        statusCode: 200,
        headers: COMMON_HEADERS,
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          credits: parseInt(user.credits),
          createdAt: user.created_at,
        }),
      };
    } catch (err: any) {
      console.error("[Get Me Failed]", err);
      return {
        statusCode: 500,
        headers: COMMON_HEADERS,
        body: JSON.stringify({ error: "Failed to retrieve user info." }),
      };
    }
  }

  // PATCH /me 路由
  if (event.httpMethod === "PATCH" && path.endsWith("/me")) {
    const userId = verifyJWT(event.headers.authorization);
    if (!userId) {
      return {
        statusCode: 401,
        headers: COMMON_HEADERS,
        body: JSON.stringify({ error: "Unauthorized." }),
      };
    }

    try {
      const payload = JSON.parse(event.body || "{}");
      // 拦截任何企图直接通过此接口篡改积分的行为
      if ("credits" in payload || "balance" in payload) {
        return {
          statusCode: 403,
          headers: COMMON_HEADERS,
          body: JSON.stringify({ error: "Direct credit modification is forbidden." }),
        };
      }

      const parsed = UpdateUserSchema.safeParse(payload);
      if (!parsed.success) {
        return {
          statusCode: 400,
          headers: COMMON_HEADERS,
          body: JSON.stringify({ error: "Password must be at least 8 characters." }),
        };
      }

      const { password } = parsed.data;

      if (password) {
        const passwordHash = hashPassword(password);
        await query("UPDATE public.users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [passwordHash, userId]);
      }

      // 查询更新后的最新状态并返回
      const userRes = await query("SELECT id, email, credits FROM public.users WHERE id = $1", [userId]);
      const user = userRes.rows[0];

      return {
        statusCode: 200,
        headers: COMMON_HEADERS,
        body: JSON.stringify({
          message: "Profile updated successfully.",
          user: {
            id: user.id,
            email: user.email,
            credits: parseInt(user.credits),
          },
        }),
      };
    } catch (err: any) {
      console.error("[Patch Me Failed]", err);
      return {
        statusCode: 500,
        headers: COMMON_HEADERS,
        body: JSON.stringify({ error: "Failed to update user profile." }),
      };
    }
  }

  return {
    statusCode: 404,
    headers: COMMON_HEADERS,
    body: JSON.stringify({ error: "User endpoint not found." }),
  };
};
