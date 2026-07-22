# Tasks: upgrade-ai-creation-core

> Status: active / Phase 2a image Worker foundation landed / migration rehearsal, gray rollout and recovery E2E pending
> Last updated: 2026-07-22
> Phase 0 progress: 10/10 tasks completed. Phase 1: routing/quote/billing migration and DTOs completed — closure gate below. Phase 2: Capability Graph / Provider Connection and server image Worker code foundations completed; migration rehearsal, rollout and recovery E2E remain open.

---

## Phase 0 — 事实源与基线（1 周）

- [x] 创建本 OpenSpec 目录并撰写 `proposal.md`、`design.md`、`tasks.md`（基础框架完成）。
- [x] 撰写 `docs/governance/PRODUCT_CORE_CHARTER.md`（产品核心宪章）。
- [x] 撰写 `docs/governance/SOURCE_CAPABILITY_MATRIX.md`（源码验证能力矩阵）。
- [x] 修复 `scripts/governance/check-documentation-governance.mjs` 文档分类器：正确区分 `current` / `reference` / `proposed` / `archive`。
- [x] 修复路径存在性检查：校验所有规范文档中引用的源码路径是否真实存在。
- [x] 修复能力声明证据检查：校验 capability 声明必须附带源码文件/行号证据，否则降级为 `proposed`。
- [x] 在受控 PostgreSQL 实例上按序执行 `infrastructure/database/migrations/` 全部脚本，重点演练 `016` 迁移，验证幂等性与对账视图。发现并修复 `013` 的 `user_id` 类型不匹配；需先跑 `bootstrap-kk-vps.sql` 再跑 migrations。
- [x] 将旧 Sprint/Roadmap/日期审计/已完成计划/根 `task.md` 和兼容占位文档归档或标记为 `historical/compatibility-stub`。
- [x] 运行 `governance:docs`、`governance:check`、`architecture:check`、`typecheck`、`build` 并修复违规。
- [x] Phase 0 验收：current 文档 ≤25 份；治理校验全绿；016 迁移演练报告归档到 `openspec/changes/upgrade-ai-creation-core/reports/`。

---

## Phase 1 — 路由、报价与计费（2 周）

- [x] 实现 `GenerationQuoteDto` 与 `POST /api/v1/generation/quotes`（冻结通道、价格版本、过期时间）。
- [x] 实现 `GenerationJobDto v3` 与 `POST /api/v1/generation/jobs`（绑定 quoteId、互斥通道、Item 结构）。
- [x] 为图片、视频、音频建立统一 `ProviderAdapter` 接口，抽象 submit/poll/cancel/parse。
- [x] 将 `/v1/generate` 同步图像路径改造为 Quote -> Job -> Billing -> Provider -> Asset 链路（核心链路在 `generation-v3` 子系统就绪，旧 `/v1/generate` 入口 Shadow 已预留，待 UI 切流后完全下线旧路径）。
- [x] 将 `/v1/generate/async` 改造为支持平台积分通道，移除"必须带 routeId"的限制，按 Quote 通道分发。
- [x] 实现 Job 创建时的预扣/冻结、失败时的退款、成功时的结算，全部绑定 Quote 和 Item 幂等键。
- [x] 移除遥测/日志中的默认虚构费用，所有费用必须来自 Quote。
- [x] Fake Provider 测试覆盖：BYOK、本地 Key、云端 Key、平台积分、setup-required 的提交/失败/取消。
- [x] 运行 Phase 1 相关测试 + `verify:changes`（单元 1878 pass / 0 fail / 2 skip；contract 15 pass / 0 fail；integration 13 pass / 0 fail；e2e 11 pass / 0 fail；architecture:check、governance:check、typecheck、spec:check、build、encoding check 全绿。修复 `verify:canvas-performance` 在 Node 22 下的 `document is not defined` 未捕获异常。`npm run verify:changes` 脚本内含 Node 24 专属标志，当前运行时为 Node 22，已手工跑完其等价子集）。

> Phase 1 集成过程中发现并修复的关键问题：
> - `submitJob` 原先会先把 Item 状态更新为 `failed` 再调用 `failItem`，导致 `failItem` 的幂等守卫直接返回，既未写入 `error_code/error_message`，也未触发按 Item 退款。已改为：pending/running 走 `submitted` 状态，success 走 `completeItem`，failed 直接走 `failItem`。
> - `submitJob` 使用 `getActiveQuote` 读取已消费的 Quote，导致提交阶段报 `QUOTE_EXPIRED`。已新增 `getQuote`（不强制 `active` 状态但校验未过期），提交阶段改用 `getQuote`。
> - `/v1/generate/async` 桥接需要返回可直接访问的 asset URL。当前过渡方案将 URL 直接存入 `generation_job_items.asset_id`，后续应新增 `asset_url` 字段并将 `asset_id` 恢复为唯一标识。
> - `verify:canvas-performance` 在 Node 22 测试运行后会因 `CanvasConnectorScheduler` 的 pending raf 触发 `document is not defined` 未捕获异常。已修复：`updateConnectorPath` 增加 `typeof document === 'undefined'` 守卫，并在性能测试 `afterAll` 中清理调度器状态。

---

## Phase 1 Closure Gate — 文档与契约对齐（docs-only）

- [x] 修正 proposal / design / tasks 三处状态头语义不一致：统一为 "Phase 1 closed, entering Phase 2"，Last verified 更新为 2026-07-22。
- [x] 修正文档计数漂移：实际为 233 份 Markdown / 18 份 current（达成 15–25 目标），同步 proposal、能力矩阵与项目状态文档。
- [x] 修正能力矩阵证据坐标：Browser Bridge 等条目改写为完整路径 + 行号，并按 Phase 1 交付事实刷新符合度与 upgrade/keep/archive 统计。
- [x] 将 Capability Graph、Provider Connection、三 Runtime、Local Media、AI Workspace 控制链、新 IA 契约写入 `design.md` 第 9–15 节。
- [x] 记录 Phase 1 当时的测试证据基线：Provider governance 38 tests、Canvas benchmark 3/3、10K smoke（伴随 quota 警告与 long task）；当时 `local-runner` typecheck 未通过，2026-07-22 当前复验已通过 typecheck/build，但安全门禁仍未完成。
- [x] 在本文档建立 PR 验收模板（见文末），后续每个 PR 按模板填写。
- [x] 同步 `docs/governance/PROJECT_STATE_AND_VALIDATION.md` 验证入口与治理状态。

---

## Phase 2 — 云端 Durable Worker + Capability Graph 前置（3 周，拆 2a + 2b）

### 2a — Capability Graph / Connection 前置 + 图片 Worker（第 1–2 周）

- [x] migration `018_capability_graph_foundation.sql`：新增 `provider_connections`、`capability_bindings` 与 asset lineage relation；additive，不保存明文 secret；迁移专项测试已覆盖结构、幂等与安全约束。
- [x] Capability Graph DTO（Zod discriminated union）+ projection service + `GET /api/v1/capability-graph/snapshot`；Actor/Job/Run/Audit 从现有权威表投影，不建 EAV 节点表。
- [x] Provider Connection CRUD + verify API（协议 profile、URL 规范化、DNS/IP/SSRF 检查、最小探测、诊断脱敏）；新写入走 `provider_connections`，兼容读取仍保留删除门禁。
- [x] 只读 safe tool `capabilities.listAvailable` 接入 ToolRegistry。
- [x] 首个纵向切片的代码基础：Google official image credentials / adapter、`FakeProviderAdapter` 测试路径与 server flag `capability_graph.image_provider_slice` 已落地。
- [ ] 完成 `capability_graph.image_provider_slice` 的 internal → invited → full 灰度与关闭 flag 回退验证；在切流验收前不删除旧 connection 读取。
- [x] Asset lineage：生成 Asset 记录源资产、派生关系与参数；Quote 冻结字段扩展为 `connectionId/provider/model/capability/channel/requestProfile/priceVersion`。
- [x] 在 `services/api/` 新增 image Worker 子系统：migration 019 租约表、`FOR UPDATE SKIP LOCKED` 领取、token 防陈旧写、心跳续约、提交、指数退避轮询、取消、单次调用超时、Job 总时限与租约失效恢复。
- [x] 实现 Worker 与冻结图像 Provider Adapter 对接；`GENERATION_IMAGE_DURABLE_WORKER_ENABLED=off` 默认保持原同步路径，并支持 `internal → invited → full` user allowlist scope，命中用户的 `POST .../submit` 才入服务端队列。
- [x] Characterization 覆盖无浏览器参与的续跑、Worker 重建、过期租约接管、Provider cancel、总时限与完成 Item 幂等；专项测试位于 `tests/unit/generation-image-worker*.test.ts`。
- [x] Worker 的 token-guarded `complete / fail / cancel / requeue` 只有数据库写入成功才报告对应结果；lease 已丢失统一返回内部 `lease_lost`。共享 Item 生命周期禁止迟到回调在 `completed / failed / cancelled` 终态之间互相复活或降级。
- [x] 修复 migration 015 旧 `generation_jobs_status_check` 与 v3 生命周期不兼容：migration 017 现在同时保留 v2 只读状态并接受 `quoted / reserved / submitted` 等 v3 写入状态；真实 PostgreSQL 演练仍由下一项 gate 跟踪。
- [ ] 在受控 PostgreSQL 按 001→019 顺序演练 migration 019 的空库、存量库与重复执行，并验证 migration 018 数据原样保留。
  - 安全入口已就绪：`npm run rehearse:migration:019` 只接受专用 `KK_MIGRATION_*` 变量、名称含 `rehearsal` 且明确确认的空数据库；工具执行 bootstrap + 001→018、写入 018 sentinel、执行 019 两次并核对 sentinel/lease。当前机器无真实 PostgreSQL，故本 gate 保持未完成。
- [ ] 完成 `GENERATION_IMAGE_DURABLE_WORKER_ENABLED` internal 灰度、关闭 flag 回退旧同步提交以及运行指标观测。
  - [x] 控制面 characterization 已覆盖：`off`/未命中用户只走旧同步提交，命中 internal 的 image 才入队，非 image 回退同步；Worker loop 在 `off` 不启动。既有 `/v1/metrics` envelope 增加无 user/job/payload 的聚合 Worker outcome、延迟、submit/poll/cancel 与 durable/legacy 计数。真实 internal 放量和观测窗口仍未执行。
  - [x] 计费/报价聚合观测已接入同一 metrics envelope：覆盖 quote expired、frozen route stale、重复 completion 拦截、reserve/charge/refund 成功与失败、charge no-op；不记录用户、Job、Quote、金额或错误文本。`chargeFromReservation` 只允许 `committed reserve` 单向结算并通过 `RETURNING` 识别重复写。真实账本观测窗口仍未执行。
- [ ] 真实浏览器关闭/重新登录后通过 SSE 事件流恢复 Job 投影，并完成跨设备 E2E。
  - [x] 服务端 `/api/v1/generation/jobs/:jobId/events` 已提供 owner-scoped 全量 Job 投影：owner 校验命中后才打开 SSE，投影变化时推送共享 `GenerationJobEvent`，含 heartbeat、终态关闭与断连清理。浏览器消费、重连和跨设备 E2E 仍未完成。
  - [x] Web `useTaskRecovery` 已接入鉴权 fetch-stream consumer：共享 schema 校验投影、单会话一次 token refresh、非终态断流指数退避、owner 变化/卸载 abort，UUID 任务在 404 或网络失败时回退旧轮询。真实浏览器关闭/重新登录与跨设备 E2E 仍未执行。
- [x] 验证已完成 Item 不再领取；过期租约若已有 `providerTaskId` 只 poll、不重复 submit，执行仍使用冻结 route snapshot。
- [ ] 真实媒体 benchmark 基线作为 2a 验收门禁：1K 混合代理输入响应 p95 ≤100ms、三轮导入/删除后内存增长 ≤10%、object URL 回落到活动资产数。

### 2b — 视频/音频 Worker（第 2–3 周）

- [ ] 将视频/音频异步链路从浏览器轮询迁移到 Worker 轮询。
- [ ] 实现 Worker 对 Wuyin 等异步后端的 submit/status/cancel 封装。
- [ ] Worker 重启、租约失效、跨设备登录续跑测试。
- [ ] 对账系统：Job 与 Provider 侧状态、账本、确认卡金额三方对账。
- [ ] 验证关闭浏览器、Worker 重启、租约失效后的连续执行。
- [ ] 运行 Phase 2 相关测试 + `verify:changes`。

---

## Phase 3 — Agent 上下文与 Run 恢复（2 周）

- [ ] 实现 `AgentSessionDto`、`AgentContextSnapshotDto`、`AgentRunEventDto` 表结构与 API。
- [ ] 改造 `llmBrain.ts` / `localBrain.ts` Planner 输入：使用结构化 Session Context（系统规则+摘要+消息+工具结果+画布快照+知识引用）。
- [ ] 实现 Token 预算分配规则并写入 OpenSpec 可测契约。
- [ ] 实现工具结果回填、上下文裁剪、多轮指代支持。
- [ ] Agent 通过 ToolRegistry 查询 capability snapshot（`capabilities.listAvailable`），Planner 输入包含能力图摘要，禁止猜模型名。
- [ ] 将 `AgentRunStore` 从 localStorage 升级为服务端权威源，reload 时不再置 failed。
- [ ] 实现 Run 恢复、最多三次受控重规划、确认过期处理；confirmation grant 绑定 `userId/planHash/toolId/targetSnapshot/quoteId/maxCost/expiresAt`。
- [ ] 验证 owner/画布切换、崩溃恢复、跨设备查询。
- [ ] 运行 Phase 3 相关测试 + `verify:changes`。

---

## Phase 4 — PPT Agent 全流程（2 周）

- [ ] 实现 `PptDeckPlanDto`、`PptSlideSpecDto`、`PptDeckJobDto` 和数据库表；不扩大 scope，Deck Job 复用既有 Job/Asset/Lineage 契约。
- [ ] 实现 `ppt.createDeckJob`、`ppt.getDeckJob`、`ppt.updateDeck`、`ppt.exportEditableDeck` 工具。
- [ ] 将 `TaskOrchestrator.handleSlides()` 旁路替换为 `PptDeckPlan -> Slide Jobs -> Editable Deck`。
- [ ] 每页独立生成可编辑图层（文本/图片/形状），不生成整页位图。
- [ ] 复用 `usePptRuntime.ts` 已有 `handleExportPptxEditable` 做最终导出。
- [ ] PPTX 解包检查：OpenXML、文字层、图片层、顺序、关系文件；PowerPoint/LibreOffice 编辑回归。
- [ ] 运行 Phase 4 相关测试 + `verify:changes`。

---

## Phase 5 — Browser Bridge 与 Grok Worker（1–2 周）

- [ ] 增强 `browserBridge.ts`：站点能力清单（capability manifest）、冻结目标、结构化结果验证。
- [ ] 保留白名单、确认、审计、脱敏，禁止任意 selector/URL/Shell/自动公开发布。
- [ ] 实现 Browser Bridge 断连 setup_required 处理与 SSRF 防护；Browser Bridge 与未来 Local Media Runtime 共用受控 runtime manifest。
- [ ] Local Runtime 安全加固：移除 fallback token 与 token 日志、token 文件 ACL/轮换、body/尺寸上限、Zod 校验、路径 containment、symlink 拒绝、MIME sniff、解码超时与资源限额。
- [ ] `local-runner:build` 与独立测试纳入 `verify:changes` 或 release manifest；通过前只标记 experimental。
- [ ] 建立 ACP Gateway，隔离 Grok 输出 patch/artifact。
- [ ] 管理员审批流程：Grok 输出必须经审批后执行 typecheck/build/test，禁止访问计费/生成/数据库/发布。
- [ ] 运行 Phase 5 相关测试 + `verify:changes`。

---

## Phase 6 — UI 持续演进（1–2 周）

- [ ] 将 `apps/web/src/config/featureFlags.ts` 和 `app/kkaiFeatureFlags.ts` 硬编码常量升级为服务端 Feature Flag。
- [ ] 实现 `/api/v1/admin/feature-flags` 与客户端广播（SSE 或短轮询）。
- [ ] 使用 `workspaceUiVariant` 等视觉 Flag 分阶段切换工作台 UI。
- [ ] 渐进式 IA：统一 layout state、左侧 Connections/Capabilities、右侧单一 AI + Inspector dock、底部 task/assets tray、全局 command palette、minimap 基于真实 viewport 重排、DOM 单一 AI toggle。
- [ ] UI 依赖收敛须先有 import/bundle 测量数据，再决定 Chakra、Motion、GSAP 等去留。
- [ ] 旧路径删除门禁：迁移完成 + 兼容期结束 + flag 回滚验证 + 观测窗口通过后，才删除重复 pricing catalog、旧队列写路径与兼容 alias。
- [ ] 确保新旧 UI 同时读取相同 Job、Run、Canvas、Deck 投影；关闭 Flag 只回滚界面，不回滚业务数据。
- [ ] 验证 Kill Switch 在 5 秒内生效。
- [ ] 运行 Phase 6 相关测试 + `verify:changes`。

---

## 最终验收

- [ ] 全量 Fake Provider 测试：所有通道的提交、轮询、失败、取消。
- [ ] 计费验收：Quote 过期、余额不足、并发预扣、重复请求、失败退款、重试只收费一次；账本与确认卡一致。
- [ ] Worker 验收：关闭浏览器、Worker 重启、租约失效、跨设备登录后继续执行；已完成 Item 不重复。
- [ ] Agent 验收：多轮指代、上下文裁剪、工具结果回填、确认过期、owner/画布切换、崩溃恢复、最多三次受控重规划。
- [ ] PPT 验收：OpenXML 解包、文字/图片层、顺序、关系文件；PowerPoint/LibreOffice 可编辑。
- [ ] Browser Bridge 验收：SSRF、动态目标、脱敏、二次确认、断连 setup_required，无模拟成功。
- [ ] Contract 验收：DTO discriminated union、未知版本拒绝、secret 永不序列化、edge ownership/status/constraints 完整。
- [ ] Migration 验收：空库、已有用户、重复执行、dual-read、回滚 flag、跨用户隔离。
- [ ] Integration 验收：Connection verify、quote 过期、route snapshot 冻结、Job 幂等、Adapter 失败、退款/对账、Asset lineage、刷新恢复。
- [ ] Security 验收：SSRF/私网/重定向、IDOR、quote replay、callback spoof、路径穿越、symlink、超大/伪 MIME 媒体、过期 confirmation。
- [ ] E2E 验收：连接 Google（自动化用 Fake）→ AI 规划 → 确认 → 生成 → thumbnail → canvas → Task Center → 刷新恢复 → audit。
- [ ] UX 验收：单一 AI toggle、键盘/焦点顺序、dock/tray/minimap 不重叠、失败状态提供可执行恢复动作。
- [ ] 10K 验收：现有 smoke 零回归、DOM 峰值不高于当前 1,305、连接线误差小于 1px。
- [ ] 真实媒体验收：1K 混合代理输入响应 p95 ≤100ms；只 hydrate viewport+overscan；三轮导入/删除后内存相对首轮稳定点增长 ≤10%；object URL 回落到活动资产数。
- [ ] 治理验收：current 文档 15–25 份，`architecture:check`、`governance:check`、`typecheck`、`build`、完整测试、`verify:changes` 全绿。
- [ ] 灰度发布：内部管理员 → 受邀测试用户 → 全量三阶段；监控报价不一致、重复扣费、退款失败、Worker 延迟、Run 恢复率、PPT 导出失败率。

---

## PR 验收模板（每个 PR 必须填写）

每个 PR 必跑检查：

```bash
npm run architecture:check
npm run governance:check
npm run typecheck
npm run spec:check
# 以及相关 tests / build
```

合并前必跑：

```bash
npm run verify:changes
npm run verify:large-canvas-10k
```

每个 task / PR 描述必须包含以下字段：

1. **问题**：要解决什么，证据是什么。
2. **决策**：方案与关键取舍，为什么不选替代方案。
3. **迁移**：数据/配置如何迁移，是否 additive。
4. **兼容**：旧 API / 旧数据 / 旧 UI 的兼容策略与期限。
5. **flag**：使用的 feature flag 名称、默认值、灰度阶段。
6. **回滚**：关闭 flag 的行为；禁止 destructive rollback。
7. **安全**：威胁模型相关项（IDOR/SSRF/凭据/replay/路径/媒体/XSS 等）与处理。
8. **性能**：是否影响 10K / 真实媒体基线，附测量数据。
9. **测试**：contract / migration / integration / security / E2E / UX 覆盖情况。
10. **残余风险**：已知未覆盖项与跟踪方式。
11. **删除条件**：旧路径/兼容 alias 的删除前置（迁移完成 + 兼容期 + flag 回滚验证 + 观测窗口）。
