# AGENTS.md - AI Agent 项目总指导文件
# 这是本项目最重要的文件。
# 所有 AI（Cursor、Claude Code、Copilot、Codex）在碰任何代码之前，必须完整读完本文件。
# 本项目以中文为主：所有注释、文档、提交信息、回复、变量说明，一律用中文。

---

## 【语言规范 - 最高优先级】

**本项目是中文项目，以下规则不得违反：**

1. 所有代码注释必须用中文写，解释这段代码在做什么、为什么这么做
2. 所有 AI 回复、解释、建议必须用中文
3. 所有 Git commit 信息用中文（遵循 Conventional Commits 格式，但描述部分写中文）
4. 所有文档（docs/ 目录）用中文撰写
5. 所有报错信息在后端 console.error 时可以用中文，但返回给前端的 Response body 用英文（防止编码乱码）
6. 变量名、函数名、类名用英文命名（遵循代码规范），但旁边必须有中文注释解释用途

**注释格式要求：**
```typescript
// 正确：中文注释，解释"为什么"和"做什么"
// Gemini 要求 base64 字符串不能带 data URI 前缀，否则会报 400 错误
const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

// 正确：复杂逻辑前面加一段说明
// 这里先验证 JWT，再校验入参，最后才调用 Gemini API
// 顺序不能乱，否则会在鉴权失败时浪费 API 配额
export const handler: Handler = async (event) => { ... };

// 错误：英文注释（除非是第三方库的类型签名）
// Gemini requires base64 without data URI prefix
const base64Data = ...;

// 错误：没有注释的复杂逻辑
const parts = response.candidates?.[0]?.content?.parts ?? [];
```

---

## 0. 核心规则（最高优先级，任何情况下不得违反）

1. **绝不**在前端代码里使用 API Key，所有密钥只存在于后端环境变量中
2. **绝不**混用桌面端和手机端的代码路径，两端有严格的目录隔离
3. **绝不**直接修改数据库，必须通过 migrations/ 下的迁移文件
4. **绝不**在前端直接请求第三方 AI API，必须走自家后端中转
5. **绝不**在 netlify/functions/ 之外的地方定义 HTTP 路由
6. **绝不**在根目录新建 .md 文档，文档统一放 docs/
7. **绝不**写没有中文注释的复杂逻辑代码

---

## 1. 项目概览

| 属性 | 值 |
|------|----|
| 项目名称 | nano-banana-KK |
| 核心功能 | AI 图像生成 / 编辑（Gemini nano-banana 模型） |
| 主要 AI 模型 | gemini-2.5-flash-image（图像）、gpt-4o-mini（文本） |
| 前端语言 | TypeScript (87%) + React |
| 部署平台 | Netlify（前端 + Functions）+ VPS（支付/队列） |
| 数据库 | PostgreSQL（通过 migrations/ 管理 schema） |
| 项目语言 | 中文为主（注释、文档、回复全部中文） |
| 设计系统 | High-Fidelity SaaS，详见第 9 节 |

---

## 2. 双端平台架构（核心，绝不混淆）

```
nano-banana-KK/
├── apps/
│   ├── web/          <- 桌面端（Vite + React + TypeScript）
│   │   └── src/
│   │       ├── components/   <- 桌面端专用组件
│   │       ├── pages/        <- 桌面端页面
│   │       ├── hooks/        <- 桌面端 hooks
│   │       └── styles/       <- 桌面端样式
│   └── mobile/       <- 手机端（Expo / React Native）
│       └── src/
│           ├── app/          <- expo-router 路由页面
│           ├── components/   <- 手机端专用组件
│           └── hooks/        <- 手机端 hooks
├── packages/
│   ├── shared/       <- 两端共用（类型定义、纯工具函数）
│   ├── api-client/   <- 统一 API 调用层（桌面端和手机端都用这个）
│   └── ui/           <- 共享基础 UI 组件（谨慎使用）
├── netlify/
│   └── functions/    <- 后端短任务（小于 10 秒，Netlify Functions）
├── payment-server/   <- VPS 长任务服务（支付/队列/定时任务）
├── migrations/       <- PostgreSQL 迁移文件（按版本号命名）
├── scripts/          <- 构建/部署/维护脚本
├── docs/             <- 所有文档（中文撰写）
├── config/           <- 全局配置（不含密钥）
├── tests/            <- 测试文件（目录结构镜像 src）
├── .claude/          <- AI Agent 配置（唯一 agent 配置目录）
├── AGENTS.md         <- 本文件（始终保持最新）
├── .env.example      <- 环境变量模板
├── netlify.toml      <- Netlify 部署配置
└── package.json      <- 根 package.json（workspaces 配置）
```

---

## 3. 双端职责边界（严格执行，不得混淆）

### 3.1 桌面端（apps/web/）
- 目标设备：PC 浏览器（Chrome、Safari、Firefox）
- 最小宽度：1024px（可适配到 768px，但不做手机端 UI）
- 交互方式：鼠标 hover、键盘快捷键、多列布局
- 路由：React Router v6，基于 apps/web/src/pages/
- **禁止**：任何 react-native 导入、任何 Expo API

### 3.2 手机端（apps/mobile/）
- 目标设备：iOS 16+、Android 11+
- 框架：Expo Managed Workflow + expo-router
- 交互方式：触摸手势、滑动、SafeArea
- **禁止**：任何 window. / document. / DOM API 调用
- 图片：必须用 expo-image，不能用 HTML 的 img 标签
- 图标：lucide-react-native
- 字体：@expo-google-fonts/* 系列

### 3.3 共享层（packages/）
- packages/shared/types/ -- TypeScript 类型，两端共用
- packages/shared/utils/ -- 纯函数工具，不含任何平台 API
- packages/api-client/ -- 封装所有 HTTP 调用，两端共用
- **判断原则**：代码里只要出现 Platform.OS、window、document、React Native 导入 -> 不能放 shared

---

## 4. 完整系统架构图

```
+--------------------------------------------------------------+
|                        用户终端                               |
|   +---------------------+    +----------------------------+  |
|   |  桌面端（Web）       |    |  手机端（Expo App）         |  |
|   |  apps/web/          |    |  apps/mobile/              |  |
|   |  Vite + React + TS  |    |  Expo Router + RN          |  |
|   +----------+----------+    +-------------+--------------+  |
+--------------|-----------------------------|-----------------+
               |    packages/api-client      |
               |      （统一 API 调用层）     |
               +--------------+--------------+
                              | HTTPS /api/*
                              v
+--------------------------------------------------------------+
|                    Netlify 平台                               |
|   +----------------+  +----------------------------------+   |
|   | 静态资源托管   |  | netlify/functions/（短任务<10s）  |   |
|   | apps/web/dist  |  |                                  |   |
|   +----------------+  | generate-image.ts  （Gemini）    |   |
|                        | openai-chat.ts    （OpenAI）     |   |
|                        | auth.ts           （JWT 鉴权）   |   |
|                        | billing.ts        （订单）       |   |
|                        | user.ts           （用户 CRUD）  |   |
|                        +---------------+------------------+   |
+-------------------------------|------------------------------+
                                |
         +----------------------+--------------------+
         v                      v                   v
+------------------+  +------------------+  +---------------------+
|  Gemini API      |  |  OpenAI API      |  |  VPS 服务器          |
|  （Google Cloud）|  |                  |  |  payment-server/    |
|  模型：          |  |  模型：          |  |                     |
|  gemini-2.5-     |  |  gpt-4o-mini     |  | - Stripe Webhook   |
|  flash-image     |  |                  |  | - BullMQ 队列       |
+------------------+  +------------------+  +---------+-----------+
                                                      |
                                            +---------v-----------+
                                            |  PostgreSQL 数据库  |
                                            |  （migrations/ 管理）|
                                            +---------------------+
```

---

## 5. 后端 API 路由表

所有路由定义在 netlify/functions/，前端通过 packages/api-client/ 调用。

| 路由 | 方法 | 文件位置 | 鉴权 | 功能说明 |
|------|------|----------|------|---------|
| /api/auth/login | POST | netlify/functions/auth.ts | 无 | 登录，返回 JWT |
| /api/auth/register | POST | netlify/functions/auth.ts | 无 | 注册新用户 |
| /api/auth/refresh | POST | netlify/functions/auth.ts | JWT | 刷新 token |
| /api/generate/image | POST | netlify/functions/generate-image.ts | JWT | Gemini 图像生成 |
| /api/generate/edit | POST | netlify/functions/generate-image.ts | JWT | Gemini 图像编辑 |
| /api/chat | POST | netlify/functions/openai-chat.ts | JWT | OpenAI 对话 |
| /api/user/me | GET | netlify/functions/user.ts | JWT | 获取当前用户信息 |
| /api/user/me | PATCH | netlify/functions/user.ts | JWT | 更新用户信息 |
| /api/billing/create-checkout | POST | netlify/functions/billing.ts | JWT | 创建 Stripe 支付会话 |
| /api/billing/plans | GET | netlify/functions/billing.ts | 无 | 获取定价方案 |
| /api/generations | GET | netlify/functions/generations.ts | JWT | 获取生成历史 |
| /webhook/stripe | POST | payment-server/routes/stripe.ts | Stripe 签名 | Stripe Webhook（VPS） |

**规则：**
- 新增 API 必须先更新本表，再写实现代码
- 所有需要鉴权的路由，Function 第一步必须验证 JWT

---

## 6. AI API 正确接入规范

### 6.1 Gemini API（图像生成/编辑）

**SDK：@google/genai（必须用这个，旧的 @google/generative-ai 已废弃）**

```typescript
// netlify/functions/generate-image.ts
// 职责：接收前端的图像生成请求，调用 Gemini API，返回生成的图像 base64

import { GoogleGenAI, Modality } from "@google/genai";
import type { Handler } from "@netlify/functions";
import { verifyJWT } from "../lib/auth";
import { z } from "zod";

// 初始化 Gemini 客户端，API Key 只能从后端环境变量读取
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// 定义请求参数的 schema，用 zod 做入参校验，防止非法输入
const RequestSchema = z.object({
  prompt: z.string().min(1).max(1000),           // 生成提示词，最长 1000 字
  referenceImageBase64: z.string().optional(),    // 可选：图像编辑时传入参考图
  aspectRatio: z.enum(["1:1", "16:9", "9:16"]).default("1:1"), // 输出比例
});

// 所有后端响应必须带这两个 header，缺一不可
// Content-Type 中的 charset=utf-8 是解决中文乱码的关键
const COMMON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

export const handler: Handler = async (event) => {
  // 第一步：验证 JWT，鉴权失败直接返回 401，不浪费后续资源
  const userId = await verifyJWT(event.headers.authorization);
  if (!userId) {
    return {
      statusCode: 401,
      headers: COMMON_HEADERS,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  // 第二步：校验请求参数，防止空 prompt 或超长输入
  const parsed = RequestSchema.safeParse(JSON.parse(event.body || "{}"));
  if (!parsed.success) {
    return {
      statusCode: 400,
      headers: COMMON_HEADERS,
      body: JSON.stringify(parsed.error.flatten()),
    };
  }
  const { prompt, referenceImageBase64 } = parsed.data;

  // 第三步：组装 contents 数组
  // Gemini 支持多模态输入，文字和图片可以混合传入
  const contents: any[] = [{ text: prompt }];
  if (referenceImageBase64) {
    // 图像编辑模式：把参考图和文字提示一起传给 Gemini
    contents.push({
      inlineData: { mimeType: "image/png", data: referenceImageBase64 },
    });
  }

  // 第四步：调用 Gemini（nano-banana 就是 gemini-2.5-flash-image 这个模型）
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",  // nano-banana 模型，必须填这个
      contents,
      config: {
        // 必须声明 responseModalities，否则 Gemini 不会返回图像数据
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    // 从响应中提取图像 part（Gemini 返回的是一个 parts 数组）
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p.inlineData);
    if (!imagePart?.inlineData) {
      throw new Error("Gemini 没有返回图像数据，可能是 prompt 被安全过滤拦截");
    }

    return {
      statusCode: 200,
      headers: COMMON_HEADERS,
      body: JSON.stringify({
        // 拼成标准的 data URI，前端可以直接用 <img src={image} /> 显示
        image: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
        // 有时候 Gemini 会同时返回文字说明
        text: parts.find((p: any) => p.text)?.text ?? "",
      }),
    };
  } catch (err: unknown) {
    // 后端记录完整错误信息（包括中文），方便排查
    console.error("[Gemini 生成失败]", err instanceof Error ? err.message : String(err));

    // 前端只看到脱敏后的英文错误，避免暴露内部实现细节
    return {
      statusCode: 500,
      headers: COMMON_HEADERS,
      body: JSON.stringify({ error: "Generation failed. Please try again." }),
    };
  }
};
```

**常见错误：**
- 错误：model: "gemini-pro-vision" -> 正确：model: "gemini-2.5-flash-image"
- 错误：缺少 responseModalities: [Modality.IMAGE] -> 后果：不返回图像
- 错误：在前端直接 fetch Google API 并传 key -> 后果：API Key 泄漏

### 6.2 OpenAI API（对话/文本）

**SDK：openai（官方 npm 包，不能手写 fetch）**

```typescript
// netlify/functions/openai-chat.ts
// 职责：接收前端的对话请求，调用 OpenAI API，返回 AI 回复

import OpenAI from "openai";
import type { Handler } from "@netlify/functions";
import { verifyJWT } from "../lib/auth";

// 初始化 OpenAI 客户端，Key 只能在后端
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// 统一响应头，必须带 charset=utf-8 防止中文乱码
const COMMON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

export const handler: Handler = async (event) => {
  // 先鉴权，再做任何操作
  const userId = await verifyJWT(event.headers.authorization);
  if (!userId) {
    return {
      statusCode: 401,
      headers: COMMON_HEADERS,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  const { messages } = JSON.parse(event.body || "{}");

  try {
    const completion = await openai.chat.completions.create(
      {
        // 模型名从环境变量读取，方便统一切换，默认用 gpt-4o-mini 节省费用
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages,
        max_tokens: 1000,
      },
      {
        // OpenAI 官方文档推荐加这个 header，便于支持排查线上问题
        headers: { "X-Client-Request-Id": crypto.randomUUID() },
      }
    );

    return {
      statusCode: 200,
      headers: COMMON_HEADERS,
      body: JSON.stringify(completion.choices[0].message),
    };
  } catch (err: any) {
    // 429 是速率限制，给用户友好提示，不要直接暴露技术细节
    if (err?.status === 429) {
      return {
        statusCode: 429,
        headers: COMMON_HEADERS,
        body: JSON.stringify({ error: "Rate limit reached. Please wait a moment." }),
      };
    }
    // 其他错误后端记录，前端只看到通用提示
    console.error("[OpenAI 调用失败]", err?.message);
    return {
      statusCode: 500,
      headers: COMMON_HEADERS,
      body: JSON.stringify({ error: "AI request failed." }),
    };
  }
};
```

---

## 7. 前端 API 调用层规范（packages/api-client）

**所有前端代码（桌面端 + 手机端）必须通过这一层调用后端，禁止直接写 fetch。**

```typescript
// packages/api-client/src/client.ts
// 职责：创建统一的 axios 实例，自动处理鉴权 token 和错误响应

import axios from "axios";

// 根据运行环境自动选择 baseURL
// 桌面端（Vite）用 VITE_PUBLIC_API_BASE_URL
// 手机端（Expo）用 EXPO_PUBLIC_API_BASE_URL
export const apiClient = axios.create({
  baseURL: typeof window !== "undefined"
    ? (import.meta.env?.VITE_PUBLIC_API_BASE_URL ?? "/api")
    : (process.env.EXPO_PUBLIC_API_BASE_URL ?? "/api"),
  timeout: 30000,
  headers: {
    // 请求头明确声明 UTF-8，防止中文乱码
    "Content-Type": "application/json; charset=utf-8",
    "Accept": "application/json; charset=utf-8",
  },
});

// 请求拦截器：每次请求自动附加 JWT token
// 桌面端从 localStorage 读，手机端从 expo-secure-store 读（在各端的 api-client 实例里配置）
apiClient.interceptors.request.use((config) => {
  const token = typeof localStorage !== "undefined"
    ? localStorage.getItem("token")
    : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：统一处理常见错误
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // token 过期或无效，触发重新登录
      // 清除本地 token，跳转登录页
    }
    if (err.response?.status === 429) {
      // 速率限制，提示用户稍后重试
    }
    return Promise.reject(err);
  }
);
```

**React Query hook 封装示例（桌面端和手机端共用）：**
```typescript
// packages/api-client/src/hooks/useGenerateImage.ts
// 职责：把图像生成 API 封装成 React Query mutation，自动管理 loading/error 状态

import { useMutation } from "@tanstack/react-query";
import { generateImage } from "../index";

export function useGenerateImage() {
  return useMutation({
    mutationFn: generateImage,
    onError: (err) => {
      // 错误统一在这里记录，组件里只需要判断 isError 就够了
      console.error("[useGenerateImage 调用失败]", err);
    },
  });
}
```

---

## 8. 环境变量规范

### 8.1 必须存在的环境变量

| 变量名 | 平台 | 是否可前端访问 | 用途 |
|--------|------|--------------|------|
| GEMINI_API_KEY | Netlify / VPS | 绝不可以 | Gemini API 认证 |
| OPENAI_API_KEY | Netlify / VPS | 绝不可以 | OpenAI API 认证 |
| DATABASE_URL | Netlify / VPS | 绝不可以 | PostgreSQL 连接字符串 |
| JWT_SECRET | Netlify / VPS | 绝不可以 | JWT 签发和验证 |
| STRIPE_SECRET_KEY | VPS | 绝不可以 | Stripe 支付 |
| STRIPE_WEBHOOK_SECRET | VPS | 绝不可以 | Stripe Webhook 验签 |
| INTERNAL_API_TOKEN | Netlify + VPS | 绝不可以 | Netlify 调用 VPS 的内部认证 |
| VPS_BASE_URL | Netlify | 绝不可以 | VPS 服务地址 |
| VITE_PUBLIC_API_BASE_URL | 桌面端 | 可以 | 桌面端 API 基础路径 |
| EXPO_PUBLIC_API_BASE_URL | 手机端 | 可以 | 手机端 API 基础路径 |
| OPENAI_MODEL | Netlify | 绝不可以 | 控制使用的 OpenAI 模型 |

### 8.2 前端环境变量命名规则
- 桌面端：必须以 VITE_PUBLIC_ 开头
- 手机端：必须以 EXPO_PUBLIC_ 开头
- 任何不以上述前缀开头的变量，前端代码不得访问

---

## 9. 设计系统规范（High-Fidelity SaaS）

### 9.1 核心设计令牌

```
background:      #FFFFFF  - 默认背景（纯白）
canvasMuted:     #F9FAFB  - 次级背景（Gray-50，用于交替区域）
foreground:      #111827  - 主要文字（Gray-900）
foregroundMuted: #6B7280  - 次要文字（Gray-500，用于副标题/描述）
borderGhost:     #E5E7EB  - 边框颜色（Gray-200，卡片/分隔线）
primary:         #2563EB  - 主操作色（Blue-600，主按钮/激活状态）
primarySoft:     #EFF6FF  - 软操作背景（Blue-50，次要按钮背景）
chartOrange:     #EA580C  - 数据可视化（Orange-600，进度环等）

字体：Inter（项目唯一字体）
```

### 9.2 桌面端组件规范

**卡片容器（必须严格使用，禁止加阴影）：**
```tsx
{/* 卡片容器：用边框定义层级，不用阴影 */}
<div className="bg-white rounded-xl border border-gray-200 p-6">
  <h2 className="text-base font-semibold text-gray-900">卡片标题</h2>
  <p className="text-sm text-gray-500 mt-1">卡片描述文字</p>
</div>
```

**Tab 导航（-mb-[1px] 是关键，让激活线精确覆盖底部分隔线）：**
```tsx
<div className="border-b border-gray-200 flex gap-6">
  {/* 激活状态：蓝色下边框，用 -mb-[1px] 精确覆盖灰色分隔线 */}
  <button className="text-gray-900 font-medium border-b-2 border-blue-600 pb-3 -mb-[1px] px-1 text-sm">
    激活标签
  </button>
  {/* 未激活状态：透明下边框，hover 时文字变深 */}
  <button className="text-gray-500 font-normal border-b-2 border-transparent hover:text-gray-700 pb-3 px-1 text-sm">
    未激活标签
  </button>
</div>
```

**三种 Pill 形态：**
```tsx
{/* Outline Pill：用于展示元数据、分类标签 */}
<span className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-700 inline-flex items-center gap-1.5">
  图像生成
</span>

{/* Soft Action Pill：用于次要操作按钮 */}
<button className="bg-blue-50 text-blue-600 rounded-full px-3 py-1.5 text-sm font-medium inline-flex items-center gap-1.5">
  AI 优化
</button>

{/* Status Pill：用于展示状态，带颜色圆点 */}
<span className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-700 inline-flex items-center gap-1.5">
  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
  运行中
</span>
```

**功能列表（必须用连字符，禁止 HTML bullet）：**
```tsx
{/* 列表项用 - 前缀，不用 list-disc 或 ul/li 的默认样式 */}
<li className="text-sm text-gray-600 py-1 flex items-start">
  <span className="text-gray-400 mr-2 shrink-0">-</span>
  批量图像处理
</li>
```

**主按钮：**
```tsx
<button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
  开始生成
</button>
```

### 9.3 手机端组件规范

```tsx
{/* 手机端卡片：用 borderWidth 替代 shadow */}
<View style={{
  backgroundColor: "#FFFFFF",
  borderRadius: 12,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  padding: 16,
}}>
  <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>标题</Text>
  <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>描述</Text>
</View>

{/* 手机端主按钮 */}
<TouchableOpacity style={{
  backgroundColor: "#2563EB",
  borderRadius: 8,
  paddingVertical: 12,
  paddingHorizontal: 16,
  alignItems: "center",
}}>
  <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>开始生成</Text>
</TouchableOpacity>
```

### 9.4 设计禁止项（AI 不得违反）

| 禁止 | 替代方案 |
|------|---------|
| shadow-sm / shadow-md 用于卡片 | border border-gray-200 |
| font-medium 用于标题 | font-semibold |
| font-light 用于正文 | font-normal |
| hover:scale-105 hover 动画 | hover:border-gray-300 颜色切换 |
| HTML bullet list-disc | 连字符 - 前缀 |
| 卡片上的 drop shadow | 只有浮层/Dropdown 可用 shadow |

---

## 10. 数据库 Schema 规范

```sql
-- migrations/001_init.sql
-- 用户表：存储用户基本信息、订阅方案和剩余额度
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',   -- 订阅方案：free / pro / team
  credits INTEGER NOT NULL DEFAULT 10, -- 剩余生成额度
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- migrations/002_generations.sql
-- 生成历史表：记录每次 AI 生成的详情
CREATE TABLE IF NOT EXISTS generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  image_url TEXT,
  model TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image',
  status TEXT NOT NULL DEFAULT 'pending', -- pending / done / failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- migrations/003_orders.sql
-- 订单表：记录支付订单，price 只存后端，单位是分（避免浮点精度问题）
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  stripe_session_id TEXT UNIQUE,           -- Stripe session ID，UNIQUE 保证幂等
  plan TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,           -- 金额，单位：分，后端查 DB 得到，前端不传
  status TEXT NOT NULL DEFAULT 'created',  -- created -> paid -> fulfilled
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**迁移文件规则：**
- 命名格式：NNN_描述.sql（三位数字前缀，例如 001_init.sql）
- 只增不减（不在迁移中 DROP 列，用 nullable 替代）
- 每个迁移必须幂等（用 IF NOT EXISTS）
- 禁止修改已有的迁移文件

---

## 11. 支付流程规范（防篡改）

```
前端                     Netlify Function           VPS（payment-server）
  |                           |                           |
  |-- GET /api/billing/plans ->                          |
  |   （获取展示价格）         |                           |
  |<-- [从 DB 读取定价] ------                           |
  |                           |                           |
  |-- POST /api/billing/create-checkout                  |
  |   { planId: "pro" }       |                          |
  |   （只传 planId，不传价格！）                         |
  |                           |-- 根据 planId 查 DB 得价格|
  |                           |-- 创建 Stripe Session    |
  |<-- { sessionUrl } --------|                          |
  |                           |                           |
  |-- 跳转 Stripe 支付页面    |                           |
  |                           |    Stripe Webhook ------->
  |                           |               验签        |
  |                           |           更新订单状态    |
  |                           |           orders.status  |
  |                           |           = 'paid'       |
```

**规则：**
- 前端只传 planId，不传任何金额
- 后端根据 planId 查数据库获取金额
- Stripe Webhook 必须验签：stripe.webhooks.constructEvent(body, sig, secret)
- 订单状态只能单向流转：created -> paid -> fulfilled

---

## 12. 安全清单（每次发布前执行）

```bash
# 扫描前端代码是否有 API Key 泄漏（结果必须为空）
grep -rE "(sk-|AIza|GEMINI_API_KEY|OPENAI_API_KEY)" apps/web/src apps/mobile/src

# 确认 .env 在 .gitignore 中
grep "^\.env$" .gitignore

# 确认缓存目录在 .gitignore 中
grep -E "\.npm-cache|release/" .gitignore
```

- [ ] 所有 Netlify Functions 第一步验证 JWT（除 auth 和 public 路由）
- [ ] Stripe Webhook 路由有签名验证
- [ ] netlify.toml 包含 CORS 白名单 header
- [ ] 所有 Response header 包含：Content-Type: application/json; charset=utf-8

---

## 13. 开发命令速查

```bash
npm install              # 安装所有依赖（monorepo）
npm run dev:web          # 启动桌面端开发服务器
npm run dev:mobile       # 启动手机端（需要 Expo Go 或模拟器）
npm run dev:functions    # 本地运行 Netlify Functions
npm run dev:payment      # 本地运行支付服务器
npm run db:migrate       # 运行数据库迁移
npm run test             # 运行全部测试
npm run build:web        # 构建桌面端生产包
npm run audit:keys       # 安全扫描，检查是否有泄漏的 API Key
```

---

## 14. 禁止 AI 做的操作

```
禁止：在 apps/web/ 或 apps/mobile/ 中直接 fetch 第三方 AI API
禁止：在任何代码文件中硬编码 API Key
禁止：在 netlify/functions/ 之外添加 HTTP handler
禁止：在 apps/mobile/ 中使用 window / document / localStorage
禁止：在 apps/web/ 中使用 React Native / Expo 组件
禁止：导入 @google/generative-ai（已废弃，改用 @google/genai）
禁止：在根目录新建 .md 文档（全部放 docs/）
禁止：在前端代码中使用无 VITE_PUBLIC_ 或 EXPO_PUBLIC_ 前缀的环境变量
禁止：在卡片/容器上使用 drop shadow（shadow-sm / shadow-md）
禁止：使用 font-light 作为正文，使用 font-medium 作为标题
禁止：在订单创建接口中接受前端传来的 price 字段
禁止：修改 migrations/ 中已有的迁移文件
禁止：在 Response body 中返回带中文的错误信息（中文只能在后端 console.error）
禁止：任何后端 Response 缺少 charset=utf-8
禁止：写没有中文注释的复杂逻辑代码
禁止：用英文回复用户（本项目以中文为主）
```

---

## 15. AI 操作前必做的三件事

在修改任何代码之前，AI 必须按顺序确认：

1. **确认平台**：我现在修改的是 apps/web（桌面端）、apps/mobile（手机端），还是 packages/（共享层）？
2. **确认 API 路径**：如果涉及 API 调用，是否走 packages/api-client/？handler 是否在 netlify/functions/ 中定义？
3. **确认安全**：这次修改会不会让任何密钥出现在前端代码中？

---

## 16. 代码规范（AI 生成的每行代码都必须符合）

---

### 16.1 注释规范（核心，必须执行）

**本项目所有代码注释必须用中文。注释要解释"为什么"和"这段代码在做什么"，让任何人看到注释就能理解意图。**

```typescript
// ===========================
// 正确的中文注释示例
// ===========================

// 正确：解释为什么，而不只是复述代码
// Gemini API 要求 base64 字符串不能带 "data:image/png;base64," 前缀
// 否则会报 400 错误，这是 Google 官方文档里的已知限制
const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

// 正确：复杂业务逻辑前加一段总结
// 整体流程：先鉴权 -> 再校验入参 -> 最后调 Gemini
// 顺序必须按这个来，鉴权放最前面可以在非法请求时节省 API 配额
export const handler: Handler = async (event) => { ... };

// 正确：标记已知问题或临时方案，注明何时可以移除
// TODO(2026-08): Gemini 3.0 发布后这个 workaround 可以移除
// 目前 gemini-2.5-flash-image 有时候会漏掉 text part，需要做空值保护
const textPart = parts.find((p: any) => p.text)?.text ?? "";

// 正确：JSDoc 用中文写，解释参数和返回值
/**
 * 创建 Stripe Checkout Session
 * @param planId - 订阅方案 ID（如 "pro"/"team"），后端根据此 ID 查 DB 确定价格
 * @returns Stripe 托管结账页面的 URL
 * @throws 如果 planId 在 DB 中不存在，抛出 404 错误
 */
export async function createCheckout(planId: string): Promise<string> { ... }

// ===========================
// 错误的注释示例（禁止这样写）
// ===========================

// 错误：英文注释
// Gemini requires base64 without data URI prefix
const base64Data = ...;

// 错误：废话注释（注释和代码说的是同一件事，没有附加信息）
// 把 loading 设为 true
setLoading(true);

// 错误：注释掉的旧代码（用 git 管理，不要留在代码里）
// const oldWay = fetch("/api/old-endpoint");
// const result = await oldWay.json();
```

**每个文件顶部必须有一行中文说明这个文件的职责：**
```typescript
// 职责：接收前端的图像生成请求，调用 Gemini API，返回生成图像的 base64 字符串
// 路由：POST /api/generate/image
// 鉴权：需要 JWT token
```

---

### 16.2 TypeScript 规范

**严格模式（所有 tsconfig.json 必须开启）：**
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**类型声明规则：**
```typescript
// 正确：函数参数和返回值明确声明类型
async function generateImage(prompt: string): Promise<GenerationResult> {}

// 错误：用 any（必须有 eslint 注释说明原因才能用）
function doSomething(data: any): any {}

// 正确：用 unknown 替代 any，再做类型收窄
function handleError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
```

**类型断言规则：**
```typescript
// 禁止：as any
const data = response as any;

// 禁止：! 非空断言（除非有注释说明为什么保证非空）
const el = document.getElementById("root")!;

// 正确：显式做空值判断
const el = document.getElementById("root");
if (!el) throw new Error("找不到根节点 #root，请检查 index.html");
```

---

### 16.3 命名规范

| 对象 | 规范 | 示例 |
|------|------|------|
| React/RN 组件 | PascalCase | GeneratePanel, ImageCard |
| 页面文件 | kebab-case | generate-image.tsx, user-profile.tsx |
| Hook | camelCase + use 前缀 | useGenerateImage, useUserProfile |
| 普通函数 | camelCase | formatDate, parseError |
| 常量 | UPPER_SNAKE_CASE | MAX_RETRY_COUNT, DEFAULT_MODEL |
| TypeScript 类型/接口 | PascalCase | GenerationResult, UserProfile |
| 数据库表名 | snake_case（复数） | users, generations, orders |
| 数据库列名 | snake_case | user_id, created_at, image_url |
| 环境变量 | UPPER_SNAKE_CASE | GEMINI_API_KEY, DATABASE_URL |
| API 路由 | kebab-case | /api/generate-image, /api/user-profile |

---

### 16.4 文件结构规范

**文件内代码顺序（必须按此顺序）：**
```typescript
// 1. 外部包 import（按字母排序）
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

// 2. 内部 packages/ import
import { generateImage } from "@nano-banana/api-client";
import type { GenerationResult } from "@nano-banana/shared/types";

// 3. 相对路径 import（从远到近）
import { ImageCard } from "../../components/ImageCard";

// 4. 本文件私有的类型定义
interface LocalState { prompt: string; }

// 5. 常量
const MAX_PROMPT_LENGTH = 1000;

// 6. 组件/函数主体
export default function GeneratePage() { ... }
```

**一个文件只能有一个导出组件：**
```typescript
// 错误：一个文件里导出多个组件
export function Header() { ... }
export function Footer() { ... }
export default function Page() { ... }

// 正确：拆分成 Header.tsx、Footer.tsx、Page.tsx
```

---

### 16.5 错误处理规范

**前端（桌面端 + 手机端）：**
```typescript
// 正确：用 React Query 的 isError + error 状态，不用 try/catch 包 UI 逻辑
const { mutate, isPending, isError, error } = useMutation({
  mutationFn: generateImage,
});

// 在 JSX 中展示错误
{isError && (
  <p className="text-sm text-red-600 mt-2">
    {error instanceof Error ? error.message : "生成失败，请重试"}
  </p>
)}

// 错误：吞掉错误，用户看不到任何反馈
try {
  await generateImage(prompt);
} catch (e) {
  console.log(e); // 用户完全不知道出错了
}
```

**后端（Netlify Functions）：**
- 后端 console.error 可以用中文记录详细错误
- 返回给前端的 Response body 只能是英文的脱敏信息
- 所有 Response 必须带 COMMON_HEADERS（含 charset=utf-8）

---

### 16.6 状态管理规范

| 场景 | 使用方案 |
|------|---------|
| 服务端数据（API 请求） | @tanstack/react-query（必须，禁止 useEffect+fetch） |
| 表单状态 | useState（简单）/ react-hook-form（复杂） |
| 单组件内 UI 状态 | useState |
| 跨组件共享 UI 状态 | zustand（最多 3 个 store） |
| URL 状态（筛选/分页） | URL query params via React Router |

```typescript
// 错误：用 useEffect + fetch 获取远程数据
useEffect(() => {
  fetch("/api/user/me").then(r => r.json()).then(setUser);
}, []);

// 正确：用 react-query
const { data: user } = useQuery({ queryKey: ["user"], queryFn: getMe });
```

---

### 16.7 CSS 样式规范

**桌面端（Tailwind 规则）：**
```tsx
// 正确：响应式用断点
<div className="flex flex-col md:flex-row gap-4">

// 错误：inline style 做布局
<div style={{ display: "flex", flexDirection: "column" }}>

// 错误：在组件文件里写 style 标签
<style>{`.card { ... }`}</style>
```

**手机端（StyleSheet 规则）：**
```tsx
// 正确：inline style 对象
<View style={{ flex: 1, padding: 16 }}>

// 错误：用 Tailwind className（React Native 不支持）
<View className="flex-1 p-4">
```

---

### 16.8 Git Commit 规范

**格式（Conventional Commits，描述部分用中文）：**
```
<type>(<scope>): <中文描述>

type:
  feat     - 新功能
  fix      - 修复 bug
  refactor - 重构（不改变功能）
  style    - 代码格式（不影响逻辑）
  docs     - 文档
  test     - 测试
  chore    - 构建/依赖/配置
  security - 安全修复

scope:
  web      - 桌面端
  mobile   - 手机端
  api      - Netlify Functions
  payment  - 支付服务
  shared   - 共享包
  db       - 数据库

示例：
  feat(web): 新增图像生成面板，接入 Gemini API
  fix(api): 所有响应头补充 charset=utf-8，解决中文乱码
  security(api): 把 API Key 从前端移到后端 Netlify Functions
  refactor(shared): 把 api-client 抽取为独立 package
  fix(mobile): 把 SafeAreaView 替换为 useSafeAreaInsets
```

**禁止的 commit message：**
```
错误："fix bug"
错误："update"
错误："修改了一些东西"
错误："asdfgh"
错误：空提交信息
```

---

### 16.9 编码与字符集规范（解决乱码问题）

**所有文件必须使用 UTF-8 编码，无 BOM。**

后端所有 Response 必须声明编码（这是解决乱码的根本）：
```typescript
// 所有 Netlify Function 的 return 必须带这个 header，缺一不可
const COMMON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};
```

Windows 开发环境（start.bat 第一行必须加）：
```bat
@echo off
chcp 65001 >nul
:: 65001 = UTF-8 代码页，解决 Windows cmd 中文乱码
```

PowerShell 等效写法：
```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
```

**错误信息处理规则：**
- 中文错误详情：只在后端 console.error，便于排查
- 返回给前端的 Response body：只用英文，脱敏处理
- 禁止用字符串拼接把 err.message 直接放进 Response body（可能含特殊字符引发乱码）

---

### 16.10 测试规范

**测试文件位置：**
```
tests/
├── unit/
│   ├── web/          <- 桌面端单元测试
│   ├── mobile/       <- 手机端单元测试
│   └── shared/       <- 共享层单元测试
├── integration/
│   └── api/          <- API 集成测试（Netlify Functions）
└── e2e/              <- 端到端测试（Playwright）
```

**必须覆盖的测试场景：**
```typescript
// 每个 Netlify Function 都必须有这些测试
describe("generate-image handler", () => {
  it("没有 token 时返回 401", async () => { ... });
  it("prompt 为空时返回 400", async () => { ... });
  it("正常调用返回 200 和图像数据", async () => { ... });
  it("Gemini 失败时不向前端暴露内部错误", async () => { ... });
  it("Response header 包含 charset=utf-8", async () => { ... });
});
```

---

最后更新：2026-05-25 | 版本：v4.0（中文版）
如有任何代码或文档与本文件冲突，以本文件为准。
