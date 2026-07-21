Status: reference

# KK Studio 数据规格书

文档状态：Draft Frozen v1  
目标数据库：VPS PostgreSQL（`infrastructure/database/migrations/` 为结构变更事实源）
数据库命名：`snake_case`  
API 字段命名：`camelCase`

## 1. 总体原则

- `services/api/` 通过 `profiles`、`password_identities`、`user_sessions` 等表维护当前认证与业务身份。
- 所有业务主键默认使用 UUID。
- 所有写操作必须留下审计信息。
- 所有余额变化必须经 `credit_ledger`。
- 所有异步任务必须具备状态机。
- 所有表必须显式定义主键、外键、索引、唯一约束和服务端访问边界。
- 历史表允许保留，但必须标记兼容策略与退场计划。

## 1.1 运行时基线（2026-06-09）

当前主运行时为 `services/api/` Express / VPS + PostgreSQL。以下对象是当前真实运行面，审计与迁移必须先保障它们，再通过 `infrastructure/database/migrations/` 逐步收敛到第 3 章目标模型：

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

说明：

- `user_credits` / `credit_transactions` 仍是当前 `services/api/` API 与支付回写的真实写入面，目标态中的 `credit_accounts` / `credit_ledger` 尚未落地替换。
- `admin_auth` 仍被管理员控制台读取，因此当前不能视为可直接移除的历史垃圾表。
- `provider_pricing_cache` / `credit_exchange_rates` 仍被现网运营与价格能力使用，目标态会再收敛为更明确的价格快照/计费配置模型。
- 第 3 章继续定义目标态，未落地对象在迁移完成前属于“规格目标缺口”，不是当前运行态缺陷。

## 2. 命名与类型规范

| 类型 | 规则 |
| --- | --- |
| 表名 | 复数名词，`snake_case` |
| 主键 | `id uuid primary key` |
| 外键 | `<entity>_id uuid not null` |
| 时间 | `timestamptz` |
| 状态 | `text check (...)` 或 enum |
| JSON 扩展字段 | `jsonb` |
| 逻辑删除 | 优先不用；如确需保留则使用 `deleted_at` |

## 3. 目标表模型

### 3.1 用户与认证域

#### `profiles`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, FK -> `auth.users.id` | 用户主键 |
| `email` | `text` | unique not null | 邮箱 |
| `nickname` | `text` | null | 昵称 |
| `avatar_url` | `text` | null | 头像 |
| `role` | `text` | check in (`user`,`admin`) | 角色 |
| `status` | `text` | check in (`active`,`suspended`) | 用户状态 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |

#### `user_api_keys`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 记录主键 |
| `user_id` | `uuid` | FK -> `profiles.id` | 所属用户 |
| `provider_code` | `text` | not null | 供应商编码 |
| `key_alias` | `text` | not null | 密钥别名 |
| `key_ciphertext` | `text` | not null | 密钥密文 |
| `is_active` | `boolean` | default true | 启用状态 |
| `last_used_at` | `timestamptz` | null | 最后使用时间 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |

### 3.2 模型与供应商域

#### `model_catalog`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 主键 |
| `model_code` | `text` | unique not null | 模型编码 |
| `display_name` | `text` | not null | 显示名称 |
| `kind` | `text` | check in (`chat`,`image`,`video`,`audio`,`embedding`) | 模型类型 |
| `availability` | `text` | check in (`public`,`internal`,`disabled`) | 可见性 |
| `billing_mode` | `text` | check in (`credits`,`currency`) | 计费方式 |
| `default_credit_cost` | `integer` | null | 默认积分成本 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |

#### `provider_channels`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 主键 |
| `provider_code` | `text` | not null | 供应商编码 |
| `channel_name` | `text` | not null | 渠道名称 |
| `base_url` | `text` | not null | 基础 URL |
| `auth_mode` | `text` | check in (`api_key`,`service_token`,`internal_proxy`) | 鉴权模式 |
| `is_active` | `boolean` | default true | 启用状态 |
| `priority` | `integer` | default 100 | 优先级 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |

#### `provider_pricing_snapshots`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 主键 |
| `provider_channel_id` | `uuid` | FK -> `provider_channels.id` | 所属渠道 |
| `snapshot_version` | `text` | not null | 快照版本 |
| `currency` | `text` | not null | 币种 |
| `payload` | `jsonb` | not null | 完整价格快照 |
| `captured_at` | `timestamptz` | not null | 采集时间 |

### 3.3 工作区、工作流与资产域

#### `workspaces`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 工作区主键 |
| `owner_id` | `uuid` | FK -> `profiles.id` | 所属用户 |
| `name` | `text` | not null | 工作区名称 |
| `status` | `text` | check in (`active`,`archived`) | 工作区状态 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |

#### `canvases`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 画布主键 |
| `workspace_id` | `uuid` | FK -> `workspaces.id` | 所属工作区 |
| `name` | `text` | not null | 画布名称 |
| `viewport_state` | `jsonb` | null | 视口状态 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |

#### `workflows`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 工作流主键 |
| `workspace_id` | `uuid` | FK -> `workspaces.id` | 所属工作区 |
| `canvas_id` | `uuid` | FK -> `canvases.id` | 关联画布 |
| `name` | `text` | not null | 工作流名称 |
| `status` | `text` | check in (`draft`,`published`,`archived`) | 工作流状态 |
| `version` | `integer` | not null default 1 | 版本 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |

#### `workflow_nodes`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 节点主键 |
| `workflow_id` | `uuid` | FK -> `workflows.id` | 所属工作流 |
| `node_type` | `text` | check in (`prompt`,`image`,`preview`,`save`,`agent`) | 节点类型 |
| `position_x` | `numeric` | not null | X 坐标 |
| `position_y` | `numeric` | not null | Y 坐标 |
| `config_payload` | `jsonb` | not null | 节点配置 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |

#### `assets`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 资产主键 |
| `owner_id` | `uuid` | FK -> `profiles.id` | 所属用户 |
| `workspace_id` | `uuid` | FK -> `workspaces.id` | 所属工作区 |
| `kind` | `text` | check in (`image`,`video`,`audio`,`document`) | 资产类型 |
| `storage_bucket` | `text` | not null | 存储桶 |
| `storage_path` | `text` | not null | 路径 |
| `mime_type` | `text` | not null | MIME |
| `size_bytes` | `bigint` | not null | 大小 |
| `metadata` | `jsonb` | default `'{}'::jsonb` | 扩展元数据 |
| `created_at` | `timestamptz` | not null | 创建时间 |

### 3.4 生成任务域

#### `generation_tasks`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 任务主键 |
| `workspace_id` | `uuid` | FK -> `workspaces.id` | 所属工作区 |
| `workflow_id` | `uuid` | FK -> `workflows.id` | 来源工作流 |
| `requester_id` | `uuid` | FK -> `profiles.id` | 发起用户 |
| `model_code` | `text` | not null | 模型编码 |
| `task_type` | `text` | check in (`image`,`video`,`audio`,`document`) | 任务类型 |
| `status` | `text` | check in (`queued`,`running`,`succeeded`,`failed`,`cancelled`,`refunded`) | 任务状态 |
| `idempotency_key` | `text` | unique not null | 幂等键 |
| `request_payload` | `jsonb` | not null | 输入载荷 |
| `error_code` | `text` | null | 错误码 |
| `error_message` | `text` | null | 错误信息 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `started_at` | `timestamptz` | null | 开始时间 |
| `completed_at` | `timestamptz` | null | 完成时间 |

#### `generation_results`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 结果主键 |
| `generation_task_id` | `uuid` | FK -> `generation_tasks.id` | 所属任务 |
| `asset_id` | `uuid` | FK -> `assets.id` | 关联资产 |
| `sequence_no` | `integer` | not null | 结果序号 |
| `metadata` | `jsonb` | default `'{}'::jsonb` | 输出元数据 |
| `created_at` | `timestamptz` | not null | 创建时间 |

### 3.5 计费与支付域

#### `credit_accounts`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 账户主键 |
| `user_id` | `uuid` | FK -> `profiles.id`, unique | 用户唯一积分账户 |
| `balance` | `integer` | not null default 0 | 当前余额 |
| `frozen_balance` | `integer` | not null default 0 | 冻结余额 |
| `version` | `integer` | not null default 1 | 乐观锁版本 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |

#### `credit_ledger`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 台账主键 |
| `credit_account_id` | `uuid` | FK -> `credit_accounts.id` | 账户 |
| `transaction_type` | `text` | check in (`recharge`,`debit`,`refund`,`freeze`,`unfreeze`) | 交易类型 |
| `amount` | `integer` | not null | 变动额度 |
| `balance_before` | `integer` | not null | 变动前余额 |
| `balance_after` | `integer` | not null | 变动后余额 |
| `business_ref_type` | `text` | not null | 业务来源类型 |
| `business_ref_id` | `text` | not null | 业务来源主键或外部业务标识 |
| `idempotency_key` | `text` | null | 幂等键，用于扣费与结算去重 |
| `metadata` | `jsonb` | default `'{}'::jsonb` | 额外元数据 |
| `created_at` | `timestamptz` | not null | 创建时间 |

#### `payment_orders`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 订单主键 |
| `user_id` | `uuid` | FK -> `profiles.id` | 付款用户 |
| `provider_code` | `text` | not null | 支付提供方 |
| `merchant_order_no` | `text` | unique not null | 商户订单号 |
| `status` | `text` | check in (`created`,`pending`,`paid`,`failed`,`cancelled`,`refunded`) | 支付状态 |
| `amount` | `numeric(18,6)` | not null | 金额 |
| `currency` | `text` | not null | 币种 |
| `credit_amount` | `integer` | not null | 充值积分 |
| `idempotency_key` | `text` | unique not null | 幂等键 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `paid_at` | `timestamptz` | null | 支付时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |

#### `payment_callbacks`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 回调主键 |
| `payment_order_id` | `uuid` | FK -> `payment_orders.id` | 关联订单 |
| `provider_code` | `text` | not null | 支付提供方 |
| `callback_id` | `text` | unique not null | 第三方回调唯一标识 |
| `verified` | `boolean` | not null | 是否验签通过 |
| `payload` | `jsonb` | not null | 回调载荷 |
| `received_at` | `timestamptz` | not null | 接收时间 |

#### `refund_records`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 退款主键 |
| `payment_order_id` | `uuid` | FK -> `payment_orders.id` | 支付订单 |
| `credit_ledger_id` | `uuid` | FK -> `credit_ledger.id` | 积分回退台账 |
| `status` | `text` | check in (`created`,`processing`,`succeeded`,`failed`) | 退款状态 |
| `reason` | `text` | null | 退款原因 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `completed_at` | `timestamptz` | null | 完成时间 |

### 3.6 安全与审计域

#### `audit_logs`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 审计主键 |
| `actor_id` | `uuid` | null | 操作者 |
| `actor_type` | `text` | not null | `user` / `admin` / `system` |
| `action` | `text` | not null | 行为编码 |
| `resource_type` | `text` | not null | 资源类型 |
| `resource_id` | `uuid` | null | 资源主键 |
| `request_id` | `uuid` | null | 请求链路 ID |
| `payload` | `jsonb` | default `'{}'::jsonb` | 详情 |
| `created_at` | `timestamptz` | not null | 创建时间 |

#### `admin_sessions`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 会话主键 |
| `admin_user_id` | `uuid` | FK -> `profiles.id` | 管理员 |
| `session_token_hash` | `text` | unique not null | 会话哈希 |
| `expires_at` | `timestamptz` | not null | 过期时间 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `revoked_at` | `timestamptz` | null | 主动失效时间 |

#### `idempotency_keys`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 主键 |
| `idempotency_key` | `text` | unique not null | 幂等键 |
| `scope` | `text` | not null | 作用域 |
| `request_hash` | `text` | not null | 请求摘要 |
| `response_payload` | `jsonb` | null | 已缓存响应 |
| `expires_at` | `timestamptz` | not null | 失效时间 |
| `created_at` | `timestamptz` | not null | 创建时间 |

## 4. 状态机规格

### 4.1 `generation_tasks.status`

允许状态：

- `queued`
- `running`
- `succeeded`
- `failed`
- `cancelled`
- `refunded`

允许迁移：

- `queued -> running`
- `queued -> cancelled`
- `running -> succeeded`
- `running -> failed`
- `failed -> refunded`

### 4.2 `payment_orders.status`

允许状态：

- `created`
- `pending`
- `paid`
- `failed`
- `cancelled`
- `refunded`

允许迁移：

- `created -> pending`
- `pending -> paid`
- `pending -> failed`
- `pending -> cancelled`
- `paid -> refunded`

### 4.3 `workflows.status`

允许状态：

- `draft`
- `published`
- `archived`

允许迁移：

- `draft -> published`
- `published -> draft`
- `draft -> archived`
- `published -> archived`

## 5. 索引与约束

最低索引要求：

- `profiles(email)` unique
- `user_api_keys(user_id, provider_code, is_active)`
- `model_catalog(model_code)` unique
- `provider_channels(provider_code, is_active)`
- `workspaces(owner_id, updated_at desc)`
- `workflows(workspace_id, updated_at desc)`
- `workflow_nodes(workflow_id, node_type)`
- `assets(owner_id, created_at desc)`
- `generation_tasks(requester_id, created_at desc)`
- `generation_tasks(idempotency_key)` unique
- `credit_accounts(user_id)` unique
- `credit_ledger(credit_account_id, created_at desc)`
- `payment_orders(merchant_order_no)` unique
- `payment_orders(idempotency_key)` unique
- `payment_callbacks(callback_id)` unique
- `admin_sessions(admin_user_id, expires_at desc)`
- `admin_sessions(session_token_hash)` unique
- `audit_logs(request_id, created_at desc)`
- `idempotency_keys(idempotency_key)` unique

关键约束：

- `credit_accounts.balance >= 0`
- `credit_accounts.frozen_balance >= 0`
- `payment_orders.amount > 0`
- `credit_ledger.amount <> 0`
- `generation_results.sequence_no >= 1`

## 6. RLS 策略矩阵

| 表 | 用户读 | 用户写 | 管理员读写 | Service Role |
| --- | --- | --- | --- | --- |
| `profiles` | 仅本人 | 仅本人有限字段 | 可读写 | 可读写 |
| `user_api_keys` | 仅本人 | 仅本人 | 可读写 | 可读写 |
| `model_catalog` | 公共可读 | 否 | 可读写 | 可读写 |
| `provider_channels` | 否 | 否 | 可读写 | 可读写 |
| `provider_pricing_snapshots` | 否 | 否 | 可读 | 可读写 |
| `workspaces` | 仅本人 | 仅本人 | 可读写 | 可读写 |
| `canvases` | 仅所属工作区用户 | 仅所属工作区用户 | 可读写 | 可读写 |
| `workflows` | 仅所属工作区用户 | 仅所属工作区用户 | 可读写 | 可读写 |
| `workflow_nodes` | 仅所属工作区用户 | 仅所属工作区用户 | 可读写 | 可读写 |
| `assets` | 仅本人 | 仅本人 | 可读写 | 可读写 |
| `generation_tasks` | 仅本人 | 否，走 API | 可读写 | 可读写 |
| `generation_results` | 仅本人 | 否 | 可读写 | 可读写 |
| `credit_accounts` | 仅本人读取 | 否，走 API | 可读写 | 可读写 |
| `credit_ledger` | 仅本人只读 | 否 | 可读写 | 可读写 |
| `payment_orders` | 仅本人只读 | 否，走 server API | 可读写 | 可读写 |
| `payment_callbacks` | 否 | 否 | 可读 | 可读写 |
| `refund_records` | 仅本人只读 | 否 | 可读写 | 可读写 |
| `audit_logs` | 否 | 否 | 可读 | 可读写 |
| `admin_sessions` | 仅本人只读当前会话 | 否 | 可读写 | 可读写 |
| `idempotency_keys` | 否 | 否 | 否 | 可读写 |

## 7. 迁移兼容策略

历史到目标映射：

| 当前表/概念 | 目标表/概念 | 兼容策略 |
| --- | --- | --- |
| `user_credits` | `credit_accounts` | 先通过仓储兼容，必要时建立视图 |
| `credit_transactions` | `credit_ledger` | 通过适配器与兼容 DTO 过渡 |
| `admin_auth` | `admin_sessions` + 外部化密钥管理 | 先保留管理员密码表，待后台认证完成升级后再退场 |
| `admin_credit_models` | `model_catalog` + `provider_channels` | 拆分模型定义与渠道配置 |
| `provider_pricing_cache` | `provider_pricing_snapshots` | 先保留缓存表，后续补齐版本化快照模型 |
| `credit_exchange_rates` | 计费配置域表 | 当前保留运行时辅助表，待 billing 配置域单独建模 |
| `generation_tasks` | `generation_tasks` | 保留表名，补齐状态机与索引 |
| `payment_orders` | `payment_orders` | 已与目标态同名，继续补齐幂等与状态机约束 |
| `payment_callbacks` | `payment_callbacks` | 已与目标态同名，继续补齐审计与去重约束 |
| `admin_sessions` | `admin_sessions` | 已与目标态同名，作为管理员提升态会话主表 |

兼容规则：

- 优先新增目标表，不直接破坏旧表。
- 新 API 只对目标模型编程。
- 旧实现通过兼容仓储层桥接。
- 审计脚本必须把“运行时缺陷”和“目标态缺口”分开报告，避免迁移中误报。

## 8. 迁移脚本规范

- 迁移文件名：`YYYYMMDDHHMMSS_<action>.sql`
- 每个迁移必须：
  - 幂等或可安全重复执行
  - 明确 `up` 逻辑
  - 包含必要注释
  - 附带回填/回滚说明
- 涉及状态机、RLS、索引变更必须附文档更新

## 9. 最低验证项

每次数据结构变更必须验证：

- 表结构存在且约束生效
- RLS 策略可按角色正确拒绝/放行
- 幂等键重复提交不会重复扣费/下单
- 余额变化能完整落到 `credit_ledger`
- 支付回调重复投递不会重复记账
