<!-- AI_ROUTING_KEY: security, backlog, secret, cors, jwt, billing -->
# Security and Engineering Backlog — KK Studio v1.5.9

Last updated: 2026-06-03  
Primary rules: `AGENTS.md`

---

## 0. 文档定位

本文件整合历史审计报告与优化提示词中的安全、后端、计费、CORS、JWT、Provider、数据库、工程质量待办，并统一到当前事实：

```text
当前项目版本：KK Studio v1.5.9
当前后端事实：server/ Express / VPS
当前 Web 入口：apps/web/
旧独立支付后端描述：只作迁移追溯，不作为当前开发入口
```

Agent 处理安全敏感任务时必须先读 `AGENTS.md`，再读本文件。

---

## 1. P0：安全与线上稳定优先级

### P0-01：清理旧后端 / 旧部署残留，收口到 server/ + 当前部署事实

目标：

- 全仓不再把旧无服务器函数目录作为当前后端入口。
- 全仓不再把 `payment-server` 作为主要后端入口。
- `packages/api-client` baseURL 指向当前后端配置。
- 文档明确当前事实是 `server/` Express / VPS。

检查关键词：

```text
payment-server
apps/api
apps/payment-sidecar
billing
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
```

规则：

1. 先搜索是否仍被当前运行代码引用。
2. 只删除未引用依赖。
3. 更新 lockfile。
4. 运行 build / test。

---
