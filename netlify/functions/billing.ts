// netlify/functions/billing.ts
// 职责：处理获取定价方案与创建支付 Checkout 会话的业务。
// 1. GET /api/billing/plans (无需鉴权) -> 直接返回服务端可信的套餐方案列表。
// 2. POST /api/billing/create-checkout (JWT 鉴权) -> 前端仅传入 planId，后端通过 SERVER_PLANS 获取该方案的金额和积分，并在数据库创建 pending 订单，随后调用 Stripe 创建 Checkout 会话以防额度被前端篡改。
// 所有注释使用中文，错误和异常输出为脱敏的英文。

import type { Handler } from "@netlify/functions";
import Stripe from "stripe";
import { z } from "zod";
import crypto from "crypto";
import { query } from "../lib/db";
import { verifyJWT } from "../lib/jwt";
import { SERVER_PLANS } from "../lib/billing-plans";

// 初始化 Stripe 客户端，密钥从环境变量读取
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2022-11-15" as any, // 确保与依赖库类型契合
});

// 默认的前端成功/取消回调地址
const CLIENT_URL = process.env.VITE_PUBLIC_API_BASE_URL 
  ? process.env.VITE_PUBLIC_API_BASE_URL.replace(/\/api$/, "") 
  : "http://localhost:5173";

const CreateCheckoutSchema = z.object({
  planId: z.string().min(1),
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

  // GET /plans 路由
  if (event.httpMethod === "GET" && path.endsWith("/plans")) {
    const plansArray = Object.values(SERVER_PLANS).map((p) => ({
      id: p.id,
      name: p.name,
      amount: (p.amountCents / 100).toFixed(2), // 转换为浮点形式方便前端渲染
      credits: p.credits,
    }));

    return {
      statusCode: 200,
      headers: COMMON_HEADERS,
      body: JSON.stringify({ plans: plansArray }),
    };
  }

  // POST /create-checkout 路由
  if (event.httpMethod === "POST" && path.endsWith("/create-checkout")) {
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
      const parsed = CreateCheckoutSchema.safeParse(payload);
      if (!parsed.success) {
        return {
          statusCode: 400,
          headers: COMMON_HEADERS,
          body: JSON.stringify({ error: "Invalid plan ID." }),
        };
      }
      const { planId } = parsed.data;

      // 从服务端可信列表中读取方案细节，防前端直接篡改金额或积分
      const plan = SERVER_PLANS[planId];
      if (!plan) {
        return {
          statusCode: 400,
          headers: COMMON_HEADERS,
          body: JSON.stringify({ error: "Billing plan not found." }),
        };
      }

      // 在数据库中插入一条 pending 状态订单
      const orderId = crypto.randomUUID();
      
      // 调用 Stripe 创建会话
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: plan.name,
                description: `充值 ${plan.credits} 积分`,
              },
              unit_amount: plan.amountCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${CLIENT_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${CLIENT_URL}/billing?cancel=true`,
        client_reference_id: userId,
        metadata: {
          orderId,
          planId: plan.id,
          credits: plan.credits.toString(), // 写入元数据方便 Webhook 双向校验
        },
      });

      const stripeSessionId = session.id;

      // 持久化 pending 订单
      await query(
        "INSERT INTO public.orders (id, user_id, stripe_session_id, plan_id, amount_cents, credits, status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [orderId, userId, stripeSessionId, plan.id, plan.amountCents, plan.credits, "pending"]
      );

      return {
        statusCode: 200,
        headers: COMMON_HEADERS,
        body: JSON.stringify({
          url: session.url,
          stripeSessionId,
        }),
      };
    } catch (err: any) {
      console.error("[Stripe Session Create Error]", err);
      return {
        statusCode: 500,
        headers: COMMON_HEADERS,
        body: JSON.stringify({ error: "Failed to create payment session. Server error." }),
      };
    }
  }

  return {
    statusCode: 404,
    headers: COMMON_HEADERS,
    body: JSON.stringify({ error: "Billing endpoint not found." }),
  };
};
