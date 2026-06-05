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

## 4. AI Takeover UI Fixes - 2026-06-05

- AI 接管在聊天侧栏中开启时，接管消息会继承并回写当前会话，不能切到一个看起来像新分支的独立空对话。
- “打开日志 / 查看日志 / 系统日志”属于 safe UI 操作，IntentGate 与 LLM Planner 都应直接规划 `openSettings({ tab: 'system-logs' })`，不得要求先配置模型。
- 主聊天 action 处理器必须支持 `action://open-settings-logs`，并导航到 `system-logs` 设置页。
- API 工作台能力分配卡片只渲染对应角色实际需要的控件；非 AI 助手卡片显示主链路、主模型、备用链路、备用模型，不保留不可见占位块。
- “帮我打开个人中心 / API / 存储 / 计费 / 设置总览”等本地导航指令属于 safe UI 操作，IntentGate 应映射到 `open_settings_view` 并调用 `openSettings({ tab })`，即使已配置模型也先走本地。
- “生成一个...”这类简单单次生成指令默认走 `fillInputPrompt` + `submitPromptComposer`，复用画布输入框已设置的模型、比例、参考图和模式；批量、文件夹或逐参考图生成仍进入确认与队列。
- UI 位置不是 AI 助手的权威事实。助手记忆的权威单元是功能 ID、ToolRegistry 工具和 Skill/Runbook；修改 UI 后必须同步 `ui-map.md`、对应 Skill 和 `knowledge.recordChange` / `ui.recordLayoutChange` 投影。

## 5. Canvas Group Runtime Semantics - 2026-06-05

- Manual and assistant-created `CanvasGroup` objects now distinguish `hidden` from `collapsed`. `hidden` is a visual blur state; `collapsed` is the compact strip state that removes member cards from render queues.
- `group.color` is the weak inner-glow color. New manual groups default to `#ffffff`; right-click group menu owns rename and glow color changes.
- Hidden groups render the group label in the center of the blurred group with bounds/zoom-aware sizing and truncation, so the group remains identifiable while cards are blurred.
- Group dragging must update live member positions before committing node positions, keeping frame, cards, and connectors visually attached.
- Assistant batch/ecommerce generation memory should bind one conversation run or batch job to one canvas group. Store run/job identifiers in tags such as `automation` and `batch:<jobId>` and keep every generated card from that run inside the same group unless the user explicitly asks to split it.

## 6. Favorites And @ Reference Memory - 2026-06-05

- Global favorites live in the browser/app favorites IndexedDB store. When a workspace file-system handle exists, mirror the same records to `favorites/manifest.json`, with image blobs under `favorites/originals/` and `favorites/thumbnails/`.
- Favorite prompt insertion uses `favoriteComposerRegistry`: last focused composer wins, with `promptbar` as fallback. This keeps clicks from FavoritesPanel deterministic after interruption.
- The heart Favorites UI is a separate draggable floating window, not the `@` popup. It starts centered and restores the last drag position from `kk_favorites_panel_position_v1`.
- Composer ids are `promptbar`, `assistant`, and `ai-dock`. Record UI changes to these ids in `ui-map.md` before changing selector or panel placement.
- The `@` reference popup anchors near the typed token in the active composer and keeps the three tabs 上传内容 / 标签 / 喜欢.
- `@Name` is user-facing text. The execution binding is stored in `ReferenceImage.mentionName` / `mentionText` and resolved again at generation submit time.
- Generation submit must parse `@Name` and `@Name[dimension]`, reorder reference images by mention order, and append the internal reference mapping summary before entering the existing generation transaction.
- Non-image files referenced by `@` are assistant context only. They must not be attached to image generation requests.

## 6. Batch Ecommerce Execution Memory - 2026-06-05

- IntentGate and LocalBrain now carry `taskDomain`, `aspectRatio`, `layoutPreset`, and `outputGroup` through batch plans. “紧凑排版，比例4:5” maps to ecommerce `compact-grid` with `aspectRatio='4:5'`.
- `ecommerce.createBatchTransformJob` is a `confirm` ToolRegistry tool. It adapts resource-pool/image-collection inputs into DurableGenerationQueue jobs and does not simulate PromptBar input.
- DurableGenerationQueue persists `outputGroup`, each prompt item `promptNodeId`, result image node IDs, and grouped `nodeIds`. Idempotent resume reuses the existing job/group binding rather than creating duplicate groups.
- AITakeoverProvider wires queue completion into canvas updates: targeted arrange, node tags, and one output `CanvasGroup` per job with default white inner glow.
- CanvasRuntimeState includes group summaries (`id`, `label`, `hidden`, `collapsed`, `color`, `nodeCount`, `tags`) so later assistant commands can refer to current groups structurally.

## 7. Project-Wide Runtime Hardening - 2026-06-05

- CanvasRuntimeState now sanitizes prompt text, prompt-bar input, group labels, and recent event summaries before they enter assistant context. Long bearer/API-key-like strings and inline base64 data are redacted.
- CanvasRuntimeState group tag lookup uses indexed node maps, and recent-node detection is single-pass O(n) instead of sorting all candidates.
- ToolRegistry audit logs are capped at 200 entries and store redacted error strings, preventing long assistant sessions from growing memory without bound or leaking credentials.
- DurableGenerationQueue exposes a subscriber API for UI updates, deduplicates in-flight prompt execution, coalesces queue processing, and can archive finished jobs while preserving active jobs.
- AIAssistantDock now subscribes to queue changes instead of polling every 1.5 seconds, and its queue panel shows active jobs first.
- Selected-card ZIP downloads are bounded by configurable concurrency, timeout, retry, and progress callbacks; `manifest.json` still records per-item failures and all-failed runs.
- Server chat/image generation now share a native fixed-window limiter with opportunistic expired-key pruning instead of route-local unbounded Maps. Generated image files no longer expose user IDs in public upload URLs and are written asynchronously.
