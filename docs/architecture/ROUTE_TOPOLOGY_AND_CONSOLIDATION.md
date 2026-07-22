Status: reference

<!-- AI_ROUTING_KEY: routing, dispatcher, consolidation, refactor, generate -->
# services/api 路由拓扑与收敛边界

Last verified: 2026-07-22

本文件记录当前 Express 路由装配事实及剩余兼容边界。当前源码、`services/api/index.js` 与 `services/api/routes/api.js` 优先于历史分析。

## 1. 当前装配拓扑

`services/api/index.js` 只挂载四个顶层入口：

| 顺序 | 挂载前缀 | 当前 owner | 说明 |
|---|---|---|---|
| 1 | `/webhook` | `services/api/routes/webhook.js` | 支付与 Provider 回调。 |
| 2 | `/api` | `services/api/routes/api.js` | 统一 API namespace，内部以确定顺序组合领域 router。 |
| 3 | 无前缀 | `services/api/routes/contract-compat.js` | 已登记的薄兼容入口；只能在显式删除门禁后缩减。 |
| 4 | `/` | `services/api/routes/telemetry.js` | 运行诊断与遥测。 |

`services/api/routes/api.js` 当前按以下顺序组合：

```text
generate-v1
→ generation-v3
→ capability-graph
→ user-api-payload-router
→ user
→ admin
→ provider-probe
→ ocr
→ ai-assistant
→ config
```

顺序仍是兼容契约的一部分，但不再由 `services/api/index.js` 分散注册。

## 2. 用户路由职责

`services/api/routes/user.js` 是无业务逻辑的组合入口：

- `services/api/routes/user/auth.js`：认证、密码、JWT 与 Session。
- `services/api/routes/user/profile.js`：用户资料、Key Manager、用户 Provider 路由和兼容代理。
- `services/api/routes/user/wuyin.js`：Wuyin catalog、refresh 与 `/pricing-proxy` 的 HTTP owner。
- `services/api/routes/user/shared/requestContext.js`：共享 owner 解析、请求元数据与响应 envelope，不承载领域业务。

公开路径、DTO、状态码和响应 envelope 在拆分中保持不变。新增用户领域路由必须进入对应 owner，禁止重新把业务写回 `services/api/routes/user.js`。

## 3. 生成控制面

当前主链路分为兼容入口与 v3 权威控制面：

```text
POST /api/v1/generate
POST /api/v1/generate/async
  → services/api/routes/generate-v1.js
  → generation-v3 Quote / Job / Billing bridge

POST /api/v1/generation/quotes
POST /api/v1/generation/jobs
POST /api/v1/generation/jobs/:jobId/submit
GET  /api/v1/generation/jobs/:jobId
POST /api/v1/generation/jobs/:jobId/control
  → services/api/routes/generation-v3.js
  → services/api/lib/generation-v3/
```

图片 Durable Worker 只在服务端用户 scope flag 命中时接管 v3 submit；默认 `off` 保持旧同步提交。视频与音频仍未切入服务端 Worker，不得提前删除浏览器兼容轮询。

## 4. 剩余偏差与删除门禁

- `user-api-payload-router.js` 与规范化 Provider Connection 仍处于 dual-read 兼容期。
- `contract-compat.js` 继续保留已登记操作，不允许恢复成无边界巨石 router。
- 旧生成入口只能在客户端切流、flag 回滚验证和观测窗口完成后缩减。
- Provider、Model、Capability 与 pricing 只能从 canonical catalog / 服务端投影读取，禁止在新 router 复制目录。

## 5. 验证

每次调整路由装配至少运行：

```bash
npm run architecture:check
npm run governance:check
npm run typecheck
npm run test
```

涉及计费、Provider 或兼容入口时追加完整 `verify:changes`，并在 Handoff 记录 flag、回滚、观测和删除条件。
