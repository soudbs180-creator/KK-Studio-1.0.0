Status: reference

<!-- AI_ROUTING_KEY: routing, dispatcher, consolidation, refactor, generate -->
# server/routes 路由拓扑与合并方案（WS-3 只读分析）

> 本文档为**只读分析**，不改任何运行代码。依据 `server/index.js` 实际装配与各 router 体量。
> 关联 Issue #6（WS-3）、母 Issue #3（完善 API 路由系统）。

## 1. 实际挂载拓扑（来自 server/index.js）

按 `app.use` 注册顺序（顺序即优先级，先注册先匹配）：

| 顺序 | 挂载前缀 | Router | 体量 | 说明 |
|---|---|---|---|---|
| 1 | `/webhook` | webhook | 5KB | Stripe 等回调，独立，OK |
| 2 | `/api` | **user-api-payload-router** | 10KB | 保存用户 API 配置；注释：必须在 legacy userRouter 前，保存时自动补齐 AI Router 元数据 |
| 3 | `/api` | **user-wuyin-strict-router** | 25KB | Wuyin 专用严格路由 |
| 4 | `/api` | **user-ai-router** | 12KB | 用户自带 Key 的新 AI Router；注释：只接管 `mode=chat`，其它模式 `next()` 回落旧逻辑 |
| 5 | `/api` | **user (legacy)** | **98KB** | 巨石 god file，承载大量历史端点 |
| 6 | `/api` | **credit-provider-router** | 12KB | 注释：必须挂在 legacy adminRouter 前，否则旧路由会吞掉 requestProfileId/routeStrategy |
| 7 | `/api` | **admin (legacy)** | 25KB | 管理端 |
| 8 | `/api` | provider-probe | 4KB | 供应商探测 |
| 9 | `/api` | chat | 6KB | |
| 10 | `/api` | generate-image | 0.6KB | |
| 11 | `/api` | ocr | 4KB | |
| 12 | `/api` | ai-assistant | 7KB | |
| 13 | `/api` | config | 0.7KB | |
| 14 | （无前缀，兜底） | **contract-compat** | **48KB** | 兼容层，挂在最后兜所有未命中 |
| 15 | `/` | telemetry | 2KB | |

## 2. 核心问题：脆弱的“顺序 + 回落”路由

- **6 个 router 共用 `/api` 前缀**（第 2~13 行多数），**靠注册顺序 + `next()` 回落**到 98KB 的 legacy `user.js` / `admin.js` 才能正确工作。
- `server/index.js` 自带注释印证脆弱性：
  - “用户自带 Key 的新 AI Router 必须挂在 legacy userRouter 前；只接管 mode=chat，其它模式 next() 回落旧逻辑。”
  - “credit-provider-router 必须挂在 legacy adminRouter 之前，否则旧路由会吞掉 requestProfileId/routeStrategy。”
- 后果：任何挂载顺序调整、或某 router 误吞请求，都会**静默改变计费/路由行为**；新人/AI 极难安全改动。
- `contract-compat.js`(48KB) 作为无前缀兜底，进一步放大“谁处理了这个请求”的不确定性。

## 3. 目标拓扑（收敛）

所有“模型/供应商/生成/代理”请求收敛为两条标准入口，内部统一走 `server/lib/dispatcher`（已存在的 adapterRegistry + providerProfiles）：

```
POST /api/v1/generate          # 同步生成（chat/image 同步）
POST /api/v1/generate/async    # 异步提交 -> 返回 jobId
GET  /api/v1/generate/:jobId   # 异步轮询
```

- 鉴权/计费/限流作为中间件统一前置，不再分散在各 router。
- 旧端点保留为 **薄适配层**：内部转调 dispatcher，并打 `@deprecated` 与调用计数埋点。

## 4. 分阶段迁移（小步、影子并存、可回滚）

| 阶段 | 内容 | 风险 | 回滚 |
|---|---|---|---|
| S0 | 加路由调用计数埋点（telemetry），摸清各 router 真实流量与未命中回落次数 | 极低（只读埋点） | 移除埋点 |
| S1 | 新建 `/api/v1/generate*` 入口，内部走 dispatcher；与旧路径**影子并存**（不切流量） | 低 | 不挂载新路由 |
| S2 | 前端/客户端按模型逐类切到新入口；旧入口转薄适配层 | 中（计费主链路） | 切回旧入口 |
| S3 | `user.js`(98KB) 按域拆分：`user/auth.js`、`user/credits.js`、`user/assets.js`、`user/profile.js`、`user/api-config.js` | 中 | 分文件 PR，逐个回滚 |
| S4 | 合并 `user-ai-router`/`user-api-payload-router`/`user-wuyin-strict-router`/`chat`/`generate-image` 的重叠职责到 dispatcher 入口；移除顺序依赖 | 高 | 指标无回退后再删旧 |
| S5 | 评估 `contract-compat.js`(48KB) 兜底是否仍需要；能命名化的端点显式化 | 中 | 保留兜底 |

## 5. 验证门禁（每阶段）
`npm run verify:changes`（含 architecture/governance/typecheck/test/governance:providers）+ 计费回归 + 灰度 + 审计回放。

## 6. user.js(98KB) 拆分清单（建议域边界）
- `auth`：登录/JWT/会话
- `credits`：余额预扣/结算/退款（计费核心，最高敏感）
- `api-config`：用户 API 配置保存（与 user-api-payload-router 职责重叠，应合并）
- `assets`：静态资产/落盘
- `profile`：用户资料
- `model/generation`：迁移到 dispatcher 入口

> 拆分时严禁改变计费事务边界与幂等键；每个子模块独立 PR + 契约测试。
