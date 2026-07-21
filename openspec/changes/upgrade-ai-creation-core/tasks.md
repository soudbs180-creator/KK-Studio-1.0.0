# Tasks: upgrade-ai-creation-core

> Status: active / Phase 1 in progress
> Last updated: 2026-07-21
> Phase 0 progress: 10/10 tasks completed. Phase 1: routing/quote/billing migration and DTOs in progress.

---

## Phase 0 — 事实源与基线（1 周）

- [x] 创建本 OpenSpec 目录并撰写 `proposal.md`、`design.md`、`tasks.md`（基础框架完成）。
- [x] 撰写 `docs/governance/PRODUCT_CORE_CHARTER.md`（产品核心宪章）。
- [x] 撰写 `docs/governance/SOURCE_CAPABILITY_MATRIX.md`（源码验证能力矩阵）。
- [x] 修复 `scripts/governance/check-documentation-governance.mjs` 文档分类器：正确区分 `current` / `reference` / `proposed` / `archive`。
- [x] 修复路径存在性检查：校验所有规范文档中引用的源码路径是否真实存在。
- [x] 修复能力声明证据检查：校验 capability 声明必须附带源码文件/行号证据，否则降级为 `proposed`。
- [x] 在受控 PostgreSQL 实例上按序执行 `migrations/` 全部脚本，重点演练 `016` 迁移，验证幂等性与对账视图。发现并修复 `013` 的 `user_id` 类型不匹配；需先跑 `bootstrap-kk-vps.sql` 再跑 migrations。
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

## Phase 2 — 云端 Durable Worker（3 周，拆 2a + 2b）

### 2a — 图片 Worker（第 1 周）

- [ ] 在 `server/` 新增 Worker 子系统：租约表、心跳续约、任务领取、提交、轮询、超时、取消。
- [ ] 实现 Worker 与图像 Provider Adapter 对接，完成图片 Job 的云端执行。
- [ ] 浏览器关闭后 Worker 继续执行，重新登录时通过 SSE 事件流恢复投影。
- [ ] 验证已完成 Item 永不重复提交或换通道。

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
- [ ] 将 `AgentRunStore` 从 localStorage 升级为服务端权威源，reload 时不再置 failed。
- [ ] 实现 Run 恢复、最多三次受控重规划、确认过期处理。
- [ ] 验证 owner/画布切换、崩溃恢复、跨设备查询。
- [ ] 运行 Phase 3 相关测试 + `verify:changes`。

---

## Phase 4 — PPT Agent 全流程（2 周）

- [ ] 实现 `PptDeckPlanDto`、`PptSlideSpecDto`、`PptDeckJobDto` 和数据库表。
- [ ] 实现 `ppt.createDeckJob`、`ppt.getDeckJob`、`ppt.updateDeck`、`ppt.exportEditableDeck` 工具。
- [ ] 将 `TaskOrchestrator.handleSlides()` 旁路替换为 `PptDeckPlan -> Slide Jobs -> Editable Deck`。
- [ ] 每页独立生成可编辑图层（文本/图片/形状），不生成整页位图。
- [ ] 复用 `usePptRuntime.ts` 已有 `handleExportPptxEditable` 做最终导出。
- [ ] PPTX 解包检查：OpenXML、文字层、图片层、顺序、关系文件；PowerPoint/LibreOffice 编辑回归。
- [ ] 运行 Phase 4 相关测试 + `verify:changes`。

---

## Phase 5 — Browser Bridge 与 Grok Worker（1–2 周）

- [ ] 增强 `browserBridge.ts`：站点能力清单、冻结目标、结构化结果验证。
- [ ] 保留白名单、确认、审计、脱敏，禁止任意 selector/URL/Shell/自动公开发布。
- [ ] 实现 Browser Bridge 断连 setup_required 处理与 SSRF 防护。
- [ ] 建立 ACP Gateway，隔离 Grok 输出 patch/artifact。
- [ ] 管理员审批流程：Grok 输出必须经审批后执行 typecheck/build/test，禁止访问计费/生成/数据库/发布。
- [ ] 运行 Phase 5 相关测试 + `verify:changes`。

---

## Phase 6 — UI 持续演进（1–2 周）

- [ ] 将 `apps/web/src/config/featureFlags.ts` 和 `app/kkaiFeatureFlags.ts` 硬编码常量升级为服务端 Feature Flag。
- [ ] 实现 `/api/v1/admin/feature-flags` 与客户端广播（SSE 或短轮询）。
- [ ] 使用 `workspaceUiVariant` 等视觉 Flag 分阶段切换工作台 UI。
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
- [ ] 治理验收：current 文档 ≤25 份，`architecture:check`、`governance:check`、`typecheck`、`build`、完整测试、`verify:changes` 全绿。
- [ ] 灰度发布：内部管理员 → 受邀测试用户 → 全量三阶段；监控报价不一致、重复扣费、退款失败、Worker 延迟、Run 恢复率、PPT 导出失败率。
