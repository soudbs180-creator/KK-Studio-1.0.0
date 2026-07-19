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
- **后端生成路由**: `server/routes/generate-image.js`

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
- **Authenticated server routes**: `server/routes/ai-assistant.js`
- **User-scope migration**: `migrations/016_ai_assistant_user_scope.sql`

The web runtime must not bypass this boundary with raw `fetch`. Agent runs retain per-step verification outcomes; tool calls retain outcome and failure metadata; Knowledge, UI layout Knowledge and Skill writes are bound to the current user. Server adapters map database rows to the public camelCase DTO, reject cross-owner access, and order Agent Run snapshots by the client `updatedAt` value. Browser Agent Run history, Knowledge projections and retry queues use owner-qualified keys and never reuse another owner's cache; same-owner tabs merge versioned projection records and re-read persisted pending tasks before mutation, so unrelated writes cannot erase another tab's tombstone or delete retry. An in-flight failure is queued for the owner that initiated it. Skill acknowledgements are version-matched, and name-scoped deletion versions plus the server `agent_skill_versions` gate prevent late same-name upserts—even with different tab-generated IDs—from clearing newer pending payloads or resurrecting deleted Skills. Unsynchronized Run snapshots stay durably marked pending until the typed client acknowledges the latest timestamp.
