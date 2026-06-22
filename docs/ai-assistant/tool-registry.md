# 工具注册表说明 (Tool Registry)

在 KK Studio v1.5.7 中，AI 助手的所有画布和系统操作被声明式地定义为具名 Tool，并受安全权限等级保护，防止敏感凭证泄露或高危破坏行为。

## 1. 安全等级权限矩阵

| 安全等级 (Permission) | 审计策略 | 典型示例 |
| :--- | :--- | :--- |
| `safe` | 允许 AI 自动静默执行，无须打扰用户 | `canvas.getState`, `canvas.locateNodes`, `assets.zipOriginals` (打包下载已有图) |
| `confirm` | 需要弹出“确认计划”卡片，经用户点击“确认”后执行 | `generation.createBatchJob` (扣积分生图), `ecommerce.createBatchTransformJob`, `assets.upload` |
| `dangerous` | 需要二次强确认，并高亮显示受影响的范围 | `canvas.deleteNodes` (删除卡片), `canvas.clearAll` |
| `forbidden` | 属于硬性禁止执行的工具，永远拦截，不提供执行器 | `fillApiKey` (自动填写/上传密钥), `billing.bypass` |

---

## 2. 第一批工具清单描述

当前代码入口位于 `apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts`。AI Takeover 通过 `AgentRuntime.executePendingRun` 统一执行计划，不再保留单独的 `actionExecutor` 生产路径。为兼容旧 `AssistantAction`，注册表同时保留 `fillPrompt`、`zipOutputs`、`startBatchGeneration` 等 legacy 名称；新流程应优先使用 namespaced 工具名。每次工具执行都会写入脱敏的 `AgentToolCallLog`，包含 `runId`、`toolName`、输入/输出摘要、状态、错误和时间戳。

### `canvas.getState`
- **说明**: 获取当前画布节点数、画布名称、尺寸与视口状态。
- **权限**: `safe`

### `canvas.getSelectedNodes`
- **说明**: 获取当前选中的图片或 Prompt 卡片列表及其详细信息。
- **权限**: `safe`

### `canvas.arrangeNodes`
- **说明**: 对指定范围的节点按 grid/row/column 布局进行重新整齐排版。传入 `nodeIds` 时只整理这些节点；未传 `nodeIds` 时沿用 CanvasContext 的选区/全画布整理路径。
- **权限**: `safe`
- **新增参数**: `nodeIds?: string[]`, `preset?: 'compact-grid'`, `columns?: number`, `gap?: number`

### `canvas.locateNodes`
- **说明**: 根据关键词查找卡片并平滑移动聚焦至屏幕中心。
- **权限**: `safe`

### `ui.openSettings`
- **说明**: 通过稳定设置页功能 ID 打开对应面板，例如 `api-management`、`system-logs`、`user-profile`、`storage-settings`、`consumption-records`、`dashboard`。
- **权限**: `safe`
- **规则**: 本工具控制底层设置路由，不依赖某个按钮在页面上的视觉位置。

### `assets.zipOriginals`
- **说明**: 获取选中的卡片，解析其对应的原图并进行 ZIP 打包下载，附带清单文件。
- **权限**: `safe`

### `generation.createBatchJob`
- **说明**: 创建持久化批量生图任务，包含成本核算与并发速率控制。
- **权限**: `confirm`
- **输出分组**: `options.outputGroup` 可绑定一个批量输出卡组，默认白色弱内发光，完成后收集 Prompt/Image 节点并写入同一个 `CanvasGroup`。

### `ecommerce.createBatchTransformJob`
- **说明**: 将“文件夹/资源池图片全部改成某种电商排版、比例”的自然语言请求适配为批量重绘任务，复用 `generation.createBatchJob` 和 `DurableGenerationQueue`，不模拟 PromptBar 输入。
- **权限**: `confirm`
- **默认**: `aspectRatio='4:5'`, `layoutPreset='compact-grid'`, `outputGroup.color='#ffffff'`

### `generation.pauseJob`
- **说明**: 暂停指定的批量生图任务，正在运行的子任务将重置为 queued。
- **权限**: `safe`

### `generation.resumeJob`
- **说明**: 恢复指定的处于暂停状态的批量生图任务，使其重新进入调度队列。
- **权限**: `safe`

### `generation.retryJob`
- **说明**: 将指定持久化批量任务中的失败子项重新加入 `DurableGenerationQueue`，已完成子项不会重复提交。
- **权限**: `safe`
- **适用场景**: 用户明确提供 `jobId` 并要求“重试失败批次 / retry failed job”时调用；用户说“重试最近失败批次 / retry latest failed batch”但未提供 ID 时，可传 `target: 'latest_failed'` 自动选择最近失败任务。若任务没有失败子项，只返回状态摘要。

### `generation.submitComposer`
- **说明**: 提交当前画布输入框，复用输入框已设置的模型、比例、参考图、数量与模式直接发起生成。
- **权限**: `safe`

### Browser Assistant Bridge tools
- **`browser.getStatus`**: 读取本地守护进程、Chrome 插件、平台池、会话池和社媒草稿通道的脱敏状态，权限为 `safe`。
- **`browser.openAssistant`**: 打开 `browser-assistant` 设置页入口，权限为 `safe`。
- **`browser.extractProduct`**: 通过 Browser Bridge 提取外部商品页标题、价格、主图和描述摘要，权限为 `confirm`。URL 仅允许 `http://` / `https://`，并拦截 localhost、私有网段和浏览器内部协议。
- **`browser.generateExternal`**: 通过已连接平台和会话池创建外部网页生图任务，权限为 `confirm`。
- **`browser.publishDraft`**: 保存到外部社媒草稿箱，权限为 `confirm`，不得直接公开发布。
- **`browser.inspectPage`**: 通过 Browser Bridge 抓取当前外部浏览器可见视口的脱敏色彩、布局和 OCR/文本摘要，权限为 `confirm`，不得传输完整页面源码。
- **`browser.openDesktopProject`**: 通过 Browser Bridge 调起已连接的本地桌面 IDE，权限为 `confirm`，不得传输完整本地路径。
- **`browser.checkLocalLlm`**: 通过 Browser Bridge 诊断本地 LLM 网关和活跃模型，权限为 `safe`，不得由网页端直接探测并伪造成功。
- **`browser.writeBackDom`**: 回写外部网页 DOM 字段，权限为 `dangerous`，必须二次确认。
- **断开状态**: 未连接本地守护进程或 Chrome 插件时，Browser 工具必须返回 `setup_required` 或连接引导，不得返回演示成功数据。

## 3. Legacy Action 兼容映射

| Legacy action | Namespaced tool |
| :--- | :--- |
| `locateCard` | `canvas.locateNodes` |
| `zipOutputs` | `assets.zipOriginals` |
| `startBatchGeneration` | `generation.createBatchJob` |
| `submitPromptComposer` | `generation.submitComposer` |
| `fillPrompt` | `prompt.fillPrompt` |
| `fillInputPrompt` | `prompt.optimizeInput` |
| `openSettings` | `ui.openSettings` |

## 4. Implementation update - 2026-06-03 / 2026-06-05

- `assets.zipOriginals` now delegates selected-card filtering and original-source priority to `apps/web/src/features/assets/resolveOriginalAssets.ts`.
- `selected_cards` uses `selectedNodeIds`; selected image nodes are included directly, and selected Prompt nodes expand to child images through `childImageIds` and `parentPromptId`.
- ZIP download source order is `originalUrl -> apiResultUrl -> url -> storageId -> localFile` recovery.
- `manifest.json` records `nodeId`, `parentPromptId`, `promptSummary`, `model`, `createdAt`, source kind, and `failedItems` with attempted source kinds.
- If all image downloads fail, the ZIP still contains `manifest.json` so the user and the next Agent can inspect failure reasons.
- Alias registration is idempotent: if a namespaced tool such as `generation.createBatchJob` already has a real implementation, the legacy alias wrapper does not overwrite it.
- `generation.createBatchJob` passes `idempotencyKey` into `DurableGenerationQueue`; when no key is provided, the queue derives a stable key from `canvasId`, prompt list, and options.
- `DurableGenerationQueue` enforces `maxBatchSize=100`, normalizes concurrency into `1..8` with default `3`, and keeps retry behavior at `3` retries after the initial attempt with `2000ms` backoff.
- `generation.retryJob` exposes `DurableGenerationQueue.retryFailedPrompts(jobId)` as a safe ToolRegistry action for failed batch recovery without resubmitting completed prompts; when the user omits an ID, `target: 'latest_failed'` resolves the most recent non-cancelled job that still has failed prompts.
- `DurableGenerationQueue` records `outputGroup`, each item `promptNodeId`, and completed `nodeIds`; completion handlers can create or update one canvas group per job and reuse it on idempotent resume.
- `canvas.arrangeNodes` supports targeted `nodeIds` layout through `updateNodes`; without `nodeIds` it calls the existing `CanvasContext.arrangeAllNodes(mode)` path.
- `ecommerce.createBatchTransformJob` is registered as a `confirm` tool and maps compact ecommerce folder/image commands to one grouped durable batch job.

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

## 6. Implementation update - AI control action surface - 2026-06-22

- AI Takeover UI control buttons use `AGENT_CONTROL_ACTIONS` from `apps/web/src/features/ai-assistant-runtime/runtime/agentControlActions.ts` as the shared action contract.
- Confirmation buttons expose `data-agent-action="confirm-plan|cancel-plan"` plus `data-agent-runtime-action="executePendingRun|cancelPendingRun"` so both `AIAssistantDock` and `ChatSidebar` route pending plans through the same `AgentRuntime` methods.
- Durable generation queue buttons expose `data-agent-action` on both surfaces. Pause, resume, retry, and cancel also expose `data-agent-tool` mapped to `generation.pauseJob`, `generation.resumeJob`, `generation.retryJob`, and `generation.cancelJob`.
- Queue archive and output locate are local UI actions with `toolName: undefined`; they are intentionally not advertised as LLM tools because they do not go through `ToolRegistry`.
- `AIAssistantDock` and `ChatSidebar` now both show retry and locate controls for durable queue jobs, preventing one AI control surface from having a different queue capability set than the other.
- Composer and resource controls also use `AGENT_CONTROL_ACTIONS`: context compression, send message, image import, folder import, file connect, resource panel toggle/close, and resource removal are local UI actions with stable `data-agent-action` values and no `ToolRegistry` tool name.

## 7. Implementation update - Browser Assistant local actions - 2026-06-22

- Browser Assistant external automation buttons continue to use `BROWSER_ACTIONS` for `browser.*` ToolRegistry names and Browser Bridge command kinds.
- Browser Assistant station-internal buttons now use `BROWSER_LOCAL_ACTIONS` from `apps/web/src/features/ai-assistant-runtime/browser/browserActionCatalog.ts` as the shared local action contract.
- Browser Assistant local `actionName` values must be unique and namespaced as `browser.local.*`; multiple actions may map to the same ToolRegistry tool only when their UI semantics remain distinct.
- Product import and result-to-canvas buttons expose `data-browser-local-action` plus `data-agent-tool="canvas.createPromptCards"` because they create KK Studio canvas prompt/product cards rather than clicking PromptBar.
- Browser Assistant canvas import events delegate to `ToolRegistry.execute('canvas.createPromptCards')`; the App event bridge no longer constructs Prompt/Image nodes directly.
- `canvas.createPromptCards` accepts optional `imageUrl`, `model`, and `aspectRatio` so external Browser Assistant results can create a prompt card and attach the imported image as a child image node through the same runtime path.
- ZIP export buttons expose `data-browser-local-action` plus `data-agent-tool="assets.zipOriginals"`.
- Browser Assistant ZIP export events delegate to `ToolRegistry.execute('assets.zipOriginals')`; the App event bridge only supplies scope, selected ids, active canvas, and notification context.
- Browser Assistant ZIP buttons dispatch the runtime ZIP event directly; they do not gate on Browser Bridge daemon status or run dev fallback ZIP progress simulation.
- Browser Assistant ZIP locate actions must not fake OS file-manager success or expose full local filesystem paths; they only provide download-location guidance unless a real bridge result is available.
- Browser Assistant platform, social channel, and multi-account session status buttons read `browser.getStatus` through `ToolRegistry`; they do not use local random login simulation or dev fallback status results.
- Pipeline run keeps a stable `data-browser-local-action` identity for Browser Assistant UI/audit grouping, and also declares `data-browser-tool="browser.generateExternal"` plus the shared `generate_external` command kind because execution now runs through the Browser Bridge runtime adapter.
- Pipeline run no longer posts a `pipeline` task to the inline Web Worker, no longer emits simulated `pipeline_step` / `pipeline_done` results, and no longer reports Dev Fallback success. `setup_required` and `queued` states are surfaced as real Browser Bridge outcomes, while result cards appear only after a Bridge `success` response includes a usable image URL.
- Sensed clipboard import exposes `data-browser-local-action` plus `data-agent-tool="canvas.createPromptCards"` because it creates a KK Studio Prompt card through the same runtime event bridge as Browser Assistant product/card imports.
- Clipboard capture reads `navigator.clipboard.readText()` from a user gesture instead of injecting a fixed demo product URL; URL content is imported as a prompt-card payload unless the user explicitly asks for Browser Bridge product extraction.
- Screen inspect / design translation buttons declare `data-browser-tool="browser.inspectPage"` plus the shared `inspect_page` command kind and call the Browser Bridge runtime adapter; they no longer use local timers, fixed color palettes, canned OCR text, or Dev Fallback success paths.
- Desktop IDE launch declares `data-browser-tool="browser.openDesktopProject"` plus the shared `open_desktop_project` command kind and uses Browser Bridge runtime outcomes instead of Dev Fallback success.
- Local LLM gateway diagnostics declare `data-browser-tool="browser.checkLocalLlm"` plus the shared `check_local_llm` command kind and use Browser Bridge runtime outcomes instead of direct browser fetch probes or Dev Fallback success.
- Exported ZIP locate exposes a stable `data-browser-local-action` value with no ToolRegistry tool name because it remains local Browser Assistant UI guidance.
