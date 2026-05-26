// netlify/functions/auth.ts
// 职责：处理用户的注册、登录以及 JWT token 刷新业务逻辑。
// 使用 Node.js 原生的 crypto 模块进行密码哈希，通过 zod 校验入参，并结合数据库进行数据持久化。
// 遵循中文注释规范，响应头使用通用配置，且报错全部脱敏为英文。

import type { Handler } from "@netlify/functions";
import { z } from "zod";
import crypto from "crypto";
import { query } from "../lib/db";
import { signJWT, verifyJWT } from "../lib/jwt";

// 加盐哈希密钥，生产环境也可使用独立配置，此处用于防明文泄漏
const PASSWORD_SALT = process.env.PASSWORD_SALT || "nano-banana-default-salt-key-8899";

/**
 * 使用 HMAC-SHA256 对密码进行不可逆的加盐哈希
 */
function hashPassword(password: string): string {
  return crypto.createHmac("sha256", PASSWORD_SALT).update(password).digest("hex");
}

// 登录与注册入参校验 schema
const UserAuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8), // 规范要求密码长度至少 8 位
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

  const path = event.path || "";

  // 注册逻辑：创建新用户并赠送 100 积分
  if (path.endsWith("/register")) {
    try {
      const payload = JSON.parse(event.body || "{}");
      const result = UserAuthSchema.safeParse(payload);
      if (!result.success) {
        return {
          statusCode: 400,
          headers: COMMON_HEADERS,
          body: JSON.stringify({ error: "Invalid email format or password must be at least 8 characters." }),
        };
      }
      const { email, password } = result.data;

      // 检查邮箱是否已被注册
      const checkUser = await query("SELECT id FROM public.users WHERE email = $1", [email]);
      if (checkUser.rows.length > 0) {
        return {
          statusCode: 400,
          headers: COMMON_HEADERS,
          body: JSON.stringify({ error: "Email has already been registered." }),
        };
      }

      const userId = crypto.randomUUID();
      const passwordHash = hashPassword(password);

      // 插入新用户并赠送 100 默认积分
      await query(
        "INSERT INTO public.users (id, email, password_hash, credits) VALUES ($1, $2, $3, $4)",
        [userId, email, passwordHash, 100]
      );

      // 签发新 JWT
      const token = signJWT({ userId });

      return {
        statusCode: 200,
        headers: COMMON_HEADERS,
        body: JSON.stringify({
          message: "Register success.",
          token,
          user: { id: userId, email, credits: 100 },
        }),
      };
    } catch (err: any) {
      console.error("[Auth Register Failed]", err);
      return {
        statusCode: 500,
        headers: COMMON_HEADERS,
        body: JSON.stringify({ error: "Registration failed due to server error." }),
      };
    }
  }

  // 登录逻辑：验证密码哈希并颁发 JWT
  if (path.endsWith("/login")) {
    try {
      const payload = JSON.parse(event.body || "{}");
      const result = UserAuthSchema.safeParse(payload);
      if (!result.success) {
        return {
          statusCode: 400,
          headers: COMMON_HEADERS,
          body: JSON.stringify({ error: "Incorrect email or password." }),
        };
      }
      const { email, password } = result.data;

      // 查找用户
      const userRes = await query(
        "SELECT id, password_hash, credits FROM public.users WHERE email = $1",
        [email]
      );
      if (userRes.rows.length === 0) {
        return {
          statusCode: 400,
          headers: COMMON_HEADERS,
          body: JSON.stringify({ error: "Incorrect email or password." }),
        };
      }

      const user = userRes.rows[0];
      const passwordHash = hashPassword(password);

      if (user.password_hash !== passwordHash) {
        return {
          statusCode: 400,
          headers: COMMON_HEADERS,
          body: JSON.stringify({ error: "Incorrect email or password." }),
        };
      }

      // 登录成功，签发 JWT
      const token = signJWT({ userId: user.id });

      return {
        statusCode: 200,
        headers: COMMON_HEADERS,
        body: JSON.stringify({
          message: "Login success.",
          token,
          user: { id: user.id, email, credits: parseInt(user.credits) },
        }),
      };
    } catch (err: any) {
      console.error("[Auth Login Failed]", err);
      return {
        statusCode: 500,
        headers: COMMON_HEADERS,
        body: JSON.stringify({ error: "Login failed due to server error." }),
      };
    }
  }

  // 刷新逻辑：使用当前有效 Token 签发新 Token
  if (path.endsWith("/refresh")) {
    try {
      const userId = verifyJWT(event.headers.authorization);
      if (!userId) {
        return {
          statusCode: 401,
          headers: COMMON_HEADERS,
          body: JSON.stringify({ error: "Unauthorized." }),
        };
      }

      // 查找用户是否仍合法有效
      const userRes = await query("SELECT email, credits FROM public.users WHERE id = $1", [userId]);
      if (userRes.rows.length === 0) {
        return {
          statusCode: 401,
          headers: COMMON_HEADERS,
          body: JSON.stringify({ error: "User no longer exists." }),
        };
      }

      const user = userRes.rows[0];
      const newToken = signJWT({ userId });

      return {
        statusCode: 200,
        headers: COMMON_HEADERS,
        body: JSON.stringify({
          token: newToken,
          user: { id: userId, email: user.email, credits: parseInt(user.credits) },
        }),
      };
    } catch (err: any) {
      console.error("[Auth Refresh Failed]", err);
      return {
        statusCode: 500,
        headers: COMMON_HEADERS,
        body: JSON.stringify({ error: "Token refresh failed." }),
      };
    }
  }

  return {
    statusCode: 404,
    headers: COMMON_HEADERS,
    body: JSON.stringify({ error: "Endpoint not found." }),
  };
};
