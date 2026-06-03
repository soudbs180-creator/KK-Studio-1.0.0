# 会话记忆规约 (Session Memory)

AI 助手通过会话上下文及运行态保持连续的任务处理能力。中断恢复与会话克隆需严格遵循此记忆流转标准。

## 1. 记忆层级

1. **短期记忆 (Short-term Memory)**:
   - 包含当前会话消息队列 (`messages`，最大 30 条)。
   - 当前画布实时运行态 `CanvasRuntimeState`。
2. **长期记忆 (Long-term Memory)**:
   - 已执行成功的 `agent_runs` 历史日志及对应工具调用记录 `agent_tool_calls`。
   - 固化的自定义 Skill 习惯偏好 (Upserted Skills)。

## 2. 中断恢复与克隆协议

- **会话分支克隆**: 用户选择“复制分支”时，复制完整的消息记录、连结的资产 ID、和当前的生成参数配置。
- **持久化任务恢复**: 生图队列在底层以 localStorage/IndexedDB 缓存持久化。当页面刷新或断线重连时，`useTaskRecovery` 自动从缓存中提取 pending 任务进行状态恢复，并通知 AI 接管引擎更新相应卡片。
- **会话退出脱敏**: 当关闭接管面板时，清空内存中的临时变量，仅保留加密的安全凭证标识。
- **Agent Handoff**: 当开发中断时，将已完成步骤和未完成步骤归档至 `docs/development/session-handoff.md`。

## 3. Runtime Knowledge Projection - 2026-06-03

- Runtime store: `apps/web/src/features/ai-assistant-runtime/knowledge/KnowledgeStore.ts`.
- Projection tools: `knowledge.searchProject`, `knowledge.recordChange`, `ui.recordLayoutChange`, and `skills.upsertSkill`.
- Storage boundary: browser `localStorage` may cache redacted summaries, UI changes, and skill projections, but it is not authoritative long-term storage.
- Sensitive boundary: API keys, passwords, bearer tokens, JWTs, cookies, billing secrets, and database URLs must be redacted before writing memory records.
- Recovery rule: after interruption, inspect `docs/development/session-handoff.md`, `validation.md`, and `docs/ai-assistant/*`; then use `knowledge.searchProject` only as a helper index, not as the source of truth.
