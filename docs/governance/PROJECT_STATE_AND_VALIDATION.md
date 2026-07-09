<!-- AI_ROUTING_KEY: state, validation, verification, milestone, handoff -->
# Project State and Validation — KK Studio v1.5.9

Last updated: 2026-06-09

## 0. 当前验证基线

```text
Project version: KK Studio v1.5.9
Version source of truth: config/release-manifest.json
Node / package manager: root package.json engines.node and packageManager
AI rules entry: AGENTS.md
Backend current fact: server/ Express / VPS
Web current fact: apps/web/
Shared contracts: packages/shared/
API client: packages/api-client/
UI package: packages/ui/
Database migrations: migrations/
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
```

## 4. 当前治理决策

1. `config/release-manifest.json` 是唯一版本事实源。
2. `package.json` 的 `governance:check` 必须包含 `governance:current`。
3. `AGENTS.md` 和本文件不得保留过期的当前版本断言。
4. 当前 Web 入口固定为 `apps/web/`，当前后端入口固定为 `server/`。
5. 旧目录不存在或只能在 archive 文档中出现；不得在 active runtime 中恢复。

## 5. 2026-06-09 - 当前事实清洗与轻量化基线

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
