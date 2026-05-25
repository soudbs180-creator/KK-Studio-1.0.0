# KK Studio 现状盘点与迁移映射

文档用途：作为“规格驱动重构”的现状输入基线，避免后续迁移脱离现有仓库。

## 1. 当前目录现状

| 路径 | 当前角色 | 现状判断 |
| --- | --- | --- |
| [src](/Users/Administrator/Downloads/KK-Studio-1.0.0/src) | React/Vite 主前端 | 真实运行中的主应用 |
| [src/services](/Users/Administrator/Downloads/KK-Studio-1.0.0/src/services) | 前端服务集合 | 业务编排偏厚，后续需拆到 API/BFF |
| [src/context](/Users/Administrator/Downloads/KK-Studio-1.0.0/src/context) | 全局状态 | 需逐步收敛为 UI state + session state |
| [server](/Users/Administrator/Downloads/KK-Studio-1.0.0/server) | 轻量 Node 路由 | 当前可视为主 API 雏形 |
| [api](/Users/Administrator/Downloads/KK-Studio-1.0.0/api) | 边缘/Serverless 路由 | 与 `server` 存在双入口问题 |
| [billing](/Users/Administrator/Downloads/KK-Studio-1.0.0/billing) | 计费路由与引擎 | 域模型雏形明确，适合迁入模块化 API |
| [payment-server](/Users/Administrator/Downloads/KK-Studio-1.0.0/payment-server) | 支付边车服务 | 建议保留独立部署，不并回前端 |
| [supabase](/Users/Administrator/Downloads/KK-Studio-1.0.0/supabase) | Supabase 迁移与函数 | 是当前数据层主要来源 |
| [migrations](/Users/Administrator/Downloads/KK-Studio-1.0.0/migrations) | 历史 SQL | 与 `supabase/migrations` 双轨并存 |
| [tests/integration](/Users/Administrator/Downloads/KK-Studio-1.0.0/tests/integration) | 集成测试 | 已具备账务与性能测试起点 |

## 2. 当前前端结构摘要

当前前端已具备以下稳定域：

- 画布与工作台：`src/components/canvas`、`src/components/workspace`、`src/workflow`
- 设置与账户：`src/components/settings`、`src/components/auth`、`src/context/AuthContext.tsx`
- 账务：`src/context/BillingContext.tsx`、`src/services/billing`
- 模型与供应商：`src/services/model`、`src/services/api`
- 生成能力：`src/services/llm`、`src/services/image`、`src/services/video`
- 存储同步：`src/services/storage`、`src/services/system/syncService.ts`

### 现状问题

- `App.tsx` 仍承担较重的组合与编排职责。
- `src/services` 中同时存在 UI 侧辅助、业务流程、第三方调用与持久化能力。
- 前后端边界尚未彻底固定，部分能力仍由前端直连数据层/代理层。

## 3. 当前后端与数据层摘要

### 3.1 Node/API 入口

- [server/index.ts](/Users/Administrator/Downloads/KK-Studio-1.0.0/server/index.ts)：轻量 API 容器
- [server/auth_routes.ts](/Users/Administrator/Downloads/KK-Studio-1.0.0/server/auth_routes.ts)：认证路由雏形
- [server/billing_routes.ts](/Users/Administrator/Downloads/KK-Studio-1.0.0/server/billing_routes.ts)：账务入口
- [api/pricing-proxy.ts](/Users/Administrator/Downloads/KK-Studio-1.0.0/api/pricing-proxy.ts)：独立 serverless handler
- [api/nutrient-document.ts](/Users/Administrator/Downloads/KK-Studio-1.0.0/api/nutrient-document.ts)：文档处理 handler

### 3.2 支付边车

- [payment-server/index.js](/Users/Administrator/Downloads/KK-Studio-1.0.0/payment-server/index.js)：支付宝下单、查询、回调入口
- 现状判断：应保留独立服务身份，但需要对主 API 定义清晰的内部回写契约

### 3.3 数据层

- [supabase/migrations](/Users/Administrator/Downloads/KK-Studio-1.0.0/supabase/migrations)：现行迁移主干
- [supabase/functions/secure-model-proxy/index.ts](/Users/Administrator/Downloads/KK-Studio-1.0.0/supabase/functions/secure-model-proxy/index.ts)：安全代理函数
- [migrations](/Users/Administrator/Downloads/KK-Studio-1.0.0/migrations)：历史账务 schema

### 3.4 当前主要数据表

结合仓库文档与迁移文件，当前可识别的核心表包括：

- `profiles`
- `user_credits`
- `credit_transactions`
- `admin_auth`
- `admin_credit_models`
- `temp_users`
- `provider_pricing_cache`
- `credit_exchange_rates`
- `generation_tasks`
- `payment_orders`
- `payment_callbacks`
- `admin_sessions`

补充判断：

- `user_api_keys` 已不再是当前运行时硬依赖，现阶段更多通过云端状态与安全存储兼容。
- `user_credits` / `credit_transactions` 仍是当前账务运行时真表，尚未切换到目标态命名的 `credit_accounts` / `credit_ledger`。
- `payment_orders` / `payment_callbacks` / `admin_sessions` 已进入当前运行时主干，应视为已迁入的新结构基础设施。

## 4. 目标迁移映射

| 当前实现 | 目标归属 | 动作 |
| --- | --- | --- |
| `src/services/api` | `apps/api/modules/model-catalog` + `packages/contracts` | 把供应商/模型配置迁出 UI 业务编排 |
| `src/services/billing` | `apps/api/modules/billing` + `packages/domain` | 保留计算逻辑，新增服务端入口与 typed DTO |
| `src/services/llm` | `apps/api/modules/generation` | 前端仅保留 client 与展示状态 |
| `src/services/storage` | `apps/api/modules/storage-sync` + `infra/supabase` | 明确客户端缓存和服务端持久化职责 |
| `server/*` | `apps/api/src/modules/*` | 逐个路由映射到模块控制器 |
| `billing/*` | `apps/api/modules/billing/*` | 拆成 `presentation/application/domain/infrastructure` |
| `payment-server/*` | `apps/payment-sidecar/*` | 保留独立部署并定义内部事件回写 |
| `supabase/*` | `infra/supabase/*` | 迁移规范先收口，文件逐步归并 |

## 5. 迁移优先级

优先级 P0：

- `auth`
- `billing`
- `generation`
- `workflow`

优先级 P1：

- `model-catalog`
- `asset-library`
- `storage-sync`

优先级 P2：

- `admin-console`
- `workspace-canvas`

## 6. 风险与兼容要求

- 不允许一次性移动根目录 `src`，避免破坏当前运行。
- 不允许直接删除 `payment-server`，必须先建立 `apps/payment-sidecar` 规格与回写契约。
- 不允许在迁移早期直接重命名历史表，必须通过兼容视图、兼容仓储或兼容 DTO 过渡。
- 不允许新增前端直连数据库的业务路径。
