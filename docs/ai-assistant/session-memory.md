# 会话记忆规约 (Session Memory)

AI 助手通过会话上下文及运行态保持连续的任务处理能力。中断恢复与会话克隆需严格遵循此记忆流转标准。

## 1. 记忆层级

1. **短期记忆 (Short-term Memory)**:
   - 包含当前会话消息队列 (`messages`，最大 30 条)。
   - 当前画布实时运行态 `CanvasRuntimeState`。
   - 当前协作模式 `direct | assist | takeover`，用于决定输入路由和确认语义，不复制会话内容。
2. **长期记忆 (Long-term Memory)**:
   - 已执行成功的 `agent_runs` 历史日志及对应工具调用记录 `agent_tool_calls`。
   - 固化的自定义 Skill 习惯偏好 (Upserted Skills)。

## 2. 中断恢复与克隆协议

- **会话分支克隆**: 用户选择“复制分支”时，复制完整的消息记录、连结的资产 ID、和当前的生成参数配置。
- **持久化任务恢复**: 生图队列在底层以 localStorage/IndexedDB 缓存持久化。当页面刷新或断线重连时，`useTaskRecovery` 自动从缓存中提取 pending 任务进行状态恢复，并通知 AI 接管引擎更新相应卡片。
- **会话界面关闭**: 折叠或关闭聊天侧栏只释放临时 UI 引用，不得清空 `AgentRunStore`、`DurableGenerationQueue` 或已持久化的协作模式。敏感凭证仍不得写入这些存储。
- **Agent Handoff**: 当开发中断时，将已完成步骤和未完成步骤归档至 `docs/development/session-handoff.md`。

## 2.1 三态模式与 Pending Run 恢复 - 2026-07-15

- 唯一协作模式存放在 `kk_assistant_collaboration_mode_v1`。Provider 首次挂载时读取并规范化该值；无效或缺失值回退到 `direct`。
- 同一浏览器的 storage 事件可以同步模式变化，但模式切换不复制消息、不创建新画布，也不重置当前选区。
- `direct`、`assist`、`takeover` 共享同一个 `CanvasContext`、`DurableGenerationQueue` 和 `AgentRunStore`。模式是交互策略，不是三套数据仓库。
- Provider 挂载时调用 `AgentRunStore.getPendingRun()` 恢复仍有效的 pending run，并重新投影确认卡片和运行时间线。恢复 pending 状态不等于用户已确认，也不得产生重复 run。
- AI 辅助的可执行计划以 `waiting_confirmation` 语义保存；AI 接管也必须保留 PermissionPolicy 判定后的确认边界。用户切回直接操作后，pending run 仍存在，但不会在后台因模式切换获得额外授权。
- `DurableGenerationQueue` 独立持久化批量任务并负责恢复、重试与幂等；AgentRun 记录任务编排和工具审计，两者通过 run/job 标识关联，不互相替代。

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

## 8. Production Runtime Follow-up - 2026-06-06

- DurableGenerationQueue public reads are snapshot-only. `getJobs()`, `getJob()`, and subscribers return cloned job data; do not mutate those objects and expect queue state to change. Queue internals mutate through private state-machine paths.
- `latest_batch` image resolution in `resolveImageNodesForDownload` is a single-pass fixed-window scan for the newest four images. Keep this O(n) / O(1) behavior; do not restore full-array sorting for this hot path.
- InfiniteCanvas caches its container rect and refreshes it via `ResizeObserver` / window resize. High-frequency pointer glow logic should reuse that cached rect instead of calling `getBoundingClientRect()` every mousemove.
- Dependency security baseline after this pass: React Router packages are aligned on `7.17.0`, `pdfjs-dist` is `6.0.227`, and production audit is clean with `npm audit --omit=dev --audit-level=moderate`.

## 9. Production Startup Bundle Follow-up - 2026-06-06

- Startup HTML fallback copy is now stable and mojibake-free. Keep inline startup scripts ASCII-safe; user-facing Chinese fallback text can use Unicode escapes.
- `AppGlobalModals` should keep settings, lightbox, PPT preview/editor, profile, storage, search, recharge, Markdown import, and Mermaid import behind `lazyWithRetry` / `lazyNamedWithRetry` boundaries.
- `LoginScreen` should not statically import the animated shader, WeChat QR modal, Google OAuth module, or WeChat auth module. Load them only when the idle shader reveal, QR login, or OAuth action is invoked.
- `GlobalLightbox` and `MobileResultDetailScreen` should load `RedrawWorkspace` lazily when the user opens redraw; do not restore a static `RedrawWorkspace` import.
- Vite manual chunks should not force deferred modal/settings modules into entry chunks. Preserve `DEFERRED_HTML_MODULE_PRELOAD_PREFIXES` coverage for modal/settings/shader/import-tool chunks so HTML preload stays focused on the real workspace shell.
- Verified final production HTML no longer modulepreloads `RechargeModal`, `SettingsPanel`, `GlobalLightbox`, `WechatQrModal`, `RedrawWorkspace`, `animated-shader-background`, `three-vendor`, Markdown import, Mermaid import, or admin/settings lazy chunks.
- Remaining bundle debt: `vendor`, `canvas-core`, `workspace-layout`, and `index.css` are still large. A deeper app-shell split should be treated as a separate OpenSpec-level architecture change.

## 10. Admin Recharge Lazy Gate - 2026-06-06

- `AuthenticatedAppShell` must not statically import `AdminRechargeFloatingPanel`. Keep it behind `lazyWithRetry(() => import('../components/admin/AdminRechargeFloatingPanel'))`.
- `AdminRechargeFloatingPanelGate` is the role boundary. It checks `useAdminRole()` and only loads the admin panel when `isAdmin && adminSessionActive`.
- `AdminRechargeFloatingPanel` is now an enabled-only surface. It receives `enabled`, does not import `useAdminRole`, and starts its polling timers only when enabled.
- Production build expectation: `AdminRechargeFloatingPanel-*.js` and `rechargeSubmissionService-*.js` may exist as dynamic chunks, but neither should appear in `apps/web/dist/index.html` modulepreload links.

## 11. Native KK UI Bridge - 2026-06-06

- `@kk/ui/web` is now the lightweight native UI bridge. Do not reintroduce `@lobehub/ui` or AntD wrappers in `packages/ui/src/web`.
- `KkUIProvider` applies document-level KK theme variables without a third-party provider. It should remain layout-neutral and return only its children.
- `KkModal`, `KkButton`, `KkInput`, `KkSelect`, and `KkDropdown` are native React/CSS adapters. Keep compatibility local to these wrappers instead of importing large UI libraries.
- `@lobehub/ui` and `antd` have been removed from direct production dependencies. `npm ls @lobehub/ui antd --all` should stay empty.
- `check-ui-import-boundaries.mjs` now forbids direct `@lobehub/ui` and `antd` imports in app/package source. Architecture checks should catch regressions before build.
- Production build expectation: no `antd-vendor` chunk and no `antd-vendor` modulepreload entry. The remaining large bundle debt is `vendor`, `canvas-core`, `workspace-layout`, model/provider/image workbench chunks, and `index.css`.
- Dev dependency security baseline after this pass: `apps/web` Vitest is on the safe `4.1.x` line and full `npm audit --audit-level=moderate` reports zero vulnerabilities.

## 12. Turnstile On-Demand Loading - 2026-06-06

- `apps/web/index.html` must not eagerly preconnect to or load `https://challenges.cloudflare.com`. Ordinary workspace startup should avoid third-party Turnstile network work.
- `TurnstileWidget.ensureTurnstileScript()` is the only Turnstile script owner. It injects Cloudflare DNS prefetch/preconnect hints immediately before creating the Turnstile script.
- Keep the contract test in `tests/unit/login-screen-auth-actions.test.ts` that asserts `index.html` has no Cloudflare Turnstile URL and that `TurnstileWidget` owns the loader.
- Production build expectation: `apps/web/dist/index.html` should not contain `challenges.cloudflare.com` or `data-turnstile-script`.

## 13. Startup Font Network Removal - 2026-06-06

- `apps/web/index.html` must not load Google Fonts or preconnect to `fonts.googleapis.com` / `fonts.gstatic.com`.
- The static startup shell should use native system fonts only: `HarmonyOS Sans SC`, Apple system fonts, `Segoe UI`, `system-ui`, and `sans-serif`.
- Keep the contract test in `tests/unit/tailwind-utility-cascade-contract.test.ts` that blocks `fonts.googleapis.com`, `fonts.gstatic.com`, and `family=Inter` from returning to `index.html`.
- Production build expectation: `apps/web/dist/index.html` should not contain Google Fonts, Cloudflare Turnstile, or other explicit third-party startup URLs.

## 14. Lobe Icon Dependency Pruning - 2026-06-06

- `@lobehub/icons` and `@lobehub/fluent-emoji` are no longer production dependencies. Keep `npm ls @lobehub/icons @lobehub/fluent-emoji @lobehub/ui antd --all` empty.
- `apps/web/src/utils/lobeIconCdn.ts` may continue to generate Lobe static icon CDN URLs. Do not replace that helper with npm package imports.
- `scripts/architecture/check-ui-import-boundaries.mjs` blocks direct imports of `@lobehub/ui`, `@lobehub/icons`, `@lobehub/fluent-emoji`, and `antd`, including side-effect and dynamic imports.
- Production build expectation after this pass remains 4398 transformed modules; the benefit is lower install/audit/supply-chain surface rather than a smaller runtime chunk.
- Remaining production bundle debt is `vendor`, `canvas-core`, `workspace-layout`, and `index.css`.

## 15. Login Screen Lazy Split - 2026-06-06

- `AuthenticatedAppShell` must not statically import `LoginScreen`. Keep it behind `lazyWithRetry(() => import('../components/auth/LoginScreen'))`.
- Only render the lazy login chunk when `shouldShowLoginForAuthGate({ user, session, isTempUser })` is true.
- Use `AppStartupScreen` as the signed-out fallback while the login chunk loads so auth users keep visible feedback under slow networks.
- Keep the contract in `tests/unit/workspace-auth-gate.test.ts` that blocks static `LoginScreen` imports and asserts the lazy Suspense branch.
- Production build expectation: `LoginScreen-*.js` and `LoginScreen-*.css` are dynamic assets, and `apps/web/dist/index.html` must not modulepreload either one.
- Observed after this pass: main `index` chunk is about 471.51 KB / 134.98 KB gzip, and main CSS is about 592.60 KB / 87.42 KB gzip.

## 16. Admin Role Startup Probe Removal - 2026-06-06

- `AuthenticatedAppShell` must not import or call `useAdminRole`; ordinary workspace startup should not issue admin access probes.
- Admin recharge probing lives in `apps/web/src/components/admin/AdminRechargeFloatingPanelGate.tsx`, loaded only from the `KKAI_FEATURE_FLAGS.admin` branch.
- `AdminRechargeFloatingPanelGate` may call `useAdminRole` and then lazily load `AdminRechargeFloatingPanel` for active admin sessions.
- `MobileWorkspaceSurface` must not call `useAdminRole` for the header badge. `MobileHeader` has a local `userRole = 'user'` default; role-specific data should be fetched only in profile/settings/admin surfaces that actually need it.
- Keep the contracts in `tests/unit/kkai-billing-ui-surface.test.ts` that block shell/mobile static admin hook usage and verify the dynamic admin gate.
- Production build expectation: `apps/web/dist/index.html` should not modulepreload `useAdminRole`, `AdminRechargeFloatingPanelGate`, `AdminRechargeFloatingPanel`, or `LoginScreen`.
- Observed after this pass: built HTML is about 5.80 KB / 2.10 KB gzip and main `index` chunk is about 471.35 KB / 134.93 KB gzip.

## 17. LLM Execution Deferral And Chat Sidebar Boundary - 2026-06-06

- `WorkspaceSurfacePanels` owns the lazy `ChatSidebar` boundary. Keep `ChatSidebar` behind `lazyWithRetry(() => import('../layout/ChatSidebar'))` and render it only when `WorkspacePanels.activePanel === 'chat'`.
- `App.tsx` should keep stable dynamic wrappers for generation execution modules: `geminiService`, `LLMService`, `ecommerceAnalysisClient`, and `secureModelProxy`. Do not restore top-level value imports for these execution paths.
- `optimizeGenerationPrompt` should dynamically import `promptOptimizerService` only when prompt optimization is enabled and a non-empty raw prompt exists. Keep `summarizePromptOptimizationError` local so logging does not pull in the optimizer module during startup.
- `useImageGeneration` may mount on startup for UI state, but provider/media execution modules must stay deferred. Do not restore static imports of `LLMService`, `geminiService`, `partialRedraw`, or `secureModelProxy`.
- `PromptBar` may render on startup, but PPT AI outline actions must call `chatWithLlm`, which dynamically imports `LLMService` only after the user invokes outline generation or refinement.
- `useTaskRecovery` may run startup recovery bookkeeping, but LLM batch status preflight must use the dynamic `checkTaskStatuses` wrapper.
- Guard tests:
  - `tests/unit/app-shell-panel-layer.test.ts`
  - `tests/unit/app-unused-cleanup-contract.test.ts`
  - `tests/unit/image-generation-unused-cleanup-contract.test.ts`
  - `tests/unit/prompt-bar-llm-lazy-boundary-contract.test.ts`
  - `tests/unit/task-recovery-llm-lazy-boundary-contract.test.ts`
  - `tests/unit/ecommerce-structured-task-source-contract.test.ts`
- Production build expectation: `apps/web/dist/index.html` should not modulepreload `ChatSidebar`, `geminiService`, `ecommerceAnalysisClient`, or `promptOptimizerService`. As of this pass, `provider-adapters` is still preloaded because manual chunk grouping combines LLM provider code with first-screen ecommerce/model helpers; treat full removal as a separate app-shell/ecommerce runtime split.

## 18. Provider Adapter Preload Boundary - 2026-06-06

- Vite manual chunk ownership is now:
  - `model-services`: model/key/provider-strategy helpers, `useImageGeneration`, and `services/llm/syncImageBridge.ts`.
  - `provider-adapters`: real `apps/web/src/services/llm/` provider execution modules only.
  - `ecommerce-services`: `apps/web/src/services/ecommerce/` modules.
- `provider-adapters-` is intentionally listed in `DEFERRED_HTML_MODULE_PRELOAD_PREFIXES`. Production HTML should not preload provider adapters during ordinary workspace startup.
- `MobileEcommercePanel` must not restore static imports of `generateImage` from `geminiService` or `llmService` from `LLMService`; it uses dynamic wrappers so mobile ecommerce planning/generation loads providers only after user action.
- `ecommerceAnalysisEnhancer` must not restore a static `LLMService` import; optional AI enhancement loads chat execution only when invoked.
- Guard test: `tests/unit/vite-manual-chunk-boundary-contract.test.ts`.
- Verified artifact after this pass:
  - `apps/web/dist/index.html` has no `provider-adapters-*.js` modulepreload.
  - `index-*.js` has no static `from "./provider-adapters-*.js"` import.
  - `provider-adapters-*.js` remains a dynamic chunk around 22.30 KB / 6.87 KB gzip.
  - `ecommerce-services-*.js` is separate around 164.63 KB / 49.94 KB gzip.
- Remaining bundle debt: `ecommerce-services` is still statically loaded by workspace/ecommerce UI ownership; split that only after reviewing ecommerce runtime boundaries. `vendor`, `canvas-core`, `workspace-layout`, `image-workbench`, and shared CSS remain larger startup targets.

## 19. Ecommerce And Archive Runtime Boundary - 2026-06-06

- Vite manual chunk ownership is now:
  - `ecommerce-services`: lightweight first-screen ecommerce runtime helpers only.
  - `ecommerce-analysis-tools`: ecommerce upload analysis client and optional AI enhancer wrappers.
  - `ecommerce-document-tools`: local fallback analyzers for xlsx/text/pdf/doc/docx and Nutrient document extraction.
  - `ecommerce-export-tools`: ecommerce group export manifest builder.
  - `zip-vendor`: `jszip`, `pako`, `lie`, and `immediate` runtime code.
- `provider-adapters-`, `ecommerce-analysis-tools-`, `ecommerce-document-tools-`, `ecommerce-export-tools-`, and `zip-vendor-` must stay in `DEFERRED_HTML_MODULE_PRELOAD_PREFIXES`.
- `apps/web/src/utils/archiveRuntime.ts` owns browser archive runtime loading. Export/download features should call `createZipArchive`, `loadFileSaver`, or `saveBlobAs`; do not restore top-level `jszip` or `file-saver` imports in app/components/features.
- `ecommerceAnalysisClient` should keep `/api/ecommerce-analysis` as the normal path. Local xlsx/text/pdf/doc/docx parsing is a fallback path only and must remain dynamically imported.
- `openXmlWorkbookParser` should keep `jszip` behind `loadJSZipRuntime()` inside `parseOpenXmlWorkbook`.
- Guard tests:
  - `tests/unit/vite-manual-chunk-boundary-contract.test.ts`
  - `tests/unit/ecommerce-group-export-runtime-contract.test.ts`
  - `tests/unit/ppt-runtime-contract.test.ts`
  - `tests/unit/zip-selected-originals.test.ts`
  - `tests/unit/ecommerce-xlsx-parser.test.ts`
- Production build expectation after this pass:
  - `apps/web/dist/index.html` must not modulepreload `provider-adapters`, `ecommerce-analysis-tools`, `ecommerce-document-tools`, `ecommerce-export-tools`, or `zip-vendor`.
  - `ecommerce-services-*.js` should stay around 2.35 KB / 0.91 KB gzip and must not contain xlsx parsing, JSZip, analysis client, AI enhancer, or export manifest code.
  - `zip-vendor-*.js` should exist as a dynamic chunk around 95.88 KB / 28.46 KB gzip.
  - Vite should not emit `INEFFECTIVE_DYNAMIC_IMPORT` for `jszip`.
- Remaining bundle debt: `vendor`, `canvas-core`, `workspace-layout`, and shared CSS remain the largest startup targets. Review workspace shell ownership and vendor composition in a separate pass.

## 20. Mermaid Native Topology Boundary - 2026-06-06

- `MermaidRenderer` is still lazy-loaded from `AppGlobalModals`, but it must remain native and must not import the `mermaid` package.
- `apps/web/src/components/mermaid/mermaidTopology.ts` owns:
  - `parseMermaidTopology`
  - `getMermaidDiagramDirection`
  - `layoutMermaidTopology`
  - `buildNativeMermaidPreviewSvg`
- The topology layout is non-recursive O(V + E). Do not restore recursive level assignment in the React component; cyclic graphs must terminate with finite node positions.
- Native SVG preview text is escaped before `dangerouslySetInnerHTML` receives it. Keep `tests/unit/mermaid-topology-runtime.test.ts` covering XSS-style labels and cyclic graphs.
- `apps/web/package.json` and `package-lock.json` should not contain the `mermaid` dependency. `apps/web/vite.config.ts` should not contain `mermaid-vendor`, `MERMAID_VENDOR_PATTERNS`, or `isMermaidVendorModule`.
- Guard tests:
  - `tests/unit/vite-manual-chunk-boundary-contract.test.ts`
  - `tests/unit/mermaid-topology-runtime.test.ts`
- Production build expectation after this pass:
  - No `mermaid-vendor-*.js` asset.
  - `MermaidRenderer-*.js` stays around 8.84 KB / 3.88 KB gzip.
  - `vendor-*.js` stays around 292 KB / 99 KB gzip and contains no Mermaid, KaTeX, Chevrotain, Cytoscape, or Dagre-D3 markers.
  - `apps/web/dist/index.html` must not modulepreload `MermaidRenderer-*.js`.
- Remaining startup debt: `canvas-core`, `workspace-layout`, and shared CSS are now larger than generic `vendor`. The follow-up `ecommerce-document-tools` static import issue is closed in section 21.

## 21. Ecommerce Document Static Import Boundary - 2026-06-06

- `ecommerce-document-tools` must stay a real deferred fallback chunk, not a static entry dependency.
- Vite manual chunk ownership is now:
  - `ecommerce-core`: first-screen ecommerce policy/build helpers (`assetRoleBindings`, `copyResolver`, `ecommerceModelPolicy`, `renderTaskBuilder`, `seriesTemplateExtractor`, `taskMerger`).
  - `ecommerce-normalize-tools`: analysis normalizer and `xlsx/referenceBindingResolver`.
  - `ecommerce-document-tools`: text fallback, OpenXML workbook parser, and Nutrient document extraction.
- `ecommerce-normalize-tools-`, `ecommerce-document-tools-`, `ecommerce-analysis-tools-`, `ecommerce-export-tools-`, `provider-adapters-`, and `zip-vendor-` must stay in `DEFERRED_HTML_MODULE_PRELOAD_PREFIXES`.
- Guard test: `tests/unit/vite-manual-chunk-boundary-contract.test.ts`.
- Production build expectation after this pass:
  - `apps/web/dist/index.html` may modulepreload `ecommerce-core-*.js`.
  - `apps/web/dist/index.html` must not modulepreload `ecommerce-document-tools-*.js` or `ecommerce-normalize-tools-*.js`.
  - Built `index-*.js` must not contain `ecommerce-document-tools` or `ecommerce-normalize-tools`.
  - `ecommerce-core-*.js` should be around 25.59 KB / 8.80 KB gzip.
  - `ecommerce-normalize-tools-*.js` should be around 15.64 KB / 5.11 KB gzip.
  - `ecommerce-document-tools-*.js` should be around 19.53 KB / 7.54 KB gzip.
- Remaining startup debt: `canvas-core`, `workspace-layout`, shared CSS, and `model-services` are the next largest first-screen targets.

## 22. Chat Sidebar True Lazy Boundary - 2026-06-06

- `ChatSidebar` must stay a natural `React.lazy(() => import('../layout/ChatSidebar'))` boundary. Do not add a manual `chat-sidebar` chunk to `APP_MANUAL_CHUNK_GROUPS`; that can pin shared model/UI exports to the lazy chunk and make the main entry statically import it.
- `ChatSidebar.tsx` must not restore top-level value imports from `../../services/llm/geminiService` or `../../services/llm/LLMService`.
- Chat execution inside `ChatSidebar` uses `chatWithLlm`, and image generation uses `generateImageOnDemand`; both dynamically import provider execution only when the user triggers chat planning, context compression, QA, retry, or image generation.
- Guard test: `tests/unit/vite-manual-chunk-boundary-contract.test.ts`.
- Production build expectation after this pass:
  - `apps/web/dist/index.html` must not modulepreload `ChatSidebar-*.js`.
  - Built `index-*.js` may contain a dynamic import string for `ChatSidebar-*.js`, but must not contain a static `from "./ChatSidebar-*.js"` import.
  - Built `index-*.js` must not statically import `provider-adapters`, `ecommerce-document-tools`, `ecommerce-normalize-tools`, `zip-vendor`, or `MermaidRenderer`.
  - `ChatSidebar-*.js` should be around 196.67 KB / 62.88 KB gzip, `workspace-layout-*.js` around 216.24 KB / 59.20 KB gzip, and `model-services-*.js` around 59.28 KB / 17.10 KB gzip.
- Remaining startup debt: `canvas-core`, `index.css`, and main `index-*.js` are the largest first-screen targets.

## 23. Canvas Runtime Execution Deferral - 2026-06-06

- Do not add an `ai-takeover-runtime` manual chunk for `features/ai-takeover` or `features/ai-assistant-runtime`. That approach can make the main entry statically import the supposedly lazy assistant runtime.
- AI takeover is currently reached through lazy `ChatSidebar`; keep provider execution behind dynamic wrappers:
  - `AITakeoverContext.tsx` uses `chatWithLlm`.
  - `llmBrain.ts` uses `chatWithLlm`.
  - `ChatSidebar.tsx` uses `chatWithLlm` and `generateImageOnDemand`.
- `EcommerceTaskEditorPanel` must not restore a top-level `optimizePromptForImage` import. It dynamically imports `../../services/llm/promptOptimizerService` only when the user invokes prompt optimization.
- `CanvasContext` and `useCanvasCloudSync` must not restore top-level `syncService` imports. Cloud layout loading/saving dynamically imports `../services/system/syncService` only when cloud sync is enabled.
- Guard tests:
  - `tests/unit/vite-manual-chunk-boundary-contract.test.ts`
  - `tests/unit/canvas-cloud-sync-signature.test.ts`
- Production build expectation after this pass:
  - `apps/web/dist/index.html` must not modulepreload `ChatSidebar`, `provider-adapters`, `syncService`, `LLMService`, `promptOptimizerService`, or `secureModelProxy`.
  - Built `index-*.js` may include dynamic import dependency maps for lazy modules, but must not have static `from "./ChatSidebar-*.js"` or static provider/sync/optimizer imports.
  - Static import graph from `CanvasContext` and `components/canvas` should not reach `LLMService`, `promptOptimizerService`, `secureModelProxy`, or `syncService`.
  - `canvas-core-*.js` is currently about 682.61 KB / 200.47 KB gzip after removing the optimizer/proxy/sync static paths.
- Remaining startup debt: `canvas-core` is still the largest app-owned JS chunk; next review should focus on canvas UI/runtime ownership and whether auth/session runtime can be split without weakening startup correctness.

## 24. Ecommerce Workbench Lazy Boundary - 2026-06-06

- `PromptNodeComponent` must not restore a static default import from `../ecommerce/EcommerceCanvasWorkbenchCard`.
- The ecommerce framework workbench is reached through:
  - `const EcommerceCanvasWorkbenchCard = React.lazy(() => import('../ecommerce/EcommerceCanvasWorkbenchCard'));`
  - a local `React.Suspense` wrapper around the framework-card branch only.
- Guard test: `tests/unit/prompt-bar-ecommerce-framework-companion.test.ts`.
- Production build expectation after this pass:
  - `apps/web/dist/assets/EcommerceCanvasWorkbenchCard-*.js` should exist as a separate deferred chunk around 13.75 KB / 4.06 KB gzip.
  - `apps/web/dist/index.html` must not modulepreload `EcommerceCanvasWorkbenchCard`, `ChatSidebar`, `LLMService`, `promptOptimizerService`, `syncService`, `secureModelProxy`, `provider-adapters`, ecommerce document/normalizer chunks, or `mermaid-vendor`.
  - Built `index-*.js` must not have a static import from `EcommerceCanvasWorkbenchCard-*.js`.
  - `canvas-core-*.js` is currently about 655.41 KB / 194.41 KB gzip after removing the ecommerce workbench static path.
- Remaining startup debt: `canvas-core`, `workspace-layout`, shared CSS, and main `index-*.js` remain large. The next pass should target canvas/workspace ownership boundaries and CSS splitting, with extra care around existing local edits in `PromptNodeComponent.tsx`.
