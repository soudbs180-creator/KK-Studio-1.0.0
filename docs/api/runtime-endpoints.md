# 运行时端点目录

本目录按 `server/index.js` 的实际挂载顺序整理。鉴权列含义：`公开` 表示没有用户中间件；`用户` 表示 JWT/兼容用户身份；`管理员` 表示用户身份加管理权限；`签名` 表示第三方签名；`特殊` 表示路由自身处理凭据或返回流。

> 稳定性：路径位于 `docs/specs/openapi.yaml` 才属于当前 OpenAPI 稳定子集。其他路径是运行时、运维或兼容能力，变更时仍需检查实际调用方。

## 根级、遥测、Webhook 与静态内容

| 方法 | 路径 | 鉴权 | 用途与响应 |
|---|---|---|---|
| GET | `/healthz` | 公开 | 主服务 readiness/配置摘要；返回原始健康对象，异常可为 500。 |
| GET | `/v1/health` | 公开 | Dispatcher 数据库与本地存储健康检查；原始健康对象。 |
| GET | `/v1/metrics` | 公开 | Dispatcher 路由指标和熔断器状态；非标准 `success/data`。 |
| POST | `/webhook/stripe` | 签名 | Stripe `checkout.session.completed` 幂等结算；要求 `Stripe-Signature`。 |
| GET | `/uploads/*` | 公开 | 上传资源静态读取；文件/流响应，不计入 123 个方法端点。 |

## 认证与会话

| 方法 | 路径 | 鉴权 | 用途 |
|---|---|---|---|
| POST | `/api/v1/auth/register` | 公开 | 注册账户并返回会话。 |
| POST | `/api/v1/auth/login` | 公开 | 邮箱密码登录并设置会话。 |
| GET | `/api/v1/auth/session` | 用户 | 获取当前标准会话。 |
| GET | `/api/v1/auth/token` | 用户 | 旧式获取 JWT 与用户摘要。 |
| POST | `/api/v1/auth/refresh` | 用户/刷新令牌 | 刷新访问会话。 |
| POST | `/api/v1/auth/logout` | 公开 | 清除会话 Cookie，返回标准退出信封。 |
| POST | `/api/v1/auth/password-reset/request` | 公开 | 请求密码重置；响应不泄露账户是否存在。 |
| POST | `/api/auth/password-reset/request` | 公开 | 上一端点的非 v1 别名。 |
| POST | `/api/v1/auth/password-reset/confirm` | 公开 | 使用一次性令牌确认新密码。 |
| POST | `/api/auth/password-reset/confirm` | 公开 | 上一端点的非 v1 别名。 |
| POST | `/api/auth/login` | 公开 | 旧式登录兼容端点。 |
| POST | `/api/auth/register` | 公开 | 旧式注册兼容端点。 |
| POST | `/api/auth/refresh` | 公开/刷新令牌 | 旧式刷新兼容端点。 |
| POST | `/api/auth/logout` | 公开 | 旧式退出兼容端点。 |
| GET | `/api/auth/session` | 用户 | 旧式会话查询。 |
| POST | `/api/auth/signout` | 公开 | Web 登录退出兼容响应。 |
| POST | `/api/v1/auth/signout` | 公开 | 标准信封退出别名。 |
| POST | `/api/v1/auth/temp-users` | 公开 | 创建本地/兼容临时用户会话。 |
| GET | `/api/v1/auth/google/start` | 公开 | 返回 Google 登录授权启动信息。 |
| GET | `/api/v1/auth/google/bind/start` | 公开 | 返回 Google 账号绑定启动信息。 |
| GET | `/api/v1/auth/wechat/start` | 公开 | 返回微信登录授权启动信息。 |
| GET | `/api/v1/auth/wechat/bind/start` | 公开 | 返回微信账号绑定启动信息。 |

## Profile、用户 API 路由与密钥管理

| 方法 | 路径 | 鉴权 | 用途 |
|---|---|---|---|
| GET | `/api/v1/profile` | 用户 | 当前 Profile；该 GET 由 `user/auth.js` 的先挂载处理器负责。 |
| PATCH | `/api/v1/profile` | 用户 | 更新昵称、头像等 Profile 字段。 |
| GET | `/api/user/me` | 用户 | 旧式用户摘要。 |
| PATCH | `/api/user/me` | 用户 | 旧式用户资料更新。 |
| POST | `/api/v1/profile/password/send-code` | 用户 | 发送密码变更验证码/确认信息。 |
| POST | `/api/v1/profile/password` | 用户 | 修改当前用户密码。 |
| GET | `/api/v1/profile/key-manager` | 用户 | 获取 Key Manager 云状态。 |
| GET | `/api/v1/profile/key-manager-state` | 用户 | 上一端点的稳定别名。 |
| PUT | `/api/v1/profile/key-manager` | 用户 | 全量替换 Key Manager 云状态。 |
| PUT | `/api/v1/profile/key-manager-state` | 用户 | 上一端点的稳定别名。 |
| GET | `/api/v1/profile/user-apis` | 用户 | 列出脱敏后的用户 API 条目。 |
| PUT | `/api/v1/profile/user-apis` | 用户 | 全量替换用户 API 条目。 |
| POST | `/api/v1/profile/user-apis` | 用户 | 新建/写入用户 API 条目兼容操作。 |
| PUT | `/api/v1/profile/user-apis/payload` | 用户 | 写入 Key Manager 加密 payload。 |
| POST | `/api/v1/profile/user-apis/reveal-secret` | 用户 | 按授权请求短暂揭示单个密钥。 |
| POST | `/api/v1/profile/user-routes/:routeId/connectivity` | 用户 | 测试用户路由连通性。 |
| POST | `/api/v1/profile/user-routes/:routeId/pricing-sync` | 用户 | 从用户 Provider 同步定价。 |
| POST | `/api/v1/profile/provider-probe` | 用户 | 探测 Provider 端点、模型或协议能力。 |
| GET | `/api/v1/wuyin/catalog` | 用户/兼容 | 获取用户路由可用模型目录。 |
| POST | `/api/v1/wuyin/catalog/refresh` | 用户/兼容 | 刷新用户路由模型目录。 |

密钥接口只应返回预览、指纹或按权限揭示的数据。`GET /api/config/keys` 仅返回系统渠道是否已配置，不返回明文：

| 方法 | 路径 | 鉴权 | 用途 |
|---|---|---|---|
| GET | `/api/config/keys` | 公开 | 当前网关渠道和若干环境密钥的布尔配置状态。 |

## 生成、代理与 OCR

| 方法 | 路径 | 鉴权 | 用途与主要输入 |
|---|---|---|---|
| POST | `/api/v1/generate` | 用户 | 同步统一生成；`routeId`/`X-Key-Slot-Id` 选择用户路由，`task_type` 或 `messages` 选择图像/聊天。 |
| POST | `/api/v1/generate/async` | 用户 | 异步图像、视频、音频提交与 `task_status` 查询。 |
| POST | `/api/v1/model-proxy/system` | 用户 | 系统积分模型代理；支持 chat/image 及任务状态、取消、删除、下载模式。 |
| POST | `/api/secure-proxy` | 用户 | 旧 OpenAI 风格聊天代理；返回 `choices/message` 兼容结构。 |
| POST | `/api/ecommerce-analysis` | 公开 | 未配置占位端点，当前固定返回 501。 |
| POST | `/api/ocr` | 特殊 | 百度 OCR 代理；请求携带 Provider 凭据和 Base64 文件，成功返回纯文本。 |
| POST | `/api/v1/ocr` | 特殊 | OCR 的 v1 别名。 |

`/api/v1/generate*` 和 `/api/v1/assets` 的 JSON 预解析上限为 10 MB。生成网关会校验用户 BYOK 目标域名白名单；前端不得直接调用 Provider 密钥。

## AI Assistant 持久化

这些接口使用用户身份，但响应仍是 `{ ok, data }` 或 `{ error }` 旧式结构，尚未进入 OpenAPI。

| 方法 | 路径 | 鉴权 | 用途 |
|---|---|---|---|
| POST | `/api/ai-assistant/runs` | 用户 | Upsert Agent 运行计划和状态。 |
| POST | `/api/ai-assistant/tool-calls` | 用户 | 写入工具调用审计记录。 |
| POST | `/api/ai-assistant/skills` | 用户 | Upsert Skill 手册。 |
| DELETE | `/api/ai-assistant/skills/:id` | 用户 | 删除 Skill 记录。 |
| POST | `/api/ai-assistant/changes` | 用户 | 写入项目变更/知识更新记录。 |
| GET | `/api/ai-assistant/knowledge` | 用户 | 按 `query` 检索知识文档，最多返回近期结果。 |

## Workspace、Canvas、Workflow 与 Asset

| 方法 | 路径 | 鉴权 | 用途 |
|---|---|---|---|
| GET | `/api/v1/workspaces/:workspaceId/canvas` | 用户 | 获取工作区画布摘要。 |
| GET | `/api/v1/workspaces/layout` | 用户 | 获取当前用户的完整画布布局。 |
| GET | `/api/v1/workspaces/layout/meta` | 用户 | 获取布局版本与同步元数据。 |
| POST | `/api/v1/workspaces/layout/batch-sync` | 用户 | 批量同步画布卡片/布局增量。 |
| PUT | `/api/v1/workspaces/layout` | 用户 | 全量保存画布布局。 |
| DELETE | `/api/v1/workspaces/layout/cloud-images` | 用户 | 清理不再引用的云端图片。 |
| GET | `/api/v1/workspaces/cards/:cardId` | 用户 | 获取单张卡片及其同步信息。 |
| GET | `/api/v1/workspaces/:workspaceId/workflows/:workflowId` | 用户 | 获取工作流文档。 |
| PUT | `/api/v1/workspaces/:workspaceId/workflows/:workflowId` | 用户 | 保存工作流文档。 |
| GET | `/api/v1/assets` | 用户 | 按 `kind/cursor/limit` 列出资源。 |
| POST | `/api/v1/assets` | 用户 | 创建资源元数据或内嵌内容。 |
| GET | `/api/v1/assets/:assetId/content` | 用户 | 获取资源内容；可能返回重定向、文件或数据。 |

## Generation Task 与 Durable Batch Job

| 方法 | 路径 | 鉴权 | 用途 |
|---|---|---|---|
| POST | `/api/v1/generation-tasks` | 用户 | 创建单个生成任务。 |
| GET | `/api/v1/generation-tasks/:taskId` | 用户 | 查询单个生成任务。 |
| POST | `/api/v1/generation-jobs` | 用户 | 创建 Durable 批量生成 Job。 |
| GET | `/api/v1/generation-jobs` | 用户 | 按 `status/cursor/limit` 列出 Job。 |
| GET | `/api/v1/generation-jobs/:jobId` | 用户 | 获取 Job 与子项状态。 |
| PATCH | `/api/v1/generation-jobs/:jobId` | 用户 | 更新允许修改的 Job 字段。 |
| POST | `/api/v1/generation-jobs/:jobId/control` | 用户 | 执行 pause/resume/cancel/retry_failed 等控制动作。 |
| POST | `/api/v1/generation-jobs/:jobId/claim` | 用户 | 领取可执行子项/租约。 |
| GET | `/api/generations` | 用户 | 旧式生成历史列表。 |

## Model Catalog、Provider 与定价缓存

| 方法 | 路径 | 鉴权 | 用途 |
|---|---|---|---|
| GET | `/api/v1/model-catalog/models` | 公开 | 按可选 `kind` 获取标准模型目录。 |
| GET | `/api/v1/model-catalog/active` | 公开 | 获取启用的积分模型 Provider 分组。 |
| GET | `/api/v1/model-catalog/active-credit-models` | 公开 | 上一目录的显式积分模型入口。 |
| GET | `/api/v1/admin/credit-providers` | 管理员 | 列出积分 Provider 与模型配置（密钥脱敏）。 |
| PUT | `/api/v1/admin/credit-providers/:providerId` | 管理员 | 创建或替换 Provider 配置。 |
| DELETE | `/api/v1/admin/credit-providers/:providerId` | 管理员 | 删除 Provider 配置。 |
| GET | `/api/v1/admin/credit-providers/:providerId/pricing-cache` | 管理员 | 获取单个 Provider 定价缓存。 |
| PUT | `/api/v1/admin/credit-providers/:providerId/pricing-cache` | 管理员 | 更新单个 Provider 定价缓存。 |
| GET | `/api/v1/provider-pricing-cache` | 公开 | 按 `baseUrl` 读取共享定价缓存。 |
| PUT | `/api/v1/provider-pricing-cache` | 用户 | 按 `baseUrl` 更新共享定价缓存。 |
| POST | `/api/v1/admin/provider-probe` | 管理员 | 管理员级 Provider 能力探测。 |

## Billing 与充值

| 方法 | 路径 | 鉴权 | 用途 |
|---|---|---|---|
| GET | `/api/v1/billing/credits/balance` | 用户 | 查询积分余额与冻结余额。 |
| GET | `/api/v1/billing/credits/transactions` | 用户 | 按类型、状态、limit 查询积分流水。 |
| POST | `/api/v1/billing/credits/debit` | 用户 | 使用业务引用和幂等键扣减积分。 |
| POST | `/api/v1/billing/credits/refunds` | 用户 | 对原扣减交易退款。 |
| GET | `/api/billing/plans` | 公开 | 旧式 Stripe 套餐列表。 |
| POST | `/api/billing/create-checkout` | 用户 | 创建 Stripe Checkout。 |
| GET | `/api/v1/billing/payment-channels` | 用户 | 获取可用充值渠道配置。 |
| GET | `/api/v1/billing/exchange-rates` | 用户 | 获取积分兑换率。 |
| POST | `/api/v1/billing/recharge-submissions` | 用户 | 创建充值申请。 |
| POST | `/api/v1/billing/submit-recharge` | 用户 | 兼容的一步式充值提交。 |
| POST | `/api/v1/billing/recharge-submissions/:submissionId/proof` | 用户 | 提交充值证明。 |
| POST | `/api/v1/billing/recharge-submissions/:submissionId/mark-paid` | 用户 | 标记用户侧已付款。 |

## 标准 Admin 契约

| 方法 | 路径 | 鉴权 | 用途 |
|---|---|---|---|
| GET | `/api/v1/admin/access` | 管理员 | 获取管理员访问状态与密码变更要求。 |
| POST | `/api/v1/admin/session/verify-password` | 管理员 | 验证管理员密码并签发短期管理员会话。 |
| POST | `/api/v1/admin/password` | 管理员 | 修改管理员密码。 |
| GET | `/api/v1/admin/users` | 管理员 | 按 `page/limit/search` 列出用户。 |
| POST | `/api/v1/admin/users/roles` | 管理员 | 设置用户角色。 |
| POST | `/api/v1/admin/models` | 管理员 | 新建标准模型目录项。 |
| POST | `/api/v1/admin/billing/recharges` | 管理员 | 管理员为账户充值积分。 |
| POST | `/api/v1/admin/billing/credit-adjustments` | 管理员 | 管理员正负调整积分。 |
| GET | `/api/v1/admin/billing/accounts/:identity` | 管理员 | 按用户 ID/邮箱查询积分账户。 |
| PUT | `/api/v1/admin/billing/exchange-rates` | 管理员 | Upsert 兑换率。 |
| GET | `/api/v1/admin/billing/recharge-submissions` | 管理员 | 列出充值申请。 |
| GET | `/api/v1/admin/billing/recharge-submissions/:submissionId` | 管理员 | 获取充值申请详情。 |
| POST | `/api/v1/admin/billing/recharge-submissions/:submissionId/review` | 管理员 | 审核充值申请并执行相应积分变更。 |

## 旧 `/api/admin/*` 管理接口

这些路由仍被当前前端部分设置页使用，但响应和字段不完全遵循共享契约。

| 方法 | 路径 | 鉴权 | 用途 |
|---|---|---|---|
| GET | `/api/admin/users` | 管理员 | 旧式用户列表。 |
| POST | `/api/admin/users/:id/recharge` | 管理员 | 旧式用户充值。 |
| PATCH | `/api/admin/users/:id/credits` | 管理员 | 旧式积分调整。 |
| PATCH | `/api/admin/users/:id/admin-level` | 超级管理员 | 修改旧式 admin level。 |
| GET | `/api/admin/api-config` | 管理员 | 读取脱敏后的 API 配置。 |
| PATCH | `/api/admin/api-config` | 管理员 | 更新服务端 API 配置。 |

## 路由重复与优先级

`server/index.js` 先挂载 `/api` 下的 `apiRouter`，再挂载根级 `contractCompatRouter`。`apiRouter` 内部顺序为 generation → user API payload → user auth/profile/wuyin → admin → probe → OCR → AI assistant → config。Express 的首个完成响应的同方法同路径处理器生效。

展开数组别名后，以下 8 条注册被更早路由覆盖：

| 方法与路径 | 生效处理器 | 后置重复处理器 |
|---|---|---|
| `GET /api/v1/profile` | `server/routes/user/auth.js` | `server/routes/user/profile.js` |
| `PUT /api/v1/profile/key-manager` | `server/routes/user-api-payload-router.js` | `server/routes/user/profile.js` |
| `PUT /api/v1/profile/key-manager-state` | `server/routes/user-api-payload-router.js` | `server/routes/user/profile.js` |
| `PUT /api/v1/profile/user-apis` | `server/routes/user-api-payload-router.js` | `server/routes/user/profile.js` |
| `PUT /api/v1/profile/user-apis/payload` | `server/routes/user-api-payload-router.js` | `server/routes/user/profile.js` |
| `POST /api/v1/profile/user-apis` | `server/routes/user-api-payload-router.js` | `server/routes/user/profile.js` |
| `GET /api/v1/wuyin/catalog` | `server/routes/user/profile.js` | `server/routes/user/wuyin.js` |
| `POST /api/v1/wuyin/catalog/refresh` | `server/routes/user/profile.js` | `server/routes/user/wuyin.js` |

## 默认错误

- 未匹配路由：HTTP 404，`{ "error": "Endpoint not found or legacy route disabled." }`。
- 未处理异常：HTTP 500，`{ "error": "Internal server error." }`。
- 标准兼容契约使用 `success/error/meta`；旧式路由的错误结构以各表说明和源码为准。

