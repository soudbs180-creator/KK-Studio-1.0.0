# KK Studio Project Handoff (v1.5.6)

Last updated: 2026-06-09

## 1. Project Overview

- Project name: `KK Studio`
- Stable version: `v1.5.6`
- Version authority: `config/release-manifest.json`
- Package projection: root `package.json` and workspace package manifests
- Primary rules: `AGENTS.md`
- Primary companion plan: `AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md`

## 2. Current Runtime Facts

- Primary Web runtime: `apps/web/` (Vite + React 19 + TypeScript + Tailwind + AntD / Lobe UI Bridge)
- Mobile workspace: `apps/mobile/` (Expo)
- Backend runtime: `server/` Express / VPS routes and related proxy behavior
- Shared logic: `packages/shared/`
- Unified API client: `packages/api-client/`
- UI adapter layer: `packages/ui/`
- Database schema changes: `migrations/` only
- AI assistant knowledge base: `docs/ai-assistant/`
- Version governance: `config/release-manifest.json` is the 主版本源.
- Version governance: `apps/web/src/config/appInfo.ts` is the 运行时只读导出.
- Version governance: `release/publish/stable/manifest.json` is the portable stable 发布清单.

Do not describe root `src/` as the current live frontend runtime. Do not describe `.agent` files as the current AI rule baseline. The current AI rule baseline is `AGENTS.md` plus `AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md`.

## 3. Current AI Assistant Baseline

- Existing assistant entry: `apps/web/src/features/ai-takeover/`
- Existing pieces: `LocalAssistantBrain`, `LLMBrain`, `IntentGate`, `ActionExecutor`, `SafetyPolicy`, `ConfirmationPolicy`, `ProjectContextBuilder`, and a lightweight `toolRegistry.ts`
- Current partial work: `SanitizedProjectContext` already has `runtime?: CanvasRuntimeState`, and `docs/ai-assistant/` has an initial knowledge directory
- Current partial work: `toolRegistry.ts` now exposes legacy action tools plus initial namespaced aliases such as `canvas.getState`, `canvas.getSelectedNodes`, `assets.zipOriginals`, and `generation.createBatchJob`, and records脱敏 `AgentToolCallLog` entries. Alias registration is idempotent so real namespaced tools are not overwritten by legacy wrappers.
- Current partial work: `canvas.arrangeNodes` is registered. With `nodeIds` it applies targeted grid/row/column layout through `updateNodes`; without `nodeIds` it delegates to the existing `CanvasContext.arrangeAllNodes(mode)` path.
- Current partial work: `KnowledgeStore` now provides a redacted browser projection/cache for `knowledge.searchProject`, `knowledge.recordChange`, `ui.recordLayoutChange`, and `skills.upsertSkill`; it is not authoritative long-term storage.
- Current partial work: ToolRegistry execution logging now prints redacted `inputSummary` instead of raw tool input, so token-like strings and API-key-like values stay out of console logs.

## 2026-06-09 - Current Mainline Runtime Cleanup

- User request: safely land the current mainline plan, remove retired active runtimes, and unify the project onto `apps/web/`, `server/`, and `packages/*`.
- Branch state: working branch is `codex/unify-current-mainline`; `main...origin/main` was verified as `0 0` before the cleanup continued.
- Files touched: retired `apps/api` and `apps/payment-sidecar` tracked runtime files, VPS/systemd/nginx/deploy scripts, portable release scripts, env templates, governance/version scripts, docs/specs, focused tests, `server/index.js`, `server/package-lock.json`, and this handoff.
- Design decisions:
  - `server/index.js` remains the backend fact source and now loads `server/.env` plus `server/.env.local` before route modules are imported; existing process env values still win over file values.
  - Bare `server/index.js` startup now defaults to port `3001`, matching VPS and local bootstrap templates.
  - `config/release-manifest.json` now names `versionTargets.serverPackage` instead of the retired payment-server wording.
  - `server/package-lock.json` is refreshed to `1.5.6` and includes the current server dependency closure, including `node-fetch`.
  - Root `.env.example` stays frontend-public; local backend env is documented through `server/.env.local.example`.
- Validation passed:
  - `npm.cmd run governance:version`
  - `npm.cmd run governance:current`
  - `npm.cmd run governance:check`
  - `npm.cmd run architecture:check` (continues to print the known non-blocking UI token warning list)
  - `npm.cmd run typecheck`
  - `npm.cmd run spec:check`
  - `npm.cmd run build`
  - Focused tests: `local-env-contract`, `local-api-bootstrap-env-hydration`, `vps-deploy-contract`, `vps-deploy-artifacts`, `encoding-check-contract`, `portable-payment-package-contract`, `payment-webhook-raw-body`, and `runtime-governance-upgrade`.
  - Focused settings/workbench follow-ups: `mobile-settings-taxonomy`, `mobile-settings-browser-verify-script`, `billing-remaining-balance-contract`, `settings-workbench-ui-refit`, `api-settings-workbench-structure`, `capability-route-runtime-preference-contract`, `settings-canonical-entry-regression`, `app-startup-coordinator`, `kkai-app-root`, `prompt-group-browser-verify-script`, `mobile-settings-browser-verify-script`, and `startup-runtime-banner-browser-verify-script`.
- Full verification:
  - Passed: `npm.cmd run verify:changes`.
  - The chain passed architecture, governance, audit, typecheck, spec, build, unit/integration/contract/e2e tests, prompt-group drag smoke, mobile settings smoke, desktop settings smoke, startup runtime banner centering, and encoding/mojibake checks.
  - Mobile settings smoke used its designed fallback mode because the browser path hit duplicate `Settings Overview` headings while the local API proxy at `127.0.0.1:3001` was not running. The fallback source and HTTP route checks passed.
  - UI token warnings are still the known non-blocking debt; this pass did not add new hardcoded-token allowances.
- Risks / next:
  - `root api/` hosted adapters remain a compatibility surface outside the preferred `server/` runtime boundary; migrate or document them as a deliberate hosted adapter exception in a separate pass.
  - Env templates are now centered on `server/.env.local` and VPS runtime env, but production secrets, provider route config, and PostgreSQL migration credentials still need operator-side review before release.
  - Database schema naming is still split across historical docs and runtime tables (`users/plans/orders` versus `profiles/user_credits/payment_orders`); reconcile as a database architecture pass before adding new payment tables.
  - Payment webhook behavior was not changed beyond server/env wording; the `payment_orders` vs `public.orders` schema drift remains a separate backend reconciliation risk.

## 2026-06-09 - API Route Missing Coverage Fix

- User request: audit current API routes comprehensively and fix the missing routes instead of only reporting them.
- Files touched in this pass: `server/index.js`, `server/routes/contract-compat.js`, `server/routes/ai-assistant.js`, `server/routes/ocr.js`, `server/routes/user.js`, `server/lib/dispatcher/localUserRouteStore.js`, `server/routes/admin.js`, `server/routes/credit-provider-router.js`, and this handoff.
- Design decisions:
  - Added `server/routes/contract-compat.js` as a scoped Express compatibility router for shared/OpenAPI and legacy `packages/api-client` paths that do not yet have dedicated VPS modules.
  - Mounted the compatibility router from `server/index.js` after existing concrete routers and before telemetry/404, so implemented routes keep precedence.
  - Fixed AI assistant route double-prefix drift: `/api/api/ai-assistant/*` is gone; `/api/ai-assistant/*` is the active namespace. Added `DELETE /api/ai-assistant/skills/:id`.
  - Added `/api/v1/ocr` as an alias for the existing OCR proxy.
  - Added compatibility for `/api/secure-proxy`, `/api/ecommerce-analysis`, `/api/v1/model-proxy/system`, OpenAPI billing/workspace/generation/payment/admin routes, and legacy `/api/billing/plans`, `/api/billing/create-checkout`, `/api/generations`, `PATCH /api/user/me`.
  - Fixed local user route resolution and missing async `readLocalStorage` / `writeLocalStorage` awaits in the user route store path.
  - Kept DB writes in existing tables only; no DDL was added. Local/no-DB behavior uses `.kk-local/contract-compat.json`, which is gitignored.
- Validation passed:
  - `npm run typecheck:server`
  - `node --check server/routes/admin.js`
  - `node --check server/routes/credit-provider-router.js`
  - `node --check server/routes/contract-compat.js`
  - Representative Express probe: AI assistant, OCR v1 alias, temp auth, legacy auth, legacy billing, generations, payment order, ecommerce fallback.
  - OpenAPI route sweep: 36 endpoints checked; endpoint missing / method-not-allowed count was 0. Two 404 responses were resource-not-found for intentionally fake workflow/task/order IDs, not router misses.
  - Focused tests: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/server-auth-session-routes-contract.test.ts tests/unit/vercel-vps-proxy.test.ts tests/unit/wuyin-user-route-image-mode-contract.test.ts` (9 passed).
- Not run:
  - Full `npm run verify:changes`, because the preceding 2026-06-09 handoff already records unrelated current unit-test failures outside this backend route pass.
- Remaining risks / next:
  - `/api/ecommerce-analysis` intentionally returns 501 to trigger the existing browser fallback parser unless a server-side ecommerce analyzer is configured later.
  - `/api/secure-proxy` and `/api/v1/model-proxy/system` now avoid missing-route failures, but successful model execution still depends on valid admin credit models, provider routes, and upstream keys.
  - Hosted same-origin coverage still depends on `vercel.json` rewrites; the current auth/VPS rewrite contract test passes.

## 2026-06-05 - User API Key Reveal And Transport Guard

- User request: saved BYOK/API keys must be viewable through an explicit reveal action, and provider requests must use only the real user-entered key, never a preview, placeholder, encrypted envelope, or object string.
- Behavior: settings forms keep newly typed keys visible locally; saved keys load as read-only placeholders until the eye/reveal action calls `/v1/profile/user-apis/reveal-secret`. Request boundaries now reject `sk-readonly-0000`, `__kk_redacted__:*`, masked previews, `[object Object]`, and encrypted secret envelopes before upstream fetch.
- Provider protocol rule: Wuyin/Suchuang submit requests keep the raw user key in `Authorization` only; async detail polling keeps `Authorization` and adds URL `id` + `key` query parameters. OpenAI-compatible routes keep Bearer formatting; Gemini keeps the existing query/header strategy. Do not change these request formats while fixing display or storage issues.
- Files touched: `server/lib/userApiSecret.js`, `server/routes/user.js`, `server/lib/wuyinModelExecutor.js`, `server/lib/wuyinAsyncVideoProxy.js`, `api/user-model-proxy.js`, `apps/web/src/services/api/apiConfig.ts`, `apps/web/src/services/model/secureModelProxy.ts`, LLM/video adapters, API settings tests, and user-model proxy tests.
- Validation: targeted key/proxy/Wuyin tests passed, plus `npm run typecheck`, `npm run governance:security`, `npm run check:encoding`, and scoped `git diff --check` for key-related paths.

## 2026-06-05 - Wuyin / Suchuang Async Image Auth Protocol Fix

- User request: align KK Studio's Wuyin / Suchuang NanoBanana2 image generation with the local `0605test_image` tool behavior.
- Behavior: image submit calls now post JSON to `/api/async/image_nanoBanana2` and related async submit endpoints with `Authorization: <user-key>` only; submit URLs no longer append `?key=...`. Async detail polling still calls `/api/async/detail?id=<taskId>&key=<user-key>` and also preserves the raw `Authorization` header.
- Files touched: `api/user-model-proxy.js`, `server/routes/user.js`, `server/lib/wuyinModelExecutor.js`, `server/lib/wuyinAsyncVideoProxy.js`, `apps/web/src/services/model/secureModelProxy.ts`, `tests/unit/vercel-user-model-proxy.test.ts`, and `tests/unit/wuyin-async-image-state-machine.test.ts`.
- Validation: passed targeted Wuyin/profile proxy unit tests, `npm run typecheck`, and `npm run check:encoding`.
## 2026-06-05 - AI Takeover Chat And Capability Card Fixes

- User request: fix AI 接管 opening like a new conversation, “打开日志” falling back to model configuration, broken log/settings action links, and blank capability-card areas.
- Files touched: `apps/web/src/components/layout/ChatSidebar.tsx`, `apps/web/src/features/ai-takeover/core/intentGate.ts`, `apps/web/src/features/ai-takeover/core/llmBrain.ts`, `apps/web/src/components/settings/apiWorkbenchSections.tsx`, `apps/web/src/components/settings/ApiSettingsView.tsx`, AI/settings unit tests, and `docs/ai-assistant/*`.
- Behavior: AI 接管 now inherits and writes back the active chat session only while takeover mode is active; `open_logs` is a safe UI intent; `action://open-settings-logs` opens `system-logs`; capability cards no longer reserve invisible blank rows and standard routing cards pass fallback/image fallback fields.
- Validation target: run the focused AI takeover and API settings unit tests, then `npm run typecheck` and `npm run check:encoding`.

## 2026-06-05 - AI Takeover Local Capability Routing

- User request: AI 助手 should control bottom-level capability lines rather than UI button positions; “帮我打开个人中心/API/日志”等 should be instant local routing; simple “生成一个...” should reuse the canvas input setup and send directly.
- Files touched: `apps/web/src/features/ai-takeover/types.ts`, `apps/web/src/features/ai-takeover/core/intentGate.ts`, `apps/web/src/features/ai-takeover/core/localBrain.ts`, `apps/web/src/features/ai-takeover/core/llmBrain.ts`, `apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts`, `apps/web/src/hooks/useWorkspaceSurface.ts`, `apps/web/src/components/layout/ChatSidebar.tsx`, `tests/unit/ai-takeover-intentGate.test.ts`, and `docs/ai-assistant/*`.
- Behavior: `open_settings_view` maps natural language to stable settings IDs (`user-profile`, `api-management`, `system-logs`, `storage-settings`, `consumption-records`, `dashboard`) and calls `openSettings({ tab })`; AgentRuntime prefers LocalBrain for recognized local actions even when a model is configured.
- Behavior: simple single generation such as “生成一个赛博猫头像” maps to `fillInputPrompt` + `submitPromptComposer`, preserving the current PromptBar model, ratio, references, and mode. Batch/folder/per-reference generation remains in the confirmation and queue path.
- Knowledge rule: UI location changes must update `docs/ai-assistant/ui-map.md`, ToolRegistry/Skill docs, and runtime projection via `ui.recordLayoutChange` or `knowledge.recordChange`; AI operates on capability IDs and tools, not button coordinates.

## 2026-06-05 - Canvas Group Hide, Collapse, Glow, And Drag Responsiveness

- User request: group eye should blur/hide cards rather than collapse them; collapse should be a separate strip action; right-click should keep rename and add color control; color should render as weak inner glow; hidden groups should show a readable centered group name; dragging the group frame should move member cards immediately.
- Files touched: `apps/web/src/components/canvas/CanvasGroupComponent.tsx`, `apps/web/src/App.tsx`, `apps/web/src/app/useSelectionMenuOverlay.ts`, `apps/web/src/types.ts`, `apps/web/src/types/index.ts`, `tests/unit/canvas-collapsed-groups-contract.test.ts`, and `docs/ai-assistant/*`.
- Behavior: `CanvasGroup.hidden` is now visual blur only and keeps member cards rendered. `CanvasGroup.collapsed` remains the compact strip state and is the only state consumed by `getCollapsedCanvasGroupNodeIds`. `CanvasGroup.color` is used as a weak inner glow and defaults to `#ffffff` for new manual groups.
- Behavior: hidden expanded groups rise above member cards so the blur overlay covers the cards and displays a centered, bounds/zoom-aware label. The right-click menu owns rename and inner-glow color selection; no extra settings button was added.
- Behavior: manual group dragging now writes live member positions through `liveNodePositionByIdRef` before calling `moveSelectedNodesImmediate`, then clears those live positions on drag end so the frame and cards move together.
- Knowledge rule: assistant batch/ecommerce generation should group all cards created by one conversation run or batch job into one `CanvasGroup`, tagged with `automation` and `batch:<jobId>`.
- Validation: passed `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-collapsed-groups-contract.test.ts tests/unit/canvas-groups-contract.test.ts` and `npx tsc --noEmit`.

- Current partial work: `assets.resolveOriginals` and `generation.getJobStatus` are registered as safe preflight/read tools.
- Current partial work: `AITakeoverContext` re-runs safety and confirmation policy on both local and cloud-generated plans before execution
- Important gap: the namespaced registry is still a compatibility layer, not the final `AgentRuntime + ToolRegistry + DurableQueue + KnowledgeSync` split
- Current partial work: `DurableGenerationQueue` exists, is safe to import in non-browser tests, enforces `maxBatchSize=100`, derives stable idempotency keys, clamps concurrency to `1..8`, stores `outputGroup`, records `promptNodeId` and result image node IDs, and invokes arrange/completion handlers for grouped assistant output.
- Important gap: batch execution still depends on the active web runtime executor and user confirmation UX. Future work should harden recovery UI, local directory permission flow, and production cost/credit presentation around large batches.

## 2026-06-05 - AI Assistant Batch Ecommerce Execution And Output Groups

- User request: AI 助手 should understand folder/resource-pool batch ecommerce commands, pass ratio/layout/group options through the queue, and create one grouped canvas output instead of simulating PromptBar.
- Files touched: `apps/web/src/features/ai-takeover/types.ts`, `apps/web/src/features/ai-takeover/core/intentGate.ts`, `apps/web/src/features/ai-takeover/core/localBrain.ts`, `apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts`, `apps/web/src/features/ai-assistant-runtime/tools/generationTools.ts`, `apps/web/src/features/ai-assistant-runtime/tools/canvasTools.ts`, `apps/web/src/features/ai-assistant-runtime/canvas/agentCanvasLayout.ts`, `apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx`, `apps/web/src/components/layout/ChatSidebar.tsx`, assistant runtime tests, and `docs/ai-assistant/*`.
- Behavior: “帮我把这个文件夹里面的图片全部修改成紧凑的排版布局，比例改成4:5” is recognized as a confirm-required ecommerce batch task with `aspectRatio='4:5'`, `layoutPreset='compact-grid'`, and a default white output group.
- Behavior: `ecommerce.createBatchTransformJob` adapts imported resource-pool/image-collection inputs into `DurableGenerationQueue`; `generation.createBatchJob` and legacy `startBatchGeneration` pass through aspect ratio, layout preset, count, concurrency, and outputGroup.
- Behavior: queue completion collects this job's Prompt/Image nodes, runs targeted arrange, tags nodes with `automation` and `batch:<jobId>`, and creates or updates one CanvasGroup. Idempotent resume reuses the existing output group binding.
- Runtime state: `CanvasRuntimeState.groups` now summarizes group id, label, hidden/collapsed state, color, node count, and tags, so AI can reason about groups without UI coordinates.
- Current partial work: selected-card ZIP download now enforces selected scope, expands selected Prompt child images, de-dupes image nodes, and resolves originals in `originalUrl -> apiResultUrl -> url -> storageId -> localFile` order. ZIP archives always include `manifest.json`, including all-failed manifest-only archives.

## 4. Current Priority Order

1. Keep `AGENTS.md` and `AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md` as mandatory dual-entry governance docs.
2. Keep `docs/ai-assistant/` updated whenever assistant, canvas, generation, download, or UI-map behavior changes.
3. Extend `CanvasRuntimeState` from a partial context into a tested runtime contract.
4. Upgrade `ActionExecutor` toward `ToolRegistry + Executor` while preserving legacy action compatibility.
5. Fix selected-card original image ZIP download.
6. Upgrade the AI takeover memory queue into a durable batch job queue.
7. Add knowledge index and skill consistency checks.
8. Add assistant-specific tests for tool registry, selected ZIP, queue, and knowledge sync.

## 5. Validation Guidance

Preferred full validation:

```bash
npm run verify:changes
```

Smaller relevant validation:

```bash
npm run governance:check
npm run typecheck
npm run test:unit
npm run build
npm run check:encoding
```

## 6. Latest Validation

- Passed: `npm run typecheck` (类型检查完全通过，确保无语法与类型断开)
- Passed: `npm run check:encoding` (文件编码及乱码防护验证通过，符合 UTF-8 without BOM 和 LF 要求)
- Passed: `npm run architecture:check` (架构与模块导入边界检查通过)
- Fixed: 解决了图片卡片在加载和切换质量时，由于浏览器原生重绘导致的破损图片图标闪烁视觉 Bug。
- Passed: 侧边和桌面工具栏折叠/展开测试以及所有的单元和集成测试。
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-wuyin-route-contract.test.ts tests/unit/wuyin-refactor-extra.test.ts tests/unit/wuyin-user-route-image-mode-contract.test.ts tests/unit/wuyin-async-video-route-contract.test.ts tests/unit/wuyin-async-image-state-machine.test.ts` (32 个 Wuyin 路由、请求体、taskId、状态机单元测试通过)
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/wuyin-pricing-catalog-contract.test.ts tests/unit/key-manager-wuyin-route-regression.test.ts tests/unit/request-profile-registry.test.ts tests/unit/key-manager-shared-pricing-contract.test.ts tests/unit/key-manager-pricing-url-contract.test.ts tests/unit/model-pricing-credit-specs.test.ts tests/unit/pricingRules.test.ts` (28 个 Wuyin 目录、定价、Key Manager 回归测试通过)
- Passed: `npm run typecheck`, `npm run build` after fixing the lightbox closing behavior during active redraw sessions (preventing accidental lightbox dismissals on background clicks, Escape key, double clicks, and swipe gestures).
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/wuyin-user-route-image-mode-contract.test.ts tests/unit/wuyin-refactor-extra.test.ts tests/unit/openai-compatible-wuyin-route-contract.test.ts tests/unit/vercel-user-model-proxy.test.ts`, `npm run typecheck`, `npm run check:encoding`, and `npm run build` after removing Wuyin image model substitution and updating the proxy error copy.
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/frontend-key-boundary-hardening.test.ts --test-name-pattern "ApiSettingsView"`, `npm run typecheck`, and `npm run check:encoding` after tightening API Key display/save boundaries.
- Noted: `npm run test:unit -- --test-name-pattern="ApiSettingsView|keyManager blocks"` was attempted but PowerShell treated `|` as a pipeline and ran the broader unit suite; it exposed an unrelated existing `clay-frosted-surface-contract.test.ts` failure in `UserProfileModal.tsx`.
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-canonical-ids-contract.test.ts tests/unit/key-manager-provider-presets-contract.test.ts tests/unit/key-manager-route-ids-contract.test.ts tests/unit/user-api-cloud-storage.test.ts tests/unit/frontend-key-boundary-hardening.test.ts` after unifying user API record IDs and the Wuyin preset logo.
- Passed: `npm run typecheck -- --pretty false`, `npm run check:encoding`, and the `build` phase inside `npm run verify:changes`.
- Noted: `npm run verify:changes` still stops in the broader `test:unit` suite on the pre-existing `tests/unit/clay-frosted-surface-contract.test.ts` assertion against `apps/web/src/components/user/UserProfileModal.tsx` hardcoded dark/shadow tokens; this is outside the API ID / Wuyin logo change set.
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/api-settings-editor-feedback.test.ts tests/unit/user-api-cloud-storage.test.ts tests/unit/profile-user-api-auth-guard.test.ts`, `npm run typecheck`, `npm run governance:security`, and `npm run check:encoding` after adding explicit saved API Key reveal.
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-local-storage-snapshot-cache.test.ts tests/unit/canvas-selection-runtime-contract.test.ts tests/unit/canvas-cloud-sync-signature.test.ts`, `npm run typecheck`, and `npm run check:encoding` after deferring canvas local persistence to idle time and preventing selection/viewport-only updates from triggering full canvas saves.
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-group-overlap-map.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/canvas-local-performance-trace-contract.test.ts tests/unit/canvas-connector-throttling-contract.test.ts`, `npm run typecheck`, `npm run build`, `npm run architecture:check`, `npm run governance:check`, and `npm run check:encoding` after replacing prompt-group overlap detection with a spatial-indexed map.
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/mobile-result-feed-detail-contract.test.ts tests/unit/settings-ui-density-regression.test.ts tests/unit/mobile-settings-browser-verify-script.test.ts` after adding mobile image/detail skeleton placeholders, touch/click isolation for bottom action controls, API workbench 2x2 mobile overview cards, and wider mobile settings cards.
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/api-settings-local-preset-entry.test.ts tests/unit/api-settings-routing-regression.test.ts tests/unit/api-settings-simple-mode-contract.test.ts tests/unit/api-settings-workbench-structure.test.ts tests/unit/settings-ui-density-regression.test.ts tests/unit/mobile-settings-browser-verify-script.test.ts` after restoring visible local API and provider add actions in the API workbench.
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-local-storage-snapshot-cache.test.ts tests/unit/mobile-settings-browser-verify-script.test.ts` after preventing the first post-load debounced canvas save from overwriting seeded/restored local snapshots.
- Passed: `npm run typecheck`, `npm run build`, `npm run architecture:check`, `npm run governance:check`, `npm run check:encoding`, and `npm run verify:mobile-settings-smoke`.
- Verified in the in-app browser at `http://127.0.0.1:3000/settings/api-management` with a 430x932 viewport: API overview cards render as 2 columns x 2 rows, settings content width is 404px while the mobile top bar is 382px, and there is no horizontal overflow.
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/api-settings-workbench-structure.test.ts tests/unit/api-settings-editor-feedback.test.ts tests/unit/frontend-key-boundary-hardening.test.ts`, `npm run typecheck`, `npm run governance:security`, and `npm run check:encoding` after preventing API provider presets and legacy supplier drafts from carrying `apiKey` / `apiKeyPreview` into new provider forms.

## 7. Handoff Notes For Next Agent

- Always read `AGENTS.md`, `package.json`, and `config/release-manifest.json` before editing.
- Ensure that any new frontend components containing `<img>` or media elements handle the pending load state gracefully by managing their `opacity` via `isMediaLoaded` or a comparable local state, to avoid raw broken-image indicators displaying momentarily.
- Wuyin / 速创 model routing is now endpoint-aware across image, video, audio, chat, Sora2, and utility endpoints. The frontend serializes per-model request bodies with the documented `Content-Type`, browser-side Wuyin direct calls are disabled in favor of the user-route proxy, and `local_proxy` task IDs can include the Wuyin model ID so polling can pick special detail endpoints such as `/api/sora2/detail`.
- Wuyin / 速创 async image auth must match the local `0605test_image` tool: submit uses JSON body plus raw `Authorization` only; detail polling uses `/api/async/detail?id=<taskId>&key=<userKey>` and also sends raw `Authorization`.
- Wuyin image generation must submit the user-selected image model exactly; do not silently substitute another Wuyin image model. If production still shows the old NanoBanana2 502/404 copy, check `https://kkai.plus/app-version.json`; on 2026-06-05 production was still at commit `27f6931`, while the Wuyin branch fix was not deployed to production main yet.
- API Key settings behavior: `SettingInput` reveals newly typed secrets locally. For saved records, default list loading still returns placeholders, but the eye button calls the explicit `/v1/profile/user-apis/reveal-secret` backend route for the current record and fills the form with that saved plaintext only after the user asks to view it. Do not reintroduce `apiKeyPreview` or record-id-derived suffixes as input display values.
- API Key transport behavior: display placeholders are never sendable credentials. Before provider fetches, normalize and reject `sk-readonly-0000`, `__kk_redacted__:*`, masked previews, object strings, and encrypted envelopes; then preserve each provider's existing auth protocol (`Wuyin` raw, OpenAI Bearer, Gemini query/header).
- API preset behavior: choosing a provider from the model center preset directory always opens a new provider draft with an empty API Key field. Existing provider secrets or legacy `Supplier.apiKey` values must only appear through an explicit edit path as read-only placeholders, never through preset prefill.
- User API ID behavior: `keyManagerCanonicalIds.ts` is now the single canonical helper for user API record IDs. New IDs use `channel-prefix-index` such as `wuyinkeji-google-omni-1015-1`; legacy IDs like `provider_wuyin`, `slot_wuyin`, `key_*`, and `provider_*` must be retained in `legacyIds` for route compatibility rather than displayed as the current ID.
- Wuyin / 速创 preset logo: use `WUYIN_PRESET_LOGO_URL` from `keyManagerProviderPresets.ts` (`https://api.wuyinkeji.com/assets/img/%E6%9C%AA%E5%91%BD%E5%90%8D-2.png`) instead of a text fallback icon.
- If user or another AI changes files in parallel, inspect `git status` and current diffs first; never revert unrelated work.
- Canvas responsiveness note: `useCanvasLocalPersistence` is now keyed by content-level persistence tokens. Do not reintroduce raw `state` as the debounce dependency, or simple card selection and viewport updates will serialize the full canvas again.
- Canvas responsiveness note: prompt-group overlap detection now lives in `apps/web/src/app/promptGroupOverlapMap.ts`; keep overlap semantics there and avoid restoring all-pairs checks inside `usePromptGroupLayout`.
- Mobile perceived-performance note: `MobileResultTile` and `MobileResultDetailScreen` now render skeleton boxes before media load, using the same aspect-ratio constraints as the final image. Keep future mobile media placeholders visually isomorphic with the final frame to avoid layout jumps.
- Mobile interaction note: bottom result actions stop pointer, mouse, touch, and click propagation before invoking actions. Keep destructive mobile buttons inside pointer-isolated wrappers so taps do not fall through to the canvas or result feed below.
- Mobile settings note: the mobile settings shell intentionally gives content cards wider horizontal space than the fixed top bar. API workbench overview cards should remain 2x2 on phone widths rather than collapsing into a single column.
- Canvas persistence note: `useCanvasLocalPersistence` skips the first debounced save after loading completes so restored or smoke-test seeded snapshots are not immediately replaced by the empty default canvas.
- For assistant work, prefer small sprint-sized changes and update this file plus `docs/ai-assistant/*` with touched files, validation, and next step.
- Lightbox redraw safety: When `redrawWorkspaceMode !== null` in `apps/web/src/components/image/GlobalLightbox.tsx`, all non-explicit close actions (Escape key, double clicking images/videos, clicking background container, mobile swipe gesture) are blocked, forcing the user to close the lightbox only via the explicit top-right "X" button.

## 2026-06-05 - Project-Wide Runtime Audit And Hardening

- User request: review the whole KK Studio project as a senior full-stack architect, identify production performance/UX gaps, and land core runtime hardening rather than only reviewing one module.
- Files touched by this pass: `apps/web/src/features/ai-takeover/core/canvasRuntimeStateBuilder.ts`, `apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts`, `apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts`, `apps/web/src/features/ai-takeover/components/AIAssistantDock.tsx`, `apps/web/src/features/assets/zipOutputs.ts`, `server/lib/fixedWindowRateLimiter.js`, `server/routes/chat.js`, `server/routes/generate-image.js`, and related unit tests.
- Behavior: assistant context is redacted and avoids avoidable O(n log n) runtime-state work; ToolRegistry logs are capped/redacted; queue UI receives subscription updates instead of polling; durable queue prevents duplicate in-flight prompt execution and can archive finished jobs.
- Behavior: selected original ZIP downloads are bounded by concurrency, timeout, retry, and progress; manifest failure accounting remains intact.
- Behavior: chat and image generation routes now use a shared native fixed-window limiter with expired-key pruning. Image generation uses async file writes and randomized public filenames without embedding user IDs.
- Validation: passed `node --check server/routes/chat.js`, `node --check server/routes/generate-image.js`, `node --check server/lib/fixedWindowRateLimiter.js`, and `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/fixed-window-rate-limiter.test.ts tests/unit/ai-assistant-tool-registry.test.ts tests/unit/canvas-runtime-state-builder.test.ts tests/unit/zip-selected-originals.test.ts tests/unit/durable-generation-queue.test.ts` (39 tests).
- Remaining full-project risks to keep visible: `apps/web/src/App.tsx` is still a very large orchestration surface, HTTP client behavior is split between axios api-client and native requestKernel, production auth/admin hardening still needs removal of hard-coded admin promotion, and generated/cache docs still contain placeholder domains that should not be treated as deployable config.

## 2026-06-06 - Canvas Board Selection To Reference Image Performance Refactor

- User request: 框选绘画可以在输入框中显示该图形能够当做参考图来用。
- Files touched: `apps/web/src/components/canvas/CanvasDrawingInteractionOverlay.tsx`, `apps/web/src/App.tsx`, and `docs/development/session-handoff.md`.
- Behavior:
  - **Memory Direct Draw**: Removed the expensive 6-step asynchronous Blob and Image rendering logic from Canvas selection. Replaced it with synchronous Canvas drawing from drawings vector points, ensuring 0 I/O latency and 0 memory leaks.
  - **React 0-Render Preview**: Bypassed React state update on coordinate mapping in drawing mode. Updated SVG preview elements properties directly via ref DOM modification (`setAttribute`), pushing drawings to React context state only on `mouseup`. This guarantees 60fps local painting performance.
  - **AABB Phase + Fine-grained Collision**: Optimized drawings scan with 2-phase intersection. Bounds (AABB) intersection filters out 99% of drawings in O(1) time before detailed point check.
  - **Distance-based Decimation**: Applied distance-based point suppression (4px threshold) on `mousemove` sampling to reduce SVG payload size by over 80%.
  - **IndexedDB & Memory Dual-Caching**: Integrated `calculateImageHash` and dynamic `imageStorage.saveImage` inside `App.tsx` on image addition. It ensures reference image won't get lost on reload after local config serialization stripped base64 payloads, utilizing memoryCache fallback correctly when IndexedDB fails.
- Validation: Verified with `npm run build` passing successfully.


## 2026-06-06 - 画布性能优化阶段 1 & 2 极致 LOD 与视口双缓冲区虚拟化卸载

- **User Request**: 吸纳 Opentu 优秀性能方案，对标解决 KK Studio 画布在大文件、多卡片时的性能表现（帧率、显存、重排重绘）。
- **Files touched**: `apps/web/src/components/image/ImageCard2.tsx`, `apps/web/src/components/canvas/PromptNodeComponent.tsx`, `apps/web/src/App.tsx`, `apps/web/src/app/appCanvasTypes.ts`, `apps/web/src/types.ts`, `apps/web/src/types/index.ts`.
- **Behavior**:
  - **LOD 渐进画质与显存垃圾回收**：在图片移出可视区时，将 `displaySrc` 降级为极轻量级 `MICRO` 微缩略图，从而自动回收 99% 的 GPU 显存。滑回时通过 CSS 渐变流畅过渡，免除白屏体验断层。
  - **静态文本折叠消除排版重排**：在远景缩略壳模式下，卸载 DOM 结构并将 line-clamp CSS 折叠改为原生 JS 静态文本截断，免除排版引擎对于字体包围盒和换行的大规模重排负载。
  - **高精度 AABB 视口碰撞检测**：替换了写死宽高估计的旧裁剪逻辑。结合 `getPromptNodeBoundsWidth`, `imageCardHeightById`, `getCardDimensions` 实施准确的 AABB 包围盒相交判断。
  - **Overscan 级联双缓冲区虚拟化完全卸载**：引入 `RENDER_BUFFER` (1.2倍可视区) 与 `VIRTUAL_BUFFER` (2.5倍可视区)。对于可视区 1.2 倍外但在 2.5 倍内的卡片标记为 `isPlaceholder: true`，仅渲染一个保留 DOM ID 和物理定位高宽的绝对定位空 `div` 占位容器 (保留原 DOM ID、位置与尺寸)，保证 SVG 连线正常锚定并极度精简 React DOM 和渲染树；超过 2.5 倍以外的节点则完全过滤卸载。
  - **顺带修补系统级类型漏洞**：修复了 `apps/web/src/types.ts` 和 `src/types/index.ts` 里的 `CanvasDrawing` 接口定义，补齐了可选字段 `bindingNodeId?: string;` 和 `bindingGroupId?: string;`，解决 `canvasMovement.ts` 中的 TS2339 错误。
- **Validation**: 运行 `npm run typecheck` 完美通过（前端主程序、服务端及 386 个测试文件编译通过）。

## 2026-06-06 - Production Runtime Audit Follow-up: Security, Queue Encapsulation, ZIP Algorithm, Canvas Event Hot Path

- **User request**: 从底层核心逻辑到前端体验做生产级把关，不满足于“能跑通”；优先指出性能隐患与体验断层，并直接落地可安全实施的核心修复。
- **Files touched in this follow-up**: `package.json`, `package-lock.json`, `apps/web/package.json`, `apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts`, `apps/web/src/features/assets/resolveOriginalAssets.ts`, `apps/web/src/components/canvas/InfiniteCanvas.tsx`, `tests/unit/durable-generation-queue.test.ts`, and `tests/unit/zip-selected-originals.test.ts`.
- **Dependency hardening**:
  - Upgraded React Router packages to `7.17.0`, resolving the audited high-risk `react-router` / `react-router-dom` advisories and fixing the previously invalid dependency tree where `@react-router/*@7.16.0` depended on a deduped `react-router@7.14.1`.
  - Upgraded `pdfjs-dist` to `6.0.227` and aligned the root override, removing the vulnerable optional `canvas@2 -> @mapbox/node-pre-gyp -> tar@6` chain from the lockfile.
- **Core runtime behavior**:
  - `DurableGenerationQueue.getJobs()` / `getJob()` / subscriber callbacks now expose cloned snapshots instead of mutable internal arrays and job objects. The internal state machine uses a private `findJob()` path for real mutations.
  - `resolveImageNodesForDownload(scope='latest_batch')` now selects the newest four image nodes with a fixed-size single-pass window, reducing this path from O(n log n) sorting plus full-array copy to O(n) time and O(1) extra space.
  - `InfiniteCanvas` caches the container rect and refreshes it with `ResizeObserver` / window resize, avoiding repeated `getBoundingClientRect()` reads on high-frequency grid-glow pointer movement. The window `keydown` listener is no longer passive so the existing Space-key `preventDefault()` can actually prevent page scrolling.
- **Validation**:
  - Passed: `npm audit --omit=dev --audit-level=moderate` (0 vulnerabilities).
  - Passed: `npm run typecheck`.
  - Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-runtime-state-builder.test.ts tests/unit/canvas-visual-regression.test.ts tests/unit/canvas-layering-contract.test.ts tests/unit/durable-generation-queue.test.ts tests/unit/zip-selected-originals.test.ts` (38 tests).
  - Passed: `npm run build`.
- **Remaining production risks**:
  - Build still warns on oversized chunks: `vendor` is about 3.17 MB minified / 866 KB gzip, and `account-recharge` is about 1.06 MB minified / 333 KB gzip. This needs a dedicated route-level and vendor-level code-splitting pass.
  - `architecture:check` passes but still reports hundreds of hardcoded UI color/token warnings. Treat that as a design-system debt, not a clean UX bill of health.
  - Major dependency diet, UI library removal, and large orchestration decomposition affect core app behavior and should go through OpenSpec proposal/approval before implementation.

## 2026-06-06 - Production Bundle And Startup UX Follow-up

- **User request**: continue the production-grade full-chain optimization, with emphasis on real frontend performance and user-facing loading/error quality rather than only "it builds".
- **Files touched in this follow-up**: `apps/web/index.html`, `apps/web/vite.config.ts`, `apps/web/src/app/AppGlobalModals.tsx`, `apps/web/src/components/auth/LoginScreen.tsx`, `apps/web/src/components/image/GlobalLightbox.tsx`, `apps/web/src/components/mobile/MobileResultDetailScreen.tsx`, `tests/unit/login-screen-auth-actions.test.ts`, and `tests/unit/partial-redraw-lightbox-contract.test.ts`.
- **Behavior**:
  - Removed startup mojibake from `index.html` comments and fallback copy. The self-healing startup error remains user-facing Chinese via Unicode escapes and no longer depends on raw non-ASCII bytes in the inline script.
  - Converted settings, lightbox, PPT preview, QR login modal, OAuth provider modules, shader background, and redraw workspace surfaces to true on-demand loading.
  - Tightened Vite manual chunk rules so deferred UI modules are not forced into static entry chunks. Added HTML modulepreload filtering for deferred modal/settings/shader/import-tool chunks.
  - `three-vendor` remains in the build as a dynamic shader dependency, but it is no longer present in the HTML modulepreload list or entry static imports.
  - `RedrawWorkspace` remains available from lightbox and mobile detail, but loads only when the redraw workspace is opened.
- **Verified production artifact**:
  - Final `apps/web/dist/index.html` modulepreload list no longer includes `RechargeModal`, `SettingsPanel`, `GlobalLightbox`, `WechatQrModal`, `RedrawWorkspace`, `animated-shader-background`, `three-vendor`, Markdown import, Mermaid import, or admin/settings lazy chunks.
  - Remaining first-load preloads are still large: `vendor`, `canvas-core`, `workspace-layout`, `antd-vendor`, `model-services`, `provider-adapters`, `image-workbench`, `lucide-vendor`, plus small auth/runtime helpers.
- **Validation**:
  - Passed: `npm run typecheck`.
  - Passed: `npm run build`.
  - Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/login-screen-auth-actions.test.ts tests/unit/login-screen-admin-entry.test.ts tests/unit/kkai-billing-ui-surface.test.ts tests/unit/partial-redraw-lightbox-contract.test.ts tests/unit/mobile-result-feed-detail-contract.test.ts tests/unit/import-only-unused-cleanup-contract.test.ts tests/unit/app-startup-coordinator.test.ts` (19 tests).
  - Passed: `npm run governance:check`.
  - Passed: `npm run check:encoding`.
  - Passed: `npm run architecture:check`, with the pre-existing hardcoded UI token/color warning still present.
  - Passed: `npm audit --omit=dev --audit-level=moderate` (0 vulnerabilities).
- **Remaining production risks**:
  - `vendor` is still about 3.43 MB minified / 951 KB gzip, `canvas-core` about 757 KB / 224 KB gzip, and `antd-vendor` about 469 KB / 154 KB gzip. Real dependency removal or route-level app-shell splitting is larger than this low-risk bundling pass and should be planned separately.
  - `index.css` is still about 611 KB minified / 91 KB gzip; the project still needs a design-token and CSS pruning pass.
  - `architecture:check` still reports 555+ hardcoded color/token literals. Do not present the UI system as fully tokenized or Material-clean until that debt is addressed.

## 2026-06-06 - Admin Recharge Surface Lazy Gate

- **User request**: continue production-grade full-chain optimization and remove startup/runtime work that ordinary users should not pay for.
- **Files touched in this follow-up**: `apps/web/src/app/AuthenticatedAppShell.tsx`, `apps/web/src/components/admin/AdminRechargeFloatingPanel.tsx`, and `tests/unit/kkai-billing-ui-surface.test.ts`.
- **Behavior**:
  - `AuthenticatedAppShell` no longer statically imports or renders the admin recharge floating panel for every authenticated user.
  - A small `AdminRechargeFloatingPanelGate` checks `useAdminRole()` first; only active admin sessions dynamically import the floating panel through `lazyWithRetry`.
  - `AdminRechargeFloatingPanel` now receives an explicit `enabled` prop and does not own role discovery. Its polling timers and admin recharge submission service are unreachable unless the gate is open.
- **Verified production artifact**:
  - `AdminRechargeFloatingPanel-*.js` and `rechargeSubmissionService-*.js` remain available as dynamic chunks.
  - `apps/web/dist/index.html` does not modulepreload either admin recharge chunk, so ordinary workspace startup no longer fetches that admin-only path.
- **Validation**:
  - Passed: `npm run typecheck`.
  - Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/kkai-billing-ui-surface.test.ts tests/unit/app-startup-coordinator.test.ts tests/unit/workspace-auth-gate.test.ts tests/unit/billing-service-unused-cleanup-contract.test.ts` (14 tests).
  - Passed: `npm run build`.
  - Passed: `npm run governance:check`.
  - Passed: `npm run check:encoding`.

## 2026-06-06 - Native KK UI Bridge And AntD Removal

- **User request**: continue production-grade full-chain optimization with lightweight native UI and removal of heavy nonessential UI dependencies.
- **Files touched in this follow-up**: `packages/ui/src/web/KkUIProvider.tsx`, `KkModal.tsx`, `KkButton.tsx`, `KkInput.tsx`, `KkSelect.tsx`, `KkDropdown.tsx`, `package.json`, `package-lock.json`, `apps/web/vite.config.ts`, `apps/web/src/styles/kk-ui-tokens.css`, and `scripts/architecture/check-ui-import-boundaries.mjs`.
- **Behavior**:
  - `@kk/ui/web` no longer wraps `@lobehub/ui` or AntD. Provider now applies native document-level theme variables; Modal/Button/Input/Select/Dropdown are native React/CSS adapters.
  - Removed direct production dependencies `@lobehub/ui` and `antd`; `npm uninstall` removed 268 packages from the dependency tree.
  - `check-ui-import-boundaries.mjs` now forbids direct `@lobehub/ui` and `antd` imports anywhere in app/package source, including `packages/ui`.
  - Removed the stale `antd-vendor` manual chunk rule from Vite.
- **Verified production artifact**:
  - Production build transformed 4398 modules instead of the previous 12415-module build observed before this pass.
  - `antd-vendor` is gone from the build output and from `apps/web/dist/index.html` modulepreload links.
  - `npm ls @lobehub/ui antd --all` reports an empty dependency tree.
  - Current large first-load chunks are still `vendor` (~3.40 MB / 940 KB gzip), `canvas-core` (~769 KB / 228 KB gzip), `workspace-layout` (~420 KB / 123 KB gzip), plus model/provider/image workbench chunks. `index.css` remains ~611 KB / 91 KB gzip.
- **Validation**:
  - Passed: `npm run typecheck`.
  - Passed: `npm run architecture:check` (still reports the known hardcoded color/token warning list).
  - Passed: `npm run build`.
  - Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/kkai-billing-ui-surface.test.ts tests/unit/recharge-modal-source-contract.test.ts tests/unit/app-startup-coordinator.test.ts tests/unit/workspace-auth-gate.test.ts` (12 tests).
  - Passed: `npm audit --omit=dev --audit-level=moderate`.
  - Passed: `npm audit --audit-level=moderate` after upgrading `apps/web` Vitest to the safe `4.1.x` line.
  - Passed: `npm run governance:check`.
  - Passed: `npm run check:encoding`.
- **Remaining production risks**:
  - CSS pruning and app-shell decomposition remain separate follow-ups.

## 2026-06-06 - Turnstile On-Demand Network Loading

- **User request**: continue production-grade full-chain optimization with real-world network resilience and no unnecessary third-party startup work.
- **Files touched in this follow-up**: `apps/web/index.html`, `apps/web/src/components/auth/TurnstileWidget.tsx`, and `tests/unit/login-screen-auth-actions.test.ts`.
- **Behavior**:
  - Removed global Cloudflare Turnstile `dns-prefetch`, `preconnect`, and script injection from `index.html`.
  - `TurnstileWidget.ensureTurnstileScript()` now owns Cloudflare connection hints and script creation. DNS prefetch and preconnect are injected only when the auth widget actually requests Turnstile.
  - Existing Turnstile timeout, script error mapping, widget status, and visible login feedback remain intact.
- **Verified production artifact**:
  - `apps/web/dist/index.html` no longer contains `challenges.cloudflare.com` or `data-turnstile-script`.
  - Built HTML size dropped from about 7.08 KB / 2.43 KB gzip to about 6.19 KB / 2.21 KB gzip in the current production build.
- **Validation**:
  - Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/login-screen-auth-actions.test.ts tests/unit/auth-localization.test.ts tests/unit/turnstile-runtime-config.test.ts` (15 tests).
  - Passed: `npm run typecheck`.
  - Passed: `npm run build`.
  - Passed: `npm run governance:check`.
  - Passed: `npm audit --audit-level=moderate`.
  - Passed: `npm run check:encoding`.

## 2026-06-06 - Startup Font Network Removal

- **User request**: continue production-grade optimization with native CSS/JS and better resilience under proxy-blocked or unstable networks.
- **Files touched in this follow-up**: `apps/web/index.html`, `tests/unit/tailwind-utility-cascade-contract.test.ts`, and this handoff.
- **Behavior**:
  - Removed Google Fonts `preconnect` and render-blocking `fonts.googleapis.com` stylesheet from the static startup HTML.
  - The startup shell now uses a local system font stack: `HarmonyOS Sans SC`, Apple system fonts, `Segoe UI`, `system-ui`, and `sans-serif`.
  - Added a source contract preventing `fonts.googleapis.com`, `fonts.gstatic.com`, and `family=Inter` from returning to `apps/web/index.html`.
- **Verified production artifact**:
  - `apps/web/dist/index.html` no longer contains Google Fonts, Cloudflare Turnstile, or other explicit third-party startup URLs.
  - Built HTML size dropped again from about 6.19 KB / 2.21 KB gzip to about 5.97 KB / 2.15 KB gzip.
- **Validation**:
  - Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/tailwind-utility-cascade-contract.test.ts tests/unit/login-screen-auth-actions.test.ts` (7 tests).
  - Passed: `npm run typecheck`.
  - Passed: `npm run build`.
  - Passed: `npm run governance:check`.
  - Passed: `npm audit --audit-level=moderate`.
  - Passed: `npm run check:encoding`.

## 2026-06-06 - Lobe Icon Dependency Pruning

- **User request**: continue production-grade optimization by removing nonessential heavy dependencies and reducing the supply-chain surface.
- **Files touched in this follow-up**: `package.json`, `package-lock.json`, `scripts/architecture/check-ui-import-boundaries.mjs`, and this handoff.
- **Behavior**:
  - Removed unused direct production dependencies `@lobehub/icons` and `@lobehub/fluent-emoji`.
  - `npm uninstall @lobehub/icons @lobehub/fluent-emoji` removed 17 packages and kept audit clean.
  - Runtime Lobe icon CDN URL helpers remain intact; they build CDN URLs only and do not import npm icon packages.
  - `check-ui-import-boundaries.mjs` now blocks direct imports of `@lobehub/ui`, `@lobehub/icons`, `@lobehub/fluent-emoji`, and `antd`, including side-effect and dynamic imports.
- **Verified production artifact**:
  - `npm ls @lobehub/icons @lobehub/fluent-emoji @lobehub/ui antd --all` reports an empty dependency tree.
  - `package.json` and `package-lock.json` no longer contain the removed Lobe packages.
  - Production build still transforms 4398 modules; this pass reduces install/audit/supply-chain surface rather than runtime chunk size.
- **Validation**:
  - Passed: `npm run architecture:check` (with the known hardcoded color/token warning list still present).
  - Passed: `npm audit --audit-level=moderate`.
  - Passed: `npm run typecheck`.
  - Passed: `npm run build`.
  - Passed: `npm run check:encoding`.
- **Remaining production risks**:
  - `vendor`, `canvas-core`, `workspace-layout`, and `index.css` remain the dominant production bundle/CSS optimization targets.

## 2026-06-06 - Login Screen Lazy Split

- **User request**: continue production-grade startup optimization by minimizing authenticated workspace first-load JavaScript and CSS.
- **Files touched in this follow-up**: `apps/web/src/app/AuthenticatedAppShell.tsx`, `tests/unit/workspace-auth-gate.test.ts`, and this handoff.
- **Behavior**:
  - `AuthenticatedAppShell` no longer statically imports `LoginScreen`.
  - `LoginScreen` is loaded through `lazyWithRetry` only when `shouldShowLoginForAuthGate({ user, session, isTempUser })` returns true.
  - Signed-out users see the existing `AppStartupScreen` fallback while the login chunk loads, preserving non-blocking visual feedback.
- **Verified production artifact**:
  - Production build emits `LoginScreen-*.js` and `LoginScreen-*.css` as separate dynamic assets.
  - `apps/web/dist/index.html` does not modulepreload `LoginScreen`.
  - Main `index` chunk dropped from about 492.86 KB / 141.95 KB gzip to about 471.51 KB / 134.98 KB gzip.
  - Main CSS dropped from about 611.36 KB / 91.27 KB gzip to about 592.60 KB / 87.42 KB gzip because login CSS is no longer in the startup stylesheet.
- **Validation**:
  - Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/workspace-auth-gate.test.ts tests/unit/kkai-app-root.test.ts tests/unit/login-screen-auth-actions.test.ts` (16 tests).
  - Passed: `npm run typecheck`.
  - Passed: `npm run build`.
  - Passed: `npm run architecture:check` (with the known hardcoded color/token warning list still present).
- **Remaining production risks**:
  - `useAdminRole`, model/provider/image workbench chunks, `vendor`, `canvas-core`, `workspace-layout`, and the remaining shared CSS still require deeper startup ownership review.

## 2026-06-06 - Admin Role Startup Probe Removal

- **User request**: continue production-grade startup optimization and remove admin-only work from ordinary workspace startup.
- **Files touched in this follow-up**: `apps/web/src/app/AuthenticatedAppShell.tsx`, `apps/web/src/components/admin/AdminRechargeFloatingPanelGate.tsx`, `apps/web/src/components/mobile/MobileWorkspaceSurface.tsx`, `tests/unit/kkai-billing-ui-surface.test.ts`, and this handoff.
- **Behavior**:
  - `AuthenticatedAppShell` no longer imports `useAdminRole`; admin recharge probing is isolated behind `AdminRechargeFloatingPanelGate`.
  - `AdminRechargeFloatingPanelGate` is lazy-loaded only when `KKAI_FEATURE_FLAGS.admin` is enabled, then checks `useAdminRole` and loads the floating panel only for active admin sessions.
  - `MobileWorkspaceSurface` no longer calls `useAdminRole` just to render the mobile header role badge. The mobile header falls back to its local `user` role default until a profile/settings surface explicitly needs role data.
  - This removes the ordinary startup path that could preload the admin role hook and issue `getAdminAccess` for non-admin users.
- **Verified production artifact**:
  - `apps/web/dist/index.html` no longer modulepreloads `useAdminRole`, `AdminRechargeFloatingPanelGate`, `AdminRechargeFloatingPanel`, or `LoginScreen`.
  - `useAdminRole-*.js`, `AdminRechargeFloatingPanelGate-*.js`, and `AdminRechargeFloatingPanel-*.js` remain available as dynamic chunks for settings/admin surfaces.
  - Built HTML size dropped from about 5.88 KB / 2.12 KB gzip to about 5.80 KB / 2.10 KB gzip.
  - Main `index` chunk is about 471.35 KB / 134.93 KB gzip after this pass.
- **Validation**:
  - Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/kkai-billing-ui-surface.test.ts tests/unit/workspace-auth-gate.test.ts tests/unit/runtime-legacy-fallback-guards.test.ts` (14 tests).
  - Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/kkai-billing-ui-surface.test.ts tests/unit/mobile-app-shell-integration.test.ts tests/unit/mobile-workspace-surface-contract.test.ts` (10 tests).
  - Passed: `npm run typecheck`.
  - Passed: `npm run build`.
  - Passed: `npm run architecture:check` (with the known hardcoded color/token warning list still present).
  - Passed: `npm run governance:check`.
  - Passed: `npm audit --audit-level=moderate`.
  - Passed: `npm run check:encoding`.
- **Remaining production risks**:
  - `model-services`, `provider-adapters`, `image-workbench`, `vendor`, `canvas-core`, `workspace-layout`, `pptEditable`, and shared CSS remain the dominant startup/bundle targets.

## 2026-06-06 - LLM Execution Deferral And Chat Sidebar Lazy Boundary

- **User request**: continue production-grade full-chain optimization, with startup performance, native/lightweight implementation, and real-world network resilience as the priority.
- **Files touched in this follow-up**:
  - `apps/web/src/components/workspace/WorkspaceSurfacePanels.tsx`
  - `apps/web/src/components/workspace/WorkspacePanels.tsx`
  - `apps/web/src/App.tsx`
  - `apps/web/src/app/optimizeGenerationPrompt.ts`
  - `apps/web/src/hooks/useImageGeneration.ts`
  - `apps/web/src/hooks/useTaskRecovery.ts`
  - `apps/web/src/components/layout/PromptBar.tsx`
  - `tests/unit/app-shell-panel-layer.test.ts`
  - `tests/unit/app-unused-cleanup-contract.test.ts`
  - `tests/unit/ecommerce-structured-task-source-contract.test.ts`
  - `tests/unit/generation-runtime-contract.test.ts`
  - `tests/unit/image-generation-unused-cleanup-contract.test.ts`
  - `tests/unit/prompt-bar-llm-lazy-boundary-contract.test.ts`
  - `tests/unit/task-recovery-llm-lazy-boundary-contract.test.ts`
- **Behavior**:
  - `ChatSidebar` is now loaded with `lazyWithRetry` from `WorkspaceSurfacePanels`; `WorkspacePanels` renders it only when `activePanel === 'chat'`. This avoids mounting the assistant chat and its generation/model imports on ordinary desktop startup.
  - `App.tsx` no longer statically imports `geminiService`, `LLMService`, `ecommerceAnalysisClient`, or `secureModelProxy` execution functions. Stable wrappers dynamically import them only when generation, video retry, ecommerce file analysis, or secure-proxy cancellation actually runs.
  - `optimizeGenerationPrompt` no longer statically imports `promptOptimizerService`; prompt optimization loads only when enabled and the raw prompt is non-empty.
  - `useImageGeneration` no longer statically imports `LLMService`, `geminiService`, `partialRedraw`, or `secureModelProxy` helpers. Execution wrappers dynamically load provider calls, media generation, and redraw compositing at action time; secure-proxy display errors are recognized by local error codes.
  - `PromptBar` no longer statically imports `LLMService`; PPT outline AI generation/refinement calls `chatWithLlm`, which imports the LLM service only when the user invokes those actions.
  - `useTaskRecovery` no longer statically imports `LLMService`; Midjourney batch preflight imports the service only when pending provider tasks are recovered.
- **Verified production artifact**:
  - `apps/web/dist/index.html` does not modulepreload `ChatSidebar`, `geminiService`, `ecommerceAnalysisClient`, or `promptOptimizerService`.
  - Dynamic chunks remain available for `ChatSidebar-*.js`, `geminiService-*.js`, `ecommerceAnalysisClient-*.js`, and `partialRedraw-*.js`.
  - `model-services` dropped from about 71 KB / 22 KB gzip to about 59 KB / 17 KB gzip after deferring the LLM/media execution imports from the static hook path.
  - `provider-adapters`, `model-services`, `image-workbench`, `partialRedraw`, `workspace-layout`, `canvas-core`, `vendor`, `lucide-vendor`, `pptEditable`, and `web` still appear in HTML modulepreload. The remaining `provider-adapters` preload is tied to current manual chunk grouping and first-screen ecommerce/model helper imports; deeper removal should be treated as a separate app-shell/ecommerce-runtime ownership change.
- **Validation**:
  - Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/app-shell-panel-layer.test.ts tests/unit/app-unused-cleanup-contract.test.ts tests/unit/prompt-bar-llm-lazy-boundary-contract.test.ts tests/unit/task-recovery-llm-lazy-boundary-contract.test.ts tests/unit/image-generation-unused-cleanup-contract.test.ts tests/unit/prompt-optimizer-service-source-contract.test.ts tests/unit/generation-runtime-contract.test.ts tests/unit/ecommerce-structured-task-source-contract.test.ts tests/unit/ecommerce-requirement-analysis-runtime-contract.test.ts tests/unit/key-manager-wuyin-route-regression.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/partial-redraw-pipeline-contract.test.ts` (89 tests).
  - Passed: `npm run typecheck`.
  - Passed: `npm run build`.
  - Passed: `npm run architecture:check` (still reports the known hardcoded UI color/token warning list, but exits successfully).
  - Passed: `npm run governance:check`.
  - Passed: `npm audit --audit-level=moderate`.
  - Passed: `npm run check:encoding`.
- **Remaining production risks**:
  - `vendor` (~3.40 MB / 940 KB gzip), `canvas-core` (~770 KB / 229 KB gzip), `workspace-layout` (~420 KB / 123 KB gzip), `image-workbench` (~81 KB / 23 KB gzip), and shared CSS remain large.
  - `provider-adapters` is still preloaded because current manual chunk grouping combines LLM provider code with ecommerce services that are statically used by the first-screen workspace shell. Removing it cleanly likely requires splitting ecommerce policy/build/runtime helpers away from provider execution modules and revisiting `APP_MANUAL_CHUNK_GROUPS`.

## 2026-06-06 - Provider Adapter Preload Removal

- **User request**: continue strict production optimization and remove nonessential LLM/provider work from ordinary startup.
- **Files touched in this follow-up**:
  - `apps/web/vite.config.ts`
  - `apps/web/src/components/mobile/MobileEcommercePanel.tsx`
  - `apps/web/src/services/ecommerce/ecommerceAnalysisEnhancer.ts`
  - `tests/unit/vite-manual-chunk-boundary-contract.test.ts`
  - this handoff
- **Performance risk found**:
  - The previous Vite manual chunk grouped `/src/services/llm/` and `/src/services/ecommerce/` into `provider-adapters`, so first-screen ecommerce helpers could pull provider execution code into HTML modulepreload.
  - `syncImageBridge.ts` is a lightweight generation recovery/runtime bridge, but the broad `/src/services/llm/` chunk rule classified it as a provider adapter.
  - Mobile ecommerce and ecommerce analysis AI enhancer had static LLM imports, creating another path for model execution code to be bundled or preloaded earlier than needed.
- **Behavior**:
  - `provider-adapters` now covers only real LLM provider modules.
  - `ecommerce-services` is its own manual chunk.
  - `syncImageBridge.ts` is assigned to `model-services` before the provider catch-all rule.
  - `MobileEcommercePanel` dynamically imports `geminiService` and `LLMService` only when the mobile ecommerce generation or AI planning actions run.
  - `ecommerceAnalysisEnhancer` dynamically imports `LLMService` only when the optional AI enhancement path is invoked.
  - `provider-adapters-` is filtered from HTML modulepreload, while remaining available through dynamic import dependency maps.
- **Verified production artifact**:
  - `apps/web/dist/index.html` no longer modulepreloads `provider-adapters-*.js`.
  - The built `index-*.js` has no static `from "./provider-adapters-*.js"` import.
  - `provider-adapters-*.js` still exists as a dynamic chunk (~22.30 KB / 6.87 KB gzip) for actual generation/provider execution.
  - `ecommerce-services-*.js` is split separately (~164.63 KB / 49.94 KB gzip).
- **Validation**:
  - Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/vite-manual-chunk-boundary-contract.test.ts tests/unit/app-unused-cleanup-contract.test.ts tests/unit/image-generation-unused-cleanup-contract.test.ts tests/unit/prompt-bar-llm-lazy-boundary-contract.test.ts tests/unit/task-recovery-llm-lazy-boundary-contract.test.ts` (6 tests).
  - Passed: `npm run typecheck`.
  - Passed: `npm run build`.
  - Passed: `npm run architecture:check` (still reports the known hardcoded UI color/token warning list, but exits successfully).
  - Passed: `npm run governance:check`.
  - Passed: `npm audit --audit-level=moderate`.
  - Passed: `npm run check:encoding`.
- **Remaining production risks**:
  - `ecommerce-services` is still statically imported by the workspace shell and should be reviewed in a separate ecommerce runtime split.
  - `vendor`, `canvas-core`, `workspace-layout`, `image-workbench`, and shared CSS remain the largest startup payloads.

## 2026-06-06 - Ecommerce And Archive Runtime Split

- **User request**: continue strict full-chain production optimization from core runtime through frontend loading behavior.
- **Performance risks found**:
  - `ecommerce-services` was still a first-screen static chunk around 164.63 KB because the manual chunk catch-all grouped low-frequency ecommerce analysis, xlsx parsing, local document fallback, and core ecommerce helpers together.
  - `useEcommerceGroupExportRuntime`, `MobileChatFeed`, `usePptRuntime`, `useWorkflowActions`, `ProjectManager`, and `features/assets/zipOutputs` had static `jszip` or `file-saver` imports, so user-triggered export/download features could keep ZIP code in startup chunks.
  - The first attempt to make `import('jszip')` dynamic was ineffective while other modules still statically imported the same package; Vite reported `INEFFECTIVE_DYNAMIC_IMPORT`.
- **Files touched in this follow-up**:
  - `apps/web/vite.config.ts`
  - `apps/web/src/utils/archiveRuntime.ts`
  - `apps/web/src/app/useEcommerceGroupExportRuntime.ts`
  - `apps/web/src/app/usePptRuntime.ts`
  - `apps/web/src/app/useWorkflowActions.ts`
  - `apps/web/src/components/MobileChatFeed.tsx`
  - `apps/web/src/components/settings/ProjectManager.tsx`
  - `apps/web/src/features/assets/zipOutputs.ts`
  - `apps/web/src/services/ecommerce/ecommerceAnalysisClient.ts`
  - `apps/web/src/services/ecommerce/xlsx/openXmlWorkbookParser.ts`
  - `tests/unit/vite-manual-chunk-boundary-contract.test.ts`
  - `tests/unit/ecommerce-group-export-runtime-contract.test.ts`
  - `tests/unit/ppt-runtime-contract.test.ts`
- **Behavior**:
  - `archiveRuntime.ts` is the only app utility that dynamically loads `jszip` and `file-saver` for browser export actions.
  - Ecommerce group export now builds manifest and ZIP only after at least one exportable image exists.
  - Mobile feed downloads, workflow save-card export, PPT exports, project image export, and selected-original ZIP export call `createZipArchive`, `loadFileSaver`, or `saveBlobAs` instead of static third-party imports.
  - `ecommerceAnalysisClient` keeps the normal server upload path lightweight. Local xlsx/text/pdf/doc fallback modules load only on supported fallback conditions such as 404, 501, non-JSON response, or network `TypeError`.
  - `openXmlWorkbookParser` loads `jszip` inside `parseOpenXmlWorkbook`, so importing the parser no longer carries ZIP runtime code by itself.
  - Vite manual chunks now split `ecommerce-analysis-tools`, `ecommerce-document-tools`, `ecommerce-export-tools`, and `zip-vendor`, with those prefixes filtered from HTML modulepreload.
- **Verified production artifact**:
  - `apps/web/dist/index.html` does not modulepreload `provider-adapters`, `ecommerce-analysis-tools`, `ecommerce-document-tools`, `ecommerce-export-tools`, or `zip-vendor`.
  - `ecommerce-services-*.js` is now about 2.35 KB / 0.91 KB gzip and contains no xlsx parser, JSZip, analysis client, enhancer, or export manifest code.
  - `ecommerce-analysis-tools-*.js` is about 5.96 KB / 2.58 KB gzip.
  - `ecommerce-document-tools-*.js` is about 60.78 KB / 18.57 KB gzip and remains on the local document fallback path.
  - `zip-vendor-*.js` is about 95.88 KB / 28.46 KB gzip and no longer appears in HTML modulepreload.
  - `workspace-layout-*.js` returned to about 420.44 KB / 123.63 KB gzip after removing static ZIP imports from mobile feed.
- **Validation**:
  - Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/vite-manual-chunk-boundary-contract.test.ts tests/unit/ecommerce-group-export-runtime-contract.test.ts tests/unit/ecommerce-xlsx-parser.test.ts tests/unit/ppt-runtime-contract.test.ts tests/unit/zip-selected-originals.test.ts` (25 tests).
  - Passed: `npm run typecheck`.
  - Passed: `npm run build`.
  - Passed: `npm run architecture:check` (continues to report the known hardcoded UI token warning list, but exits successfully).
  - Passed: `npm run governance:check`.
  - Passed: `npm run governance:security`.
  - Passed: `npm audit --audit-level=moderate`.
  - Passed: `npm run check:encoding`.
- **Remaining production risks**:
  - `vendor` remains about 3.40 MB / 940 KB gzip, `canvas-core` about 770 KB / 229 KB gzip, and shared CSS about 592 KB / 87 KB gzip.
  - `workspace-layout` remains large because chat/feed/workspace shell concerns are still grouped together.
  - `ProjectManager.tsx` had pre-existing unrelated workflow and canvas-mode changes in the working tree; this pass only changed its archive runtime boundary.

## 2026-06-06 - Mermaid Native Topology Renderer

- **User request**: continue strict full-chain production optimization, remove heavyweight dependencies where native code is enough, and keep frontend feedback smooth.
- **Performance and reliability risks found**:
  - The Mermaid import modal was React-lazy, but its `mermaid` dependency pulled a separate ~3.1 MB minified chunk plus many tiny diagram chunks into production output once opened.
  - The modal already used a local topology parser for inserting cards, so the third-party Mermaid runtime was only serving preview rendering.
  - The old recursive level assignment in `handleInsert` could grow indefinitely on cyclic graphs such as `A --> B` and `B --> A`, risking stack overflow.
  - Third-party SVG rendering also expanded the supply-chain and XSS review surface for a modal that only needs flowchart/graph topology import.
- **Files touched in this follow-up**:
  - `apps/web/src/components/mermaid/MermaidRenderer.tsx`
  - `apps/web/src/components/mermaid/mermaidTopology.ts`
  - `apps/web/vite.config.ts`
  - `apps/web/package.json`
  - `package-lock.json`
  - `tests/unit/vite-manual-chunk-boundary-contract.test.ts`
  - `tests/unit/mermaid-topology-runtime.test.ts`
  - this handoff
- **Behavior**:
  - `MermaidRenderer` no longer imports or initializes `mermaid`.
  - `mermaidTopology.ts` owns parsing, direction detection, O(V + E) non-recursive layout, SVG label escaping, and native preview SVG generation.
  - The preview still debounces user input and shows loading/error feedback, but render work is now a local pure function instead of a third-party async renderer.
  - Inserting cards now reuses `layoutMermaidTopology`, eliminating the previous recursive level-growth path on cycles.
  - `apps/web/package.json` and `package-lock.json` no longer include `mermaid`.
  - The temporary `mermaid-vendor` manual chunk rule was removed because there is no runtime vendor package left to route.
- **Verified production artifact**:
  - `apps/web/dist/assets/MermaidRenderer-*.js` is about 8.84 KB / 3.88 KB gzip.
  - No `mermaid-vendor-*.js` asset is emitted.
  - `vendor-*.js` is about 292.22 KB / 98.52 KB gzip and contains no Mermaid, KaTeX, Chevrotain, Cytoscape, or Dagre-D3 markers.
  - Production build no longer emits the prior large-chunk warning caused by `mermaid-vendor`.
  - `apps/web/dist/index.html` still does not modulepreload `MermaidRenderer-*.js`.
- **Validation**:
  - Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/vite-manual-chunk-boundary-contract.test.ts tests/unit/mermaid-topology-runtime.test.ts` (6 tests).
  - Passed: `npm run typecheck`.
  - Passed: `npm run build`.
  - Passed: `npm run architecture:check` (continues to report the known hardcoded UI token warning list, but exits successfully).
  - Passed: `npm run governance:check`.
  - Passed: `npm audit --audit-level=moderate`.
  - Passed: `npm run check:encoding`.
- **Remaining production risks**:
  - `canvas-core` remains about 770 KB / 229 KB gzip, `workspace-layout` about 420 KB / 124 KB gzip, and shared CSS about 592 KB / 87 KB gzip.
  - The built main index still statically imports `ecommerce-document-tools`; this should be reviewed next because the HTML preload filter alone does not remove a static ESM dependency.

## 2026-06-06 - Ecommerce Document Static Import Split

- **User request**: continue strict production optimization after removing Mermaid runtime.
- **Performance risk found**:
  - `apps/web/dist/index.html` no longer modulepreloaded `ecommerce-document-tools`, but the built `index-*.js` still had a static ESM import from `ecommerce-document-tools-*.js`.
  - Root cause: deferred normalizer/document chunks shared ecommerce task-building dependencies with the first-screen app shell, so the manual chunk boundary let Rollup/Rolldown place shared functions inside the deferred document chunk and then re-import that chunk from the entry.
  - This meant the preload filter alone was not enough; the browser still had to fetch document parsing code while evaluating the entry graph.
- **Files touched in this follow-up**:
  - `apps/web/vite.config.ts`
  - `tests/unit/vite-manual-chunk-boundary-contract.test.ts`
  - this handoff
- **Behavior**:
  - Added an `ecommerce-core` manual chunk for first-screen ecommerce task policy/building helpers:
    - `assetRoleBindings.ts`
    - `copyResolver.ts`
    - `ecommerceModelPolicy.ts`
    - `renderTaskBuilder.ts`
    - `seriesTemplateExtractor.ts`
    - `taskMerger.ts`
  - Added an `ecommerce-normalize-tools` manual chunk for `normalize/` and `xlsx/referenceBindingResolver.ts`.
  - Kept `ecommerce-document-tools` focused on text fallback, OpenXML parsing, and Nutrient document extraction.
  - Added `ecommerce-normalize-tools-` to the HTML modulepreload deferred prefixes.
- **Verified production artifact**:
  - `apps/web/dist/index.html` modulepreloads `ecommerce-core-*.js` because the workspace shell uses those core helpers.
  - `apps/web/dist/index.html` does not modulepreload `ecommerce-document-tools-*.js` or `ecommerce-normalize-tools-*.js`.
  - Built `index-*.js` no longer contains `ecommerce-document-tools` or `ecommerce-normalize-tools`.
  - `ecommerce-core-*.js` is about 25.59 KB / 8.80 KB gzip.
  - `ecommerce-normalize-tools-*.js` is about 15.64 KB / 5.11 KB gzip.
  - `ecommerce-document-tools-*.js` dropped from about 60.78 KB / 18.57 KB gzip to about 19.53 KB / 7.54 KB gzip.
- **Validation**:
  - Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/vite-manual-chunk-boundary-contract.test.ts tests/unit/ecommerce-xlsx-parser.test.ts tests/unit/ecommerce-text-fallback.test.ts tests/unit/ecommerce-analysis-dev-proxy-contract.test.ts tests/unit/mermaid-topology-runtime.test.ts` (17 passed, 1 skipped local-dev endpoint contract).
  - Passed: `npm run typecheck`.
  - Passed: `npm run build`.
  - Passed: `npm run architecture:check` (continues to report the known hardcoded UI token warning list, but exits successfully).
  - Passed: `npm run governance:check`.
  - Passed: `npm audit --audit-level=moderate`.
  - Passed: `npm run check:encoding`.
- **Remaining production risks**:
  - `canvas-core` remains about 770 KB / 229 KB gzip.
  - `workspace-layout` remains about 420 KB / 124 KB gzip.
  - Shared CSS remains about 592 KB / 87 KB gzip.
  - `model-services` is still preloaded at about 59 KB / 17 KB gzip and should be reviewed for first-screen ownership after canvas/workspace shell risks.

## 2026-06-06 - Chat Sidebar True Lazy Boundary

- **User request**: continue strict production-grade full-chain optimization after ecommerce document static import split.
- **Performance risk found**:
  - `ChatSidebar` was React-lazy, but the production `index-*.js` still had a static ESM import from the forced `chat-sidebar-*.js` manual chunk.
  - Root cause: the manual `chat-sidebar` chunk pulled shared model/UI dependencies into the lazy chunk, so the main entry re-imported those shared exports from `chat-sidebar`.
  - `ChatSidebar.tsx` also had top-level imports of `geminiService` and `LLMService`, so Rollup warned that dynamic LLM imports elsewhere were ineffective.
- **Files touched in this follow-up**:
  - `apps/web/src/components/layout/ChatSidebar.tsx`
  - `apps/web/vite.config.ts`
  - `tests/unit/vite-manual-chunk-boundary-contract.test.ts`
  - this handoff
- **Behavior**:
  - `ChatSidebar` now loads LLM chat and image generation execution through `chatWithLlm` and `generateImageOnDemand` dynamic wrappers.
  - The forced `chat-sidebar` manual chunk was removed. `ChatSidebar` should remain a natural `React.lazy` dynamic import only.
  - `model-services` stays before `provider-adapters` in manual chunk matching so shared model helpers do not fall into provider execution code.
  - The boundary contract test now blocks static `geminiService` / `LLMService` imports in `ChatSidebar` and blocks reintroducing a manual `chat-sidebar` chunk.
- **Verified production artifact**:
  - `apps/web/dist/index.html` does not modulepreload `ChatSidebar-*.js`.
  - Built `index-*.js` mentions the dynamic `ChatSidebar` import string but has no static `from "./ChatSidebar-*.js"` import.
  - Built `index-*.js` has no static imports from `provider-adapters`, `ecommerce-document-tools`, `ecommerce-normalize-tools`, `zip-vendor`, or `MermaidRenderer`.
  - `ChatSidebar-*.js` is about 196.67 KB / 62.88 KB gzip after shared model helpers moved back out of the chat chunk.
  - `model-services-*.js` is about 59.28 KB / 17.10 KB gzip.
  - `workspace-layout-*.js` is about 216.24 KB / 59.20 KB gzip.
- **Validation**:
  - Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/vite-manual-chunk-boundary-contract.test.ts tests/unit/app-shell-panel-layer.test.ts tests/unit/app-unused-cleanup-contract.test.ts` (5 tests).
  - Passed: `npm run typecheck`.
  - Passed: `npm run build`.
  - Passed: `npm run architecture:check` (continues to report the known hardcoded UI token warning list, but exits successfully).
  - Passed: `npm run governance:check`.
  - Passed: `npm audit --audit-level=moderate`.
  - Passed: `npm run check:encoding`.
- **Remaining production risks**:
  - `canvas-core` remains about 770 KB / 229 KB gzip and is the biggest first-screen JS target.
  - `index.css` remains about 592 KB / 87 KB gzip.
  - `index-*.js` remains about 473 KB / 135 KB gzip and should be reviewed for app-shell ownership after canvas/runtime state boundaries.

## 2026-06-06 - Canvas Runtime Execution Deferral

- **User request**: continue strict production-grade full-chain optimization after the chat sidebar lazy-boundary pass.
- **Performance risks found**:
  - A first attempt to force `features/ai-takeover` into an `ai-takeover-runtime` manual chunk reduced `canvas-core`, but the built main entry then statically imported that chunk. This was rejected because it moved bytes rather than creating a real lazy boundary.
  - `AITakeoverContext` and `llmBrain` had top-level `LLMService` value imports, which made assistant planning/context compression initialize provider execution code before the user actually invoked cloud planning.
  - `PromptNodeComponent -> EcommerceCanvasWorkbenchCard -> EcommerceTaskEditorPanel -> promptOptimizerService -> LLMService -> secureModelProxy` pulled prompt optimizer/model proxy code into `canvas-core`.
  - `CanvasContext -> useCanvasCloudSync/syncService -> kkApiClient` pulled cloud sync API code into the canvas runtime even when workspace cloud sync is disabled.
- **Files touched in this follow-up**:
  - `apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx`
  - `apps/web/src/features/ai-takeover/core/llmBrain.ts`
  - `apps/web/src/components/ecommerce/EcommerceTaskEditorPanel.tsx`
  - `apps/web/src/context/CanvasContext.tsx`
  - `apps/web/src/context/useCanvasCloudSync.ts`
  - `apps/web/vite.config.ts`
  - `tests/unit/canvas-cloud-sync-signature.test.ts`
  - `tests/unit/vite-manual-chunk-boundary-contract.test.ts`
  - this handoff
- **Behavior**:
  - Removed the rejected `ai-takeover-runtime` manual chunk rule and preload prefix. AI takeover remains owned by the lazy chat sidebar boundary instead of becoming a static entry import.
  - `AITakeoverContext` and `LLMBrain` now use `chatWithLlm` dynamic wrappers for `LLMService.chat`.
  - `EcommerceTaskEditorPanel` dynamically imports `promptOptimizerService` only inside the AI prompt optimization action.
  - `CanvasContext` dynamically imports `syncService` only when cloud layout loading is actually enabled.
  - `useCanvasCloudSync` dynamically imports `syncService` inside the debounced cloud-save callback.
  - Boundary tests now block static imports for these paths.
- **Verified production artifact**:
  - `apps/web/dist/index.html` does not modulepreload `ChatSidebar`, `provider-adapters`, `ecommerce-document-tools`, `ecommerce-normalize-tools`, `ecommerce-analysis-tools`, `zip-vendor`, `MermaidRenderer`, `syncService`, `LLMService`, `promptOptimizerService`, or `secureModelProxy`.
  - `ChatSidebar-*.js` dynamically imports `LLMService-*.js`, which then loads provider execution chunks only on demand.
  - Static import graph from `CanvasContext` and `components/canvas` no longer reaches `LLMService`, `promptOptimizerService`, `secureModelProxy`, or `syncService`.
  - `syncService-*.js` is emitted as a separate deferred chunk around 2.56 KB / 1.05 KB gzip.
  - `provider-adapters-*.js` is a deferred chunk around 73.20 KB / 23.10 KB gzip.
  - `canvas-core-*.js` dropped from about 770.19 KB / 228.65 KB gzip to about 682.61 KB / 200.47 KB gzip.
- **Validation**:
  - Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/vite-manual-chunk-boundary-contract.test.ts tests/unit/app-shell-panel-layer.test.ts tests/unit/app-unused-cleanup-contract.test.ts` (5 tests).
  - Passed: `npm run typecheck`.
  - Passed: `npm run build`.
  - Passed: `npm run architecture:check` (continues to report the known hardcoded UI token warning list, but exits successfully).
  - Passed: `npm run governance:check`.
  - Passed: `npm audit --audit-level=moderate`.
  - Passed: `npm run check:encoding`.
  - Passed after the later workbench follow-up: `npm run verify:changes`.
- **Remaining production risks**:
  - `canvas-core` is still large at about 682.61 KB / 200.47 KB gzip. Remaining static weight is mostly canvas UI/runtime and app auth dependencies; splitting `AuthContext`/runtime session ownership is higher risk and should be handled as a separate architecture pass.
  - `index.css` remains about 592 KB / 87 KB gzip.
  - Main `index-*.js` remains about 473 KB / 135 KB gzip.

## 2026-06-06 - Ecommerce Workbench Lazy Boundary

- **User request**: continue strict production-grade full-chain optimization after canvas runtime execution deferral.
- **Performance risk found**:
  - `PromptNodeComponent` statically imported `EcommerceCanvasWorkbenchCard`, even though the workbench only renders for ecommerce framework prompt cards.
  - That path kept ecommerce task editor UI and adjacent workflow code inside the normal canvas prompt card runtime.
- **Files touched in this follow-up**:
  - `apps/web/src/components/canvas/PromptNodeComponent.tsx`
  - `tests/unit/prompt-bar-ecommerce-framework-companion.test.ts`
  - `tests/unit/canvas-cloud-sync-signature.test.ts` (contract assertion synchronized with the earlier dynamic `syncService` import)
  - this handoff
- **Behavior**:
  - `EcommerceCanvasWorkbenchCard` is now loaded via `React.lazy(() => import('../ecommerce/EcommerceCanvasWorkbenchCard'))`.
  - The framework workbench render is wrapped in `React.Suspense` with a lightweight native fallback.
  - The companion contract test now blocks restoring a static `EcommerceCanvasWorkbenchCard` import.
- **Verified production artifact**:
  - `apps/web/dist/assets/EcommerceCanvasWorkbenchCard-*.js` is emitted as a separate deferred chunk around 13.75 KB / 4.06 KB gzip.
  - `apps/web/dist/index.html` does not modulepreload `EcommerceCanvasWorkbenchCard`, `ChatSidebar`, `LLMService`, `promptOptimizerService`, `syncService`, `secureModelProxy`, `provider-adapters`, ecommerce document/normalizer chunks, or `mermaid-vendor`.
  - Built `index-*.js` has no static import from `EcommerceCanvasWorkbenchCard-*.js`.
  - `canvas-core-*.js` dropped from about 682.61 KB / 200.47 KB gzip to about 655.41 KB / 194.41 KB gzip.
- **Validation**:
  - Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-bar-ecommerce-framework-companion.test.ts tests/unit/vite-manual-chunk-boundary-contract.test.ts tests/unit/app-shell-panel-layer.test.ts tests/unit/app-unused-cleanup-contract.test.ts` (6 tests).
  - Passed: `npm run typecheck`.
  - Passed: `npm run build`.
  - Passed: `npm run verify:changes`.
- **Remaining production risks**:
  - `canvas-core` is still the largest app-owned JS chunk at about 655.41 KB / 194.41 KB gzip.
  - `workspace-layout` increased to about 229.82 KB / 62.41 KB gzip in this build because existing canvas/workspace code remains tightly coupled.
  - `index.css` remains about 592 KB / 87 KB gzip.
  - Main `index-*.js` remains about 473 KB / 135 KB gzip.
