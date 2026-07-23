<!-- AI_ROUTING_KEY: state, validation, verification, milestone, handoff -->
# Project State and Validation — KK Studio v1.6.0

Last updated: 2026-07-23

## 0. 当前验证基线

```text
Project version: KK Studio v1.6.0
Version source of truth: config/release-manifest.json
Node / package manager: root package.json engines.node and packageManager
AI rules entry: AGENTS.md
Backend current fact: services/api/ Express / VPS
Web current fact: apps/web/
Shared contracts: packages/shared/
API client: packages/api-client/
UI package: packages/ui/
Database migrations: infrastructure/database/migrations/
Active OpenSpec: openspec/changes/upgrade-ai-creation-core/ (single active change)
Docs governance: 227 Markdown / 19 current (docs/governance/DOCUMENTATION_INDEX.md)
```

本文件只记录当前状态、验证入口和清理边界。历史事实、旧计划、旧版本和旧部署路径应归档到 `docs/archive/`，不得重新影响当前主链路。

## 1. 当前主链路

| 领域 | 当前入口 | 说明 |
|---|---|---|
| Web | `apps/web/` | 当前 Web 主运行时，不回退到根 `src/`。 |
| Backend | `services/api/` | 当前 Express / VPS 后端入口。 |
| Shared | `packages/shared/` | DTO、枚举、领域契约和共享类型。 |
| API Client | `packages/api-client/` | 前端和跨端 HTTP 出口。 |
| UI | `packages/ui/` | 设计 token、基础组件和 UI bridge。 |
| Migrations | `infrastructure/database/migrations/` | 数据库结构变更唯一合法目录。 |
| AI Takeover | `apps/web/src/features/ai-takeover/` | AI 接管体验入口。 |
| AI Runtime | `apps/web/src/features/ai-assistant-runtime/` | ToolRegistry、CanvasRuntimeState、执行与知识同步。 |
| Generation v3 | `services/api/lib/generation-v3/`、`services/api/routes/generation-v3.js` | Quote、Job、Billing、RouteEngine 与 Provider Adapter 当前控制面。 |
| Capability Graph / Image Worker | `packages/shared/src/capability-graph/`、`packages/shared/src/generation-worker/`、`services/api/lib/capability-graph/`、`services/api/lib/generation-v3/worker/` | Capability Graph、Provider Connection、Google 安全迁移桥、image-slice 数据面准入、server image Worker 与 owner-scoped pending Job discovery/hydration 的代码基础已落地；Worker 新任务 admission 与存量 drain/cancel 已解耦，服务端 dual-read、真实 migration rehearsal、灰度和恢复 E2E 仍待完成。 |
| Active OpenSpec | `openspec/changes/upgrade-ai-creation-core/` | 唯一活动升级计划；Capability Graph、Worker、Run 恢复、本地媒体与 IA 均在此跟踪。 |
| Local Runner | `local-runner/` | 当前仅为 Browser/OpenCLI experimental runtime；typecheck/build 当前通过，但安全 gate 未通过，仍不是生产媒体运行时。 |

## 2. 已收敛的旧影响源

以下入口只允许作为历史资料存在，不能进入新功能主链路：

- 根 `src/`
- `apps/admin/`
- `apps/api/`
- `apps/payment-sidecar/`
- 根 `billing/`
- `payment-server/`
- 旧版本说明、旧部署说明和旧迁移计划

如果必须读取历史实现，只能通过明确的 adapter/service 隔离，并写明替代方案和删除条件。

## 3. 当前验证命令

完整验证：

```bash
npm run verify:changes
```

> 注意：`verify:changes` 脚本内含 Node 24 专属标志（engines.node 为 24.x）；在 Node 22 运行时下需手工执行其等价子集，Phase 1 验收即按此完成（记录见 `openspec/changes/upgrade-ai-creation-core/tasks.md`）。

大画布 10K 节点 smoke：

```bash
npm run verify:large-canvas-10k
```

项目清理与事实一致性：

```bash
npm run governance:current
npm run governance:check
npm run architecture:check
```

代码、类型和构建：

```bash
npm run typecheck
npm run test
npm run build
npm run verify:canvas-performance
npm run local-runner:build
```

## 4. 当前治理决策

1. `config/release-manifest.json` 是唯一版本事实源。
2. `package.json` 的 `governance:check` 必须包含 `governance:current`。
3. `AGENTS.md` 和本文件不得保留过期的当前版本断言。
4. 当前 Web 入口固定为 `apps/web/`，当前后端入口固定为 `services/api/`。
5. 旧目录不存在或只能在 archive 文档中出现；不得在 active runtime 中恢复。
6. Provider、Provider Connection、Model 与 Capability 必须是不同领域对象；UI、Agent 与 RouteEngine 只消费 canonical catalog 和服务端 Connection 投影。
7. 目标架构要求 Browser 只持有交互和离线投影，VPS 成为 Job/Run/Session/Quote/Billing 权威源；当前 Job/Quote/Billing 已进入服务端控制面，Agent Run 已有快照 upsert、owner-scoped list/get、metadata-only event log/query、Web 首次投影 hydration 与 owner-qualified cursor invalidation，Session/Context Snapshot 权威数据面也已建立。Run upsert 已支持 owner 强约束且不可改绑的可选 Session binding；Web 只对具备显式创建时间和结构化摘要的非临时 Chat 尝试 owner-stable Session write，并在 exact authoritative detail 成功 hydrate 后为新建本地 Run 传入 `sessionId`，失败或 3 秒超时保持未绑定兼容路径。`AgentRuntime` 仅从仍存在的 exact owner-scoped detail 生成二次预算裁剪、无执行授权的 Planner context；LLM/Local Planner 已消费摘要、近期消息、工具结果、知识引用与通过 owner/Session/surface/canvas/时间门禁的 metadata-only Context Snapshot。Snapshot GET 受 1.5 秒上限约束，当前 capture 异步 append，网络失败不阻断已有 Session 或 Run。多轮选区指代现会与当前画布节点求交，并在模糊、多候选、通用 continuation、历史 Job ID 或目标偷换时 fail closed。Agent 还会经 ToolRegistry 读取 owner-bound capability snapshot，只把 bounded active route 作为 discovery-only Planner 证据，并按媒体 capability 移除无依据的 generation model hint；最终路由继续由服务端 RouteEngine 决定。semantic replay、真实 LLM 多轮验证和执行接管仍未完成。本地 localStorage 继续承担 Chat 离线投影，Local Runner 只执行声明式、受权限约束的本地能力。
8. 现有 `direct | assist | takeover`、ToolRegistry、CanvasRuntimeState 与 AgentRunStore 是共享事实，不为新 IA 建立副本。
9. `upgrade-ai-creation-core` 是唯一活动 change；禁止创建平行 Capability Graph、Provider registry、AI runtime 或 queue 计划。
10. 每个 PR 的验收门禁见 `openspec/changes/upgrade-ai-creation-core/tasks.md` 文末"PR 验收模板"。

## 5. 2026-07-22 - Phase 2 image Worker 基础完成，本地控制面与外部门禁待闭环

### Current facts

- Phase 0 的 PostgreSQL 016 演练与文档治理已完成；当前治理索引为 227 份 Markdown、19 份 current、0 conflict。
- Phase 1 的 Quote、Job v3、Item ledger、Provider Adapter 和同步/异步桥接已经完成。
- Capability Graph DTO、migration 018、snapshot projection/API、规范化 Provider Connection CRUD/verify、只读 Agent tool、asset lineage 与 image slice flag 已实现并有专项测试。image slice 现同时保护管理面和实际数据面：Connection-backed Quote、同步 submit 与 durable enqueue 均在 resolver/credential/Provider/lease 副作用前按 server scope fail closed；无 `connectionId` 的 legacy 路径不变，已入队 Worker 在 flag 关闭后继续使用冻结路由 drain。
- Agent Planner 已经通过 ToolRegistry 的 `capabilities.listAvailable` 消费服务端 snapshot：请求绑定 captured owner 与 1.5 秒 AbortSignal，只投影最多 100 条 active Connection -> Model -> Capability route，displayName、secret 与任意 constraints payload 不进入上下文。图片/视频/音频 action 的显式 model hint 必须匹配同媒体 capability；无图证据时移除 hint 并保留服务端 RouteEngine 的最终选择权，该摘要不授予执行权限。
- 新 Provider Connection 与旧 `ApiSettings`/profile 凭据栈仍是平行读写。旧凭据 repository 已收口为认证 owner 的单用户读写：hosted GET、secret reveal、连通性、定价与兼容代理从 `user_provider_credentials` 读取当前 owner，数据库替换写入不再重放缓存中的其他 owner。Google 与 OpenAI-compatible image adapter 均以单次调用参数传递 Connection credential；OpenAI-compatible 并发请求不再通过 `process.env` 共享或覆盖 owner secret，无 Connection 时仍保留环境变量 fallback。Web Provider Connections 面板已由 `CapabilitySourcesView` 实际挂载，可从内存中的旧 Google 设置读取非敏感名称/endpoint，投影并去重安全迁移候选；用户必须显式重输 secret，再调用现有 create/verify API。桌面 Chromium smoke 已覆盖候选、重输、create/verify、刷新去重和表单清理；旧 secret 不读取、不复制、不传输。服务端权威 dual-read、真实 Google/受控 PostgreSQL 验收、全 Provider 切流与观测窗口仍未完成，不能把兼容迁移描述为已完成。
- 服务端用户路由职责已收敛，共享请求上下文与热点文件可维护性递减门禁已建立；`profile.js` baseline 已由 1876 行降至 1793 行，公开 HTTP 契约不变。
- `ChatSidebar` 的模型目录、assistant capability 默认选择、Key 优先级与订阅同步已迁入严格 model controller；会话持久化、活动消息同步、树投影、分支与导入算法已迁入严格 session controller/data 模块。结构化压缩与 TokenBudget 又迁入独立 strict modules，热点 baseline 已从 4677 行/23 个显式 `any` 连续降至 4032 行/20 个，公开交互、storage key 和导入导出 envelope 不变。
- image Durable Worker 的 migration 019、租约领取、token/heartbeat、冻结路由提交、指数退避轮询、取消、超时、恢复和 Item 幂等代码已实现，并通过无浏览器参与、Worker 重建与过期租约的 characterization 测试；lease 丢失不再伪报终态或重试，迟到回调不能复活或降级终态 Item。
- `GENERATION_IMAGE_DURABLE_WORKER_ENABLED` 已支持 `off → internal → invited → full` 服务端用户范围且默认 `off`，只控制新任务 admission；默认关闭的 `GENERATION_IMAGE_WORKER_EXECUTION_ENABLED` 独立控制 migration-ready loop/cancel。characterization 已覆盖 admission `off` + execution `true` 时继续 drain，并以 `scope: off, running: true` 聚合指标显式观测；回滚不得在 lease 清空前关闭 execution。owner-scoped Job SSE、`GET /api/v1/generation/jobs` pending discovery、严格 typed client 与 Web hydration 已落地；Web 只自动观察 `submitted/running`，仅绑定已同步且 owner 匹配的 Prompt 节点，不创建新节点或覆盖本地任务元数据。migration 019、真实浏览器关闭/重新登录/跨设备 E2E、实际放量和生产观测均未完成，不得描述为已上线能力。
- Agent Run 已有 owner-scoped local projection、服务端 upsert 重试、陈旧快照协调、owner-scoped Run list/get API 与 Web projection hydration；migration 020 在 accepted Run 写入的同一 PostgreSQL 事务中追加 metadata-only `run_snapshot` 事件，并提供 owner-scoped sequence 查询与 typed client。Web 在首次 hydration 后只为最近 20 个 active + synced Run 以最多 4 并发读取 event cursor，严格校验 owner、Run ID、单调 sequence 与权威详情时间，并仅在共享 schema 校验和投影合并成功后推进 owner-qualified cursor；网络失败、owner 切换、陈旧详情和本地较新 pending snapshot 均 fail closed。migration 021 另行提供严格、bounded 的 Agent Session list/get/upsert 与幂等 Context Snapshot append/latest；Snapshot owner 继承父 Session，附件只存 Asset 引用，Context 不存输入原文或任意 payload。migration 022 为 Run 增加可选 `sessionId`，数据库以 `(session_id, user_id)` 复合外键强制同 owner，API 只允许首次绑定并拒绝改绑/解除；旧客户端省略字段时响应 envelope 与写入行为不变，binding-only 更新会推进 metadata event sequence。Web 现在会在 startup、认证恢复与 online 时刷新 Session list，并可按需读取 detail；shared schema、owner、Session ID 任一不匹配均不更新投影，owner 切换立即清空。Chat-to-Agent Session 映射门禁只在显式提供 canonical Asset、结构化摘要、TokenBudget、owner 与创建时间证据时产生 strict DTO，不从 attachment data/URL/local id、普通摘要消息或 UI token estimate 推断事实，并保留服务端已有的非 Chat 状态。canonical Asset 协调器复用现有 owner-scoped Asset Library API，以内容哈希幂等解析 data URL，并在 URL/MIME/大小/document approval/响应 schema/owner 任一不满足时拒绝。Chat 压缩把 canonical summary 独立写入本地 Session `agentSummary`；统一上下文预算器按固定比例、UTF-8 byte upper bound 和每条 4 单位开销产生非计费 `TokenBudget`。owner-stable Session write coordinator 已把权威 detail 或 404 新建判断、expected-subject Asset 解析、预算、strict mapper、typed upsert 与服务端响应 hydration 组合为单一 fail-closed 边界；stale 回包只作为服务端权威投影，既有 tool/knowledge/confirmation/checkpoint 不被 Chat 清空。ChatSidebar 已增量激活该边界：新建/临时/分支/复制 Session 均记录显式 creation identity，旧存量会话不从 `session_<timestamp>` 或 `updatedAt` 推断；协作模式发送时复用 exact createdAt 且不旧于本地投影的权威 detail，本地较新则先写入并 hydrate，只有成功结果才传给 `AgentRuntime.run`，任何失败或 3 秒超时继续创建未绑定 Run。`AgentRuntime` 再次从 exact owner-scoped detail 构造最多 64,000 UTF-8 单位的 authority-free context，排除附件、owner、confirmation、checkpoint、content hash、历史 system/tool message 和已被 summary 覆盖的消息；失败时不保留 context 或 binding。Web Snapshot producer 只从 `SanitizedProjectContext` 投影计数、ID、viewport、受限事件类型、输入存在性和 registry tool 名，不写 prompt、画布/图片名称、事件摘要或附件内容。规划前以 captured owner 和 1.5 秒上限读取 latest，只有 exact Session、surface/canvas、晚于 rolling summary 且不超过 5 分钟未来偏差的 Snapshot 才进入独立画布预算；当前安全 capture 异步 append，任何 Snapshot transport failure 都保留 Session context 与 Run 创建。多轮选区指代策略只接受当前画布仍存在的唯一目标，并在普通“继续”、模糊/多候选引用、历史 Job ID 或 Planner 目标替换时清空 actions/steps/confirmation；明确恢复仍要求当前消息提供 paused Job `jobId`。LLM 把历史数据置于最新指令之前并由 system policy 降权，LocalBrain 只显示恢复计数。Capability discovery 与 Snapshot hydration 并发执行；前者只把 active、bounded、secret-free route 加入 Planner，并在安全评估前移除跨媒体或无图证据的 generation model hint。`ChatSidebar` baseline 保持 4018 行/20 个显式 `any`；strict ratchet 现覆盖 49 个模块，维持零显式 `any`、零 `console.log`、函数不超过 50 行。认证 reload 不再把 active Run 误置 `failed`，pending 上传严格晚于首次 hydration。远端独有 Run 只用于时间线展示，不获得本地计划执行权。语义事件 replay、真实 LLM 多轮验证、跨设备执行接管和真实浏览器 binding/Snapshot E2E 仍未实现。migration 022 也尚未在受控 PostgreSQL 演练，VPS 尚不是完整 Run/Session 恢复权威源。
- Local Media Runtime、真实媒体 benchmark 与新版 IA 仍是计划目标。
- 当前 GitHub HEAD 的外部失败状态来自 Vercel 团队归属；仓库代码和 GitHub Actions 日志无法修复该外部配置。

### Next execution gate

1. 在受控 PostgreSQL 与真实浏览器中验证 owner-scoped pending Job discovery、SSE 和 Web hydration：关闭页面后续跑、重新登录、第二设备发现已同步 Prompt 节点并恢复投影；无法安全关联时必须保持本地 fallback 且不得创建重复节点。
2. 在受控 PostgreSQL 运行 `npm run rehearse:migration:019`；先开启 Worker execution，再完成 image-slice 与 Worker admission 的真实 internal → invited → full → off 放量，观察准入、Worker、计费、重复 submit 与回退指标；回滚时保持 execution 直到 lease drain。
3. 上述 gate 通过后再扩展视频/音频 Worker；Phase 3 下一纵向切片应单独设计 discriminated semantic event replay，并保留已完成的多轮选区指代 authority 门禁；不得把本地 binding 或历史 Snapshot 扩张为远端执行授权或 ChatSidebar 全量切流。

### Required PR evidence

每个 PR 必须记录 scope、OpenSpec task、migration、兼容、flag、回滚、安全、性能、测试、剩余风险和删除条件。阶段收口运行 `verify:changes` 与 `verify:large-canvas-10k`；Local Runner 进入发布前必须独立 build/typecheck 与安全测试全绿。

## 6. 2026-06-09 - 当前事实清洗与轻量化基线

### Scope

- 将 Agent 入口文档重写为当前事实和修改边界，移除旧版本主动口径。
- 将项目状态文档收敛为当前事实基线。
- 增加 `governance:current`，阻止旧版本、旧入口和旧后端描述重新成为当前事实。

### Files touched

- `AGENTS.md`
- `docs/governance/PROJECT_STATE_AND_VALIDATION.md`
- `scripts/governance/check-current-facts.mjs`
- `scripts/governance/check-agent-docs.mjs`
- `package.json`

### Validation

- Not run in this connector session: repository-local `npm` checks.
- Expected local commands: `npm run governance:check`, `npm run architecture:check`, `npm run typecheck`, `npm run build`.

### Risks / Next

- 旧归档文档仍可能包含历史版本，这是允许的；后续只需继续清理 active docs 中的旧口径。
- 若后续代码变更重新创建旧目录，`governance:current` 应阻断合并。
