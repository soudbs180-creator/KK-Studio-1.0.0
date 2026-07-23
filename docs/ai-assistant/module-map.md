Status: reference

# 模块地图 (Module Map)

本文件整理了 KK Studio v1.6.0 的核心模块，供 AI 助手理解代码依赖和调用边界。

---

## 1. 画布模块 (Canvas Module)

负责在无限画布上渲染和管理节点（提示词卡片、图像卡片等），包括节点的坐标计算、排列和选择状态管理。

- **核心 Context**: [CanvasContext.tsx](../../apps/web/src/context/CanvasContext.tsx)
- **状态管理**: [canvasContextState.ts](../../apps/web/src/context/canvasContextState.ts)
- **自动排列算法**:
  - 自动整理画布: [canvasAutoArrange.ts](../../apps/web/src/context/canvasAutoArrange.ts)
  - 整理选中选区: [canvasArrangeSelection.ts](../../apps/web/src/context/canvasArrangeSelection.ts)
- **视口拖拽与缩放**: [InfiniteCanvas.tsx](../../apps/web/src/components/canvas/InfiniteCanvas.tsx)
- **框选管理器**: [useCanvasSelectionBox.ts](../../apps/web/src/app/useCanvasSelectionBox.ts)

---

## 2. AI 接管模块 (AI Takeover Module)

这是 AI 助手的总入口和接管逻辑层，负责意图门控、大脑规划、任务确认及命令分发。

- **入口 Context**: [AITakeoverContext.tsx](../../apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx)
- **本地规划器**: [localBrain.ts](../../apps/web/src/features/ai-takeover/core/localBrain.ts)
- **云端大模型规划器**: [llmBrain.ts](../../apps/web/src/features/ai-takeover/core/llmBrain.ts)
- **意图分析**: [intentGate.ts](../../apps/web/src/features/ai-takeover/core/intentGate.ts)
- **工具/动作执行**:
  - 类型化执行上下文: [AssistantExecutionContext.ts](../../apps/web/src/features/ai-assistant-runtime/runtime/AssistantExecutionContext.ts)
  - 运行时协调器: [AgentRuntime.ts](../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts)
  - 工具定义与注册: [ToolRegistry.ts](../../apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts)
  - 运行记录存储: [AgentRunStore.ts](../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRunStore.ts)
- **安全与确认策略**:
  - 安全门禁: [safetyPolicy.ts](../../apps/web/src/features/ai-takeover/core/safetyPolicy.ts)
  - 强确认弹出卡片: [confirmationPolicy.ts](../../apps/web/src/features/ai-takeover/core/confirmationPolicy.ts)
- **脱敏构建器**: [projectContextBuilder.ts](../../apps/web/src/features/ai-takeover/core/projectContextBuilder.ts)

---

## 3. 生成模块 (Generation Module)

管理绘图生成任务，处理 API 通信、积分逻辑和异常重试。

- **React 状态钩子**: [useImageGeneration.ts](../../apps/web/src/hooks/useImageGeneration.ts)
- **大模型通信服务**: [LLMService.ts](../../apps/web/src/services/llm/LLMService.ts)
- **任务持久化与恢复**:
  - 内存/存储序列化: [taskPersistence.ts](../../apps/web/src/services/persistence/taskPersistence.ts)
  - 自动任务断线重连恢复: [useTaskRecovery.ts](../../apps/web/src/hooks/useTaskRecovery.ts)
- **持久化批量任务队列**: [DurableGenerationQueue.ts](../../apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts)
- **后端生成路由**: `services/api/routes/generate-image.js`

---

## 4. 资产模块 (Assets Module)

维护用户上传和导出的图像及文件，并执行多卡片图片批量打包下载。

- **本地存储池**: [assetStore.ts](../../apps/web/src/features/assets/assetStore.ts)
- **原图解析引擎**: [resolveOriginalAssets.ts](../../apps/web/src/features/assets/resolveOriginalAssets.ts)
- **多卡片 ZIP 打包**: [zipOutputs.ts](../../apps/web/src/features/assets/zipOutputs.ts)
- **IndexedDB 物理存储**: [imageStorage.ts](../../apps/web/src/services/storage/imageStorage.ts)

---

## 5. Knowledge / Memory Module

Maintains the AI assistant project knowledge projection used by `knowledge.searchProject`, `knowledge.recordChange`, `ui.recordLayoutChange`, and `skills.upsertSkill`.

- **Runtime projection store**: [KnowledgeStore.ts](../../apps/web/src/features/ai-assistant-runtime/knowledge/KnowledgeStore.ts)
- **Authoritative docs**: [docs/ai-assistant/](../../docs/ai-assistant/)
- **Handoff source**: [session-handoff.md](../../docs/development/session-handoff.md)
- **Tests**: [agent-knowledge-sync.test.ts](../../tests/unit/agent-knowledge-sync.test.ts)

Boundary: this runtime store is a browser projection/cache. It must not be treated as authoritative database storage and must only contain redacted summaries. Server synchronization goes through typed KK API Client methods. User records are scoped by the authenticated user; only explicitly marked system knowledge is shared, and legacy unowned records are not queried as shared knowledge.

## 6. AI Assistant persistence boundary

- **Shared DTO and client contract**: `packages/shared/src/contracts/dto/ai-assistant.ts`, `packages/shared/src/contracts/client/kk-api-client.ts`
- **Web API client**: `packages/api-client`
- **Authenticated server routes**: `services/api/routes/ai-assistant.js`
- **User-scope migration**: `infrastructure/database/migrations/016_ai_assistant_user_scope.sql`
- **Run event migrations and read store**: `infrastructure/database/migrations/020_agent_run_events.sql`, `infrastructure/database/migrations/023_agent_run_semantic_events.sql`, `infrastructure/database/migrations/024_agent_run_replan_events.sql`, `services/api/lib/agent-run-event-store.js`
- **Bounded replan event boundary**: migration 024 derives `replanCount` only from an accepted structural plan replacement, enforces 0–3 in PostgreSQL, and emits fixed `plan_replaced / accepted_plan_change` metadata. Clients cannot choose the count; Web treats the event as read-only invalidation and never as execution authority.
- **Web Run projection recovery**: `apps/web/src/features/ai-assistant-runtime/runtime/agentRunHydration.ts`, `apps/web/src/features/ai-assistant-runtime/runtime/agentRunEventRecovery.ts`
- **Session/context migration and store**: `infrastructure/database/migrations/021_agent_sessions.sql`, `services/api/lib/agent-session-store.js`
- **Web Session read-only projection**: `apps/web/src/features/ai-assistant-runtime/runtime/agentSessionProjection.ts`
- **Owner-enforced optional Run/Session binding**: `infrastructure/database/migrations/022_agent_run_session_binding.sql`, `services/api/lib/agent-run-write-store.js`
- **Fail-closed Chat-to-Agent Session mapping gate**: `apps/web/src/components/layout/chat-sidebar/session/chatAgentSessionProjection.ts`
- **Owner-scoped canonical Chat Asset resolver**: `apps/web/src/components/layout/chat-sidebar/session/chatCanonicalAssetResolver.ts`, `packages/shared/src/contracts/dto/asset-library.ts`
- **Structured Chat rolling summary state**: `apps/web/src/components/layout/chat-sidebar/session/chatContextCompression.ts`
- **Shared deterministic Planner TokenBudget and trimming policy**: `apps/web/src/features/ai-takeover/core/agentContextBudget.ts`, `apps/web/src/components/layout/chat-sidebar/session/chatAgentContextBudget.ts`
- **Owner-stable Chat Session write coordinator**: `apps/web/src/components/layout/chat-sidebar/session/chatAgentSessionWriteCoordinator.ts`
- **Fail-closed Chat Run/Session binding activation**: `apps/web/src/components/layout/chat-sidebar/session/chatAgentRunSessionBinding.ts`, `apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx`
- **Authority-free Planner Session context**: `apps/web/src/features/ai-assistant-runtime/runtime/agentPlannerSessionContext.ts`, `apps/web/src/features/ai-takeover/core/agentPlannerContext.ts`, `apps/web/src/features/ai-takeover/core/llmBrain.ts`, `apps/web/src/features/ai-takeover/core/localBrain.ts`
- **Metadata-only Context Snapshot producer and projection**: `apps/web/src/features/ai-takeover/core/agentContextSnapshot.ts`, `apps/web/src/features/ai-assistant-runtime/runtime/agentContextSnapshotProjection.ts`
- **Fail-closed multi-turn selection reference policy**: `apps/web/src/features/ai-takeover/core/agentPlannerReferencePolicy.ts`
- **Owner-bound Capability Graph Planner discovery**: `apps/web/src/features/ai-takeover/core/agentPlannerCapabilityContext.ts`, `apps/web/src/features/ai-assistant-runtime/tools/capabilityTools.ts`

The web runtime must not bypass this boundary with raw `fetch`. Agent runs retain per-step verification outcomes; tool calls retain outcome and failure metadata; Knowledge, UI layout Knowledge and Skill writes are bound to the current user. Server adapters map database rows to the public camelCase DTO, reject cross-owner access, and order Agent Run snapshots by the client `updatedAt` value.

Migration 020 appends a per-Run sequence in the same transaction as each accepted snapshot and exposes only status/timestamp metadata. Migration 023 adds strict relational `step_outcome` metadata for new or semantically changed verification results, excludes free-form messages and arbitrary payloads, and bounds one Run write to 100 step events. Migration 024 adds a database-derived `replan` count of 1–3 with fixed reason/trigger codes and rejects a fourth structural plan replacement. The Web runtime consumes mixed `run_snapshot | step_outcome | replan` pages only as owner-qualified invalidation signals for the 20 most recent active synchronized Runs, with at most four concurrent reads. It advances a cursor only after the event page and authoritative Run detail pass shared schemas and the read-only projection accepts the snapshot; an event never grants local execution authority.

Migration 021 adds bounded Session bodies and metadata-only Context Snapshots: message attachments are Asset references, snapshot ownership comes only from the parent Session, and raw input text/attachment bytes are forbidden. Migration 022 adds an optional Run `sessionId`; the composite owner foreign key and write store accept only the current owner's Session, preserve an established binding, and leave requests without the field compatible. The Web Session projection validates list/detail with the shared schema plus owner and requested Session ID, clears on owner change, and never reads or mutates ChatSidebar storage. Chat compression persists a canonical rolling summary separately from the compatibility boundary message, while the shared deterministic budget policy produces bounded, non-billing TokenBudget evidence. The write coordinator reads or establishes the owner-qualified Session, resolves Assets through expected-subject typed calls, preserves authoritative non-Chat state, submits only a strict DTO and hydrates the validated server response; it treats 404 as new-Session admission, stale writes as server-authoritative projection, and every owner/schema failure as fail closed. Chat Run creation invokes that coordinator only for non-temporary local Sessions with explicit creation identity and structured summary; promotion is bounded to three seconds and every rejection falls back to the compatible unbound Run path.

Before planning, `AgentRuntime` resolves the same exact owner-scoped detail into a second bounded projection and removes attachments, owner identity, confirmations, checkpoints, content hashes, historical system/tool messages and summary-covered messages. It also performs a 1.5-second-bounded latest Snapshot hydration, then asynchronously appends the current metadata-only capture. Snapshot transport failure preserves the Session projection and Run path; only an exact Session, matching surface/canvas, summary-fresh capture within five minutes of clock skew enters the separate canvas budget. The reference policy intersects historical selection IDs with current canvas nodes, rejects ambiguous singular references and target substitution, and never treats generic continuation or historical Job IDs as resume authority. LLM history is placed before the latest user instruction under an explicit lower-authority policy; LocalBrain reports only restored counts. Browser Agent Run history, event cursors, Knowledge projections and retry queues use owner-qualified keys and never reuse another owner's cache. Unsynchronized Run snapshots stay durably marked pending until the typed client acknowledges the latest timestamp. Complete semantic replay, a real replan executor, confirmation expiry, real-LLM multi-turn validation and cross-device execution remain later Phase 3 tasks.
