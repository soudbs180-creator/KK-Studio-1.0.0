# 模块地图 (Module Map)

本文件整理了 KK Studio v1.5.3 的核心模块，供 AI 助手理解代码依赖和调用边界。

---

## 1. 画布模块 (Canvas Module)

负责在无限画布上渲染和管理节点（提示词卡片、图像卡片等），包括节点的坐标计算、排列和选择状态管理。

- **核心 Context**: [CanvasContext.tsx](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/context/CanvasContext.tsx)
- **状态管理**: [canvasContextState.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/context/canvasContextState.ts)
- **自动排列算法**:
  - 自动整理画布: [canvasAutoArrange.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/context/canvasAutoArrange.ts)
  - 整理选中选区: [canvasArrangeSelection.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/context/canvasArrangeSelection.ts)
- **视口拖拽与缩放**: [InfiniteCanvas.tsx](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/components/canvas/InfiniteCanvas.tsx)
- **框选管理器**: [useCanvasSelectionBox.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/app/useCanvasSelectionBox.ts)

---

## 2. AI 接管模块 (AI Takeover Module)

这是 AI 助手的总入口和接管逻辑层，负责意图门控、大脑规划、任务确认及命令分发。

- **入口 Context**: [AITakeoverContext.tsx](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx)
- **本地规划器**: [localBrain.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/features/ai-takeover/core/localBrain.ts)
- **云端大模型规划器**: [llmBrain.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/features/ai-takeover/core/llmBrain.ts)
- **意图分析**: [intentGate.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/features/ai-takeover/core/intentGate.ts)
- **工具/动作执行**:
  - 工具定义与注册: [toolRegistry.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/features/ai-takeover/core/toolRegistry.ts)
  - 动作分发兼容代理: [actionExecutor.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/features/ai-takeover/core/actionExecutor.ts)
- **安全与确认策略**:
  - 安全门禁: [safetyPolicy.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/features/ai-takeover/core/safetyPolicy.ts)
  - 强确认弹出卡片: [confirmationPolicy.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/features/ai-takeover/core/confirmationPolicy.ts)
- **脱敏构建器**: [projectContextBuilder.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/features/ai-takeover/core/projectContextBuilder.ts)

---

## 3. 生成模块 (Generation Module)

管理绘图生成任务，处理 API 通信、积分逻辑和异常重试。

- **React 状态钩子**: [useImageGeneration.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/hooks/useImageGeneration.ts)
- **大模型通信服务**: [LLMService.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/services/llm/LLMService.ts)
- **任务持久化与恢复**:
  - 内存/存储序列化: [taskPersistence.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/services/persistence/taskPersistence.ts)
  - 自动任务断线重连恢复: [useTaskRecovery.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/hooks/useTaskRecovery.ts)
- **持久化批量任务队列**: [DurableGenerationQueue.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts)
- **后端生成路由**: `server/routes/generate-image.js`

---

## 4. 资产模块 (Assets Module)

维护用户上传和导出的图像及文件，并执行多卡片图片批量打包下载。

- **本地存储池**: [assetStore.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/features/assets/assetStore.ts)
- **原图解析引擎**: [resolveOriginalAssets.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/features/assets/resolveOriginalAssets.ts)
- **多卡片 ZIP 打包**: [zipOutputs.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/features/assets/zipOutputs.ts)
- **IndexedDB 物理存储**: [imageStorage.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/services/storage/imageStorage.ts)
---

## 5. Knowledge / Memory Module

Maintains the AI assistant project knowledge projection used by `knowledge.searchProject`, `knowledge.recordChange`, `ui.recordLayoutChange`, and `skills.upsertSkill`.

- **Runtime projection store**: [KnowledgeStore.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/features/ai-assistant-runtime/knowledge/KnowledgeStore.ts)
- **Authoritative docs**: [docs/ai-assistant/](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/ai-assistant/)
- **Handoff source**: [session-handoff.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/development/session-handoff.md)
- **Tests**: [agent-knowledge-sync.test.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/tests/unit/agent-knowledge-sync.test.ts)

Boundary: this runtime store is a browser projection/cache. It must not be treated as authoritative database storage and must only contain redacted summaries.
