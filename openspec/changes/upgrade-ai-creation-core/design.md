# Design: upgrade-ai-creation-core

> Status: active / Phase 1
> Companion: proposal.md, tasks.md
> Last verified: 2026-07-21

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
  messages: AgentMessage[];         // 完整对话历史（用户/助手/系统）
  summary: AgentSummary;            // 滚动摘要
  toolResults: AgentToolResult[];     // 工具结果回填
  knowledgeRefs: KnowledgeRef[];    // 知识引用
  tokenBudget: TokenBudget;
  confirmations: Confirmation[];      // 待确认/已确认授权
  checkPoints: CheckPoint[];          // 检查点
  lastHeartbeatAt: string;
  createdAt: string;
}

interface AgentContextSnapshotDto {
  activeSurface: string;
  canvasId?: string;
  canvasSummary: CanvasSummary;
  selectedNodeIds: string[];
  viewport: Viewport;
  recentEvents: CanvasEvent[];
  inputBox?: InputBoxState;
  availableTools: string[];         // 当前上下文可调用工具列表
}

interface AgentRunEventDto {
  eventId: string;
  runId: string;
  sessionId: string;
  type: 'plan_created' | 'confirmation_requested' | 'tool_called' | 'tool_result' | 'status_changed' | 'error' | 'rescheduled' | 'completed' | 'failed';
  payload: unknown;
  createdAt: string;
}
```

**关键规则**：
- Session 是服务端权威源；浏览器本地缓存仅为投影。
- Planner 输入由系统规则 + 滚动摘要 + 最近消息 + 工具结果 + 画布快照 + 知识引用组成，按 `TokenBudget` 裁剪。
- Run 恢复时从服务端事件日志重建，而非本地 localStorage。

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

SSE 流推送 `AgentRunEventDto` 与 Job 状态变更。

### 3.4 Job 控制

```http
POST /api/v1/generation/jobs/:jobId/pause
POST /api/v1/generation/jobs/:jobId/resume
POST /api/v1/generation/jobs/:jobId/cancel
```

### 3.5 Agent Session / Run

```http
POST /api/v1/agent/sessions
GET /api/v1/agent/sessions/:sessionId
POST /api/v1/agent/sessions/:sessionId/runs
GET /api/v1/agent/sessions/:sessionId/runs/:runId
POST /api/v1/agent/sessions/:sessionId/runs/:runId/confirm
POST /api/v1/agent/sessions/:sessionId/runs/:runId/cancel
POST /api/v1/agent/sessions/:sessionId/runs/:runId/recover
```

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
3. **running**：Provider 返回任务 ID，Worker 按指数退避轮询。
4. **completed / failed**：Worker 写入结果/错误，触发结算或退款。
5. **paused**：用户或策略暂停，保留租约但不提交/轮询。
6. **cancelled**：用户取消，未结算的预扣全部释放。
7. **timeout**：Worker 租约过期，任务重新进入可领取状态（最多 3 次）。

**Worker 安全规则**：
- 一个 Job 同一时刻只有一个 Worker 持有租约。
- 租约每 30 秒续约，60 秒未续约则视为失效。
- 已完成 Item 的 providerTaskId 写入不可变记录，防止重复提交。
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
