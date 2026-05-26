# nano-banana-KK 仓库审计与优化指南

> 审计仓库：<https://github.com/soudbs180-creator/nano-banana-KK->
> 审计日期：2026-05-25
> 审计基线 commit：`da168f2`（fix: 彻底修复网络连接与CORS报错并重构积分扣减及提示语状态机）
> 仓库版本：`1.4.9`
>
> ⚠️ 本文档是**审计报告**，不直接修改你的 GitHub 仓库代码。
> 你可以把每一节的"修改提示词"复制到 Claude Code / Cursor / Codex 里去执行。

---

## 目录

1. [总体评估](#1-总体评估)
2. [完整架构图（实际现状）](#2-完整架构图实际现状)
3. [文件结构问题清单](#3-文件结构问题清单)
4. [关键 BUG / 风险（必须立即修）](#4-关键-bug--风险必须立即修)
5. [后端 API 审计（对照官方文档）](#5-后端-api-审计对照官方文档)
6. [前端（Web + Mobile）审计](#6-前端web--mobile审计)
7. [VPS / 部署 / 联动审计](#7-vps--部署--联动审计)
8. [数据库 / Migrations](#8-数据库--migrations)
9. [安全审计](#9-安全审计)
10. [可直接用的修改提示词（Prompts）](#10-可直接用的修改提示词prompts)
11. [优先级路线图（P0/P1/P2）](#11-优先级路线图p0p1p2)

---

## 1. 总体评估

### 1.1 一句话结论

**整体架构方向是对的**（monorepo + Netlify Functions + VPS sidecar + 独立 PostgreSQL），AGENTS.md 制定的规范也非常完整。
**但实际代码与规范有明显出入**：出现了**两套**图像生成 API（Netlify Functions 一套 + VPS 一套），而且两套的**积分扣减规则不一致**，存在被前端绕过、双扣、重复实现的风险。这是当前最需要解决的核心问题。

### 1.2 评分（10 分制）

| 维度 | 评分 | 说明 |
|---|---|---|
| 架构方向 | 8 / 10 | monorepo、双端分离、API 收敛思路都对 |
| 规范文档（AGENTS.md） | 9 / 10 | 写得相当完整，超过大多数项目 |
| 实际代码与规范一致性 | **5 / 10** | 规范说"netlify/functions 外不得定义路由"，但 payment-server 里又写了 `/api/generate-image` |
| API 安全 | **5 / 10** | CORS `*` 全开、JWT 用 HMAC 自实现、密码盐写死 fallback |
| 文件结构整洁度 | **4 / 10** | 752 次提交里有大量"清理 / 收敛 / 整理"类 commit，说明结构反复来回 |
| 前后端联动 | 6 / 10 | api-client 已收敛，但前端代码里仍有遗留路径 |
| 测试覆盖 | 7 / 10 | 有 unit / integration / contract / e2e 四层，但都是 node --test |
| 工程化 / CI | 8 / 10 | governance、architecture、spec、verify 多脚本检查到位 |

---

## 2. 完整架构图（实际现状）

```
┌─────────────────────────────────────────────────────────────┐
│                          用户终端                            │
│  ┌──────────────────┐         ┌────────────────────────┐   │
│  │  桌面端 Web      │         │  手机端 Expo App        │   │
│  │  apps/web        │         │  apps/mobile            │   │
│  │  Vite+React+TS   │         │  Expo Router + RN       │   │
│  └────────┬─────────┘         └────────────┬────────────┘   │
└───────────┼──────────────────────────────────┼──────────────┘
            │                                  │
            └──────────┬───────────────────────┘
                       ▼
            ┌──────────────────────────┐
            │ packages/api-client      │  ← 统一 axios 实例
            │ (双端共用 HTTP 客户端)    │     baseURL 走 import.meta.env
            └────────────┬─────────────┘
                         │ HTTPS
        ┌────────────────┼─────────────────────┐
        ▼                                      ▼
┌───────────────────────────┐      ┌────────────────────────────┐
│ Netlify 平台              │      │ VPS（payment-server/）      │
│ kkai.plus                 │      │ 充值结算 + 图像生成中转      │
│                           │      │                            │
│ /api/auth/*  ─► auth.ts   │      │ /webhook/stripe            │
│ /api/chat    ─► openai-…  │      │ /api/generate-image  ⚠️    │
│ /api/generate/image       │      │   （和 Netlify 重复了！）   │
│   ─► generate-image.ts ⚠️ │      │                            │
│ /api/user/*  ─► user.ts   │      │ Express + node 24          │
│ /api/billing/*            │      │ CORS 白名单已配置 ✓         │
│ /api/generations          │      │                            │
│ /api/pricing-proxy        │      └─────────────┬──────────────┘
└─────────┬─────────────────┘                    │
          │                                      │
          ├─── Google Gemini API ◄───────────────┤
          │   (gemini-2.5-flash-image)           │
          │                                      │
          ├─── OpenAI API                        │
          │   (gpt-4o-mini)                      │
          │                                      │
          └──────────────────► PostgreSQL ◄──────┘
                              (migrations/)
```

### 2.1 流转链路（端到端）

**用户在桌面端点击「生成图像」时，目前会发生：**

1. `apps/web/src/components/...` 触发组件事件
2. 通过 `packages/api-client` 发起 `POST /api/generate/image`
3. Netlify 根据 `netlify.toml` 重写规则匹配到 `/.netlify/functions/generate-image`
4. `netlify/functions/generate-image.ts` 处理：JWT 校验 → 查积分 → 扣 1 积分 → 调 Gemini → 成功写库 / 失败退积分
5. 同时，`payment-server/generate-image.js` 也提供了 `POST /api/generate-image`，**扣 10 / 15 积分**

⚠️ **问题：步骤 4 和步骤 5 是两套独立实现，规则完全不一致（1 积分 vs 10/15 积分）。** 详见 [§4.1](#41-双重图像生成-api严重冲突)。

---

## 3. 文件结构问题清单

### 3.1 必须删除 / 合并的目录

| 路径 | 现状 | 处理建议 |
|---|---|---|
| `payment-server/generate-image.js` | 与 Netlify 版重复，规则不一致 | **删除**，或迁移 Netlify 版到此处后**删除 Netlify 版**（二选一） |
| `release/publish/stable/` | 发布产物提交到了仓库 | 移到 GitHub Releases / OSS，仓库里只保留 `manifest.json` |
| `temp/` | 临时目录被纳管 | `.gitignore` 已配 `temp/*`，但要确认实际无内容外泄 |
| `tools/` | 同 temp，工具目录 | 同上，已纳管，保留 README 即可 |
| `.codex-backups/` / `.codex-temp*/` / `.kk-local/` / `.npm-cache/` | 全在 `.gitignore` 里 | 检查历史中是否曾被提交（用 `git log --all -- ".npm-cache/*"`） |
| `scripts/dev/dev-launch.ps1` | PowerShell 脚本绑死 Windows | 出 `scripts/dev/dev-launch.sh` 对应 mac/linux 版本 |

### 3.2 命名 / 一致性问题

- **`payment-server` 现在已经承担「支付 + 图像生成中转」两个职责** —— 名字已经不准。建议改名 `apps/edge` 或 `services/edge-runtime`，或者把图像生成迁回 Netlify。
- **`.claude` 是唯一允许的 agent 目录，但根目录上次还有 `.codex-*` 残留**。AGENTS.md 第 7 节明确 "唯一 agent 配置目录"，要在 CI 里做强校验（已有 `governance:agent-docs`，但要确认它真的覆盖到了这一条）。
- **commits 用中文符合规范**，但有些 commit 信息过长，例如：`fix: 彻底修复网络连接与CORS报错并重构积分扣减及提示语状态机` —— 一个 commit 包含多个独立的修复，违反"单一职责"，建议拆成 3 个 commit。

### 3.3 文档碎片化

- `AGENTS.md` 在根目录（合规）
- 但仓库还有 `DESIGN.md`、`PROJECT_ROOT_GUIDE.md`、`implement.md`、`plans.md`、`status.md` 这类根目录散落 .md
- AGENTS.md 第 0 节明确 "**绝不**在根目录新建 .md 文档，文档统一放 docs/"
- **现状违反了自己定的规则**，需要把这些文件迁移到 `docs/` 并在 `docs/README.md` 做总索引

---

## 4. 关键 BUG / 风险（必须立即修）

### 4.1 双重图像生成 API（严重冲突）

**现状**：

| 维度 | `netlify/functions/generate-image.ts` | `payment-server/generate-image.js` |
|---|---|---|
| 路由 | `POST /api/generate/image`（Netlify 重写） | `POST /api/generate-image`（VPS Express） |
| 扣减积分 | **写死 1 积分** | 普通 10 / 编辑 15 |
| 入参校验 | **没有 zod 校验**（直接 `JSON.parse`） | 有 zod schema |
| 是否支持"用户自带 API Key" | ❌ 不支持 | ✓ 支持（`creditSettlement: 'client'`） |
| CORS | `*` 全开 | 白名单 |
| 日志字段 | `(user_id, prompt, image_url, status, model)` | `(user_id, prompt, image_url, model, type)` 字段名不一致 |
| 失败退款 | ✓ | ✓ |

**风险**：

1. 同样一次生成请求，走 Netlify 还是 VPS，扣的积分差 10 倍，**完全取决于 `netlify.toml` 的重写规则**和前端构建时的 `VITE_PUBLIC_API_BASE_URL`
2. 攻击者可以挑便宜的那个路由刷
3. 数据库 `generations` 表里两套写法会让历史记录混乱（一边有 `status`，一边有 `type`）

**正确做法（推荐）**：
**只保留 VPS 那一套**（因为它功能更完整：有 zod、有自带 key 模式、有比例支持），然后：
- 把 `netlify.toml` 里 `/api/generate/image` 和 `/api/generate-image` 全部 proxy 到 VPS 的 `https://<vps-domain>/api/generate-image`
- 删除 `netlify/functions/generate-image.ts`
- 在 `migrations/` 里加一条迁移补齐 `generations` 表的字段统一（详见 §8）

### 4.2 CORS 配置矛盾

- `netlify/functions/generate-image.ts`、`openai-chat.ts`、`auth.ts` 全部用了 `Access-Control-Allow-Origin: *`
- 但 `payment-server/index.js` 用了**白名单**（`kkai.plus` 等）
- 用户最新 commit 标题写的是 "彻底修复 ... CORS 报错"，但其实是**用 `*` 暴力压平了所有问题**
- **后果**：任何第三方网站都可以从浏览器调你的 Netlify Functions

**正确做法**：
Netlify Functions 也走白名单，把 `payment-server/index.js` 里的 `DEFAULT_ALLOWED_ORIGINS` 抽到 `packages/shared/src/cors.ts`，两端复用。

### 4.3 JWT 自实现 + 密钥写死 fallback

- `payment-server/generate-image.js` 第 17 行：
  ```js
  const JWT_SECRET = process.env.JWT_SECRET || "nano-banana-kk-super-secret-fallback-token-key-9988";
  ```
- `netlify/functions/auth.ts` 同样：
  ```ts
  const PASSWORD_SALT = process.env.PASSWORD_SALT || "nano-banana-default-salt-key-8899";
  ```
- 这些 fallback 已经在**公开仓库**里了，等于任何人都能：
  - 知道你的 JWT 签名密钥（如果 env 没配）
  - 知道你的密码加盐（用于撞库 / 彩虹表）

**正确做法**：
- 启动时 `if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET 未配置，拒绝启动')`
- 同理 `PASSWORD_SALT`
- **现有的 fallback 值视为已经泄漏，必须在生产环境换掉且强制要求 env 设置**

### 4.4 密码哈希用 HMAC-SHA256（强度不足）

`netlify/functions/auth.ts`：

```ts
function hashPassword(password: string): string {
  return crypto.createHmac("sha256", PASSWORD_SALT).update(password).digest("hex");
}
```

- **HMAC-SHA256 不是密码哈希算法**，它是消息认证码
- 没有 per-user salt（所有用户共用 `PASSWORD_SALT`）
- 一旦数据库泄露 + salt 泄露，GPU 可以一秒撞几亿次
- AGENTS.md 把 `argon2` 列入了允许的后端包，但代码里没用

**正确做法**：用 `argon2id`，per-user salt，存哈希字符串本身就含 salt。

### 4.5 前端可能仍有第三方 AI 直连残留

最近的 commit `3cd73c9` "security(web): 移除前端第三方 AI 直连"说明**之前**前端是直连过 Gemini/OpenAI 的。
- AGENTS.md 第 0 节规则 4：**绝不**在前端直接请求第三方 AI API
- 这条规则之前被破坏过 —— 现在虽然有移除 commit，但要做**全仓 grep 验证**：
  ```bash
  grep -rni "generativelanguage.googleapis.com\|api.openai.com" apps/web apps/mobile packages/api-client
  ```
- 同时要查 `localStorage` / `sessionStorage` 里是不是还存过用户的 API Key

---

## 5. 后端 API 审计（对照官方文档）

### 5.1 Gemini API 接入对照

依照 [Gemini API 官方文档](https://ai.google.dev/api/generate-content?hl=zh-cn) 和 [快速入门](https://ai.google.dev/gemini-api/docs/quickstart?hl=zh-cn)，逐项检查：

| 官方推荐 | 你的代码 | 状态 |
|---|---|---|
| 用 `@google/genai`（新 SDK） | ✓ 使用了 | ✅ |
| `model: "gemini-2.5-flash-image"`（图像模型） | ✓ | ✅ |
| `responseModalities: [Modality.IMAGE, Modality.TEXT]` | 用了字符串 `"IMAGE"` 而不是 `Modality.IMAGE` enum | ⚠️ 能跑但不规范 |
| API Key 仅在后端 | ✓ | ✅ |
| 不在 base64 里带 `data:image/...;base64,` 前缀 | ✓ 用 `replace(/^data:image\/\w+;base64,/, "")` 去掉了 | ✅ |
| `aspectRatio` 字段 | VPS 版传了，Netlify 版**没传** | ⚠️ |
| 错误处理：把 `response.promptFeedback.blockReason` 区分出来 | 没区分（被安全过滤和真错误用同一句话） | ⚠️ |
| 流式响应 `generateContentStream`（生成体验更好） | 没用 | ⚠️ 优化项 |
| 设置 `safetySettings` 避免错误拦截 | 没设置 | ⚠️ |
| 重试机制（429 / 503） | 没有 | ⚠️ |
| 记录 `usage_metadata`（用于计费分析） | 没记 | ⚠️ |

**结论**：能跑，但离生产级还差以下几条 → 见提示词 P-API-01、P-API-02。

### 5.2 OpenAI API 接入对照

依照 [OpenAI API Reference](https://developers.openai.com/api/reference/overview)：

| 官方推荐 | 你的代码 | 状态 |
|---|---|---|
| 用官方 `openai` npm 包 | ✓ | ✅ |
| `X-Client-Request-Id` 用于追踪 | ✓（每次 `crypto.randomUUID()`） | ✅ |
| 429 单独处理 | ✓ | ✅ |
| `max_tokens` 限制成本 | ✓ 1000 | ✅ |
| 使用 Bearer Token（SDK 自动） | ✓ | ✅ |
| 区分 `system` / `user` / `assistant` 角色 | ✓（zod 校验） | ✅ |
| 记录 `completion.usage.total_tokens` | ❌ | ⚠️ |
| 流式 `stream: true`（对话体验） | ❌ | ⚠️ |
| 把模型版本固定（避免 OpenAI 默默升级） | 默认 `gpt-4o-mini`，可配 | ✅ |
| 工具调用 / Function calling 支持 | ❌ | 暂时不需要 |

**结论**：基础接入合格，主要差**流式响应**（极大提升用户体验）和**token usage 记账**。

### 5.3 后端共性问题

1. **没有限流**：Netlify Functions 自带 100 req/IP/10s 的基础限制，但 VPS 没有。建议加 `express-rate-limit`（你的 `overrides` 里已经锁了版本，但没装包）。
2. **没有日志追踪号串联**：前端的 `X-Client-Request-Id` 没在后端日志里打印出来，排查问题时无法串起来。
3. **错误响应格式不统一**：有的返回 `{error: "..."}`，有的返回 `{error: "...", code: "..."}`。建议定一个 `ErrorResponse` 类型放 `packages/shared`。
4. **超时**：Netlify Functions 默认 10s，但图像生成可能需要 15-30s。Gemini 慢的时候会直接 504。**这就是为什么要迁移到 VPS** —— Netlify Functions Background 又有 15 分钟限制但是计费贵。

---

## 6. 前端（Web + Mobile）审计

### 6.1 桌面端 apps/web

**没拿到完整的源码列表（GitHub 树状目录加载有限），但从 commit 和文档推断**：

- 用了 React 19、Vite 8、TypeScript 6（都是非常新的版本）
- React Router v7（默认 `data` mode）
- antd 6 + tailwind 4（**两个 UI 库混用是大忌**）—— 见下方建议
- framer-motion、gsap、motion 三个动画库（**只需要保留一个**，全 motion 或全 framer-motion）

### 6.2 手机端 apps/mobile

- Expo Managed Workflow（合规）
- 与桌面端目录完全分离（合规）
- 共享层走 `packages/api-client`、`packages/shared`（合规）

### 6.3 共性建议

1. **去掉重复依赖**：`framer-motion` 和 `motion` 是同一个库的两个名字 / 两个版本，**保留 `motion` 就好**（v12 之后官方名字）。
2. **antd vs Tailwind**：你制定了一份高保真 SaaS 设计系统（Inter + Ghost Border + 蓝色行动色），**这套设计语言用 antd 6 实现会非常拧巴**（antd 默认是更圆润、阴影更重的视觉）。建议：
   - 桌面端逐步从 antd 迁移到 Tailwind + 你设计系统里那套 Pill / Card / Tab 原语
   - 或者在 ConfigProvider 里全局压平 antd 的样式（去阴影、改半径、改色板）
3. **三个动画库**：保留 `motion` + `gsap`（前者负责组件级动画，后者负责复杂时间轴），**删除 `framer-motion`**。

---

## 7. VPS / 部署 / 联动审计

### 7.1 部署链路

```
本地开发
  ├─ npm run dev              (apps/web 起 Vite)
  ├─ npm run dev:start        (PowerShell 脚本，仅 Windows 可用 ⚠️)
  └─ payment-server 单独跑    (cd payment-server && npm start)

CI（.github/workflows）
  ├─ verify:changes           (架构 / 治理 / 类型 / 测试 / build)
  └─ governance               (版本 / 文档 / 兼容 / 安全 4 项检查)

发布
  ├─ Netlify ─── 自动从 main 分支拉 build
  └─ VPS    ─── ⚠️ 没看到自动化部署脚本，疑似手工 scp
```

### 7.2 风险点

1. **VPS 部署没有 CI/CD**：每次更新 `payment-server` 要 SSH 上去 git pull + pm2 restart，容易和 Netlify 部署版本错位。
2. **版本对齐机制是脚本式的**：`governance:version` 脚本检查所有 package.json 的 version 字段必须一致（都是 1.4.9），但没有跨服务的契约测试。如果 Netlify 部署成功了 VPS 部署失败，前端按 1.4.9 的契约调，VPS 还是 1.4.8 ——直接挂。
3. **没有蓝绿 / 灰度**：直接覆盖。建议 VPS 上 pm2 起两个实例 + nginx 切流。
4. **环境变量来源不统一**：
   - Netlify：在 Netlify 后台配
   - VPS：在 `payment-server/.env`
   - **没有单一来源**。建议用 [Doppler](https://www.doppler.com/) / [Infisical](https://infisical.com/) 做密钥同步。

### 7.3 Stripe Webhook 验签

`payment-server/index.js` 第 47-52 行用 `verify` 钩子保留了 `rawBody`，写法正确 ✅。但要验证 `webhook.js` 里真的用了 `req.rawBody` 而不是 `JSON.stringify(req.body)`。

---

## 8. 数据库 / Migrations

### 8.1 字段不一致问题（来自 §4.1）

`generations` 表被两个文件以不同字段集写入：

```sql
-- Netlify Functions 版本
INSERT INTO generations (user_id, prompt, image_url, status, model)

-- VPS 版本
INSERT INTO generations (user_id, prompt, image_url, model, type)
```

`status` 和 `type` 是两套语义，必须二选一或合并。

### 8.2 建议的迁移文件

```sql
-- migrations/20260525_unify_generations_schema.sql
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'done',
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'image_generation',
  ADD COLUMN IF NOT EXISTS credits_cost INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_generations_user_created
  ON public.generations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generations_request
  ON public.generations(request_id);
```

### 8.3 缺少的表

- **`credit_transactions`**（每次扣 / 退积分的流水）：目前直接 `UPDATE users SET credits = ...`，**没有审计日志**。如果用户投诉"为什么扣了我 10 积分"，你查不出来。
- **`user_api_keys`**（用户自带的 Gemini/OpenAI Key 加密存储）：因为 VPS 版支持 `creditSettlement: 'client'`，但代码里没看到 Key 是怎么传的（应该不是每次请求都从前端传明文吧？）。

---

## 9. 安全审计

| 风险 | 等级 | 说明 |
|---|---|---|
| `JWT_SECRET` fallback 写死在公开仓库 | 🔴 高 | §4.3 |
| `PASSWORD_SALT` fallback 写死在公开仓库 | 🔴 高 | §4.3 |
| CORS `*` 全开 | 🟠 中 | §4.2 |
| 密码用 HMAC-SHA256 而非 argon2 | 🟠 中 | §4.4 |
| 前端历史上直连过第三方 AI | 🟠 中 | §4.5（待全仓 grep 确认） |
| 用户自带 API Key 的存储方式不明 | 🟠 中 | §8.3 |
| 没有 rate limit | 🟡 低 | §5.3 |
| 没有 Turnstile 真正接入到关键路由 | 🟡 低 | `.env.example` 里有 site key，但代码里要确认 |
| .env.example 里的 fallback 仅供示意，但建议加 `⚠️ 不要使用这些值` 红字提醒 | 🟡 低 | — |

---

## 10. 可直接用的修改提示词（Prompts）

> 把下面任意一条提示词整段复制，粘贴到 Claude Code / Cursor Composer / Codex CLI 里，AI 会按指令直接改你仓库的代码。
> 每条提示词都已经写明了**目标文件、修改目标、验收标准**。

---

### P-API-01 · 合并双重图像生成 API（最高优先级）

```prompt
任务：合并 netlify/functions/generate-image.ts 和 payment-server/generate-image.js，保留 VPS 版作为唯一实现。

【必须严格遵守 AGENTS.md 的所有规则，所有注释用中文】

具体步骤：
1. 阅读 netlify/functions/generate-image.ts 和 payment-server/generate-image.js，确认 VPS 版功能更完整（zod 校验、用户自带 key、宽高比、10/15 积分规则）。
2. 删除 netlify/functions/generate-image.ts。
3. 修改 netlify.toml，把 /api/generate/image、/api/generate-image、/api/generate/edit 全部 proxy 到 VPS：
   from = "/api/generate-image"
   to = "https://<读取环境变量 VPS_BASE_URL>/api/generate-image"
   status = 200
   force = true
   注意：Netlify redirect 必须用 force=true 才会真的转发到外部域名。
4. 修改 packages/api-client/src/api.ts，确保图像生成调的是统一的 /api/generate-image，并把 creditSettlement 字段做成可选入参。
5. 在 docs/API_MIGRATION_2026_05.md 写一份变更说明（中文），列出：
   - 旧路由 → 新路由映射
   - 旧扣减规则（1 积分）→ 新扣减规则（10/15 积分）的影响
   - 回滚方法
6. 在 tests/integration/ 下新增一个测试，模拟前端调用 /api/generate-image，断言 VPS 收到了正确的 payload。

验收标准：
- 仓库里不再存在两个 generate-image 实现
- netlify.toml 没有 generate-image 指向 .netlify/functions/
- npm run typecheck 通过
- npm run test:integration 通过
- 数据库 generations 表的写入字段统一为 (user_id, prompt, image_url, model, type, status, credits_cost, request_id, created_at)
```

---

### P-API-02 · Gemini API 升级到生产级

```prompt
任务：把 payment-server/generate-image.js 里 Gemini 调用升级到符合官方推荐的生产级写法。

【所有注释中文，遵守 AGENTS.md】

具体修改：
1. 把硬编码的 "IMAGE"、"TEXT" 字符串改成从 @google/genai 导入的 Modality 枚举：
   const { GoogleGenAI, Modality } = await import('@google/genai');
   responseModalities: [Modality.IMAGE, Modality.TEXT]
2. 加上 safetySettings，避免普通图像被错误拦截：
   safetySettings: [
     { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
     { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
     { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
     { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
   ]
3. 在 catch 块里区分 promptFeedback.blockReason、429 限流、503 服务不可用 三种错误，分别返回不同的 statusCode 和文案：
   - blockReason: 422 "Content blocked by safety filter."
   - 429: "Rate limit. Please retry in {retryAfter}s."
   - 503/超时: 503 "Upstream busy. Please retry."
   - 其它: 500
4. 在成功返回时，把 response.usageMetadata 写入 generations.usage_metadata（JSONB 字段，需要先在 migrations/ 加一条迁移）。
5. 把 X-Client-Request-Id 从 req.headers 读取并写入数据库 generations.request_id 字段，便于客服查单。
6. 加重试：对 429/503 用指数退避重试 2 次（首次 500ms，第二次 1500ms）。
7. 单元测试：tests/unit/generate-image.test.ts 增加三个场景：safety blocked、rate limited、success 写入 usage_metadata。

验收标准：
- 仓库 grep '"IMAGE"' payment-server/generate-image.js 无结果（必须用 Modality 枚举）
- 数据库 generations 表新增 usage_metadata jsonb、request_id text 列
- npm run test:unit 通过
- 手动测试一次违规 prompt（例如政治敏感词），返回 422 而不是 500
```

---

### P-API-03 · OpenAI Chat 升级（流式 + token 记账）

```prompt
任务：把 netlify/functions/openai-chat.ts 升级为流式响应 + token 用量记账。

【所有注释中文】

具体修改：
1. 改用 OpenAI Streaming（Server-Sent Events）：
   const stream = await openai.chat.completions.create({
     model,
     messages,
     max_tokens: 1000,
     stream: true,
     stream_options: { include_usage: true },
   });
2. Netlify Functions 不支持原生 streaming（要用 background 函数或边缘函数），所以这一条要做技术选型：
   方案 A：把 openai-chat 迁移到 payment-server（VPS 长连接）
   方案 B：改用 Netlify Edge Functions（apps/web/netlify/edge-functions/openai-chat.ts）
   推荐方案 B，因为延迟更低。
3. 在 SSE 流结束时，从 usage 字段读出 prompt_tokens、completion_tokens、total_tokens，写入新建的 token_usage 表：
   CREATE TABLE public.token_usage (
     id BIGSERIAL PRIMARY KEY,
     user_id TEXT NOT NULL,
     model TEXT NOT NULL,
     prompt_tokens INTEGER NOT NULL,
     completion_tokens INTEGER NOT NULL,
     total_tokens INTEGER NOT NULL,
     request_id TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
4. 前端 packages/api-client/src/api.ts 提供一个 chatStream(messages, onChunk, onDone) 的 API。
5. apps/web 的对话页面用 EventSource 或 fetch ReadableStream 渲染逐字效果。

验收标准：
- 用户对话时看到逐字打字效果
- 数据库 token_usage 表有完整流水
- 关闭浏览器时 SSE 能正确清理（无内存泄漏）
- npm run test:contract 里新增 chat-stream.test.ts
```

---

### P-SEC-01 · 强制 env，移除所有 fallback 密钥

```prompt
任务：移除所有写死在代码里的 JWT_SECRET、PASSWORD_SALT、INTERNAL_API_TOKEN 的 fallback 值。启动时如果 env 缺失就直接 throw。

【所有注释中文】

修改清单：
1. netlify/functions/auth.ts：删除 PASSWORD_SALT 的 fallback "nano-banana-default-salt-key-8899"，改用：
   const PASSWORD_SALT = process.env.PASSWORD_SALT;
   if (!PASSWORD_SALT) throw new Error('PASSWORD_SALT 未配置，拒绝启动');
2. payment-server/generate-image.js：同上去掉 JWT_SECRET 的 fallback。
3. 创建 packages/shared/src/env.ts，导出 requireEnv(name: string) 工具函数，所有后端文件统一调用。
4. 在 .env.example 顶部加入红字警告：
   # ⚠️ 警告：本文件中的所有占位值仅供本地开发示意，生产环境绝不能使用！
   # ⚠️ 如果你正在生产环境部署，必须为每个 *_SECRET / *_SALT / *_TOKEN 设置真正随机的值
   # ⚠️ 可用 `openssl rand -base64 32` 或 `node -e "console.log(crypto.randomBytes(32).toString('hex'))"` 生成
5. 把现在仓库里所有曾经出现过的 fallback 字符串（"nano-banana-kk-super-secret-fallback-token-key-9988"、"nano-banana-default-salt-key-8899"）加入 docs/SECURITY_INCIDENT_2026_05.md，说明这些值已视为公开泄漏，必须在生产环境换掉。

验收标准：
- grep -rn 'nano-banana-default-salt-key\|nano-banana-kk-super-secret-fallback' . 只在 docs/SECURITY_INCIDENT_2026_05.md 里出现
- 后端服务在 .env 缺失关键变量时拒绝启动
- npm run governance:security 增加一条规则：禁止任何 process.env.XXX || "字符串字面量" 写法
```

---

### P-SEC-02 · 升级密码哈希到 argon2

```prompt
任务：把 netlify/functions/auth.ts 的密码哈希从 HMAC-SHA256 升级到 argon2id，per-user salt。

【中文注释】

具体步骤：
1. 安装 argon2（已经在 AGENTS.md 允许的后端依赖白名单中）。
2. 重写 hashPassword 和 verifyPassword：
   import argon2 from 'argon2';
   async function hashPassword(plain: string) {
     return argon2.hash(plain, {
       type: argon2.argon2id,
       memoryCost: 19456,  // 19 MiB（OWASP 推荐）
       timeCost: 2,
       parallelism: 1,
     });
   }
   async function verifyPassword(hash: string, plain: string) {
     try { return await argon2.verify(hash, plain); }
     catch { return false; }
   }
3. 写一份迁移 migrations/20260525_password_rehash.sql：
   - 给 users 表加 password_hash_algo 列（默认 'hmac-sha256-legacy'）
   - 不删除老的 password_hash，登录时先用 argon2 验，失败再 fallback 老算法
   - 登录成功后异步把老哈希升级成 argon2，并把 password_hash_algo 改为 'argon2id'
4. 写迁移说明 docs/MIGRATION_PASSWORD_HASH.md，说明：
   - 老用户首次登录后会自动升级
   - 60 天后下线 HMAC fallback
   - 已锁定的用户（password_hash_algo='hmac-sha256-legacy' 且 last_login_at < 60 天前）强制走密码重置

验收标准：
- 新注册用户立即用 argon2
- 老用户首次登录后 password_hash_algo 变为 'argon2id'
- npm run test:integration 新增 auth-password-rehash.test.ts 覆盖三种场景
```

---

### P-SEC-03 · 收敛 CORS 配置

```prompt
任务：把 CORS 配置从「Netlify Functions 全开 + VPS 白名单」统一为「双端白名单」。

【中文注释】

具体步骤：
1. 创建 packages/shared/src/cors.ts，导出：
   export const ALLOWED_ORIGINS = [
     'https://kkai.plus',
     'https://www.kkai.plus',
     // 仅生产
   ];
   export const DEV_ORIGINS = [
     'http://localhost:3000', 'http://127.0.0.1:3000',
     'http://localhost:5173', 'http://127.0.0.1:5173',
     'http://localhost:8888', 'http://127.0.0.1:8888',
   ];
   export function resolveCorsHeaders(originHeader: string | undefined, isDev: boolean) {
     const allowed = [...ALLOWED_ORIGINS, ...(isDev ? DEV_ORIGINS : [])];
     const origin = originHeader && allowed.includes(originHeader) ? originHeader : '';
     return {
       'Access-Control-Allow-Origin': origin,
       'Access-Control-Allow-Credentials': 'true',
       'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Client-Request-Id',
       'Access-Control-Allow-Methods': 'POST, GET, PATCH, OPTIONS',
       'Vary': 'Origin',
     };
   }
2. netlify/functions/* 全部改为：
   const corsHeaders = resolveCorsHeaders(event.headers.origin, process.env.NODE_ENV !== 'production');
   const COMMON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders };
3. payment-server/index.js 改为引用同一份白名单（注意：CommonJS 不能直接 import shared，要么改 shared 双发包，要么 payment-server 也走 ESM）。
4. 增加 governance:cors 检查脚本：grep 'Access-Control-Allow-Origin' netlify/functions payment-server，如果出现 "*" 直接 fail。

验收标准：
- 用 curl 模拟从 https://evil.com 调 /api/auth/login，被拒绝（响应里没有 Access-Control-Allow-Origin）
- 从 https://kkai.plus 调通过
- 从 http://localhost:5173（开发态）通过
```

---

### P-DB-01 · 加积分流水表 + 字段统一

```prompt
任务：建立 credit_transactions 表记录所有积分变动，并统一 generations 表字段。

【中文注释】

迁移文件 migrations/20260525_credit_audit.sql：
1. 新建积分流水表：
   CREATE TABLE public.credit_transactions (
     id BIGSERIAL PRIMARY KEY,
     user_id TEXT NOT NULL,
     amount INTEGER NOT NULL,                 -- 正数加积分，负数扣积分
     reason TEXT NOT NULL,                    -- 'image_generation' / 'image_edit' / 'chat' / 'recharge' / 'refund'
     reference_id TEXT,                       -- 关联的 generation_id 或 stripe_session_id
     balance_after INTEGER NOT NULL,          -- 流水后的余额，可校验
     request_id TEXT,                         -- 客户端 X-Client-Request-Id，便于排查
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   CREATE INDEX idx_credit_tx_user_created ON public.credit_transactions(user_id, created_at DESC);

2. 统一 generations 表：
   ALTER TABLE public.generations
     ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'done',
     ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'image_generation',
     ADD COLUMN IF NOT EXISTS credits_cost INTEGER NOT NULL DEFAULT 0,
     ADD COLUMN IF NOT EXISTS request_id TEXT,
     ADD COLUMN IF NOT EXISTS error_message TEXT,
     ADD COLUMN IF NOT EXISTS usage_metadata JSONB;

3. 改写 payment-server/generate-image.js 的扣 / 退 / 写入逻辑，所有 UPDATE users SET credits = ... 之后都必须 INSERT 一条对应的 credit_transactions 流水。

4. 加 SQL 一致性检查脚本 scripts/governance/check-credit-consistency.mjs：
   - SELECT user_id, SUM(amount) FROM credit_transactions GROUP BY user_id;
   - 对比 users.credits，如果有偏差列出来报警。

验收标准：
- 每次扣积分都能在 credit_transactions 找到对应流水
- npm run governance:check 增加一项 check-credit-consistency
- 客服查"我为什么被扣 10 积分"可以根据 user_id + 时间反查到对应的 generation_id 和 request_id
```

---

### P-STRUCT-01 · 整理根目录文档

```prompt
任务：把根目录散落的 .md 文档全部迁移到 docs/，并建立中文索引。

【中文注释 / 文档】

具体步骤：
1. 把以下文件 git mv 到 docs/：
   - DESIGN.md → docs/DESIGN.md
   - PROJECT_ROOT_GUIDE.md → docs/PROJECT_ROOT_GUIDE.md
   - implement.md → docs/IMPLEMENTATION_LOG.md
   - plans.md → docs/PLANS.md
   - status.md → docs/STATUS.md
2. 保留根目录的 AGENTS.md（这是规范要求）和 README.md（如果存在，目前 GitHub 上看不到，要补一份）。
3. 创建 docs/README.md 作为总索引，按主题分组：
   - 📐 架构与设计：DESIGN.md, PROJECT_ROOT_GUIDE.md
   - 📋 计划与实现：PLANS.md, IMPLEMENTATION_LOG.md
   - 📊 状态：STATUS.md
   - 🔐 安全：SECURITY_INCIDENT_2026_05.md
   - 🔄 迁移：MIGRATION_*.md
   - 📡 API：API_MIGRATION_*.md
4. 在 README.md 根目录补一段，明确：
   - 项目是什么（一句话）
   - 怎么本地起服务（npm i + npm run dev + cd payment-server && npm start）
   - 怎么部署
   - 完整文档入口（docs/README.md）
5. 增强 governance:agent-docs 脚本：如果根目录出现非白名单 .md 文件就 fail。

验收标准：
- 根目录 .md 只有：AGENTS.md, README.md, LICENSE（如有）
- docs/README.md 是清晰的中文目录
- npm run governance:agent-docs 通过
```

---

### P-STRUCT-02 · 删除发布产物 / 双胞胎依赖

```prompt
任务：清理根 package.json 的依赖、清理 release 产物。

【中文注释】

具体步骤：
1. 删除以下重复依赖：
   -