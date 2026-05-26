# nano-banana-KK 项目优化提示词手册 v2.0
#
# 使用说明：
# 1. 把 AGENTS_V2.md 放进你的仓库根目录（替换现有的 AGENTS.md）
# 2. 按优先级顺序，把下面每条提示词复制到 Cursor / Claude Code / Codex 执行
# 3. 每条执行完后运行 npm run verify:changes 确保没破坏其他东西
# 4. 每条对应一个独立 PR，commit message 格式已在每条结尾注明

---

## 目录

- [P0 紧急修复（今天必须改）](#p0-紧急修复)
- [P1 重要优化（本周内）](#p1-重要优化)
- [P2 架构迁移（两周内）](#p2-架构迁移)
- [P3 工程质量（持续改善）](#p3-工程质量)

---

## P0. 紧急修复

> 这些问题直接影响安全性或线上稳定性，必须最优先处理。

---

### P0-01：移除所有 Netlify 残留，迁移到 Vercel + VPS

```prompt
请帮我完成 nano-banana-KK 项目从 Netlify 到 Vercel + VPS 的架构迁移清理工作。

## 背景
- 前端已迁移到 Vercel 部署（无需任何 Netlify 配置）
- 后端已迁移到 VPS（Express.js，即 payment-server/ 的扩展版）
- Netlify 的所有代码、配置、依赖都必须删除

## 需要执行的操作

### 1. 删除废弃文件
- 删除整个 `netlify/` 目录（包含 functions/auth.ts、generate-image.ts 等）
- 删除根目录的 `netlify.toml`
- 检查 `package.json` 中是否有 `@netlify/functions` 依赖，有则删除

### 2. 创建 vercel.json（Vercel 部署配置）
在项目根目录创建 `vercel.json`，内容如下：
{
  "buildCommand": "npm run build",
  "outputDirectory": "apps/web/dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    }
  ]
}

### 3. 检查 .gitignore
确保 .gitignore 中没有 `.netlify/` 之类的规则，如有则更新为 `.vercel/`

### 4. 更新 packages/api-client/src/client.ts
确认 baseURL 解析逻辑中：
- 移除任何对 /.netlify/functions/ 的引用
- 本地开发默认指向 VPS 本地端口（http://localhost:8080/api）
- 生产环境通过 VITE_PUBLIC_API_BASE_URL 环境变量注入

### 5. 全局搜索并删除残留
搜索整个仓库中所有包含以下关键词的非测试代码文件，删除或替换：
- "netlify/functions"
- "/.netlify/"
- "@netlify/functions"
- "netlify.toml"

### 验收标准
- [ ] 仓库中不存在任何 netlify/ 目录或 netlify.toml 文件
- [ ] 所有代码文件中无任何 netlify 关键词（测试文件除外）
- [ ] vercel.json 存在且格式正确
- [ ] npm run build 正常完成
- [ ] packages/api-client 的 baseURL 逻辑正确

## 注意
- 所有代码注释必须用中文
- 不要修改 server/（VPS 后端）的任何代码

commit 格式：refactor(infra): 完全移除 Netlify 残留，迁移至 Vercel + VPS 架构
```

---

### P0-02：修复密钥安全——禁止硬编码兜底值

```prompt
请修复 nano-banana-KK 项目中所有硬编码密钥兜底值的安全问题。

## 问题定位
以下文件存在危险的硬编码密钥兜底，需要全部修复：

1. payment-server/generate-image.js（或迁移后的 server/routes/generate-image.js）：
   const JWT_SECRET = process.env.JWT_SECRET || "nano-banana-kk-super-secret-fallback-token-key-9988";
   
2. server/routes/auth.js（或 netlify/functions/auth.ts）：
   const PASSWORD_SALT = process.env.PASSWORD_SALT || "nano-banana-default-salt-key-8899";

## 修复方案

### 1. 统一密钥检查逻辑
在 server/index.js 的最顶部（所有 require 之后，路由注册之前）添加启动检查：

// 启动时检查所有必需密钥，任何一个缺失则拒绝启动
// 这比用弱兜底值更安全：宁可服务不启动，也不能用伪造密钥运行
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
    throw new Error(`[严重] 环境变量 ${key} 未配置，服务拒绝启动`);
  }
}

### 2. 修改所有使用密钥的地方
将所有形如：
  const JWT_SECRET = process.env.JWT_SECRET || "硬编码兜底值";
改为：
  const JWT_SECRET = process.env.JWT_SECRET; // 启动检查已确保此值存在

### 3. 更新 .env.example
在 .env.example 中添加生成强密钥的命令注释：
# 生成 JWT_SECRET 命令（64字节随机）：
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=

# 生成 PASSWORD_SALT 命令（32字节随机）：
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
PASSWORD_SALT=

### 验收标准
- [ ] 全仓库搜索 `|| "` 不存在任何密钥的字符串兜底值
- [ ] server/index.js 顶部有密钥检查循环
- [ ] .env.example 有生成强密钥的命令注释
- [ ] 服务在缺少任意必需密钥时，启动时报错而非使用弱默认值

## 注意
- 所有注释必须用中文
- 不要改动 .env 文件（这是本地文件，不进 git）

commit 格式：security(server): 移除所有硬编码密钥兜底值，添加启动密钥检查
```

---

### P0-03：修复 CORS 配置——禁止通配符 + Authorization 并用

```prompt
请修复 nano-banana-KK 的 CORS 配置，将危险的通配符 CORS 改为 Origin 白名单模式。

## 问题
当前 server（含原 netlify/functions）的所有 Handler/路由都使用了：
"Access-Control-Allow-Origin": "*"
同时又设置了：
"Access-Control-Allow-Headers": "Authorization"

这是错误的：浏览器在 CORS 使用通配符 Origin 时，会拒绝携带 Authorization 的请求。

## 修复方案

### 1. 创建 server/lib/cors.js（统一 CORS 工厂）

在 server/lib/ 目录下创建 cors.js 文件，内容如下：

// server/lib/cors.js
// 职责：提供统一的 CORS Origin 验证逻辑
// 使用精确白名单代替通配符，支持携带 Authorization 凭据

// 生产环境白名单（从环境变量读取，或使用默认值）
const DEFAULT_ORIGINS = ["https://kkai.plus", "https://www.kkai.plus"];

// 本地开发允许 localhost 的任意端口
const LOCALHOST_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function getAllowedOrigins() {
  const envOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return envOrigins.length > 0 ? envOrigins : DEFAULT_ORIGINS;
}

function originValidator(origin, callback) {
  const allowed = getAllowedOrigins();
  // 非浏览器请求（curl、Postman、VPS 内部调用）：origin 为 undefined，直接放行
  if (!origin) { callback(null, true); return; }
  if (allowed.includes(origin) || LOCALHOST_PATTERN.test(origin)) {
    callback(null, true);
  } else {
    callback(new Error(`CORS 拒绝：Origin "${origin}" 不在白名单中`));
  }
}

const corsOptions = {
  origin: originValidator,
  credentials: true,
  allowedHeaders: ["Authorization", "Content-Type"],
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
};

module.exports = { corsOptions };

### 2. 在 server/index.js 中使用

const cors = require("cors");
const { corsOptions } = require("./lib/cors");
app.use(cors(corsOptions)); // 全局应用，替代各路由里的手动 CORS header

### 3. 清理各路由文件中的手动 CORS header
在所有路由文件中，删除以下形式的代码（由全局中间件统一处理）：
- res.setHeader("Access-Control-Allow-Origin", "*");
- res.setHeader("Access-Control-Allow-Headers", ...);
- if (req.method === "OPTIONS") { ... } // 由 cors 中间件自动处理

### 4. 更新 .env.example
# CORS 允许的前端 Origin（逗号分隔，生产环境必须配置）
ALLOWED_ORIGINS=https://kkai.plus,https://www.kkai.plus

### 验收标准
- [ ] 全仓库搜索 "Allow-Origin", "*" 不存在任何通配符配置
- [ ] server/lib/cors.js 文件存在且逻辑正确
- [ ] server/index.js 使用全局 cors 中间件
- [ ] 各路由文件无手动 CORS header 设置
- [ ] .env.example 有 ALLOWED_ORIGINS 说明

commit 格式：security(cors): 将通配符 CORS 替换为 Origin 白名单，修复凭据请求被浏览器拒绝的问题
```

---

### P0-04：统一积分扣减金额（文生图 10 分，图生图 15 分）

```prompt
请修复 nano-banana-KK 中积分扣减金额不统一的 Bug，并将积分操作统一封装到 lib/credits.js。

## 问题
项目中同一个"图像生成"操作有两个不同的扣减值：
- 旧版 netlify/functions/generate-image.ts：扣 1 分（错误）
- payment-server/generate-image.js 或 server/routes/generate-image.js：扣 10/15 分（正确）

## 正确的积分标准（来自 AGENTS.md R8.1）
- 图像生成（文生图）：扣 10 积分
- 图像编辑（图生图）：扣 15 积分
- AI 对话：扣 2 积分
- 注册赠送：+100 积分

## 修复方案

### 1. 创建 server/lib/credits.js（积分操作统一封装）

// server/lib/credits.js
// 职责：封装所有积分操作，所有路由通过此模块操作积分，禁止直接写 SQL

const { getPool } = require("./db");

// 查询用户积分，用户不存在返回 -1
async function getUserCredits(userId) {
  const pool = getPool();
  const result = await pool.query(
    "SELECT credits FROM public.users WHERE id = $1",
    [userId]
  );
  if (result.rows.length === 0) return -1;
  return parseInt(result.rows[0].credits, 10);
}

// 先扣积分（调用 AI 之前执行）
// 使用 WHERE credits >= $1 保证原子性，防止积分变负数
async function deductCredits(userId, amount) {
  const pool = getPool();
  const result = await pool.query(
    "UPDATE public.users SET credits = credits - $1, updated_at = NOW() WHERE id = $2 AND credits >= $1 RETURNING credits",
    [amount, userId]
  );
  if (result.rows.length === 0) {
    throw new Error("积分不足，原子扣减失败");
  }
  return parseInt(result.rows[0].credits, 10);
}

// 退款积分（AI 调用失败时执行）
async function refundCredits(userId, amount) {
  const pool = getPool();
  await pool.query(
    "UPDATE public.users SET credits = credits + $1, updated_at = NOW() WHERE id = $2",
    [amount, userId]
  );
}

// 充值积分（Stripe Webhook 调用）
async function addCredits(userId, amount) {
  const pool = getPool();
  const result = await pool.query(
    "UPDATE public.users SET credits = credits + $1, updated_at = NOW() WHERE id = $2 RETURNING credits",
    [amount, userId]
  );
  return parseInt(result.rows[0].credits, 10);
}

module.exports = { getUserCredits, deductCredits, refundCredits, addCredits };

### 2. 在所有路由中使用 credits.js
替换现有直接写 SQL 的积分操作，改为调用 lib/credits.js 的函数。

### 3. 修正所有扣减金额
在 generate-image 路由中：
- isEditMode = true（有 referenceImageBase64）→ COST = 15
- isEditMode = false → COST = 10
确保两个版本（Netlify 和 VPS）都改正，然后删除 Netlify 版本。

### 验收标准
- [ ] server/lib/credits.js 存在
- [ ] 全仓库搜索 "credits - 1" 不存在（积分扣 1 分的旧逻辑）
- [ ] 文生图路由中扣减金额为 10
- [ ] 图生图路由中扣减金额为 15
- [ ] 对话路由中扣减金额为 2
- [ ] 退款失败时有 console.error 告警（非 silent catch）

commit 格式：fix(credits): 统一积分扣减标准并封装 lib/credits.js，修复文生图误扣 1 分的 Bug
```

---

### P0-05：修复 Gemini aspectRatio 参数位置错误

```prompt
请修复 nano-banana-KK 中 Gemini API 调用的 aspectRatio 参数位置错误。

## 问题
当前代码中 aspectRatio 被错误地放在 config 的顶层：
config: {
  responseModalities: [...],
  aspectRatio: "16:9",  // ❌ 错误位置，会被 Gemini SDK 静默忽略
}

正确位置应该是 config.imageConfig.aspectRatio：
config: {
  responseModalities: [Modality.IMAGE, Modality.TEXT],
  imageConfig: {         // ✅ 正确
    aspectRatio: "16:9",
  },
}

## 受影响的文件
- server/routes/generate-image.js（VPS 版）
- payment-server/generate-image.js（如果还未迁移）
- 任何其他调用 ai.models.generateContent 的地方

## 修复步骤

1. 全局搜索 "aspectRatio" 关键词，找到所有 Gemini API 调用处

2. 将所有形如：
   config: { responseModalities: [...], aspectRatio: xxx }
   改为：
   config: {
     responseModalities: [Modality.IMAGE, Modality.TEXT],
     imageConfig: {
       aspectRatio: isEditMode ? undefined : aspectRatio,
       // 图像编辑模式下 aspectRatio 应为 undefined（由参考图决定比例）
     },
   }

3. 同时确认 responseModalities 使用枚举而非字符串：
   // ❌ 错误：字符串数组
   responseModalities: ["IMAGE", "TEXT"]
   // ✅ 正确：Modality 枚举
   const { GoogleGenAI, Modality } = require("@google/genai");
   responseModalities: [Modality.IMAGE, Modality.TEXT]

4. 为 aspectRatio 字段添加中文注释解释为什么在 imageConfig 下

### 验收标准
- [ ] 全仓库搜索 "aspectRatio" 均在 imageConfig 内
- [ ] responseModalities 使用 Modality 枚举（非字符串）
- [ ] 图像编辑模式下 aspectRatio 为 undefined（不强制比例）
- [ ] 代码有中文注释说明 aspectRatio 正确位置和原因

commit 格式：fix(gemini): 修复 aspectRatio 参数位置错误，从 config 顶层移动到 config.imageConfig
```

---

## P1. 重要优化

> 影响功能稳定性和代码质量，本周内完成。

---

### P1-01：实现速率限制中间件，防止 AI 接口被盗刷

```prompt
请为 nano-banana-KK 的 VPS 后端（server/）添加速率限制中间件。

## 背景
当前 API 没有主动的请求频率限制，任何人可以无限调用 AI 接口（即使有积分限制），
这会导致：1) Gemini/OpenAI 配额被暴力消耗 2) 数据库连接耗尽

## 实现方案

### 1. 安装依赖（如未安装）
在 server/package.json 中添加 "express-rate-limit": "^8.x"，然后 npm install

### 2. 创建 server/middleware/rateLimit.js

// server/middleware/rateLimit.js
// 职责：防止 API 被滥用，AI 生成接口需要额外严格的速率限制

const rateLimit = require("express-rate-limit");

// 通用限速：每 IP 每 15 分钟最多 200 次请求（适用于所有 /api/* 路由）
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

// AI 生成专用限速：每 IP 每分钟最多 10 次（防止积分绕过被暴力刷）
const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Generation rate limit exceeded. Please wait a moment." },
});

// 认证接口限速：每 IP 每 15 分钟最多 20 次（防止暴力破解密码）
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts. Please try again later." },
});

module.exports = { generalLimiter, generateLimiter, authLimiter };

### 3. 在 server/index.js 中应用中间件

const { generalLimiter, generateLimiter, authLimiter } = require("./middleware/rateLimit");

// 全局通用限速（在 cors 和 json 解析之后）
app.use(generalLimiter);

// AI 路由额外限速
app.use("/api/generate", generateLimiter, generateRouter);

// 认证路由额外限速（防暴力破解）
app.use("/api/auth", authLimiter, authRouter);

### 验收标准
- [ ] server/middleware/rateLimit.js 存在
- [ ] generateLimiter 应用于所有 /api/generate/* 路由
- [ ] authLimiter 应用于所有 /api/auth/* 路由
- [ ] 超过限制时返回 429 状态码和英文错误消息
- [ ] 代码有中文注释

commit 格式：feat(server): 添加速率限制中间件，防止 AI 接口被暴力刷用
```

---

### P1-02：统一 JWT 中间件，不要在每个路由重复验证

```prompt
请重构 nano-banana-KK 后端的 JWT 鉴权逻辑，从每个路由手动校验改为统一中间件。

## 问题
当前每个路由文件都重复写了 JWT 验证逻辑：
const userId = verifyJWT(req.headers.authorization);
if (!userId) return res.status(401).json({ error: "Unauthorized." });

## 重构方案

### 1. 创建 server/middleware/auth.js（JWT 鉴权中间件）

// server/middleware/auth.js
// 职责：Express 中间件，验证 JWT 并将 userId 注入 req.userId
// 使用方式：router.get("/path", authMiddleware, handler)

const { verifyJWT } = require("../lib/jwt");

function authMiddleware(req, res, next) {
  // 从 Authorization: Bearer <token> 中提取 token
  const userId = verifyJWT(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  // 将 userId 注入 req，后续处理器直接使用 req.userId
  req.userId = userId;
  next();
}

module.exports = { authMiddleware };

### 2. 在所有需要鉴权的路由中使用

// 修改前：
router.post("/generate/image", async (req, res) => {
  const userId = verifyJWT(req.headers.authorization);
  if (!userId) return res.status(401)...
  ...
});

// 修改后：
const { authMiddleware } = require("../middleware/auth");
router.post("/generate/image", authMiddleware, async (req, res) => {
  const { userId } = req; // 直接使用，无需重复验证
  ...
});

### 3. 需要修改的路由文件
- server/routes/generate-image.js
- server/routes/chat.js
- server/routes/user.js
- server/routes/billing.js（create-checkout 需要鉴权，plans 不需要）
- server/routes/generations.js

### 4. 保持 server/lib/jwt.js 不变（仅被中间件调用）

### 验收标准
- [ ] server/middleware/auth.js 存在
- [ ] 所有需要鉴权的路由使用 authMiddleware
- [ ] 路由 handler 内不再出现重复的 verifyJWT 调用
- [ ] req.userId 在中间件之后的所有 handler 中可用
- [ ] 公开路由（/api/auth/login、/api/billing/plans）不使用 authMiddleware

commit 格式：refactor(auth): 将 JWT 鉴权逻辑抽取为统一 Express 中间件，消除重复代码
```

---

### P1-03：清理 payment-server 废弃依赖

```prompt
请清理 nano-banana-KK 的 payment-server/package.json（或 server/package.json）中的废弃依赖。

## 需要删除的废弃依赖

在 payment-server/package.json 中找到并删除以下包（已下线，不再使用）：
1. "alipay-sdk"           → 支付宝支付已下线
2. "wechatpay-node-v3"    → 微信支付已下线  
3. "@modelcontextprotocol/sdk" → MCP 功能已移除
4. "node-fetch"           → Node.js 18+ 原生支持 fetch，无需此包
5. "eventsource"          → 若无 SSE 功能，可删除

## 操作步骤

1. 确认这些包在代码中没有任何 require/import 使用：
   - 在 payment-server/ 或 server/ 目录下搜索这些包名
   - 如果没有任何引用，可以安全删除

2. 从 package.json 的 dependencies 中删除这些包名

3. 检查 overrides 字段，删除针对已废弃包的覆盖规则（如果有）

4. 运行 npm install 更新 package-lock.json

5. 验证服务仍能正常启动：
   cd server && node index.js（或 cd payment-server && node index.js）

### 验收标准
- [ ] 以上废弃包不在任何 package.json 的 dependencies 中
- [ ] npm install 无报错
- [ ] 服务启动无 "Cannot find module" 错误
- [ ] npm audit 漏洞数量减少（废弃包通常携带漏洞）

commit 格式：chore(deps): 清理 payment-server 废弃依赖（alipay、wechatpay、MCP、node-fetch）
```

---

### P1-04：为 OpenAI 调用添加 crypto import（修复 Node 版本兼容问题）

```prompt
请修复 nano-banana-KK 中 OpenAI 对话路由使用 crypto.randomUUID() 的 Node 版本兼容问题。

## 问题
在 netlify/functions/openai-chat.ts（或迁移后的 server/routes/chat.js）中，
使用了 crypto.randomUUID() 但没有显式 import/require crypto 模块：

const completion = await openai.chat.completions.create(
  { ... },
  { headers: { "X-Client-Request-Id": crypto.randomUUID() } }
);

在 Node.js 24 中，crypto 已全局可用，但在旧版本（<19）中会报 ReferenceError。
为了明确依赖关系和跨版本兼容，必须显式导入。

## 修复

### 在 server/routes/chat.js 顶部添加显式 require：
const { randomUUID } = require("crypto"); // 显式导入，明确依赖，兼容所有 Node 版本

### 使用时改为：
headers: { "X-Client-Request-Id": randomUUID() }

### 同样检查其他路由文件中是否有隐式使用全局 crypto 的情况，一并修复

### 验收标准
- [ ] 全仓库搜索 "crypto.randomUUID()" 不存在（均改为 randomUUID()）
- [ ] 所有使用 randomUUID 的文件顶部有 const { randomUUID } = require("crypto")
- [ ] X-Client-Request-Id header 正常注入 OpenAI 请求

commit 格式：fix(chat): 显式 require crypto 模块，修复 randomUUID 跨 Node 版本兼容问题
```

---

## P2. 架构迁移

> 将 payment-server 的所有路由统一迁移到 server/ 目录，消除双重实现。

---

### P2-01：将 payment-server/routes 迁移到 server/routes，统一后端

```prompt
请完成 nano-banana-KK 的后端路由统一工作：将 payment-server/ 的所有路由迁移到 server/，最终删除 payment-server/ 目录。

## 背景
项目目前存在两套后端：
- payment-server/（旧版，VPS 上运行）
- server/（新版，应该是唯一的后端）

两套都有 generate-image 实现，但积分逻辑不同，造成混乱。

## 迁移清单

### 1. 核对 payment-server/ 中的路由，确保 server/ 中已有对应实现
- webhook.js → server/routes/webhook.js（Stripe Webhook）
- generate-image.js → server/routes/generate-image.js（图像生成）

### 2. 比较两版实现，取最完整的合并到 server/
- generate-image：以 payment-server 版本为基础（支持 creditSettlement 模式）
- 但积分金额必须统一为：文生图 10 分，图生图 15 分（见 AGENTS.md R8.1）
- 删除 creditSettlement !== 'client' 的判断逻辑（统一走服务端积分结算）

### 3. 确认 server/index.js 已挂载所有迁移的路由

### 4. 验证 server/ 本地可以正常启动并响应所有请求

### 5. 删除 payment-server/ 目录
- 先确保 server/ 上线并稳定运行
- 再执行 git rm -r payment-server/

### 6. 更新 package.json
- 根 package.json 的 workspaces 删除 "payment-server"
- 删除 payment-server 相关的 npm scripts（如 typecheck:payment-server）

### 验收标准
- [ ] server/ 目录包含所有 API 路由实现
- [ ] payment-server/ 目录不存在
- [ ] package.json workspaces 中无 payment-server
- [ ] npm run build 和 npm run test 全部通过
- [ ] VPS 运行 server/ 后所有接口正常响应

commit 格式：refactor(server): 统一后端路由到 server/，删除废弃的 payment-server 双重实现
```

---

### P2-02：创建 server/lib/jwt.js 统一 JWT 实现

```prompt
请将 nano-banana-KK 项目中分散在多处的 JWT 实现统一到 server/lib/jwt.js。

## 问题
目前 JWT 逻辑至少存在两处实现：
1. netlify/lib/jwt.ts（或 netlify/functions/auth.ts 内）
2. payment-server/generate-image.js 中的 verifyJWT 函数

两处实现使用的 JWT_SECRET 可能不一致，导致 Netlify 签发的 token 无法被 VPS 验证。

## 统一实现

### 创建 server/lib/jwt.js

// server/lib/jwt.js
// 职责：JWT 签发与验证的统一实现
// 项目中所有 JWT 操作必须通过此模块，禁止在其他地方重复实现

const crypto = require("crypto");

// JWT_SECRET 由启动时密钥检查保证存在（server/index.js）
const JWT_SECRET = process.env.JWT_SECRET;

// JWT 有效期：7 天（秒）
const JWT_EXPIRES_IN = 7 * 24 * 60 * 60;

// Base64url 编码（JWT 标准格式）
function base64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// Base64url 解码
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * 签发 JWT
 * @param {object} payload - 载荷（必须包含 userId）
 * @returns {string} JWT token
 */
function signJWT(payload) {
  const header = base64url({ alg: "HS256", typ: "JWT" });
  const body = base64url({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + JWT_EXPIRES_IN,
  });
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

/**
 * 验证 JWT
 * @param {string|undefined} authHeader - Authorization: Bearer <token>
 * @returns {string|null} 成功返回 userId，失败返回 null
 */
function verifyJWT(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7).trim();
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expected = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");

  // 使用时序安全比较，防止时序攻击
  try {
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  } catch { return null; }

  try {
    const decoded = JSON.parse(base64UrlDecode(payload));
    if (decoded.exp && Date.now() / 1000 > decoded.exp) return null;
    return decoded.userId || null;
  } catch { return null; }
}

module.exports = { signJWT, verifyJWT };

### 在所有路由中统一使用此模块
const { signJWT, verifyJWT } = require("../lib/jwt");

### 验收标准
- [ ] server/lib/jwt.js 存在
- [ ] 全仓库搜索 "createHmac" 只在 server/lib/jwt.js 出现一次
- [ ] 所有路由通过 require("../lib/jwt") 使用 JWT 功能
- [ ] JWT 验证使用 timingSafeEqual（防时序攻击）

commit 格式：refactor(jwt): 将分散的 JWT 实现统一到 server/lib/jwt.js，消除双重实现
```

---

## P3. 工程质量

> 提升代码可维护性，持续改善。

---

### P3-01：为积分退款逻辑补充单元测试

```prompt
请为 nano-banana-KK 的积分扣减和退款逻辑补充单元测试。

## 需要测试的场景（在 tests/unit/ 下创建 credits.test.ts 或 credits.test.js）

测试组 1：getUserCredits
- 用户存在时正确返回积分数值
- 用户不存在时返回 -1

测试组 2：deductCredits
- 积分充足时正确扣减，返回扣减后余额
- 积分不足时抛出错误（不能扣成负数）
- 使用参数化查询（SQL 注入安全）

测试组 3：refundCredits
- 正常退款后积分增加
- 退款失败时（DB 异常）应该抛出错误（不能 silent catch）

测试组 4：先扣后退完整流程
- 模拟 AI API 成功：积分被扣，不退款
- 模拟 AI API 失败：积分被扣后退回，净变化为 0
- 模拟 AI API 失败 + 退款也失败：告警日志被调用

## 注意
- 使用 Mock/Stub 模拟数据库调用（不连接真实 DB）
- 测试文件头部添加中文注释说明测试目的
- 使用 Node.js 原生 test runner（已在 package.json 配置）

### 验收标准
- [ ] tests/unit/credits.test.js 存在
- [ ] 至少 10 个测试用例覆盖上述场景
- [ ] npm run test:unit 全部通过
- [ ] 积分为负的情况被测试覆盖

commit 格式：test(credits): 为积分扣减和退款逻辑添加单元测试
```

---

### P3-02：将所有 console.log 生产日志统一格式

```prompt
请规范化 nano-banana-KK server/ 目录中的日志输出格式。

## 当前问题
- 各路由使用不同格式的 console.log/console.error
- 部分日志没有带模块名，难以定位来源
- 部分错误用了 console.log 而非 console.error

## 统一格式

### 在 server/lib/logger.js 中创建简单日志工具

// server/lib/logger.js
// 职责：提供统一格式的日志工具函数
// 格式：[时间戳] [级别] [模块] 消息 {上下文对象}

function formatLog(level, module, message, context) {
  const ts = new Date().toISOString();
  const ctx = context ? JSON.stringify(context) : "";
  return `[${ts}] [${level}] [${module}] ${message} ${ctx}`.trim();
}

const logger = {
  info: (module, message, context) =>
    console.log(formatLog("INFO", module, message, context)),
  warn: (module, message, context) =>
    console.warn(formatLog("WARN", module, message, context)),
  error: (module, message, context) =>
    console.error(formatLog("ERROR", module, message, context)),
};

module.exports = { logger };

### 在各路由中使用

// 修改前：
console.error("[Gemini 生成失败，已退回积分]", err.message);

// 修改后：
const { logger } = require("../lib/logger");
logger.error("generate-image", "Gemini 生成失败，已退回积分", {
  userId,
  error: err.message,
});

### 验收标准
- [ ] server/lib/logger.js 存在
- [ ] server/ 目录中无裸 console.log 调用（只有 logger.info/warn/error）
- [ ] 每条日志都包含模块名

commit 格式：refactor(logger): 统一后端日志格式，创建 server/lib/logger.js
```

---

### P3-03：补全 .env.example 并添加本地开发快速启动文档

```prompt
请更新 nano-banana-KK 的 .env.example 和 docs/DEVELOPMENT.md，
确保新开发者能在 5 分钟内启动本地开发环境。

## 1. 更新根目录 .env.example
（这是前端 Vite 使用的环境变量）

# ===========================================
# nano-banana-KK 前端环境变量配置（Vite）
# 复制为 .env，填入真实值，不要提交到 git
# ===========================================

# VPS API 基础地址（本地开发指向本地 VPS 实例）
VITE_PUBLIC_API_BASE_URL=http://localhost:8080/api

# Cloudflare Turnstile 验证码 Site Key（开发测试用：1x00000000000000000000AA）
VITE_TURNSTILE_SITE_KEY=

## 2. 更新 server/.env.example
（这是 VPS 后端使用的环境变量）

# ===========================================
# nano-banana-KK VPS 后端环境变量配置
# 复制为 server/.env，不要提交到 git
# ===========================================

# ---- AI API Keys（仅后端，绝不暴露给前端）----
# 获取地址：https://aistudio.google.com/apikey
GEMINI_API_KEY=

# 获取地址：https://platform.openai.com/api-keys
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# ---- 数据库 ----
DATABASE_URL=postgresql://user:password@localhost:5432/kk_dev

# ---- 认证（生成命令：node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"）----
JWT_SECRET=
# （生成命令：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"）
PASSWORD_SALT=

# ---- 支付 ----
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# ---- CORS 白名单（逗号分隔，本地开发可留空）----
ALLOWED_ORIGINS=https://kkai.plus,https://www.kkai.plus

# ---- 服务配置 ----
PORT=8080
NODE_ENV=development

## 3. 创建 docs/DEVELOPMENT.md（本地开发快速启动指南）

包含以下步骤（中文）：
1. 前置要求（Node.js 24+、PostgreSQL、git）
2. 克隆仓库并安装依赖
3. 配置环境变量（前端 + 后端）
4. 运行数据库迁移
5. 启动后端 VPS 服务（server/）
6. 启动前端 Vite dev server（apps/web/）
7. 访问 http://localhost:5173 验证

### 验收标准
- [ ] 根目录 .env.example 只含前端 VITE_ 变量
- [ ] server/.env.example 包含所有后端变量及生成命令注释
- [ ] docs/DEVELOPMENT.md 存在且步骤清晰
- [ ] 新开发者按文档操作可以在 5 步内启动本地环境

commit 格式：docs(dev): 更新 .env.example 并新增本地开发快速启动文档
```

---

## 快速执行建议

按以下顺序执行（每次一条，执行完验证后再下一条）：

```
P0-01 → P0-02 → P0-03 → P0-04 → P0-05
P1-01 → P1-02 → P1-03 → P1-04
P2-01 → P2-02
P3-01 → P3-02 → P3-03
```

每条执行完后运行：
```bash
npm run verify:changes
git add -A && git commit -m "..."
```

如果 verify:changes 失败，先修复再提交。不要把多个 prompt 的修改混在一起提交。
