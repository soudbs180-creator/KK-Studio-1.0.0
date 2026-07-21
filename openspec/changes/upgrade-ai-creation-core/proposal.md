# Change Proposal: upgrade-ai-creation-core

> Status: active / Phase 1 closed, entering Phase 2
> Owner: KK Studio AI Core Team
> Source of truth: this OpenSpec change
> Last verified: 2026-07-22

---

## 1. 动机

KK Studio v1.6.0 已完成"AI 优先工作台"四大战略变更的代码落地，Phase 0/1 已交付统一报价（Quote）、GenerationJobDto v3、统一 Provider Adapter 与冻结通道，但 AI 创作核心的关键闭环仍未完成：

- 服务端是请求代理与计费网关，却不是生成任务的**权威控制面**；关闭浏览器后异步任务（视频/音频/批量）无人继续推进。
- 报价、路由、队列、对账的统一事实源刚在同步图像链路建立，**尚未覆盖异步视频/音频与 Worker 执行**，浏览器侧队列仍是事实上的执行权威。
- Agent 运行时仅有当前指令和画布上下文，没有跨轮对话历史、摘要和工具结果回填， reload 后 running Run 被直接标记为失败。
- PPT 生成走 `handleSlides()` 旁路，把整页压成 AI 图片，与已有的可编辑 OpenXML 导出脱节。
- 文档治理已收敛到 233 份 Markdown、18 份 current（达成 15–25 目标），但能力矩阵、项目状态文档与本 OpenSpec 状态头存在计数、源码路径与运行状态漂移。
- "能力来源"页面只是 Provider preset 列表；用户无法理解 `Connection → Provider → Model → Capability → Channel` 关系，"无可用模型"不能直接说明缺少哪种 Connection 或 Capability。
- 用户 API 配置仍以 profile payload、slot、entry、provider 等兼容结构混合保存，缺少独立 Provider Connection 领域模型，凭据生命周期（加密存储、轮换、脱敏、撤销）不可治理。
- `local-runner` 仍是 Browser/OpenCLI 原型：固定 fallback token、token 日志、请求体无明确上限、隐式 `any`，独立 typecheck 未通过，不得进入生产链。
- AI dock、Task Center 浮层与 minimap 相互覆盖画布区域，AI toggle 在 DOM 中同时存在 open/close 两个可见控制；缺少统一 layout state 与新信息架构（IA）。
- 真实媒体负载缺少基线：10K smoke 通过（11,103 节点、DOM 峰值约 1,305、连线误差约 0.097px）但伴随 `localStorage QuotaExceeded` 与多次 100ms+ long task；1K/10K 真实图片/视频/音频代理的解码并发、内存平台期、输入延迟、object URL 数量与恢复时间均未测量。

本 OpenSpec 把 KK Studio 从"功能集合"升级为"云端权威控制面 + 浏览器投影 + 受控本地媒体 Runtime"的 AI 创作核心架构。

---

## 2. 目标

2.1 **Express 成为唯一权威控制面**
负责鉴权、报价(Quote)、计费、Worker 调度、状态持久化、审计和对账。浏览器仅消费状态投影、处理画布落卡、运行本地 Browser Bridge 守护进程。

2.2 **统一固定链路**
`Agent -> ToolRegistry -> DurableJob -> RouteEngine -> Billing -> Provider -> Asset -> Canvas -> Verification`
删除 Agent Queue 与 GenerationEngine 的双轨执行；同一路径服务生图、视频、音频、PPT 和网页自动化。

2.3 **互斥执行通道**
BYOK、云端用户 Key、平台积分、用户网页会员必须是四条互斥通道：
- BYOK 只消耗用户 Provider 配额，绝不扣平台积分。
- 平台积分由服务端 Quote -> Job -> Billing -> Provider 闭环处理。

2.4 **Agent 真正可连续运行**
对话历史、摘要、工具结果、token 预算、确认授权和检查点全部持久化到服务端；Worker 在页面关闭后继续执行，重新登录后跨设备恢复投影。

2.5 **PPT 作为可编辑 Deck**
把 `handleSlides()` 旁路替换为 `PptDeckPlan -> Slide Jobs -> Editable Deck`，每页独立失败、重试、编辑；导出保留文字、图片和图层。

2.6 **文档收敛并维持在 15–25 份真 current**
已达成（233 份 Markdown / 18 份 current）。保持产品核心宪章、源码验证能力矩阵和单一 OpenSpec 为唯一入口；禁止新增平行总纲，其余文档维持 `reference`、`proposed` 或 `archive` 归类。

2.7 **透明能力图（Capability Graph）**
以固定节点类型（`Actor | Provider | ProviderConnection | Model | Capability | Asset | Workflow | Step | Trigger | Runtime | Job | Run | ToolCall | Verification | Audit`）和版本化边构建用户可理解、Agent 可查询的能力图；`GET /api/v1/capability-graph/snapshot` 与只读 safe tool `capabilities.listAvailable` 对外暴露；UI 能直接解释每个能力的 Connection、Channel、隐私与成本。

2.8 **Provider Connection 领域模型**
`Provider` 是全局身份（canonical catalog 管理），`ProviderConnection` 是用户拥有的凭据与 endpoint；secret 只存加密 `secret_ref`，API 永不回显；Connection verify 带协议 profile、URL 规范化、DNS/IP/SSRF 检查与最小探测；迁移期 dual-read 旧 profile payload，新写入只走 `provider_connections`。

2.9 **三 Runtime 架构**
Browser/Vercel 只做交互与状态投影；VPS Express 是身份、Connection、能力图、Quote、Job、账务、Worker、Asset 元数据、Audit、feature flag 与恢复的控制面；Local Media/Automation Runtime 只执行已声明能力的本地媒体任务与 Browser Bridge，使用短期配对凭据、opaque asset handle 和受控根目录，不接收任意路径或 Shell。三端以版本化 DTO、幂等 id、签名事件和 capability manifest 通信；任何 runtime 重启后由 VPS Job/Run 状态恢复。

2.10 **本地优先媒体链与真实媒体基线**
Browser 资产进入 OPFS/IndexedDB；派生资产（image thumbnail/metadata、video poster/proxy、audio waveform/metadata）通过 `LocalMediaJobDto` / `LocalAssetRefDto` 记录源资产、参数与 lineage；建立 1K/10K 真实混合媒体的解码并发、输入响应 p95 ≤100ms、三轮导入/删除后内存相对首轮稳定点增长 ≤10%、object URL 回落到活动资产数的验收基线。

2.11 **统一 IA 与 overlay/layout state**
左侧 Connections/Capabilities、中心画布、右侧 AI + Context Inspector 单 dock、底部 Task/Run + Assets 可折叠 tray、全局 command palette；统一 layout state 使 dock/tray 打开时自动重排，minimap 基于真实 viewport 定位，DOM 中只保留一个 AI toggle；新旧 UI 读取相同 DTO 投影，视觉 flag 只回滚界面不回滚业务数据。

---

## 3. 范围

### 3.1 在范围内

- 新增 DTO 与契约：GenerationQuoteDto、GenerationJobDto v3、AgentSessionDto、AgentContextSnapshotDto、AgentRunEventDto、PPT 契约。
- 新增服务端接口：报价、Job 创建/事件流/控制、Agent Session/Run 查询/确认/取消/恢复。
- 新增服务端 Worker 子系统：租约、心跳、提交、轮询、超时、取消、对账。
- 改造现有路由：/v1/generate、/v1/generate/async、图像/视频/音频 Provider Adapter 统一。
- 改造 Agent 运行时：Planner 输入结构化 Session Context、上下文裁剪、工具结果回填、Run 恢复与受控重规划。
- 改造 PPT 链路：PptDeckPlan -> Slide Jobs -> 可编辑 Deck 导出。
- 改造 Browser Bridge：站点能力清单、冻结目标、结构化结果，保留白名单/确认/审计。
- 改造 Feature Flag：编译期常量升级为服务端 Feature Flag，能力开关与视觉开关分离，提供管理员 Kill Switch。
- 文档治理：修复分类器、路径存在性检查、能力声明证据检查；归档历史占位文档。
- 测试与验收：Fake Provider 全通道、Quote/计费/并发/对账、Worker 续跑、跨设备恢复、PPTX OpenXML 回归、Browser Bridge 安全。
- 新增 Capability Graph：`CapabilityNodeDto` / `CapabilityEdgeDto` / `CapabilityGraphSnapshotDto v1`（Zod discriminated union）、migration `018_capability_graph_foundation.sql`（`provider_connections`、`capability_bindings`、Asset lineage relation）、projection service 与 snapshot API、Provider Connection CRUD/verify API、只读 safe tool `capabilities.listAvailable`。
- 首个纵向切片（image provider slice）：Google official image adapter 为生产示例、`FakeProviderAdapter` 为自动化测试；链路为 计划 → Quote → 成本/通道确认 → v3 Job → RouteEngine → Adapter → Asset/Lineage → Worker thumbnail → Canvas node → Task Center → Verification/Audit；server flag `capability_graph.image_provider_slice` 按 internal → invited users → full rollout 放量。
- Local Media Runtime 契约与安全加固：`LocalMediaJobDto`、`LocalAssetRefDto`、OPFS/IndexedDB、opaque handle；安全门禁（移除 fallback token 与 token 日志、token 文件 ACL/轮换、body/尺寸上限、Zod 校验、路径 containment、symlink 拒绝、MIME sniff、解码超时与资源限额）；`local-runner:build` 与独立测试纳入 release 验证，通过前只标记 experimental。
- AI Workspace 控制链：固定 `IntentGate → Planner → CapabilityGraph → ToolRegistry → PermissionPolicy → Quote/Confirmation → Executor → Verification → Audit/Memory`；权限级 `safe | confirm | dangerous | forbidden`；confirmation grant 绑定 `userId/planHash/toolId/targetSnapshot/quoteId/maxCost/expiresAt`。
- 新 IA 与统一 layout state：Connections/Capabilities 侧栏、单一 AI dock、底部 task/assets tray、command palette、minimap 重排。
- 真实媒体 benchmark 与 10K 零回归门禁。
- 每项任务必须写明问题、决策、迁移、兼容、flag、回滚、安全、性能、测试、残余风险与删除条件。

### 3.2 不在范围内

- 不替换 LLM 模型本身（Grok 仅作为内部编码 Worker）。
- 不开放 Browser Bridge 为任意网页 RPA。
- 不迁移运行中的 v2 Job 到 v3（v2 只读兼容，新任务用 v3）。
- 不新建第二套 AI 助手或平行 ToolRegistry。
- 不改动无限画布 V2 已收敛的渲染与性能基线。
- 不引入图数据库（Neo4j 等）、Electron、新 Provider registry、新 AI runtime、任意 Shell/RPA 或另一套任务队列。
- 不在纵向切片中顺手拆分巨型路由/文件（`ToolRegistry.ts`、用户路由、设置页面），不替换 UI 库；这些保留为后续独立 PR。
- 不迁移或复制明文旧 key；无法映射到安全 `secret_ref` 的旧 Connection 要求用户重新验证。
- 不做 destructive rollback；删除重复 pricing catalog、旧队列写路径与兼容 alias 必须在迁移、兼容期、flag 回滚与观测窗口全部通过后。

---

## 4. 核心不变量

1. **云端服务端是 Job、Run、报价和账本权威源**；本地存储只做离线投影与降级。
2. **UI 只消费领域状态投影**，不拥有 Job、Run、账本或路由事实；任何新 UI 复用相同 DTO、ToolRegistry 和服务端状态。
3. **BYOK、云端用户 Key、平台积分、用户网页会员互斥**；BYOK 只消耗用户 Provider 配额，绝不扣平台积分。
4. **固定唯一业务链路**：Agent -> ToolRegistry -> DurableJob -> RouteEngine -> Billing -> Provider -> Asset -> Canvas -> Verification。
5. **Browser Bridge 只执行业务白名单流程**，不建设任意网页 RPA。
6. **PPT 默认目标是真正可编辑 Deck**，不是整页位图。
7. **Grok 首期仅内部开发者和管理员可用**，通过隔离 ACP Gateway 输出 patch/artifact，禁止访问计费、生成、数据库和发布。
8. **v2 Job 保持只读兼容并完成对账；新任务使用 v3，不对运行中的旧任务做破坏性迁移**。
9. **异步任务权威在 server Worker**；浏览器侧队列逐步退化为投影/草稿，不作为执行权威。
10. **Connection secret 只以加密 `secret_ref` 存在**；API 不返回原值，日志与 audit 统一脱敏。
11. **权限等级固定为 `safe | confirm | dangerous | forbidden`**；`dangerous` 默认拒绝，`forbidden` 无运行时 override；confirmation grant 绑定计划、目标快照、报价、成本上限与有效期，目标或价格变化即失效。
12. **flag 关闭只回退 UI 与新读取路径**；不删除新表、不回滚用户资产或账务记录，禁止 destructive rollback。

---

## 5. 兼容性

- v2 生成 Job 数据库行与 API 响应保持只读兼容；v2 只支持已完成的只读查询和退款对账，不接收新创建。
- 新创建任务（无论生图/视频/音频/PPT/网页自动化）统一使用 v3 Job 契约和 Quote 流程。
- 前端旧代码中引用 v2 字段的内部调用可保留一个完整迭代，但新代码必须引用 v3。
- 服务端 Feature Flag 默认关闭新 Worker 流程，按管理员/受邀测试/全量三阶段灰度开启。
- Provider 配置迁移期 dual-read 旧 profile payload 与新 `provider_connections` 表；新写入只走新表；旧 payload 在两个稳定版本后停止读取。
- 既有 Quote/Job v3 API 保持兼容；Capability Graph 只新增只读 API 与 safe tool，不改变现有路由语义。

---

## 6. 成功标准

- 任何通道（BYOK、本地 Key、云端 Key、平台积分、setup-required）的 Fake Provider 测试覆盖提交、轮询、失败、取消。
- Quote 过期、余额不足、并发预扣、重复请求、失败退款、重试只收费一次全部通过；账本与确认卡金额一致。
- 关闭浏览器、Worker 重启、租约失效、跨设备登录后继续执行；已完成 Item 永不重复提交或换通道。
- Agent 多轮指代、上下文裁剪、工具结果回填、确认过期、owner/画布切换、崩溃恢复和最多三次受控重规划全部通过。
- PPTX 解包通过 OpenXML 校验，文字层、图片层、顺序和关系文件完整；PowerPoint/LibreOffice 可编辑。
- Browser Bridge 通过 SSRF、动态目标、敏感字段脱敏、二次确认、断连 setup_required 验收；无模拟成功。
- 每阶段跑 `architecture:check`、`governance:check`、`typecheck`、`build`、完整测试和 `verify:changes`。
- 文档治理维持 15–25 份 current，其余正确归类为 reference / proposed / archive；能力矩阵证据坐标全部可解析。
- Capability Graph 契约：DTO discriminated union、未知版本拒绝、secret 永不序列化、edge ownership/status/constraints 完整；snapshot API 与 `capabilities.listAvailable` 只读可用。
- 纵向切片 E2E：连接 Google（自动化测试用 Fake）→ AI 规划 → 确认 → 生成 → thumbnail → canvas → Task Center → 刷新恢复 → audit 全通过；刷新后从 VPS Job/Run 恢复，而非本地 store 重建。
- Migration：空库、已有用户、重复执行、dual-read、回滚 flag、跨用户隔离全部通过。
- Security：SSRF/私网/重定向、IDOR、quote replay、callback spoof、路径穿越、symlink、超大/伪 MIME 媒体、过期 confirmation 全部通过。
- UX：单一 AI toggle、键盘/焦点顺序正确、dock/tray/minimap 不重叠、失败状态提供可执行恢复动作。
- 真实媒体：1K 混合代理输入响应 p95 ≤100ms；只 hydrate viewport+overscan；三轮导入/删除后内存相对首轮稳定点增长 ≤10%；object URL 回落到活动资产数。
- 10K：现有 smoke 零回归、DOM 峰值不高于当前 1,305、连接线误差小于 1px。
