# KK Studio 源码验证能力矩阵

> Status: current
> Owner: KK Studio AI Core Team
> Verifies: `openspec/changes/upgrade-ai-creation-core/proposal.md`
> Last verified: 2026-07-22

本矩阵记录 KK Studio v1.6.0 的**当前事实**（非规划目标）。每项能力声明必须附带源码证据；证据缺失或矛盾的条目不得作为当前事实引用。

---

## 使用方式

- **符合度判定**：完全 / 部分 / 不符合 / 需验证。
- **证据格式**：`文件路径:行号范围` 或函数名。
- **后续动作**：
  - `upgrade`：本 OpenSpec 计划升级或改造。
  - `archive`：旧实现或历史文档，不得作为当前事实引用。
  - `keep`：现状已满足宪章要求，保持。
  - `verify`：需要进一步验证或人工测试确认。

---

## 1. 执行通道

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 1.1 | 用户 API Key 生图 | 完全 | Provider 适配器、本地/云端 Key 路由已存在；BYOK 路径支持多模型。 | keep |
| 1.2 | 用户 API Key 视频/音频 | 部分 | `services/api/routes/generate-v1.js:235` 的 `/v1/generate/async`（核心实现 `submitAsyncViaGenerationV3` :149）支持 Wuyin 异步提交；`services/api/lib/generation-v3/adapters/` 仅有 4 个图像 adapter，无视频/音频 adapter，仍由浏览器轮询。 | upgrade |
| 1.3 | 平台积分生图 | 完全 | `services/api/lib/generation-v3/`（quoteEngine/billingSaga/jobLifecycle）已建立 Quote -> Job -> Billing -> Provider 闭环；旧同步路径 `services/api/lib/generation/generationController.js:95` billingSaga 仍在，`/v1/generate` Shadow 待 UI 切流后下线。 | keep |
| 1.4 | 平台积分视频/音频 | 部分 | `/v1/generate/async` 已移除"必须带 routeId"限制，经 `submitAsyncViaGenerationV3`（`services/api/routes/generate-v1.js:149`）按 Quote 通道分发并走 v3 计费闭环；但无视频/音频 v3 adapter，执行与轮询仍在浏览器。 | upgrade |
| 1.5 | BYOK 不扣平台积分 | 完全 | 通道在 Quote 创建时冻结：`services/api/lib/generation-v3/quoteEngine.js:93-95`（expiresAt/priceVersion/routeSnapshot）并落库 `:105-119`；预扣仅在 platform-credits 通道发生（`services/api/lib/generation-v3/billingSaga.js:20`）；Phase 1 Fake Provider 全通道测试通过。 | keep |

## 2. 任务执行与 Worker

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 2.1 | 浏览器侧持久化队列 | 完全 | `DurableGenerationQueue.ts:391-427,511-512` 提供 owner-scoped localStorage；`GenerationQueueSync.ts:60-75,151-205,228-240` 提供 IndexedDB mirror、鉴权服务端投影与 claim 同步。未切流任务仍由浏览器执行，跨设备续跑未验收。 | upgrade |
| 2.2 | 服务端 Durable Worker | 部分 | `services/api/lib/generation-v3/worker/workerStore.js` 与 migration 019 实现 Item lease、`SKIP LOCKED`、token、heartbeat、取消与结算；`featureFlag.js` 将新任务 admission 与 migration-ready execution 分离，`workerLoop.js` 和 `generation-v3.js` 只按 execution readiness 处理存量执行/取消。characterization 已覆盖 admission `off` + execution `true` 的 drain、聚合观测与新提交同步回退；真实数据库/internal 灰度仍未验收。 | upgrade |
| 2.3 | 关闭浏览器后续跑 | 部分 | server loop characterization 已覆盖无浏览器续跑、Worker 重建与过期租约恢复；`jobEventStream.js` 提供 owner-scoped SSE，`GET /api/v1/generation/jobs`/`jobStore.listPendingJobs` 提供 schema v3、非终态、最多 50 条的 owner-scoped discovery；Web `generationJobDiscovery.ts`、`generationJobEventClient.ts` 与 `useTaskRecovery.ts` 负责严格校验、合并本地候选并只把 `submitted/running` Job 绑定到已同步 Prompt 节点。当前不会新建节点，真实 PostgreSQL、重新登录/跨设备浏览器 E2E 仍未完成，视频/音频仍由浏览器轮询。 | upgrade |
| 2.4 | 执行权威未统一 | 不符合 | AI batch 生命周期先进入 `DurableGenerationQueue`，随后仍经 `useImageGeneration → generationService → TaskOrchestrator → GenerationEngine` 分发；部分 direct UI/legacy 路径绕过 Queue，server image Worker 又只在 flag 命中时接管。当前问题是执行生命周期权威未统一，而非两个完全独立 engine。 | upgrade |

## 3. 计费与对账

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 3.1 | 预扣/结算/退款审计 | 完全 | `services/api/lib/generation-v3/billingSaga.js` 统一实现 reserve/charge/refund；charge 仅允许 `committed reserve` 单向转换并识别 no-op。`generationMetrics.js` 通过既有 telemetry envelope 暴露无金额和业务标识的成功/失败聚合计数。 | keep |
| 3.2 | Quote 冻结机制 | 完全 | `packages/shared/src/generation-v3/quote.ts:39`；路由 `services/api/routes/generation-v3.js:33-51`；TTL 300s（`quoteEngine.js:13`）、`expiresAt` :93、`priceVersion` :94、`routeSnapshot` 冻结 :95 并落库 :105-119。 | keep |
| 3.3 | Item 级幂等 | 部分 | migration 017 保持 `UNIQUE(job_id, sequence)`；migration 019 对 `item_id` 唯一建 lease；`workerStore.js` 只在空值时按 token 写 `providerTaskId`，恢复路径只 poll；`imageWorker.js` 使用稳定 `jobId:itemId` requestId，lease 丢失不伪报成功；`jobLifecycle.js` 禁止迟到回调复活或降级终态 Item。客户端创建 Job 的显式幂等键仍未实现。 | upgrade |
| 3.4 | 账本与确认卡一致 | 需验证 | Item 级 ledger 已在 v3 形成（见 3.1），并可观测 stale route、终态冲突、charge no-op 与 refund failure；确认 UI 与 ledger 金额一致性仍缺 E2E 证据——当前无真实 Provider 凭据，未覆盖真实生成/退款。 | verify |

## 4. Agent 运行时

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 4.1 | IntentGate -> Planner -> ToolRegistry -> PermissionPolicy 链路 | 完全 | `apps/web/src/features/ai-takeover/` 核心链路在位。 | keep |
| 4.2 | 多轮对话历史 | 不符合 | `apps/web/src/features/ai-takeover/core/llmBrain.ts:111-119` 只发 system + 单条 user；`localBrain.ts` 为纯本地规则脑（`:33-34` 是 `plan()` 入口与 `analyzeIntent` 调用），不构造 LLM 消息，同样无多轮历史。 | upgrade |
| 4.3 | 上下文裁剪 | 不符合 | 无 TokenBudget 分配规则，无摘要/工具结果回填。 | upgrade |
| 4.4 | Agent Run 中断恢复 | 部分 | `AgentRunStore.ts:173-199,344-377` 对认证 owner 保留 active Run，并按时间戳合并服务端权威投影；`agentRunHydration.ts:42-67` 校验 owner-scoped list，`agentRunEventRecovery.ts:150-274` 只对最近 20 个 active + synced Run 做 bounded cursor invalidation，并在详情成功合并后推进 owner-qualified sequence；`agentSessionProjection.ts` 已提供不接触 Chat storage 的 owner-scoped Session list/detail 只读投影。migration 022 与 `agent-run-write-store.js` 已提供同 owner、首次绑定后不可改绑/解除的可选 Run/Session binding，旧客户端省略字段时不变。远端独有计划仍是不可执行 projection，Chat 安全写投影、binding 激活和语义事件 replay 仍未实现。 | upgrade |
| 4.5 | 跨设备续跑 | 部分 | 服务端 owner-scoped Run list/get、event query、Session list/get、Context Snapshot、可选 Run/Session owner binding 与 typed client 已在位，Web Run projection hydration + event cursor 已能发现并刷新第二个浏览器中的 active Run，Session list/detail 也在 startup、认证恢复与 online 时按 owner 严格刷新；owner 变化、跨 Run/乱序事件、陈旧详情和本地较新 pending snapshot 均 fail closed。`AITakeoverContext.tsx` 订阅 Run 投影但不会执行远端计划，且本地 Chat 默认不传 `sessionId`。Chat 写投影、binding 激活、跨设备执行接管和真实 E2E 仍缺失。 | upgrade |

## 5. PPT

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 5.1 | 可编辑 PPTX 导出 | 完全 | `apps/web/src/app/usePptRuntime.ts:613-816` 已输出逐图层 OpenXML。 | keep |
| 5.2 | PPT 生成走结构化 Slide Job | 不符合 | `apps/web/src/core/orchestration/TaskOrchestrator.ts:96-147` 的 `handleSlides()` 把每页生成整张 AI 图片（`:121-135`）。 | upgrade |
| 5.3 | Deck 可逐页编辑/重试 | 不符合 | 无 `PptDeckPlanDto` / `PptSlideSpecDto` / `PptDeckJobDto`。 | upgrade |

## 6. Browser Bridge

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 6.1 | 白名单 + 确认 + 审计 | 完全 | `apps/web/src/features/ai-assistant-runtime/browser/browserBridge.ts`：白名单 :108-147、脱敏 :149-190、命令稳定哈希 :199-212、幂等/owner 绑定 :446-461（另有响应侧 owner 校验 :502-528、adapter 幂等去重 :635-655）。 | keep |
| 6.2 | 禁止任意 RPA | 完全 | `apps/web/src/features/ai-assistant-runtime/browser/browserActionCatalog.ts` 每个动作带 `requiresUserGesture` 标记（字段定义 :21/:116，动作分布 :31-95 与 :125-265）。 | keep |
| 6.3 | 站点能力清单 + 冻结目标 | 不符合 | 无结构化站点能力矩阵（capability manifest），无冻结目标 DOM 摘要。 | upgrade |
| 6.4 | 结构化结果验证 | 不符合 | 结果解析为自由文本，无目标签名匹配。 | upgrade |

## 7. 配置与 Flag

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 7.1 | 编译期 Feature Flag | 完全 | `apps/web/src/config/featureFlags.ts:1-4`、`apps/web/src/app/kkaiFeatureFlags.ts:1-7` 均为硬编码常量。 | upgrade |
| 7.2 | 运行时能力 Flag | 部分 | `services/api/lib/capability-graph/featureFlag.js` 提供纯 server scope；`services/api/lib/generation-v3/imageProviderSliceAdmission.js` 在 Connection-backed Quote、同步 submit 与 durable enqueue 的副作用前统一 fail closed，并输出无业务标识的 allowed/blocked 计数。Worker 已把 admission scope 与默认关闭的 migration-ready execution flag 分离，支持停止新 durable 提交并继续 drain；统一管理员 Flag API、广播和 5 秒 Kill Switch 仍未实现。 | upgrade |
| 7.3 | 视觉 Flag 与能力 Flag 分离 | 不符合 | 当前视觉/能力开关均为同一常量（见 7.1）。 | upgrade |

## 8. 文档治理

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 8.1 | 文档总量 | 完全 | `docs/governance/DOCUMENTATION_INDEX.md:6`：仓库共 227 份 Markdown（不含生成索引本身）。 | keep |
| 8.2 | current 分类正确 | 完全 | `docs/governance/DOCUMENTATION_INDEX.md:17`：19 份 current，达成 15–25 目标。 | keep |
| 8.3 | 版本事实源一致 | 部分 | `config/release-manifest.json` 是唯一版本源；但部分文档仍引用旧版本。 | archive |
| 8.4 | OpenSpec 单一 active | 完全 | `DOCUMENTATION_INDEX.md` 中仅 `upgrade-ai-creation-core` 的文档标为 current；`canvas-card-system-v2`、`expand-ai-site-capabilities`、`harden-ai-control-plane`、`modernize-ai-first-workspace-ui`、`unify-ai-collaboration-modes` 均已归类 history。 | keep |

## 9. Capability Graph 与 Provider Connection

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 9.1 | Canonical Provider catalog | 完全 | `packages/shared/src/generation/providerCatalog.ts` 与 Provider governance checks 维持前后端目录一致。 | keep |
| 9.2 | Capability Graph snapshot API | 完全 | `packages/shared/src/capability-graph/` 定义契约；`services/api/lib/capability-graph/projection.js` 投影权威数据；`services/api/routes/capability-graph.js` 提供 snapshot API。 | keep |
| 9.3 | Provider Connection 领域模型 | 部分 | migration 018 与 `providerConnectionStore.js` / `providerConnectionService.js` 已建立新表 CRUD 和 verify；`CapabilitySourcesView.tsx` 已实际挂载 `ProviderConnectionsPanel.tsx`，由 `providerConnectionMigration.ts` 把旧 Google 设置的非敏感名称/endpoint 投影为迁移候选，要求显式重输 secret 后调用现有 create/verify，并与新 Connection 去重。桌面 Chromium smoke 已验证该 UI 闭环；旧 `ApiSettings`/profile 仍由 `userApiCloudRecordStorage.ts:514-625` 平行读写，服务端权威 dual-read、真实 Provider 验收、全 Provider 切流和观测窗口未完成。 | upgrade |
| 9.4 | Connection secret 治理（secret_ref/verify/SSRF 检查） | 完全 | `providerConnectionService.js`、`connectionVerifier.js` 与 migration 018 使用 secret reference、URL/DNS/IP 检查、最小探测和诊断脱敏，不序列化明文 secret。 | keep |
| 9.5 | Agent 查询可用能力 | 完全 | `apps/web/src/features/ai-assistant-runtime/tools/capabilityTools.ts` 注册只读 safe tool `capabilities.listAvailable`，并由 ToolRegistry 消费 snapshot。 | keep |

## 10. 本地媒体与 Runtime

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 10.1 | 浏览器缩略图 Worker 与批量并发控制 | 需验证 | 界面/代码审计称已存在，但源码坐标未核定；object URL 生命周期分散在各 store/组件。 | verify |
| 10.2 | Local Runtime（local-runner）生产可用 | 不符合 | 根 `verify:changes` 已包含 `local-runner:typecheck/build`，2026-07-22 当前两项均通过；但 `local-runner/src/security/localToken.ts:18-31` 仍输出 token、接受固定 fallback，`server.ts:28` 无请求体上限，且多处显式 `any`，安全门禁未通过。 | upgrade |
| 10.3 | 资产 OPFS/IndexedDB 持久化 | 部分 | 本地资产仍主要依赖内存对象（审计）；无 `LocalMediaJobDto` / `LocalAssetRefDto`（全仓零匹配）。 | upgrade |
| 10.4 | 真实媒体性能基线 | 不符合 | 仅有节点级 smoke：`scripts/test/verify-large-canvas-10k-smoke.mjs`（10K 通过但伴随 `localStorage QuotaExceeded` 与 100ms+ long task）；无 1K/10K 真实图片/视频/音频代理的解码并发、内存平台期、输入延迟、object URL 与恢复时间基线。 | verify |

## 11. IA 与 Layout

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 11.1 | 统一 overlay/layout state | 不符合 | 界面审计：AI dock、Task Center 浮层、minimap 相互覆盖画布区域；代码坐标待 Phase 6 核定。 | upgrade |
| 11.2 | 单一可访问 AI toggle | 不符合 | 界面审计：DOM 中同时存在 open/close 两个可见 AI 控制。 | upgrade |
| 11.3 | Connections → Capabilities 可解释 IA | 不符合 | "能力来源"页仅为 Provider preset 列表；"无可用模型"未说明缺少哪种 Connection 或 Capability（界面审计）。 | upgrade |

---

## 证据坐标速查

| 论断 | 源码路径 |
|---|---|
| /v1/generate 同步入口 | `services/api/routes/generate-v1.js:61` |
| /v1/generate/async 入口与 v3 桥接 | `services/api/routes/generate-v1.js:235`（`submitAsyncViaGenerationV3` :149） |
| v3 Quote 路由与冻结 | `services/api/routes/generation-v3.js:33-51`；`services/api/lib/generation-v3/quoteEngine.js:93-95,105-119` |
| v3 Job 路由 | `services/api/routes/generation-v3.js:53-71` |
| 统一 ProviderAdapter | `services/api/lib/generation-v3/providerAdapter.js:35-42`（Registry :44-78；adapters 目录仅图像 ×4 + fake） |
| v3 计费 Saga | `services/api/lib/generation-v3/billingSaga.js:20,60,81`；`jobLifecycle.js:45,185,220` |
| Item 幂等约束 | `infrastructure/database/migrations/017_quote_job_v3_and_ledger.sql:65` |
| 旧同步 billingSaga | `services/api/lib/generation/generationController.js:95` |
| 前端 DurableGenerationQueue 与同步投影 | `apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts:391-427,511-512` / `GenerationQueueSync.ts:60-75,151-205,228-240` |
| 生成分发链 | `apps/web/src/core/generation/GenerationEngine.ts:15` / `TaskOrchestrator.ts:65-66` |
| Agent Run 本地恢复、服务端同步、权威读取与 Web event cursor | `apps/web/src/features/ai-assistant-runtime/runtime/AgentRunStore.ts:173-199,344-377` / `agentRunHydration.ts:42-67` / `agentRunEventRecovery.ts:150-274` / `AgentRuntime.ts:1046-1078` / `services/api/lib/agent-run-read-store.js` / `services/api/lib/agent-run-event-store.js` / `services/api/routes/ai-assistant.js` / `infrastructure/database/migrations/020_agent_run_events.sql` |
| Agent Session、Context Snapshot 权威数据面与 Web 只读投影 | `packages/shared/src/contracts/dto/ai-assistant.ts` / `services/api/lib/agent-session-store.js` / `services/api/routes/ai-assistant.js` / `infrastructure/database/migrations/021_agent_sessions.sql` / `apps/web/src/features/ai-assistant-runtime/runtime/agentSessionProjection.ts` |
| Agent Run/Session owner 强约束可选绑定 | `packages/shared/src/contracts/dto/ai-assistant.ts` / `services/api/lib/agent-run-write-store.js` / `services/api/routes/ai-assistant.js` / `infrastructure/database/migrations/022_agent_run_session_binding.sql` |
| Planner 单轮输入 | `apps/web/src/features/ai-takeover/core/llmBrain.ts:111-119` |
| handleSlides 位图旁路 | `apps/web/src/core/orchestration/TaskOrchestrator.ts:96-147` |
| 可编辑 PPTX 导出 | `apps/web/src/app/usePptRuntime.ts:613-816` |
| 硬编码 Feature Flag | `apps/web/src/config/featureFlags.ts:1-4` / `apps/web/src/app/kkaiFeatureFlags.ts:1-7` |
| 文档 227 / 19 current | `docs/governance/DOCUMENTATION_INDEX.md:6,17` |
| Browser Bridge 白名单/脱敏 | `apps/web/src/features/ai-assistant-runtime/browser/browserBridge.ts:108-147,149-190` / `browserActionCatalog.ts` |
| Canonical Provider catalog | `packages/shared/src/generation/providerCatalog.ts` |
| Capability Graph 契约与投影 | `packages/shared/src/capability-graph/` / `services/api/lib/capability-graph/projection.js` / `services/api/routes/capability-graph.js` |
| Provider Connection 存储与验证 | `infrastructure/database/migrations/018_capability_graph_foundation.sql` / `services/api/lib/capability-graph/providerConnectionService.js` / `connectionVerifier.js` |
| Provider Connection 安全迁移桥 | `apps/web/src/services/provider-connections/providerConnectionMigration.ts` / `apps/web/src/components/settings/{ProviderConnectionsPanel.tsx,views/CapabilitySourcesView.tsx}` / `scripts/test/verify-desktop-settings-smoke.mjs` |
| Agent capability tool | `apps/web/src/features/ai-assistant-runtime/tools/capabilityTools.ts` |
| Server image Durable Worker | `infrastructure/database/migrations/019_generation_image_worker.sql` / `packages/shared/src/generation-worker/` / `services/api/lib/generation-v3/worker/` |
| Generation v3 pending Job discovery | `services/api/lib/generation-v3/jobStore.js` / `services/api/routes/generation-v3.js` / `packages/shared/src/contracts/client/kk-api-client.ts` / `apps/web/src/services/generation/generationJobDiscovery.ts` / `apps/web/src/hooks/useTaskRecovery.ts` |
| local-runner build/typecheck 已纳入 verify:changes，但安全 gate 未闭环 | `package.json` / `local-runner/package.json` / `local-runner/src/security/localToken.ts` |

---

## 变更影响

本矩阵中标记为 `upgrade` 的条目共 **24 项**，构成 `upgrade-ai-creation-core` OpenSpec 的剩余改造范围。标记为 `keep` 的 16 项是当前已实现能力，不得在新实现中破坏。标记为 `verify` 的 3 项需要补测量或 E2E 证据。标记为 `archive` 的 1 项是文档治理债务。
