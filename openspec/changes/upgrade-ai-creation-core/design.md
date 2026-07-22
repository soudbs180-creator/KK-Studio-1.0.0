# Design: upgrade-ai-creation-core

> Status: active / Phase 2 external gates pending / Phase 3 Run recovery foundations in progress
> Companion: proposal.md, tasks.md
> Last verified: 2026-07-22

---

## 1. 总体架构

```text
┌─────────────────────────────────────────────────────────────────────┐
│                           Browser (Web / Mobile)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Canvas UI    │  │ AI Chat UI   │  │ TaskCenter / PPT / Tool  │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬──────────────┘ │
│         │                 │                      │                 │
│         └────────┬────────┴────────────┬─────────┘                 │
│                  │    UI Projection    │                             │
│                  ▼                     ▼                             │
│         ┌─────────────────────────────────────┐                     │
│         │ packages/api-client (typed DTOs)     │                     │
│         └─────────────────┬───────────────────┘                     │
│                           │ HTTP / SSE / WebSocket                  │
└───────────────────────────┼───────────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────────┐
│                         Express (VPS)                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ Auth     │ │ Quote    │ │ Durable  │ │ Billing  │ │ Admin   │ │
│  │          │ │ Engine   │ │ Worker   │ │ Saga     │ │ Flags   │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ │
│       │            │            │            │            │       │
│       └────────────┴────────────┼────────────┴────────────┘       │
│                                 │                                   │
│                        ┌────────▼────────┐                        │
│                        │ RouteEngine     │                        │
│                        │ ProviderAdapter │                        │
│                        └────────┬────────┘                        │
│                                 │                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │ Image      │  │ Video      │  │ Audio      │  │ Browser    │   │
│  │ Providers  │  │ Providers  │  │ Providers  │  │ Bridge     │   │
│  │ (OpenAI/   │  │ (Wuyin/    │  │ (Wuyin/    │  │ (whitelisted│   │
│  │  Gemini/   │  │  others)   │  │  others)   │  │  actions)  │   │
│  │  etc.)     │  │            │  │            │  │            │   │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘   │
│                                                                     │
│  PostgreSQL ── jobs, runs, quotes, ledger, assets, sessions, audit │
└─────────────────────────────────────────────────────────────────────┘
```

浏览器只持有**状态投影**；Express 持有所有事实。Worker 是 Express 内部进程（或独立进程，通过数据库租约协调），负责提交、轮询、超时、取消和对账。

---

## 2. DTO 与契约

### 2.1 GenerationQuoteDto

```ts
interface GenerationQuoteDto {
  quoteId: string;              // UUID, 幂等键
  mediaType: 'image' | 'video' | 'audio' | 'ppt' | 'browser';
  model: string;                // modelId or capability name
  count: number;                // 图片张数 / 视频时长 / 音频时长 / PPT 页数
  routeSnapshot: ProviderRouteSnapshot; // 冻结时点的 Provider/模型/适配器版本
  channel: 'byok' | 'cloud-key' | 'platform-credits' | 'web-membership' | 'setup-required';
  cost: {
    credits?: number;           // 平台积分，channel=platform-credits 时必填
    providerQuota?: number;     // Provider 配额，channel=byok/cloud-key 时必填
    priceVersion: string;       // 价格版本，同 quoteId 重发必须同价
  };
  expiresAt: string;            // ISO 8601，建议 5 分钟
  createdAt: string;
  ownerId: string;
}
```

**关键规则**：
- `quoteId` 一旦创建，同 `quoteId` 重发必须返回相同 `cost`；若价格已变，强制生成新 `quoteId`。
- 报价不预扣；创建 Job 时才按 Quote 冻结/预扣。
- 过期报价返回 `410 Gone`，客户端必须重新请求报价。

### 2.2 GenerationJobDto v3

```ts
interface GenerationJobDto {
  jobId: string;
  quoteId: string;              // 冻结报价
  channel: GenerationQuoteDto['channel'];
  provider: string;             // 实际执行 Provider
  model: string;
  anonymousKeySlotId?: string;  // 云端 Key Slot 引用，不暴露真实 key
  capabilityVersion: string;    // 能力版本
  status: 'quoted' | 'reserved' | 'submitted' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  items: GenerationJobItem[];
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  retryCount: number;           // 受控重试次数
  maxRetries: number;           // 默认 3
}

interface GenerationJobItem {
  itemId: string;
  sequence: number;
  status: 'pending' | 'submitted' | 'running' | 'completed' | 'failed' | 'cancelled';
  reservation: BillingReservation; // 预扣记录
  ledger: LedgerEntry;             // 结算/退款记录
  providerTaskId?: string;         // Provider 侧任务 ID
  reconciliation: ReconciliationStatus; // 对账状态
  assetId?: string;                // 完成后关联 Asset
  canvasNodeId?: string;           // 落卡节点 ID
  errorCode?: string;
  errorMessage?: string;
}
```

**关键规则**：
- `channel` 在 Job 创建时被冻结，执行期间不可切换。
- 每个 Item 独立失败、重试、对账；已完成 Item 永不重复提交或换通道。
- v2 Job 保持只读兼容；新任务统一使用 v3。

### 2.3 AgentSessionDto / AgentContextSnapshotDto / AgentRunEventDto

```ts
interface AgentSessionDto {
  sessionId: string;
  ownerId: string;
  collaborationMode: 'direct' | 'assist' | 'takeover';
  messages: AgentSessionMessageDto[]; // 最多 200 条；附件只允许 Asset 引用
  summary: AgentSessionSummaryDto;
  toolResults: AgentSessionToolResultDto[];
  knowledgeRefs: AgentSessionKnowledgeRefDto[];
  tokenBudget: AgentTokenBudgetDto;
  confirmations: Confirmation[];
  checkpoints: CheckPoint[];
  lastHeartbeatAt: string;
  createdAt: string;
  updatedAt: string;
}

interface AgentContextSnapshotDto {
  snapshotId: string;
  sessionId: string;
  sequence: number;
  activeSurface: AssistantWorkspaceSurface;
  canvasId?: string;
  canvasSummary: { nodeCount: number; selectedNodeCount: number; generatedAssetCount: number };
  selectedNodeIds: string[];
  viewport: Viewport;
  recentEvents: CanvasEvent[];
  inputBox?: { hasText: boolean; attachmentCount: number };
  availableTools: string[];
  capturedAt: string;
  createdAt: string;
}

interface AgentRunEventDto {
  runId: string;
  sequence: number;
  type: 'run_snapshot';
  status: AgentRunStatus;
  runUpdatedAt: string;
  createdAt: string;
}
```

**关键规则**：
- Session 是服务端权威源；浏览器本地缓存仅为投影。
- migration 021 与 `/api/ai-assistant/sessions*` 已建立 owner-scoped Session/Context 数据面；当前 Web 尚未接入，因此运行时仍不能宣称 Session 已切换到服务端权威。Context Snapshot 只保存计数、ID、视口、事件类型和工具名，不保存输入框原文、附件 bytes 或任意 payload。
- Planner 输入由系统规则 + 滚动摘要 + 最近消息 + 工具结果 + 画布快照 + 知识引用组成，按 `TokenBudget` 裁剪。
- migration 020 先提供 metadata-only `run_snapshot` 事件基础；事件不得复制 user message、plan、tool input/output 或任意 `unknown` payload。Session 落地后，语义事件必须以新的 discriminated variant 和显式脱敏 payload schema 增量加入。
- 当前 Web 在首次 Run 列表 hydration 后消费 owner-qualified sequence cursor：只轮询最近 20 个 active + synced Run（最多 4 并发），metadata event 仅作为详情失效信号；事件页、Run ID、单调 sequence、owner 和详情更新时间全部校验通过，且权威快照成功合并后才推进游标。该机制仍是只读投影恢复，不是语义事件 replay，也不向远端计划授予执行权；Web Session 投影和真实跨设备 E2E 完成前，不能宣称服务端已接管完整 Run 恢复。

### 2.4 PPT 契约

```ts
interface PptDeckPlanDto {
  planId: string;
  title: string;
  theme?: string;
  slides: PptSlideSpecDto[];
  totalCreditsQuoted?: number;
  providerQuotaQuoted?: number;
}

interface PptSlideSpecDto {
  slideId: string;
  sequence: number;
  prompt: string;
  layout: 'title' | 'title-and-content' | 'two-column' | 'image-left' | 'image-right' | 'full-image';
  requiredAssets: string[];         // 输入 Asset IDs
  output: {
    editable: true;                  // 默认 true，必须可编辑
    layerHint: 'text' | 'image' | 'shape';
  };
}

interface PptDeckJobDto {
  deckJobId: string;
  planId: string;
  jobId: string;                    // 关联 GenerationJobDto
  status: GenerationJobDto['status'];
  slides: PptSlideJobItem[];
}
```

**关键规则**：
- 每页是一个独立 Slide Job，可失败、重试、编辑。
- 生成结果导入可编辑 Deck，不是整页位图。
- 导出必须保留 OpenXML 文字层、图片层、顺序和关系文件。

---

## 3. 服务端接口

### 3.1 报价

```http
POST /api/v1/generation/quotes
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "mediaType": "image",
  "model": "gpt-best-001",
  "count": 4,
  "prompt": "...",
  "preferredChannel": "platform-credits"
}
```

响应 `201 Created`：`GenerationQuoteDto`。

### 3.2 Job 创建

```http
POST /api/v1/generation/jobs
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "quoteId": "quote-xxx",
  "canvasId": "canvas-xxx",
  "placement": "auto-arrange"
}
```

响应 `201 Created`：`GenerationJobDto`。

### 3.3 Job 事件流

```http
GET /api/v1/generation/jobs/:jobId/events
Authorization: Bearer <jwt>
Accept: text/event-stream
```

SSE 流推送 `GenerationJobEvent` 与 Job 状态变更。

### 3.4 Job 控制

```http
POST /api/v1/generation/jobs/:jobId/pause
POST /api/v1/generation/jobs/:jobId/resume
POST /api/v1/generation/jobs/:jobId/cancel
```

### 3.5 Agent Session / Run

```http
GET  /api/ai-assistant/sessions
POST /api/ai-assistant/sessions
GET  /api/ai-assistant/sessions/:sessionId
POST /api/ai-assistant/sessions/:sessionId/context-snapshots
GET  /api/ai-assistant/sessions/:sessionId/context-snapshots/latest

GET  /api/ai-assistant/runs
POST /api/ai-assistant/runs
GET  /api/ai-assistant/runs/:runId
GET  /api/ai-assistant/runs/:runId/events
```

Session/Context 与 Run/event 目前是两个 owner-scoped 数据面；Run 绑定 Session、confirm/cancel/recover 端点要在确认授权协议定型后再 additive 增加，禁止通过复用浏览器本地 Session ID 暗中授予执行权。

---

## 4. Worker 生命周期

```text
reserved ──► submitted ──► running ──► completed
    │           │            │             │
    │           ▼            ▼             ▼
    │        paused      timed-out       failed
    │           │            │             │
    └───────────┴────────────┴─────────────┘
              cancelled
```

1. **reserved**：Job 创建后按 Quote 预扣/冻结额度。
2. **submitted**：Worker 拿到租约，向 Provider 提交任务。
3. **running**：Provider 返回任务 ID，Worker 按有上限的指数退避轮询。
4. **completed / failed**：Worker 写入结果/错误，触发结算或退款。
5. **paused**：用户或策略暂停；已落库的 Item lease row 保留，但不再领取新租约或发起下一轮 poll。
6. **cancelled**：用户取消，未结算的预扣全部释放。
7. **timeout**：短租约过期后 Item 重新进入可领取状态；Provider 错误重试受次数限制，整个 Item 还受 enqueue-to-deadline 总时限约束。内部 lease 使用 `timed_out`，公开 DTO 仍以 Item/Job `failed` 表达，不增加 HTTP 状态枚举。

**Worker 安全规则**：
- 一个 Item 同一时刻只有一个 Worker 持有 token 绑定的短租约；同一 Job 的不同 Item 可安全并行。
- 默认 lease 为 30 秒、heartbeat 为 10 秒，均可由 server env 调整；token 不匹配的陈旧 Worker 无权写入 Item 或结算。
- submit 使用稳定的 `jobId:itemId` requestId；`providerTaskId` 只在空值时写入。已完成 Item 不再领取，恢复 Worker 对已有 task 只 poll、不重复 submit。
- migration 019 只新增 `generation_image_worker_leases`，不修改或删除 migration 018 Capability Graph 数据；server flag 使用 `off → internal → invited → full` scope，默认 `off`，回滚只关闭执行切流。
- 失败退款必须生成对账记录，失败 Job 可重试但须重新 Quote（价格不变时复用原 quoteId）。

---

## 5. Agent 上下文与恢复

### 5.1 Planner 输入结构

```text
System rules (固定预算)
  + Rolling summary (约 20%)
  + Recent messages (约 30%)
  + Tool results (约 20%)
  + Canvas snapshot (约 15%)
  + Knowledge refs (约 10%)
  + Token headroom (5%)
```

- 裁剪按时间倒序，优先保留最近 2 轮对话和未确认工具结果。
- 画布快照只保留摘要（节点数量、选中、视口），不嵌入完整 Base64 图片。

### 5.2 Run 恢复

- 浏览器打开或跨设备登录时，向服务端查询 `running`/`paused` 状态 Run 和 Job。
- Web Run 恢复分为首次 bounded snapshot hydration 与后续 event-cursor invalidation；startup、认证恢复与 online 触发刷新，事件只导致重新读取共享 schema 校验后的权威 Run 详情。
- cursor 按 owner + Run 持久化；owner 变化、跨 Run/乱序事件、陈旧详情、网络失败或本地较新 pending snapshot 均不得推进 cursor。
- 服务端独有 Run 始终是 `server_projection`，当前浏览器只能展示或请求服务端控制，不能执行未在本地验证和确认的 plan。
- 恢复后不重新执行已完成步骤；未执行步骤重新进入 Worker 队列。
- 最多允许三次**受控重规划**：每次重规划必须在服务端事件日志中记录原因和触发条件。

---

## 6. PPT 链路改造

1. 用户/Agent 发起"生成 PPT" -> `PptDeckPlanDto` 创建。
2. 每个 `PptSlideSpecDto` 生成一个 Slide Job，使用同一 `GenerationJobDto` 容器。
3. Worker 为每页生成可编辑图层（文本框、图片占位、形状），而不是整页 AI 图片。
4. 结果写入 `PptDeckJobDto`，通知前端渲染可编辑 Deck。
5. 导出调用 `handleExportPptxEditable`（已有 `usePptRuntime.ts:613-730`），保留 OpenXML 结构。

---

## 7. Browser Bridge 增强

- 保留现有 `browser.*` 工具、白名单、确认、审计。
- 新增**站点能力矩阵**：每个站点声明可执行动作、输入字段、输出格式、setup-required 条件。
- 新增**冻结目标**：动作执行前冻结目标 DOM 摘要，执行后结构化结果必须匹配目标签名，否则标记为 setup-required。
- 禁止任意 selector、URL、Shell 或自动公开发布。

---

## 8. Feature Flag

- 现有 `apps/web/src/config/featureFlags.ts` 和 `app/kkaiFeatureFlags.ts` 的硬编码常量升级为服务端配置。
- 分类：
  - `capability.*`：能力开关（是否允许新 Worker、PPT Agent、视频平台积分等）。
  - `visual.*`：视觉开关（`workspaceUiVariant` 等，不影响业务数据）。
- 管理员 Kill Switch：在服务端 `/admin/feature-flags` 紧急关闭任何能力，变更 5 秒内广播到客户端。
- UI 同时读取新旧 Flag 的投影；关闭 visual Flag 只回滚界面，不迁移或回滚业务数据。

---

## 9. Capability Graph

### 9.1 DTO（Zod discriminated union）

```ts
type CapabilityNodeType =
  | 'Actor' | 'Provider' | 'ProviderConnection' | 'Model' | 'Capability'
  | 'Asset' | 'Workflow' | 'Step' | 'Trigger' | 'Runtime'
  | 'Job' | 'Run' | 'ToolCall' | 'Verification' | 'Audit';

interface CapabilityNodeDto {
  id: string;
  type: CapabilityNodeType;        // discriminated union 的判别字段
  status: 'connected' | 'available' | 'restricted' | 'offline' | 'error';
  ownerScope: 'global' | 'user' | 'workspace';
  source: string;                  // 产生该节点的权威表 / catalog
  version: string;
  updatedAt: string;               // ISO 8601
  // 各 type 的扩展字段随判别联合分发
}

interface CapabilityEdgeDto {
  from: string;                    // node id
  to: string;                      // node id
  relation: 'owns' | 'exposes' | 'binds' | 'routesVia' | 'produced' | 'consumed' | 'verifiedBy' | 'auditedBy';
  status: 'active' | 'disabled' | 'degraded';
  source: string;
  constraints?: Record<string, unknown>;
  permissions?: 'safe' | 'confirm' | 'dangerous' | 'forbidden';
  version: string;
}

interface CapabilityGraphSnapshotDto {   // v1
  version: 'v1';
  generatedAt: string;
  nodes: CapabilityNodeDto[];
  edges: CapabilityEdgeDto[];
}
```

**关键规则**：
- 所有 DTO 用 Zod discriminated union 解析；未知 `version` 一律拒绝，不做静默降级。
- 快照只读；节点 status 直接支撑 IA 左侧 `未连接/可用/受限/离线` 分组。
- Connection secret 永不进入图中任何节点 payload。

### 9.2 存储与投影

- PostgreSQL 规范化表（migration `018_capability_graph_foundation.sql`）：
  - `provider_connections`：用户连接元数据（owner、provider、endpoint、status、verified_at）+ 加密 `secret_ref`，不存明文。
  - `capability_bindings`：Connection / Model / Capability 关系与通道约束。
  - Asset lineage 使用独立 relation table（from_asset_id、to_asset_id、relation、params）。
- 全局 Provider / Model 定义继续由 canonical Provider Catalog 管理，图中只做投影，不复制。
- Actor、Job、Run、Audit 等第一阶段从现有权威表和 store 投影，**不建通用 EAV 节点表**。
- 不引入图数据库；仅当 PostgreSQL 递归查询、关系索引和投影缓存经测量仍无法满足需求时再重新评估。

### 9.3 API 与工具

```http
GET /api/v1/capability-graph/snapshot
POST /api/v1/provider-connections
GET /api/v1/provider-connections
POST /api/v1/provider-connections/:id/verify
DELETE /api/v1/provider-connections/:id
```

- 新增只读 safe tool `capabilities.listAvailable`，Agent 经 ToolRegistry 查询能力图摘要。
- 现有 Quote / Job API 保持兼容，不改变语义。

---

## 10. Provider / Connection 架构

- **Provider**：全局身份与协议 profile，由 canonical Provider Catalog 管理。**ProviderConnection**：用户拥有的凭据 + endpoint + 验证状态。**Model**：Provider 提供的模型。**Capability**：可执行语义能力（如 image generation）。
- Provider preset UI、RouteEngine 和 Agent 只能读取 canonical catalog 投影，禁止自行维护 provider/model 名称分支（沿用现有 `check-no-raw-provider-ui-branch` 等架构门禁）。
- Connection secret 只保存为加密 `secret_ref`；API 永不返回原值；日志与 audit 统一脱敏。
- Verify 流程：协议 profile 识别 → URL 规范化 → DNS 解析与 IP 校验（拒绝私网/保留段，防 SSRF 与 DNS rebinding）→ 最小只读探测；失败保留可操作诊断，但不回显凭据。
- Quote 冻结字段扩展为 `connectionId / provider / model / capability / channel / requestProfile / priceVersion`；Adapter 不得自行切换通道或写账。
- 迁移：迁移期 dual-read 旧 profile payload 与新表；新写入只走 `provider_connections`；旧 payload 在两个稳定版本后停止读取；无法映射到安全 `secret_ref` 的旧 Connection 要求用户重新验证，不复制明文。

---

## 11. 三 Runtime 架构

| Runtime | 职责 | 不承担 |
|---|---|---|
| Browser / Vercel Presentation | 交互、可见区调度、Worker 缩略图、OPFS/IndexedDB 缓存、server 状态投影 | 异步任务权威 |
| VPS Control Plane | 身份、Connection、能力图、Quote、Job、账务、Provider Adapter、server Worker、Asset 元数据、Audit、feature flag、恢复 | 本地文件访问 |
| Local Media / Automation Runtime | 已声明能力的本地媒体任务、Browser Bridge | 任意路径、任意 Shell、凭据托管 |

- 三端通过版本化 DTO、幂等 id、签名事件和 capability manifest 通信。
- 任何 runtime 重启后均由 VPS Job / Run 状态恢复。
- Browser Bridge 与未来 Local Media Runtime 共用同一份受控 runtime manifest；Local Runtime 使用短期配对凭据、opaque asset handle 和受控根目录。

---

## 12. Local Media Runtime

### 12.1 契约

```ts
interface LocalMediaJobDto {
  jobId: string;
  kind: 'image.thumbnail' | 'image.metadata'
      | 'video.poster' | 'video.proxy'
      | 'audio.waveform' | 'audio.metadata';
  sourceAssetRef: LocalAssetRefDto;
  params: Record<string, unknown>;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  outputAssetRef?: LocalAssetRefDto;
}

interface LocalAssetRefDto {
  handle: string;                  // opaque，禁止包含原始本地路径
  hash: string;
  mime: string;
  sizeBytes: number;
  dimensions?: { width: number; height: number; durationMs?: number };
  lineage: {
    sourceAssetId?: string;
    derivedFrom?: string[];
    params?: Record<string, unknown>;
  };
}
```

### 12.2 关键规则

- Browser 资产进入 OPFS/IndexedDB；Local Runtime 仅返回 opaque handle、hash、MIME、尺寸与 lineage，禁止上传原始本地路径。
- 安全门禁：移除 fallback token 与 token 日志；token 文件 ACL + 轮换；body/尺寸上限；Zod 校验；路径 containment；symlink 拒绝；MIME sniff；解码超时与资源限额。
- `local-runner:build` 与独立测试必须进入 `verify:changes` 或 release manifest；通过前只能标记为 experimental。
- 首个纵向切片继续使用现有 Browser Worker 生成图像 thumbnail；未加固的 `local-runner` 不进入生产链。

---

## 13. AI Workspace 控制链

固定链路：

```text
IntentGate → Planner → CapabilityGraph → ToolRegistry → PermissionPolicy
→ Quote/Confirmation → Executor → Verification → Audit/Memory
```

- 权限等级固定为 `safe | confirm | dangerous | forbidden`；`dangerous` 默认拒绝，`forbidden` 无运行时 override。

```ts
interface ConfirmationGrant {
  userId: string;
  planHash: string;
  toolId: string;
  targetSnapshot: string;          // 目标状态哈希
  quoteId: string;
  maxCost: number;
  expiresAt: string;               // 过期或目标/价格变化即失效
}
```

- AI 只能使用结构化工具读写 Workspace、Canvas、Task、Asset、Connection 和 Capability；不得猜模型名、直接 fetch Provider 或调用任意 DOM/Shell。
- 每次执行展示计划、当前步骤、通道、成本、Provider、失败原因、重试/取消动作和验证结果；刷新后从 server Run 恢复。
- Threat model 覆盖：IDOR、SSRF/DNS rebinding、凭据泄漏、quote replay、双扣费、伪造 callback、过期确认、路径穿越、恶意媒体、XSS/object URL 泄漏和 Browser Bridge 越权。

---

## 14. 新 IA 与统一 Layout State

- 左侧：Connections 与 Capabilities，按 `未连接 / 可用 / 受限 / 离线` 分组，直接解释 Provider、Model、Channel、隐私和成本。
- 中心：无限画布与主编辑区，普通直接操作始终可用。
- 右侧：AI 与 Context Inspector 共用一个可调宽 dock，禁止同时出现平行侧栏；DOM 中只保留一个可访问的 AI toggle。
- 底部：Task/Run 与 Assets 共用可折叠 tray；Task Center 不再作为覆盖画布的左上浮层。
- 全局 command palette 负责查找 Capability、Provider、Asset、Workflow 和运行记录。
- 统一 layout state：minimap 基于实际 canvas viewport 定位；right dock / bottom tray 打开时自动重排。
- 继续使用现有 design tokens、组件和图标库；在 import/bundle 测量前不删除 Chakra、Motion、GSAP 等依赖。

---

## 15. 首个纵向切片（Image Provider Slice）

1. migration `018_capability_graph_foundation.sql` 新增 `provider_connections` 与 `capability_bindings`，不保存明文 secret。
2. 生产示例选择现有 Google official image adapter；自动化测试使用 `FakeProviderAdapter`，不依赖真实密钥或外部配额。
3. 用户创建并 verify Google Connection 后，Capability Graph 暴露 image generation capability；AI 通过 safe tool `capabilities.listAvailable` 获取它。
4. 用户请求生成时依次执行：计划 → Quote → 成本/通道确认 → v3 Job → RouteEngine → Google Adapter → Asset/Lineage → Worker thumbnail → Canvas node → Task Center → Verification/Audit。
5. UI 同时显示 Provider、Connection、Model、Capability、Channel、Quote、Job、Asset 和验证状态；刷新后从 VPS 恢复 Job/Asset，而不是从 sidebar/store 重建。
6. server flag `capability_graph.image_provider_slice`，按 internal → invited users → full rollout 放量。
7. 关闭 flag 仅隐藏新 graph UI/tool 并恢复旧 connection 读取；不删除新表、不回滚用户资产或账务记录。
