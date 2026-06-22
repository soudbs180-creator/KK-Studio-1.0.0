<!-- AI_ROUTING_KEY: security, backlog, secret, cors, jwt, billing -->
# Security and Engineering Backlog — KK Studio v1.5.7

Last updated: 2026-06-03  
Primary rules: `AGENTS.md`

---

## 0. 文档定位

本文件整合历史审计报告与优化提示词中的安全、后端、计费、CORS、JWT、Provider、数据库、工程质量待办，并统一到当前事实：

```text
当前项目版本：KK Studio v1.5.7
当前后端事实：server/ Express / VPS
当前 Web 入口：apps/web/
历史 Netlify / payment-server 描述：只作迁移追溯，不作为当前开发入口
```

Agent 处理安全敏感任务时必须先读 `AGENTS.md`，再读本文件。

---

## 1. P0：安全与线上稳定优先级

### P0-01：清理旧后端 / 旧部署残留，收口到 server/ + 当前部署事实

目标：

- 全仓不再把 `netlify/functions` 作为当前后端入口。
- 全仓不再把 `payment-server` 作为主要后端入口。
- `packages/api-client` baseURL 指向当前后端配置。
- 文档明确当前事实是 `server/` Express / VPS。

检查关键词：

```text
netlify/functions
/.netlify/
@netlify/functions
netlify.toml
payment-server
```

执行规则：

1. 先判断这些词出现在历史文档、测试兼容层还是当前运行代码。
2. 历史文档可保留但必须标注“历史事实”。
3. 当前运行代码若仍依赖旧入口，必须小步迁移并补测试。
4. 不一次性大重构无关模块。

验收：

- 当前开发入口清晰指向 `server/`。
- `packages/api-client` 不再指向废弃后端路径。
- 文档不再把旧后端作为当前事实。

---

### P0-02：移除所有硬编码密钥 fallback

风险：公开仓库中的默认密钥等同泄漏。

禁止模式：

```js
const JWT_SECRET = process.env.JWT_SECRET || "some-default-secret";
const PASSWORD_SALT = process.env.PASSWORD_SALT || "some-default-salt";
```

目标实现：

```js
const REQUIRED_ENV_VARS = [
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'JWT_SECRET',
  'PASSWORD_SALT',
  'DATABASE_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
];

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    throw new Error(`[严重] 环境变量 ${key} 未配置，服务拒绝启动`);
  }
}
```

验收：

- 搜索 `process.env.` 搭配 `|| "` 不存在密钥 fallback。
- `.env.example` 只包含占位和生成命令，不包含真实值。
- 缺少必需密钥时后端拒绝启动。
- 已泄漏的历史 fallback 字符串记录为安全事故并要求生产轮换。

---

### P0-03：CORS 白名单化

风险：`Access-Control-Allow-Origin: *` 与 Authorization / 凭据请求并用会导致浏览器拒绝或安全边界混乱。

目标：

- `server/lib/cors.js` 提供统一 CORS origin 验证。
- 生产环境使用 `ALLOWED_ORIGINS` 白名单。
- 本地开发允许 `localhost` / `127.0.0.1`。
- 路由文件不手写分散 CORS header。

验收：

- 全仓无当前运行代码设置 `Access-Control-Allow-Origin: *`。
- `server/index.js` 全局应用 CORS middleware。
- `.env.example` 包含 `ALLOWED_ORIGINS`。
- 恶意 Origin 不返回允许头。

---

### P0-04：积分扣减与退款统一

正确成本常量：

```text
图像生成 / 文生图：10 credits
图像编辑 / 图生图：15 credits
AI 对话：2 credits
注册赠送：100 credits
```

目标：

- `server/lib/credits.js` 封装积分操作。
- 业务路由不直接散写积分 SQL。
- 扣减使用 `WHERE credits >= amount` 原子更新。
- 失败退款有日志和流水。
- 后续引入 `credit_transactions` 表。

验收：

- 无 `credits - 1` 等旧误扣逻辑。
- 文生图 10，图生图 15，对话 2。
- 退款失败不会 silent catch。
- 单元测试覆盖余额不足、防负数、退款失败。

---

### P0-05：Gemini API 参数修正

目标：

```js
config: {
  responseModalities: [Modality.IMAGE, Modality.TEXT],
  imageConfig: {
    aspectRatio: isEditMode ? undefined : aspectRatio,
  },
}
```

规则：

- `aspectRatio` 必须位于 `config.imageConfig.aspectRatio`。
- 图像编辑模式下不强制 aspectRatio。
- `responseModalities` 使用 `Modality` 枚举，不使用裸字符串。
- 区分 429、503、safety blocked、普通 500。

验收：

- 相关调用不再把 `aspectRatio` 放在 config 顶层。
- 使用 `Modality.IMAGE` / `Modality.TEXT`。
- 测试覆盖 safety blocked、rate limited、success usage metadata。

---

## 2. P1：重要优化

### P1-01：后端速率限制

目标文件：

```text
server/middleware/rateLimit.js
```

建议限制：

```text
generalLimiter: 15 min / 200 req per IP
generateLimiter: 1 min / 10 req per IP
authLimiter: 15 min / 20 req per IP
```

验收：

- `/api/generate/*` 应用 generateLimiter。
- `/api/auth/*` 应用 authLimiter。
- 超限返回 429。

---

### P1-02：统一 JWT 中间件

目标文件：

```text
server/middleware/auth.js
server/lib/jwt.js
```

规则：

- 路由不重复写 `verifyJWT(req.headers.authorization)`。
- 中间件验证成功后注入 `req.userId`。
- 公开路由如 login / plans 不加 authMiddleware。
- JWT 签名比较使用 timingSafeEqual。

---

### P1-03：清理废弃依赖

候选依赖：

```text
alipay-sdk
wechatpay-node-v3
@modelcontextprotocol/sdk
node-fetch
eventsource
@netlify/functions
```

规则：

1. 先搜索是否仍被当前运行代码引用。
2. 只删除未引用依赖。
3. 更新 lockfile。
4. 运行 build / test。

---

### P1-04：显式导入 crypto randomUUID

规则：

```js
const { randomUUID } = require('crypto');
```

禁用隐式：

```js
crypto.randomUUID()
```

验收：

- 使用 randomUUID 的文件顶部显式导入。
- `X-Client-Request-Id` 正常注入。

---

## 3. P2：架构迁移与后端统一

### P2-01：统一后端路由到 server/

目标：

```text
server/ 是唯一后端运行时
payment-server/ 只作历史，不作当前入口
```

步骤：

1. 核对旧 `payment-server` 路由与当前 `server/routes`。
2. 对仍缺失能力做最小迁移。
3. 统一积分、JWT、CORS、日志、错误格式。
4. 更新 package workspaces 与 scripts。
5. 删除旧目录前必须验证 server 可启动并响应所有接口。

---

### P2-02：统一 JWT 实现

目标：

```text
server/lib/jwt.js 是 JWT 签发与验证唯一实现
```

验收：

- `createHmac` 只在 `server/lib/jwt.js` 或明确测试中出现。
- 路由统一引用 `require('../lib/jwt')`。
- 无多套 JWT_SECRET。

---

### P2-03：数据库积分流水与 generations 字段统一

建议迁移：

```sql
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id TEXT,
  balance_after INTEGER NOT NULL,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'done',
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'image_generation',
  ADD COLUMN IF NOT EXISTS credits_cost INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS usage_metadata JSONB;
```

验收：

- 每次扣 / 退 / 充值都有流水。
- 客服可通过 `user_id + request_id + created_at` 查账。
- `users.credits` 与流水可对账。

---

## 4. P3：工程质量

### P3-01：积分测试

覆盖：

- 用户存在 / 不存在。
- 积分充足扣减。
- 积分不足抛错。
- 参数化查询。
- 正常退款。
- 退款失败抛错或告警。
- AI 成功扣款不退款。
- AI 失败扣后退回。
- AI 失败且退款失败有错误日志。

---

### P3-02：统一后端日志

目标文件：

```text
server/lib/logger.js
```

格式：

```text
[ISO_TIME] [LEVEL] [MODULE] message {context}
```

规则：

- 后端当前运行代码不使用裸 `console.log`。
- 错误用 `logger.error`。
- 日志上下文脱敏。

---

### P3-03：环境变量与开发文档

目标：

- 根 `.env.example` 只放前端 Vite 变量。
- `server/.env.example` 放后端变量。
- 文档说明本地启动、数据库迁移、后端启动、前端启动。
- 示例密钥只写生成命令，不写真实值。

---

## 5. 安全任务执行模板

```md
## Task: <name>

### Risk
- 风险等级：P0 / P1 / P2 / P3

### Current facts checked
- 读取文件：
- 当前代码路径：

### Change plan
1.
2.
3.

### Files touched
-

### Validation
- Passed:
- Not run:
- Reason:

### Rollback
-

### Knowledge updates
-
```

---

## 6. 禁止事项

```text
不使用硬编码密钥 fallback
不使用 CORS * 搭配 Authorization
不在前端直连受保护 Provider
不绕过积分扣减 / 退款 / 审计
不复制第二套 JWT / CORS / credits 实现
不把旧 Netlify / payment-server 文档当当前事实
不在 migrations 之外改 Schema
不为通过测试删除安全检查
```
