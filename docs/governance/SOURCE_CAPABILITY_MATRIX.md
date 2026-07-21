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
| 1.2 | 用户 API Key 视频/音频 | 部分 | `server/routes/generate-v1.js:235` 的 `/v1/generate/async`（核心实现 `submitAsyncViaGenerationV3` :149）支持 Wuyin 异步提交；`server/lib/generation-v3/adapters/` 仅有 4 个图像 adapter，无视频/音频 adapter，仍由浏览器轮询。 | upgrade |
| 1.3 | 平台积分生图 | 完全 | `server/lib/generation-v3/`（quoteEngine/billingSaga/jobLifecycle）已建立 Quote -> Job -> Billing -> Provider 闭环；旧同步路径 `server/lib/generation/generationController.js:95` billingSaga 仍在，`/v1/generate` Shadow 待 UI 切流后下线。 | keep |
| 1.4 | 平台积分视频/音频 | 部分 | `/v1/generate/async` 已移除"必须带 routeId"限制，经 `submitAsyncViaGenerationV3`（`server/routes/generate-v1.js:149`）按 Quote 通道分发并走 v3 计费闭环；但无视频/音频 v3 adapter，执行与轮询仍在浏览器。 | upgrade |
| 1.5 | BYOK 不扣平台积分 | 完全 | 通道在 Quote 创建时冻结：`server/lib/generation-v3/quoteEngine.js:93-95`（expiresAt/priceVersion/routeSnapshot）并落库 `:105-119`；预扣仅在 platform-credits 通道发生（`server/lib/generation-v3/billingSaga.js:20`）；Phase 1 Fake Provider 全通道测试通过。 | keep |

## 2. 任务执行与 Worker

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 2.1 | 浏览器侧持久化队列 | 完全 | `apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts:365`，localStorage 持久化。 | upgrade |
| 2.2 | 服务端 Durable Worker | 不符合 | `server/` 下 grep `worker`/`heartbeat` 零匹配；`server/lib/dispatcher/reconciliation.js` 是计费对账守护进程（`server/index.js:328-329` 启动），非执行 Worker。 | upgrade |
| 2.3 | 关闭浏览器后续跑 | 不符合 | 异步视频/音频由浏览器轮询（提交入口 `server/routes/generate-v1.js:235`），关闭浏览器后无人轮询。 | upgrade |
| 2.4 | 双轨执行 | 不符合 | `DurableGenerationQueue.ts:365`（前端）与 `apps/web/src/core/generation/GenerationEngine.ts:15` 并行存在。 | upgrade |

## 3. 计费与对账

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 3.1 | 预扣/结算/退款审计 | 完全 | `server/lib/generation-v3/billingSaga.js`：`reserveCredits` :20、`chargeFromReservation` :60、`refundItem` :81；调用点 `server/lib/generation-v3/jobLifecycle.js:45`（创建预扣）、`:185`（成功结算）、`:220`（失败退款）。 | keep |
| 3.2 | Quote 冻结机制 | 完全 | `packages/shared/src/generation-v3/quote.ts:39`；路由 `server/routes/generation-v3.js:33-51`；TTL 300s（`quoteEngine.js:13`）、`expiresAt` :93、`priceVersion` :94、`routeSnapshot` 冻结 :95 并落库 :105-119。 | keep |
| 3.3 | Item 级幂等 | 部分 | `migrations/017_quote_job_v3_and_ledger.sql:65` `UNIQUE(job_id, sequence)`；`jobStore.js:55-63` 按 sequence 建 Item；Job 级防重靠 `consumeQuote`（`jobLifecycle.js:62`）；item_id 为 randomUUID，尚无客户端提交的幂等键。 | upgrade |
| 3.4 | 账本与确认卡一致 | 需验证 | Item 级 ledger 已在 v3 形成（见 3.1）；确认 UI 与 ledger 金额一致性缺 E2E 证据——当前无真实 Provider 凭据，未覆盖真实生成/退款。 | verify |

## 4. Agent 运行时

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 4.1 | IntentGate -> Planner -> ToolRegistry -> PermissionPolicy 链路 | 完全 | `apps/web/src/features/ai-takeover/` 核心链路在位。 | keep |
| 4.2 | 多轮对话历史 | 不符合 | `apps/web/src/features/ai-takeover/core/llmBrain.ts:111-119` 只发 system + 单条 user；`localBrain.ts` 为纯本地规则脑（`:33-34` 是 `plan()` 入口与 `analyzeIntent` 调用），不构造 LLM 消息，同样无多轮历史。 | upgrade |
| 4.3 | 上下文裁剪 | 不符合 | 无 TokenBudget 分配规则，无摘要/工具结果回填。 | upgrade |
| 4.4 | Agent Run 中断恢复 | 不符合 | `apps/web/src/features/ai-assistant-runtime/runtime/AgentRunStore.ts:142-156` reload 时把 running/waiting 一律置 failed；存储为 localStorage（`:43-52`，key 前缀 `:27`）。 | upgrade |
| 4.5 | 跨设备续跑 | 不符合 | 依赖 localStorage（同上），无服务端 Session/Run 查询恢复。 | upgrade |

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
| 7.2 | 运行时能力 Flag | 不符合 | `server/` 下 grep `feature.?flag`（大小写不敏感）零匹配：无服务端 Flag 接口，无管理员 Kill Switch。 | upgrade |
| 7.3 | 视觉 Flag 与能力 Flag 分离 | 不符合 | 当前视觉/能力开关均为同一常量（见 7.1）。 | upgrade |

## 8. 文档治理

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 8.1 | 文档总量 | 完全 | `docs/governance/DOCUMENTATION_INDEX.md:6`：仓库共 233 份 Markdown（不含生成索引本身）。 | keep |
| 8.2 | current 分类正确 | 完全 | `docs/governance/DOCUMENTATION_INDEX.md:17`：18 份 current，达成 15–25 目标；本轮已修正旧记录（226/152）的计数漂移。 | keep |
| 8.3 | 版本事实源一致 | 部分 | `config/release-manifest.json` 是唯一版本源；但部分文档仍引用旧版本。 | archive |
| 8.4 | OpenSpec 单一 active | 完全 | `DOCUMENTATION_INDEX.md` 中仅 `upgrade-ai-creation-core` 的文档标为 current；`canvas-card-system-v2`、`expand-ai-site-capabilities`、`harden-ai-control-plane`、`modernize-ai-first-workspace-ui`、`unify-ai-collaboration-modes` 均已归类 history。 | keep |

## 9. Capability Graph 与 Provider Connection

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 9.1 | Capability Graph snapshot API | 不符合 | 全仓 grep `capability-graph` / `capability_bindings`（大小写不敏感）零匹配；无 DTO、表或 API。 | upgrade |
| 9.2 | Provider Connection 领域模型 | 不符合 | 全仓 grep `provider_connections` 零匹配；用户 API 配置仍以 profile payload、slot、entry、provider 等兼容结构混合保存。 | upgrade |
| 9.3 | Connection secret 治理（secret_ref/verify/SSRF 检查） | 不符合 | 无 `secret_ref` 存储与 verify 流程（见 9.2 零匹配）。 | upgrade |

## 10. 本地媒体与 Runtime

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 10.1 | 浏览器缩略图 Worker 与批量并发控制 | 需验证 | 界面/代码审计称已存在，但源码坐标未核定；object URL 生命周期分散在各 store/组件。 | verify |
| 10.2 | Local Runtime（local-runner）生产可用 | 不符合 | `local-runner/package.json`：独立 `tsc` 构建，未纳入根 `typecheck` / `verify:changes`；独立 typecheck 未通过；审计发现固定 fallback token、token 日志、请求体无明确上限、隐式 `any`。 | upgrade |
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
| /v1/generate 同步入口 | `server/routes/generate-v1.js:61` |
| /v1/generate/async 入口与 v3 桥接 | `server/routes/generate-v1.js:235`（`submitAsyncViaGenerationV3` :149） |
| v3 Quote 路由与冻结 | `server/routes/generation-v3.js:33-51`；`server/lib/generation-v3/quoteEngine.js:93-95,105-119` |
| v3 Job 路由 | `server/routes/generation-v3.js:53-71` |
| 统一 ProviderAdapter | `server/lib/generation-v3/providerAdapter.js:35-42`（Registry :44-78；adapters 目录仅图像 ×4 + fake） |
| v3 计费 Saga | `server/lib/generation-v3/billingSaga.js:20,60,81`；`jobLifecycle.js:45,185,220` |
| Item 幂等约束 | `migrations/017_quote_job_v3_and_ledger.sql:65` |
| 旧同步 billingSaga | `server/lib/generation/generationController.js:95` |
| 前端 DurableGenerationQueue | `apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts:365` |
| 前端 GenerationEngine | `apps/web/src/core/generation/GenerationEngine.ts:15` |
| Agent Run reload 置 failed | `apps/web/src/features/ai-assistant-runtime/runtime/AgentRunStore.ts:142-156` |
| Planner 单轮输入 | `apps/web/src/features/ai-takeover/core/llmBrain.ts:111-119` |
| handleSlides 位图旁路 | `apps/web/src/core/orchestration/TaskOrchestrator.ts:96-147` |
| 可编辑 PPTX 导出 | `apps/web/src/app/usePptRuntime.ts:613-816` |
| 硬编码 Feature Flag | `apps/web/src/config/featureFlags.ts:1-4` / `apps/web/src/app/kkaiFeatureFlags.ts:1-7` |
| 文档 233 / 18 current | `docs/governance/DOCUMENTATION_INDEX.md:6,17` |
| Browser Bridge 白名单/脱敏 | `apps/web/src/features/ai-assistant-runtime/browser/browserBridge.ts:108-147,149-190` / `browserActionCatalog.ts` |
| Capability Graph / provider_connections 不存在 | 全仓 grep 零匹配 |
| local-runner 独立构建未入 release 验证 | `local-runner/package.json` |

---

## 变更影响

本矩阵中标记为 `upgrade` 的条目共 **26 项**，构成 `upgrade-ai-creation-core` OpenSpec 的全部改造范围。标记为 `keep` 的 12 项是当前已实现能力，不得在新实现中破坏。标记为 `verify` 的 3 项需要补测量或 E2E 证据。标记为 `archive` 的 1 项是文档治理债务。
