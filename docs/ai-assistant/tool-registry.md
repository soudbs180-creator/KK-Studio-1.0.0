# 工具注册表说明 (Tool Registry)

在 KK Studio v1.6.0 中，AI 助手的所有画布和系统操作被声明式地定义为具名 Tool，并受安全权限等级保护，防止敏感凭证泄露或高危破坏行为。

## 1. 安全等级权限矩阵

| 安全等级 (Permission) | 审计策略 | 典型示例 |
| :--- | :--- | :--- |
| `safe` | 仅限只读、导航和可撤销的局部操作；接管模式可自动执行 | `canvas.getState`, `canvas.locateNodes`, `canvas.arrangeNodes` |
| `confirm` | 需要 run-bound 用户授权；计划卡必须展示影响、数量和费用 | `generation.createBatchJob`, `generation.retryJob`, `generation.submitComposer`, `assets.zipOriginals` |
| `dangerous` | 需要二次强确认，并高亮显示受影响范围和恢复能力 | `canvas.deleteNodes`, `canvas.clearAll`, `browser.publishDraft`, `browser.writeBackDom` |
| `forbidden` | 属于硬性禁止执行的工具，永远拦截，不提供执行器 | `fillApiKey` (自动填写/上传密钥), `billing.bypass` |

---

## 2. 第一批工具清单描述

当前代码入口位于 `apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts`。AI Takeover 通过 `AgentRuntime.executePendingRun` 统一执行计划，不再保留单独的 `actionExecutor` 生产路径。为兼容旧 `AssistantAction`，注册表同时保留 `fillPrompt`、`zipOutputs`、`startBatchGeneration` 等 legacy 名称；新流程应优先使用 namespaced 工具名。每次工具执行都会写入脱敏的 `AgentToolCallLog`，包含 `runId`、`stepId`、`toolName`、输入/输出摘要、验证结果、失败分类和时间戳。

所有修改型工具必须声明或获得规范化的输入校验、幂等策略、影响摘要、费用摘要、取消/撤销能力、失败分类与结果验证。`AgentRuntime` 不把 handler 返回视为目标完成，而是继续消费 `AgentPlanStep.verification`，并记录 `success`、`partial_success`、`retryable_failure`、`rolled_back_failure` 或 `cancelled`。

确认授权不是工具名 allowlist。用户点击确认时会冻结 owner、Run、Plan、Step、输入与幂等键，以及页面、项目、画布、选区、模型和可变配置摘要；ToolRegistry 在执行前、handler 返回后及异步 verifier 返回后都重新核对 owner 和作用域。持久 Run 的 `waiting_confirmation`/`running` 状态不能代替用户授权，预览后切换账号、画布、选区、模型或外部目标会拒绝执行。

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
- **权限**: `confirm`

### `generation.createBatchJob`
- **说明**: 创建持久化批量生图任务，包含成本核算与并发速率控制。
- **权限**: `confirm`
- **输出分组**: `options.outputGroup` 可绑定一个批量输出卡组，默认白色弱内发光，完成后收集 Prompt/Image 节点并写入同一个 `CanvasGroup`。

### `ecommerce.createBatchTransformJob`
- **说明**: 将“文件夹/资源池图片全部改成某种电商排版、比例”的自然语言请求适配为批量重绘任务，复用 `generation.createBatchJob` 和 `DurableGenerationQueue`，不模拟 PromptBar 输入。

### `generation.createVideoJob` / `generation.createAudioJob`
- **权限**: `confirm`。ToolRegistry 必须校验当前 `runId` 的确认授权。
- **输入**: 使用共享 Zod Schema；视频统一使用 `durationSeconds`、`resolution`、`aspectRatio`、`generateAudio`、首尾帧和 `motion` 参数。
- **执行**: 两者与图片任务共用版本化 `DurableGenerationQueue`，分别遵循媒体并发和批量上限。
- **验证**: 返回任务必须持久化且 `taskType` 与工具一致；未声明 Provider 能力时不得通过模型名称猜测。
- **权限**: `confirm`
- **默认**: `aspectRatio='4:5'`, `layoutPreset='compact-grid'`, `outputGroup.color='#ffffff'`

### `generation.pauseJob`
- **说明**: 暂停指定的批量生图任务，正在运行的子任务将重置为 queued。
- **权限**: `safe`
- **验证**: 必须从 `DurableGenerationQueue` 读取到目标 Job 的实时 `paused` 状态；幂等缓存不能代替实时状态。

### `generation.resumeJob`
- **说明**: 恢复指定的处于暂停状态的批量生图任务，使其重新进入调度队列。
- **权限**: `confirm`；恢复未完成项可能继续消耗 Provider 配额或积分，确认卡必须展示 Job、未完成项与费用影响。
- **验证**: 必须从 `DurableGenerationQueue` 读取到目标 Job 的实时 `queued` 或 `running` 状态。

### `generation.retryJob`
- **说明**: 将指定持久化批量任务中的失败子项重新加入 `DurableGenerationQueue`，已完成子项不会重复提交。
- **权限**: `confirm`
- **冻结输入**: 确认计划必须包含具体 `jobId`、`expectedUpdatedAt` 与排序后的 `expectedRetryablePromptIds`。用户只说“重试最近失败批次”时，AgentRuntime 在展示确认卡前只读定位当前 owner 的 Job，并把相对语义冻结成上述快照；ToolRegistry 不接受空输入或动态 latest/current selector。
- **执行边界**: Job 版本或可重试失败项集合在确认后发生变化时返回 `STALE_RETRY_TARGET`，不自动改选另一个 Job，也不产生 Provider 调用。

### `generation.cancelJob`
- **说明**: 取消指定持久任务并中止仍在排队或执行的子项。
- **权限**: `confirm`；取消不可撤销，必须绑定明确 `jobId`。
- **验证**: 必须从 `DurableGenerationQueue` 读取到目标 Job 的实时 `cancelled` 状态。

### `generation.submitComposer`
- **说明**: 提交当前画布输入框，复用输入框已设置的模型、比例、参考图、数量与模式直接发起生成。
- **权限**: `confirm`

### Browser Assistant Bridge tools
- **`browser.getStatus`**: 读取本地守护进程、Chrome 插件、平台池、会话池和社媒草稿通道的脱敏状态，权限为 `safe`。
- **`browser.openAssistant`**: 打开 `browser-assistant` 设置页入口，权限为 `safe`。
- **`browser.extractProduct`**: 通过 Browser Bridge 提取外部商品页标题、价格、主图和描述摘要，权限为 `confirm`。URL 仅允许 `http://` / `https://`，并拦截 localhost、私有网段和浏览器内部协议。
- **`browser.generateExternal`**: 通过已连接平台和会话池创建外部网页生图任务，权限为 `confirm`。
- **`browser.publishDraft`**: 保存到外部社媒草稿箱，当前有效权限为 `dangerous`，必须二次确认；不得直接公开发布。
- **`browser.inspectPage`**: 通过 Browser Bridge 抓取确认计划中公开 HTTP(S) `target` 对应页面可见视口的脱敏色彩、布局和 OCR/文本摘要，权限为 `confirm`，不得传输完整页面源码。AI 计划不接受 `active_tab`、current/focused/selected page 等动态哨兵；`active_tab` 只保留给 Browser Assistant 内用户即时点击的 Bridge 层操作。
- **`browser.openDesktopProject`**: 通过 Browser Bridge 调起已连接的本地桌面 IDE，权限为 `confirm`，不得传输完整本地路径。
- **`browser.checkLocalLlm`**: 通过 Browser Bridge 诊断本地 LLM 网关和活跃模型，权限为 `safe`，不得由网页端直接探测并伪造成功。
- **`browser.writeBackDom`**: 回写确认计划中公开 HTTP(S) `target` 对应外部网页 DOM 字段，权限为 `dangerous`，必须二次确认；确认卡显示去除 query/fragment 的目标，执行时禁止解析当前活跃标签页。
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
- If all image downloads fail, the ZIP still contains and returns the real `manifest.json` so the user and the next Agent can inspect failure reasons; the tool reports `retryable_failure` rather than `partial_success`.
- Alias registration is idempotent: if a namespaced tool such as `generation.createBatchJob` already has a real implementation, the legacy alias wrapper does not overwrite it.
- `generation.createBatchJob` passes `idempotencyKey` into `DurableGenerationQueue`; when no key is provided, the queue derives a stable key from `canvasId`, prompt list, and options.
- `DurableGenerationQueue` enforces `maxBatchSize=100`, normalizes concurrency into `1..8` with default `3`, and keeps retry behavior at `3` retries after the initial attempt with `2000ms` backoff.
- `generation.retryJob` exposes `DurableGenerationQueue.retryFailedPrompts(jobId)` as a confirmation-required action for failed batch recovery without resubmitting completed prompts. Relative “recent failed” intent is resolved before persistence and frozen to one Job revision plus retryable Prompt ID set; executable input never re-resolves a latest target.
- `DurableGenerationQueue` records `outputGroup`, each item `promptNodeId`, and completed `nodeIds`; completion handlers can create or update one canvas group per job and reuse it on idempotent resume.
- `canvas.arrangeNodes` supports targeted `nodeIds` layout through `updateNodes`; without `nodeIds` it calls the existing `CanvasContext.arrangeAllNodes(mode)` path.
- `ecommerce.createBatchTransformJob` is registered as a `confirm` tool and maps compact ecommerce folder/image commands to one grouped durable batch job.

## 5. Implementation update - KnowledgeSync projection - 2026-06-03

- `assets.resolveOriginals` is registered as a safe preflight tool. It resolves selected/current image nodes and returns source-kind summaries without downloading files or exposing full URLs.
- `generation.getJobStatus` is registered as a safe read tool for `DurableGenerationQueue` status summaries.
- `knowledge.searchProject` searches baseline assistant docs plus runtime projection records.
- `knowledge.recordChange` records sanitized change summaries, touched paths, affected modules, tools, validation, deprecated behavior, and next-Agent instructions.
- `ui.recordLayoutChange` records selector or layout changes that must later be reflected in `docs/ai-assistant/ui-map.md`, then synchronizes the sanitized UI Knowledge record through the typed KK API client.
- `skills.upsertSkill` records sanitized project Skill / Runbook projections.
- These three projection writes are `confirm`, not `safe`: they persist user-owned records and do not expose a guaranteed undo operation. Autonomous `safe` mutations are restricted to declared reversible local operations.
- Runtime implementation: `apps/web/src/features/ai-assistant-runtime/knowledge/KnowledgeStore.ts`.
- Storage note: browser `localStorage` is only a projection/cache, not long-term authoritative storage. It stores redacted summaries only.
- Safety note: ToolRegistry execution console logs now emit the redacted `inputSummary` rather than raw tool input, matching the `AgentToolCallLog` redaction path.

## 6. Implementation update - AI control action surface - 2026-06-22

- AI Takeover UI control buttons use `AGENT_CONTROL_ACTIONS` from `apps/web/src/features/ai-assistant-runtime/runtime/agentControlActions.ts` as the shared action contract.
- Confirmation buttons expose `data-agent-action="confirm-plan|cancel-plan"` plus `data-agent-runtime-action="executePendingRun|cancelPendingRun"` so both `AIAssistantDock` and `ChatSidebar` route pending plans through the same `AgentRuntime` methods.
- Durable generation queue buttons expose `data-agent-action` on both surfaces. Pause, resume, retry, and cancel also expose `data-agent-tool` mapped to `generation.pauseJob`, `generation.resumeJob`, `generation.retryJob`, and `generation.cancelJob`.
- Queue archive and output locate are local UI actions with `toolName: undefined`; they are intentionally not advertised as LLM tools because they do not go through `ToolRegistry`.
- `AIAssistantDock` and `ChatSidebar` now both show retry and locate controls for durable queue jobs, preventing one AI control surface from having a different queue capability set than the other.
- AI Takeover composer and resource controls also use `AGENT_CONTROL_ACTIONS`: context compression, Dock takeover send, image import, folder import, file connect, resource panel toggle/close, and resource removal are local UI actions with stable `data-agent-action` values and no `ToolRegistry` tool name.
- AI Takeover shell controls also use `AGENT_CONTROL_ACTIONS`. `action://` links are never scanned or executed automatically; only an explicit user click may invoke the manual-link path. Autonomous actions must use structured ToolRegistry calls.

## 6.1. Implementation update - trusted execution control plane - 2026-07-15

- `AssistantExecutionContext` is the typed runtime boundary for page, collaboration mode, live canvas/selection getters, `DurableGenerationQueue`, `AgentRunStore`, notifications, cancellation signal and user confirmation grant.
- A confirmation grant is valid only when it is bound to the current `runId`, contains a non-empty exact allowlist for every confirmation-required tool, records `source: 'user'` and includes `grantedAt`; `waiting_confirmation` alone is not authorization and the runtime never expands the allowlist.
- One `runId` has at most one in-flight execution promise. Run cancellation remains reachable from both assistant surfaces while the run is active; handler and asynchronous verifier completion both re-check the abort signal, and abort wins over a late ordinary network rejection. Recovery compensation is an internal ledger operation, not a user grant or reusable ToolRegistry permission: it scans only steps that actually started, matches the exact owner-scoped `DurableGenerationQueue` Job by Run/Step idempotency key, and scans again after the aborted handler settles. Terminal runs ignore stale cancellation requests.
- Mutation verification is fail-closed: a handler result needs structured outcome evidence and plan-level verification still checks fresh queue, canvas or asset state. Asset export requires a real manifest object; boolean placeholders are rejected, and zero successful assets with failed items is retryable failure. `executionOutcome` is execution evidence; a business object `status` such as `failed` or `cancelled` is not interpreted as a tool failure by itself.
- Run/step/tool statuses distinguish cancellation, partial completion, retryable failure and rolled-back failure.
- Agent Run, Tool Call, Knowledge and Skill synchronization use the typed methods on `packages/api-client`; runtime modules do not issue raw AI-backend `fetch` calls.
- Server row mappers keep PostgreSQL `snake_case` private and return the public camelCase DTO, including tool outcome and failure metadata. Run snapshots use monotonic timestamps; failed synchronizations remain marked pending in the owner-scoped `AgentRunStore`, so a reload or later online event can rebuild the ordered retry queue.
- Agent Run history, Knowledge projections and their pending retry queues are owner-scoped in browser storage. Same-owner projection/pending writes first create uniquely named mergeable snapshots and only compact entries observed before their read, so an unseen concurrent tab write survives instead of being lost to whole-object last-writer-wins. Reads merge the baseline and surviving snapshots by monotonic version, deterministic tie-break and record/logical-task tombstones. Async Knowledge/Skill sync failure remains attached to the owner that initiated it even if the active account changes before the request resolves; each retry await re-checks owner and stops the old batch after an account switch. Skill deletion writes the canonical name/ID/version to pending before the network request; duplicate or late failures retain the newest payload, while acknowledgements remove only the exact sent version. The server's `(user_id, skill_key=name)` version gate atomically orders upsert/delete, preserves the canonical row ID on name conflict, rejects ID/name mismatch before deletion, and returns authoritative canonical data for accepted or stale upserts; the browser consumes that response to converge equal-version conflicts without overruling a later local delete/update. Knowledge, Skill and canvas snapshot rows are user-scoped by migration `016_ai_assistant_user_scope.sql`. Only `owner_scope='system'` knowledge is shared read-only; legacy unowned rows remain isolated until explicitly migrated. Temporary user headers and the local admin password fallback require explicit `KKAI_LOCAL_ONLY=true`; `NODE_ENV` omission never grants an owner.
- Tool Call audit logs, Handoff projections and Browser Bridge session selections are also owner-qualified. Runtime Handoff filesystem output is disabled unless a developer explicitly opts in; audit/error text is redacted again at its final persistence boundary.
- Browser Bridge mutations propagate the Registry idempotency key into the command and payload, derive a stable command ID, and coalesce same-key in-page execution; failures remain retryable. Native responses are delivered only to the initiating owner/command subscription and are never broadcast as a raw page-wide event. Browser Assistant clears owner-derived URL, extraction/OCR, Prompt, log, DOM edit and file-path state on account changes, advances an owner epoch and rebuilds its Worker; stale async callbacks cannot update the next owner's UI or canvas.
- Migration 016 transactionally backfills missing `agent_runs.user_id` as `legacy`, so the mandatory upgrade does not depend on migration 015 already being present. VPS deployment builds and validates inputs before stopping every installed managed API unit, fails closed on service-state query errors, applies 016 before the symlink switch, installs the selected release's systemd unit, records the full commit SHA separately from the short release-directory SHA, and refuses to restart the previous schema-incompatible release after any migration attempt with a failed or unknown outcome.

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
- Browser Assistant Connectivity Doctor also executes `browser.getStatus` through `ToolRegistry` on demand and applies the returned snapshot, instead of waiting on a local timer and re-reading stale component state.
- Pipeline run keeps a stable `data-browser-local-action` identity for Browser Assistant UI/audit grouping, and also declares `data-browser-tool="browser.generateExternal"` plus the shared `generate_external` command kind because execution now runs through the Browser Bridge runtime adapter.
- Pipeline run no longer posts a `pipeline` task to the inline Web Worker, no longer emits simulated `pipeline_step` / `pipeline_done` results, and no longer reports Dev Fallback success. `setup_required` and `queued` states are surfaced as real Browser Bridge outcomes, while result cards appear only after a Bridge `success` response includes a usable image URL.
- Sensed clipboard import exposes `data-browser-local-action` plus `data-agent-tool="canvas.createPromptCards"` because it creates a KK Studio Prompt card through the same runtime event bridge as Browser Assistant product/card imports.
- Clipboard capture reads `navigator.clipboard.readText()` from a user gesture instead of injecting a fixed demo product URL; URL content is imported as a prompt-card payload unless the user explicitly asks for Browser Bridge product extraction.
- Screen inspect / design translation buttons declare `data-browser-tool="browser.inspectPage"` plus the shared `inspect_page` command kind and call the Browser Bridge runtime adapter; they no longer use local timers, fixed color palettes, canned OCR text, or Dev Fallback success paths.
- Screen inspect result-to-canvas now exposes `BROWSER_LOCAL_ACTIONS.translateInspectionToCanvas` plus `data-agent-tool="canvas.createPromptCards"` and dispatches the shared canvas prompt-card event instead of showing a success-only toast.
- Desktop IDE launch declares `data-browser-tool="browser.openDesktopProject"` plus the shared `open_desktop_project` command kind and uses Browser Bridge runtime outcomes instead of Dev Fallback success.
- Local LLM gateway diagnostics declare `data-browser-tool="browser.checkLocalLlm"` plus the shared `check_local_llm` command kind and use Browser Bridge runtime outcomes instead of direct browser fetch probes or Dev Fallback success.
- Exported ZIP locate exposes a stable `data-browser-local-action` value with no ToolRegistry tool name because it remains local Browser Assistant UI guidance.
- Browser Assistant session, social-channel, clipboard, WASM, Takeover preview, sample prompt, Playground tab, routing segment, offline plugin guidance, and clipboard dismiss controls now have distinct `BROWSER_LOCAL_ACTIONS` entries so UI audits do not infer behavior from button text or scattered handlers.

## 8. Implementation update - ChatSidebar shell actions - 2026-06-23

- ChatSidebar ordinary chat controls use `CHAT_SHELL_ACTIONS` from `apps/web/src/features/ai-assistant-runtime/runtime/chatShellActions.ts` as their shared local action contract.
- `CHAT_SHELL_ACTIONS` covers sidebar open/close, current-session controls, history panel controls, session tree actions, context menu actions, message edit/regenerate/branch/copy controls, attachment removal, attachment menu open, Agent mode toggle, stop generation, composer send, and session import preview decisions.
- Chat shell actions expose `data-chat-shell-action`; they intentionally do not expose `data-agent-action` or `data-agent-tool` unless a future ToolRegistry-backed chat action is added.
- The shared ChatSidebar composer send button now exposes `data-chat-shell-action={CHAT_SHELL_ACTIONS.sendComposerMessage.uiAction}`. `AGENT_CONTROL_ACTIONS.sendTakeoverMessage` remains scoped to the AI Takeover Dock so ordinary chat send and takeover send do not collapse into one audit identity.
- `CHAT_SHELL_ACTIONS` entries keep `toolName: undefined` because they are station-local UI operations, not LLM-callable ToolRegistry tools.

## 9. Implementation update - Prompt composer shell actions - 2026-06-23

- PromptBar and extracted prompt-bar controls use `PROMPT_COMPOSER_ACTIONS` from `apps/web/src/features/ai-assistant-runtime/runtime/promptComposerActions.ts` as the shared local action contract for generation composer controls.
- `PROMPT_COMPOSER_ACTIONS` covers mobile composer expansion, model library open, model selection, mode switching, advanced option reveal, prompt optimization toggle, optimizer archetype selection, PPT outline toggle, and generation submission.
- Prompt composer controls expose `data-prompt-composer-action`. They do not borrow `data-agent-action` or `data-chat-shell-action`, keeping generation composer actions separate from AI Takeover and ordinary ChatSidebar actions.
- Every native `PromptBar.tsx` button now carries a prompt composer action marker. `toggleParallelCountMenu` identifies opening/closing the count picker, while `selectParallelCount` identifies choosing a count.
- `submitGeneration` is the only Prompt composer action that exposes a ToolRegistry mapping: `data-agent-tool="generation.submitComposer"`. The other entries keep `toolName: undefined` because they only update local composer UI state.
- `generation.submitComposer` remains the compatibility runtime tool for a user-triggered submission of the current canvas generation composer. AI-controlled single and batch generation uses `generation.createBatchJob` (or the explicit video/audio job tools) and must not simulate PromptBar clicks.

## 10. Implementation update - AI Management action and Skill tool catalog - 2026-06-23

- AI Management settings controls use `AI_MANAGEMENT_ACTIONS` from `apps/web/src/features/ai-assistant-runtime/runtime/aiManagementActions.ts` as their shared local action contract.
- `AI_MANAGEMENT_ACTIONS` covers capability/Skill tab switching, capability settings expansion, temperature preset buttons, Skill create/edit/delete, Skill tool checkbox toggles, and Skill modal close/cancel/save buttons.
- AI Management controls expose `data-ai-management-action`; they intentionally keep `toolName: undefined` because they mutate settings or local Skill records rather than executing an LLM-callable ToolRegistry action directly.
- AI Management reads `CapabilityRouteAssignment` summaries but no longer writes provider/model route assignments. `AI_MANAGEMENT_ACTIONS.openCapabilityRoutes` deep-links users to `/settings/api-management`, which remains the owner for capability route changes.
- The Skill authorized-tool picker now uses `AI_MANAGEMENT_SKILL_TOOL_OPTIONS`, a canonical projection of registered ToolRegistry tools. It excludes forbidden tools and legacy aliases such as `fillPrompt`, `zipOutputs`, `startBatchGeneration`, and `submitPromptComposer`.
- The obsolete `canvas.createImageCards` option was removed from AI Management because it is not a registered ToolRegistry tool. Image/card creation flows should use existing registered tools such as `canvas.createPromptCards` plus runtime image node attachment where applicable.

## 11. Implementation update - API Management local action catalog - 2026-06-23

- API Management settings controls use `API_MANAGEMENT_ACTIONS` from `apps/web/src/components/settings/apiManagementActions.ts` as their shared local action contract.
- These actions are settings-surface metadata only. They must not be advertised as LLM-callable ToolRegistry tools unless a future command intentionally routes through `ToolRegistry`.
- Raw API Management buttons expose `data-api-management-action`; shared settings primitives expose `data-settings-control-action` through the `controlAction` prop.

## 12. Implementation update - Settings module local action catalogs - 2026-06-23

- Dashboard, Storage Settings, System Logs, Project Manager, and the desktop settings shell use `SETTINGS_DASHBOARD_ACTIONS`, `STORAGE_SETTINGS_ACTIONS`, `SYSTEM_LOGS_ACTIONS`, `PROJECT_MANAGER_ACTIONS`, and `SETTINGS_SHELL_ACTIONS` from `apps/web/src/components/settings/settingsModuleActions.ts`.
- These catalogs keep settings-page controls separated by module: dashboard navigation exposes `data-settings-dashboard-action`, storage maintenance exposes `data-storage-settings-action`, system log controls expose `data-system-logs-action`, project controls expose `data-project-manager-action`, and settings shell controls expose `data-settings-shell-action`.
- Shared settings primitives, including segmented controls, expose `data-settings-control-action` through `controlAction` when a control is rendered by a reusable primitive instead of a module-owned raw button.
- These settings-module actions are local UI metadata, not LLM-callable ToolRegistry tools. AI plans should use existing runtime tools such as `ui.openSettings` for route navigation, or a future explicit settings executor, rather than simulating arbitrary button clicks.
- API Management remains the sole owner for provider/model capability route writes. AI Management links to `/settings/api-management` instead of writing `CapabilityRouteAssignment`.
