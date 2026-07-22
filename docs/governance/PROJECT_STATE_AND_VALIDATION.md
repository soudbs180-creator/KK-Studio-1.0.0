<!-- AI_ROUTING_KEY: state, validation, verification, milestone, handoff -->
# Project State and Validation — KK Studio v1.6.0

Last updated: 2026-07-22

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
7. 目标架构要求 Browser 只持有交互和离线投影，VPS 成为 Job/Run/Quote/Billing 权威源；当前 Job/Quote/Billing 已进入服务端控制面，Agent Run 已有单向快照 upsert 与 owner-scoped list/get，但 Web 尚未消费读取面，事件恢复仍以浏览器 localStorage 为主。Local Runner 只执行声明式、受权限约束的本地能力。
8. 现有 `direct | assist | takeover`、ToolRegistry、CanvasRuntimeState 与 AgentRunStore 是共享事实，不为新 IA 建立副本。
9. `upgrade-ai-creation-core` 是唯一活动 change；禁止创建平行 Capability Graph、Provider registry、AI runtime 或 queue 计划。
10. 每个 PR 的验收门禁见 `openspec/changes/upgrade-ai-creation-core/tasks.md` 文末"PR 验收模板"。

## 5. 2026-07-22 - Phase 2 image Worker 基础完成，本地控制面与外部门禁待闭环

### Current facts

- Phase 0 的 PostgreSQL 016 演练与文档治理已完成；当前治理索引为 227 份 Markdown、19 份 current、0 conflict。
- Phase 1 的 Quote、Job v3、Item ledger、Provider Adapter 和同步/异步桥接已经完成。
- Capability Graph DTO、migration 018、snapshot projection/API、规范化 Provider Connection CRUD/verify、只读 Agent tool、asset lineage 与 image slice flag 已实现并有专项测试。image slice 现同时保护管理面和实际数据面：Connection-backed Quote、同步 submit 与 durable enqueue 均在 resolver/credential/Provider/lease 副作用前按 server scope fail closed；无 `connectionId` 的 legacy 路径不变，已入队 Worker 在 flag 关闭后继续使用冻结路由 drain。
- 新 Provider Connection 与旧 `ApiSettings`/profile 凭据栈仍是平行读写。旧凭据 repository 已收口为认证 owner 的单用户读写：hosted GET、secret reveal、连通性、定价与兼容代理从 `user_provider_credentials` 读取当前 owner，数据库替换写入不再重放缓存中的其他 owner。Google 与 OpenAI-compatible image adapter 均以单次调用参数传递 Connection credential；OpenAI-compatible 并发请求不再通过 `process.env` 共享或覆盖 owner secret，无 Connection 时仍保留环境变量 fallback。Web Provider Connections 面板已由 `CapabilitySourcesView` 实际挂载，可从内存中的旧 Google 设置读取非敏感名称/endpoint，投影并去重安全迁移候选；用户必须显式重输 secret，再调用现有 create/verify API。桌面 Chromium smoke 已覆盖候选、重输、create/verify、刷新去重和表单清理；旧 secret 不读取、不复制、不传输。服务端权威 dual-read、真实 Google/受控 PostgreSQL 验收、全 Provider 切流与观测窗口仍未完成，不能把兼容迁移描述为已完成。
- 服务端用户路由职责已收敛，共享请求上下文与热点文件可维护性递减门禁已建立；`profile.js` baseline 已由 1876 行降至 1793 行，公开 HTTP 契约不变。
- `ChatSidebar` 的模型目录、assistant capability 默认选择、Key 优先级与订阅同步已迁入严格 model controller；会话持久化、活动消息同步、树投影、分支与导入算法已迁入严格 session controller/data 模块。热点 baseline 已从 4677 行/23 个显式 `any` 连续降至 4040 行/21 个，公开交互、storage key 和导入导出格式不变。
- image Durable Worker 的 migration 019、租约领取、token/heartbeat、冻结路由提交、指数退避轮询、取消、超时、恢复和 Item 幂等代码已实现，并通过无浏览器参与、Worker 重建与过期租约的 characterization 测试；lease 丢失不再伪报终态或重试，迟到回调不能复活或降级终态 Item。
- `GENERATION_IMAGE_DURABLE_WORKER_ENABLED` 已支持 `off → internal → invited → full` 服务端用户范围且默认 `off`，只控制新任务 admission；默认关闭的 `GENERATION_IMAGE_WORKER_EXECUTION_ENABLED` 独立控制 migration-ready loop/cancel。characterization 已覆盖 admission `off` + execution `true` 时继续 drain，并以 `scope: off, running: true` 聚合指标显式观测；回滚不得在 lease 清空前关闭 execution。owner-scoped Job SSE、`GET /api/v1/generation/jobs` pending discovery、严格 typed client 与 Web hydration 已落地；Web 只自动观察 `submitted/running`，仅绑定已同步且 owner 匹配的 Prompt 节点，不创建新节点或覆盖本地任务元数据。migration 019、真实浏览器关闭/重新登录/跨设备 E2E、实际放量和生产观测均未完成，不得描述为已上线能力。
- Agent Run 已有 owner-scoped local projection、服务端 upsert 重试、陈旧快照协调，以及 owner-scoped Run list/get API；读取层一次批量装配工具调用并通过 typed client 暴露。Session/event API、Web hydration 和事件恢复尚未实现，reload 仍把 active Run 置 failed，VPS 尚不是 Run 恢复权威源。
- Local Media Runtime、真实媒体 benchmark 与新版 IA 仍是计划目标。
- 当前 GitHub HEAD 的外部失败状态来自 Vercel 团队归属；仓库代码和 GitHub Actions 日志无法修复该外部配置。

### Next execution gate

1. 在受控 PostgreSQL 与真实浏览器中验证 owner-scoped pending Job discovery、SSE 和 Web hydration：关闭页面后续跑、重新登录、第二设备发现已同步 Prompt 节点并恢复投影；无法安全关联时必须保持本地 fallback 且不得创建重复节点。
2. 在受控 PostgreSQL 运行 `npm run rehearse:migration:019`；先开启 Worker execution，再完成 image-slice 与 Worker admission 的真实 internal → invited → full → off 放量，观察准入、Worker、计费、重复 submit 与回退指标；回滚时保持 execution 直到 lease drain。
3. 上述 gate 通过后再扩展视频/音频 Worker；Phase 3 Agent Session/Run 权威源作为独立纵向切片推进，不与 pending Job discovery 混入同一提交。

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
