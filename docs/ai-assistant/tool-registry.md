# 工具注册表说明 (Tool Registry)

在 KK Studio v1.5.3 中，AI 助手的所有画布和系统操作被声明式地定义为具名 Tool，并受安全权限等级保护，防止敏感凭证泄露或高危破坏行为。

## 1. 安全等级权限矩阵

| 安全等级 (Permission) | 审计策略 | 典型示例 |
| :--- | :--- | :--- |
| `safe` | 允许 AI 自动静默执行，无须打扰用户 | `canvas.getState`, `canvas.locateNodes`, `assets.zipOriginals` (打包下载已有图) |
| `confirm` | 需要弹出“确认计划”卡片，经用户点击“确认”后执行 | `generation.createBatchJob` (扣积分生图), `assets.upload` |
| `dangerous` | 需要二次强确认，并高亮显示受影响的范围 | `canvas.deleteNodes` (删除卡片), `canvas.clearAll` |
| `forbidden` | 属于硬性禁止执行的工具，永远拦截，不提供执行器 | `fillApiKey` (自动填写/上传密钥), `billing.bypass` |

---

## 2. 第一批工具清单描述

当前代码入口位于 `apps/web/src/features/ai-takeover/core/toolRegistry.ts`。为兼容旧 `AssistantAction`，注册表同时保留 `fillPrompt`、`zipOutputs`、`startBatchGeneration` 等 legacy 名称；新流程应优先使用 namespaced 工具名。每次工具执行都会写入脱敏的 `AgentToolCallLog`，包含 `runId`、`toolName`、输入/输出摘要、状态、错误和时间戳。

### `canvas.getState`
- **说明**: 获取当前画布节点数、画布名称、尺寸与视口状态。
- **权限**: `safe`

### `canvas.getSelectedNodes`
- **说明**: 获取当前选中的图片或 Prompt 卡片列表及其详细信息。
- **权限**: `safe`

### `canvas.arrangeNodes`
- **说明**: 对指定范围（选区或整个画布）的节点按 grid/row/column 布局进行重新整齐排版。
- **权限**: `safe`

### `canvas.locateNodes`
- **说明**: 根据关键词查找卡片并平滑移动聚焦至屏幕中心。
- **权限**: `safe`

### `assets.zipOriginals`
- **说明**: 获取选中的卡片，解析其对应的原图并进行 ZIP 打包下载，附带清单文件。
- **权限**: `safe`

### `generation.createBatchJob`
- **说明**: 创建持久化批量生图任务，包含成本核算与并发速率控制。
- **权限**: `confirm`

### `generation.pauseJob`
- **说明**: 暂停指定的批量生图任务，正在运行的子任务将重置为 queued。
- **权限**: `safe`

### `generation.resumeJob`
- **说明**: 恢复指定的处于暂停状态的批量生图任务，使其重新进入调度队列。
- **权限**: `safe`

## 3. Legacy Action 兼容映射

| Legacy action | Namespaced tool |
| :--- | :--- |
| `locateCard` | `canvas.locateNodes` |
| `zipOutputs` | `assets.zipOriginals` |
| `startBatchGeneration` | `generation.createBatchJob` |
| `submitPromptComposer` | `generation.submitComposer` |
| `fillPrompt` | `prompt.fillPrompt` |
| `fillInputPrompt` | `prompt.optimizeInput` |

## 4. Implementation update - 2026-06-03

- `assets.zipOriginals` now delegates selected-card filtering and original-source priority to `apps/web/src/features/assets/resolveOriginalAssets.ts`.
- `selected_cards` uses `selectedNodeIds`; selected image nodes are included directly, and selected Prompt nodes expand to child images through `childImageIds` and `parentPromptId`.
- ZIP download source order is `originalUrl -> apiResultUrl -> url -> storageId -> localFile` recovery.
- `manifest.json` records `nodeId`, `parentPromptId`, `promptSummary`, `model`, `createdAt`, source kind, and `failedItems` with attempted source kinds.
- If all image downloads fail, the ZIP still contains `manifest.json` so the user and the next Agent can inspect failure reasons.
- Alias registration is idempotent: if a namespaced tool such as `generation.createBatchJob` already has a real implementation, the legacy alias wrapper does not overwrite it.
- `generation.createBatchJob` passes `idempotencyKey` into `DurableGenerationQueue`; when no key is provided, the queue derives a stable key from `canvasId`, prompt list, and options.
- `DurableGenerationQueue` enforces `maxBatchSize=100`, normalizes concurrency into `1..8` with default `3`, and keeps retry behavior at `3` retries after the initial attempt with `2000ms` backoff.
- `canvas.arrangeNodes` is registered and calls the existing `CanvasContext.arrangeAllNodes(mode)` path, so selection-first arrange behavior stays centralized in `CanvasContext`.

## 5. Implementation update - KnowledgeSync projection - 2026-06-03

- `assets.resolveOriginals` is registered as a safe preflight tool. It resolves selected/current image nodes and returns source-kind summaries without downloading files or exposing full URLs.
- `generation.getJobStatus` is registered as a safe read tool for `DurableGenerationQueue` status summaries.
- `knowledge.searchProject` searches baseline assistant docs plus runtime projection records.
- `knowledge.recordChange` records sanitized change summaries, touched paths, affected modules, tools, validation, deprecated behavior, and next-Agent instructions.
- `ui.recordLayoutChange` records selector or layout changes that must later be reflected in `docs/ai-assistant/ui-map.md`.
- `skills.upsertSkill` records sanitized project Skill / Runbook projections.
- Runtime implementation: `apps/web/src/features/ai-assistant-runtime/knowledge/KnowledgeStore.ts`.
- Storage note: browser `localStorage` is only a projection/cache, not long-term authoritative storage. It stores redacted summaries only.
- Safety note: ToolRegistry execution console logs now emit the redacted `inputSummary` rather than raw tool input, matching the `AgentToolCallLog` redaction path.
