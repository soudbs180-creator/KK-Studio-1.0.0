<!-- AI_ROUTING_KEY: state, validation, verification, milestone, handoff -->
# Project State and Validation — KK Studio v1.6.0

Last updated: 2026-07-22

## 0. 当前验证基线

```text
Project version: KK Studio v1.6.0
Version source of truth: config/release-manifest.json
Node / package manager: root package.json engines.node and packageManager
AI rules entry: AGENTS.md
Backend current fact: server/ Express / VPS
Web current fact: apps/web/
Shared contracts: packages/shared/
API client: packages/api-client/
UI package: packages/ui/
Database migrations: migrations/
Active OpenSpec: openspec/changes/upgrade-ai-creation-core/ (single active change)
Docs governance: 233 Markdown / 18 current (docs/governance/DOCUMENTATION_INDEX.md)
```

本文件只记录当前状态、验证入口和清理边界。历史事实、旧计划、旧版本和旧部署路径应归档到 `docs/archive/`，不得重新影响当前主链路。

## 1. 当前主链路

| 领域 | 当前入口 | 说明 |
|---|---|---|
| Web | `apps/web/` | 当前 Web 主运行时，不回退到根 `src/`。 |
| Backend | `server/` | 当前 Express / VPS 后端入口。 |
| Shared | `packages/shared/` | DTO、枚举、领域契约和共享类型。 |
| API Client | `packages/api-client/` | 前端和跨端 HTTP 出口。 |
| UI | `packages/ui/` | 设计 token、基础组件和 UI bridge。 |
| Migrations | `migrations/` | 数据库结构变更唯一合法目录。 |
| AI Takeover | `apps/web/src/features/ai-takeover/` | AI 接管体验入口。 |
| AI Runtime | `apps/web/src/features/ai-assistant-runtime/` | ToolRegistry、CanvasRuntimeState、执行与知识同步。 |
| Generation v3 | `server/lib/generation-v3/`、`server/routes/generation-v3.js` | Quote、Job、Billing、RouteEngine 与 Provider Adapter 当前控制面。 |
| Active OpenSpec | `openspec/changes/upgrade-ai-creation-core/` | 唯一活动升级计划；Capability Graph、Worker、Run 恢复、本地媒体与 IA 均在此跟踪。 |
| Local Runner | `local-runner/` | 当前仅为 Browser/OpenCLI experimental runtime；在独立安全/build gate 通过前不是生产媒体运行时。 |

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
4. 当前 Web 入口固定为 `apps/web/`，当前后端入口固定为 `server/`。
5. 旧目录不存在或只能在 archive 文档中出现；不得在 active runtime 中恢复。
6. Provider、Provider Connection、Model 与 Capability 必须是不同领域对象；UI、Agent 与 RouteEngine 只消费 canonical catalog 和服务端 Connection 投影。
7. Browser 只持有交互和离线投影；VPS 是 Job/Run/Quote/Billing 权威源；Local Runner 只执行声明式、受权限约束的本地能力。
8. 现有 `direct | assist | takeover`、ToolRegistry、CanvasRuntimeState 与 AgentRunStore 是共享事实，不为新 IA 建立副本。
9. `upgrade-ai-creation-core` 是唯一活动 change；禁止创建平行 Capability Graph、Provider registry、AI runtime 或 queue 计划。
10. 每个 PR 的验收门禁见 `openspec/changes/upgrade-ai-creation-core/tasks.md` 文末"PR 验收模板"。

## 5. 2026-07-22 - Phase 1 收口与 Phase 2 准备

### Current facts

- Phase 0 的 PostgreSQL 016 演练与文档治理已完成；当前治理索引为 233 份 Markdown、18 份 current、0 conflict。
- Phase 1 的 Quote、Job v3、Item ledger、Provider Adapter 和同步/异步桥接已经完成；server durable Worker 尚未实现。
- Capability Graph、规范化 Provider Connection、Local Media Runtime、真实媒体 benchmark 与新版 IA 仍是计划目标，不得描述为当前能力。
- 当前 GitHub HEAD 的外部失败状态来自 Vercel 团队归属；仓库代码和 GitHub Actions 日志无法修复该外部配置。

### Next execution gate

1. 先完成活动 OpenSpec 与源码矩阵重新基线。
2. 再以 additive migration 和 server flag 交付 Google/Fake image Provider 纵向切片。
3. Capability Graph slice 通过后进入 server durable image Worker；Local Runner 安全加固与媒体 runtime 不与首个切片混合。
4. 新 IA 最后以 visual flag 灰度，关闭 flag 只回退界面，不回滚业务数据。

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
