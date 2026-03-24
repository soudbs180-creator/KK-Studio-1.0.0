# KK Studio 项目规格书

文档状态：Draft Frozen v1  
适用范围：当前 `KK Studio` 仓库渐进式重构  
默认语言：中文  
字段与代码命名：英文

## 1. 目标与边界

本规格书用于把当前仓库收敛为“模块化单体 + BFF/API + 独立支付边车 + Supabase/PostgreSQL 数据底座”的标准全栈工程。

本次规格冻结以下内容：

- 目标目录结构
- 模块职责矩阵
- MVC 闭环与前后端对接规范
- API 契约信封、错误码与 DTO 命名规则
- 数据模型与库表约束
- 编码规范、架构约束、测试标准
- 现状到目标结构的迁移路线

本次规格不直接要求：

- 一次性搬迁现有 `src/`、`server/`、`payment-server/`、`supabase/`
- 一次性切换所有前端调用方式
- 一次性替换所有历史表名与 RPC 名称

## 2. 现状摘要

当前仓库已经具备前端、轻量后端、支付边车、Supabase 与测试基线，但职责分布较散：

- 前端主应用位于根目录 [src](/Users/Administrator/Downloads/KK-Studio-1.0.0/src)
- 轻量 API 入口位于 [server](/Users/Administrator/Downloads/KK-Studio-1.0.0/server)
- Serverless/边缘接口位于 [api](/Users/Administrator/Downloads/KK-Studio-1.0.0/api)
- 支付服务位于 [payment-server](/Users/Administrator/Downloads/KK-Studio-1.0.0/payment-server)
- 账务路由与引擎位于 [billing](/Users/Administrator/Downloads/KK-Studio-1.0.0/billing)
- 数据迁移与函数位于 [supabase](/Users/Administrator/Downloads/KK-Studio-1.0.0/supabase) 与 [migrations](/Users/Administrator/Downloads/KK-Studio-1.0.0/migrations)
- 集成测试位于 [tests/integration](/Users/Administrator/Downloads/KK-Studio-1.0.0/tests/integration)

现状盘点详见 [current-state-inventory.md](/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/specs/current-state-inventory.md)。

## 3. 目标目录结构

```text
repo/
  apps/
    web/                    # 表现层：React/Vite 前端
    api/                    # 控制层：Node.js + TypeScript 主 API/BFF
    payment-sidecar/        # 支付边车：充值、回调、对账
  packages/
    contracts/              # OpenAPI 派生 DTO、响应模型、错误码、事件模型
    domain/                 # 领域模型、值对象、领域服务、仓储接口
    ui/                     # 可复用 UI 基元与设计系统
    shared/                 # 通用工具、常量、日志、配置装载
  infra/
    supabase/               # migrations、functions、seed、RLS 策略
  docs/specs/               # 项目规格、接口规格、数据规格、ADR
  tests/
    unit/
    integration/
    contract/
    e2e/
```

### 3.1 目录职责

| 目录 | 职责 | 禁止事项 |
| --- | --- | --- |
| `apps/web` | 页面、容器、交互状态、typed client 调用 | 直接写 Supabase 业务 RPC、直接保存敏感密钥 |
| `apps/api` | 路由、控制器、鉴权、编排、审计、幂等 | 直接承载 React/UI 逻辑 |
| `apps/payment-sidecar` | 支付下单、回调验签、支付对账、内部回写 | 直接改前端状态或渲染页面 |
| `packages/contracts` | DTO、API Envelope、错误码、Domain Event 契约 | 放数据库 SDK、HTTP 服务实现 |
| `packages/domain` | 实体、聚合、值对象、仓储接口、领域服务 | 依赖 React、Express、Supabase SDK |
| `packages/ui` | 设计系统与可复用组件基元 | 放业务流程与账务逻辑 |
| `packages/shared` | 配置、日志、常量、通用 helper | 放具体业务状态机 |
| `infra/supabase` | 表结构、RLS、函数、种子数据、迁移规范 | 放 UI 组件、路由控制器 |

## 4. 业务模块与 MVC 闭环

首批固定模块：

- `auth`
- `workspace-canvas`
- `generation`
- `workflow`
- `asset-library`
- `billing`
- `model-catalog`
- `admin-console`
- `storage-sync`

每个业务模块内部固定四层：

- `presentation`
- `application`
- `domain`
- `infrastructure`

### 4.1 MVC 映射

| MVC 角色 | 目标落点 | 职责 |
| --- | --- | --- |
| View | `apps/web` | 页面、容器、表单、列表、状态展示、乐观交互 |
| Controller | `apps/api` | 校验请求、解析 DTO、鉴权、编排命令/查询、返回响应信封 |
| Model | `packages/domain` + `infra/supabase` | 聚合、值对象、仓储接口、持久化模型、状态机 |

### 4.2 闭环交互流

1. 前端 View 发起用户动作，例如“登录”“生成图片”“保存工作流”“扣减积分”。
2. View 只能通过 `packages/contracts` 生成的 typed client 发送 `JSON DTO` 给 `apps/api`。
3. API Controller 只做输入校验、权限校验、幂等校验、命令分发，不直接写业务规则。
4. Application Service 编排领域对象、仓储接口、审计日志、事件发布。
5. Domain 层执行业务约束，例如余额变化只能经 ledger、异步任务必须走状态机。
6. Infrastructure 负责落库、查库、回调第三方、推送领域事件。
7. Controller 统一包装为 `success/error + meta` 信封返回前端。
8. 前端 View 根据响应更新 UI 状态并呈现结果。

### 4.3 模块对接矩阵

| 发送方 | 接收方 | 发送内容 | 格式 | 返回内容 | 格式 |
| --- | --- | --- | --- | --- | --- |
| UI 容器/页面 | API Controller | `XxxRequest DTO` | `application/json` | `ApiSuccess<XxxResponse>` / `ApiFailure` | `application/json` |
| API Controller | Application Service | `CreateXxxCommand` / `GetXxxQuery` | TypeScript object | `Result<T>` | TypeScript object |
| Application Service | Domain Aggregate | 值对象、命令上下文 | TypeScript object | 领域状态变化、领域事件 | TypeScript object |
| Application Service | Repository | 仓储写入/查询参数 | TypeScript object | 持久化实体/投影 | TypeScript object |
| Payment Sidecar | Main API Internal Endpoint | 支付结果、对账结果、回调载荷 | `application/json` + internal token | 记账结果、审计结果 | `application/json` |
| API / Sidecar | Supabase | SQL / RPC / Edge Function 调用 | SQL / RPC | 表记录 / 执行结果 | Row / JSON |

## 5. 对外 API 契约规范

### 5.1 基础请求头

所有对外 REST 接口必须接受以下请求头：

- `Authorization: Bearer <token>`
- `X-Request-Id: <uuid>`
- `X-Client-Version: <semver>`
- `X-Admin-Session-Token: <opaque-token>` 仅用于高风险管理员写操作，服务端校验后才生效

内部服务调用额外要求：

- `X-Internal-Service: payment-sidecar`
- `X-Internal-Token: <secret>`

### 5.2 响应信封

成功响应：

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "a6c5d5d0-42f5-4f59-b6df-d1cc2e5ea344",
    "timestamp": "2026-03-23T12:00:00.000Z"
  }
}
```

失败响应：

```json
{
  "success": false,
  "error": {
    "code": "GENERATION_TASK_NOT_FOUND",
    "message": "Generation task does not exist.",
    "details": []
  },
  "meta": {
    "requestId": "a6c5d5d0-42f5-4f59-b6df-d1cc2e5ea344",
    "timestamp": "2026-03-23T12:00:00.000Z"
  }
}
```

分页响应必须附带：

```json
{
  "nextCursor": "cursor_02",
  "hasMore": true,
  "limit": 20
}
```

### 5.3 命名与 DTO

- 请求 DTO：`CreateGenerationTaskRequest`
- 响应 DTO：`CreateGenerationTaskResponse`
- Command：`CreateGenerationTaskCommand`
- Query：`GetGenerationTaskQuery`
- 仓储接口：`GenerationTaskRepository`
- Domain Event：`generation.task.created`
- 错误码：全大写蛇形，例如 `CREDIT_BALANCE_NOT_ENOUGH`

### 5.4 字段标准

| 语义 | 字段名 | 规范 |
| --- | --- | --- |
| 主键 | `id` | 默认 UUID |
| 外键 | `<entity>Id` | API DTO 使用 camelCase |
| 数据库外键 | `<entity>_id` | 数据库使用 snake_case |
| 金额 | `amount`, `currency` | 金额保留 decimal，禁止浮点精度丢失 |
| 积分 | `creditAmount`, `balanceAfter` | 统一整数 |
| 时间 | `createdAt`, `updatedAt`, `completedAt` | ISO 8601 |
| 枚举 | `status`, `type`, `availability` | 明确定义 enum 集合 |

## 6. 数据与状态机约束

### 6.1 数据建模规则

- 所有写操作必须留下审计痕迹。
- 所有余额变化只能经 `credit_ledger`。
- 所有异步任务必须有状态机与重试策略。
- 所有外键、唯一键、幂等键、RLS 策略必须显式定义。
- 历史表允许通过兼容视图/兼容仓储过渡，不允许直接无保护改名。

### 6.2 核心主数据与台账

- 用户与认证：`profiles`、`user_api_keys`
- 模型与供应商：`model_catalog`、`provider_channels`、`provider_pricing_snapshots`
- 生成与工作流：`workspaces`、`canvases`、`workflows`、`workflow_nodes`、`generation_tasks`、`generation_results`、`assets`
- 计费与支付：`credit_accounts`、`credit_ledger`、`payment_orders`、`payment_callbacks`、`refund_records`
- 安全与审计：`audit_logs`、`admin_sessions`、`idempotency_keys`

## 7. 编码规范

### 7.1 命名规范

- 目录：`kebab-case`
- React 组件：`PascalCase`
- hooks：`useXxx`
- service/helper：语义化 `camelCase`
- 文件名禁止使用：`newService`、`finalService`、`service2`

### 7.2 前端规范

- `App.tsx` 只做路由与 Provider 组合，不承载业务流程细节。
- 页面层不直接 `fetch`。
- 页面层不直接调用 Supabase/RPC。
- 敏感密钥、计费逻辑、支付签名必须在服务端。
- 共享类型统一来自 `packages/contracts` 或 `packages/domain`。

### 7.3 后端规范

- Controller 不写领域规则。
- Application Service 负责编排事务、幂等、审计、事件。
- Domain 层不依赖 React、HTTP、数据库 SDK。
- Infrastructure 层只负责对接存储和第三方系统。

## 8. 架构守卫

强制单向依赖：

- `web -> contracts -> api`
- `api -> domain -> infrastructure`

禁止事项：

- 跨模块 import 内部实现文件
- 前端直接依赖数据库表结构
- Sidecar 直接更新前端显示状态
- Controller 直接拼接 SQL 业务逻辑

必须事项：

- 新接口必须先更新 OpenAPI，再开发，再生成 client
- 核心链路必须支持幂等、防重、审计
- 所有回调接口必须校验签名或内部令牌
- 管理员高风险写接口必须校验服务端签发的二次验证会话，不允许仅依赖前端本地状态

## 9. 测试标准

### 9.1 测试分层

| 层级 | 范围 | 最低要求 |
| --- | --- | --- |
| Unit | 领域服务、状态机、价格与积分计算 | 核心模块覆盖率 `>= 80%` |
| Contract | OpenAPI schema、示例与错误码 | 每个接口 1 个成功 + 2 个失败示例 |
| Integration | API + DB + RLS + Sidecar 回调 | 认证、计费、支付、生成链路必须覆盖 |
| E2E | 登录、配置、生成、扣费、保存、查看 | 发布前 smoke 通过 |

### 9.2 验收门槛

- contract diff 通过
- schema diff 通过
- 核心计费/支付/认证集成测试通过
- smoke e2e 通过
- 迁移脚本可重复执行

## 10. 迁移策略

### 第 1 阶段：冻结规格

- 输出本规格书
- 输出 OpenAPI 契约
- 输出数据规格
- 输出现状盘点与迁移映射

### 第 2 阶段：搭骨架

- 新建 `apps`、`packages`、`infra` 目标目录
- 建立 `contracts/domain/shared` 共享代码骨架
- 建立 `apps/api` 主 API 骨架

### 第 3 阶段：迁移高优先模块

优先模块：

1. `auth`
2. `billing`
3. `generation`
4. `workflow`

原则：

- 先建兼容层，再切调用方
- 先迁移契约，再迁移实现
- 先迁移只读接口，再迁移写接口

### 第 4 阶段：收口前端调用

- 把 `src/services` 中直接承担业务编排的能力迁入 `apps/api`
- 前端只保留 typed client、UI state、纯展示工具

### 第 5 阶段：清理历史路径

- 旧路径停止新增功能
- 通过兼容导出和迁移文档控制收口
- 逐步下线历史 service 与重复目录

## 11. 当前目录到目标目录映射

| 当前路径 | 目标路径 | 迁移策略 |
| --- | --- | --- |
| `src` | `apps/web` | 保持运行，按模块逐步搬迁 |
| `server` | `apps/api` | 保留兼容入口，逐步收口 |
| `api` | `apps/api` | 将 serverless handler 归并为模块路由 |
| `payment-server` | `apps/payment-sidecar` | 保留独立服务，定义内部回写契约 |
| `billing` | `apps/api/modules/billing` + `packages/domain` | 拆分为路由、应用、领域与引擎 |
| `supabase` / `migrations` | `infra/supabase` | 迁移规范先统一，文件逐步收口 |

## 12. 交付物

本次冻结交付物：

- [project-spec.md](/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/specs/project-spec.md)
- [openapi.yaml](/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/specs/openapi.yaml)
- [data-spec.md](/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/specs/data-spec.md)
- [current-state-inventory.md](/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/specs/current-state-inventory.md)
