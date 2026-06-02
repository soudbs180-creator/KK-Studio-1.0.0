# AGENTS.md — KK-Studio 项目全量开发规范与架构黄金法则

<!-- AGENTS.md - AI Agent 项目总指导文件 -->

> **本文件是 KK-Studio 项目唯一权威指导文件。**
> 所有开发者（人类或 AI Agent）在进行任何功能开发、重构、维护、代码审查前，必须完整阅读并严格遵守本规范。
> 违反本规范的 PR 一律拒绝合并，无例外。

---

## 目录

1. [项目概述与技术栈](#1-项目概述与技术栈)
2. [Monorepo 全局架构与目录职责](#2-monorepo-全局架构与目录职责)
3. [分支管理策略与预埋功能规范](#3-分支管理策略与预埋功能规范)
4. [环境变量规范](#4-环境变量规范)
5. [数据库访问与迁移规范](#5-数据库访问与迁移规范)
6. [后端安全黄金法则](#6-后端安全黄金法则)
7. [积分系统黄金机制（Credits Transaction）](#7-积分系统黄金机制credits-transaction)
8. [管理员权限体系与多级鉴权规范](#8-管理员权限体系与多级鉴权规范)
9. [AI 接口集成规范（Gemini / OpenAI）](#9-ai-接口集成规范gemini--openai)
10. [前端、后端、数据、本地四端协作规范](#10-前端后端数据本地四端协作规范)
11. [代码注释规范](#11-代码注释规范)
12. [代码质量与质量保障规范](#12-代码质量与质量保障规范)
13. [UI 规范（设计系统契约）](#13-ui-规范设计系统契约)
14. [移动端专项规范](#14-移动端专项规范)
15. [错误处理与监控规范](#15-错误处理与监控规范)
16. [提交信息与 PR 规范](#16-提交信息与-pr-规范)
17. [禁止事项速查表](#17-禁止事项速查表)
18. [多 Preset、多模型、多 Adapter 解耦路由黄金法则（Preset-Model-Adapter-Provider）](#18-多-preset多模型多-adapter-解耦路由黄金法则preset-model-adapter-provider)

---

## 1. 项目概述与技术栈

**KK-Studio（kkai.plus）** 是一个面向消费者的 AI 图像生成与编辑平台，支持多模型调用、积分计费、订阅支付及多端覆盖。

### 1.1 技术栈总览

| 层级 | 技术 | 备注 |
|------|------|------|
| Web 前端 | Vite + React 19 + TypeScript + Tailwind + AntD/Lobe UI Bridge | `apps/web/` |
| 后端 | Node.js + Express.js（VPS 部署） | `server/` |
| 数据库 | PostgreSQL（连接池管理） | `migrations/` |
| 包管理 | npm (Monorepo 结构) | 根 packageManager 声明 npm |
| 支付 | Stripe（Webhook 驱动） | `server/routes/webhook.js` |
| AI 图像 | Google Gemini 2.5 Flash Image API | `server/routes/generate-image.js` |
| AI 对话 | OpenAI Chat Completion API | `server/routes/chat.js` |
| 身份认证 | JWT（自签发）+ 长效 Session（多端兼容） | `server/lib/` |
| 共享逻辑 | `packages/shared/` | 零平台依赖纯 TS |
| HTTP 层 | `packages/api-client/` | 双端共用，统一封装 |
| UI 契约 | `packages/ui/` | Token + Web Adapter；业务不得直接 import `@lobehub/ui` |

### 1.2 项目当前版本

- 当前稳定版本：**v1.5.2**
- 发布渠道：`release/publish/stable/`
- 版本标签格式：`vX.Y.Z`（遵循语义化版本 SemVer）

---

## 2. Monorepo 全局架构与目录职责

```
nano-banana-KK-/
├── apps/
│   ├── web/                  # 桌面端 Web（Vite + React + TS）
│   │   └── src/
│   │       ├── app/          # 应用入口与全局配置
│   │       ├── assets/       # 静态资源（图标、图片、SVG）
│   │       ├── canvas/       # 画布编辑器相关模块
│   │       ├── client-integrations/  # 客户端第三方集成适配
│   │       ├── components/   # 通用 UI 组件
│   │       ├── config/       # 前端运行时配置
│   │       ├── context/      # React Context 全局状态
│   │       ├── hooks/        # 自定义 React Hooks
│   │       ├── icons/        # 图标集合
│   │       ├── lib/          # 工具函数与纯逻辑库
│   │       ├── pages/        # 页面级组件
│   │       ├── routes/       # 路由定义（react-router）
│   │       ├── services/     # 前端服务层（API 调用封装）
│   │       ├── types/        # TypeScript 类型定义
│   │       ├── utils/        # 工具函数
│   │       └── workers/      # Web Worker 模块
│   └── mobile/               # 移动端（Expo Managed Workflow）
├── packages/
│   ├── shared/               # 跨端共用核心业务逻辑（零平台依赖）
│   ├── api-client/           # 统一 HTTP 调用层（双端共用）
│   └── ui/                   # 共享基础 UI 组件库
├── server/
│   ├── routes/
│   │   ├── admin.js          # 管理员后台路由
│   │   ├── chat.js           # AI 对话路由
│   │   ├── generate-image.js # AI 图像生成路由
│   │   ├── user.js           # 用户信息与认证路由
│   │   └── webhook.js        # Stripe Webhook 路由
│   ├── lib/                  # 后端工具库（JWT、积分、数据库）
│   └── index.js              # 服务入口（环境变量校验 + 中间件挂载）
├── migrations/               # PostgreSQL schema 迁移文件（唯一 DDL 来源）
├── config/                   # 项目级全局配置（构建、测试、主题契约）
├── docs/                     # 项目文档
├── scripts/                  # 自动化脚本（构建、patch、发布）
├── tools/                    # 开发工具（refactor 工具、patch 工具）
├── tests/                    # 测试套件
├── temp/                     # 临时文件（不得提交业务代码）
├── release/publish/stable/   # 发布产物存放区
├── .github/workflows/        # CI/CD 工作流
└── AGENTS.md                 # 本文件（架构黄金法则）
```

### 2.1 模块隔离硬性规则

| 模块 | 禁止引入 |
|------|---------|
| `apps/web/` | React Native 组件、Expo API、`react-native-*` 任何包、直接引入 `@lobehub/ui` |
| `apps/mobile/` | `window`、`document`、DOM API、浏览器专属 BOM |
| `packages/shared/` | 任何含平台特征的代码（包括 `window`、RN 组件）、`@lobehub/ui` |
| `packages/api-client/` | 平台特定存储（`localStorage`、AsyncStorage 均不可硬引入，必须通过依赖注入）、`@lobehub/ui` |
| `server/` | 前端框架组件、React、Vue 等 UI 库、`@lobehub/ui` |
| `migrations/` | 任何业务逻辑，只允许纯 SQL DDL |

---

## 3. 分支管理策略与预埋功能规范

### 3.1 分支命名规范

```
main                    # 主干，唯一生产分支，所有 PR 目标
feature/<功能名>        # 新功能开发，例如 feature/voice-input
fix/<问题描述>          # Bug 修复，例如 fix/credits-refund-race
refactor/<模块名>       # 重构，例如 refactor/auth-middleware
chore/<任务名>          # 工程化任务，例如 chore/update-deps
release/<版本号>        # 发布准备分支，例如 release/v1.6.0
hotfix/<描述>           # 紧急修复直通 main
```

### 3.2 预埋功能分支（Planned Branches）

以下功能已在架构中预留位置，开发前必须以此为基础：

| 功能 | 预埋位置 | 状态 |
|------|---------|------|
| 语音输入（Voice Input） | `apps/web/src/client-integrations/` | 占位已建 |
| 离线 API 编辑与 VPS 回退 | `apps/web/index.html` + `vite.config.ts` | 已实现 |
| 画布编辑器（Canvas Editor） | `apps/web/src/canvas/` | 框架已建 |
| 管理员 API 设置页 | `server/routes/admin.js` + `apps/web/src/pages/` | 已实现 |
| 移动端多浏览器长效 Session | `packages/api-client/` + `server/lib/` | 已修复 |
| Provider 多模型切换 | `server/lib/` + `apps/web/src/services/` | 已实现 |
| 积分商品定价表动态管理 | `migrations/007_admin_credit_models.sql` | Schema 已建 |
| Stripe 订阅与 Webhook | `server/routes/webhook.js` | 已实现 |

### 3.3 预埋功能开发规范

- **严禁** 在 `main` 分支直接开发未完成的预埋功能，必须在对应 `feature/` 分支开发。
- 预埋占位代码须添加 `// TODO(feature/<功能名>): <说明>` 注释，方便追踪。
- 预埋功能的数据库 Schema 变更必须提前创建迁移文件（哪怕字段暂时为空），确保 `main` 可随时扩展。

---

## 4. 环境变量规范

### 4.1 后端（`server/`）必需变量

以下变量在 `server/index.js` 启动时强制校验，任何一个缺失服务**立即抛出异常并拒绝启动**：

```
# AI 服务密钥
GEMINI_API_KEY          # Google Gemini API Key
OPENAI_API_KEY          # OpenAI API Key

# 安全
JWT_SECRET              # JWT 签名密钥（最低 64 字符随机串）
PASSWORD_SALT           # 密码哈希盐（最低 32 字符随机串）

# 数据库
DATABASE_URL            # PostgreSQL 连接串（含连接池参数）

# 支付
STRIPE_SECRET_KEY       # Stripe 服务端密钥（sk_live_* 或 sk_test_*）
STRIPE_WEBHOOK_SECRET   # Stripe Webhook 签名密钥（whsec_*）

# 服务配置
PORT                    # 服务监听端口（默认 3001）
NODE_ENV                # 环境标识（production / development）
ALLOWED_ORIGINS         # CORS 白名单，逗号分隔（生产必填）
```

### 4.2 前端（`apps/web/`）环境变量

```
VITE_API_BASE_URL       # 后端 API 基础地址（生产填 VPS 域名）
VITE_STRIPE_PUBLIC_KEY  # Stripe 公钥（pk_live_* 或 pk_test_*）
VITE_APP_VERSION        # 当前版本号（与 package.json 同步）
```

### 4.3 移动端（`apps/mobile/`）环境变量

```
EXPO_PUBLIC_API_BASE_URL  # 后端 API 基础地址
```

### 4.4 环境变量使用铁则

1. **严禁硬编码任何密钥、URL、密码**，一律通过 `process.env.*` 引用。
2. **严禁** 将 `.env` 文件提交至 Git 仓库，`.gitignore` 必须覆盖所有 `.env*` 文件（`.env.local`, `.env.production` 等）。
3. 前端变量必须以 `VITE_` 前缀开头，移动端以 `EXPO_PUBLIC_` 前缀开头，否则运行时无法访问。
4. 新增环境变量时，必须同步更新 `docs/` 中的部署文档和本文件的 §4 章节。
5. **严禁** 在任何日志、错误信息、HTTP 响应体中泄露环境变量的值。

---

## 5. 数据库访问与迁移规范

### 5.1 迁移文件规范

- **唯一合法修改 Schema 的方式**：在 `migrations/` 目录创建新的 SQL 文件。
- 文件命名格式：`NNN_<描述>.sql`，序号连续递增，例如 `011_add_refresh_token.sql`。
- **严禁** 在业务代码（`server/`、`packages/`、`apps/`）中执行任何 DDL 语句（`CREATE TABLE`、`ALTER TABLE`、`DROP TABLE` 等）。
- 迁移文件必须包含**幂等保护**（如 `CREATE TABLE IF NOT EXISTS`、`ADD COLUMN IF NOT EXISTS`），确保重复执行不报错。
- 迁移文件提交前必须在测试数据库验证执行成功。

### 5.2 已有 Schema 概览

```
migrations/
  001_points_schema.sql              # users 表、credit_logs 表基础结构
  002_token_schema.sql               # 认证 Token / Session 表
  003_strict_agents_schema.sql       # generations 表（AI 生成历史）
  004_add_status_to_generations.sql  # generations.status 字段
  005_remove_default_credits.sql     # 去除注册默认积分（强制为 0）
  006_admin_credits_contract.sql     # 管理员积分合约约束
  007_admin_credit_models.sql        # 积分商品定价表
  008_add_provider_kind.sql          # AI Provider 类型字段
  009_admin_level_check_constraint.sql          # admin_level CHECK 约束（仅 0/1/2）
  010_orders_positive_credits_constraint.sql    # orders 积分正数约束
```

### 5.3 SQL 查询规范

```javascript
// ✅ 正确：参数化查询
const result = await pool.query(
  'SELECT * FROM users WHERE id = $1 AND email = $2',
  [userId, email]
);

// ❌ 错误：字符串拼接（SQL 注入风险，一律拒绝合并）
const result = await pool.query(
  `SELECT * FROM users WHERE id = ${userId}` // 严禁！
);
```

### 5.4 数据库连接管理

- 所有数据库操作必须通过统一的连接池（`pg.Pool`），严禁创建裸 `pg.Client` 连接。
- 连接池配置参数（`max`、`idleTimeoutMillis`、`connectionTimeoutMillis`）必须写入环境变量，不得硬编码。
- 事务操作必须使用 `pool.connect()` 获取专属客户端，在 `finally` 块中调用 `client.release()`，防止连接泄漏。

```javascript
// ✅ 事务标准模板
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... 业务操作
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release(); // 必须释放
}
```

---

## 6. 后端安全黄金法则

### 6.1 启动强校验

`server/index.js` 在监听端口前必须执行所有必需环境变量的完整性校验：

```javascript
const REQUIRED_ENV = [
  'GEMINI_API_KEY', 'OPENAI_API_KEY', 'JWT_SECRET',
  'PASSWORD_SALT', 'DATABASE_URL', 'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET'
];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`[FATAL] 缺少必需环境变量: ${key}，服务拒绝启动`);
  }
}
```

### 6.2 CORS 精确源匹配

```javascript
// ✅ 正确：动态白名单匹配
const PRODUCTION_ORIGINS = ['https://kkai.plus', 'https://www.kkai.plus'];
const DEV_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function isOriginAllowed(origin) {
  if (process.env.NODE_ENV === 'development') {
    return DEV_ORIGIN_REGEX.test(origin);
  }
  return PRODUCTION_ORIGINS.includes(origin);
}

// ❌ 严禁：通配符 + credentials 组合
// Access-Control-Allow-Origin: *  +  credentials: true  → 绝对禁止
```

### 6.3 安全响应头

所有非 Stripe Webhook 路由必须统一注入：

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
```

Stripe Webhook 路由（`/api/webhook/stripe`）豁免 CORS 处理，Stripe 服务端直连，无需 CORS 响应头。

### 6.4 请求体大小限制

- JSON 请求体：最大 `10mb`（图像 base64 场景）。
- 普通 API 请求体：最大 `1mb`。
- 必须在全局中间件层设置，不得依赖路由层自行限制。

### 6.5 认证中间件

```javascript
// authMiddleware — 普通用户接口鉴权
// adminAuth(requiredLevel) — 管理员接口鉴权

// ⚠️ 核心安全法条：
// 鉴权中间件内部严禁直接信任 JWT payload 中的 adminLevel 字段！
// 必须每次实时查询数据库验证权限，防止降权后的 Token 越权操作。

async function adminAuth(requiredLevel) {
  return async (req, res, next) => {
    const userId = req.user.id; // 来自 authMiddleware 解析
    const { rows } = await pool.query(
      'SELECT admin_level FROM users WHERE id = $1',
      [userId]
    );
    const dbAdminLevel = rows[0]?.admin_level ?? 0;
    if (dbAdminLevel < requiredLevel) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

---

## 7. 积分系统黄金机制（Credits Transaction）

积分系统是商业化核心，任何漏洞均为严重事故。以下规范**一字不得违背**。

### 7.1 核心调用时序（绝对不可打乱）

```
客户端 → 后端路由
  │
  ├─ Step 1: getOperationCost(operationKey)  → 动态查询定价表
  ├─ Step 2: getUserCredits(userId)           → 查询积分余额
  │   └─ 积分不足 → 返回 402 Insufficient Credits，终止流程
  │
  ├─ Step 3: deductCredits(userId, cost)      → 原子扣减（防负数锁）
  │   └─ 扣减失败（行数=0）→ 抛出异常终止，防并发负积分
  │
  ├─ Step 4: 调用外部 AI API
  │   ├─ 成功 → Step 5: 写入 generations 表（status: 'done'）→ 返回结果
  │   └─ 失败 / 安全过滤触发
  │       ├─ Step 6: refundCredits(userId, cost) → 原子退款
  │       │   └─ 退款失败 → ⚠️ 必须触发报警日志（严禁 silent catch）
  │       └─ 返回 500 + 提示"已退款"
```

### 7.2 原子扣减 SQL（防负数锁）

```sql
-- ✅ 标准扣减 SQL
UPDATE users
SET credits = credits - $1
WHERE id = $2
  AND credits >= $1   -- 防负数锁，并发安全
RETURNING credits;

-- 若更新行数 = 0，说明积分不足（或并发竞争失败），必须立即抛错阻断。
```

### 7.3 积分变动审计日志

**所有** 积分变动必须在同一事务中向 `credit_logs` 表写入记录：

| 字段 | 说明 |
|------|------|
| `user_id` | 操作用户 |
| `delta` | 变动量（正数为增加，负数为减少） |
| `balance_after` | 变动后余额（快照） |
| `reason` | 变动原因 |
| `operator_id` | 操作人 ID（系统操作填 `system`） |
| `created_at` | 操作时间 |

`reason` 枚举值：

| 值 | 场景 |
|----|------|
| `ai_deduct` | AI 调用成功扣减 |
| `ai_refund` | AI 调用失败退款 |
| `stripe_webhook` | Stripe 支付成功充值 |
| `admin_recharge` | 管理员手动充值 |
| `admin_adjust` | 管理员手动调整（可正可负） |

### 7.4 积分安全边界

```javascript
// ✅ 动态获取操作成本（严禁硬编码）
const cost = await getOperationCost('image_generate_1_1');

// ❌ 严禁
const cost = 10; // 硬编码成本，一律拒绝合并

// ✅ 管理员调整积分（防负数保护）
// UPDATE users SET credits = GREATEST(0, credits + $delta) WHERE id = $userId;

// ✅ 注册时积分默认为 0（严禁直接赠送，必须走充值链路）
// INSERT INTO users (email, credits, ...) VALUES ($1, 0, ...);
```

### 7.5 Stripe Webhook 积分充值

- Stripe Webhook 路由必须先使用 `stripe.webhooks.constructEvent` 验证签名，签名验证失败立即返回 `400`。
- 积分充值基于 `checkout.session.completed` 事件，充值量必须来自 `metadata.credits` 字段（由后端在创建 Checkout Session 时写入）。
- `orders` 表必须有 `CONSTRAINT positive_credits CHECK (credits > 0)` 约束（见 `migration/010`）。
- 必须做幂等保护：通过 `stripe_session_id` 唯一索引防止重复充值。

---

## 8. 管理员权限体系与多级鉴权规范

### 8.1 权限等级定义

| `admin_level` | 角色 | 可操作范围 |
|--------------|------|-----------|
| `0` | 普通用户 | 无任何管理权限 |
| `2` | 普通管理员 | 充值管理 / 积分管理 / API 设置 |
| `1` | 超级管理员 | 2级全部权限 + 人员管理（提升/降级普通管理员） |

**关键约束：**

- `admin_level` 字段有数据库 CHECK 约束（见 `migration/009`）：`CHECK (admin_level IN (0, 1, 2))`。
- **严禁** 通过任何 API 接口将用户 `admin_level` 设置为 `1`（超级管理员）。超级管理员只能由运维在数据库层直接 `UPDATE`。
- 普通管理员（`admin_level = 2`）只能被超级管理员（`admin_level = 1`）提升或降级。

### 8.2 后端鉴权中间件调用规范

```javascript
// 普通用户接口
router.get('/api/user/profile', authMiddleware, handler);

// 普通管理员接口（level >= 2）
router.post('/api/admin/recharge', authMiddleware, adminAuth(2), handler);

// 超级管理员专属接口（level === 1）
router.post('/api/admin/staff', authMiddleware, adminAuth(1), handler);
```

### 8.3 前端路由守卫规范

```typescript
// AdminLayout.tsx — 管理后台父级框架
useEffect(() => {
  if (!user) { navigate('/login'); return; }
  if (user.adminLevel === 0) { navigate('/'); return; }
  if (location.pathname.startsWith('/admin/staff') && user.adminLevel !== 1) {
    navigate('/admin');
  }
}, [user, location]);
```

---

## 9. AI 接口集成规范（Gemini / OpenAI）

### 9.1 Gemini API（图像生成与编辑）

#### 模型锁定

```javascript
// ✅ 唯一合法写法（静态常量，禁止提取为运行时变量）
const MODEL = 'gemini-2.5-flash-image';

// ❌ 严禁
const model = req.body.model; // 禁止客户端指定模型
```

#### 多模态参考图处理

```javascript
// ✅ 后端接收参考图前必须清除 Data URI 前缀
const cleanBase64 = base64String.replace(/^data:image\/\w+;base64,/, '');

// ✅ 返回给前端时必须重新拼装 Data URI
const dataUri = `data:${mimeType};base64,${imageData}`;
```

#### 纵横比配置定位（严防错配）

```javascript
// ✅ 正确节点（必须在 imageConfig 下）
const config = {
  imageConfig: {
    aspectRatio: '1:1'  // 允许值: "1:1" | "16:9" | "9:16"
  }
};

// ❌ 错误节点（SDK 会静默忽略）
const config = {
  aspectRatio: '1:1'  // 错误！SDK 不识别此位置
};
```

#### 安全过滤处理

```javascript
const imagePart = response.candidates?.[0]?.content?.parts?.find(
  p => p.inlineData
);
if (!imagePart) {
  await refundCredits(userId, cost);
  throw new Error('内容安全过滤触发，请修改提示词后重试');
}
```

### 9.2 OpenAI API（对话）

#### 链路追踪 Trace ID

```javascript
const traceId = `kkai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
// 将 traceId 写入 generations 表，便于排查
```

#### 超时与重试

- 请求超时：30 秒，超时后必须退款。
- **严禁** 自动重试（防止重复扣费），超时直接返回 `504` 并提示用户重试。

#### 流式响应规范

- 使用 Server-Sent Events（SSE）返回流式内容。
- 流式传输完成后，最终写入 `generations` 表，`status` 字段设为 `done`。
- 中途断流必须在 `generations` 表记录 `status = failed`，并退款。

### 9.3 Provider 动态切换

- AI Provider 配置（API Key、端点、模型）由管理员通过后台动态配置，存储于数据库 `provider_configs` 表。
- 后端每次请求时从数据库读取当前 Provider 配置，支持热切换无需重启服务。
- Provider `kind` 字段遵循 `migration/008` 定义的枚举约束。

---

## 10. 前端、后端、数据、本地四端协作规范

### 10.1 通信协议

- 所有前后端通信使用 **HTTPS + JSON**（移动端和 Web 统一）。
- API 基础地址通过 `packages/api-client/` 的 `createApiClient(baseUrl)` 工厂函数注入。
- 请求必须携带 `Authorization: Bearer <JWT>` 头部（由 `api-client` 自动注入）。

### 10.2 api-client 使用规范

```typescript
// ✅ 正确：通过 api-client 调用
import { apiClient } from '@kk/api-client';
const result = await apiClient.post('/generate-image', payload);

// ❌ 错误：直接 fetch 硬编码
const result = await fetch('https://api.kkai.plus/generate-image', ...);
```

### 10.3 JWT Session 多端兼容规范

- Web 端：JWT 存储于 `httpOnly cookie`（防 XSS），`SameSite=None; Secure`（跨源场景）。
- 移动端：JWT 存储于 Expo SecureStore，`api-client` 的 `tokenStorage` 依赖注入接口注入对应实现。
- **长效 Session**：使用 Refresh Token 机制，存储在 `token_schema` 表（见 `migration/002`），过期时间 30 天。
- 多浏览器/多设备登录：系统允许同一账号多端同时在线，不踢出其他 Session。

### 10.4 前端数据流规范

```
用户操作（UI Event）
  → 调用 Service 层函数（src/services/）
  → 经 api-client 发送 HTTP 请求
  → 后端路由处理（server/routes/）
  → 数据库操作（参数化 SQL）
  → 返回标准化 JSON 响应
  → Service 层处理响应（错误处理、类型转换）
  → 更新 React Context / 组件本地 State
  → UI 重渲染
```

### 10.5 本地开发环境规范

```bash
# 启动后端（server/）
cd server && npm run dev

# 启动 Web 前端（apps/web/）
cd apps/web && bun run dev

# 启动移动端（apps/mobile/）
cd apps/mobile && npx expo start

# 运行迁移
cd migrations && psql $DATABASE_URL -f NNN_xxx.sql
```

- 本地开发使用 `.env.local` 文件（不提交 Git）。
- 必须启动后端服务后再启动前端，避免 API 404 误判为前端 Bug。

---

## 11. 代码注释规范

### 11.1 文件头注释

每个新建源文件必须包含文件头注释：

```typescript
/**
 * @file generate-image.js
 * @module server/routes
 * @description AI 图像生成路由。负责积分扣减、Gemini API 调用、
 *              安全过滤捕获与失败退款的完整流程。
 * @author KK-Studio Team
 * @version 1.5.2
 */
```

### 11.2 函数注释

所有导出函数和核心内部函数必须有 JSDoc 注释：

```typescript
/**
 * 原子扣减用户积分，带防负数锁。
 * @param {string} userId - 用户 ID
 * @param {number} amount - 扣减量（必须为正整数）
 * @returns {Promise<number>} 扣减后的积分余额
 * @throws {Error} 若积分不足或并发竞争失败，抛出 InsufficientCreditsError
 */
async function deductCredits(userId, amount) { ... }
```

### 11.3 关键业务逻辑注释

```javascript
// Step 3: 原子扣减积分（防负数锁），SQL 更新行数为 0 则积分不足
const { rowCount } = await pool.query(
  'UPDATE users SET credits = credits - $1 WHERE id = $2 AND credits >= $1',
  [cost, userId]
);
if (rowCount === 0) throw new InsufficientCreditsError();
```

### 11.4 特殊注释标签规范

```javascript
// TODO(feature/voice-input): 此处需要集成语音输入模块
// FIXME(credits): 高并发场景下的竞态条件需要进一步压测
// NOTE: Gemini SDK 要求 aspectRatio 必须在 imageConfig 下，否则静默忽略
// SECURITY: 此处不可信任客户端传入的 model 参数
```

---

## 12. 代码质量与质量保障规范

### 12.1 TypeScript 规范

- 所有 `apps/web/` 和 `packages/` 代码必须使用 TypeScript，严禁 `any`（ESLint 规则强制）。
- 接口和类型必须明确声明，不得使用隐式推断代替接口定义。
- `tsconfig.json` 的 `strict: true` 必须启用，严禁关闭严格模式选项。

```typescript
// ✅ 正确
interface GenerateImageRequest {
  prompt: string;
  aspectRatio: '1:1' | '16:9' | '9:16';
  referenceImageBase64?: string;
}

// ❌ 错误
const req: any = ...;
```

### 12.2 ESLint 强制规则

| 规则 | 说明 |
|------|------|
| `no-explicit-any` | 禁止 `any` 类型 |
| `no-hardcoded-credentials` | 禁止硬编码密钥 |
| `no-console` (warn) | 生产代码禁止 `console.log`，只允许 `console.error`/`console.warn` |
| `import/no-cycle` | 禁止循环依赖 |
| `@typescript-eslint/strict` | TS 严格模式 |

### 12.3 测试规范

测试文件位于 `tests/` 目录，使用 Vitest（Web）。

| 模块 | 最低覆盖率 |
|------|-----------|
| `packages/shared/` | ≥ 90% |
| `server/lib/`（积分、鉴权） | ≥ 85% |
| `server/routes/`（AI 路由） | ≥ 70% |
| `apps/web/src/services/` | ≥ 70% |

### 12.4 CI/CD 流水线

`.github/workflows/` 中的 CI 在每次 PR 合并前必须通过：

1. **TypeScript 编译检查**（`tsc --noEmit`）
2. **ESLint 检查**（零 error，零 warn）
3. **单元测试**（覆盖率达标）
4. **构建产物验证**（`bun run build` 成功）

### 12.5 PR 自审检查清单

- [ ] 无硬编码密钥、URL、积分数值
- [ ] 所有新 SQL 使用参数化查询
- [ ] 新功能有对应单元测试
- [ ] 环境变量有文档更新
- [ ] 积分扣减遵循 §7 时序
- [ ] 管理员权限鉴权使用实时数据库查询
- [ ] Gemini 调用的 `aspectRatio` 在 `imageConfig` 下
- [ ] 无跨模块平台依赖违规（见 §2.1）
- [ ] 提交信息符合 §16 规范

---

## 13. UI 规范（设计系统契约）

> 本章节为硬性约束，桌面端与移动端均须遵守。

### 13.1 间距系统（Spacing）

使用 **2px 基础栅格（偶数倍数）** 以实现高精度对齐。常规页面及大区块布局推荐使用 **4px 或 8px 的倍数**（如 8px, 12px, 16px, 20px, 24px, 32px 等），在精细排版或紧凑型卡片（如微调间距）场景下支持使用 **2px 的倍数**（如 2px, 6px, 10px, 14px, 18px 等）：

| 场景 | Tailwind/CSS | px | 适用说明 |
|------|--------------|----|---------|
| 最小微调间距 | `p-0.5` / 自定义 | 2px | 极小边框或极细边距对齐 |
| 紧凑微调间距 | `p-1.5` / `gap-1.5` | 6px | 标签、图标紧凑间距 |
| 元素内边距（小） | `p-2` | 8px | 小按钮、输入框内部 |
| 紧凑元素间距 | `gap-2.5` / 自定义 | 10px | 微型卡片子项间距 |
| 元素内边距（标准） | `p-4` | 16px | 标准页面布局 / 主网格间隙 |
| 元素内边距（大） | `p-6` | 24px | 大卡片 / 弹出层内边距 |
| 卡片内边距 | `p-4` / `p-5` | 16px / 20px | 单元格卡片内部 |
| 卡片间距（Grid Gap） | `gap-4` / `gap-6` | 16px / 24px | 卡片网格的物理间距 |
| 区块间距（Section） | `space-y-6` / `space-y-8` | 24px / 32px | 页面各大板块之间的间距 |
| 页面水平边距（移动）| `px-4` | 16px | 移动端两侧安全空白 |
| 页面水平边距（桌面）| `px-6` / `px-8` | 24px / 32px | 桌面端主内容左对齐边距（28px/32px） |

### 13.2 排版规范（Typography）

| 层级 | Tailwind | px | 字重 | 使用场景 |
|------|----------|----|------|---------|
| H1（页面标题） | `text-3xl` | 30px | `font-bold` (700) | 页面主标题 |
| H2（区块标题） | `text-xl` / `text-2xl` | 20-24px | `font-semibold` (600) | 区块/卡片标题 |
| H3（子标题） | `text-lg` | 18px | `font-medium` (500) | 子区块标题 |
| Body（正文） | `text-base` | 16px | `font-normal` (400) | 普通内容文本 |
| Small（辅助文字） | `text-sm` | 14px | `font-normal` (400) | 描述、提示、标签 |
| Caption（极小） | `text-xs` | 12px | `font-normal` (400) | 时间戳、版权信息 |
| 积分数字 | `text-xl` / `text-2xl` | 20-24px | `font-bold` (700) | 积分余额显示 |

行高：正文 `leading-relaxed`（1.625），标题 `leading-tight`（1.25）。

### 13.3 颜色规范（设计 Token）

| 用途 | Token | 说明 |
|------|-------|------|
| 主色（Brand） | `primary` | 品牌主色，CTA 按钮背景 |
| 成功 | `green-500` | 操作成功、积分增加 |
| 危险 | `destructive` | 删除、扣费、错误 |
| 警告 | `yellow-500` | 余额不足警告 |
| 中性文字 | `foreground` | 主要文字色 |
| 次要文字 | `muted-foreground` | 辅助说明文字 |
| 背景 | `background` | 页面背景 |
| 卡片背景 | `card` | 卡片背景 |
| 边框 | `border` | 分割线、输入框边框 |

所有颜色 Token 必须在 `:root`（亮色）和 `.dark`（暗色）下均有定义，禁止在组件中直接使用十六进制颜色。

### 13.4 卡片（Card）规范与自适应尺寸契约

为了实现 Rich Aesthetics（极致的视觉和防抖排版），卡片设计分为“桌面端严格锁定尺寸公式”与“移动端自适应流式宽度”双轨制：

#### 13.4.1 卡片基础结构
```html
<div class="bg-card rounded-xl border border-border p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
```

#### 13.4.2 桌面端（电脑/平板宽屏）卡片物理尺寸锁定公式
对于复杂的链路事实、工作台以及通道等核心卡片网格，确立以**单元格 A**（宽 `270px`，高 `130px`，间隙 `16px`）为基础的响应式宽高锁定公式，防止因 Flex/Grid 拉伸导致子元素重叠和截断：
- **1A**：`270px * 130px`
- **2A宽 (2-col)** = 2 * 270px + 16px = 556px
- **3A宽 (3-col)** = 3 * 270px + 32px = 842px
- **4A宽 (4-col)** = 4 * 270px + 48px = 1128px
- **2row高 (2-row)** = 2 * 130px + 16px = 276px
- **3row高 (3-row)** = 3 * 130px + 32px = 422px
- **4row高 (4-row)** = 4 * 130px + 48px = 568px

*注意：三级详情表单卡片物理宽度必须设定为 4A 满宽（即 `max-width: 1128px !important;`），所有输入表单框和操作控件继承全宽标准。*

#### 13.4.3 移动端（手机端）卡片自适应原则
当断点 `< 768px` 时，**严禁硬编码锁定卡片宽度**。必须使用流式布局：
- **宽度自适应**：设置为 `width: 100% !important; max-width: 100% !important;` 充满屏幕。
- **高度自适应**：为了应对窄屏幕文字折行、指标堆叠的问题，高度必须声明为 `height: auto !important;` 并配合合理的最小高度（如 `min-height: 130px` 或 `156px`）进行兜底，根治内容溢出或重合。

#### 13.4.4 卡片网格自适应偏左对齐规范
- 在大卡片网格容器上，必须设置 `overflow-x: visible !important;`，消除物理裁剪，确保最右侧卡片在出现滑动条时不被裁切。
- 容器必须设置为 `justify-content: start !important;`。当卡片数量极少（如仅 1 个 A 卡片）时，容器应贴紧左侧对齐线，并在右侧自然拉伸，严禁使用 `justify-content: center` 产生孤立居中和两侧空白荒凉感。
- 采用 `@container`（配合 `container-type: inline-size`）实现组件网格的列数自适应平滑分流（如 556px 下展示 2 列，842px 下展示 3 列），使自适应卡片在各尺寸断点下完美呈现而不脱离原本的锁定设计。

### 13.5 按钮规范

| 类型 | 使用场景 | 样式要点 |
|------|---------|---------|
| Primary | 主要操作（生成、支付） | `bg-primary text-white`，高对比 |
| Secondary | 次要操作（取消、返回） | `bg-secondary text-secondary-foreground` |
| Destructive | 危险操作（删除、退出） | `bg-destructive text-white`，需二次确认 |
| Ghost | 轻量操作（图标按钮、菜单项） | 透明背景，hover 显示 |
| Outline | 边框按钮（表单操作） | 透明背景 + 边框 |

按钮尺寸：

| 尺寸 | 高度 | 适用 |
|------|------|------|
| sm | 32px | 内联操作 |
| default | 40px | 标准按钮 |
| lg | 48px | CTA 主按钮 |
| icon | 40×40px | 图标按钮 |

### 13.6 动效规范（Transition & Animation）

**原则：** 动效服务于内容，克制使用，禁止无意义装饰性动画。

| 场景 | 持续时间 | Tailwind |
|------|---------|---------|
| 颜色/阴影过渡 | 150ms | `transition-colors duration-150` |
| 位移/缩放 | 200ms | `transition-all duration-200` |
| 模态框出现 | 250ms | `animate-in fade-in-0 zoom-in-95` |
| 模态框关闭 | 200ms | `animate-out fade-out-0 zoom-out-95` |
| 侧边栏滑入 | 300ms | `slide-in-from-left-full` |
| 生成进度条 | 平滑更新 | `transition: width 0.3s linear` |

骨架屏（Skeleton）：AI 内容加载期间必须展示骨架屏，使用 `animate-pulse` + `bg-muted`。

### 13.7 响应式断点与自适应布局

| 断点 | 范围 | 布局及自适应卡片表现 |
|------|------|--------------------|
| 移动端 | < 768px | 单栏，侧边栏收起，卡片宽度 100%，高度自适应 (`height: auto; min-height: 130px/156px`) |
| 平板 | 768px+ | `md:` 前缀，网格自适应为 2 列（按 270px 单元格布局），主内容区左对齐 |
| 桌面 | 1024px+ | `lg:` 前缀，三栏，主网格自适应 3 列或 4 列，卡片进入 270px 严格锁定状态 |
| 宽屏 | 1280px+ | `xl:` 前缀，最大宽度 1128px（4A满宽），主网格展示 4 列，左右边界严丝合缝 |

最大内容宽度限制为 **4A 满宽**：`max-width: 1128px !important;`。

### 13.8 UI 黄金法则：Lobe UI Bridge 与设计系统契约

1. `@lobehub/ui` 只能在 `packages/ui/src/web/**` 内直接引入。业务代码必须通过 `@kk/ui/web` 使用封装组件。
2. `packages/ui/src/core/**` 只允许定义平台无关 token、类型与设计契约，禁止引入 React DOM、Lobe、AntD、window、document。
3. `apps/web/src/**` 禁止直接写十六进制颜色、rgba、hsl、linear-gradient。新增颜色必须先进入 token。
4. 禁止在 React 事件中直接修改 DOM style 实现 hover/active 状态；必须使用 class、data-state 或封装组件 variant。
5. 禁止新增 `display:none` 隐藏 DOM 来绕过 TypeScript noUnused 规则。若为临时兼容，必须写 `DEPRECATED(test-compat)`，且不得绑定业务 action。
6. 所有可点击 UI 必须有真实 handler；禁止生产代码中出现有可见文案的 `onClick={() => {}}`。
7. 所有按钮、菜单、Modal、Drawer、Toast : Tooltip、Tabs、Select、Input 在设置页与管理后台优先使用 `@kk/ui/web`。
8. Canvas 高频节点可暂缓 Lobe 化，但必须使用 token，不能引入新的硬编码颜色或重型 Provider。
9. 所有新增 UI 必须同时验证 light/dark、移动端、安全区、键盘可访问性、焦点环、Esc 关闭、点击外部关闭、滚动锁定。
10. 任何 UI 重构 PR 必须跑：`architecture:check`、`typecheck` : `build`、`test`、桌面/移动设置页 smoke test。

### 13.9 App Root Navigation 路由规范

1. `/` 为 workspace root。
2. `/settings/**` 为设置页 root。
3. `/admin/**` 为管理员 root。
4. 不允许组件内部散落 `window.history.pushState` + synthetic `PopStateEvent`。
5. 所有 root mode 切换与路由切换必须通过统一 helper：`navigateAppRoot(path, options)`。
6. 如果 settings 仍以 overlay/surface 呈现，必须同步 URL 与 browser back 行为，并在更新 window.history 时派发自定义事件 `kk-app-locationchange`。
7. 管理后台入口必须经过权限判断；前端隐藏不是权限控制，后端仍必须鉴权。

---

## 14. 移动端专项规范

### 14.1 Expo Managed Workflow 限制

**严禁** 在 `apps/mobile/` 中引入需要 Native Code 的第三方库。所有依赖必须兼容 Expo Managed Workflow。

### 14.2 移动端 UI 规范

- 底部安全区必须使用 `useSafeAreaInsets()` 处理，禁止硬编码 padding。
- 触摸目标最小尺寸：**44×44pt**（iOS HIG 标准）。
- 列表项最小高度：**48px**。
- 字体大小最小值：**12px**。
- 图片懒加载：使用 Expo Image 的 `transition` 和 `placeholder` 属性。

### 14.3 移动端认证流程

- 移动端通过 WebView 打开 Web 登录页完成认证，登录成功后通过 `auth/callback/token` 路由将 JWT 传递回移动端。
- 移动端 JWT 存储在 Expo SecureStore，Refresh Token 同样通过安全存储持久化。

### 14.4 移动端性能规范

- FlatList/ScrollView 必须配置 `removeClippedSubviews={true}` 和 `initialNumToRender`（≤10）。
- 图片必须明确指定 `width` 和 `height`，避免布局抖动。
- 主线程禁止执行超过 16ms 的同步操作，密集计算使用 `InteractionManager.runAfterInteractions`。

---

## 15. 错误处理与监控规范

### 15.1 后端错误响应格式

```json
{
  "error": "积分不足，请充值后重试",
  "code": "INSUFFICIENT_CREDITS",
  "requestId": "kkai-1748704800-abc123"
}
```

标准错误码：

| HTTP 状态 | Code | 说明 |
|-----------|------|------|
| 400 | `INVALID_REQUEST` | 参数校验失败 |
| 401 | `UNAUTHORIZED` | 未登录或 Token 过期 |
| 402 | `INSUFFICIENT_CREDITS` | 积分不足 |
| 403 | `FORBIDDEN` | 权限不足 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 429 | `RATE_LIMITED` | 请求频率超限 |
| 500 | `INTERNAL_ERROR` | 服务内部错误 |
| 504 | `AI_TIMEOUT` | AI 接口超时 |

### 15.2 前端错误处理规范

- 所有 API 调用必须有 `try/catch`，错误通过 Toast 展示给用户。
- AI 生成失败必须明确展示"已退款"提示，消除用户顾虑。
- 网络错误（无连接）必须有离线提示 UI，不得白屏。
- Sentry 集成于 `apps/mobile/src/__create/sentry.ts`，所有 JS 异常自动上报。

### 15.3 积分退款失败报警（P0 级）

```javascript
try {
  await refundCredits(userId, cost);
} catch (refundErr) {
  // ⚠️ 严禁 silent catch！必须记录完整上下文日志
  console.error('[P0 ALERT] 积分退款失败，需人工介入', {
    userId, cost, originalError: err.message,
    refundError: refundErr.message,
    timestamp: new Date().toISOString()
  });
  // TODO: 集成 PagerDuty / 钉钉 / 企微报警
}
```

---

## 16. 提交信息与 PR 规范

### 16.1 Commit 信息格式（Conventional Commits）

```
<type>(<scope>): <subject>

[optional body]
[optional footer]
```

| Type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `refactor` | 重构（不影响功能） |
| `style` | 样式/格式调整（不影响逻辑） |
| `docs` | 文档更新 |
| `chore` | 工程化、依赖更新 |
| `test` | 测试相关 |
| `perf` | 性能优化 |
| `security` | 安全修复（高优先级） |

Scope 参考：`server`, `web`, `mobile`, `shared`, `api-client`, `ui`, `db`, `auth`, `credits`, `admin`, `payment`

示例：

```
feat(credits): 实现积分退款原子事务与报警机制
fix(auth): 解决移动端多浏览器登录即被踢问题
security(server): 修复 CORS 通配符配置漏洞
style(web): 适配侧边栏 Provider 图标亮/暗主题
```

### 16.2 PR 规范

- PR 标题遵循 Commit 格式。
- PR 描述必须包含：**变更原因 / 实现方案 / 测试方式 / 截图（UI 变更时）**。
- 涉及积分、认证、管理员权限的 PR 需要 **2 人审查**，其余至少 **1 人审查**。
- 涉及数据库 Schema 的 PR 必须附带迁移文件，且在描述中注明回滚方案。
- `main` 分支设置分支保护：禁止 Force Push，必须通过 CI，必须 Code Review 通过。

---

## 17. 禁止事项速查表

| 序号 | 禁止行为 | 风险等级 |
|------|---------|---------|
| 🔴 | `Access-Control-Allow-Origin: *` + `credentials: true` | P0 安全漏洞 |
| 🔴 | SQL 字符串拼接（SQL 注入） | P0 安全漏洞 |
| 🔴 | 硬编码 API Key / JWT Secret | P0 安全漏洞 |
| 🔴 | 积分扣减时序错误（先调用 AI 再扣积分） | P0 业务漏洞 |
| 🔴 | 积分退款失败 silent catch | P0 资损风险 |
| 🔴 | 通过 API 将用户设为超级管理员（level=1） | P0 越权风险 |
| 🔴 | JWT 鉴权信任 Token payload 中的 adminLevel | P0 越权风险 |
| 🟠 | 在 `migrations/` 以外执行 DDL 语句 | P1 数据风险 |
| 🟠 | Gemini 模型名提取为运行时变量 | P1 行为失控 |
| 🟠 | `aspectRatio` 写在 `config.aspectRatio`（非 `imageConfig.aspectRatio`） | P1 功能失效 |
| 🟠 | 向注册接口直接写入默认积分 | P1 业务漏洞 |
| 🟠 | 跨模块引入平台专属 API（Web 引 RN 组件） | P1 构建失败 |
| 🟠 | 在 `packages/shared/` 引入含 `window` 的代码 | P1 移动端崩溃 |
| 🟡 | 使用 TypeScript `any` | P2 类型安全 |
| 🟡 | 生产代码 `console.log` | P2 信息泄露 |
| 🟡 | 无单元测试的核心业务函数 | P2 质量风险 |
| 🟡 | UI 使用硬编码颜色（非 Token） | P2 主题失效 |
| 🟡 | 间距不遵循 2px 倍数栅格（非偶数间距） | P3 设计不一致 |
| 🟡 | 无 JSDoc 注释的导出函数 | P3 可维护性 |
| 🔴 | 在 Preset（预设）配置中定义 API URL、Headers 或鉴权密钥等 HTTP 请求细节 | P0 架构越权/信息泄露 |
| 🔴 | 绕过 Model/Adapter 注册表，在业务逻辑中硬编码发送非标 API 请求 | P0 架构越权/不可维护 |
| 🔴 | 通过模型名称模糊匹配（如 `gemini`）在运行时推测并强行匹配 API 协议 | P1 架构错位/请求失败 |
| 🔴 | 在用户切换模型或 Preset 之后，复用前一个 Adapter 遗存的 Request Body | P1 状态污染/接口报错 |

---

## 18. 多 Preset、多模型、多 Adapter 解耦路由黄金法则（Preset-Model-Adapter-Provider）

> **AI 极速理解契约 (System Prompt Friendly)**:
> 本章旨在解决“官方直连”、“第三方中转”及“高度非标定制”等多元化渠道和模型预设的物理请求路由混乱痛点。所有层级职责泾渭分明，绝不混淆。

### 18.1 层级责任与核心边界

系统必须严格执行五层递进流转公式：
`Preset (预设) -> Model (模型) -> Adapter (适配器) -> Provider (渠道) -> HTTP Request`

#### 18.1.1 预设层 (Preset Layer)
- **职责**: 描述 AI 智能体的任务、角色、行为特征和参数偏好。**决定“要做什么 (What to do)”**。
- **允许字段**: `preset_id`, `preset_name`, `system_prompt`, `default_model`, `temperature`, `max_tokens`, `top_p`, `tools`, `task_type`, `output_style`, `allowed_models`, `allowed_providers`, `allowed_adapters`, `fallback_models`。
- **🚫 严禁字段**: 任何 API 网络细节（URL、HTTP 方法、Headers、Body 模板、Content-Type、鉴权格式、错误映射、ApiKey）。
- **硬性红线**: 严禁将 HTTP URL 等接口特征泄露至 Preset 层。Preset 中的 HTTP 通信参数一律视为高危越权配置，系统将默认抛出异常并予以拦截。

#### 18.1.2 模型层 (Model Layer)
- **职责**: 决定“使用哪一个模型实体 (Which model to use)”。声明模型基本属性、物理别名，并建立与特定 Adapter 和 Provider 的绑定关系。
- **允许字段**: `model_id`, `display_name`, `real_model_name` (目标渠道的物理模型别名), `provider_id`, `adapter_id`, `model_type`, `capabilities`, `context_window`, `supports_stream`, `default_parameters`。
- **🚫 严禁字段**: 任何 API 密钥、私密凭证、HTTP 请求头和复杂的请求体 payload 结构。
- **硬性红线**: **模型名称 (Model ID) 绝对不允许决定 API 调用协议**。请求格式和通信协议必须且只能由 `adapter_id` 唯一确定。

#### 18.1.3 适配器层 (Adapter Layer)
- **职责**: 决定“如何拼装和发起请求 (How to request)”。这是系统中**唯一被授权决定和拼装物理 HTTP 细节**的层级。
- **允许字段**: `adapter_id`, `protocol_type` (如 json, custom_urlencoded), `method`, `url_template`, `auth_scheme`, `header_template`, `body_template`、各种 mapping（如 `input_mapping`, `system_prompt_mapping`, `stream_mapping`）、`response_extractors` (内容提取 JSON 路径) 以及 `error_mapping` (网络状态码翻译)。

#### 18.1.4 渠道层 (Provider Layer)
- **职责**: 决定“使用什么服务和网络凭证 (Which service and credentials to use)”。维护底层通信 URL 和鉴权密钥引用。
- **允许字段**: `provider_id`, `provider_name`, `base_url`, `api_key_ref` (环境变量密钥引用), `enabled`, `timeout`, `retry_policy`, `rate_limit`, `billing_status`。
- **🚫 严禁字段**: Preset 提示词、业务级数据转换映射、响应字段提取规则。

---

### 18.2 统一内部请求对象（Unified Internal Request）

在任何 Preset 执行前，业务上下文必须统一转换为包含完整信息的标准 JSON 数据对象。所有 Adapter 必须仅从本对象中读取参数进行转换拼装：

```json
{
  "preset_id": "current_preset",
  "task_type": "chat",
  "system_prompt": "Current preset system prompt",
  "user_input": "User input content",
  "messages": [
    { "role": "system", "content": "System prompt text" },
    { "role": "user", "content": "User input text" }
  ],
  "model": "current_model_id",
  "real_model_name": "provider-real-model-name",
  "temperature": 0.7,
  "max_tokens": 2000,
  "stream": false,
  "files": [],
  "images": [],
  "tools": [],
  "metadata": {
    "source_preset": "current_preset",
    "provider_id": "provider_id",
    "adapter_id": "adapter_id"
  }
}
```

---

### 18.3 强制路由执行流程 (Routing Flow)

所有 AI 请求必须单向且严格执行以下 14 步标准流控，严禁短路或跨层调用：
1. 读取当前的 Preset。
2. 提取 `preset.default_model` 并校验其在 `Model Registry` 中存在。
3. 从模型中读取其静态绑定的 `provider_id` 与 `adapter_id`。
4. 校验 `preset.allowed_models`、`preset.allowed_providers` 及 `preset.allowed_adapters` 白名单。
5. 若所选模型、渠道或适配器未在 Preset 的允许范围内，**立即阻断请求**。
6. 读取绑定的 Provider 网络端点与鉴权凭证配置。
7. 校验 Provider 处于启用状态。
8. 读取绑定的 Adapter 转换配置。
9. 通过 Adapter 的 mappings 与 templates 将统一内部请求对象转换为真实的 HTTP 发送报文。
10. 发起 HTTP 网络请求。
11. 取得响应。
12. 使用 `adapter.response_extractors` 依次轮询解析并提取模型最终的文本回复内容。
13. 若 HTTP 请求不成功，通过 `adapter.error_mapping` 解析状态码以输出标准报错。
14. 返回标准化的最终回复给用户。

---

### 18.4 系统标准支持的 Adapter 预设模式

为降低扩充成本，系统预设并支持以下五类通信协议：
- `openai_chat_completions`: 兼容标准 OpenAI Chat 协议（JSON body, `/v1/chat/completions` 和 Bearer 认证）。
- `openai_responses`: 兼容标准 OpenAI Responses 协议。
- `claude_messages`: 兼容 Anthropic Native Messages 格式（x-api-key 鉴权，system 顶层字段）。
- `gemini_generate_content`: 兼容 Google 原生多模态 generateContent 结构（Query key 鉴权，contents/parts 结构）。
- `custom_form_urlencoded`: 兼容如速创 API 般需要 `x-www-form-urlencoded` 表单参数、指定 `content`/`model` 扁平参数、且强制非流式（`stream=false`）的扁平响应接口。

---

> **最后更新：** 2026-06-02 | **版本：** v1.5.2
> **维护者：** KK-Studio Team
> 本文件随项目迭代持续更新，每次重大架构变更后必须同步修订。
