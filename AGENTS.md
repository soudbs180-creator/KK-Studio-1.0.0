# KK-Studio 项目开发规范与架构黄金法则 (AGENTS.md - AI Agent 项目总指导文件)

本规范文档（[AGENTS.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/AGENTS.md)）为 KK-Studio 项目的核心架构与开发准则。任何新功能的开发、重构、维护，以及 AI 辅助编程，均必须严格遵循本规范。

---

// ✅ 正确：中文注释，说明"为什么"
// Gemini 要求 base64 字符串不能带 data URI 前缀，否则报 400 错误
const cleanBase64 = raw.replace(/^data:image\/\w+;base64,/, "");

// ✅ 正确：复杂函数头部说明处理顺序
// 处理顺序：① 验证 JWT → ② 校验入参 → ③ 检查积分 → ④ 先扣积分 → ⑤ 调 Gemini → ⑥ 失败退款
// 顺序不能乱：鉴权失败时不应浪费 Gemini 配额
async function handleGenerateImage(req, res) { ... }

// ❌ 错误：英文注释
// Remove data URI prefix before sending to Gemini

// ❌ 错误：无注释的复杂逻辑
const parts = response.candidates?.[0]?.content?.parts ?? [];
feat(server): 新增图像编辑接口，支持参考图多模态输入
fix(auth): 修复 JWT 过期后未返回 401 响应的问题
refactor(api-client): 统一桌面端与手机端的 baseURL 解析逻辑
chore(deps): 升级 @google/genai 至 1.50.0，修复图像生成空响应
test(credits): 补充 Gemini 安全过滤触发时积分退款的单元测试
docs(agents): 更新 R5 路由表，补充 /api/generate/edit 端点说明
nano-banana-KK/
│
├── apps/
│   ├── web/                        ← 桌面端（Vite + React + TypeScript）
│   │   ├── src/
│   │   │   ├── app/                ← 应用入口 / 全局 Provider
│   │   │   ├── assets/             ← 图片、字体等静态资源
│   │   │   ├── canvas/             ← 画布相关逻辑（Three.js / Canvas API）
│   │   │   ├── components/         ← 桌面端专用组件（禁止 RN 导入）
│   │   │   ├── config/             ← 前端配置常量（无密钥）
│   │   │   ├── context/            ← React Context（全局状态）
│   │   │   ├── hooks/              ← 桌面端专用 hooks
│   │   │   ├── icons/              ← 自定义图标
│   │   │   ├── lib/                ← 工具库封装（日期、格式化等）
│   │   │   ├── pages/              ← 页面组件（对应路由）
│   │   │   │   ├── admin/              ← 管理员后台页面（admin_level > 0 才可访问）
│   │   │   │   │   ├── AdminLayout.tsx ← 管理员后台公共布局（Tab 导航）
│   │   │   │   │   ├── RechargePanel.tsx   ← 充值管理（Level 1 & 2）
│   │   │   │   │   ├── CreditsPanel.tsx    ← 积分管理（Level 1 & 2）
│   │   │   │   │   ├── ApiConfigPanel.tsx  ← API 设置/定价（Level 1 & 2）
│   │   │   │   │   └── StaffPanel.tsx      ← 人员管理（仅 Level 1）
│   │   │   ├── routes/             ← React Router v7 路由配置
│   │   │   ├── services/           ← API 调用层（封装 packages/api-client）
│   │   │   ├── types/              ← 桌面端专用类型定义
│   │   │   ├── utils/              ← 桌面端工具函数
│   │   │   ├── workers/            ← Web Workers（重计算任务）
│   │   │   ├── workflow/           ← 业务流程状态机
│   │   │   ├── App.tsx             ← 根组件
│   │   │   └── bootstrap.tsx       ← 应用启动入口
│   │   ├── public/                 ← 静态文件（不走 Vite 处理）
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   │
│   └── mobile/                     ← 手机端（Expo Managed Workflow）
│       └── src/
│           ├── app/                ← expo-router 路由页面（禁止 DOM API）
│           ├── components/         ← 手机端专用组件
│           └── hooks/              ← 手机端专用 hooks
│
├── packages/
│   ├── shared/                     ← 两端共用（纯 TypeScript，零平台依赖）
│   │   ├── types/                  ← API 请求/响应类型、数据模型
│   │   └── utils/                  ← 纯函数工具（无 window/document/RN）
│   ├── api-client/                 ← 统一 HTTP 调用层（两端共用）
│   │   └── src/
│   │       ├── client.ts           ← baseURL 智能解析 + fetch 封装 + JWT 注入
│   │       ├── api.ts              ← 各 API endpoint 函数（一函数一端点）
│   │       └── hooks.ts            ← React Query hooks
│   └── ui/                         ← 共享基础 UI（必须能在两端无副作用运行）
│
├── server/                         ← ⭐ VPS 后端主服务（Express.js，所有 API 路由）
│   ├── index.js                    ← 服务入口，挂载所有路由，启动 Express
│   ├── routes/                     ← 路由模块（每个业务一个文件）
│   │   ├── auth.js                 ← 注册 / 登录 / JWT 刷新
│   │   ├── generate-image.js       ← Gemini 图像生成 / 编辑
│   │   ├── chat.js                 ← OpenAI 对话
│   │   ├── user.js                 ← 用户信息 CRUD
│   │   ├── billing.js              ← Stripe 结账会话 / 套餐列表
│   │   ├── generations.js          ← 生成历史查询
│   │   ├── webhook.js              ← Stripe Webhook 积分充值
│   │   └── admin.js              ← 管理员后台 API（充值/积分/API配置/人员管理）
│   ├── lib/                        ← 后端内部工具
│   │   ├── db.js                   ← PostgreSQL Pool 单例
│   │   ├── jwt.js                  ← signJWT / verifyJWT
│   │   ├── cors.js                 ← CORS Origin 白名单工厂
│   │   └── credits.js              ← 含 getOperationCost()，从数据库动态读取定价
│   ├── middleware/                 ← Express 中间件
│   │   ├── auth.js                 ← 普通 JWT 鉴权（req.userId + req.adminLevel）
│   │   ├── adminAuth.js          ← 管理员鉴权中间件（需要 admin_level >= 指定等级）
│   │   ├── rateLimit.js            ← 速率限制（每 IP / 每用户）
│   │   └── validate.js             ← zod 请求体校验中间件工厂
│   ├── .env.example                ← VPS 环境变量模板
│   └── package.json                ← VPS 独立依赖（CommonJS / ESM 按需选择）
│
├── migrations/                     ← PostgreSQL schema 迁移（唯一可改 schema 的地方）
│   ├── 001_create_users.sql
│   ├── 002_create_generations.sql
│   ├── 003_add_admin_level.sql       ← 新增：用户管理员等级字段
│   ├── 004_create_api_cost_config.sql ← 新增：AI 操作定价配置表
│   └── ...（按序号递增）
│
├── scripts/                        ← 构建 / 发布 / 维护脚本
├── docs/                           ← 所有文档（中文，不得放根目录）
├── config/                         ← 全局配置（无密钥）
├── tests/                          ← 测试（unit / integration / contract / e2e）
├── tools/                          ← 本地开发者工具箱（不进生产）
├── temp/                           ← 临时文件（gitignore，仅 README.md 保留）
├── release/publish/stable/         ← 发布清单（仅 manifest.json 进 git）
├── .claude/                        ← Claude Code Agent 配置
├── .github/workflows/              ← CI/CD（GitHub Actions）
├── AGENTS.md                       ← 本文件（根目录唯一 .md）
├── .env.example                    ← 根环境变量模板（无真实值）
├── .gitignore
├── vercel.json                     ← Vercel 部署配置（替代已废弃的 netlify.toml）
└── package.json                    ← 根 workspace（Node 24.x，npm@11.12.1）
❌ netlify/                  → 全部删除
❌ netlify.toml              → 删除，替换为 vercel.json
❌ payment-server/           → 路由迁移到 server/routes/，迁移完成后删除此目录
┌──────────────────────────────────────────────────────────────┐
│                          用户终端                             │
│  ┌───────────────────────┐    ┌──────────────────────────┐  │
│  │    桌面端 Web App      │    │   手机端 Expo App         │  │
│  │    apps/web/           │    │   apps/mobile/            │  │
│  │    Vite 8 + React 19   │    │   Expo Router + RN        │  │
│  │    TypeScript          │    │   iOS 16+ / Android 11+   │  │
│  └──────────┬─────────────┘    └────────────┬──────────────┘  │
└─────────────┼──────────────────────────────┼──────────────────┘
              │      packages/api-client      │
              │  （统一 HTTP 调用层，两端共用）│
              └──────────────┬────────────────┘
                             │ HTTPS → VPS_BASE_URL/api/*
                             ▼
              ┌──────────────────────────────┐
              │      Vercel（前端托管）       │
              │  静态资源 CDN + SPA 路由      │
              │  build: apps/web/dist         │
              │  vercel.json 配置 SPA 回退   │
              └──────────────────────────────┘

              ┌──────────────────────────────────────────────┐
              │            VPS 服务器（后端核心）             │
              │           server/  （Express.js）            │
              │                                              │
              │  POST /api/auth/register   ← 注册            │
              │  POST /api/auth/login      ← 登录            │
              │  POST /api/auth/refresh    ← 刷新 JWT        │
              │  POST /api/generate/image  ← Gemini 图像生成 │
              │  POST /api/generate/edit   ← Gemini 图像编辑 │
              │  POST /api/chat            ← OpenAI 对话     │
              │  GET  /api/user/me         ← 用户信息        │
              │  PATCH /api/user/me        ← 更新用户        │
              │  GET  /api/billing/plans   ← 定价方案        │
              │  POST /api/billing/checkout← Stripe 结账     │
              │  GET  /api/generations     ← 生成历史        │
              │  POST /webhook/stripe      ← Stripe 回调     │
              │                                              │
              └────┬──────────────┬──────────────┬───────────┘
                   │              │              │
                   ▼              ▼              ▼
          ┌──────────────┐ ┌──────────────┐ ┌────────────────┐
          │  Gemini API  │ │  OpenAI API  │ │  PostgreSQL DB │
          │ gemini-2.5-  │ │  gpt-4o-mini │ │（migrations/） │
          │ flash-image  │ │  （可配置）  │ │  public.users  │
          └──────────────┘ └──────────────┘ │  public.genera-│
                                             │  tions         │
                                             └────────────────┘
本地开发时：

浏览器 → http://localhost:5173  (Vite dev server，apps/web)
              │
              │ fetch /api/*
              ▼
VPS 本地实例 → http://localhost:8080  (server/index.js，npm run dev)
              │
              ├─→ Gemini API (cloud)
              ├─→ OpenAI API (cloud)
              └─→ PostgreSQL (本地 or 远端测试库)

VITE_PUBLIC_API_BASE_URL=http://localhost:8080/api  (本地 .env)
VITE_PUBLIC_API_BASE_URL=https://api.kkai.plus/api  (Vercel 生产)
// server/routes/generate-image.js
// 职责：Gemini 图像生成/编辑中转接口，实现先扣后退积分机制

const { GoogleGenAI, Modality } = require("@google/genai");

// ✅ API Key 只从后端环境变量读取，启动时检查
if (!process.env.GEMINI_API_KEY) {
  throw new Error("[严重] GEMINI_API_KEY 未配置，服务拒绝启动");
}
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ✅ 正确的 generateContent 调用
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-image",   // 固定模型名，不得用变量替换
  contents: [
    { text: prompt },
    // 图像编辑模式追加（参考图必须去除 data URI 前缀）：
    // { inlineData: { mimeType: "image/png", data: cleanBase64 } }
  ],
  config: {
    // ✅ 必须用 Modality 枚举，不能用字符串 "IMAGE"
    responseModalities: [Modality.IMAGE, Modality.TEXT],
    // ✅ aspectRatio 正确位置：config.imageConfig.aspectRatio
    // ❌ 错误位置：config.aspectRatio（会被静默忽略）
    imageConfig: {
      aspectRatio: aspectRatio, // "1:1" | "16:9" | "9:16"
    },
  },
});
// 提取响应中的图像 part
const parts = response.candidates?.[0]?.content?.parts ?? [];
const imagePart = parts.find((p) => p.inlineData);

// ✅ 必须检查 imagePart，Gemini 安全过滤触发时不返回图像
if (!imagePart?.inlineData) {
  // 这不是代码 bug，是 Gemini 的安全过滤，需要退还积分
  throw new Error("Gemini 未返回图像数据，可能触发了内容安全过滤");
}

// ✅ 图像编辑模式：传入参考图前必须去除 data URI 前缀
const cleanBase64 = referenceImageBase64.replace(/^data:image\/\w+;base64,/, "");

// ✅ 拼装标准 data URI 返回给前端
const imageDataUri = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
// server/routes/chat.js
const OpenAI = require("openai");
const { randomUUID } = require("crypto"); // ✅ 必须显式 require，不依赖全局

if (!process.env.OPENAI_API_KEY) {
  throw new Error("[严重] OPENAI_API_KEY 未配置，服务拒绝启动");
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ✅ 模型从环境变量读取
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

// ✅ 带 X-Client-Request-Id 用于链路追踪（OpenAI 官方推荐）
const completion = await openai.chat.completions.create(
  {
    model,
    messages, // 已通过 zod 校验的消息数组
    max_tokens: 1000,
  },
  {
    headers: { "X-Client-Request-Id": randomUUID() },
  }
);
const { z } = require("zod");

// ✅ 必须用 zod 校验，防止 role 注入
const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const ChatSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(20),
});
// server/index.js 启动时必须检查所有必需密钥
const REQUIRED_ENV_VARS = [
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "JWT_SECRET",
  "PASSWORD_SALT",
  "DATABASE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    // 快速失败：缺少密钥时拒绝启动，而不是用弱兜底值
    throw new Error(`[严重] 环境变量 ${key} 未配置，服务拒绝启动`);
  }
}
// ❌ 绝不：硬编码兜底值
const JWT_SECRET = process.env.JWT_SECRET || "nano-banana-fallback-secret";

// ❌ 绝不：空字符串兜底
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// ✅ 正确：启动时检查，无值则抛错（见 7.3）
// server/lib/credits.js
// 职责：封装所有积分操作，所有路由通过此模块操作积分
// ⚠️ 禁止在任何路由中硬编码积分消耗数值，必须通过 getOperationCost() 读取

const { getPool } = require("./db");

/**
 * 获取指定操作的积分消耗量（从数据库动态读取，管理员可配置）
 * @param {string} operationKey - 操作类型 key（'image_generation' | 'image_edit' | 'chat'）
 * @returns {number} 该操作消耗的积分数
 */
async function getOperationCost(operationKey) {
  const pool = getPool();
  const result = await pool.query(
    "SELECT cost FROM public.api_cost_config WHERE operation_key = $1 AND is_active = true",
    [operationKey]
  );
  if (result.rows.length === 0) {
    // 找不到配置时记录告警，不能静默失败
    console.error(`[积分配置] 未找到操作 "${operationKey}" 的定价配置，拒绝本次请求`);
    throw new Error(`Missing cost config for operation: ${operationKey}`);
  }
  return parseInt(result.rows[0].cost, 10);
}

/**
 * 查询用户当前积分（用户不存在返回 -1）
 */
async function getUserCredits(userId) {
  const pool = getPool();
  const result = await pool.query(
    "SELECT credits FROM public.users WHERE id = $1",
    [userId]
  );
  if (result.rows.length === 0) return -1;
  return parseInt(result.rows[0].credits, 10);
}

/**
 * 先扣积分（调用 AI API 之前执行）
 * 使用 WHERE credits >= cost 的原子更新，防止积分变成负数
 * @returns {number} 扣除后的积分余额
 */
async function deductCredits(userId, amount, operationKey, operatorNote = "") {
  const pool = getPool();
  // 使用事务保证扣减和日志写入的原子性
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 原子扣减：AND credits >= amount 保证不会扣成负数
    const result = await client.query(
      "UPDATE public.users SET credits = credits - $1, updated_at = NOW() WHERE id = $2 AND credits >= $1 RETURNING credits",
      [amount, userId]
    );
    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new Error("积分不足，原子扣减失败");
    }
    const remaining = parseInt(result.rows[0].credits, 10);

    // 写入积分变动日志
    await client.query(
      "INSERT INTO public.credit_logs (user_id, delta, reason, operation_key, balance_after) VALUES ($1, $2, $3, $4, $5)",
      [userId, -amount, "ai_deduct", operationKey, remaining]
    );

    await client.query("COMMIT");
    return remaining;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 退款积分（AI API 调用失败时执行，必须在 catch 里调用）
 */
async function refundCredits(userId, amount, operationKey) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "UPDATE public.users SET credits = credits + $1, updated_at = NOW() WHERE id = $2 RETURNING credits",
      [amount, userId]
    );
    const remaining = parseInt(result.rows[0].credits, 10);
    await client.query(
      "INSERT INTO public.credit_logs (user_id, delta, reason, operation_key, balance_after) VALUES ($1, $2, $3, $4, $5)",
      [userId, amount, "ai_refund", operationKey, remaining]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 充值积分（Stripe Webhook 或管理员手动操作时调用）
 * @param {string} reason - 充值原因，如 'stripe_webhook' | 'admin_recharge' | 'admin_adjust'
 * @param {string|null} operatorId - 操作人 userId（管理员手动充值时填，Stripe 自动充值时填 null）
 */
async function addCredits(userId, amount, reason, operatorId = null) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "UPDATE public.users SET credits = credits + $1, updated_at = NOW() WHERE id = $2 RETURNING credits",
      [amount, userId]
    );
    const remaining = parseInt(result.rows[0].credits, 10);
    await client.query(
      "INSERT INTO public.credit_logs (user_id, delta, reason, operator_id, balance_after) VALUES ($1, $2, $3, $4, $5)",
      [userId, amount, reason, operatorId, remaining]
    );
    await client.query("COMMIT");
    return remaining;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 管理员手动调整积分（可正可负，需要管理员鉴权后调用）
 * @param {number} delta - 变化量（正数加积分，负数扣积分）
 */
async function adminAdjustCredits(targetUserId, delta, adminUserId, note = "") {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // 防止积分被调整为负数
    const result = await client.query(
      "UPDATE public.users SET credits = GREATEST(0, credits + $1), updated_at = NOW() WHERE id = $2 RETURNING credits",
      [delta, targetUserId]
    );
    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new Error("目标用户不存在");
    }
    const remaining = parseInt(result.rows[0].credits, 10);
    await client.query(
      "INSERT INTO public.credit_logs (user_id, delta, reason, operator_id, note, balance_after) VALUES ($1, $2, $3, $4, $5, $6)",
      [targetUserId, delta, "admin_adjust", adminUserId, note, remaining]
    );
    await client.query("COMMIT");
    return remaining;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getOperationCost,
  getUserCredits,
  deductCredits,
  refundCredits,
  addCredits,
  adminAdjustCredits,
};
// ✅ 所有 AI 路由必须遵循此模式（以图像生成为例）
const { getOperationCost, getUserCredits, deductCredits, refundCredits } = require("../lib/credits");

router.post("/image", authMiddleware, async (req, res) => {
  const { userId } = req;
  const OPERATION_KEY = "image_generation"; // 与 api_cost_config 表的 operation_key 对应
  let cost = 0;
  let creditsDeducted = false;

  try {
    // ① 从数据库动态读取本次操作的积分消耗量（管理员可配置）
    cost = await getOperationCost(OPERATION_KEY);

    // ② 检查积分是否充足（友好提示）
    const currentCredits = await getUserCredits(userId);
    if (currentCredits < cost) {
      return res.status(402).json({ error: "Insufficient credits. Please recharge." });
    }

    // ③ 先扣（在调用 AI 之前，原子操作防止负数）
    const remaining = await deductCredits(userId, cost, OPERATION_KEY);
    creditsDeducted = true;

    // ④ 调用 Gemini AI
    const imageDataUri = await callGemini(prompt, referenceBase64, aspectRatio);

    // ⑤ 写入生成历史
    await insertGenerationLog(userId, prompt, imageDataUri, "done");

    return res.json({ image: imageDataUri, credits: remaining });

  } catch (err) {
    console.error("[图像生成失败]", { userId, error: err.message });

    // ⑥ 失败退款（必须在 catch 里）
    if (creditsDeducted) {
      try {
        await refundCredits(userId, cost, OPERATION_KEY);
        console.log(`[退款成功] 用户 ${userId} 退回 ${cost} 积分`);
      } catch (refundErr) {
        // ⚠️ 退款失败绝不能 silent catch，必须告警人工介入
        console.error("[严重] 退款失败！需要人工介入！", { userId, cost, refundErr });
      }
    }

    await insertGenerationLog(userId, prompt, null, "failed").catch(console.error);

    return res.status(500).json({
      error: creditsDeducted ? "Generation failed. Credits refunded." : "Generation failed.",
    });
  }
});
用户登录后，前端从 /api/user/me 接口获取 adminLevel 字段：
- adminLevel === 0 → 不显示任何管理员入口
- adminLevel === 1 或 2 → 在导航栏显示「管理后台」入口，跳转到 /admin
// server/middleware/adminAuth.js
// 职责：验证管理员权限，所有 /api/admin/* 路由必须经过此中间件
// 使用方式：router.patch("/users/:id/admin-level", adminAuth(1), handler)
//           router.get("/users", adminAuth(2), handler)

const { verifyJWT } = require("../lib/jwt");
const { getPool } = require("../lib/db");

/**
 * 管理员鉴权中间件工厂
 * @param {number} requiredLevel - 最低需要的管理员级别（1 或 2）
 */
function adminAuth(requiredLevel) {
  return async (req, res, next) => {
    // ① 先验证 JWT
    const userId = verifyJWT(req.headers.authorization);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized." });
    }

    try {
      // ② 从数据库实时查询管理员级别（不信任 JWT payload，防止降权后仍持有旧 token）
      // 实时查数据库是必要的：如果管理员被降级，立即失效，不用等 token 过期
      const pool = getPool();
      const result = await pool.query(
        "SELECT id, admin_level FROM public.users WHERE id = $1",
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: "User not found." });
      }

      const adminLevel = parseInt(result.rows[0].admin_level, 10);

      // ③ 检查权限级别是否足够
      if (adminLevel < requiredLevel) {
        // 已登录但权限不足，返回 403（不是 401）
        return res.status(403).json({ error: "Insufficient admin privileges." });
      }

      // ④ 将 userId 和 adminLevel 注入 req，供 handler 使用
      req.userId = userId;
      req.adminLevel = adminLevel;
      next();

    } catch (err) {
      console.error("[管理员鉴权失败]", { userId, err: err.message });
      return res.status(500).json({ error: "Auth check failed." });
    }
  };
}

module.exports = { adminAuth };
// server/routes/admin.js
// 职责：管理员后台所有 API，每个操作都有权限检查和完整日志

const express = require("express");
const router = express.Router();
const { z } = require("zod");
const { adminAuth } = require("../middleware/adminAuth");
const { adminAdjustCredits, addCredits, getOperationCost } = require("../lib/credits");
const { getPool } = require("../lib/db");

// ────────────────────────────────────────────────────────
// 充值管理：给用户直接加积分（Level 2+）
// ────────────────────────────────────────────────────────
const RechargeSchema = z.object({
  amount: z.number().int().min(1).max(100000), // 单次充值上限，防止误操作
  note: z.string().max(200).optional(),
});

router.post("/users/:id/recharge", adminAuth(2), async (req, res) => {
  const parsed = RechargeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid recharge amount." });

  const { amount, note } = parsed.data;
  try {
    // 充值日志会记录操作人 ID（req.userId 由 adminAuth 中间件注入）
    const newBalance = await addCredits(req.params.id, amount, "admin_recharge", req.userId);
    console.log(`[管理员充值] 管理员 ${req.userId} 给用户 ${req.params.id} 充值 ${amount} 积分，备注：${note}`);
    return res.json({ success: true, newBalance });
  } catch (err) {
    console.error("[管理员充值失败]", err);
    return res.status(500).json({ error: "Recharge failed." });
  }
});

// ────────────────────────────────────────────────────────
// 积分管理：手动调整积分（Level 2+）
// ────────────────────────────────────────────────────────
const AdjustSchema = z.object({
  delta: z.number().int().min(-100000).max(100000), // 正数加分，负数扣分
  note: z.string().max(200).optional(),
});

router.patch("/users/:id/credits", adminAuth(2), async (req, res) => {
  const parsed = AdjustSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid delta value." });

  const { delta, note } = parsed.data;
  try {
    const newBalance = await adminAdjustCredits(req.params.id, delta, req.userId, note || "");
    console.log(`[管理员调分] 管理员 ${req.userId} 调整用户 ${req.params.id} 积分 ${delta > 0 ? "+" : ""}${delta}，备注：${note}`);
    return res.json({ success: true, newBalance });
  } catch (err) {
    console.error("[管理员调分失败]", err);
    return res.status(500).json({ error: "Adjustment failed." });
  }
});

// ────────────────────────────────────────────────────────
// API 设置：查询当前定价配置（Level 2+）
// ────────────────────────────────────────────────────────
router.get("/api-config", adminAuth(2), async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      "SELECT operation_key, operation_name, cost, is_active FROM public.api_cost_config ORDER BY operation_key"
    );
    return res.json({ config: result.rows });
  } catch (err) {
    console.error("[API配置查询失败]", err);
    return res.status(500).json({ error: "Failed to fetch config." });
  }
});

// ────────────────────────────────────────────────────────
// API 设置：修改定价（Level 2+）
// ────────────────────────────────────────────────────────
const ApiConfigSchema = z.object({
  operation_key: z.enum(["image_generation", "image_edit", "chat"]),
  cost: z.number().int().min(0).max(10000),
});

router.patch("/api-config", adminAuth(2), async (req, res) => {
  const parsed = ApiConfigSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid config." });

  const { operation_key, cost } = parsed.data;
  try {
    const pool = getPool();
    await pool.query(
      "UPDATE public.api_cost_config SET cost = $1, updated_at = NOW(), updated_by = $2 WHERE operation_key = $3",
      [cost, req.userId, operation_key]
    );
    console.log(`[API配置] 管理员 ${req.userId} 将 ${operation_key} 定价修改为 ${cost} 积分`);
    return res.json({ success: true });
  } catch (err) {
    console.error("[API配置修改失败]", err);
    return res.status(500).json({ error: "Config update failed." });
  }
});

// ────────────────────────────────────────────────────────
// 人员管理：设置/取消管理员级别（Level 1 ONLY）
// ────────────────────────────────────────────────────────
const SetAdminSchema = z.object({
  admin_level: z.number().int().min(0).max(2),
  // 注意：目标用户的 admin_level 只能被设为 0 或 2
  // 1 号超级管理员的级别不能通过 API 修改（防止误操作降级唯一超管）
});

router.patch("/users/:id/admin-level", adminAuth(1), async (req, res) => {
  const parsed = SetAdminSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid admin level." });

  const { admin_level } = parsed.data;

  // 禁止将任何人设为 admin_level = 1（1 号超管只能在数据库里手动设置，防止接口被滥用）
  if (admin_level === 1) {
    return res.status(403).json({ error: "Cannot set admin_level to 1 via API. Use database directly." });
  }

  // 禁止操作自己的权限（防止超管意外降级自己）
  if (req.params.id === req.userId) {
    return res.status(403).json({ error: "Cannot modify your own admin level." });
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      "UPDATE public.users SET admin_level = $1, updated_at = NOW() WHERE id = $2 RETURNING email, admin_level",
      [admin_level, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    const levelName = admin_level === 2 ? "普通管理员" : "普通用户";
    console.log(`[人员管理] 超级管理员 ${req.userId} 将用户 ${req.params.id}(${result.rows[0].email}) 设为 ${levelName}`);
    return res.json({ success: true, adminLevel: admin_level });
  } catch (err) {
    console.error("[人员管理操作失败]", err);
    return res.status(500).json({ error: "Operation failed." });
  }
});

// ────────────────────────────────────────────────────────
// 用户列表（Level 2+）
// ────────────────────────────────────────────────────────
router.get("/users", adminAuth(2), async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);
  const search = req.query.search || "";
  const offset = (page - 1) * limit;

  try {
    const pool = getPool();
    // 支持按邮箱模糊搜索
    const result = await pool.query(
      `SELECT id, email, credits, admin_level, created_at, updated_at
       FROM public.users
       WHERE email ILIKE $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [`%${search}%`, limit, offset]
    );
    const countResult = await pool.query(
      "SELECT COUNT(*) FROM public.users WHERE email ILIKE $1",
      [`%${search}%`]
    );
    return res.json({
      users: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit,
    });
  } catch (err) {
    console.error("[用户列表查询失败]", err);
    return res.status(500).json({ error: "Failed to fetch users." });
  }
});

module.exports = router;
// apps/web/src/pages/admin/AdminLayout.tsx
// 职责：管理员后台公共布局，包含 Tab 导航和权限守卫
// 用户 adminLevel 从全局 Context 获取（登录时已写入）

// ✅ Tab 显示规则
// - adminLevel >= 2：显示「充值管理」「积分管理」「API 设置」
// - adminLevel === 1：额外显示「人员管理」
// - adminLevel === 0：不应出现在此页面（路由守卫重定向到首页）

// ✅ 路由守卫（必须实现）
// 访问 /admin/* 时：
// 1. 从 Context 取 user.adminLevel
// 2. 如果 adminLevel === 0，立即 navigate("/")，不渲染任何内容
// 3. 访问 /admin/staff 时，如果 adminLevel !== 1，navigate("/admin") 不渲染

// ✅ 前端只负责 UI 展示，不做权限实质判断
// 权限的最终判断在后端 adminAuth() 中间件完成
// 前端的路由守卫只是 UX 层面的优化，不是安全措施
// packages/api-client/src/api.ts 需要新增的管理员 API 函数

export async function adminGetUsers(params: { page?: number; limit?: number; search?: string }, token: string) {
  return apiFetch(`/admin/users?page=${params.page}&limit=${params.limit}&search=${params.search || ""}`, {}, token);
}

export async function adminRechargeUser(userId: string, amount: number, note: string, token: string) {
  return apiFetch(`/admin/users/${userId}/recharge`, { method: "POST", body: JSON.stringify({ amount, note }) }, token);
}

export async function adminAdjustCredits(userId: string, delta: number, note: string, token: string) {
  return apiFetch(`/admin/users/${userId}/credits`, { method: "PATCH", body: JSON.stringify({ delta, note }) }, token);
}

export async function adminGetApiConfig(token: string) {
  return apiFetch("/admin/api-config", {}, token);
}

export async function adminUpdateApiConfig(operationKey: string, cost: number, token: string) {
  return apiFetch("/admin/api-config", { method: "PATCH", body: JSON.stringify({ operation_key: operationKey, cost }) }, token);
}

export async function adminSetAdminLevel(userId: string, adminLevel: 0 | 2, token: string) {
  return apiFetch(`/admin/users/${userId}/admin-level`, { method: "PATCH", body: JSON.stringify({ admin_level: adminLevel }) }, token);
}
// server/routes/user.js 的 GET /me 接口必须返回 admin_level
// 前端依赖此字段决定是否显示管理员入口

router.get("/me", authMiddleware, async (req, res) => {
  const pool = getPool();
  const result = await pool.query(
    // ✅ 必须查询并返回 admin_level 字段
    "SELECT id, email, credits, admin_level, created_at FROM public.users WHERE id = $1",
    [req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "User not found." });
  const user = result.rows[0];
  return res.json({
    id: user.id,
    email: user.email,
    credits: parseInt(user.credits, 10),
    adminLevel: parseInt(user.admin_level, 10), // ✅ 驼峰命名，前端统一使用 adminLevel
    createdAt: user.created_at,
  });
});
❌ 绝不：Access-Control-Allow-Origin: * + credentials: true
✅ 正确：精确 Origin 白名单 + 动态反射匹配
// server/lib/cors.js
// 职责：提供统一 CORS Origin 验证逻辑，所有路由通过 cors 中间件使用此函数

// 生产环境白名单（硬编码兜底）
const PRODUCTION_ORIGINS = ["https://kkai.plus", "https://www.kkai.plus"];

// 本地开发允许的 Origin 正则
const LOCALHOST_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function getAllowedOrigins() {
  const envOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return envOrigins.length > 0 ? envOrigins : PRODUCTION_ORIGINS;
}

function originValidator(origin, callback) {
  const allowed = getAllowedOrigins();
  // 非浏览器请求（curl、Postman）：origin 为 undefined，服务端工具调用允许
  if (!origin) { callback(null, true); return; }
  // 精确匹配白名单 或 本地开发 localhost
  if (allowed.includes(origin) || LOCALHOST_PATTERN.test(origin)) {
    callback(null, true);
  } else {
    callback(new Error(`CORS 拒绝：Origin "${origin}" 不在白名单中`));
  }
}

const corsOptions = {
  origin: originValidator,
  credentials: true,                           // ✅ 允许携带 Cookie / Authorization
  allowedHeaders: ["Authorization", "Content-Type"],
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
};

module.exports = { corsOptions };

// server/index.js 使用：
// const cors = require("cors");
// const { corsOptions } = require("./lib/cors");
// app.use(cors(corsOptions));
// 通过 cors 中间件自动注入以下 header：
// Access-Control-Allow-Origin: [精确 Origin]
// Access-Control-Allow-Credentials: true
// Vary: Origin

// 所有路由额外添加：
res.setHeader("X-Content-Type-Options", "nosniff");
res.setHeader("X-Frame-Options", "DENY");
// Content-Type 由 express.json() 自动设置
// /webhook/stripe 不走普通 cors，因为请求方是 Stripe 服务器（无 Origin）
// 此路由单独处理，不使用全局 cors 中间件
router.post("/stripe", express.raw({ type: "application/json" }), (req, res) => {
  // 必须用 express.raw 获取原始 Buffer，否则 Stripe 签名验证失败
  ...
});
// ✅ 参数化查询（防 SQL 注入）
await pool.query("SELECT credits FROM public.users WHERE id = $1", [userId]);

// ❌ 字符串拼接（SQL 注入漏洞）
await pool.query(`SELECT credits FROM public.users WHERE id = '${userId}'`);
// server/lib/db.js
// 职责：提供 PostgreSQL 连接池单例，统一管理数据库连接

const { Pool } = require("pg");

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // 生产环境启用 SSL
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      max: 10,              // 连接池最大连接数
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on("error", (err) => {
      console.error("[数据库连接池错误]", err.message);
    });
  }
  return pool;
}

module.exports = { getPool };
migrations/
├── 001_create_users.sql
├── 002_create_generations.sql
├── 003_add_users_updated_at.sql
└── ...（按序号递增，禁止修改已执行的历史文件）
// ✅ 所有错误响应必须遵循此格式（英文，给前端展示）
{ "error": "Insufficient credits. Please recharge." }

// ✅ 成功响应：涉及积分的操作必须返回最新余额
{ "image": "data:image/png;base64,...", "credits": 80 }
// ✅ 错误日志带完整上下文（后端 console.error，中文）
console.error("[模块 操作]", {
  userId,
  prompt: prompt?.substring(0, 100), // 截断防止日志过大
  error: err instanceof Error ? err.message : String(err),
  stack: process.env.NODE_ENV !== "production" ? err?.stack : undefined,
});

// ❌ 绝不 silent catch
try { ... } catch (_) { }  // 禁止！
// server/middleware/rateLimit.js
// 职责：防止 API 被滥用，所有路由默认启用速率限制

const rateLimit = require("express-rate-limit");

// 通用速率限制：每 IP 每 15 分钟最多 100 次
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI 生成专用速率限制：每 IP 每分钟最多 10 次（防盗刷）
const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Generation rate limit exceeded. Please wait a moment." },
});

module.exports = { generalLimiter, generateLimiter };
main           ← 生产分支，只接受 PR 合并
  └─ feat/xxx  ← 新功能
  └─ fix/xxx   ← 修复
  └─ refactor/ ← 重构
  └─ chore/    ← 依赖/配置更新
┌─ 本地开发 ──────────────────────────────────┐
│  npm run dev          → Vite dev server :5173 │
│  cd server && node index.js → Express :8080   │
│  .env: VITE_PUBLIC_API_BASE_URL=:8080/api     │
└────────────────────────────────────────────────┘
              ↓ git push → main

┌─ GitHub Actions (.github/workflows/) ────────┐
│  npm run verify:changes  (typecheck+test+build)│
└────────────────────────────────────────────────┘
              ↓ 通过

┌─ Vercel（前端自动部署） ──────────────────────┐
│  build: npm run build → apps/web/dist          │
│  vercel.json: SPA 路由回退 /index.html         │
│  环境变量: VITE_PUBLIC_API_BASE_URL            │
└────────────────────────────────────────────────┘

┌─ VPS（手动 or CI 部署） ──────────────────────┐
│  cd server && npm install && pm2 restart all   │
│  .env: 所有后端密钥                            │
│  pm2 / systemd 保活                            │
└────────────────────────────────────────────────┘
// ❌ 禁止在 apps/web/ 中出现：
import { View, Text } from "react-native";
import { Platform } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
// ❌ 禁止任何 Netlify Functions 调用
fetch("/.netlify/functions/xxx");
// ✅ 所有 API 调用链路：
// 页面组件 → src/services/*.ts → packages/api-client → VPS
// 不得在页面组件中直接写 fetch

// src/services/generate.ts 示例：
import { generateImage } from "@nano-banana/api-client";
export function useGenerate() {
  return useMutation({ mutationFn: generateImage });
}
// ✅ 手机端同样通过 packages/api-client 调用 VPS
// api-client 内 baseURL 自动区分环境：
// - Expo: process.env.EXPO_PUBLIC_API_BASE_URL
// - Vite: import.meta.env.VITE_PUBLIC_API_BASE_URL
// ❌ 禁止在 apps/mobile/ 中出现：
window.location.href = "...";
document.getElementById("...");
import { BrowserRouter } from "react-router-dom";
// ❌ 禁止 Netlify 相关任何内容
// ✅ 可以放 shared/
export type GenerateImageRequest = {
  prompt: string;
  aspectRatio: "1:1" | "16:9" | "9:16";
};

// ❌ 禁止放 shared/（含平台依赖）
import { Platform } from "react-native";  // RN 平台 API
import { useState } from "react";         // React Hook
window.localStorage.setItem(...);         // DOM API
// packages/api-client/src/client.ts
// 职责：baseURL 智能解析（这是全项目唯一写 baseURL 逻辑的地方）

function getBaseUrl(): string {
  // ① 手机端（Expo Runtime）
  if (typeof process !== "undefined" && process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  // ② 桌面端（Vite 构建注入）
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_PUBLIC_API_BASE_URL) {
    return import.meta.env.VITE_PUBLIC_API_BASE_URL;
  }
  // ③ 本地开发默认（VPS 本地实例）
  return "http://localhost:8080/api";
}

async function apiFetch(path: string, options?: RequestInit, token?: string) {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options?.headers,
  };
  const res = await fetch(`${getBaseUrl()}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(body.error || "Request failed"), { status: res.status });
  }
  return res.json();
}
// server/index.js
// 职责：VPS 服务入口，挂载所有路由，初始化中间件，启动 Express

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

// ① 启动时检查所有必需密钥
const REQUIRED_ENVS = ["GEMINI_API_KEY", "OPENAI_API_KEY", "JWT_SECRET",
  "PASSWORD_SALT", "DATABASE_URL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];
for (const key of REQUIRED_ENVS) {
  if (!process.env[key]) throw new Error(`[严重] ${key} 未配置，服务拒绝启动`);
}

const express = require("express");
const cors = require("cors");
const { corsOptions } = require("./lib/cors");
const { generalLimiter, generateLimiter } = require("./middleware/rateLimit");

// 路由模块
const authRouter = require("./routes/auth");
const generateRouter = require("./routes/generate-image");
const chatRouter = require("./routes/chat");
const userRouter = require("./routes/user");
const billingRouter = require("./routes/billing");
const generationsRouter = require("./routes/generations");
const webhookRouter = require("./routes/webhook"); // ⚠️ 必须在 express.json 之前挂载
const adminRouter = require("./routes/admin");

const app = express();
app.disable("x-powered-by");

// ② Stripe Webhook 路由必须在 JSON 解析中间件之前注册（需要原始 Buffer）
app.use("/webhook/stripe", express.raw({ type: "application/json" }), webhookRouter);

// ③ 全局中间件
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" })); // 图像 base64 体积大，需放宽限制
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

// ④ API 路由
app.use("/api/auth", authRouter);
app.use("/api/generate", generateLimiter, generateRouter); // AI 生成额外限速
app.use("/api/chat", chatRouter);
app.use("/api/user", userRouter);
app.use("/api/billing", billingRouter);
app.use("/api/generations", generationsRouter);
app.use("/api/admin", adminRouter);

// ⑤ 兜底 404
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found." });
});

// ⑥ 全局错误处理
app.use((err, req, res, next) => {
  console.error("[未捕获异常]", err);
  res.status(500).json({ error: "Internal server error." });
});

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => {
  console.log(`[KK-API] VPS 服务已启动，端口 :${PORT}`);
});
// ❌ 引用已废弃的 Netlify
import { Handler } from "@netlify/functions";
fetch("/.netlify/functions/generate-image");
// netlify.toml 中的任何配置

// ❌ 在 Vercel 上实现 API 路由（Vercel 只托管前端静态资源）
// vercel.json 中加 /api/* → serverless function 映射
// ❌ 硬编码密钥兜底
const JWT_SECRET = process.env.JWT_SECRET || "my-fallback-secret";

// ❌ 前端直连 AI API
fetch("https://generativelanguage.googleapis.com/v1beta/...", { key: GEMINI_KEY });

// ❌ CORS 通配符 + Authorization（浏览器拒绝）
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Headers", "Authorization");
// ❌ 错误模型名
model: "gemini-pro-vision"        // → "gemini-2.5-flash-image"
model: "gemini-2.5-flash"         // → "gemini-2.5-flash-image"

// ❌ 字符串代替枚举
responseModalities: ["IMAGE"]     // → [Modality.IMAGE, Modality.TEXT]

// ❌ aspectRatio 位置错误
config: { aspectRatio: "16:9" }   // → config: { imageConfig: { aspectRatio: "16:9" } }

// ❌ 参考图带 data URI 前缀
inlineData: { data: "data:image/png;base64,..." } // 先 .replace() 去前缀
// ❌ 前端直接修改积分（不经过后端）
localStorage.setItem("credits", 99999);     // 无效，前端只是展示层
userStore.credits = 99999;                   // 同上，后端不知情

// ❌ JWT payload 里存管理员级别并信任它
const { adminLevel } = decodeJWT(token);
if (adminLevel >= 2) { ... }                 // 不安全！必须从数据库实时查

// ❌ 2 号管理员操作人员权限
router.patch("/users/:id/admin-level", adminAuth(2), handler); // 错误：应为 adminAuth(1)

// ❌ 允许通过 API 将用户设为 1 号超管
if (admin_level === 1) { /* 设置 */ }        // 1 号超管只能在数据库直接设置

// ❌ 积分调整允许变为负数
"UPDATE users SET credits = credits + $1"    // 缺少 GREATEST(0, ...) 保护

// ❌ 管理员操作不留痕
await pool.query("UPDATE users SET credits = ...");  // 未写 credit_logs，无法审计

// ❌ 硬编码积分消耗量
const COST = 10;                             // 应通过 getOperationCost("image_generation") 动态读取
// ❌ 注册时赠送积分
await pool.query("INSERT INTO users (credits) VALUES (100)");  // 应为 0

// ❌ 积分扣减不用动态配置
const cost = isEdit ? 15 : 10;              // 硬编码！应从 api_cost_config 表读取

// ❌ 先调 API 后扣积分
const result = await callGemini();
await deductCredits(userId, cost);           // 如果扣减失败，用户白嫖

// ❌ 退款失败 silent catch
try { await refundCredits(); } catch (_) {} // 禁止！退款失败必须告警
// ❌ SQL 字符串拼接
pool.query(`SELECT * FROM users WHERE id = '${userId}'`);

// ❌ 直接修改 schema（不走 migrations）
pool.query("ALTER TABLE users ADD COLUMN ...");
// ❌ 手机端 DOM API
document.getElementById("...");        // apps/mobile/ 禁用

// ❌ 桌面端 RN 组件
import { View } from "react-native";   // apps/web/ 禁用

// ❌ shared/ 含平台代码
import { Platform } from "react-native"; // packages/shared/ 禁用

---

# 11. UI 开发规范与多端间距设计法则

本章节为 KK-Studio 的 UI/UX 与自适应设计规范，任何界面重构、自适应适配或交互动效修改，均必须严格遵守以下法则：

## 11.1 多端自适应布局与间距规范

### 11.1.1 移动端（窄屏，断点 < 768px）
1. **主导航网格 (Grid & Grid Span)**：
   - 页面中的卡片展示采用一排 **1 列**（一排只能有 1 个卡片），占满容器宽度，防止横向排布导致的挤压。
   - 卡片间距统一为 `12px` 或 `16px`。
2. **二级菜单与页面顶栏 (Top Bar)**：
   - 切换到二级菜单模块时，二级菜单默认全屏展示。
   - 顶栏高度需保持一致：左侧返回按钮（ArrowLeft，尺寸为 32x32px）、中部标题/标识（Title & Kicker）、右侧中英文切换组件（SettingsLanguageToggle，高度 32px）与关闭按钮（X，尺寸 32x32px）保持水平线完美对齐（`align-items: center`）。
   - 返回按钮逻辑：主总览页（dashboard）的左侧返回按钮点击时直接关闭设置面板（返回主工作区）；子模块页面的左侧返回按钮点击时返回上一级（总览面板）。
3. **背景渐变遮挡**：
   - 顶部信息的“信息-积分-更多操作”属于大框整体，安全区外层黑色遮挡需去除硬编码纯黑，改为从顶部到下方的精美渐变：`linear-gradient(to bottom, #000000 0%, rgba(0, 0, 0, 0) 100%)`。顶部安全区保持黑色以遮挡手机状态栏重叠，底部降为 100% 透明以展现后面的画布层。

### 11.1.2 电脑端（宽屏，断点 >= 1024px）
1. **Master-Detail 分栏自适应 (分栏布局)**：
   - 当浏览器缩放或调整大小时，若为电脑端（宽屏），左侧侧边栏只显示卡片的缩小状态（只展示名称与精简核心指标），右侧则对应显示二级菜单的具体面板。
   - 主菜单网格：一排支持 2 到 4 个卡片。
   - **卡片大小权重机制**：引入 `Grid Span` 自适应占位，允许重要卡片比普通卡片更大。最大的卡片支持占 4 个格子（例如：横跨 4 个格子，或者 2*2 占 4 个格子）。
   - 卡片间距统一为 `18px` 到 `24px`。

## 11.2 充值 UI 交互与灯光高光规范
1. **两端一致的网格布局**：
   - 充值界面在手机端和电脑端均使用卡片式呈现，保持 UI 高度一致，且必须在一屏内完整展示（`2*4` 网格布局）。
   - 左侧（或前部分）为 **4 个充值通道**，占 `2*2` 格。
   - 右侧（或后部分）为 **金额选择与确认充值**，占 `2*2` 格。
2. **高光与高亮主题指示灯交互**：
   - 用户选中不同的支付渠道时，界面中所有的高光（Glow）、发光边框（Border Glow）和状态指示灯（Indicator Lights）将动态切换为对应的支付品牌主题色：
     - **支付宝（Alipay）**：动态切换为**蓝色高光**（`#1677ff`，呼吸脉冲效果）。
     - **微信支付（WeChat Pay）**：动态切换为**绿色高光**（`#22c55e`）。
     - **国际支付（Stripe/Card）**：动态切换为**金色高光**（`#eab308`）。
     - **人工客服充值**：保持系统默认主题色。

## 11.3 AI 助手与侧边收纳动效规范
1. **电脑端 AI 助手挤压机制 (Canvas Squeezing)**：
   - **取消传统的悬浮式 AI 助手入口按钮**，将其修改为吸附在右侧侧边栏边缘的**折叠箭头**，伴随微光动效。
   - 点击展开时，AI 助手以滑出动效呈现，并直接**挤压中间的画布容器宽度**，而不是悬浮遮挡。输入框宽度应减去 AI 助手的宽度，防止输入内容或操作被遮挡。
   - 手机端打开时，AI 助手直接以整屏模态遮罩呈现。
2. **工具栏与缩放条收纳**：
   - 底部缩放工具与版本号由横版改为**竖版条状**，固定在左下角。
   - 左侧工具栏改为不可上下移动，固定在页面积分条与缩放条之间的垂向中点。
   - 收纳交互：当用户无操作时，工具栏和侧边栏顶部线条以流畅渐变（`opacity` 和 `width` 缩小）**收纳为一条纤细的微型小条**（例如 `width: 6px`）。一旦鼠标悬停或点击，立即通过弹性过渡（`cubic-bezier` 或 `spring`）恢复为完整状态。

## 11.4 登录超时滑动续期机制规范 (Sliding Session Expiration)
1. **一周登录态保障**：
   - 无论电脑端还是手机端，初次登录成功后，默认会话有效期为 7 天。
2. **无感知滑动续期**：
   - 只要用户在浏览器或移动端有 API 操作交互，系统就会将该用户的登录状态自**操作当天起，往后延期 7 天**。
   - 实现方式：
     - **后端**：在 Express 的 JWT 鉴权中间件或 API 处理完毕后，只要 JWT 校验通过，就在 Response Header 中注入 `X-Refresh-Token` 头部，其值为重新签发、有效期为 7 天的 JWT 令牌。
     - **前端**：无论是 Axios 客户端（`packages/api-client/src/client.ts`）还是 Fetch 客户端（`packages/shared/src/contracts/client/kk-api-client.ts`），当响应拦截器捕获到 `x-refresh-token` 响应头时，需自动更新本地 `sessionStorage` 和 `localStorage`（如果是 `kk.api.access_token`），并广播会话变更事件以刷新前端内存状态，保证会话持续顺延不掉线。