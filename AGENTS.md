# AGENTS.md - AI Agent 项目总指导文件 — KK Studio v1.5.7

Last updated: 2026-06-09
Project version: 1.5.7
Version source of truth: `config/release-manifest.json`

本文件只保留当前事实和修改边界。历史计划、迁移记录和旧架构描述只能用于追溯，不能覆盖当前源码、`package.json`、`config/release-manifest.json`、构建脚本和治理脚本。

## 1. 当前项目事实

| 领域 | 当前事实 |
|---|---|
| 产品名 | KK Studio |
| 当前发布线 | KK Studio v1.5.7 |
| 主版本源 | `config/release-manifest.json` |
| Web 运行时 | `apps/web/` |
| 后端运行时 | `server/` Express / VPS |
| 共享契约 | `packages/shared/` |
| HTTP Client | `packages/api-client/` |
| UI / Token | `packages/ui/` |
| 数据库迁移 | `migrations/` |
| AI 接管入口 | `apps/web/src/features/ai-takeover/` 与 `apps/web/src/features/ai-assistant-runtime/` |
| AI 能力文档 | `AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md`、`docs/ai-assistant/` |

## 2. 事实优先级

```text
当前源码和类型定义
  > config/release-manifest.json / package.json / 构建脚本
  > 自动化测试与治理脚本
  > AGENTS.md
  > docs/governance/PROJECT_STATE_AND_VALIDATION.md
  > 当前 docs/ 文档
  > docs/archive/、旧计划、旧审计、旧提示词
```

遇到冲突时，使用更高优先级事实继续执行，并把文档漂移记录到 `docs/development/session-handoff.md` 或相关治理文件。不要把历史目录、历史版本或旧部署方式重新接入主运行链路。

## 3. 修改边界

| 需求 | 应修改位置 | 禁止事项 |
|---|---|---|
| Web 页面、桌面交互、无限画布 | `apps/web/` | 禁止回到根 `src/` |
| 移动端原生交互 | `apps/mobile/` | 禁止直接依赖 DOM / BOM |
| 类型、DTO、枚举、领域契约 | `packages/shared/` | 禁止引入 React、DOM、Node 专属实现 |
| 鉴权、Session、跨端 API | `packages/api-client/` | 禁止硬编码平台存储 |
| 设计 Token、基础组件、UI Bridge | `packages/ui/` | 禁止放业务状态和模型调用逻辑 |
| API 代理、计费、数据库、Stripe | `server/` | 禁止前端直连密钥、数据库或支付状态 |
| 数据库结构变化 | `migrations/` | 禁止在业务代码里执行 DDL |
| AI 助手与自动化能力 | `apps/web/src/features/ai-takeover/`、`apps/web/src/features/ai-assistant-runtime/` | 禁止另起平行助手 |

跨层修改顺序：`packages/shared` -> `packages/api-client` -> `server` -> `apps/web` -> `tests` -> `docs`。

## 4. AI / Agent 执行协议

Agent 接到任意代码任务时，先读取：

1. `AGENTS.md`
2. `package.json`
3. `config/release-manifest.json`
4. 与任务直接相关的源码、测试和规格
5. `docs/governance/PROJECT_STATE_AND_VALIDATION.md`

AI 助手和画布 Agent 必须通过 `IntentGate -> Planner -> ToolRegistry -> PermissionPolicy -> Executor -> Verification -> Memory / Knowledge Update` 执行。LLM 只负责理解意图、生成计划、输出结构化工具调用和总结结果。

涉及画布、批量生成、资源整理、ZIP、自动排版、下载原图等能力时，优先调用项目内能力，不模拟 UI 点击或手动输入。关键名词必须保持一致：`ToolRegistry`、`CanvasRuntimeState`、`DurableGenerationQueue`、`assets.zipOriginals`、`generation.createBatchJob`。

## 5. 安全边界

禁止在前端或文档中写入真实密钥、生产数据库凭据、付款状态、积分余额、Webhook Secret、用户隐私文件或本机路径。涉及支付、JWT、CORS、Provider 直连、数据库迁移、生产部署时，必须小步变更并留下验证记录。

## 6. 清理与轻量化规则

当前主链路不得依赖以下历史入口：

- 根 `src/`
- `apps/admin/`
- `apps/api/`
- `apps/payment-sidecar/`
- 根 `billing/`
- `payment-server/`
- `netlify/functions/`

历史内容只能放在 `docs/archive/` 或明确标记为 archive 的文件中。新功能不得引用旧入口；需要兼容旧数据时，必须通过 adapter/service 隔离，并注明删除条件。

## 7. 验证要求

常规变更至少运行相关检查；项目级清理必须运行：

```bash
npm run architecture:check
npm run governance:check
npm run typecheck
npm run build
```

完整发布前运行：

```bash
npm run verify:changes
```

如果无法运行验证，交接中必须写明未运行命令和原因。

## 8. 交接格式

每次修改结束时记录：

- 修改范围
- 修改文件
- 当前设计决策
- 已运行验证
- 未运行验证及原因
- 风险与下一步

优先记录到 `docs/development/session-handoff.md`，复杂能力变更再补充 `openspec/changes/<change-id>/tasks.md`。
