# KK Studio 源码验证能力矩阵

> Status: current
> Owner: KK Studio AI Core Team
> Verifies: `openspec/changes/upgrade-ai-creation-core/proposal.md`
> Last verified: 2026-07-21

本矩阵记录 KK Studio v1.6.0 的**当前事实**（非规划目标）。每项能力声明必须附带源码证据；证据缺失或矛盾的条目不得作为当前事实引用。

---

## 使用方式

- **符合度判定**：完全 / 部分 / 不符合。
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
| 1.2 | 用户 API Key 视频/音频 | 部分 | `server/routes/generate-v1.js:137-161` 的 `/v1/generate/async` 支持 Wuyin 异步提交，但由浏览器轮询。 | upgrade |
| 1.3 | 平台积分生图 | 部分 | `server/lib/generation/generationController.js:95` billingSaga 已存在同步图像路径；但报价、路由、队列未统一。 | upgrade |
| 1.4 | 平台积分视频/音频 | 不符合 | `/v1/generate/async` 只在 `routeId` 存在时解析用户路由，wuyinRouteHandler 无 credit 扣费逻辑。 | upgrade |
| 1.5 | BYOK 不扣平台积分 | 需验证 | 当前代码通过 routeId 区分通道，但**未在服务端形成硬约束契约**。 | upgrade |

## 2. 任务执行与 Worker

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 2.1 | 浏览器侧持久化队列 | 完全 | `apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts:365`，localStorage 持久化。 | upgrade |
| 2.2 | 服务端 Durable Worker | 不符合 | `server/` 下无 worker/lease/heartbeat 实现；`reconciliation.js` 的 job 是计费 Saga，非执行进程。 | upgrade |
| 2.3 | 关闭浏览器后续跑 | 不符合 | 异步视频/音频由浏览器轮询，关闭浏览器后无人轮询。 | upgrade |
| 2.4 | 双轨执行 | 不符合 | `DurableGenerationQueue`（前端）与 `apps/web/src/core/generation/GenerationEngine.ts:15` 并行存在。 | upgrade |

## 3. 计费与对账

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 3.1 | 预扣/结算/退款审计 | 部分 | 同步图像路径 billingSaga 存在；异步视频/音频无统一计费闭环。 | upgrade |
| 3.2 | Quote 冻结机制 | 不符合 | 无 `GenerationQuoteDto`，报价、路由和 Job 未统一。 | upgrade |
| 3.3 | Item 级幂等 | 需验证 | 同步路径有 taskId 幂等；异步路径幂等控制分散在浏览器侧。 | upgrade |
| 3.4 | 账本与确认卡一致 | 需验证 | 当前确认 UI 与 billingSaga 分离，未形成单一 Item 级 ledger。 | upgrade |

## 4. Agent 运行时

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 4.1 | IntentGate -> Planner -> ToolRegistry -> PermissionPolicy 链路 | 完全 | `apps/web/src/features/ai-takeover/` 核心链路在位。 | keep |
| 4.2 | 多轮对话历史 | 不符合 | `llmBrain.ts:111-119` 只发 system + 单条 user；`localBrain.ts:33-34` 同样只有当前输入。 | upgrade |
| 4.3 | 上下文裁剪 | 不符合 | 无 TokenBudget 分配规则，无摘要/工具结果回填。 | upgrade |
| 4.4 | Agent Run 中断恢复 | 不符合 | `AgentRunStore.ts:144-151` reload 时把 running/waiting 一律置 failed；存储为 localStorage。 | upgrade |
| 4.5 | 跨设备续跑 | 不符合 | 依赖 localStorage，无服务端 Session/Run 查询恢复。 | upgrade |

## 5. PPT

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 5.1 | 可编辑 PPTX 导出 | 完全 | `usePptRuntime.ts:613-730` 已输出逐图层 OpenXML。 | keep |
| 5.2 | PPT 生成走结构化 Slide Job | 不符合 | `TaskOrchestrator.ts:96-147` 的 `handleSlides()` 把每页生成整张 AI 图片。 | upgrade |
| 5.3 | Deck 可逐页编辑/重试 | 不符合 | 无 `PptDeckPlanDto` / `PptSlideSpecDto` / `PptDeckJobDto`。 | upgrade |

## 6. Browser Bridge

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 6.1 | 白名单 + 确认 + 审计 | 完全 | `browserBridge.ts:108-136` 白名单、L149-190 脱敏、L446-461 幂等/owner 绑定。 | keep |
| 6.2 | 禁止任意 RPA | 完全 | `browserActionCatalog.ts` 每个动作带 `requiresUserGesture` 标记。 | keep |
| 6.3 | 站点能力清单 + 冻结目标 | 不符合 | 无结构化站点能力矩阵，无冻结目标 DOM 摘要。 | upgrade |
| 6.4 | 结构化结果验证 | 不符合 | 结果解析为自由文本，无目标签名匹配。 | upgrade |

## 7. 配置与 Flag

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 7.1 | 编译期 Feature Flag | 完全 | `apps/web/src/config/featureFlags.ts:1-4`、`app/kkaiFeatureFlags.ts:1-7` 均为硬编码常量。 | upgrade |
| 7.2 | 运行时能力 Flag | 不符合 | 无服务端 Flag 接口，无管理员 Kill Switch。 | upgrade |
| 7.3 | 视觉 Flag 与能力 Flag 分离 | 不符合 | 当前视觉/能力开关均为同一常量。 | upgrade |

## 8. 文档治理

| # | 能力 | 符合度 | 当前证据 | 后续动作 |
|---|---|---|---|---|
| 8.1 | 文档总量 | 完全 | 仓库共 228 份 Markdown（不含 node_modules）。 | keep |
| 8.2 | current 分类正确 | 不符合 | `DOCUMENTATION_INDEX.md` 显示 226 份中 152 份被标为 current；历史 Roadmap 与兼容占位文档混入 current。 | upgrade |
| 8.3 | 版本事实源一致 | 部分 | `config/release-manifest.json` 是唯一版本源；但部分文档仍引用旧版本。 | archive |
| 8.4 | OpenSpec 单一 active | 不符合 | 此前有 5 个 active OpenSpec，全部已完成后未归档。 | archive |

---

## 证据坐标速查

| 论断 | 源码路径 |
|---|---|
| /v1/generate/async 仅 routeId 用户路由 | `server/routes/generate-v1.js:137-161` |
| 平台积分同步图像 billingSaga | `server/lib/generation/generationController.js:95` |
| 前端 DurableGenerationQueue | `apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts:365` |
| 前端 GenerationEngine | `apps/web/src/core/generation/GenerationEngine.ts:15` |
| Agent Run reload 置 failed | `AgentRunStore.ts:144-151` |
| Planner 单轮输入 | `llmBrain.ts:111-119` / `localBrain.ts:33-34` |
| handleSlides 位图旁路 | `TaskOrchestrator.ts:96-147` |
| 可编辑 PPTX 导出 | `usePptRuntime.ts:613-730` |
| 硬编码 Feature Flag | `apps/web/src/config/featureFlags.ts:1-4` / `app/kkaiFeatureFlags.ts:1-7` |
| 文档 226/152 current | `docs/governance/DOCUMENTATION_INDEX.md` |
| Browser Bridge 白名单/脱敏 | `browserBridge.ts:108-190` / `browserActionCatalog.ts` |

---

## 变更影响

本矩阵中标记为 `upgrade` 的条目共 **18 项**，构成 `upgrade-ai-creation-core` OpenSpec 的全部改造范围。标记为 `keep` 的 7 项是当前已实现能力，不得在新实现中破坏。标记为 `archive` 的 2 项是文档治理债务，应在 Phase 0 完成清理。
