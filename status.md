# KK-Studio v1.4.2 Coordination Status

Last updated: 2026-05-05

## Active State

- Active lane in this thread: single-line Stage Two giant-file split plus finalization audit. Stage One M6 and Stage One Backfill are complete; Stage Two M1-M55 are committed through `6902b79b`; the recent unused-code cleanup line is `b9baa445` (PromptBar/ImageCard), `b6767e85` (App), `fafecef9` (OpenAI-compatible adapter), `783fddeb` (LLMService), `92ee7a4f` (pure utility), `3108a29f` (ChatSidebar), `0efba271` (PromptNode), `0797bf95` (SystemLogs), `f453cd9a` (AchievementToast), `e661630e` (Onboarding residual), `05394f83` (imageCompression orphan), `eeb377d5` (dormant Pixi canvas), `9ce70e96` (dormant canvas residual), `58161f20` (legacy dashboard icons), `7d2c2584` (file-system stubs), `5dac56e8` (import-only types), `bdb082d7` (live canvas props), `e714380b` (workflow actions import), `57e8c05b` (common error-boundary parameter), `d4291729` (generation runtime import), `c29effe5` (CanvasContext type imports), `c4526e6b` (ProjectManager props), `d8845775` (ecommerce taskMerger parameter), `37540efc` (model display provider parameter), `324b42a6` (video-service cleanup), `b31edef5` (image priority/LOD cleanup), `56ffe696` (small LLM adapter cleanup), `8dfa152a` (chat-service cleanup), `a4032085` (generation-runtime contract test cleanup), `d075e6fd` (prompt optimizer duplicate-tab cleanup), `0cc6c77c` (KK API client unused DTO cleanup), `63386046` (user API payload secret-constant cleanup), `651b54c5` (cost service import cleanup), `318e6b1e` (secure model proxy unused-helper cleanup), `27f03e62` (user API profile import cleanup), `6c624909` (UserProfileModal billing alias cleanup), `6028e59a` (API settings unused cleanup), `c85ab3f9` (keyManager unused cleanup), `426a0a0c` (secure proxy route-gate wiring), `9764ba70` (OpenAI-compatible image dispatch helper extraction), and `0001f6a2` (post-M106 ledger alignment).
- Current slice override: M110 OpenAI-compatible task payload helper extraction is complete in the current working tree.
- Clay UI audit closure landed in `9e7ae2b5` and is no longer the active lane.
- Current branch: `main`.
- Plain `.git` still reports `4c448660` and is a stale historical view. The writable full Git metadata copy at `node_modules/.codex-git-full` is the only development fact source; the alternate-git HEAD before the M110 working-tree slice was `cb0d23c9 docs: record remaining refactor assessment`. Use `git --git-dir=node_modules/.codex-git-full --work-tree=.` for status/staging/commits in this session.
- Thread merge state: `019dd551...` is the main refactor history and `019de168...` is continuation history; both are part of the same Stage One M6 ecommerce runtime line.
- Alternate-git worktree was clean at `cb0d23c9` before the M110 task payload helper extraction pass.
- UI source of truth: `C:/Users/Administrator/Downloads/DESIGN-clay.md`, `DESIGN.md`, `docs/DESIGN.md`, `.agent/rules/skills/SKILL.md`, and shared CSS tokens in `src/index.css`.
- Runtime source of truth: Stage One hook extraction rules in `plans.md`; all custom hooks stay under `src/app/` with explicit deps/result interfaces.
- Current focus: M110 completion and commit. The image dispatch, payload, sizing, and task payload parsing seams have been isolated; the next seam should be selected only after a fresh map.
- Most recent code/security scopes: M110 OpenAI-compatible task payload helper extraction in the current working tree; M109 OpenAI-compatible image sizing/profile helper extraction in `f2de4377`; M108 OpenAI-compatible image payload helper extraction in `268ed882`; Stage Two M107 image dispatch helper extraction in `9764ba70`; UserProfileModal billing alias cleanup in `6c624909`; user API profile import cleanup in `27f03e62`; secure model proxy unused-helper cleanup in `318e6b1e`; cost service import cleanup in `651b54c5`; user API payload secret-constant cleanup in `63386046`; KK API client unused DTO cleanup in `0cc6c77c`; unreachable OpenAI image fallback cleanup in `96b94e5e`; OpenAI-compatible image-routing error classifier extraction in `8f878b3a`; OpenAI-compatible diagnostics preview extraction in `0edb13f5`; payment sidecar dependency audit coverage in `58be183d`; final-gate fixture repair in `ff419de9`; Stage Two M55 provider limit delegator pruning in `6902b79b`; Stage Two M54 effective provider model helper split in `dd2295d3`; Stage Two M53 global-model dead-code cleanup in `74d6345a`; Stage Two M52 model-list normalization helper split in `f5153811`; Stage Two M51 documented static model helper split in `81ba2a24`; Stage Two M50 provider presets helper split in `549a2422`; Stage Two M49 default model constants helper split in `7005bd50`; Stage Two M48 API type detector helper split in `f812b66c`; Stage Two M47 channel capabilities helper split in `8b40e892`; Stage Two M46 Google official model predicate split in `eb3ac527`; Stage Two M45 12AI base URL dead-code pruning in `6cada9ad`; Stage Two M44 deprecated-model helper split in `c435de27`; Stage Two M43 silent pricing URL helper split in `54cd8312`; Stage Two M42 model type inference helper split in `ea2ad869`; Stage Two M41 model category helper split in `46045a80`; Stage Two M40 pricing model ID extraction helper split in `031f3ec7`; Stage Two M39 legacy Google model constant pruning in `1214ab98`; Stage Two M38 browser-direct diagnostics wrapper pruning in `afe89b71`; Stage Two M37 dead-code pruning in `4658d947`; Stage Two M36 channel config secret redaction extraction in `7b54fd1a`; Stage Two M35 credential sanitizer extraction in `531eae6b`; Stage Two M34 route ID helper extraction in `a598312d`; Stage Two M33 provider usage helper extraction in `dd3ad358`; Stage Two M32 provider linked-slot matching helper in `615b7969`; Stage Two M31 provider runtime-state merge helper extraction in `56debf21`; Stage Two M30 model normalization facade consolidation in `08eb89d8`; Stage Two M29 keyManager key type split in `3ce7ae59`; Stage Two M28 keyManager model helper split in `a174b557`; Stage Two M27 prompt-node update helper in `b16843ee`; Stage Two M26 auto-arrange helper in `7cbd7346`; keyManager unused cleanup in `c85ab3f9`.
- Current commit scope: `src/services/llm/OpenAICompatibleAdapter.ts`, `src/services/llm/openAICompatibleTaskPayload.ts`, `tests/unit/openai-compatible-task-payload-contract.test.ts`, `tsconfig.tests.json`, and ledger updates.
- Browser QA: skipped for M110 because this is a non-UI service/source-contract extraction with no JSX, CSS, route rendering, or browser-visible behavior change.

## Completed Working Tree M102 (Gemini Service Unused Cleanup)

- Removed only compiler-proven unused imports/helpers from `src/services/llm/geminiService.ts`: the stale `GenerationMode`, auth/keyManager, API config, proxy config imports, the unused fallback flag cache/helper, the unused local-dev flag, and the unused `calculateImageTokens()` helper.
- Renamed the unread `negativePrompt` parameter to `_negativePrompt`, preserving the public parameter slot while keeping `llmService.generateImage(llmOptions)` and `calculateCost(...)` call shapes intact.
- Extended `tests/unit/llm-service-unused-cleanup-contract.test.ts` so the stale Gemini service imports/helpers do not return and the live generation/cost call sites remain source-contracted.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/llm-service-unused-cleanup-contract.test.ts` passed 2/2.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 24 broader historical diagnostics, with zero `src/services/llm/geminiService.ts` matches. The remaining diagnostics are `ApiSettingsView.tsx` 8, `useImageGeneration.ts` 8, `keyManager.ts` 6, and 2 source-contracted `secureModelProxy.ts` route-gate helpers.
- Fresh full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1296/1296; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and the path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI service cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/llm/geminiService.ts` is 523 physical lines; `tests/unit/llm-service-unused-cleanup-contract.test.ts` is 54 physical lines.

## Completed Working Tree M103 (Image Generation Hook Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/image-generation-unused-cleanup-contract.test.ts` failed first while `src/hooks/useImageGeneration.ts` still retained the stale imports, unused `useCanvas` destructures, the `GENERATE_TIMEOUT_MS` constant, the unused `uniqueRecoveredUrls.map(..., index)` parameter, and the unread `pendingTaskIds` local.
- Removed only the compiler-proven dead bindings from `src/hooks/useImageGeneration.ts`: `saveImage`, `isCreditBasedModel`, `GENERATE_TIMEOUT_MS`, `deleteImageNode`, `updateImageNode`, `updateImageNodePosition`, the unused `index` parameter in the recovered-url mapping, and the unread `pendingTaskIds` local.
- Added `tests/unit/image-generation-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so the stale hook bindings do not return while the persisted-media imports, billing coordinator calls, sync bridge recovery, and pending-task state transitions remain source-contracted.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/image-generation-unused-cleanup-contract.test.ts` passed 1/1.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 16 broader historical diagnostics, with zero `src/hooks/useImageGeneration.ts` matches. The remaining diagnostics are `ApiSettingsView.tsx` 8, `keyManager.ts` 6, and 2 source-contracted `secureModelProxy.ts` route-gate helpers.
- Fresh targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/image-generation-unused-cleanup-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-runtime-contract.test.ts tests/unit/ecommerce-structured-task-source-contract.test.ts tests/unit/partial-redraw-pipeline-contract.test.ts` passed 56/56.
- Fresh full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1297/1297; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and the path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI hook cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/hooks/useImageGeneration.ts` is 1863 physical lines; `tests/unit/image-generation-unused-cleanup-contract.test.ts` is 22 physical lines.

## Completed Working Tree M104 (API Settings Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/api-settings-unused-cleanup-contract.test.ts tests/unit/api-settings-view-source-guard.test.ts tests/unit/api-settings-encoding-guard.test.ts` failed first while `ApiSettingsView.tsx` still retained the stale health helper import, duplicate non-UI budget constants, unused provider metric helpers, and unread readonly fallback helpers.
- Removed only compiler-proven unused bindings from `src/components/settings/ApiSettingsView.tsx`: `isKkApiUserDataPersistedInCloudFromHealth`, the duplicate `TOKEN_UNIT_LABEL` / `LEGACY_TOKEN_LIMIT_LABEL` / `BUDGET_OPTIONS` constants, `getProviderUsageSummary`, `getProviderActivityLine`, `shouldUseReadonlyProfileFallback`, and `userApiReadOnlyHelper`.
- Added `tests/unit/api-settings-unused-cleanup-contract.test.ts`, updated the source/encoding guards to keep the active `UI_*` budget constants only, and registered the new contract in `tsconfig.tests.json`.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/api-settings-unused-cleanup-contract.test.ts tests/unit/api-settings-view-source-guard.test.ts tests/unit/api-settings-encoding-guard.test.ts` passed 6/6.
- Fresh API settings gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/api-settings*.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts" "tests/unit/settings-workbench-ui-refit.test.ts" "tests/unit/settings-canonical-entry-regression.test.ts"` passed 54/54.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 8 broader historical diagnostics, with zero `src/components/settings/ApiSettingsView.tsx` matches. The remaining diagnostics are `keyManager.ts` 6 and 2 source-contracted `secureModelProxy.ts` route-gate helpers.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1298/1298; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Browser QA passed through the Codex in-app Browser on `http://127.0.0.1:3100/settings/api-management?qa=api-settings-unused-cleanup-m104`: after using the local temporary-user entry, the API settings route rendered the expected API settings overview and provider sections, page title was `KK Studio - AI Image Workspace`, and current-tab console error count was `0`.
- Line counts for this slice: `src/components/settings/ApiSettingsView.tsx` is 3347 physical lines; `tests/unit/api-settings-unused-cleanup-contract.test.ts` is 28 physical lines.

## Completed Working Tree M105 (keyManager Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-dead-code-pruning-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts` failed first while `src/services/auth/keyManager.ts` still retained the stale `getProviderStorageKey`, `DEPRECATED_MODELS`, and `isDeprecatedModel` imports, unread `authHasSession`, unused private `getProviderStorageKey()` wrapper, unread `isCreditModel` local, and unused private `flushPendingProviderCloudSync()` wrapper.
- Removed only compiler-proven unused bindings from `src/services/auth/keyManager.ts`; provider persistence still marks `markPendingProviderCloudSync(this.cloudSyncState)` and calls the existing unified `flushPendingCloudSync()` path.
- Updated `tests/unit/key-manager-dead-code-pruning-contract.test.ts` and `tests/unit/key-manager-model-helpers-contract.test.ts` so the stale keyManager dead bindings cannot return while compatibility re-exports from `keyManagerModelHelpers.ts` remain intact.
- Updated `tests/unit/google-official-gemini-protocol-guards.test.ts` so Google TTS/audio coverage follows the live `modelCapabilities` / `keyManagerModelHelpers` / `inferModelType(baseId)` path instead of requiring the removed dead `isCreditModel` local.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/google-official-gemini-protocol-guards.test.ts tests/unit/key-manager-dead-code-pruning-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts` passed 11/11.
- Fresh keyManager/security-adjacent validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager*.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts" "tests/unit/runtime-legacy-fallback-guards.test.ts" "tests/unit/route-aware-credit-billing.test.ts" "tests/unit/generation-runtime-contract.test.ts"` passed 116/116.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 2 broader historical diagnostics, with zero `src/services/auth/keyManager.ts` matches. The remaining diagnostics are the 2 source-contracted `src/services/model/secureModelProxy.ts` route-gate helpers.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1298/1298; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Browser QA skipped: this is a non-UI service/source-contract cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/auth/keyManager.ts` is 4310 physical lines; `tests/unit/key-manager-dead-code-pruning-contract.test.ts` is 32 physical lines; `tests/unit/key-manager-model-helpers-contract.test.ts` is 217 physical lines; `tests/unit/google-official-gemini-protocol-guards.test.ts` is 60 physical lines.

## Completed Working Tree M106 (secureModelProxy Route Gate Wiring)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/user-route-proxy-routing.test.ts` failed first because `shouldUseLocalUserRouteApi` and `shouldUseLocalSystemProxy` were still dead declarations.
- Wired `shouldUseLocalUserRouteApi()` into `invokeLocalUserRouteProxy()` and `shouldUseLocalSystemProxy()` into `invokeLocalSystemProxy()` so the route gates are exercised at the live entrypoints without changing the current `return true` behavior.
- Updated `tests/unit/user-route-proxy-routing.test.ts` to lock the new gate usage and preserve the no-browser-direct / no-stale-fallback contracts.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/user-route-proxy-routing.test.ts tests/unit/secure-model-proxy-credit-contract.test.ts tests/unit/frontend-key-boundary-hardening.test.ts` passed 12/12.
- Fresh noUnused probe passed cleanly: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` returned exit 0.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1298/1298; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Browser QA skipped: this is a non-UI service/source-contract wiring slice with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/model/secureModelProxy.ts` is 1332 physical lines.

## Completed In `9764ba70` M107 (OpenAI-Compatible Image Dispatch Helper)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-dispatch-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` because `src/services/llm/openAICompatibleImageDispatch.ts` did not exist.
- Added `src/services/llm/openAICompatibleImageDispatch.ts` as a pure post-surface dispatch-plan helper. It returns only a `kind` plan and does not import or call request execution helpers, endpoint builders, auth helpers, fetch, or fallback handlers.
- Updated `src/services/llm/OpenAICompatibleAdapter.ts` so `generateImage()` still owns doc URL rejection, Wuyin/AceData short-circuits, `resolveChannelRuntime`, `resolveImageSurface`, logging, all `this.generate...` calls, endpoint/auth/fetch behavior, and the billing-safe compatibility throws, while the provider/image branch choice comes from `dispatchPlan.kind`.
- Updated `tests/unit/provider-image-routing-regression.test.ts` and added `tests/unit/openai-compatible-image-dispatch-contract.test.ts` so Suxi, GPT Best, Antigravity, 12AI async, chat strictness, provider-chat, and default fail-closed dispatch ordering remain source-contracted.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-dispatch-contract.test.ts tests/unit/openai-compatible-image-routing-errors-contract.test.ts tests/unit/openai-compatible-diagnostics-contract.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/provider-surface-router.test.ts tests/unit/provider-strategy.test.ts tests/unit/provider-channel-surface-view.test.ts tests/unit/twelve-ai-doc-alignment.test.ts tests/unit/async-image-proxy-regression.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/governance-contract.test.ts` passed 78/78.
- Fresh noUnused probe passed cleanly: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` returned exit 0.
- Fresh architecture and security validation passed: `npm.cmd run architecture:check`; `npm.cmd run governance:security`; `npm.cmd run audit:dependencies` found 0 vulnerabilities in root and `payment-server`.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1301/1301; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Browser QA skipped: this is a non-UI service/source-contract extraction with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` is 4339 physical lines; `src/services/llm/openAICompatibleImageDispatch.ts` is 91 physical lines; `tests/unit/openai-compatible-image-dispatch-contract.test.ts` is 127 physical lines; `tests/unit/provider-image-routing-regression.test.ts` is 173 physical lines.

## Completed In `268ed882` M108 (OpenAI-Compatible Image Payload Helper)

- RED evidence: the payload contract failed first before `src/services/llm/openAICompatibleImagePayload.ts` existed, and the existing base64 mime regression then failed because it still inspected the removed adapter-local implementation.
- Added `src/services/llm/openAICompatibleImagePayload.ts` as a pure payload parser for image URLs and base64 image fields. It accepts `unknown`, uses typed record/path helpers instead of adapter-local `any`, preserves upstream `mime_type` / `mimeType` values, and falls back to `image/png` only when no provider mime is present.
- Updated `src/services/llm/OpenAICompatibleAdapter.ts` to import `extractImageUrlsFromPayload()` and delegate all previous `this.extractImageUrlsFromPayload(...)` call sites. Endpoint selection, auth, fetch behavior, task polling, provider routing, and compatibility fallback ordering stayed in the adapter.
- Added `tests/unit/openai-compatible-image-payload-contract.test.ts`, registered it in `tsconfig.tests.json`, and retargeted the existing base64 mime regression to the helper source so the contract follows the new ownership boundary.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-payload-contract.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/openai-compatible-image-dispatch-contract.test.ts tests/unit/openai-compatible-image-routing-errors-contract.test.ts tests/unit/openai-compatible-diagnostics-contract.test.ts tests/unit/provider-surface-router.test.ts tests/unit/provider-strategy.test.ts tests/unit/provider-channel-surface-view.test.ts tests/unit/twelve-ai-doc-alignment.test.ts tests/unit/async-image-proxy-regression.test.ts` passed 62/62.
- Fresh noUnused probe passed cleanly: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` returned exit 0.
- Fresh architecture and security validation passed: `npm.cmd run architecture:check`; `npm.cmd run governance:security`; `npm.cmd run audit:dependencies` found 0 vulnerabilities in root and `payment-server`.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1305/1305; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Passed path-limited cached diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --cached --check -- src/services/llm/OpenAICompatibleAdapter.ts src/services/llm/openAICompatibleImagePayload.ts tests/unit/openai-compatible-image-payload-contract.test.ts tests/unit/provider-image-routing-regression.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md`.
- Browser QA skipped: this is a non-UI service/source-contract extraction with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` is 4247 physical lines; `src/services/llm/openAICompatibleImagePayload.ts` is 141 physical lines; `tests/unit/openai-compatible-image-payload-contract.test.ts` is 83 physical lines; `tests/unit/provider-image-routing-regression.test.ts` is 185 physical lines; `tsconfig.tests.json` is 135 physical lines.

## Completed In `f2de4377` M109 (OpenAI-Compatible Image Sizing Helper)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-sizing-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` because `src/services/llm/openAICompatibleImageSizing.ts` did not exist.
- Added `src/services/llm/openAICompatibleImageSizing.ts` as a pure helper for OpenAI image profile classification, aspect orientation, image-count clamping, generation-size resolution, and edit-size resolution.
- Updated `src/services/llm/OpenAICompatibleAdapter.ts` to delegate those helper calls while preserving `shouldUseOpenAIEditsEndpoint`, endpoint selection, auth, fetch behavior, task polling, provider routing, and compatibility fallback ordering in the adapter.
- Added `tests/unit/openai-compatible-image-sizing-contract.test.ts` and registered it in `tsconfig.tests.json` so model profile, aspect/count, generation sizes, edit sizes, and adapter delegation stay covered.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-sizing-contract.test.ts` passed 5/5.
- Fresh OpenAI/provider gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-sizing-contract.test.ts tests/unit/openai-compatible-image-payload-contract.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/openai-compatible-image-dispatch-contract.test.ts tests/unit/openai-compatible-image-routing-errors-contract.test.ts tests/unit/openai-compatible-diagnostics-contract.test.ts tests/unit/provider-surface-router.test.ts tests/unit/provider-strategy.test.ts tests/unit/provider-channel-surface-view.test.ts tests/unit/twelve-ai-doc-alignment.test.ts tests/unit/async-image-proxy-regression.test.ts` passed 67/67.
- Fresh noUnused probe passed cleanly: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` returned exit 0.
- Fresh architecture and security validation passed: `npm.cmd run architecture:check`; `npm.cmd run governance:security`; `npm.cmd run audit:dependencies` found 0 vulnerabilities in root and `payment-server`.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1310/1310; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Passed path-limited cached diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --cached --check -- src/services/llm/OpenAICompatibleAdapter.ts src/services/llm/openAICompatibleImageSizing.ts tests/unit/openai-compatible-image-sizing-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md`.
- Browser QA skipped: this is a non-UI service/source-contract extraction with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` is 4170 physical lines; `src/services/llm/openAICompatibleImageSizing.ts` is 81 physical lines; `tests/unit/openai-compatible-image-sizing-contract.test.ts` is 97 physical lines; `tsconfig.tests.json` is 136 physical lines.

## Completed Working Tree M110 (OpenAI-Compatible Task Payload Helper)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-task-payload-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` because `src/services/llm/openAICompatibleTaskPayload.ts` did not exist.
- Added `src/services/llm/openAICompatibleTaskPayload.ts` as a pure helper for generic task ID extraction, generic task status mapping, and batch task-item list extraction.
- Updated `src/services/llm/OpenAICompatibleAdapter.ts` to delegate those payload parsing calls while preserving `extractProviderMessage`, `buildPolledTaskResult`, endpoint selection, auth, fetch behavior, polling request URLs, backoff, provider branch selection, result metadata assembly, and fallback ordering in the adapter.
- Added `tests/unit/openai-compatible-task-payload-contract.test.ts` and registered it in `tsconfig.tests.json` so nested task IDs, mixed status signals, image URL success signals, batch item order, and adapter delegation stay covered.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-task-payload-contract.test.ts` passed 4/4.
- Fresh OpenAI/provider gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-task-payload-contract.test.ts tests/unit/openai-compatible-image-payload-contract.test.ts tests/unit/openai-compatible-image-sizing-contract.test.ts tests/unit/openai-compatible-image-dispatch-contract.test.ts tests/unit/openai-compatible-image-routing-errors-contract.test.ts tests/unit/provider-image-routing-regression.test.ts` passed 27/27.
- Fresh noUnused probe passed cleanly: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` returned exit 0.
- Fresh architecture validation passed: `npm.cmd run architecture:check` passed with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1314/1314; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Browser QA skipped: this is a non-UI service/source-contract extraction with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` is 4051 physical lines; `src/services/llm/openAICompatibleTaskPayload.ts` is 151 physical lines; `tests/unit/openai-compatible-task-payload-contract.test.ts` is 55 physical lines; `tsconfig.tests.json` is 137 physical lines.

## Completed Working Tree M93 (User API Profile Import-Only Cleanup)

- Removed only the unused `loadUserApisPayloadFromCloudRecord` named import from `src/services/api/userApiProfileStorage.ts`; the live metadata and cloud merge imports remain unchanged.
- Extended `tests/unit/runtime-legacy-fallback-guards.test.ts` so the stale import cannot return while typed auth API fallback, local bridge read/write, cloud merge, and legacy runtime guards stay covered by existing targeted tests.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/runtime-legacy-fallback-guards.test.ts tests/unit/user-api-runtime-fallback.test.ts tests/unit/user-api-profile-storage-runtime-fallback.test.ts tests/unit/user-api-profile-storage-local-only.test.ts tests/unit/user-api-profile-storage-local-priority.test.ts` passed 16/16.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits 2 on 45 broader historical diagnostics, with zero `src/services/api/userApiProfileStorage.ts` matches.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1289/1289; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` for the M93 paths passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI service import cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Next low-risk cleanup candidate after the M93 commit: remove the stale `billingFeatureEnabled` alias in `src/components/modals/UserProfileModal.tsx` and update `tests/unit/local-runtime-consistency-contract.test.ts` to assert the active `billingUiEnabled` gate instead.

## Completed Working Tree M94 (UserProfileModal Billing Alias Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/local-runtime-consistency-contract.test.ts` failed after the contract was updated to forbid `billingFeatureEnabled`, because the stale alias still existed in `src/components/modals/UserProfileModal.tsx`.
- Removed only the duplicate `const billingFeatureEnabled = KKAI_FEATURE_FLAGS.billing;` alias from `src/components/modals/UserProfileModal.tsx`; the live `billingUiEnabled` feature gate and all billing UI conditionals remain unchanged.
- Updated `tests/unit/local-runtime-consistency-contract.test.ts` to assert the live `billingUiEnabled` gate and prevent the stale alias from returning.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/local-runtime-consistency-contract.test.ts tests/unit/kkai-billing-ui-surface.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/user-profile-modal-auth-contract.test.ts` passed 10/10.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits 2 on 44 broader historical diagnostics, with zero `src/components/modals/UserProfileModal.tsx` and zero `billingFeatureEnabled` diagnostics.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1289/1289; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` for the M94 paths passed with LF/CRLF normalization warnings only.
- Browser QA passed: in-app browser smoke on `http://127.0.0.1:3100/?qa=user-profile-modal-billing-alias-m94` showed title `KK Studio - AI Image Workspace`, one visible `#root`, and zero browser console errors. Temporary Vite was stopped after the check.
- Line counts for this slice: `src/components/modals/UserProfileModal.tsx` 1388 lines; `tests/unit/local-runtime-consistency-contract.test.ts` 63 lines.

## Completed Working Tree M95 (User API Cloud Helper Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/runtime-legacy-fallback-guards.test.ts` failed after the contract was updated to forbid `function getErrorMessage(` in `src/services/api/userApiCloudRecordStorage.ts`.
- Removed only the uncalled private `getErrorMessage(error, fallback)` helper from `src/services/api/userApiCloudRecordStorage.ts`; no typed auth payload loading, local API fallback, cache, compaction, or secret redaction behavior changed.
- Extended `tests/unit/runtime-legacy-fallback-guards.test.ts` so the stale helper cannot return while existing legacy fallback and runtime routing guards remain intact.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/runtime-legacy-fallback-guards.test.ts tests/unit/user-api-cloud-storage.test.ts tests/unit/user-api-profile-storage-runtime-fallback.test.ts tests/unit/user-api-profile-storage-local-only.test.ts tests/unit/user-api-profile-storage-local-priority.test.ts` passed 33/33.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits 2 on 43 broader historical diagnostics, with zero `src/services/api/userApiCloudRecordStorage.ts` and zero `getErrorMessage` diagnostics.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1289/1289; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` for the M95 paths passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI API service helper cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/api/userApiCloudRecordStorage.ts` 840 lines; `tests/unit/runtime-legacy-fallback-guards.test.ts` 77 lines.

## Completed Working Tree M96 (NewAPI Management Service Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/billing-service-unused-cleanup-contract.test.ts` failed after the contract was added because `src/services/billing/newApiManagementService.ts` still imported unused `notify`.
- Removed only the unused `notify` import from `src/services/billing/newApiManagementService.ts` and changed `const channels = await this.getAllChannels();` to `await this.getAllChannels();`, preserving the preflight/cache side effect before the `/api/channel/balance` request.
- Added `tests/unit/billing-service-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so the stale import and unread binding do not return while the balance refresh request, cache update, and returned `updatedChannels` shape remain source-contracted.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/billing-service-unused-cleanup-contract.test.ts` passed 1/1.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 41 broader historical diagnostics, with zero `src/services/billing/newApiManagementService.ts` diagnostics.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1290/1290; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` for the M96 paths passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI billing service cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/billing/newApiManagementService.ts` moved from 553 to 552 physical lines; `tests/unit/billing-service-unused-cleanup-contract.test.ts` is 23 physical lines.

## Completed Working Tree M97 (Recharge Submission Service Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/billing-service-unused-cleanup-contract.test.ts` failed after the contract was extended because `src/services/billing/rechargeSubmissionService.ts` still declared `function normalizeRechargePaymentChannelConfig(`.
- Removed only the uncalled private `normalizeRechargePaymentChannelConfig(value)` helper from `src/services/billing/rechargeSubmissionService.ts`; no recharge bill/request construction, proof submission, route client, or channel list fallback behavior changed.
- Extended `tests/unit/billing-service-unused-cleanup-contract.test.ts` so the stale helper cannot return while `buildDefaultRechargePaymentChannelConfigs()`, `qrDisplay: normalizeQrDisplay({ ... })`, and `items: buildDefaultRechargePaymentChannelConfigs()` remain source-contracted.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/billing-service-unused-cleanup-contract.test.ts` passed 2/2.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 40 broader historical diagnostics, with zero `src/services/billing/rechargeSubmissionService.ts` diagnostics.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1291/1291; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` for the M97 paths passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI billing service cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/billing/rechargeSubmissionService.ts` moved from 688 to 670 physical lines; `tests/unit/billing-service-unused-cleanup-contract.test.ts` moved from 23 to 31 physical lines.

## Completed Working Tree M98 (Storage Adapter Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/storage-service-unused-cleanup-contract.test.ts` failed after adding the contract because `src/services/storage/storageAdapter.ts` still imported unused `compressIfNeeded`.
- Removed only the unused `compressIfNeeded` import from `src/services/storage/storageAdapter.ts` and dropped the unused `reject` Promise executor parameter in `getImageDimensionsFromFile`.
- Added `tests/unit/storage-service-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so the stale OPFS import and unused Promise parameter do not return while `img.onerror` still resolves the default `1024x1024` fallback.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/storage-service-unused-cleanup-contract.test.ts` passed 1/1.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 38 broader historical diagnostics, with zero `src/services/storage/storageAdapter.ts` diagnostics.
- Fresh full validation passed in this pass: `npm.cmd run typecheck`, `npm.cmd run test:unit` (1292/1292), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check`.
- Browser QA skipped: this is a non-UI storage adapter cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/storage/storageAdapter.ts` moved from 408 to 407 physical lines; `tests/unit/storage-service-unused-cleanup-contract.test.ts` is 18 physical lines.

## Completed Working Tree M99 (Storage Preference Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/storage-service-unused-cleanup-contract.test.ts` failed after adding the contract because `saveOriginalToLocalFolder` still exposed the unread `prompt?: string` parameter.
- Renamed only the unused `prompt` parameter in `src/services/storage/storagePreference.ts` to `_prompt`, preserving the public third-argument slot and the `saveOriginalToLocalFolder(id, blob, undefined, timestamp)` merge call shape.
- Extended `tests/unit/storage-service-unused-cleanup-contract.test.ts` so the local-folder save function keeps `_prompt?: string`, keeps the timestamp filename generation, and does not reintroduce the stale parameter name.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/storage-service-unused-cleanup-contract.test.ts` passed 2/2.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 37 broader historical diagnostics, with zero `src/services/storage/storagePreference.ts` diagnostics.
- Fresh full validation passed in this pass: `npm.cmd run typecheck`, `npm.cmd run test:unit` (1293/1293), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check`.
- Browser QA skipped: this is a non-UI storage preference parameter cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/storage/storagePreference.ts` stayed at 334 physical lines; `tests/unit/storage-service-unused-cleanup-contract.test.ts` moved from 18 to 25 physical lines.

## Completed Working Tree M100 (Image Storage Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/storage-service-unused-cleanup-contract.test.ts` failed after adding the contract because `cleanupOriginals()` still acquired an unread `const db = await openDB();` handle.
- Removed only the unused `db` local from `src/services/storage/imageStorage.ts` `cleanupOriginals()`, preserving `getImageCount()`, `getImagesPage()`, compression, `saveImage()`, and saved-byte accounting.
- Extended `tests/unit/storage-service-unused-cleanup-contract.test.ts` so the cleanup helper keeps paginated reads and saves while the stale unread database handle does not return.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/storage-service-unused-cleanup-contract.test.ts` passed 3/3.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 36 broader historical diagnostics, with zero `src/services/storage/imageStorage.ts` diagnostics.
- Fresh full validation passed in this pass: `npm.cmd run typecheck`, `npm.cmd run test:unit` (1294/1294), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check`.
- Browser QA skipped: this is a non-UI image storage cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/storage/imageStorage.ts` moved from 1072 to 1071 physical lines; `tests/unit/storage-service-unused-cleanup-contract.test.ts` moved from 25 to 35 physical lines.

## Completed Working Tree M101 (Google Adapter Import Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/llm-adapter-unused-cleanup-contract.test.ts` failed after adding the contract because `src/services/llm/GoogleAdapter.ts` still imported unused `ProviderConfig`, `VideoGenerationOptions`, `VideoGenerationResult`, and `logWarning`.
- Removed only those import-only unused symbols from `src/services/llm/GoogleAdapter.ts`, preserving `logError` and the inline `import('./LLMAdapter').VideoGenerationOptions` / `VideoGenerationResult` references in `generateVideo()`.
- Extended `tests/unit/llm-adapter-unused-cleanup-contract.test.ts` so the Google adapter import list stays clean while the inline video generation type references remain present.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/llm-adapter-unused-cleanup-contract.test.ts` passed 2/2.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 32 broader historical diagnostics, with zero `src/services/llm/GoogleAdapter.ts` diagnostics.
- Fresh full validation passed in this pass: `npm.cmd run typecheck`, `npm.cmd run test:unit` (1295/1295), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check`.
- Browser QA skipped: this is a non-UI import-only Google adapter cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/llm/GoogleAdapter.ts` stayed at 823 physical lines; `tests/unit/llm-adapter-unused-cleanup-contract.test.ts` moved from 20 to 30 physical lines.

## Completed In `9e7ae2b5` (Clay UI Audit Closure)

- User override remains active: inputs, main cards, sub cards, and framework cards must use controlled frosted material; dark mode must use neutral black/gray surfaces, not teal/blue/indigo canvas.
- Fixed in this pass: Profile Modal action list/security surfaces, toolbar selected tokens, TagInputModal shell/input/footer, ProjectManager dropdown/modal sub surfaces, ChatSidebar message/attachment sub surfaces, PromptBar sky/white-glass skeleton and drag placeholder surfaces, mobile framework shell glass aliases, mobile advanced drawer white-glass utilities, mobile card index/empty/badge blue surfaces, EcommerceImportPanel hover glass, SearchPalette multi-select readability, RechargeModal dark CTA readability, API Workspace nested-card reduction, ChatSidebar agent active state, and PromptNode violet/blue badge drift.
- Light-theme readability was hardened by adding readable Clay emphasis text tokens (`--clay-brand-pink-ink`, `--clay-brand-coral-ink`) while keeping brand pink/coral for tinted fills and borders.
- Contract coverage now includes frosted input/main/sub/framework tokens, neutral black-gray dark variables, readable light emphasis text on tinted states, toolbar selected tokens, ProjectManager sub surfaces, ChatSidebar message/attachment surfaces, TagInputModal frosted tokens, PromptBar stale blue/white-glass regressions, mobile shell and mobile badge/index regressions, ecommerce hover token use, SearchPalette multi-select token use, RechargeModal CTA readability, API Workspace reduced nesting, ChatSidebar active-state token use, and PromptNode badge color regressions.
- Browser QA for this lane is complete and tracked below.
- Commit scope was UI/doc/test only and explicitly excluded runtime/PPT/ecommerce extraction WIP.

## Completed In `d12731ce` (Ecommerce Partial Redraw Runtime)

- Added `src/app/useEcommercePartialRedrawRuntime.ts` for ecommerce inherited redraw context resolution and ecommerce redraw result finalization.
- `src/App.tsx` now wires the partial-redraw hook through `resolveEcommercePartialRedrawContext` and `finalizeEcommercePartialRedrawResult`; App no longer owns the inline ecommerce inherited redraw context branch or the ecommerce redraw result re-parent/finalization branch inside `handlePartialRedrawRequest`.
- The hook receives dependencies through `UseEcommercePartialRedrawRuntimeDeps`: active canvas ref plus the image/prompt mutation callbacks needed to re-parent finalized ecommerce redraw results.
- New contract coverage in `tests/unit/ecommerce-partial-redraw-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, App wiring, and the extracted ecommerce redraw inheritance/finalization behavior. Existing `ecommerce-structured-task-source`, `partial-redraw-pipeline`, and `mobile-result-feed-app` tests were rerun as redraw-path regression guards.
- `tsconfig.tests.json` now semantically checks 31 test files.
- Line counts after extraction: `src/App.tsx` 4389 physical lines; `src/app/useEcommercePartialRedrawRuntime.ts` 91 physical lines; `tests/unit/ecommerce-partial-redraw-runtime-contract.test.ts` 55 physical lines; `tsconfig.tests.json` 60 physical lines.
- Targeted validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-partial-redraw-runtime-contract.test.ts tests/unit/ecommerce-structured-task-source-contract.test.ts tests/unit/partial-redraw-pipeline-contract.test.ts tests/unit/mobile-result-feed-app-contract.test.ts` passed (6/6).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 31 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1113/1113).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommercePartialRedrawRuntime.ts tests/unit/ecommerce-partial-redraw-runtime-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped for this slice because it is non-UI runtime glue that preserves the existing workspace and prompt surfaces. The Clay UI lane browser evidence remains recorded below.
- Commit include scope for this runtime slice: `status.md`, `plans.md`, `implement.md`, `validation.md`, `tsconfig.tests.json`, `src/App.tsx`, `src/app/useEcommercePartialRedrawRuntime.ts`, and `tests/unit/ecommerce-partial-redraw-runtime-contract.test.ts`.
- Explicitly excluded scope: Clay UI docs/styles/components, non-ecommerce redraw UI surfaces, PPT/generation runtime files, and unrelated ecommerce runtime slices not touched by the current partial-redraw extraction.

## Current Quality Baseline

- Current giant tracked files after the M106 working tree: `src/index.css` 11735 physical lines, `src/App.tsx` 4305, `src/services/auth/keyManager.ts` 4310, `src/services/llm/OpenAICompatibleAdapter.ts` 3819, `src/components/layout/PromptBar.tsx` 3631, `src/components/settings/ApiSettingsView.tsx` 3347, `src/components/layout/ChatSidebar.tsx` 2477, `src/app/useGenerationRuntime.ts` 2341, `src/context/CanvasContext.tsx` 2196, `src/components/canvas/PromptNodeComponent.tsx` 2091, `src/hooks/useImageGeneration.ts` 1863, `src/services/model/modelCapabilities.ts` 1705, `src/services/storage/fileSystemService.ts` 1384, `src/services/model/secureModelProxy.ts` 1332, `src/services/billing/costService.ts` 792, `src/services/chat/chatService.ts` 156, `src/app/useWorkflowActions.ts` 459, `src/components/settings/ProjectManager.tsx` 764, `src/components/Onboarding/OnboardingManager.tsx` 262, `src/components/Onboarding/OnboardingOverlay.tsx` 200, `src/components/Onboarding/useOnboardingProgress.ts` 137, and `src/components/Onboarding/AchievementToast.tsx` 60. Current SystemLogs line counts: `SystemLogsView.tsx` 421 and `SystemLogsView.localized.tsx` 450.
- Current tracked TS/TSX debt scan by alternate-git `git grep` over `*.ts` / `*.tsx`: direct `as any` matches 155, explicit any-type pattern matches 421, `@ts-ignore` / `@ts-expect-error` matches 133, and `console.log` matches 245. The M106 production noUnused filter now passes cleanly, with zero `src/services/auth/keyManager.ts` diagnostics and zero `src/services/model/secureModelProxy.ts` diagnostics. These are refactor debt indicators, not release blockers by themselves.
- Quality rule going forward: reduce `any`, TypeScript suppressions, and bare `console.log` inside touched files when local and safe; do not perform a whole-repo cleanup inside one runtime or architecture extraction.
- Architecture status from the latest full check: `npm.cmd run architecture:check` passed with 5 allowlisted migration exceptions and 2 allowlisted legacy bridge exceptions; `npm.cmd run spec:check` passed.
- Version governance status from the latest full check: `npm.cmd run governance:check` passed; version metadata is aligned to `1.4.2`.
- Dependency audit status: `npm.cmd run audit:dependencies` passed for both root and `payment-server` production dependency graphs with `found 0 vulnerabilities`.

## Working Tree M86 (Chat Service Unused Cleanup)

- RED evidence from the prior handoff was preserved: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/chat-service-unused-cleanup-contract.test.ts` failed first while `GOOGLE_API_BASE` and `const errorText = await response.text();` were still present.
- Removed only the compiler-proven unused `GOOGLE_API_BASE` import and unread `errorText` local from `src/services/chat/chatService.ts`.
- Added `tests/unit/chat-service-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so those stale service locals do not return.
- Review fix: preserved the existing `await response.text();` call on non-OK responses so body-read rejection behavior remains unchanged while the unread `errorText` binding stays removed. RED evidence for this review fix: the updated contract failed while the body read was absent, then passed after restoring the awaited read.
- Preserved chat storage, saved-message/session behavior, request body construction, URL/header construction through `buildApiUrl` and `buildHeaders`, keyManager success/failure reporting, provider/model routing, and the existing `API 请求失败: ${status}` error semantics.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/chat-service-unused-cleanup-contract.test.ts` (1/1).
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` still fails on broader repository TS6133/TS619x debt but has zero `src/services/chat/chatService.ts` matches and 53 diagnostics overall.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed `1288/1288`; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` for the M86 paths passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI service cleanup with no JSX/CSS/browser-visible behavior changes.
- Explicitly excluded scope: chat UI, storage persistence redesign, request body changes, keyManager behavior, provider routing, API/settings surfaces, endpoint/auth changes, release metadata, payment business logic, security policy changes, and broad any/console cleanup.

## Completed In `a4032085` (Generation Runtime Contract Test Cleanup)

- RED evidence: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false -p tsconfig.tests.json` reported unused locals in `tests/unit/generation-runtime-contract.test.ts` at the retry video request/result/timing source-slice checks.
- Removed only compiler-proven unused local source slices from `tests/unit/generation-runtime-contract.test.ts`; the production `src/app/useGenerationRuntime.ts` source and runtime behavior were not changed.
- While fixing the cleanup, the targeted contract test caught one over-broad slice restoration; the final patch narrows the two used `retryAttemptsSource` slices to the `runRetryGeneratedMediaAttempts` function body only.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts` passed `51/51`.
- Filtered noUnused validation passed: forcing `tsconfig.tests.json` with noUnused still reports broader historical test-config/type debt, but has zero `tests/unit/generation-runtime-contract.test.ts` matches.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed `1288/1288`; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` for the M87 paths passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a test-only cleanup with no production source, JSX, CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: production generation runtime code, App wiring, billing behavior, retry generation behavior, provider routing, endpoint/auth changes, release metadata, UI/browser behavior, and broad any/console cleanup.

## Completed In `d075e6fd` (Prompt Optimizer Duplicate Tab Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-optimizer-service-source-contract.test.ts` failed while `src/services/llm/promptOptimizerService.ts` still declared `const DEFAULT_TABS:`.
- Removed only the duplicate unused `DEFAULT_TABS` constant from `src/services/llm/promptOptimizerService.ts`; the live `HUMAN_DEFAULT_TABS` constant and `tabs: HUMAN_DEFAULT_TABS,` result payload wiring remain intact.
- Added source-contract assertions in `tests/unit/prompt-optimizer-service-source-contract.test.ts` so the `DEFAULT_TABS` declaration and `tabs: DEFAULT_TABS,` payload wiring do not return, and `HUMAN_DEFAULT_TABS` remains the prompt optimizer tab payload source.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-optimizer-service-source-contract.test.ts` passed 6/6.
- Filtered noUnused validation passed for this slice: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits 2 on 52 broader historical diagnostics, but has zero `src/services/llm/promptOptimizerService.ts` matches.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 100 files); `npm.cmd run test:unit` passed 1288/1288; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI service/source-contract cleanup with no JSX/CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: prompt optimization behavior, automatic route selection, provider routing, Gemini/API settings, endpoint/auth changes, billing/payment behavior, release metadata, UI/browser behavior, storage persistence, keyManager secrets, and broad any/console cleanup.

## Completed In `0cc6c77c` (KK API Client Unused DTO Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/kk-api-client.test.ts` failed while `packages/contracts/src/client/kk-api-client.ts` still imported `AdminRechargeSubmissionDto`.
- Removed only the compiler-proven unused direct `AdminRechargeSubmissionDto` import from `packages/contracts/src/client/kk-api-client.ts`; the public DTO remains exported from `packages/contracts/src/dto/billing.ts` through the package index.
- Added source-contract coverage in `tests/unit/kk-api-client.test.ts` so the public billing DTO export remains present, the client does not regain the unused direct DTO import, and the recharge-submission client methods keep the response DTO types.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/kk-api-client.test.ts` passed 24/24.
- Review-fix validation passed after replacing deep `packages/contracts/src/` string literals in the test with `path.join(...)`: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/kk-api-client.test.ts tests/unit/governance-contract.test.ts` passed 37/37.
- Filtered noUnused validation passed for this slice: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits 2 on 51 broader historical diagnostics, but has zero `packages/contracts/src/client/kk-api-client.ts` matches.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 100 files); `npm.cmd run test:unit` passed 1289/1289; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a contract-client type import cleanup with no JSX/CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: public DTO shape changes, client endpoint path changes, auth/header behavior, payment/billing business logic, provider routing, API/settings UI files, release metadata, storage persistence, and broad any/console cleanup.

## Completed In `63386046` (User API Payload Secret-Constant Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/billing-remaining-balance-contract.test.ts tests/unit/user-api-cloud-storage.test.ts` failed while `src/services/api/userApiPayload.ts` still declared `CLIENT_VISIBLE_SECRET_PLACEHOLDER`.
- Removed only the compiler-proven unused duplicate `CLIENT_VISIBLE_SECRET_PLACEHOLDER` and `REDACTED_SECRET_PREFIX` constants from `src/services/api/userApiPayload.ts`.
- Added source-contract coverage in `tests/unit/billing-remaining-balance-contract.test.ts` so the live placeholder/redaction policy remains in `src/services/api/userApiCloudRecordStorage.ts`, while the payload sanitizer does not regain the unused duplicate constants.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/billing-remaining-balance-contract.test.ts tests/unit/user-api-cloud-storage.test.ts` passed 27/27.
- Filtered noUnused validation passed for this slice: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits 2 on 49 broader historical diagnostics, but has zero `src/services/api/userApiPayload.ts` matches.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 100 files); `npm.cmd run test:unit` passed 1289/1289; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI API payload/source-contract cleanup with no JSX/CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: secret redaction behavior changes, cloud record storage persistence behavior, API/settings UI files, endpoint/auth behavior, billing/payment business logic, provider routing, release metadata, storage migration, and broad any/console cleanup.

## Completed In `651b54c5` (Cost Service Import-Only Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/import-only-unused-cleanup-contract.test.ts` failed while `src/services/billing/costService.ts` still imported `ModelType` and `getRefImageTokenEstimate`.
- Removed only the compiler-proven unused `ModelType` and `getRefImageTokenEstimate` imports from `src/services/billing/costService.ts`.
- Added source-contract coverage in `tests/unit/import-only-unused-cleanup-contract.test.ts` so `costService.ts` keeps the live `ImageSize`, `getModelPricing`, `getImageTokenEstimate`, `calculateCost`, and `resolveImageCost` surface while the stale imports do not return.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/import-only-unused-cleanup-contract.test.ts` passed 1/1.
- Filtered noUnused validation passed for this slice: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits 2 on 47 broader historical diagnostics, but has zero `src/services/billing/costService.ts` matches.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 100 files); `npm.cmd run test:unit` passed 1289/1289; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI import-only service/source-contract cleanup with no JSX/CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: pricing tables, cost calculation formulas, key-slot pricing snapshot lookup, cost recording/sync behavior, provider routing, API/settings UI files, endpoint/auth behavior, storage persistence, release metadata, and broad any/console cleanup.

## Working Tree M92 (Secure Model Proxy Unused-Helper Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/user-route-proxy-routing.test.ts` failed while `src/services/model/secureModelProxy.ts` still declared `async function buildInvocationError(`.
- Removed only the uncalled private `buildInvocationError` helper from `src/services/model/secureModelProxy.ts`.
- Added source-contract coverage in `tests/unit/user-route-proxy-routing.test.ts` so the local system/user-route gate helpers remain present and `buildInvocationError` does not return.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/user-route-proxy-routing.test.ts tests/unit/secure-model-proxy-credit-contract.test.ts tests/unit/secure-model-proxy-trace-contract.test.ts tests/unit/async-image-proxy-regression.test.ts tests/unit/local-model-proxy-trace-contract.test.ts` passed 9/9.
- Filtered noUnused validation passed for this slice: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits 2 on 46 broader historical diagnostics; `src/services/model/secureModelProxy.ts` has only the two expected local route gate diagnostics and no `buildInvocationError` diagnostic.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 100 files); `npm.cmd run test:unit` passed 1289/1289; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI proxy service/source-contract cleanup with no JSX/CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: local/system proxy endpoints, route-gate helper bodies, session/auth invalidation, retry behavior, provider routing, API/settings UI files, billing/payment behavior, keyManager secret storage, storage persistence, release metadata, and broad any/console cleanup.

## Completed In `b9baa445` (PromptBar/ImageCard Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ui-unused-cleanup-contract.test.ts` failed first on the stale `PromptBar` ratio icon helpers and `ImageCard2` lightbox imports/state.
- Removed unused `PromptBar.tsx` imports, stale ratio icon helpers, unused surface constants, unreachable flying-image animation state/JSX, unread hover timer state, unused dropped data extraction, unused current-model surface flag, duplicate unused JSX node islands, and unused destructured props. The model settings modal save button now calls `saveModelCustomization(...)` instead of closing without persisting.
- Removed unused `ImageCard2.tsx` imports, stale lightbox zoom/pan refs/state, and the unused adaptive sub-border calculation.
- Added `tests/unit/ui-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so the removed stale UI code does not return.
- Fresh TS6133 probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `PromptBar.tsx` / `ImageCard2.tsx` matches. The broader repository still has TS6133 debt led by `src/App.tsx` plus other legacy files, so those cleanups remain separate future slices.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-bar-*.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-visual-regression.test.ts tests/unit/ui-unused-cleanup-contract.test.ts` passed 39/39.
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run governance:security`, `npm.cmd run audit:dependencies`, `npm.cmd run spec:check`, `npm.cmd run governance:check`, `npm.cmd run typecheck`, `npm.cmd run test:unit` (1262/1262), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check`.
- Browser QA passed through the Codex in-app Browser against a temporary static server serving `dist` at `http://127.0.0.1:3000/`: title `KK Studio - AI Image Workspace`, workspace/login/prompt signals present, prompt composer text present, and console error count `0`. The project `dev:start` Vite process still exits immediately in this desktop environment, so this browser QA used the already-built production output instead of Vite HMR.
- Explicitly excluded scope: `src/App.tsx`, OpenAI provider routing, API/auth routes, payment/server logic, release metadata, PPT/runtime behavior, and broad any/console cleanup.

## Completed In `b6767e85` (App Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/app-unused-cleanup-contract.test.ts` failed first on stale App imports such as `PendingNode`.
- Removed compiler-proven unused `src/App.tsx` imports, context/hook destructures, the stale `pendingPrompt` state tuple, unused connector/prompt-group/workflow resolver outputs, dormant cut-connection/image-pin callbacks with no live callers, and unused callback parameters.
- Added `tests/unit/app-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so removed App stale symbols do not return.
- Fresh TS6133/TS619x probe at that commit: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` had zero `src/App.tsx` matches. The broader repository still had TS6133/TS619x debt led by `src/services/llm/OpenAICompatibleAdapter.ts`, `src/services/llm/LLMService.ts`, `src/components/layout/ChatSidebar.tsx`, and `src/components/canvas/PromptNodeComponent.tsx`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/app-unused-cleanup-contract.test.ts tests/unit/ecommerce-framework-contract.test.ts tests/unit/ui-unused-cleanup-contract.test.ts` passed 4/4, and the broader App/Canvas/Workflow targeted gate passed 121/121.
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run governance:security`, `npm.cmd run audit:dependencies`, `npm.cmd run spec:check`, `npm.cmd run governance:check`, `npm.cmd run typecheck` (test semantic coverage 81 files), `npm.cmd run test:unit` (1263/1263), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check`.
- Explicitly excluded scope: OpenAI provider routing, keyManager, ChatSidebar, PromptNodeComponent, API/auth routes, release metadata, payment business logic, PPT/runtime behavior, and broad any/console cleanup.

## Completed In `fafecef9` (OpenAI-Compatible Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-unused-cleanup-contract.test.ts` failed first on stale imports such as `AudioGenerationOptions`.
- Removed compiler/source-proven unused `OpenAICompatibleAdapter.ts` imports, renamed the unread `supports` parameter, deleted the private unused `is12AIGateway` helper, deleted the unused static `normalizeUrl` helper, and removed unread chat-image local variables without changing endpoint selection, auth, fetch behavior, fallback ordering, request body routing, UI, or release metadata.
- Added `tests/unit/openai-compatible-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so those stale adapter symbols do not return.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/services/llm/OpenAICompatibleAdapter.ts` matches. The broader repository still has 154 TS6133/TS619x diagnostics led by `src/services/llm/LLMService.ts`, `src/components/layout/ChatSidebar.tsx`, `src/components/canvas/PromptNodeComponent.tsx`, and `src/services/storage/fileSystemService.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-unused-cleanup-contract.test.ts tests/unit/openai-compatible-image-routing-errors-contract.test.ts tests/unit/openai-compatible-diagnostics-contract.test.ts` passed 8/8.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 82 files), `npm.cmd run test:unit` (1264/1264), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check`.
- Explicitly excluded scope: OpenAI provider routing extraction, endpoint/auth changes, fallback-order changes, keyManager, LLMService, ChatSidebar, PromptNodeComponent, API/auth routes, release metadata, payment business logic, PPT/runtime behavior, UI behavior, and broad any/console cleanup.

## Completed In `783fddeb` (LLMService Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/llm-service-unused-cleanup-contract.test.ts` failed first on stale imports such as `ProviderConfig`.
- Removed compiler/source-proven unused `LLMService.ts` imports, stale private direct adapter call helpers, unused adapter fields, and unread public parameters while preserving the existing local user-route proxy first, secure proxy fallback, billing metadata, task status routing, and browser-direct blocking contracts.
- Added `tests/unit/llm-service-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so those stale LLMService symbols do not return.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/services/llm/LLMService.ts` matches. The broader repository still has 140 TS6133/TS619x diagnostics led by `src/components/layout/ChatSidebar.tsx`, `src/components/canvas/PromptNodeComponent.tsx`, `src/services/storage/fileSystemService.ts`, `src/services/llm/geminiService.ts`, `src/components/settings/ApiSettingsView.tsx`, and `src/hooks/useImageGeneration.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/llm-service-unused-cleanup-contract.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/user-route-proxy-routing.test.ts tests/unit/async-image-proxy-regression.test.ts tests/unit/secure-model-proxy-credit-contract.test.ts tests/unit/secure-model-proxy-trace-contract.test.ts` passed 16/16.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 83 files), `npm.cmd run test:unit` (1265/1265), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check`.
- Explicitly excluded scope: proxy route order changes, endpoint/auth changes, fallback behavior changes, keyManager, ChatSidebar, PromptNodeComponent, API/auth routes, release metadata, payment business logic, PPT/runtime behavior, UI behavior, and broad any/console cleanup.

## Completed In `92ee7a4f` (Pure Utility Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/pure-utility-unused-cleanup-contract.test.ts` failed first on stale `promptCardHeight`.
- Removed compiler/source-proven unused layout locals and the now-unused layout helper arguments from `src/app/promptGroupRenderLayout.ts` plus the corresponding `src/App.tsx` call site. Removed unused private helper constants/functions from `src/utils/modelSorting.ts`.
- Added `tests/unit/pure-utility-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so those stale utility symbols do not return.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/app/promptGroupRenderLayout.ts`, `src/utils/modelSorting.ts`, and `src/App.tsx` matches. The broader repository still has 135 TS6133/TS619x diagnostics led by `src/components/layout/ChatSidebar.tsx`, `src/components/canvas/PromptNodeComponent.tsx`, `src/services/storage/fileSystemService.ts`, `src/services/llm/geminiService.ts`, `src/components/settings/ApiSettingsView.tsx`, and `src/hooks/useImageGeneration.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/pure-utility-unused-cleanup-contract.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/ui-unused-cleanup-contract.test.ts` passed 45/45.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 84 files), `npm.cmd run test:unit` (1266/1266), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check` with LF/CRLF normalization warnings only.
- Explicitly excluded scope: prompt-group behavior changes, model sorting behavior changes, ChatSidebar, PromptNodeComponent, file-system persistence behavior, keyManager, provider routing, endpoint/auth changes, release metadata, payment business logic, PPT/runtime behavior, visible UI behavior changes, and broad any/console cleanup.

## Completed In `3108a29f` (ChatSidebar Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/chat-sidebar-unused-cleanup-contract.test.ts` failed first on stale `Eraser`.
- Removed compiler/source-proven unused ChatSidebar icon imports, the unread `viewportHeight` state/update, stale derived session lists, unused drag/source-preview/clear/transform callbacks, and no model-selection, billing, session-tree, provider-routing, or visual redesign behavior.
- Added `tests/unit/chat-sidebar-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so those stale ChatSidebar symbols do not return.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/layout/ChatSidebar.tsx` matches. The broader repository still has 123 TS6133/TS619x diagnostics led by `src/components/canvas/PromptNodeComponent.tsx`, `src/services/storage/fileSystemService.ts`, `src/components/settings/ApiSettingsView.tsx`, `src/services/llm/geminiService.ts`, and `src/hooks/useImageGeneration.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/chat-sidebar-unused-cleanup-contract.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/capability-route-runtime-preference-contract.test.ts tests/unit/kkai-billing-ui-surface.test.ts tests/unit/model-library-public-admin-browse.test.ts tests/unit/model-library-open-guards.test.ts tests/unit/prompt-bar-model-library-loading.test.ts tests/unit/clay-frosted-surface-contract.test.ts` passed 25/25.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 85 files), `npm.cmd run test:unit` (1267/1267), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check` with LF/CRLF normalization warnings only.
- Explicitly excluded scope: model-selection behavior changes, billing behavior changes, session-tree behavior changes, provider routing, endpoint/auth changes, release metadata, payment business logic, PPT/runtime behavior, broad UI redesign, PromptNodeComponent, fileSystemService, keyManager, and broad any/console cleanup.

## Completed In `0efba271` (PromptNode Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-node-unused-cleanup-contract.test.ts` failed first on stale `Pin` / `ChevronRight` imports and unused component locals.
- Removed compiler/source-proven unused PromptNode icon imports, unused destructured props, and write-only error/trace detail state resets. Kept `PromptNodeProps` and the memo comparator fields intact so App/interface compatibility is not narrowed by this cleanup.
- Added `tests/unit/prompt-node-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so those stale PromptNode locals do not return.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/canvas/PromptNodeComponent.tsx` matches. The broader repository still has 112 TS6133/TS619x diagnostics led by `src/services/storage/fileSystemService.ts`, `src/components/settings/ApiSettingsView.tsx`, `src/services/llm/geminiService.ts`, `src/hooks/useImageGeneration.ts`, and `src/services/auth/keyManager.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-node-unused-cleanup-contract.test.ts tests/unit/prompt-node-optimizer-display-contract.test.ts tests/unit/prompt-optimizer-service-source-contract.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-visual-regression.test.ts tests/unit/ppt-deck-single-container-contract.test.ts tests/unit/ecommerce-card-thumbnail-labels.test.ts tests/unit/ecommerce-canvas-contract.test.ts tests/unit/ecommerce-display-label-surface.test.ts` passed 28/28.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 86 files), `npm.cmd run test:unit` (1268/1268), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check` with LF/CRLF normalization warnings only.
- Browser QA passed through the Codex in-app Browser against a clean no-store static server serving the production `dist` at `http://127.0.0.1:3100/?qa=prompt-node-current-filter-1777885534253`: title `KK Studio - AI Image Workspace`, workspace/app signals present, no connection-refused text, no render-error text, and `0` console errors when filtered to `127.0.0.1:3100`. The reused `127.0.0.1:3000` browser context still reports stale old `SettingsPanel-B5I0Hz83.js` chunk errors from old `index-BXDFT_I2.js` / `vendor-BDC5j-FW.js`; current served `dist/index.html` points at the new `index-CMum-9ZQ.js`, so the stale 3000 logs are recorded as browser cache residue rather than a current-build blocker.
- Explicitly excluded scope: PromptNode visual redesign, App prop/interface narrowing, ecommerce/PPT/runtime behavior changes, provider routing, endpoint/auth changes, storage behavior, release metadata, payment business logic, ChatSidebar, keyManager, and broad any/console cleanup.

## Completed In `0797bf95` (SystemLogs Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/system-logs-unused-cleanup-contract.test.ts` failed first on the stale `Activity` import and unused `importantLogs` derived values.
- Removed compiler/source-proven unused `Activity` from `src/components/settings/views/SystemLogsView.tsx` and removed the unused `importantLogs` `useMemo` blocks from both SystemLogs view variants. No log filtering, export, stream, clear, confirmation, notification, or settings routing behavior was changed.
- Added `tests/unit/system-logs-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so those stale SystemLogs locals do not return.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/settings/views/SystemLogsView` matches. The broader repository still has 109 TS6133/TS619x diagnostics led by `src/services/storage/fileSystemService.ts`, `src/hooks/useImageGeneration.ts`, `src/components/settings/ApiSettingsView.tsx`, `src/services/llm/geminiService.ts`, and `src/services/auth/keyManager.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/system-logs-unused-cleanup-contract.test.ts tests/unit/settings-workbench-ui-refit.test.ts tests/unit/settings-canonical-entry-regression.test.ts` passed 15/15.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 87 files), `npm.cmd run test:unit` (1269/1269), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check` with LF/CRLF normalization warnings only.
- Browser QA passed through the Codex in-app Browser against a clean no-store static server serving the production `dist` at `http://127.0.0.1:3101/?qa=system-logs-cleanup-1777887594776`: title `KK Studio - AI Image Workspace`, workspace/app signals present, no connection-refused text, no render-error text, and `0` console errors when filtered to `127.0.0.1:3101`.
- Explicitly excluded scope: SystemLogs visual redesign, destructive log action changes, settings routing changes, storage behavior, keyManager secret storage, provider routing, proxy/billing routes, endpoint/auth changes, release metadata, payment business logic, PPT/runtime behavior, and broad any/console cleanup.

## Completed In `f453cd9a` (AchievementToast Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/onboarding-unused-cleanup-contract.test.ts` failed first on the stale `Star` import in `src/components/Onboarding/AchievementToast.tsx`.
- Removed compiler/source-proven unused `Star` from `src/components/Onboarding/AchievementToast.tsx`. No onboarding behavior, timing, visibility, or close handling changed.
- Added `tests/unit/onboarding-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so that stale import does not return.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/Onboarding/AchievementToast.tsx` matches. The broader repository still has 108 TS6133/TS619x diagnostics led by `src/services/storage/fileSystemService.ts`, `src/hooks/useImageGeneration.ts`, `src/components/settings/ApiSettingsView.tsx`, `src/services/llm/geminiService.ts`, and `src/services/auth/keyManager.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/onboarding-unused-cleanup-contract.test.ts` passed 1/1.
- Browser QA passed through the Codex in-app Browser against a no-store Node static server serving the production `dist` at `http://127.0.0.1:3102/?qa=onboarding-unused-cleanup-1777890000000`: title `KK Studio - AI Image Workspace`, login screen DOM visible, no connection-refused text, no render-error text, and `0` console errors when filtered to `127.0.0.1:3102`. The achievement toast was not directly visible on the default unauthenticated route because it requires completing onboarding tasks; this slice only removes an unused import and does not change toast JSX, timing, or visibility logic.
- Explicitly excluded scope: onboarding redesign, animation changes, toast timing changes, task panel cleanup, storage behavior, keyManager secret storage, provider routing, proxy/billing routes, and destructive log actions.

## Completed In `e661630e` (Onboarding Residual Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/onboarding-unused-cleanup-contract.test.ts` failed first on compiler-proven residual Onboarding unused symbols after the `AchievementToast` import cleanup had already passed.
- Removed compiler/source-proven unused `OnboardingProgress` import, `updateProgress` destructure, no-op `task` callback parameter, `ChevronLeft` and `Keyboard` imports, and the unread `getTasksByPhase` parameter. No onboarding task state, overlay progression, skip behavior, reward display, storage key, or timing behavior changed.
- Extended `tests/unit/onboarding-unused-cleanup-contract.test.ts` so those residual stale symbols do not return.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/Onboarding` matches. The broader repository still has 102 TS6133/TS619x diagnostics led by non-Onboarding hotspots.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/onboarding-unused-cleanup-contract.test.ts` passed 2/2.
- Browser QA: blocked because the Codex in-app Browser automation timed out twice while initializing the browser debug channel before navigation. Fallback HTTP smoke of the built `dist` at `http://127.0.0.1:3102/?qa=onboarding-residual-cleanup-1777891200000` returned status 200 with title `KK Studio - AI Image Workspace`; this is not a substitute for pixel-level browser QA.
- Explicitly excluded scope: onboarding redesign, overlay flow changes, task panel behavior changes, progress storage behavior, storage/auth/proxy/billing files, provider routing, endpoint/auth changes, and broad any/console cleanup.

## Completed In `05394f83` (Pure Image Orphan Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/pure-utility-unused-cleanup-contract.test.ts` failed first because `src/services/image/imageCompression.ts` still existed.
- Deleted the unreferenced `src/services/image/imageCompression.ts` module after source/import proof. No production source imports `imageCompression`, and this slice did not touch `src/services/storage/imageStorage.ts`, `src/services/storage/fileSystemService.ts`, or their storage-owned compression helpers.
- Extended `tests/unit/pure-utility-unused-cleanup-contract.test.ts` so the removed module and import paths do not return.
- Fresh source/noUnused probes: `rg -n "imageCompression" src -S` returned no matches; `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/services/image/imageCompression` matches. The broader repository still has 101 TS6133/TS619x diagnostics led by non-imageCompression hotspots.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/pure-utility-unused-cleanup-contract.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/ui-unused-cleanup-contract.test.ts` passed 46/46.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1272/1272; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI orphan module deletion with no live production imports and no browser-visible behavior path.
- Explicitly excluded scope: storage compression behavior, image storage persistence, file-system storage, LOD/image loader behavior, provider routing, keyManager secret storage, proxy/billing routes, endpoint/auth changes, and broad any/console cleanup.

## Completed In `eeb377d5` (Dormant Pixi Canvas Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-dormant-unused-cleanup-contract.test.ts` failed first because `src/components/canvas/PixiCanvas.tsx` still existed.
- Deleted the unreferenced `src/components/canvas/PixiCanvas.tsx` dormant renderer after source/import proof. No production source imports `PixiCanvas`, `preloadPixi`, or `isPixiAvailable`, and this slice did not touch live `src/components/canvas/InfiniteCanvas.tsx`.
- Added `tests/unit/canvas-dormant-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so the removed dormant renderer and entrypoints do not return.
- Fresh source/noUnused probes: the Pixi source-reference guard returned no matches; `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/canvas/PixiCanvas` matches. The broader repository still has 95 TS6133/TS619x diagnostics led by non-Pixi hotspots.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-dormant-unused-cleanup-contract.test.ts` passed 1/1.
- Full validation passed: `npm.cmd run typecheck` with 89 semantically checked test files; `npm.cmd run test:unit` passed 1273/1273; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a dormant module deletion with no live production imports and no browser-visible behavior path.
- Explicitly excluded scope: live `InfiniteCanvas.tsx`, canvas transform behavior, prompt/image drag behavior, storage persistence, provider routing, keyManager secret storage, proxy/billing routes, endpoint/auth changes, and broad any/console cleanup.

## Completed In `9ce70e96` (Dormant Canvas Residual Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-dormant-unused-cleanup-contract.test.ts` failed first because `src/components/canvas/Canvas.tsx` still destructured unused `onAutoArrange`.
- Removed compiler-proven unused `onAutoArrange`, `isMobile`, and `sourcePosition` destructured values while preserving their props interface fields for compatibility; changed the unread `idleTime` state value to an elided tuple binding while preserving the timeout state setter.
- Extended `tests/unit/canvas-dormant-unused-cleanup-contract.test.ts` so those stale destructures do not return while the public optional prop fields remain.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` had zero `src/components/canvas/Canvas` and `src/components/canvas/PendingNode` matches. The broader repository still had 91 TS6133 diagnostics plus 4 TS619x diagnostics led by non-canvas-residual hotspots.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-dormant-unused-cleanup-contract.test.ts tests/unit/clay-frosted-surface-contract.test.ts` passed 9/9.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1274/1274; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a visual-no-op source cleanup in dormant support files; `PendingNode` frosted-surface contract passed and live `InfiniteCanvas.tsx` was not changed.
- Explicitly excluded scope: live `InfiniteCanvas.tsx`, canvas transform behavior, prompt/image drag behavior, removing `PendingNode` itself, storage persistence, provider routing, keyManager secret storage, proxy/billing routes, endpoint/auth changes, and broad any/console cleanup.

## Completed In `58161f20` (Legacy Dashboard Unused-Icon Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ui-unused-cleanup-contract.test.ts` failed first because legacy plain `DashboardView.tsx` still imported unused `AlertTriangle`, `ShieldCheck`, and `Wallet` icons.
- Removed only those compiler-proven unused icon imports from `src/components/settings/views/DashboardView.tsx`. The live localized dashboard route, dashboard JSX, billing remaining-balance logic, storage refresh logic, and settings routing remain untouched.
- Extended `tests/unit/ui-unused-cleanup-contract.test.ts` so the stale plain-dashboard icon imports do not return while `DashboardView.localized.tsx` continues to retain its live `Wallet` usage.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/settings/views/DashboardView.tsx` matches. The broader repository still has 88 TS6133 diagnostics plus 4 TS619x diagnostics led by `fileSystemService.ts`, `useImageGeneration.ts`, `ApiSettingsView.tsx`, `geminiService.ts`, and `keyManager.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ui-unused-cleanup-contract.test.ts tests/unit/dashboard-settings-overview-regression.test.ts tests/unit/dashboard-settings-legacy-pruning.test.ts tests/unit/billing-remaining-balance-contract.test.ts` passed 10/10.
- Full validation passed: `npm.cmd run architecture:check`; `npm.cmd run governance:security`; `npm.cmd run audit:dependencies`; `npm.cmd run spec:check`; `npm.cmd run governance:check`; `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1275/1275; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is an import-only cleanup in the legacy plain dashboard file; the live settings route imports `DashboardView.localized.tsx`, and the localized dashboard/billing source contracts passed.
- Explicitly excluded scope: live `DashboardView.localized.tsx`, settings routing, dashboard layout/visual redesign, billing behavior, storage behavior, provider routing, keyManager secret storage, proxy/billing routes, endpoint/auth changes, release metadata, and broad any/console cleanup.

## Completed In `7d2c2584` (File-System Compatibility Stub Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/filesystem-tag-shortcut-compat-contract.test.ts` failed first because the tag/settings compatibility stubs still used the unused `handle` and `isVideo` parameter names.
- Renamed only unused no-op stub parameters in `src/services/storage/fileSystemService.ts` to `_handle` and `_isVideo`; kept public methods, parameter order, App call sites, tag/settings no-op behavior, and `loadSettings` returning `null`.
- Added `tests/unit/filesystem-tag-shortcut-compat-contract.test.ts` and registered it in `tsconfig.tests.json` so these stubs remain no-op and noUnused-clean while App keeps the existing public call signature.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/services/storage/fileSystemService.ts` matches. The broader repository still has 78 TS6133 diagnostics plus 4 TS619x diagnostics led by `ApiSettingsView.tsx`, `geminiService.ts`, `useImageGeneration.ts`, `keyManager.ts`, `GoogleAdapter.ts`, and `ProjectManager.tsx`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/filesystem-tag-shortcut-compat-contract.test.ts tests/unit/canvas-filesystem-persistence-scope.test.ts tests/unit/filesystem-startup-consolidation-deferral.test.ts` passed 4/4.
- Full validation passed: `npm.cmd run architecture:check`; `npm.cmd run governance:security`; `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1277/1277; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI parameter-name cleanup in no-op storage compatibility stubs with source contracts covering no new tag/settings file-system side effects.
- Explicitly excluded scope: real file-system persistence, tag shortcut implementation, settings file writing, storage migration, image/video persistence, storage adapters, keyManager secret storage, provider routing, proxy/billing routes, endpoint/auth changes, release metadata, and broad any/console cleanup.

## Completed In `5dac56e8` (Import-Only Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/import-only-unused-cleanup-contract.test.ts` failed first because `GlobalLightbox.tsx` still imported unused `NormalizedRect`.
- Removed only import/type-list unused symbols: `NormalizedRect` from `GlobalLightbox.tsx`, `ImageQuality` from `useImageQuality.ts`, and `ModelType` / `ImageSize` from `modelRegistry.ts`; converted the remaining `Provider` import to `import type`.
- Added `tests/unit/import-only-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so these cleanup boundaries remain import-only while exports and key behavior contracts stay present.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/image/GlobalLightbox.tsx`, `src/hooks/useImageQuality.ts`, and `src/services/model/modelRegistry.ts` matches. The broader repository still has 74 TS6133 diagnostics plus 4 TS619x diagnostics led by `useImageGeneration.ts`, `geminiService.ts`, `ApiSettingsView.tsx`, `keyManager.ts`, `GoogleAdapter.ts`, and `ProjectManager.tsx`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/import-only-unused-cleanup-contract.test.ts tests/unit/partial-redraw-lightbox-contract.test.ts tests/unit/responsive-surface.test.ts tests/unit/google-official-gemini-protocol-guards.test.ts` passed 14/14.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1278/1278; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is an import-only cleanup with no JSX, hook logic, registry data, provider routing, or visible UI changes.
- Explicitly excluded scope: lightbox behavior, partial redraw behavior, image quality selection behavior, model registry data, provider routing, keyManager, billing, storage persistence, endpoint/auth changes, release metadata, and broad any/console cleanup.

## Completed In `bdb082d7` (Live Canvas Residual Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-live-unused-cleanup-contract.test.ts` failed first because live `InfiniteCanvas.tsx` still destructured unused `onAutoArrange`.
- Removed only unused `onAutoArrange` and `id` destructured values from `src/components/canvas/InfiniteCanvas.tsx`; kept `InfiniteCanvasProps` optional fields, callback wiring, drag/drop, transform, zoom, and JSX behavior intact.
- Added `tests/unit/canvas-live-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so public props remain while stale destructures do not return.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/canvas/InfiniteCanvas.tsx` matches. The broader repository still has 72 TS6133 diagnostics plus 4 TS619x diagnostics led by `useImageGeneration.ts`, `geminiService.ts`, `ApiSettingsView.tsx`, `keyManager.ts`, `ProjectManager.tsx`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-live-unused-cleanup-contract.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-visual-regression.test.ts tests/unit/ecommerce-wheel-scroll-guard.test.ts` passed 17/17.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1279/1279; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a no-op destructure cleanup with public props preserved; canvas live/visual source contracts passed and no JSX/CSS changed.
- Explicitly excluded scope: canvas transform behavior, drag/drop behavior, zoom behavior, canvas visual redesign, App wiring, storage persistence, provider routing, keyManager, billing, endpoint/auth changes, release metadata, and broad any/console cleanup.

## Completed In `e714380b` (Workflow Actions Import Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/workflow-actions-unused-cleanup-contract.test.ts` failed first because `src/app/useWorkflowActions.ts` still imported `WORKFLOW_TEMPLATES`.
- Removed only the unused `WORKFLOW_TEMPLATES` import from `src/app/useWorkflowActions.ts`; kept `WorkflowTemplateId`, `createAgentWorkflowNode`, `createPreviewWorkflowNode`, `createSaveWorkflowNode`, and the `App.tsx` `workflowTemplates={WORKFLOW_TEMPLATES}` UI ownership intact.
- Added `tests/unit/workflow-actions-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so the hook cannot re-import the template list while App and `workflowTemplates.ts` keep list ownership.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/app/useWorkflowActions.ts` matches. The broader repository still has 71 TS6133 diagnostics plus 4 TS619x diagnostics led by `useImageGeneration.ts`, `geminiService.ts`, `ApiSettingsView.tsx`, `keyManager.ts`, `ProjectManager.tsx`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/workflow-actions-unused-cleanup-contract.test.ts tests/unit/canvas-workflow-updates-contract.test.ts tests/unit/canvas-workflow-source-node-ids-contract.test.ts tests/unit/workflow-document-domain.test.ts` passed 10/10.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1280/1280; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is an import-only runtime hook cleanup with no JSX, CSS, workflow template definitions, or visible UI changes.
- Explicitly excluded scope: workflow template behavior, template list content, ProjectManager prop usage cleanup, workflow card factories, App workflow wiring beyond source ownership proof, storage persistence, provider routing, keyManager, billing, endpoint/auth changes, release metadata, and broad any/console cleanup.

## Completed In `57e8c05b` (Common ErrorBoundary Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/startup-error-localization.test.ts` failed first because `src/components/common/ErrorBoundary.tsx` still declared `localizeBoundaryErrorText(language, ...)`.
- Renamed only the unread `language` parameter to `_language`; kept the helper call shape, `localizeUserFacingText(value) || value`, frosted error UI, reload button, and `getBoundaryLanguage` document sync unchanged.
- Extended `tests/unit/startup-error-localization.test.ts` and registered it in `tsconfig.tests.json` so the stale parameter name does not return while the captured-error localization contract remains.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/common/ErrorBoundary.tsx` matches. The broader repository still has 70 TS6133 diagnostics plus 4 TS619x diagnostics led by `useImageGeneration.ts`, `geminiService.ts`, `ApiSettingsView.tsx`, `keyManager.ts`, `ProjectManager.tsx`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/startup-error-localization.test.ts tests/unit/app-startup-screen-localization.test.ts tests/unit/clay-frosted-surface-contract.test.ts` passed 10/10.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1280/1280; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a parameter-name-only source cleanup with no JSX/CSS/error behavior change; localization and frosted-surface contracts passed.
- Explicitly excluded scope: error UI redesign, error text changes, startup error behavior, global error handling, browser QA claims, storage persistence, provider routing, keyManager, billing, endpoint/auth changes, release metadata, and broad any/console cleanup.

## Completed In `d4291729` (Generation Runtime Import Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts` failed first because `src/app/useGenerationRuntime.ts` still imported `resolveModelDisplayName` from `../utils/modelDisplayName`.
- Removed only the unused `resolveModelDisplayName` import from `src/app/useGenerationRuntime.ts`; kept `UseGenerationRuntimeDeps.resolveModelDisplayName`, retry/generation model label calls, dependency destructuring, and App-side injection ownership intact.
- Extended `tests/unit/generation-runtime-contract.test.ts` so the runtime cannot re-import the display-name helper while the public deps boundary and `params.resolveModelDisplayName(...)` usage remain covered.
- Line counts after cleanup: `src/app/useGenerationRuntime.ts` moved from 2604 to 2603 physical lines; `tests/unit/generation-runtime-contract.test.ts` is 1696 physical lines after adding the source contract.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` has zero `src/app/useGenerationRuntime.ts` matches. The broader repository now has 69 TS6133 diagnostics plus 4 TS619x diagnostics led by `ApiSettingsView.tsx`, `useImageGeneration.ts`, `geminiService.ts`, `keyManager.ts`, `ProjectManager.tsx`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts` passed 51/51, and `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-billing-runtime-contract.test.ts` passed 2/2.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1281/1281; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is an import-only runtime hook cleanup with no JSX, CSS, route rendering, or visible UI changes.
- Explicitly excluded scope: generation behavior changes, retry billing/model-label behavior changes, App runtime wiring changes, provider routing, endpoint/auth changes, release metadata, payment business logic, PPT behavior, UI behavior, storage persistence, keyManager, and broad any/console cleanup.

## Completed In `c29effe5` (CanvasContext Type Import Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts` failed first because `src/context/CanvasContext.tsx` still imported `type CanvasContextType` and `type SubCardLayout` from `./canvasContextState`.
- Removed only the unused `CanvasContextType` and `SubCardLayout` type imports from the `canvasContextState` import block; kept `CanvasState`, `ArrangeMode`, runtime context imports, and `export type { ArrangeMode, CanvasContextType, CanvasState, SubCardLayout } from './canvasContextState';` intact.
- Extended `tests/unit/canvas-context-unused-cleanup.test.ts` so the stale type imports cannot return while the public type re-export compatibility boundary remains covered.
- Line counts after cleanup: `src/context/CanvasContext.tsx` moved from 2518 to 2516 physical lines; `tests/unit/canvas-context-unused-cleanup.test.ts` is 41 physical lines after adding the source contract.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` has zero `src/context/CanvasContext.tsx` matches. The broader repository now has 67 TS6133 diagnostics plus 4 TS619x diagnostics led by `ApiSettingsView.tsx`, `useImageGeneration.ts`, `geminiService.ts`, `keyManager.ts`, `ProjectManager.tsx`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts` passed 1/1, and `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-state-boundary.test.ts` passed 1/1.
- Full validation passed: `npm.cmd run architecture:check`; `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1281/1281; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a type-import-only cleanup with no JSX, CSS, route rendering, persistence, hydration, cloud sync, local folder, or browser-visible behavior changes.
- Explicitly excluded scope: Canvas persistence, hydration, cloud sync, local folder refresh/connect logic, storage behavior, node mutation behavior, drag/selection behavior, UI behavior, provider routing, endpoint/auth changes, release metadata, payment business logic, keyManager, and broad any/console cleanup.

## Completed In `c4526e6b` (ProjectManager Prop Destructure Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/project-manager-unused-cleanup-contract.test.ts` failed first because `src/components/settings/ProjectManager.tsx` still destructured the four mobile prompt optimization props.
- Removed only `mobilePromptOptimizationEnabled`, `mobilePromptOptimizationSupported`, `onToggleMobilePromptOptimization`, and `onOpenMobilePromptLibrary` from the component destructuring list; kept the `ProjectManagerProps` declarations for compatibility and did not change JSX or controls.
- Added `tests/unit/project-manager-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so the public props remain declared but are not destructured unless they become live again.
- Line counts after cleanup: `src/components/settings/ProjectManager.tsx` is 840 physical lines; `tests/unit/project-manager-unused-cleanup-contract.test.ts` is 36 physical lines; `tsconfig.tests.json` is 124 physical lines after registering the test.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` has zero `src/components/settings/ProjectManager.tsx` matches. The broader repository now has 63 TS6133 diagnostics plus 4 TS619x diagnostics led by `ApiSettingsView.tsx`, `useImageGeneration.ts`, `geminiService.ts`, `keyManager.ts`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/project-manager-unused-cleanup-contract.test.ts` passed 1/1, and `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/clay-frosted-surface-contract.test.ts tests/unit/theme-system-adaptation.test.ts tests/unit/workspace-layout-contract.test.ts` passed 12/12.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1282/1282; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a destructure-only cleanup with no JSX, CSS, route rendering, dropdown/control behavior, workflow UI, or browser-visible behavior changes.
- Explicitly excluded scope: ProjectManager JSX/control behavior, visual styling, dropdown behavior, workflow UI, canvas operations, provider routing, endpoint/auth changes, release metadata, payment business logic, PPT behavior, storage behavior, keyManager, and broad any/console cleanup.

## Completed In `d8845775` (Ecommerce Task Merger Parameter Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-task-services.test.ts` failed first because `buildTemplateCopySeed` still named its unused template parameter `seriesTemplate`.
- Renamed only the private unused `buildTemplateCopySeed` parameter to `_seriesTemplate`; kept the call `buildTemplateCopySeed(input.baseTask.copy, input.seriesTemplate)`, copy seed shape, sparse intent patching, copy resolution, style/layout/inherit precedence, and consistency checks unchanged.
- Extended `tests/unit/ecommerce-task-services.test.ts` with a source contract that keeps the parameter marked unused while preserving the compatibility call.
- Line counts after cleanup: `src/services/ecommerce/taskMerger.ts` is 164 physical lines; `tests/unit/ecommerce-task-services.test.ts` is 424 physical lines after adding the source contract.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` has zero `src/services/ecommerce/taskMerger.ts` matches. The broader repository now has 62 TS6133 diagnostics plus 4 TS619x diagnostics led by `ApiSettingsView.tsx`, `useImageGeneration.ts`, `geminiService.ts`, `keyManager.ts`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-task-services.test.ts` passed 10/10, and `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-node-generation-runtime-contract.test.ts tests/unit/ecommerce-structured-task-source-contract.test.ts` passed 2/2.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1283/1283; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a private service parameter-name cleanup with no JSX, CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: sparse intent parsing changes, copy resolution changes, style/layout/inherit precedence changes, render task generation changes, ecommerce runtime wiring, UI behavior, provider routing, endpoint/auth changes, release metadata, payment business logic, storage behavior, keyManager, and broad any/console cleanup.

## Completed In `37540efc` (Model Display Name Provider Parameter Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/model-display-name-regression.test.ts` first failed because `getModelDisplayName` still exposed the unused third parameter as `provider` instead of `_provider`; an earlier direct service import approach was rejected because Node ESM hit the existing `src/types` directory import boundary before the intended assertion.
- Restored the pre-existing model display-name regression tests in `tests/unit/model-display-name-regression.test.ts` and appended the new source contract, avoiding loss of existing Nano Banana normalization coverage.
- Renamed only `getModelDisplayName(modelId, customLabel, provider)` to `getModelDisplayName(modelId, customLabel, _provider)` in `src/services/model/modelCapabilities.ts`; third-argument compatibility, custom-label precedence, global/admin model lookup, keyManager behavior, and model-list bootstrapping remain unchanged.
- Registered `tests/unit/model-display-name-regression.test.ts` in `tsconfig.tests.json`.
- Line counts after cleanup: `src/services/model/modelCapabilities.ts` is 1806 physical lines; `tests/unit/model-display-name-regression.test.ts` is 76 physical lines; `tsconfig.tests.json` is 125 physical lines.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` has zero `src/services/model/modelCapabilities.ts` matches. The broader repository now has 61 TS6133 diagnostics plus 4 TS619x diagnostics led by `ApiSettingsView.tsx`, `useImageGeneration.ts`, `geminiService.ts`, `keyManager.ts`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/model-display-name-regression.test.ts tests/unit/model-library-bootstrap-regression.test.ts` passed 8/8.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 96 files); `npm.cmd run test:unit` passed 1284/1284; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a service/test/docs cleanup with no JSX, CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: model/provider routing behavior changes, admin model lookup behavior changes, model-list bootstrapping behavior changes, keyManager, API/settings UI files, endpoint/auth changes, release metadata, payment business logic, PPT behavior, storage behavior, and broad any/console cleanup.

## Completed In `324b42a6` (Video Service Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/video-service-unused-cleanup-contract.test.ts` failed first because `mapAspectRatioToSize` still exposed the unused `model` parameter instead of `_model`; the same source contract also guards the Veo unused import removal and the `executeVideoGeneration` `modeLabel` parameter cleanup.
- Renamed only `mapAspectRatioToSize`'s unused second parameter to `_model` in `src/services/video/OpenAIVideoService.ts`, preserving public arity and aspect-ratio mapping behavior.
- Removed the unused `buildApiUrl` / `buildHeaders` import from `src/services/video/VeoVideoService.ts`, preserving the existing explicit URL/header construction in that service.
- Stopped passing `modeLabel` into the private `executeVideoGeneration` helper in `src/services/video/videoService.ts`; kept the local `modeLabel` progress label in `generateVideo`, request body construction, base URL normalization, polling, download/auth headers, and returned mode unchanged.
- Added `tests/unit/video-service-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json`.
- Line counts after cleanup: `src/services/video/OpenAIVideoService.ts` is 46 physical lines; `src/services/video/VeoVideoService.ts` is 199 physical lines; `src/services/video/videoService.ts` is 394 physical lines; `tests/unit/video-service-unused-cleanup-contract.test.ts` is 31 physical lines; `tsconfig.tests.json` is 126 physical lines.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` has zero `src/services/video` matches. The broader repository now has 59 TS6133 diagnostics plus 3 TS619x diagnostics led by `ApiSettingsView.tsx`, `useImageGeneration.ts`, `geminiService.ts`, `keyManager.ts`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/video-service-unused-cleanup-contract.test.ts tests/unit/frontend-key-boundary-hardening.test.ts` passed 8/8.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 97 files); `npm.cmd run test:unit` passed 1285/1285; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a service/test/docs cleanup with no JSX, CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: video request construction changes, API base normalization changes, progress label content changes, polling changes, download/auth header changes, returned result shape changes, provider routing, model routing, API/settings UI files, endpoint/auth changes, release metadata, payment business logic, PPT behavior, storage behavior, and broad any/console cleanup.

## Completed In `b31edef5` (Image Service Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/image-service-unused-cleanup-contract.test.ts` failed first because `imagePriorityLoader.ts` still imported `isElementInViewport` and retained an unread `intervalId` handle; the same source contract also guards the stale LOD quality mapping cleanup.
- Removed the unused `isElementInViewport` import and unread `intervalId` field/assignment from `src/services/image/imagePriorityLoader.ts`; kept the 200ms priority loop, queue sorting by `distanceFromViewportCenter`, concurrency limit, cancellation, and task execution behavior unchanged.
- Removed unused `QUALITY_CONFIGS`, the private `lodToQuality` helper, and the unread `quality` local from `src/services/image/lodService.ts`; kept LOD thresholds, quality ID selection, storage lookup order, blob URL registration/release, fallback URL behavior, and cache mutation unchanged.
- Added `tests/unit/image-service-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json`.
- Line counts after cleanup: `src/services/image/imagePriorityLoader.ts` is 91 physical lines; `src/services/image/lodService.ts` is 258 physical lines; `tests/unit/image-service-unused-cleanup-contract.test.ts` is 26 physical lines; `tsconfig.tests.json` is 127 physical lines.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` has zero `src/services/image/imagePriorityLoader.ts` and zero `src/services/image/lodService.ts` matches. The broader repository now has 55 TS6133 diagnostics plus 3 TS619x diagnostics led by `ApiSettingsView.tsx`, `useImageGeneration.ts`, `geminiService.ts`, `keyManager.ts`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/image-service-unused-cleanup-contract.test.ts` passed 1/1.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 98 files); `npm.cmd run test:unit` passed 1286/1286; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a service/test/docs cleanup with no JSX, CSS, route rendering, or browser-visible image rendering changes.
- Explicitly excluded scope: queue ordering changes, task execution changes, lazy-image behavior changes, LOD threshold changes, storage lookup order changes, cache mutation changes, memory-manager behavior changes, fallback URL behavior changes, UI image rendering, provider routing, endpoint/auth changes, release metadata, payment business logic, storage persistence policy, and broad any/console cleanup.

## Completed In `56ffe696` (Small LLM Adapter Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/llm-adapter-unused-cleanup-contract.test.ts` failed first because `AudioCompatibleAdapter.ts` still imported `getAudioCapability` / `isAudioModel` and assigned unread `audioCaps`; the same source contract also guards the `VolcengineAdapter.supports` unused parameter rename.
- Removed unused `getAudioCapability` and `isAudioModel` imports plus the unread `audioCaps` local from `src/services/llm/AudioCompatibleAdapter.ts`; kept `getMaxAudioDuration`, lyrics/style/continuation/TTS fields, request body construction, polling, and error handling unchanged.
- Renamed only `VolcengineAdapter.supports(modelId)` to `supports(_modelId)` in `src/services/llm/VolcengineAdapter.ts`, preserving the permissive support behavior.
- Added `tests/unit/llm-adapter-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json`.
- Line counts after cleanup: `src/services/llm/AudioCompatibleAdapter.ts` is 262 physical lines; `src/services/llm/VolcengineAdapter.ts` is 87 physical lines; `tests/unit/llm-adapter-unused-cleanup-contract.test.ts` is 25 physical lines; `tsconfig.tests.json` is 128 physical lines.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` has zero `src/services/llm/AudioCompatibleAdapter.ts` and zero `src/services/llm/VolcengineAdapter.ts` matches. The broader repository now has 52 TS6133 diagnostics plus 3 TS619x diagnostics led by `ApiSettingsView.tsx`, `useImageGeneration.ts`, `geminiService.ts`, `keyManager.ts`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/llm-adapter-unused-cleanup-contract.test.ts` passed 1/1.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 99 files); `npm.cmd run test:unit` passed 1287/1287; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a service/test/docs cleanup with no JSX, CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: audio request body changes, duration limiting changes, lyrics/style/continuation/TTS field changes, polling changes, Volcengine endpoint selection changes, auth header changes, provider routing, model routing, API/settings UI files, endpoint/auth changes, release metadata, payment business logic, and broad any/console cleanup.

## Finalization Audit Plan

1. Close the current user API payload unused secret-constant cleanup slice first; do not claim final completion while additional Stage Two seams and remaining TS6133/TS619x hotspots remain open.
2. Run high-confidence local audits for unused code, TypeScript debt, bare debug logging, TODO/FIXME markers, sensitive storage/logging, dependency audits for root and `payment-server`, architecture boundaries, specs, build, unit tests, and UI contract coverage.
3. Fix only narrow blockers found by the audits. Broad debt counts are tracked but are not safe to delete in one batch.
4. If packaging/publish metadata changes again, rerun `npm.cmd run package:portable`, `npm.cmd run publish:portable`, and `npm.cmd run governance:check` before final release sign-off.
5. Final completion can only be claimed after the release gate and UI/browser checks required by touched surfaces pass.

## Completed In `58be183d` (Dependency-Security Slice)

- Fixed the separate `payment-server` dependency audit gap by overriding transitive `@hono/node-server` to `^1.19.14` and `hono` to `^4.12.16`; the payment lockfile now resolves `@hono/node-server 1.19.14` and `hono 4.12.16`.
- Added root script `npm.cmd run audit:dependencies` to audit both the root lockfile and `payment-server`, and inserted it into `npm.cmd run verify:changes`.
- Updated `implement.md`, `validation.md`, and `plans.md` so dependency-security and final release gates include the sidecar audit.
- Validation passed before commit: `npm.cmd run audit:dependencies` reported `found 0 vulnerabilities` for both lockfiles; `npm.cmd run typecheck:payment-server` passed syntax checks for 3 files; `npm.cmd run governance:agent-docs` passed; `npm.cmd run check:encoding` passed.
- Full gate passed after the script change: `npm.cmd run verify:changes` passed architecture, governance, dependency audit, typecheck, spec, build, unit/integration/contract/e2e tests, prompt-group drag smoke, mobile settings smoke, desktop settings smoke, startup banner smoke, and encoding.
- Browser smoke status: all four smoke scripts used fallback mode because local headless Chromium launch is blocked by `spawn EPERM`; route checks and source contracts passed, but pixel-level browser rendering is still not proven by this gate.
- Browser QA for this slice: skipped because only dependency metadata, scripts, and ledger files changed; no UI, CSS, route component, or browser-visible behavior changed.

## Completed In `0edb13f5` (OpenAI-Compatible Diagnostics Extraction)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-diagnostics-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` because `src/services/llm/openAICompatibleDiagnostics.ts` did not exist.
- Extracted safe JSON request body and multipart `FormData` preview redaction into `src/services/llm/openAICompatibleDiagnostics.ts`; `OpenAICompatibleAdapter.ts` now imports `buildSafeRequestBodyPreview` and `buildSafeFormDataPreview` instead of owning private methods.
- The new helper keeps existing JSON redaction behavior for nested sensitive keys, data URIs, long URLs, long base64 strings, and long strings; multipart previews now also redact secret-like field names such as `apiKey` while keeping file metadata.
- Added `tests/unit/openai-compatible-diagnostics-contract.test.ts` and registered it in `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 78 test files.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` 4451 physical lines, `src/services/llm/openAICompatibleDiagnostics.ts` 86 physical lines, `tests/unit/openai-compatible-diagnostics-contract.test.ts` 64 physical lines, `tsconfig.tests.json` 107 physical lines.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-diagnostics-contract.test.ts` passed (3/3).
- Provider/security targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-diagnostics-contract.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/provider-surface-router.test.ts tests/unit/provider-strategy.test.ts tests/unit/async-image-proxy-regression.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/governance-contract.test.ts` passed (61/61).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run governance:security`.
- Passed: `npm.cmd run audit:dependencies` with both root and `payment-server` audits reporting `found 0 vulnerabilities`.
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1255/1255).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Browser QA: skipped because this is a non-UI diagnostics/helper extraction and no visual surface, CSS, route component, or browser-visible behavior changed.

## Completed In `8f878b3a` (OpenAI-Compatible Image Routing Error Classifier Extraction)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-routing-errors-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` because `src/services/llm/openAICompatibleImageRoutingErrors.ts` did not exist.
- Extracted quota-like image error, chat endpoint compatibility error, and image endpoint compatibility error classifiers into `src/services/llm/openAICompatibleImageRoutingErrors.ts`; `OpenAICompatibleAdapter.ts` now imports `isChatEndpointCompatibilityError` and `isImageEndpointCompatibilityError` instead of owning local closures in `generateImage`.
- The helper preserves historical message-only matching, quota fail-closed behavior, broad chat/image compatibility substrings, and non-`Error` object handling. Raw string/null/undefined inputs continue to evaluate as non-compatibility signals because the historical code only read `.message`.
- Added `tests/unit/openai-compatible-image-routing-errors-contract.test.ts` and registered it in `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 79 test files.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` 4412 physical lines, `src/services/llm/openAICompatibleImageRoutingErrors.ts` 49 physical lines, `tests/unit/openai-compatible-image-routing-errors-contract.test.ts` 90 physical lines, `tsconfig.tests.json` 108 physical lines.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-routing-errors-contract.test.ts` passed (4/4).
- Provider/security targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-routing-errors-contract.test.ts tests/unit/openai-compatible-diagnostics-contract.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/provider-surface-router.test.ts tests/unit/provider-strategy.test.ts tests/unit/async-image-proxy-regression.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/governance-contract.test.ts` passed (65/65).
- Passed: `npm.cmd run architecture:check` with existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions only.
- Passed: `npm.cmd run governance:security`.
- Passed: `npm.cmd run audit:dependencies` with both root and `payment-server` audits reporting `found 0 vulnerabilities`.
- Passed: `npm.cmd run typecheck`; test semantic check covers 79 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1259/1259).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/llm/OpenAICompatibleAdapter.ts src/services/llm/openAICompatibleImageRoutingErrors.ts tests/unit/openai-compatible-image-routing-errors-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Subagent review found no blocking behavior or security issue. Residual risk remains the historical broad substring policy (`endpoint`, `invalid request`, and `unsupported`); this slice preserves that policy instead of changing routing semantics.
- Browser QA: skipped because this is a non-UI classifier/helper extraction and no visual surface, CSS, route component, or browser-visible behavior changed.

## Completed In `96b94e5e` (OpenAI-Compatible Unreachable Image Fallback Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/provider-image-routing-regression.test.ts` failed after adding the source contract because `OpenAICompatibleAdapter.ts` still contained post-throw automatic fallback snippets (`Chat API 不兼容，回退 Images API` and `Images API 疑似不兼容，自动回退 Chat API`).
- Removed only the unreachable fallback code after `throw this.buildImageCompatibilityModeError('chat', ...)` and `throw this.buildImageCompatibilityModeError('standard', ...)`; billing-safe fail-closed behavior remains the live path.
- Added source-contract coverage in `tests/unit/provider-image-routing-regression.test.ts` so the old automatic fallback snippets do not return behind the fail-closed compatibility errors.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` 4405 physical lines and `tests/unit/provider-image-routing-regression.test.ts` 153 physical lines.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/provider-image-routing-regression.test.ts` passed (7/7).
- Provider/security targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-routing-errors-contract.test.ts tests/unit/openai-compatible-diagnostics-contract.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/provider-surface-router.test.ts tests/unit/provider-strategy.test.ts tests/unit/async-image-proxy-regression.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/governance-contract.test.ts` passed (66/66).
- Passed: `npm.cmd run architecture:check` with existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions only.
- Passed: `npm.cmd run governance:security`.
- Passed: `npm.cmd run audit:dependencies` with both root and `payment-server` audits reporting `found 0 vulnerabilities`.
- Passed: `npm.cmd run typecheck`; test semantic check covers 79 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1260/1260).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Browser QA: skipped because this is non-UI dead-code cleanup and no visual surface, CSS, route component, or browser-visible behavior changed.

## Stage Two M5 Media Recovery Extraction

- Extracted `hydrateRecoveredMediaCacheEntry`, `resolveOriginalPersistSourceForDisk`, and the local media cache entry type into `src/context/canvasMediaRecovery.ts`.
- `src/context/CanvasContext.tsx` now imports the media recovery helpers and no longer owns the local recovered media cache helper block.
- Added `tests/unit/canvas-media-recovery-contract.test.ts` to guard helper ownership, explicit exports, protected original-slot behavior, stable original-source preference, video fallback, and blob-source rejection.
- Added the media recovery contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 43 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4457, `src/context/canvasMediaRecovery.ts` 69, `tests/unit/canvas-media-recovery-contract.test.ts` 38, `tsconfig.tests.json` 72.
- Initial targeted run exposed a Node strip-only TypeScript runtime limitation when the test directly imported a helper that imports an enum dependency; the final contract keeps runtime source checks plus type-only coverage and leaves semantic validation to `npm.cmd run typecheck`.
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-media-recovery-contract.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` (6/6).
- Passed: `npm.cmd run typecheck`; test semantic check covers 43 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run architecture:check` with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Passed: `npm.cmd run test:unit` (1129/1129).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasMediaRecovery.ts tests/unit/canvas-media-recovery-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI context/helper extraction and no visual surface, CSS, route, or browser behavior changed.

## Stage Two M6 Prompt Recovery Extraction

- Extracted startup prompt recovery normalization into `src/context/canvasPromptRecovery.ts`.
- `src/context/CanvasContext.tsx` now imports `normalizeCanvasPromptRecovery`, `markInterruptedSyncPromptGenerations`, and `hasUnrecoverableSyncGenerationInFlight`; it no longer owns `normalizeRecoveredPromptNode`, pending task parsing, interrupted sync-generation marking, or prompt recovery risk detection.
- At M6 close, kept the async persisted-result recovery path in `CanvasContext.tsx` for a future smaller seam.
- Added `tests/unit/canvas-prompt-recovery-contract.test.ts` to guard helper ownership, export shape, completed-prompt pending-state cleanup, interrupted sync-generation marking, before-unload persistence wiring, and executable helper behavior for completed recovered prompts and interrupted sync prompts.
- Added the prompt recovery contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 44 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4951, `src/context/canvasPromptRecovery.ts` 184, `tests/unit/canvas-prompt-recovery-contract.test.ts` 228, `tsconfig.tests.json` 73.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-recovery-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasPromptRecovery.ts`.
- The behavior tests execute the helper source through test-local TypeScript transpilation with dependency stubs because Node strip-only TS cannot directly import the helper's extensionless production dependency graph; the assertions call `normalizeCanvasPromptRecovery`, `markInterruptedSyncPromptGenerations`, and `hasUnrecoverableSyncGenerationInFlight`.
- Browser QA: skipped because this is a non-UI context/helper extraction and no visual surface, CSS, route, or browser behavior changed.

## Stage Two M7 Persisted Image Recovery Extraction

- Extracted persisted task/result recovery helper ownership into `src/context/canvasPersistedImageRecovery.ts`.
- `src/context/CanvasContext.tsx` now imports `buildPersistedImageRecoverySignature`, `buildPromptRecoveryEntries`, `resolveImageRecoveryUrlFromMetadata`, `resolvePromptRecoveryEntrySource`, and `PromptRecoveryEntry`; it no longer owns task result URL indexing, storage-id normalization, stored-result lookup, prompt recovery entry merge, image recovery URL resolution, or recovery-signature construction.
- Kept the React hydration effect in `CanvasContext.tsx`: task loading, `tasksByPromptId`, cache write scheduling, recovered node construction, `updateNodes`, and `addImageNodes` remain in place for a future smaller seam.
- Added `tests/unit/canvas-persisted-image-recovery-contract.test.ts` to guard helper ownership, export shape, completed/persisted task merge behavior, duplicate suppression, recovery-signature gating, storage-original preference, cached-source fallback, and stale blob URL rejection.
- Updated `tests/unit/canvas-persisted-image-hydration-guard.test.ts` to preserve the startup guard contract after signature construction moved out of `CanvasContext.tsx`.
- Added the persisted image recovery contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 45 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4666, `src/context/canvasPersistedImageRecovery.ts` 301, `tests/unit/canvas-persisted-image-recovery-contract.test.ts` 283, `tests/unit/canvas-persisted-image-hydration-guard.test.ts` 21, `tsconfig.tests.json` 74.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-persisted-image-recovery-contract.test.ts` failed first because `CanvasContext.tsx` had no `canvasPersistedImageRecovery` import and the helper exports did not exist.
- Targeted GREEN validation already run during the slice: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-persisted-image-recovery-contract.test.ts tests/unit/canvas-persisted-image-hydration-guard.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` passed (8/8).
- Browser QA: skipped because this is a non-UI context/helper extraction and no visual surface, CSS, route, or browser behavior changed.

## Stage Two M8 Canvas Merge Extraction

- Extracted canvas merge helper ownership into `src/context/canvasMerge.ts`.
- `src/context/CanvasContext.tsx` now imports `mergeCanvases` and `resolvePreferredActiveCanvasId`; it no longer owns `getCanvasCardCount`, `isCanvasEffectivelyEmpty`, `mergeItemsById`, `mergeSingleCanvas`, `mergeCanvases`, or preferred active-canvas selection.
- Kept cloud sync, local-folder restore, local-folder connect, and local-folder refresh effects in `CanvasContext.tsx`; those call `mergeCanvases(..., normalizeCanvasPromptRecovery)` explicitly so prompt recovery normalization remains owned by the caller.
- Added `tests/unit/canvas-merge-contract.test.ts` to guard helper ownership, non-empty snapshot preference, ID merge ordering, local item override semantics, max `lastModified`, and active canvas fallback ordering.
- Added the canvas merge contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 46 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4556, `src/context/canvasMerge.ts` 122, `tests/unit/canvas-merge-contract.test.ts` 121, `tsconfig.tests.json` 75.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-merge-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasMerge.ts`.
- Targeted GREEN validation already run during the slice: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-merge-contract.test.ts` passed (4/4).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-merge-contract.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` passed (7/7).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 46 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1144/1144).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasMerge.ts tests/unit/canvas-merge-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route, or browser behavior changed.

## Stage Two M9 Invalid-Card Cleanup Extraction

- Extracted invalid-card cleanup helper ownership into `src/context/canvasCleanup.ts`.
- `src/context/CanvasContext.tsx` now imports `cleanupInvalidCanvasCardsForCanvas` and keeps only the public `cleanupInvalidCards` context wrapper plus state update orchestration.
- The helper owns invalid prompt removal, invalid image removal, prompt child ID pruning, utility workflow source/output pruning, workflow edge pruning, group pruning, selected-node filtering, and summary reporting.
- Added `tests/unit/canvas-cleanup-contract.test.ts` to guard helper ownership, executable cleanup behavior, workflow pruning, group/selection pruning, summary counts, and unchanged clean-canvas behavior.
- Added the cleanup contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 47 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4462, `src/context/canvasCleanup.ts` 155, `tests/unit/canvas-cleanup-contract.test.ts` 131, `tsconfig.tests.json` 76.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-cleanup-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasCleanup.ts`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-cleanup-contract.test.ts` passed (3/3).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-cleanup-contract.test.ts tests/unit/canvas-workflow-source-node-ids-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts tests/unit/canvas-startup-local-restore.test.ts` passed (9/9).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 47 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1147/1147).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasCleanup.ts tests/unit/canvas-cleanup-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route, or browser behavior changed.

## Stage Two M10 Canvas Placement Extraction

- Extracted next-card, smart-collision, and next-group placement helper ownership into `src/context/canvasPlacement.ts`.
- `src/context/CanvasContext.tsx` now imports `resolveNextCardPosition`, `resolveSmartCanvasPosition`, and `resolveNextGroupPosition`; it keeps the public placement callbacks and delegates calculation to the helper.
- The helper owns fixed five-column card slot calculation, prompt/image/group/workflow utility collision checks, shift fallback ordering, and dynamic child-card group width accumulation.
- Added `tests/unit/canvas-placement-contract.test.ts` to guard helper ownership, exported helper shape, fixed card-grid behavior, prompt/workflow utility collision shifts, fallback behavior when no canvas is active, and dynamic group width accumulation.
- Added the placement contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 48 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4263, `src/context/canvasPlacement.ts` 189, `tests/unit/canvas-placement-contract.test.ts` 113, `tsconfig.tests.json` 77.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-placement-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasPlacement.ts`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-placement-contract.test.ts` passed (4/4).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-placement-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-cleanup-contract.test.ts` passed (10/10).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 48 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1151/1151).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasPlacement.ts tests/unit/canvas-placement-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route, or browser behavior changed.

## Stage Two M11 Canvas Layering Extraction

- Extracted bring-to-front layering helper ownership into `src/context/canvasLayering.ts`.
- `src/context/CanvasContext.tsx` now imports `bringCanvasNodesToFront`; it keeps the public `bringNodesToFront` callback and delegates z-index calculation to the helper.
- The helper owns prompt-group expansion, parent-linked child image promotion, linked canvas group expansion, workflow utility node promotion, max z-index calculation, and group z-index ordering.
- Added `tests/unit/canvas-layering-contract.test.ts` to guard helper ownership, wrapper delegation, prompt/child image co-promotion, linked workflow utility promotion, linked canvas group z-index ordering, multi-id ordering, standalone image promotion, and empty no-op behavior.
- Added the layering contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 49 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4080, `src/context/canvasLayering.ts` 185, `tests/unit/canvas-layering-contract.test.ts` 183, `tsconfig.tests.json` 78.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-layering-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasLayering.ts`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-layering-contract.test.ts` passed (5/5).
- Passed initial targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-layering-contract.test.ts tests/unit/canvas-placement-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-cleanup-contract.test.ts` passed (13/13).
- Passed extended targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-layering-contract.test.ts tests/unit/canvas-placement-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-cleanup-contract.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-connector-throttling-contract.test.ts` passed (69/69).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 49 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1156/1156).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasLayering.ts tests/unit/canvas-layering-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route, or browser behavior changed.
- Parallel security scan during this slice flagged two high-priority Netlify legacy BYOK endpoints: `netlify/functions/keys.ts` and `netlify/functions/generate.ts`. They are excluded from M11 and must be handled as a separate security cleanup after this commit.

## Completed In `0603547a` (Netlify Legacy Raw-Key Endpoint Cleanup)

- Removed `netlify/functions/keys.ts`, which exposed `/api/keys`, wildcard CORS, raw BYOK validation against Gemini query-string key auth, and browser-localStorage key guidance.
- Removed `netlify/functions/generate.ts`, which exposed `/api/generate`, wildcard CORS, public request-body `apiKey` handling, and direct `GoogleGenAI` calls.
- Kept `netlify/functions/pricing-proxy.ts`; `netlify.toml` still publishes Netlify functions for that vetted pricing proxy only.
- Extended `scripts/governance/check-sensitive-boundaries.mjs` to scan `netlify/`.
- Added `tests/unit/governance-contract.test.ts` coverage so `netlify/functions/keys.ts`, `netlify/functions/generate.ts`, `/api/keys`, `/api/generate`, localStorage key guidance, and raw-api-key `GoogleGenAI` Netlify functions do not return.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/governance-contract.test.ts` failed first on the legacy Netlify functions boundary; the guard was then narrowed after confirming `netlify/functions/pricing-proxy.ts` is still a legitimate vetted function.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/governance-contract.test.ts` passed (13/13).
- Reference grep: `rg -n 'path:\s*["'']/(api/)?(keys|generate)["'']|GoogleGenAI|Keys are stored locally|Store them locally|/api/keys|/api/generate' netlify scripts tests src apps package.json` only matched the new guard assertion.
- Passed: `npm.cmd run governance:security`.
- Passed: `npm.cmd audit --omit=dev --audit-level=moderate` (`found 0 vulnerabilities`).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 49 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1157/1157).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `npm.cmd run governance:check`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- netlify.toml netlify/functions/generate.ts netlify/functions/keys.ts scripts/governance/check-sensitive-boundaries.mjs tests/unit/governance-contract.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is endpoint/config/governance cleanup only and no UI surface, CSS, route component, or browser-visible workflow changed.

## Completed In `5994c34b` (Stage Two M12 Canvas Group Management Extraction)

- Extracted Canvas group management helper ownership into `src/context/canvasGroups.ts`.
- `src/context/CanvasContext.tsx` now imports `addCanvasGroupToCanvas`, `removeCanvasGroupFromCanvas`, and `updateCanvasGroupInCanvas`; it keeps the public `addGroup`, `removeGroup`, and `updateGroup` callbacks as wrappers around `updateCanvas`.
- The helper owns explicit z-index preservation, next z-index calculation from prompt nodes, image nodes, and existing groups only, all-matching-ID group removal, and replace-only update semantics for existing group IDs.
- Kept `updateCanvas` ownership in `CanvasContext.tsx`, so `lastModified: Date.now()` and `syncCanvasCompatibility` behavior remain outside the pure helper.
- Added `tests/unit/canvas-groups-contract.test.ts` to guard helper ownership, wrapper delegation, next z-index behavior excluding workflow nodes, explicit `zIndex: 0` preservation, missing-group-array append behavior, remove-all matching IDs, untouched node/drawing references, and no append when updating a missing group ID.
- Added the group management contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 50 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4059, `src/context/canvasGroups.ts` 41, `tests/unit/canvas-groups-contract.test.ts` 181, `tsconfig.tests.json` 79.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-groups-contract.test.ts` failed first with 5/5 failures because `src/context/canvasGroups.ts` did not exist and `CanvasContext.tsx` did not import or delegate to `canvasGroups`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-groups-contract.test.ts` passed (5/5).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-groups-contract.test.ts tests/unit/canvas-layering-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cleanup-contract.test.ts` passed (14/14).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 50 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1162/1162).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`; no suspicious mojibake text or traditional Chinese characters found after normalizing the touched files.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasGroups.ts tests/unit/canvas-groups-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- EOL check: `git --git-dir=node_modules/.codex-git-full --work-tree=. ls-files --eol -- src/context/CanvasContext.tsx tsconfig.tests.json plans.md implement.md validation.md status.md` reports `w/lf` for all touched tracked files.
- Code review: Goodall found no spec-compliance issues; Aristotle found no behavior/security issues and requested line-ending normalization before staging. `src/context/CanvasContext.tsx` and `tsconfig.tests.json` were normalized from `w/mixed` to `w/lf` before final validation.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Completed In `4722acbe` (Stage Two M13 Canvas Movement Extraction)

- Extracted selected-node movement helper ownership into `src/context/canvasMovement.ts`.
- `src/context/CanvasContext.tsx` now imports `moveSelectedCanvasNodes`; it keeps `applyMoveSelectedNodes`, pending delta/source refs, RAF batching, immediate flush behavior, and public `moveSelectedNodes` / `moveSelectedNodesImmediate` callbacks.
- The helper owns source override resolution, selected prompt movement, prompt child-image co-movement, direct image `userMoved` marking, workflow utility-only movement, and no-op behavior when there are no effective selected IDs.
- Kept `lastModified` untouched, matching the previous movement path; no `updateCanvas` or compatibility-sync behavior moved into the helper.
- Added `tests/unit/canvas-movement-contract.test.ts` to guard helper ownership, wrapper delegation, source override semantics, prompt-child movement, image manual override marking, workflow utility gating, and empty-selection no-op behavior.
- Updated `tests/unit/prompt-group-drag-layout.test.ts` so the manual-layout override regression follows the new helper boundary instead of the old inline `CanvasContext.tsx` block.
- Added the movement contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 51 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4015, `src/context/canvasMovement.ts` 84, `tests/unit/canvas-movement-contract.test.ts` 227, `tests/unit/prompt-group-drag-layout.test.ts` 66, `tsconfig.tests.json` 80.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-movement-contract.test.ts tests/unit/prompt-group-drag-layout.test.ts` failed first with 8 failures because `src/context/canvasMovement.ts` did not exist and `CanvasContext.tsx` still owned the movement block.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-movement-contract.test.ts tests/unit/prompt-group-drag-layout.test.ts` passed (13/13).
- Passed expanded targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-movement-contract.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-connector-throttling-contract.test.ts` passed (61/61).
- Passed post-review targeted gate with batching and `lastModified` assertions: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-movement-contract.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-connector-throttling-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts` passed (62/62).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 51 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1169/1169).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasMovement.ts tests/unit/canvas-movement-contract.test.ts tests/unit/prompt-group-drag-layout.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Seam review: Poincare confirmed the boundary should keep RAF batching and source resolution in `CanvasContext.tsx`; its recommended extra assertions for batching refs/source resolution and unchanged `lastModified` were added before the final gate.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Completed In `d7a9d0a7` (Stage Two M14 Canvas Tags Extraction)

- Extracted node tag helper ownership into `src/context/canvasTags.ts`.
- `src/context/CanvasContext.tsx` now imports `setCanvasNodeTags`; it keeps the public `setNodeTags` callback and delegates tag replacement through `updateCanvas`.
- The helper owns prompt/image tag replacement for matching IDs, clear-tags behavior, and leaving groups, drawings, and `lastModified` untouched.
- Kept `lastModified` and `syncCanvasCompatibility` ownership in `updateCanvas`, matching the previous `setNodeTags` path.
- Added `tests/unit/canvas-tags-contract.test.ts` to guard helper ownership, wrapper delegation, prompt/image-only replacement, clear-tags behavior, untouched groups/drawings, and unmatched-node stability.
- Added the tags contract to `tsconfig.tests.json`.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4012, `src/context/canvasTags.ts` 9, `tests/unit/canvas-tags-contract.test.ts` 133, `tsconfig.tests.json` 81.
- RED evidence recorded for the draft: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-tags-contract.test.ts` failed first with 3/3 failures because `src/context/canvasTags.ts` did not exist and `CanvasContext.tsx` did not import or delegate to `canvasTags`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-tags-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts` passed (4/4).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 52 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1172/1172).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasTags.ts tests/unit/canvas-tags-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Code review: Godel confirmed the implementation preserves the old `setNodeTags` behavior and keeps the slice narrow; its staging and stale-status warnings are addressed by explicit path-based staging and this M14 ledger update.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Completed In `c9d39bb2` (Stage Two M15 Canvas Node Updates Extraction)

- Extracted node update helper ownership into `src/context/canvasNodeUpdates.ts`.
- `src/context/CanvasContext.tsx` now imports `updateCanvasImageNodeDimensions`, `updateCanvasImageNode`, and `applyCanvasNodeBatchUpdates`; it keeps the public `updateImageNodeDimensions`, `updateImageNode`, and `updateNodes` callbacks as wrappers around `updateCanvas`.
- The helper owns image dimension updates, image shallow-merge updates, batch prompt/image updates, duplicate-ID last-write-wins semantics, and empty/no-match batch no-ops.
- Kept `lastModified` and `syncCanvasCompatibility` ownership in `updateCanvas`, matching the previous node update paths.
- Added `tests/unit/canvas-node-updates-contract.test.ts` to guard helper ownership, wrapper delegation, unchanged prompt/image references, empty update object behavior, duplicate update IDs, and original-canvas return for empty or unmatched batches.
- Added the node update contract to `tsconfig.tests.json`.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3977, `src/context/canvasNodeUpdates.ts` 56, `tests/unit/canvas-node-updates-contract.test.ts` 197, `tsconfig.tests.json` 82.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-node-updates-contract.test.ts` failed first with 5/5 failures because `src/context/canvasNodeUpdates.ts` did not exist and `CanvasContext.tsx` did not import or delegate to `canvasNodeUpdates`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-node-updates-contract.test.ts` passed (5/5).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-node-updates-contract.test.ts tests/unit/canvas-persisted-image-hydration-guard.test.ts tests/unit/canvas-context-state-boundary.test.ts` passed (7/7).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 53 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1177/1177).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check after intent-to-add for new files: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasNodeUpdates.ts tests/unit/canvas-node-updates-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Code review note: a follow-up read-only subagent was requested but did not return before the validation gate; local diff review found the slice stayed within node update helper extraction and preserved `updateCanvas` ownership.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Completed In `c80ffa70` (Stage Two M16 Canvas Position Updates Extraction)

- Extracted prompt/image position update helper ownership into `src/context/canvasPositionUpdates.ts`.
- `src/context/CanvasContext.tsx` now imports `updateCanvasPromptNodePosition` and `updateCanvasImageNodePosition`; it keeps the public `updatePromptNodePosition` and `updateImageNodePosition` callbacks as wrappers around `updateCanvas`.
- The helper owns prompt child-image movement, selected prompt/image group movement, `moveChildren`, `ignoreSelection`, and missing-target no-op behavior.
- Kept `lastModified` and `syncCanvasCompatibility` ownership in `updateCanvas`, matching the previous position update paths.
- Added `tests/unit/canvas-position-updates-contract.test.ts` to guard helper ownership, wrapper delegation, prompt child movement, selected group movement, ignored selection single-image movement, and missing target no-ops.
- Added the position update contract to `tsconfig.tests.json`.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3890, `src/context/canvasPositionUpdates.ts` 104, `tests/unit/canvas-position-updates-contract.test.ts` 201, `tsconfig.tests.json` 83.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-position-updates-contract.test.ts` failed first with 5/5 failures because `src/context/canvasPositionUpdates.ts` did not exist and `CanvasContext.tsx` did not import or delegate to `canvasPositionUpdates`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-position-updates-contract.test.ts` passed (5/5).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-position-updates-contract.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/canvas-live-scene-contract.test.ts` passed (55/55).
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run typecheck`, `npm.cmd run test:unit` (1182/1182), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasPositionUpdates.ts tests/unit/canvas-position-updates-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Completed In `c46a4c49` (Stage Two M17 Canvas Prompt-Image Links Extraction)

- Extracted prompt/image relationship helper ownership into `src/context/canvasPromptImageLinks.ts`.
- `src/context/CanvasContext.tsx` now imports `deleteCanvasPromptNode`, `linkCanvasPromptToImage`, and `unlinkCanvasPromptFromImage`; it keeps public `deletePromptNode`, `linkNodes`, and `unlinkNodes` callbacks as wrappers around `updateCanvas`.
- The helper owns deleted-prompt child image orphaning, prompt child ID appends/removals, duplicate link no-ops, missing prompt link no-ops, missing image link behavior, and unlink orphaning even when the prompt is absent.
- Kept `pushToHistory`, `urgentSaveRef`, `lastModified`, and `syncCanvasCompatibility` ownership in `CanvasContext.tsx`/`updateCanvas`.
- Added `tests/unit/canvas-prompt-image-links-contract.test.ts` to guard helper ownership, wrapper delegation, delete behavior, link behavior, duplicate/missing prompt behavior, and unlink behavior.
- Added the prompt-image links contract to `tsconfig.tests.json`.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3852, `src/context/canvasPromptImageLinks.ts` 50, `tests/unit/canvas-prompt-image-links-contract.test.ts` 172, `tsconfig.tests.json` 84.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-image-links-contract.test.ts` failed first with 4/4 failures because `src/context/canvasPromptImageLinks.ts` did not exist and `CanvasContext.tsx` did not import or delegate to `canvasPromptImageLinks`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-image-links-contract.test.ts` passed (4/4).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-image-links-contract.test.ts tests/unit/canvas-prompt-child-images-runtime-contract.test.ts tests/unit/canvas-cleanup-contract.test.ts` passed (11/11).
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run typecheck` with semantic checks for 55 test files, `npm.cmd run test:unit` (1186/1186), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasPromptImageLinks.ts tests/unit/canvas-prompt-image-links-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with CRLF normalization warnings only.
- Seam review: Mendel recommended this seam over workflow updates because it is pure array transformation with no async, IndexedDB, local folder, dynamic import, DOM/browser API, storage deletion, or layout math; workflow updates remain a runner-up seam for a future slice.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M18 Canvas Workflow Updates Extraction

- Extracted workflow utility node update helper ownership into `src/context/canvasWorkflowUpdates.ts`.
- `src/context/CanvasContext.tsx` now imports `addCanvasWorkflowNode`, `updateCanvasWorkflowNode`, `updateCanvasWorkflowNodePosition`, and `deleteCanvasWorkflowNode`; it keeps public workflow callbacks as wrappers around `updateCanvas`.
- The helper owns utility node add duplicate checks, source-control edge creation, update ID/kind preservation, source-edge rebuilding, workflow node position updates, and workflow node deletion edge pruning.
- Kept the non-utility legacy-node warning/guard, `pushToHistory`, `lastModified`, and `syncCanvasCompatibility` ownership in `CanvasContext.tsx`/`updateCanvas`.
- Added `tests/unit/canvas-workflow-updates-contract.test.ts` to guard helper ownership, wrapper delegation, utility add behavior, source edge filtering/deduping, update semantics, position semantics, and delete semantics.
- Updated `tests/unit/canvas-workflow-source-node-ids-contract.test.ts` because M18 moves `getWorkflowSourceNodeIds` consumption from `CanvasContext.tsx` into the workflow update helper.
- Added `.ts` local import specifiers in `src/workflow/adapters/canvasToWorkflow.ts` and `src/workflow/persistence/workflowSerializer.ts` so the new helper can be loaded directly by Node contract tests without extensionless ESM resolution failure.
- Added the workflow updates contract to `tsconfig.tests.json`.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3733, `src/context/canvasWorkflowUpdates.ts` 148, `tests/unit/canvas-workflow-updates-contract.test.ts` 189, `tests/unit/canvas-workflow-source-node-ids-contract.test.ts` 69, `src/workflow/adapters/canvasToWorkflow.ts` 131, `src/workflow/persistence/workflowSerializer.ts` 87, `tsconfig.tests.json` 85.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-updates-contract.test.ts` failed first with 4/4 failures because `src/context/canvasWorkflowUpdates.ts` did not exist and `CanvasContext.tsx` did not import or delegate to `canvasWorkflowUpdates`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-updates-contract.test.ts` passed (4/4) after the helper extraction and ESM import-specifier fix.
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-updates-contract.test.ts tests/unit/canvas-workflow-source-node-ids-contract.test.ts tests/unit/workflow-document-domain.test.ts tests/unit/canvas-cleanup-contract.test.ts` passed (12/12).
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run typecheck` with semantic checks for 56 test files, `npm.cmd run test:unit` (1190/1190), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasWorkflowUpdates.ts tests/unit/canvas-workflow-updates-contract.test.ts tests/unit/canvas-workflow-source-node-ids-contract.test.ts src/workflow/adapters/canvasToWorkflow.ts src/workflow/persistence/workflowSerializer.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M19 Canvas Image Delete Helper Extraction

- Extracted the pure image-node deletion transform into `src/context/canvasPromptImageLinks.ts` as `deleteCanvasImageNode`.
- `src/context/CanvasContext.tsx` now imports `deleteCanvasImageNode`; it keeps `pushToHistory`, IndexedDB deletion, physical storage deletion adapter invocation, Blob URL revocation, urgent-save, and `updateCanvas` ownership.
- The helper owns image removal, parent prompt `childImageIds` pruning, and clearing `sourceImageId` when the deleted image was a follow-up source.
- Extended `tests/unit/canvas-prompt-image-links-contract.test.ts` to guard helper ownership, wrapper delegation, image deletion behavior, source-image cleanup, unchanged drawings, and unchanged `lastModified`.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3724, `src/context/canvasPromptImageLinks.ts` 62, `tests/unit/canvas-prompt-image-links-contract.test.ts` 210.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-image-links-contract.test.ts` failed first with 2 failures because `deleteCanvasImageNode` did not exist and `CanvasContext.tsx` still owned the inline transform.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-image-links-contract.test.ts` passed (5/5).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-image-links-contract.test.ts tests/unit/canvas-workflow-updates-contract.test.ts tests/unit/canvas-cleanup-contract.test.ts` passed (12/12).
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run typecheck` with semantic checks for 56 test files, `npm.cmd run test:unit` (1191/1191), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasPromptImageLinks.ts tests/unit/canvas-prompt-image-links-contract.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M20 Canvas Merge-Into Helper Extraction

- Extracted `mergeCanvasInto` pure state-transform ownership into `src/context/canvasMergeInto.ts`.
- `src/context/CanvasContext.tsx` now imports `mergeCanvasIntoState`; it keeps the public `mergeCanvasInto` wrapper, `setState` ownership, and returned summary shape.
- The helper owns same-canvas/missing-canvas no-ops, default `deleteSource` behavior, duplicate prompt/image/group skipping, target card X offsetting, moved image `canvasId` reassignment, moved group node filtering, optional source emptying, active canvas reassignment when deleting the active source, selection clearing, and summary counts.
- Added `tests/unit/canvas-merge-into-contract.test.ts` to guard helper ownership, wrapper delegation, delete-source behavior, empty-source behavior, duplicate filtering, group filtering, unchanged invalid merge requests, and deterministic `lastModified` behavior.
- Added the merge-into contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 57 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3641, `src/context/canvasMergeInto.ts` 130, `tests/unit/canvas-merge-into-contract.test.ts` 228, `tsconfig.tests.json` 86.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-merge-into-contract.test.ts` failed first with 4/4 failures because `src/context/canvasMergeInto.ts` did not exist and `CanvasContext.tsx` did not import or delegate to it.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-merge-into-contract.test.ts` passed (4/4).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-merge-into-contract.test.ts tests/unit/canvas-merge-contract.test.ts tests/unit/canvas-cleanup-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts` passed (12/12).
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run typecheck` with semantic checks for 57 test files, `npm.cmd run test:unit` (1195/1195), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasMergeInto.ts tests/unit/canvas-merge-into-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M21 Canvas Unused-Code Cleanup

- Removed source-proven unused `CanvasContext.tsx` imports: `getAllImages`, `getImagesPage`, and `getCachedStrippedCanvases`.
- Removed unused initial auto-arrange constants `PROMPT_HEIGHT`, `GAP_X`, `GAP_Y`, and `IMAGE_GAP`; kept the active `AUTO_ARRANGE_*` constants.
- Removed write-only `currentX` tracking in the global auto-arrange row-assignment pass; row wrapping is count-based and never read that X accumulator.
- Reworded the migration comment so it no longer references the removed `getAllImages` symbol.
- Added `tests/unit/canvas-context-unused-cleanup.test.ts` to guard the cleanup proof and added it to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 58 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3633, `tests/unit/canvas-context-unused-cleanup.test.ts` 28, `tsconfig.tests.json` 87.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts` failed first because the unused imports/constants/writes were still present.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts` passed (1/1).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts tests/unit/canvas-merge-into-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts` passed (6/6).
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run typecheck` with semantic checks for 58 test files, `npm.cmd run test:unit` (1196/1196), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx tests/unit/canvas-context-unused-cleanup.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI cleanup and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M22 Canvas Arrange Selection Extraction

- Extracted the single selected prompt child-card arrangement branch into `src/context/canvasArrangeSelection.ts`.
- `src/context/CanvasContext.tsx` now imports `arrangeSingleSelectedPromptChildren` and delegates the selected prompt child-card layout path before the broader selected-root arrange path.
- The helper preserves row, grid, and column child image positioning, PPT prompt forced column layout, `lastModified`, and returned `subCardLayoutMode` behavior.
- Added `tests/unit/canvas-arrange-selection-contract.test.ts` to guard helper ownership, wrapper delegation, executable row/grid/column positioning, PPT column forcing, unchanged no-child/no-single-selection behavior, and deterministic `lastModified` handling.
- Added the arrange-selection contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 59 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3571, `src/context/canvasArrangeSelection.ts` 102, `tests/unit/canvas-arrange-selection-contract.test.ts` 165, `tsconfig.tests.json` 88.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-arrange-selection-contract.test.ts` failed first with 4/4 failures because `src/context/canvasArrangeSelection.ts` did not exist and `CanvasContext.tsx` did not import or delegate to it.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-arrange-selection-contract.test.ts` passed (4/4).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-arrange-selection-contract.test.ts tests/unit/prompt-group-regroup-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/canvas-live-scene-contract.test.ts` passed (57/57).
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run typecheck` with semantic checks for 59 test files, `npm.cmd run test:unit` (1200/1200), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasArrangeSelection.ts tests/unit/canvas-arrange-selection-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI helper/layout logic extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M23 Canvas Duplicate Selected-Arrange Cleanup

- Removed the unreachable duplicate selected-arrange fallback from `src/context/CanvasContext.tsx`.
- The remaining selected-group arrange path builds `selectedGroupsForArrange` and returns for every `selectedCount > 1` prompt/image selection case, so the legacy fallback block after it was dead code.
- Extended `tests/unit/canvas-context-unused-cleanup.test.ts` to guard that the old fallback markers (`SelectionGroup`, `processedImageIds`, and standalone image reserve-height branch) do not return.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3404, `tests/unit/canvas-context-unused-cleanup.test.ts` 32, `tsconfig.tests.json` 88.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts` passed (1/1).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts tests/unit/canvas-arrange-selection-contract.test.ts tests/unit/prompt-group-regroup-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/canvas-live-scene-contract.test.ts` passed (58/58).
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run typecheck` with semantic checks for 59 test files, `npm.cmd run test:unit` (1200/1200), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx tests/unit/canvas-context-unused-cleanup.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is non-UI dead-branch cleanup and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M24 Canvas Selected-Root Arrange Extraction

- Extracted the multi-root selected arrange branch into `src/context/canvasArrangeSelection.ts` as `arrangeSelectedRootNodes`.
- `src/context/CanvasContext.tsx` now delegates selected prompt-only, image-only, and mixed root arrangement to the helper and no longer owns the local `let roots: any[]` root list.
- The helper preserves selected standalone image row layout, prompt-root child image syncing by root delta, mixed child-to-parent root promotion, grid/row/column root placement, deterministic `lastModified`, and null behavior when a selection collapses to one root.
- Cleaned the touched arrange block by removing the unused `dimensions` parameter from the remaining `CanvasContext.tsx` local image-dimension helper call sites.
- Extended `tests/unit/canvas-arrange-selection-contract.test.ts` to guard helper ownership, Context delegation, standalone image row layout, prompt-root child syncing, and one-root no-op behavior.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3201, `src/context/canvasArrangeSelection.ts` 338, `tests/unit/canvas-arrange-selection-contract.test.ts` 241, `tsconfig.tests.json` 88.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-arrange-selection-contract.test.ts` failed first with 4/8 failures because `arrangeSelectedRootNodes` did not exist and `CanvasContext.tsx` still owned the inline selected-root branch.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-arrange-selection-contract.test.ts` passed (8/8).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-arrange-selection-contract.test.ts tests/unit/prompt-group-regroup-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-context-unused-cleanup.test.ts` passed (62/62).
- Type validation passed: `npm.cmd run typecheck` with semantic checks for 59 test files.
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing allowlisted migration and legacy bridge exceptions.
- Unit validation passed: `npm.cmd run test:unit` passed (1204/1204).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasArrangeSelection.ts tests/unit/canvas-arrange-selection-contract.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI helper/layout logic extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M25 Canvas Selected-Group Arrange Extraction

- Extracted the remaining selected grouped arrange fallback into `src/context/canvasArrangeSelection.ts` as `arrangeSelectedGroupedNodes`.
- `src/context/CanvasContext.tsx` now delegates selected prompt+child single-root/group fallback arrangement after `arrangeSingleSelectedPromptChildren` and `arrangeSelectedRootNodes`, preserving the existing helper order.
- The helper preserves prompt+child grouped layout, standalone selected image fallback grouping, row/grid/column group placement, PPT child column override, selected-count fallthrough, deterministic `lastModified`, and requested `subCardLayoutMode` behavior.
- Extended `tests/unit/canvas-arrange-selection-contract.test.ts` to guard helper ownership, Context delegation, prompt+child grouped layout behavior, and `selectedCount <= 1` null/fallthrough behavior.
- Line counts for this slice: `src/context/CanvasContext.tsx` 2968, `src/context/canvasArrangeSelection.ts` 601, `tests/unit/canvas-arrange-selection-contract.test.ts` 306.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-arrange-selection-contract.test.ts` failed first with 2/10 failures because `arrangeSelectedGroupedNodes` did not exist and `CanvasContext.tsx` still owned the selected grouped fallback.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-arrange-selection-contract.test.ts` passed (11/11).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-arrange-selection-contract.test.ts tests/unit/prompt-group-regroup-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-context-unused-cleanup.test.ts` passed (65/65).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing allowlisted migration and legacy bridge exceptions.
- Type validation passed: `npm.cmd run typecheck` with semantic checks for 59 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1207/1207).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasArrangeSelection.ts tests/unit/canvas-arrange-selection-contract.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI helper/layout logic extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M26 Canvas Auto-Arrange Extraction

- Extracted full-canvas auto-arrange position calculation into `src/context/canvasAutoArrange.ts` as `resolveCanvasAutoArrangePositions`.
- `src/context/CanvasContext.tsx` now delegates normal prompt groups, follow-up source prompt placement, orphan prompt/image placement, and error prompt row positioning to the helper while preserving `setState`, `lastModified`, and localStorage persistence ownership in Context.
- Removed the now-unused `getCardDimensions` import from `src/context/CanvasContext.tsx`; dimension calculation moved with the helper and still uses `getCardDimensions(..., true)`.
- Added `tests/unit/canvas-auto-arrange-contract.test.ts` and included it in `tsconfig.tests.json`.
- Line counts for this slice: `src/context/CanvasContext.tsx` 2563, `src/context/canvasAutoArrange.ts` 360, `tests/unit/canvas-auto-arrange-contract.test.ts` 113, `tsconfig.tests.json` 89.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-auto-arrange-contract.test.ts` failed first with 2/2 failures because `src/context/canvasAutoArrange.ts` did not exist and `CanvasContext.tsx` still owned full-canvas auto-arrange internals.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-auto-arrange-contract.test.ts` passed (2/2).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-auto-arrange-contract.test.ts tests/unit/canvas-arrange-selection-contract.test.ts tests/unit/prompt-group-regroup-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-context-unused-cleanup.test.ts` passed (67/67).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing allowlisted migration and legacy bridge exceptions.
- Type validation passed: `npm.cmd run typecheck` with semantic checks for 60 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1209/1209).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasAutoArrange.ts tests/unit/canvas-auto-arrange-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure position-calculation extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M27 Canvas Prompt Node Updates Extraction

- Extended `src/context/canvasNodeUpdates.ts` with `addCanvasPromptNode` and `updateCanvasPromptNode`.
- `src/context/CanvasContext.tsx` now delegates prompt-node z-index promotion, duplicate prompt skip, defensive prompt/reference merge, and stale generating guards to the helper while preserving reference-image persistence, logging, notifications, `updateCanvas`, and `lastModified` ownership in Context.
- Updated `tests/unit/canvas-node-updates-contract.test.ts` with helper ownership and behavior coverage for prompt add/update reducers.
- Line counts for this slice: `src/context/CanvasContext.tsx` 2518, `src/context/canvasNodeUpdates.ts` 108, `tests/unit/canvas-node-updates-contract.test.ts` 302, `tsconfig.tests.json` 89.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-node-updates-contract.test.ts` failed first with 4/8 failures because `addCanvasPromptNode` and `updateCanvasPromptNode` did not exist and `CanvasContext.tsx` still owned the inline prompt add/update reducer logic.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-node-updates-contract.test.ts` passed (8/8).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-node-updates-contract.test.ts tests/unit/canvas-persisted-image-hydration-guard.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-prompt-child-images-runtime-contract.test.ts` passed (14/14).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing allowlisted migration and legacy bridge exceptions.
- Type validation passed: `npm.cmd run typecheck` with semantic checks for 60 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1212/1212).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasNodeUpdates.ts tests/unit/canvas-node-updates-contract.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure reducer extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M28 keyManager Model Helper Extraction

- Extracted `parseModelString`, `MODEL_MIGRATION_MAP`, `DEPRECATED_MODELS`, `normalizeModelId`, `ModelVariantMeta`, `parseModelVariantMeta`, and `appendModelVariantLabel` into `src/services/auth/keyManagerModelHelpers.ts`.
- `src/services/auth/keyManager.ts` imports the helpers for internal use and re-exports the same public helper/type names to preserve existing import paths for `App.tsx`, model caller/pricing, Gemini service, and retry-node construction.
- `src/services/auth/keyManagerEffectiveSlot.ts` now imports `parseModelString` directly from `keyManagerModelHelpers.ts`; it still imports `determineKeyType` from `keyManager.ts`, so the remaining cycle is documented for the next keyManager seam.
- Added `tests/unit/key-manager-model-helpers-contract.test.ts` and included it in `tsconfig.tests.json`.
- Line counts for this slice: `src/services/auth/keyManager.ts` 5076, `src/services/auth/keyManagerModelHelpers.ts` 194, `src/services/auth/keyManagerEffectiveSlot.ts` 99, `tests/unit/key-manager-model-helpers-contract.test.ts` 102, `tsconfig.tests.json` 90.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` failed first with 2/2 failures because `src/services/auth/keyManagerModelHelpers.ts` did not exist and `keyManager.ts` still owned inline helper exports.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` passed (2/2).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/official-route-default-models.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/provider-image-routing-regression.test.ts` passed (31/31).
- Additional reviewer-recommended targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/route-aware-credit-billing.test.ts` passed (19/19).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Type validation passed: `npm.cmd run typecheck` with semantic checks for 61 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1214/1214).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Browser QA: skipped because this is a non-UI pure service/helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.
- Follow-up debt: `src/utils/modelIdNormalization.ts` still duplicates model migration/normalization helpers and should be consolidated or parity-guarded in a later narrow slice.

## Stage Two M29 keyManager Key Type Helper Extraction

- Extracted `determineKeyType` into `src/services/auth/keyManagerKeyType.ts`.
- `src/services/auth/keyManager.ts` imports `determineKeyType` from the helper for internal use and re-exports it to preserve existing public import paths such as `src/services/billing/costService.ts`.
- `src/services/auth/keyManagerEffectiveSlot.ts` now imports `determineKeyType` from `keyManagerKeyType.ts`; this removes its remaining direct import from `keyManager.ts` and breaks the `keyManager.ts -> keyManagerEffectiveSlot.ts -> keyManager.ts` cycle.
- Added `tests/unit/key-manager-key-type-contract.test.ts`, updated `tests/unit/key-manager-model-helpers-contract.test.ts`, and included the new contract in `tsconfig.tests.json`.
- Line counts for this slice: `src/services/auth/keyManager.ts` 5070, `src/services/auth/keyManagerKeyType.ts` 10, `src/services/auth/keyManagerEffectiveSlot.ts` 99, `tests/unit/key-manager-key-type-contract.test.ts` 46, `tsconfig.tests.json` 91.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-key-type-contract.test.ts` failed first with 2/2 failures because `src/services/auth/keyManagerKeyType.ts` did not exist and `keyManager.ts` still owned inline `determineKeyType`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-key-type-contract.test.ts` passed (2/2).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-key-type-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/provider-strategy.test.ts tests/unit/official-route-default-models.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/provider-image-routing-regression.test.ts` passed (48/48).
- Parallel read-only reviewer gate passed: `cmd /c node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-key-type-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/provider-strategy.test.ts tests/unit/key-manager-runtime-fallback.test.ts` passed (35/35).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Type validation passed: `npm.cmd run typecheck` with semantic checks for 62 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1216/1216).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Browser QA: skipped because this is a non-UI pure service/helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.
- Follow-up debt addressed by Stage Two M30: `src/utils/modelIdNormalization.ts` duplicated model migration/normalization helpers and became the next keyManager-adjacent seam.

## Stage Two M30 modelIdNormalization Compatibility Consolidation

- Consolidated `src/utils/modelIdNormalization.ts` into a thin compatibility facade that re-exports `MODEL_MIGRATION_MAP`, `normalizeModelId`, `parseModelVariantMeta`, and `ModelVariantMeta` from `src/services/auth/keyManagerModelHelpers.ts`.
- Added `tests/unit/model-id-normalization-parity-contract.test.ts` and included it in `tsconfig.tests.json`.
- The new contract guards source ownership, canonical export identity, migration aliases, provider variant suffix normalization, and the current `fast`/quality/ratio variant parser behavior.
- Read-only model normalization review found no direct import cycle; the dependency direction risk is constrained by keeping the facade pointed at leaf-like `keyManagerModelHelpers.ts`, not `keyManager.ts`.
- Line counts for this slice: `src/utils/modelIdNormalization.ts` 6 lines, down from 84 duplicated helper lines; `src/services/auth/keyManagerModelHelpers.ts` remains 194 lines; `tests/unit/model-id-normalization-parity-contract.test.ts` 69 lines; `tsconfig.tests.json` 92 lines.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/model-id-normalization-parity-contract.test.ts` failed first with 2/2 failures because `src/utils/modelIdNormalization.ts` still declared its own migration map/parser/normalizer and the exported map was not reference-identical to the canonical helper map.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/model-id-normalization-parity-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/provider-image-routing-regression.test.ts` passed (15/15).
- Full model parsing/normalization targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/model-id-normalization-parity-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/official-route-default-models.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/provider-image-routing-regression.test.ts` passed (33/33).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage now includes 63 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1218/1218).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/utils/modelIdNormalization.ts src/services/auth/keyManagerModelHelpers.ts tests/unit/model-id-normalization-parity-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/provider-image-routing-regression.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure compatibility/helper consolidation with no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M31 keyManager Provider Runtime-State Merge Extraction

- Extracted `mergeCloudProvidersWithLocalRuntimeState` from the `KeyManager` class into `src/services/auth/keyManagerProviders.ts`.
- `src/services/auth/keyManager.ts` now calls the provider helper with normalized cloud providers and the current local provider list; the class no longer owns the private merge method.
- The helper preserves local `pricingSnapshot` and `activitySummary` only when the cloud provider omits those fields; cloud provider config and cloud-provided runtime fields remain authoritative.
- Provider IDs continue to match by trimmed string ID, preserving the prior runtime-state fallback behavior.
- `src/services/auth/keyManagerStorage.ts` now imports `../api/kkApiClient.ts` so Node ESM unit imports can execute the provider helper dependency graph.
- Added `tests/unit/key-manager-provider-persistence-contract.test.ts` and included it in `tsconfig.tests.json`.
- Updated `tests/unit/key-manager-runtime-fallback.test.ts` so the runtime fallback guard follows the new provider helper boundary.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4408 lines; `src/services/auth/keyManagerProviders.ts` 102 lines; `src/services/auth/keyManagerStorage.ts` 34 lines; `tests/unit/key-manager-provider-persistence-contract.test.ts` 66 lines; `tests/unit/key-manager-runtime-fallback.test.ts` 96 lines; `tsconfig.tests.json` 93 lines.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-persistence-contract.test.ts` failed first because `src/services/auth/keyManagerProviders.ts` did not export `mergeCloudProvidersWithLocalRuntimeState` and `keyManager.ts` still owned the private implementation.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-persistence-contract.test.ts tests/unit/key-manager-cloud-sync.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/user-api-cloud-storage.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/auth-data-routes.test.ts` passed (59/59).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing allowlisted migration and legacy bridge exceptions.
- Security validation passed: `npm.cmd run governance:security`.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage now includes 64 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1220/1220).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Independent spec review reported no blockers and reran `cmd /c npm run typecheck` plus focused provider persistence/runtime fallback tests (13/13).
- Independent security/code-quality review reported no findings and reran focused provider persistence/runtime fallback tests (13/13), `cmd /c npm run typecheck:tests`, and `cmd /c npm run governance:security`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerProviders.ts src/services/auth/keyManagerStorage.ts tests/unit/key-manager-provider-persistence-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure service/helper extraction with no visual surface, CSS, route component, or browser-visible workflow changed.
- Explicitly excluded scope: cloud save/load semantics, token refresh, backoff, localStorage policy, credential redaction, empty-cloud preservation guards, UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, and `OpenAICompatibleAdapter.ts`.

## Stage Two M32 keyManager Provider Linked-Slot Matching Extraction

- Extracted provider-to-legacy-slot matching into `findProviderLinkedSlots` in `src/services/auth/keyManagerProviderLinks.ts`.
- `syncLegacySlotsWithProvider` now delegates slot matching with `{ allowSingleBaseUrlFallback: true }`, preserving the previous sync-only fallback that links a single slot with the same normalized base URL when no apiKey/name match exists.
- `clearLegacySlotsForRemovedProvider` now delegates exact provider slot matching without fallback, preserving stricter removal behavior.
- Slot mutation, `saveState`, runtime/auth/model resolution, provider persistence orchestration, cloud sync, credentials, tokens, and localStorage policy remain in their previous owners.
- Added `tests/unit/key-manager-provider-links-contract.test.ts` and included it in `tsconfig.tests.json`.
- Changed `src/services/auth/keyManagerProviderLinks.ts` to import `../api/apiConfig.ts` so Node ESM contract tests can import the helper directly.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4367 lines; `src/services/auth/keyManagerProviderLinks.ts` 154 lines; `tests/unit/key-manager-provider-links-contract.test.ts` 78 lines; `tsconfig.tests.json` 94 lines.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-links-contract.test.ts` failed first with 2/2 failures because `findProviderLinkedSlots` did not exist and `keyManagerProviderLinks.ts` still imported `../api/apiConfig` without the `.ts` extension needed by Node ESM.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-links-contract.test.ts` passed (2/2).
- Broader provider/keyManager targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-links-contract.test.ts tests/unit/key-manager-provider-persistence-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/provider-strategy.test.ts tests/unit/official-route-default-models.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/user-api-cloud-storage.test.ts` passed (70/70).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing allowlisted migration and legacy bridge exceptions.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage now includes 65 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1222/1222).
- Build validation passed: `npm.cmd run build`.
- Security validation passed: `npm.cmd run governance:security`.
- Review fix: independent spec and security review both caught that fallback must not use `previousProvider.baseUrl` when current `provider.baseUrl` is blank. The helper now falls back only through the original first provider base URL, and the contract test covers the blank-current/previous-old-base case.
- Post-review targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-links-contract.test.ts tests/unit/key-manager-provider-persistence-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/provider-strategy.test.ts tests/unit/official-route-default-models.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/user-api-cloud-storage.test.ts` passed (70/70).
- Post-review type validation passed: `npm.cmd run typecheck`; semantic test coverage remains 65 test files.
- Post-review security validation passed: `npm.cmd run governance:security`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerProviderLinks.ts tests/unit/key-manager-provider-links-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/key-manager-provider-persistence-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure service/helper extraction with no visual surface, CSS, route component, or browser-visible workflow changed.
- Explicitly excluded scope: slot mutation semantics, provider save/remove side effects, `saveState`, model/runtime/auth resolution, credential persistence, token refresh, cloud sync, localStorage policy, UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, and `OpenAICompatibleAdapter.ts`.

## Stage Two M33 keyManager Provider Usage Helper Extraction

- Extracted `isUsageLimitExceeded` and provider usage delta math into `src/services/auth/keyManagerProviderUsage.ts`.
- `src/services/auth/keyManager.ts` now delegates slot/provider usage limit checks and provider usage counter mutation to the helper.
- The helper preserves budget/token limit checks, usage initialization, daily reset, total/daily clamping, and `updatedAt` mutation behavior.
- `KeyManager` still owns provider lookup, provider loading, save/notify/cloud-sync orchestration, credential policy, token refresh, backoff, localStorage policy, slot mutation, and runtime/model resolution.
- Added `tests/unit/key-manager-provider-usage-contract.test.ts` and included it in `tsconfig.tests.json`.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4948 lines; `src/services/auth/keyManagerProviderUsage.ts` 67 lines; `tests/unit/key-manager-provider-usage-contract.test.ts` 99 lines; `tsconfig.tests.json` 95 lines.
- TDD evidence: RED was verified earlier in this slice by the contract failing before `src/services/auth/keyManagerProviderUsage.ts` existed and while `keyManager.ts` still owned the private usage helper; GREEN is refreshed below with the targeted provider/keyManager gate and full required validation.
- Independent spec/code-quality review reported no M33 blockers and confirmed no secret-bearing persistence, API key/token logging, or provider lookup/save/cloud-sync movement was introduced.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-usage-contract.test.ts tests/unit/key-manager-provider-links-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/key-manager-provider-persistence-contract.test.ts` passed (17/17).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy-zone bridge exceptions.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage now includes 66 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1224/1224).
- Build validation passed: `npm.cmd run build`.
- Security validation passed: `npm.cmd run governance:security`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerProviderUsage.ts tests/unit/key-manager-provider-usage-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M33 is a non-UI service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerProviderUsage.ts`, `tests/unit/key-manager-provider-usage-contract.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, credential storage, token/backoff behavior, and broad dead-code cleanup.

## Stage Two M34 keyManager Route ID Helper Extraction

- Extracted `extractSlotRouteTarget`, `decodeRouteSuffix`, `matchesSlotRouteSuffix`, `matchesProviderRouteSuffix`, `buildStableSystemRouteId`, `buildUserSlotRouteId`, and `buildProviderRouteId` into `src/services/auth/keyManagerRouteIds.ts`.
- `src/services/auth/keyManager.ts` now imports those pure helpers and retains routing selection, model filtering, slot/provider lookup, provider load/save, cloud sync, credential policy, token refresh, backoff, localStorage policy, and persistence orchestration.
- The helper preserves legacy suffix behavior, including trim/lowercase-before-decode, malformed percent-encoding fallback, `slot_key_*` target extraction, provider-prefixed route targets, slot id/name/provider/serverName matching, provider id/name matching, and encoded route ID builders.
- Added `tests/unit/key-manager-route-ids-contract.test.ts` and included it in `tsconfig.tests.json`.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4870 lines; `src/services/auth/keyManagerRouteIds.ts` 94 lines; `tests/unit/key-manager-route-ids-contract.test.ts` 97 lines; `tsconfig.tests.json` 96 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-route-ids-contract.test.ts` failed first (0/3) because `src/services/auth/keyManagerRouteIds.ts` did not exist and `keyManager.ts` still owned the local helpers.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-route-ids-contract.test.ts` passed (3/3).
- Broader route/provider targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-route-ids-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/official-route-default-models.test.ts tests/unit/key-manager-provider-links-contract.test.ts` passed (21/21).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy-zone bridge exceptions.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage now includes 67 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1227/1227).
- Build validation passed: `npm.cmd run build`.
- Security validation passed: `npm.cmd run governance:security`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerRouteIds.ts tests/unit/key-manager-route-ids-contract.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M34 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerRouteIds.ts`, `tests/unit/key-manager-route-ids-contract.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, channel-config key non-exposure hardening, credential sanitizer cleanup, provider persistence redesign, cloud sync movement, token/backoff behavior, and broad dead-code cleanup.

## Stage Two M35 keyManager Credential Sanitizer Extraction

- Extracted the duplicated ASCII API-key sanitizer into `src/services/auth/keyManagerCredentialSanitizer.ts`.
- `src/services/auth/keyManager.ts` now delegates the `testChannel` clean key path and `addKey` trimmed key path to `sanitizeAsciiApiKey`.
- The helper preserves the existing behavior exactly: remove non-ASCII characters first, then trim whitespace.
- Credential storage, provider persistence, cloud sync, browser diagnostics fail-closed policy, runtime routing, token refresh, backoff, and localStorage policy remain in their previous owners.
- Added `tests/unit/key-manager-credential-sanitizer-contract.test.ts` and included it in `tsconfig.tests.json`.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4871 lines; `src/services/auth/keyManagerCredentialSanitizer.ts` 3 lines; `tests/unit/key-manager-credential-sanitizer-contract.test.ts` 43 lines; `tsconfig.tests.json` 97 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-credential-sanitizer-contract.test.ts` failed first (0/2) because `src/services/auth/keyManagerCredentialSanitizer.ts` did not exist and `keyManager.ts` still owned the duplicated sanitizer expression.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-credential-sanitizer-contract.test.ts` passed (2/2).
- Broader credential/security targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-credential-sanitizer-contract.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/official-route-default-models.test.ts tests/unit/key-manager-key-type-contract.test.ts` passed (16/16).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy-zone bridge exceptions.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage now includes 68 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1229/1229).
- Build validation passed: `npm.cmd run build`.
- Security validation passed: `npm.cmd run governance:security`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerCredentialSanitizer.ts tests/unit/key-manager-credential-sanitizer-contract.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M35 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerCredentialSanitizer.ts`, `tests/unit/key-manager-credential-sanitizer-contract.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, channel-config key non-exposure hardening, provider persistence redesign, cloud sync movement, token/backoff behavior, localStorage policy changes, and broad dead-code cleanup.

## Stage Two M36 keyManager Channel Config Secret Redaction Extraction

- Extracted channel config API-key redaction into `src/services/auth/keyManagerChannelConfigSecrets.ts`.
- `src/services/auth/keyManager.ts` now uses `getRedactedChannelConfigApiKey()` for both slot and provider channel config `apiKey` fields instead of hard-coded empty strings.
- The helper preserves the existing public channel config behavior: channel configs never expose stored slot or provider API keys.
- Existing `tests/unit/frontend-key-boundary-hardening.test.ts` now asserts the redaction helper is used and that the old literal `apiKey: ''` pattern does not return to `keyManager.ts`.
- Credential storage, provider persistence, cloud sync, browser diagnostics fail-closed policy, runtime routing, token refresh, backoff, localStorage policy, and channel config construction remain in their previous owners.
- Added `tests/unit/key-manager-channel-config-secrets-contract.test.ts` and included it in `tsconfig.tests.json`.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4872 lines; `src/services/auth/keyManagerChannelConfigSecrets.ts` 3 lines; `tests/unit/key-manager-channel-config-secrets-contract.test.ts` 39 lines; `tsconfig.tests.json` 98 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-channel-config-secrets-contract.test.ts` failed first (0/2) because `src/services/auth/keyManagerChannelConfigSecrets.ts` did not exist and `keyManager.ts` still owned hard-coded channel `apiKey: ''` fields.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-channel-config-secrets-contract.test.ts` passed (2/2).
- Broader channel/security targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-channel-config-secrets-contract.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/official-route-default-models.test.ts` passed (25/25).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy-zone bridge exceptions.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage now includes 69 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1231/1231).
- Build validation passed: `npm.cmd run build`.
- Security validation passed: `npm.cmd run governance:security`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerChannelConfigSecrets.ts tests/unit/key-manager-channel-config-secrets-contract.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M36 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerChannelConfigSecrets.ts`, `tests/unit/key-manager-channel-config-secrets-contract.test.ts`, `tests/unit/frontend-key-boundary-hardening.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, token/backoff behavior, localStorage policy changes, and broad dead-code cleanup.

## Stage Two M37 keyManager Dead-Code Pruning

- Removed three source-proven unused local definitions from `src/services/auth/keyManager.ts`: `isLegacyGoogleModelList`, private `migrateFromOldFormat`, and local `getDefaultGoogleModels`.
- Added `tests/unit/key-manager-dead-code-pruning-contract.test.ts` to keep those local helper definitions from returning, and included it in `tsconfig.tests.json`.
- Reference proof: `rg -n "isLegacyGoogleModelList|migrateFromOldFormat|getDefaultGoogleModels" . -g "!node_modules/**" -g "!dist/**"` now only finds the pruning contract.
- Read-only scope review by subagent Peirce found no accidental broad cleanup, no exported API removal, no UI/release/provider-routing/runtime changes, and no key storage regression in the edited area.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4252 lines; `tests/unit/key-manager-dead-code-pruning-contract.test.ts` 16 lines; `tsconfig.tests.json` 99 lines.
- TDD RED evidence was verified earlier in this slice: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-dead-code-pruning-contract.test.ts` failed before the three definitions were deleted.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-dead-code-pruning-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/official-route-default-models.test.ts tests/unit/governance-contract.test.ts` passed (21/21).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy-zone bridge exceptions.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage now includes 70 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1232/1232).
- Build validation passed: `npm.cmd run build`.
- Security validation passed: `npm.cmd run governance:security`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts tests/unit/key-manager-dead-code-pruning-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M37 is a non-UI dead-code pruning slice with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `tests/unit/key-manager-dead-code-pruning-contract.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, localStorage policy changes, and exported API cleanup.

## Stage Two M38 keyManager Browser Diagnostics Message Wrapper Pruning

- Removed the private `getBrowserDirectProviderChecksDisabledMessage()` wrapper from `src/services/auth/keyManager.ts`.
- `testChannel`, `validateKey`, and `syncProviderPricingDetailed` now return `BROWSER_DIRECT_PROVIDER_CHECKS_DISABLED_MESSAGE` directly for browser-runtime diagnostics blocks.
- `src/services/auth/keyManagerStorage.ts` remains the single owner of the disabled browser-direct diagnostics message and disabled-error factory.
- `tests/unit/frontend-key-boundary-hardening.test.ts` now asserts the wrapper stays absent and that the three browser-runtime diagnostic returns use the storage-owned constant directly.
- Credential storage, provider persistence, cloud sync, channel config construction, runtime routing, token refresh, backoff, localStorage policy, and exported fetch helper fail-closed behavior remain unchanged.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4249 lines; `tests/unit/frontend-key-boundary-hardening.test.ts` 216 lines; `tsconfig.tests.json` 99 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/frontend-key-boundary-hardening.test.ts` failed first because `private getBrowserDirectProviderChecksDisabledMessage(): string` still existed.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/key-manager-dead-code-pruning-contract.test.ts tests/unit/key-manager-channel-config-secrets-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/official-route-default-models.test.ts` passed (26/26).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy-zone bridge exceptions.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage remains 70 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1232/1232).
- Build validation passed: `npm.cmd run build`.
- Security validation passed: `npm.cmd run governance:security`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts tests/unit/frontend-key-boundary-hardening.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M38 is a non-UI diagnostics-source cleanup with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `tests/unit/frontend-key-boundary-hardening.test.ts`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, localStorage policy changes, and exported API cleanup.

## Stage Two M39 keyManager Legacy Google Model Constant Pruning

- Removed the now-unreferenced `LEGACY_GOOGLE_MODELS` constant from `src/services/auth/keyManager.ts`.
- Extended `tests/unit/key-manager-dead-code-pruning-contract.test.ts` so the legacy constant cannot return alongside the previously pruned unused helpers.
- Source reference proof: `rg -n "LEGACY_GOOGLE_MODELS|isLegacyGoogleModelList|migrateFromOldFormat|getDefaultGoogleModels" src tests -g "!node_modules/**" -g "!dist/**"` now finds `LEGACY_GOOGLE_MODELS` only in the pruning contract.
- Read-only subagent review independently identified the same constant as the next safest source-proven cleanup and did not recommend entering key storage, cloud sync, provider persistence, or credential management.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4247 lines; `tests/unit/key-manager-dead-code-pruning-contract.test.ts` 17 lines; `tsconfig.tests.json` 99 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-dead-code-pruning-contract.test.ts` failed first because `const LEGACY_GOOGLE_MODELS =` still existed.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-dead-code-pruning-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/official-route-default-models.test.ts tests/unit/governance-contract.test.ts` passed (21/21).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy-zone bridge exceptions.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage remains 70 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1232/1232).
- Build validation passed: `npm.cmd run build`.
- Security validation passed: `npm.cmd run governance:security`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Source reference check passed: `rg -n "LEGACY_GOOGLE_MODELS|isLegacyGoogleModelList|migrateFromOldFormat|getDefaultGoogleModels" src tests -g "!node_modules/**" -g "!dist/**"` finds only pruning-contract assertions.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts tests/unit/key-manager-dead-code-pruning-contract.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M39 is a non-UI source-proven constant pruning slice with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `tests/unit/key-manager-dead-code-pruning-contract.test.ts`, `plans.md`, `implement.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, localStorage policy changes, and exported API cleanup.

## Stage Two M40 keyManager Pricing Model ID Extraction Helper Split

- Moved the pure `extractModelIdsFromPricingData` helper from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerModelHelpers.ts`.
- `src/services/auth/keyManager.ts` now imports the helper but does not re-export it, preserving the existing public `keyManager.ts` API surface.
- Extended `tests/unit/key-manager-model-helpers-contract.test.ts` to assert helper ownership and preserve non-array handling, candidate priority, `models/` prefix stripping order, whitespace trim, empty filtering, and first-seen dedupe behavior.
- Read-only subagent review confirmed this is the safest next M40 seam and explicitly warned not to merge the adjacent shared pricing cache/snapshot ID resolver in this slice.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4228 lines; `src/services/auth/keyManagerModelHelpers.ts` 197 lines; `tests/unit/key-manager-model-helpers-contract.test.ts` 121 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` failed first because `keyManagerModelHelpers.ts` did not export `extractModelIdsFromPricingData`.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` passed (3/3).
- Model helper/keyManager regression validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/model-id-normalization-parity-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/official-route-default-models.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/provider-image-routing-regression.test.ts` passed (34/34).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy-zone bridge exceptions.
- Security validation passed: `npm.cmd run governance:security`.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage remains 70 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1233/1233).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Source ownership check passed: `rg -n "function extractModelIdsFromPricingData|extractModelIdsFromPricingData" src/services/auth/keyManager.ts src/services/auth/keyManagerModelHelpers.ts tests/unit/key-manager-model-helpers-contract.test.ts` shows the function definition only in `keyManagerModelHelpers.ts`, with one `keyManager.ts` import and one runtime call.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerModelHelpers.ts tests/unit/key-manager-model-helpers-contract.test.ts plans.md implement.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M40 is a non-UI pure helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerModelHelpers.ts`, `tests/unit/key-manager-model-helpers-contract.test.ts`, `plans.md`, `implement.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, localStorage policy changes, and exported API cleanup.

## Stage Two M41 keyManager Model Category Helper Split

- Moved the pure public `categorizeModels` helper from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerModelHelpers.ts`.
- `src/services/auth/keyManager.ts` now imports the helper and re-exports it from the compatibility barrel, preserving the existing public API.
- Extended `tests/unit/key-manager-model-helpers-contract.test.ts` to assert helper ownership, compatibility re-export, video-first category precedence, image/chat/other heuristics, and hybrid category behavior.
- Read-only seam review independently selected this as the safest M41 seam and confirmed the call sites to preserve: channel capability grouping and auto-detect category output.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4172 lines; `src/services/auth/keyManagerModelHelpers.ts` 255 lines; `tests/unit/key-manager-model-helpers-contract.test.ts` 151 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` failed first because `categorizeModels` was still owned by `keyManager.ts`.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` passed (4/4).
- Model helper/keyManager regression validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/model-id-normalization-parity-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/official-route-default-models.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/provider-image-routing-regression.test.ts` passed (35/35).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy-zone bridge exceptions.
- Security validation passed: `npm.cmd run governance:security`.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage remains 70 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1234/1234).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Source ownership check passed: `rg -n "export function categorizeModels|categorizeModels" src/services/auth/keyManager.ts src/services/auth/keyManagerModelHelpers.ts tests/unit/key-manager-model-helpers-contract.test.ts` shows the function definition only in `keyManagerModelHelpers.ts`, with `keyManager.ts` import/re-export and runtime call sites preserved.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerModelHelpers.ts tests/unit/key-manager-model-helpers-contract.test.ts plans.md implement.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M41 is a non-UI pure helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerModelHelpers.ts`, `tests/unit/key-manager-model-helpers-contract.test.ts`, `plans.md`, `implement.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, localStorage policy changes, and exported API cleanup.

## Stage Two M42 keyManager Model Type Inference Helper Split

- Moved the pure `inferModelType` classifier and `GlobalModelType` type from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerModelHelpers.ts`.
- `src/services/auth/keyManager.ts` now imports the classifier and type from the helper module and re-exports `GlobalModelType` for compatibility.
- Extended `tests/unit/key-manager-model-helpers-contract.test.ts` to assert helper ownership and preserve video-first, image, audio, chat, OpenRouter, and default-chat inference behavior.
- Updated `tests/unit/google-official-gemini-protocol-guards.test.ts` so its TTS routing source-contract follows the moved classifier owner in `keyManagerModelHelpers.ts`.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4720 lines; `src/services/auth/keyManagerModelHelpers.ts` 333 lines; `tests/unit/key-manager-model-helpers-contract.test.ts` 183 lines; `tests/unit/google-official-gemini-protocol-guards.test.ts` 58 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` failed first because `inferModelType` and `GlobalModelType` were still owned by `keyManager.ts`.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` passed (5/5).
- Source-contract owner validation passed after the moved TTS heuristic assertion was updated: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/google-official-gemini-protocol-guards.test.ts tests/unit/key-manager-model-helpers-contract.test.ts` passed (8/8).
- Browser QA: skipped because M42 is a non-UI pure helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerModelHelpers.ts`, `tests/unit/key-manager-model-helpers-contract.test.ts`, `tests/unit/google-official-gemini-protocol-guards.test.ts`, `plans.md`, `implement.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, localStorage policy changes, and exported API cleanup.

## Stage Two M43 keyManager Silent Pricing URL Helper Split

- Moved the pure silent provider pricing URL normalization from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerPricingUrl.ts`.
- `src/services/auth/keyManager.ts` now calls `buildSilentProviderPricingUrl(cleanUrl)` while preserving the existing non-blocking pricing fetch, headers, pricing override application, and local error handling.
- Added `tests/unit/key-manager-pricing-url-contract.test.ts` to guard helper ownership and preserve marketing-suffix stripping, trailing-slash trimming, `/v1` removal, and final `/pricing` endpoint behavior.
- Added the pricing URL contract to `tsconfig.tests.json`.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4714 lines; `src/services/auth/keyManagerPricingUrl.ts` 12 lines; `tests/unit/key-manager-pricing-url-contract.test.ts` 48 lines; `tsconfig.tests.json` 100 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-pricing-url-contract.test.ts` failed first because `src/services/auth/keyManagerPricingUrl.ts` did not exist and `keyManager.ts` still owned inline pricing URL construction.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-pricing-url-contract.test.ts` passed (2/2).
- Targeted M43 regression gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-pricing-url-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/user-route-pricing-endpoint-override.test.ts tests/unit/kk-api-client.test.ts` passed (37/37).
- Passed: `npm.cmd run architecture:check` with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Passed: `npm.cmd run governance:security`.
- Passed: `npm.cmd run typecheck`; test semantic check now covers 71 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1237/1237).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Source ownership check passed: `rg -n "PROVIDER_MARKETING_SUFFIX_RE|buildSilentProviderPricingUrl|sanitizedPricingBase|const pricingUrl =" src/services/auth/keyManager.ts src/services/auth/keyManagerPricingUrl.ts tests/unit/key-manager-pricing-url-contract.test.ts` shows the regex and normalization internals only in `keyManagerPricingUrl.ts`, with `keyManager.ts` limited to import and call.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerPricingUrl.ts tests/unit/key-manager-pricing-url-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M43 is a non-UI pure helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerPricingUrl.ts`, `tests/unit/key-manager-pricing-url-contract.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, localStorage policy changes, and exported API cleanup.

## Stage Two M44 keyManager Deprecated-Model Helper Split

- Moved the pure `isDeprecatedModel` membership helper from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerModelHelpers.ts`.
- `src/services/auth/keyManager.ts` now imports and re-exports `isDeprecatedModel` from the helper module, preserving the existing public import path.
- Extended `tests/unit/key-manager-model-helpers-contract.test.ts` to assert helper ownership, compatibility re-export, and exact case-sensitive `DEPRECATED_MODELS.includes(modelId)` behavior.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4709 lines; `src/services/auth/keyManagerModelHelpers.ts` 337 lines; `tests/unit/key-manager-model-helpers-contract.test.ts` 196 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` failed first because `isDeprecatedModel` was still owned by `keyManager.ts` and was not exported from `keyManagerModelHelpers.ts`.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` passed (6/6).
- Model-helper validation gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/model-id-normalization-parity-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/google-official-gemini-protocol-guards.test.ts` passed (37/37).
- Architecture and security gates passed: `npm.cmd run architecture:check` passed; `npm.cmd run governance:security` passed.
- Full validation passed for this slice: `npm.cmd run typecheck`, `npm.cmd run test:unit` (1238/1238), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- plans.md implement.md status.md src/services/auth/keyManager.ts src/services/auth/keyManagerModelHelpers.ts tests/unit/key-manager-model-helpers-contract.test.ts`.
- Ownership check passed: `rg -n "isDeprecatedModel" src/services/auth/keyManager.ts src/services/auth/keyManagerModelHelpers.ts tests/unit/key-manager-model-helpers-contract.test.ts` shows the helper implementation only in `src/services/auth/keyManagerModelHelpers.ts`; `src/services/auth/keyManager.ts` keeps only import and compatibility re-export references.
- Browser QA: skipped because M44 is a non-UI pure helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerModelHelpers.ts`, `tests/unit/key-manager-model-helpers-contract.test.ts`, `plans.md`, `implement.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, model filtering semantics, localStorage policy changes, and exported API cleanup.

## Stage Two M45 keyManager 12AI Base URL Dead-Code Pruning

- Removed the source-proven unused private `get12AIBaseUrl` wrapper from `src/services/auth/keyManager.ts`.
- Removed the now-unused `RegionService` import from `src/services/auth/keyManager.ts`.
- Kept the actual 12AI runtime URL source of truth unchanged in `src/services/system/RegionService.ts`; `src/services/llm/OpenAICompatibleAdapter.ts` still imports and calls `RegionService.get12AIBaseUrl()` directly.
- Extended `tests/unit/key-manager-dead-code-pruning-contract.test.ts` with absence assertions for the local wrapper and import.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4701 lines; `tests/unit/key-manager-dead-code-pruning-contract.test.ts` 23 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-dead-code-pruning-contract.test.ts` failed first because the `RegionService` import and `get12AIBaseUrl` wrapper still existed in `keyManager.ts`.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-dead-code-pruning-contract.test.ts` passed (1/1).
- Architecture and security gates passed: `npm.cmd run architecture:check` passed; `npm.cmd run governance:security` passed.
- Full validation passed for this slice: `npm.cmd run typecheck`, `npm.cmd run test:unit` (1238/1238), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- plans.md implement.md status.md src/services/auth/keyManager.ts tests/unit/key-manager-dead-code-pruning-contract.test.ts`.
- Ownership check passed: `rg -n "RegionService|get12AIBaseUrl" src/services/auth/keyManager.ts tests/unit/key-manager-dead-code-pruning-contract.test.ts src/services/system/RegionService.ts src/services/llm/OpenAICompatibleAdapter.ts` shows no `RegionService` or `get12AIBaseUrl` reference in `src/services/auth/keyManager.ts`; the remaining live runtime calls are in `src/services/llm/OpenAICompatibleAdapter.ts`.
- Read-only subagent risk review found no blocker: `get12AIBaseUrl` had no key-manager call sites, while global `RegionService` must remain because `OpenAICompatibleAdapter.ts` has live direct callers.
- Browser QA: skipped because M45 is a non-UI source-proven dead-code pruning slice with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `tests/unit/key-manager-dead-code-pruning-contract.test.ts`, `plans.md`, `implement.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, 12AI runtime URL resolution, model filtering semantics, localStorage policy changes, and exported API cleanup.

## Stage Two M46 keyManager Google Official Model Predicate Split

- Moved the pure `isGoogleOfficialModelId` predicate from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerModelHelpers.ts`.
- `src/services/auth/keyManager.ts` now imports the predicate from the helper and re-exports it from the compatibility facade.
- Preserved the existing behavior exactly: case-sensitive `models/` prefix stripping, lowercased prefix matching, no trimming, and `gemini-` / `imagen-` / `veo-` pass conditions.
- Extended `tests/unit/key-manager-model-helpers-contract.test.ts` to assert helper ownership, facade re-export, no helper back-edge to `keyManager.ts`, and predicate behavior for `models/gemini-*`, uppercase model IDs, image/video prefixes, non-Google IDs, uppercase `Models/` prefix, and leading whitespace.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4698 lines; `src/services/auth/keyManagerModelHelpers.ts` 342 lines; `tests/unit/key-manager-model-helpers-contract.test.ts` 215 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` failed first because `keyManager.ts` still owned `isGoogleOfficialModelId` and the helper did not export it.
- Review RED evidence: after the initial move, the same targeted command failed because `keyManager.ts` did not yet re-export `isGoogleOfficialModelId` from the compatibility facade.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` passed (7/7).
- Model-helper validation gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/model-id-normalization-parity-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/google-official-gemini-protocol-guards.test.ts` passed (23/23).
- Architecture and security gates passed: `npm.cmd run architecture:check` passed; `npm.cmd run governance:security` passed.
- Full validation passed for this slice: `npm.cmd run typecheck`, `npm.cmd run test:unit` (1239/1239), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- plans.md implement.md status.md src/services/auth/keyManager.ts src/services/auth/keyManagerModelHelpers.ts tests/unit/key-manager-model-helpers-contract.test.ts`.
- Ownership check passed: `rg -n "isGoogleOfficialModelId" src/services/auth/keyManager.ts src/services/auth/keyManagerModelHelpers.ts tests/unit/key-manager-model-helpers-contract.test.ts` shows the helper implementation only in `src/services/auth/keyManagerModelHelpers.ts`; `src/services/auth/keyManager.ts` keeps import/re-export references and the three preserved model-list filtering call sites.
- Read-only subagent risk review found only the missing facade re-export; current owner/call-site review confirmed the predicate had three `keyManager.ts` call sites and no external production callers before extraction.
- Browser QA: skipped because M46 is a non-UI pure model predicate extraction with no component, CSS, route, or browser-visible workflow changes.
- Commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerModelHelpers.ts`, `tests/unit/key-manager-model-helpers-contract.test.ts`, `plans.md`, `implement.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, model-list filtering call sites, 12AI runtime URL resolution, localStorage policy changes, and exported API cleanup beyond the compatibility facade.

## Stage Two M47 keyManager Channel Capabilities Helper Split

- Moved the pure `buildChannelCapabilities` helper from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerChannelCapabilities.ts`.
- `src/services/auth/keyManager.ts` now imports the helper and delegates both slot and provider channel config capability construction through it.
- Preserved the existing behavior exactly: raw `'*'` wildcard enables all core modalities; empty or non-array model lists keep `chat: true`; non-empty unknown models do not imply chat; pipe/parenthetical display names are parsed before category checks; `pricingDiscovery` and `managementApi` only follow native support flags; audio uses the historical `/audio|tts|suno|lyria|minimax-t2a/i` regex.
- Added `tests/unit/key-manager-channel-capabilities-contract.test.ts` and included it in `tsconfig.tests.json`.
- Contract coverage guards helper ownership, no back-edge to `keyManager.ts` or storage/persistence/UI/adapter modules, both `keyManager.ts` call sites, empty/null/undefined inputs, exact wildcard behavior, parsed model category precedence, support-flag mapping, and audio positive/negative parity cases.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4682 lines; `src/services/auth/keyManagerChannelCapabilities.ts` 23 lines; `tests/unit/key-manager-channel-capabilities-contract.test.ts` 173 lines; `tsconfig.tests.json` 101 lines.
- Initial targeted RED/GREEN note: this slice was already in-progress when resumed; the first local targeted run failed only on a contract regex that falsely matched `keyManagerModelHelpers` and a Node direct-import extension issue, then passed after the minimal fixes.
- Targeted GREEN validation passed after review hardening: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-channel-capabilities-contract.test.ts` passed (2/2).
- Read-only subagent risk review found no implementation delta from the old private method, then requested stronger negative capability parity coverage; the negative cases were added before the final gate.
- Architecture and security gates passed: `npm.cmd run architecture:check` passed with existing allowlisted exceptions; `npm.cmd run governance:security` passed.
- Full validation passed for this slice: `npm.cmd run typecheck`; `npm.cmd run test:unit` (1241/1241); `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerChannelCapabilities.ts tests/unit/key-manager-channel-capabilities-contract.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M47 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerChannelCapabilities.ts`, `tests/unit/key-manager-channel-capabilities-contract.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior beyond the pure capabilities builder, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, model-list filtering call sites, 12AI runtime URL resolution, localStorage policy changes, and exported API cleanup.

## Stage Two M48 keyManager API Type Detector Helper Split

- Moved the pure `detectApiType` string classifier from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerApiType.ts`.
- `src/services/auth/keyManager.ts` now imports `detectApiType` for `autoDetectAndConfigureModels` and re-exports it for compatibility.
- Preserved the existing behavior exactly: `AIza` keys or lowercase Google API substrings classify as `google-official`; `sk-` keys with no base URL or an `api.openai.com` base classify as `openai`; any other non-empty non-Google base URL classifies as `proxy`; otherwise the result is `unknown`. Historical case-sensitive substring matching and no trimming are intentionally locked.
- Added `tests/unit/key-manager-api-type-contract.test.ts` and included it in `tsconfig.tests.json`.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-api-type-contract.test.ts` failed first because `src/services/auth/keyManagerApiType.ts` did not exist and `keyManager.ts` still owned the inline exported function.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-api-type-contract.test.ts` passed (2/2).
- Adjacent targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-api-type-contract.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/key-manager-channel-capabilities-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts` passed (18/18).
- Architecture and security gates passed: `npm.cmd run architecture:check` passed with existing allowlisted exceptions; `npm.cmd run governance:security` passed.
- Full validation passed for this slice: `npm.cmd run typecheck`; `npm.cmd run test:unit` (1243/1243); `npm.cmd run build`.
- Agent-doc and encoding validation passed: `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- plans.md implement.md status.md src/services/auth/keyManager.ts src/services/auth/keyManagerApiType.ts tests/unit/key-manager-api-type-contract.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4662 lines; `src/services/auth/keyManagerApiType.ts` 23 lines; `tests/unit/key-manager-api-type-contract.test.ts` 50 lines; `tsconfig.tests.json` 102 lines.
- Browser QA: skipped because M48 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerApiType.ts`, `tests/unit/key-manager-api-type-contract.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, remote model fetch behavior, model-list filtering call sites, 12AI runtime URL resolution, localStorage policy changes, and exported API cleanup beyond the compatibility facade.

## Stage Two M49 keyManager Default Model Constants Helper Split

- Moved default/whitelist model constants from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerDefaultModels.ts`.
- `src/services/auth/keyManager.ts` now imports only the internally used `DEFAULT_GOOGLE_MODELS`, `DEFAULT_OPENAI_MODELS`, and `GOOGLE_IMAGE_WHITELIST`, and re-exports all six constants for compatibility: `GOOGLE_IMAGE_WHITELIST`, `VIDEO_MODEL_WHITELIST`, `ADVANCED_IMAGE_MODEL_WHITELIST`, `AUDIO_MODEL_WHITELIST`, `DEFAULT_GOOGLE_MODELS`, and `DEFAULT_OPENAI_MODELS`.
- Preserved the existing values exactly, including `VIDEO_MODEL_WHITELIST` value `sv3d`, `DEFAULT_OPENAI_MODELS = ['dall-e-3', 'dall-e-2', 'gpt-4o', 'gpt-4o-mini']`, and `DEFAULT_GOOGLE_MODELS` spreading `GOOGLE_IMAGE_WHITELIST`.
- Added `tests/unit/key-manager-default-models-contract.test.ts` and included it in `tsconfig.tests.json`.
- Updated `tests/unit/official-route-default-models.test.ts` so the official route default-model contract reads constants from the new helper while preserving the `keyManager.ts` routing behavior assertions.
- RED evidence from the resumed WIP: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-default-models-contract.test.ts tests/unit/official-route-default-models.test.ts` initially failed because `src/services/auth/keyManagerDefaultModels.ts` did not exist and constants still lived inline in `keyManager.ts`.
- Targeted GREEN validation passed after implementation and test expectation correction: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-default-models-contract.test.ts tests/unit/official-route-default-models.test.ts` passed (7/7).
- Adjacent keyManager/provider targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-default-models-contract.test.ts tests/unit/official-route-default-models.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/twelve-ai-doc-alignment.test.ts` passed (24/24).
- Architecture and security gates passed: `npm.cmd run architecture:check` passed with existing allowlisted exceptions; `npm.cmd run governance:security` passed.
- Full validation passed for this slice: `npm.cmd run typecheck`; `npm.cmd run test:unit` (1245/1245); `npm.cmd run build`.
- Agent-doc and encoding validation passed: `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- plans.md implement.md validation.md status.md src/services/auth/keyManager.ts src/services/auth/keyManagerDefaultModels.ts tests/unit/key-manager-default-models-contract.test.ts tests/unit/official-route-default-models.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4622 lines; `src/services/auth/keyManagerDefaultModels.ts` 53 lines; `tests/unit/key-manager-default-models-contract.test.ts` 79 lines; `tsconfig.tests.json` 103 lines.
- Subagent read-only review found no behavior drift and flagged one staging risk: the new helper must be tracked with `keyManager.ts`; this commit scope includes it.
- Browser QA: skipped because M49 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerDefaultModels.ts`, `tests/unit/key-manager-default-models-contract.test.ts`, `tests/unit/official-route-default-models.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, remote model fetch behavior, model-list filtering call sites, 12AI runtime URL resolution, localStorage policy changes, and exported API cleanup beyond the compatibility facade.

## Stage Two M50 keyManager Provider Presets Helper Split

- Moved provider preset data from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerProviderPresets.ts`.
- `src/services/auth/keyManager.ts` now imports `PROVIDER_PRESETS` for provider creation and documented 12AI model fallback, and re-exports it for compatibility.
- Preserved the existing preset order and values, including `openclaw.defaultApiKey`, `custom.format = 'auto'`, `12ai`/`12ai-nanobanana` Gemini preset models, Flow2API defaults, and Wuyin NanoBanana2 defaults.
- Added `tests/unit/key-manager-provider-presets-contract.test.ts` and included it in `tsconfig.tests.json`.
- Updated `tests/unit/twelve-ai-doc-alignment.test.ts` and `tests/unit/flow2api-provider-support.test.ts` so preset-content assertions follow the new helper while `keyManager.ts` still owns runtime mapping behavior checks.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-presets-contract.test.ts tests/unit/twelve-ai-doc-alignment.test.ts` failed first because `src/services/auth/keyManagerProviderPresets.ts` did not exist and `keyManager.ts` still owned the inline `PROVIDER_PRESETS` block.
- Targeted GREEN validation passed after implementation and adjacent contract updates: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-presets-contract.test.ts tests/unit/twelve-ai-doc-alignment.test.ts tests/unit/flow2api-provider-support.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/official-route-default-models.test.ts` passed (25/25).
- Architecture and security gates passed: `npm.cmd run architecture:check` passed with existing allowlisted exceptions; `npm.cmd run governance:security` passed.
- Typecheck initially failed because the helper used `satisfies` and lost the old string index signature for `PROVIDER_PRESETS[presetKey]`; the helper now exports `Record<string, KeyManagerProviderPreset>` to preserve old dynamic preset-key lookup behavior.
- Full validation passed for this slice: `npm.cmd run typecheck`; `npm.cmd run test:unit` (1247/1247); `npm.cmd run build`.
- Agent-doc and encoding validation passed: `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerProviderPresets.ts tests/unit/key-manager-provider-presets-contract.test.ts tests/unit/twelve-ai-doc-alignment.test.ts tests/unit/flow2api-provider-support.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4485 lines; `src/services/auth/keyManagerProviderPresets.ts` 149 lines; `tests/unit/key-manager-provider-presets-contract.test.ts` 64 lines; `tsconfig.tests.json` 104 lines.
- Browser QA: skipped because M50 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerProviderPresets.ts`, `tests/unit/key-manager-provider-presets-contract.test.ts`, `tests/unit/twelve-ai-doc-alignment.test.ts`, `tests/unit/flow2api-provider-support.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, remote model fetch behavior, model-list filtering call sites, 12AI runtime URL resolution, localStorage policy changes, and exported API cleanup beyond the compatibility facade.

## Stage Two M51 keyManager Documented Static Model Helper Split

- Moved `getDocumentedStaticModelsForProvider` from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerProviderPresets.ts`.
- `src/services/auth/keyManager.ts` now imports and re-exports `getDocumentedStaticModelsForProvider` from the provider presets helper for compatibility while preserving all existing call sites.
- The helper remains pure preset-derived data: non-`12ai` strategy IDs return `[]`; `12ai` returns the unique union of `PROVIDER_PRESETS['12ai'].models` and `PROVIDER_PRESETS['12ai-nanobanana'].models`.
- Updated `tests/unit/key-manager-provider-presets-contract.test.ts` to verify helper ownership, compatibility export behavior, non-12AI empty fallback, and the 12AI unique union.
- Updated `tests/unit/twelve-ai-doc-alignment.test.ts` so ownership assertions follow `keyManagerProviderPresets.ts` while runtime call-site checks remain in `keyManager.ts` and `connectionTest.ts`.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-presets-contract.test.ts tests/unit/twelve-ai-doc-alignment.test.ts tests/unit/flow2api-provider-support.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/official-route-default-models.test.ts` passed (25/25).
- Architecture and security gates passed: `npm.cmd run architecture:check` passed with existing allowlisted exceptions; `npm.cmd run governance:security` passed.
- Full validation passed for this slice: `npm.cmd run typecheck`; `npm.cmd run test:unit` (1247/1247); `npm.cmd run build`.
- Agent-doc and encoding validation passed: `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerProviderPresets.ts tests/unit/key-manager-provider-presets-contract.test.ts tests/unit/twelve-ai-doc-alignment.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Line counts for this slice: `src/services/auth/keyManager.ts` 3913 lines, down from 3922 at `549a2422`; `src/services/auth/keyManagerProviderPresets.ts` 156 lines, up from 147 at `549a2422`; `tests/unit/key-manager-provider-presets-contract.test.ts` 70 lines; `tests/unit/twelve-ai-doc-alignment.test.ts` 79 lines.
- Subagent seam review disagreed on the next candidate: one recommended this narrower provider-preset-adjacent move, while another recommended model-list filtering extraction. This slice intentionally chose the smaller current WIP and defers `normalizeModelList` / `BLACKLIST_MODELS` because those cross provider compatibility filtering and many call sites.
- Browser QA: skipped because M51 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerProviderPresets.ts`, `tests/unit/key-manager-provider-presets-contract.test.ts`, `tests/unit/twelve-ai-doc-alignment.test.ts`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, remote model fetch behavior, model-list filtering call sites, 12AI runtime URL resolution, localStorage policy changes, and exported API cleanup beyond the compatibility facade.

## Stage Two M52 keyManager Model-List Normalization Helper Split

- Moved `BLACKLIST_MODELS`, the private `shouldFilterModel` predicate, and public `normalizeModelList` from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerModelList.ts`.
- `src/services/auth/keyManager.ts` now imports `normalizeModelList` and re-exports `BLACKLIST_MODELS` plus `normalizeModelList` for compatibility.
- The helper uses explicit `.ts` imports for its runtime dependencies because the focused contract directly imports it through Node's TypeScript test loader.
- Preserved official Google migration/filtering/deduplication behavior, including Nano Banana alias migration, Imagen dated preview filtering, whitelist precedence, and the historical Gemini 2.0 image alias migration into `gemini-2.5-flash-image`.
- Preserved non-official raw alias behavior and provider compatibility filtering, including allowing raw `nano-banana-2` on proxy routes and filtering unsupported 12AI image models.
- Added `tests/unit/key-manager-model-list-contract.test.ts` and included it in `tsconfig.tests.json`.
- RED evidence: the initial targeted run failed because extensionless helper imports could not be resolved by the Node test loader; after adding explicit `.ts` imports, the behavior assertion exposed and then documented the existing Gemini 2.0 image alias migration.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-list-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/key-manager-default-models-contract.test.ts tests/unit/official-route-default-models.test.ts tests/unit/model-id-normalization-parity-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/twelve-ai-doc-alignment.test.ts` passed (49/49).
- Architecture and security gates passed: `npm.cmd run architecture:check` passed with existing allowlisted exceptions; `npm.cmd run governance:security` passed.
- Full validation passed for this slice: `npm.cmd run typecheck` with semantic checks for 76 test files; `npm.cmd run test:unit` (1250/1250); `npm.cmd run build`.
- Agent-doc and encoding validation passed: `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerModelList.ts tests/unit/key-manager-model-list-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Line counts for this slice: `src/services/auth/keyManager.ts` 3845 lines, down from 3913 at `81ba2a24`; `src/services/auth/keyManagerModelList.ts` 80 lines; `tests/unit/key-manager-model-list-contract.test.ts` 70 lines; `tsconfig.tests.json` 105 lines.
- Browser QA: skipped because M52 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerModelList.ts`, `tests/unit/key-manager-model-list-contract.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, remote model fetch behavior, 12AI runtime URL resolution, localStorage policy changes, and exported API cleanup beyond the compatibility facade.

## Stage Two M53 keyManager Global-Model Dead-Code Cleanup

- Removed the duplicate `getGlobalModelList` JSDoc block from `src/services/auth/keyManager.ts`; the canonical detailed JSDoc remains in place.
- Removed the unused local `chatModelIds` allocation from `getGlobalModelList`. The allocation was source-proven dead because no reads existed in the method after M52 moved model-list normalization into `src/services/auth/keyManagerModelList.ts`.
- Extended `tests/unit/key-manager-dead-code-pruning-contract.test.ts` to guard both the duplicate JSDoc and `chatModelIds` from returning.
- Current line counts for this slice: `src/services/auth/keyManager.ts` 4387 physical lines; `tests/unit/key-manager-dead-code-pruning-contract.test.ts` 25 physical lines.
- Browser QA: skipped because M53 is a non-UI source cleanup with no component, CSS, route, or browser-visible workflow changes.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-dead-code-pruning-contract.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/key-manager-runtime-fallback.test.ts` passed (14/14).
- Architecture gate passed: `npm.cmd run architecture:check` passed with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Full validation passed for this slice: `npm.cmd run typecheck` with semantic checks for 76 test files; `npm.cmd run test:unit` (1250/1250); `npm.cmd run build`.
- Agent-doc and encoding validation passed: `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts tests/unit/key-manager-dead-code-pruning-contract.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Active commit scope: `src/services/auth/keyManager.ts`, `tests/unit/key-manager-dead-code-pruning-contract.test.ts`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, remote model fetch behavior, 12AI runtime URL resolution, localStorage policy changes, helper extraction, and exported API cleanup.

## Stage Two M54 keyManager Effective Provider Model Helper Split

- Added `src/services/auth/keyManagerEffectiveProviderModels.ts` for the pure effective provider model fallback path.
- Moved only `resolveEffectiveProviderModels` and its private official-default selector out of `src/services/auth/keyManager.ts`.
- `src/services/auth/keyManager.ts` now imports the helper for internal call sites and re-exports `resolveEffectiveProviderModels` for compatibility with existing imports from `keyManager.ts`.
- The helper preserves normalized saved model priority, official Google defaults, official OpenAI defaults only for `api.openai.com` or omitted base URL, and documented 12AI static fallback behavior.
- Updated `tests/unit/official-route-default-models.test.ts` so the default-route source guards follow the new helper boundary.
- Added `tests/unit/key-manager-effective-provider-models-contract.test.ts` and included it in `tsconfig.tests.json`.
- RED evidence: the first targeted run failed because `src/services/auth/keyManagerEffectiveProviderModels.ts` did not exist and `keyManager.ts` still owned `resolveEffectiveProviderModels`; after implementation, a too-broad no-monolith-import regex was narrowed because it incorrectly matched sibling helper imports.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-effective-provider-models-contract.test.ts tests/unit/official-route-default-models.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/api-settings-view-source-guard.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/key-manager-model-list-contract.test.ts` passed (27/27).
- Line counts for this slice: `src/services/auth/keyManager.ts` 4343 physical lines; `src/services/auth/keyManagerEffectiveProviderModels.ts` 54 lines; `tests/unit/key-manager-effective-provider-models-contract.test.ts` 69 lines; `tests/unit/official-route-default-models.test.ts` 59 lines; `tsconfig.tests.json` 106 lines.
- Browser QA: skipped because M54 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Architecture gate passed: `npm.cmd run architecture:check` passed with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Full validation passed for this slice: `npm.cmd run typecheck` with semantic checks for 77 test files; `npm.cmd run test:unit` (1252/1252); `npm.cmd run build`.
- Agent-doc and encoding validation passed: `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerEffectiveProviderModels.ts tests/unit/key-manager-effective-provider-models-contract.test.ts tests/unit/official-route-default-models.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerEffectiveProviderModels.ts`, `tests/unit/key-manager-effective-provider-models-contract.test.ts`, `tests/unit/official-route-default-models.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, remote model fetch behavior, 12AI runtime URL resolution, localStorage policy changes, and exported API cleanup beyond the compatibility facade.

## Stage Two M55 keyManager Provider Limit Delegator Pruning

- Removed the redundant private `resolveProviderBudgetLimit` and `resolveProviderTokenLimit` forwarding methods from `src/services/auth/keyManager.ts`.
- `src/services/auth/keyManager.ts` now calls the already extracted `resolveProviderBudgetLimit` and `resolveProviderTokenLimit` helpers directly for route materialization and provider availability checks.
- Updated `tests/unit/key-manager-provider-usage-contract.test.ts` so the provider usage contract prevents the private delegator wrappers from returning and verifies the direct helper call sites.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4338 physical lines; `tests/unit/key-manager-provider-usage-contract.test.ts` 103 lines.
- Browser QA: skipped because M55 is a non-UI private service wrapper cleanup with no component, CSS, route, or browser-visible workflow changes.
- Targeted GREEN validation passed before the full gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-usage-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts` passed (13/13).
- Full validation passed for this slice: `npm.cmd run architecture:check` with the existing allowlisted migration and legacy bridge exceptions; `npm.cmd run typecheck` with semantic checks for 77 test files; `npm.cmd run test:unit` (1252/1252); `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts tests/unit/key-manager-provider-usage-contract.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Active commit scope: `src/services/auth/keyManager.ts`, `tests/unit/key-manager-provider-usage-contract.test.ts`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, remote model fetch behavior, 12AI runtime URL resolution, localStorage policy changes, and exported API cleanup beyond the two private delegator wrappers.

## Final-Gate Fixture Repair

- Root cause found during full `npm.cmd run verify:changes`: `test:contract` and `test:e2e` still expected old implicit `InMemoryCreditAccountRepository` default balance `100`, while `56797310` intentionally hardened repository defaults to `0`.
- Fixed only test fixtures by constructing `InMemoryCreditAccountRepository(100)` in `tests/contract/api-server-contract.test.ts`, `tests/contract/payment-sidecar.contract.test.ts`, and `tests/e2e/release-smoke.test.ts`; production repository defaults remain `0`.
- Fixed `scripts/test/verify-startup-runtime-banner-centering.mjs` source-contract fallback to match the current `AuthenticatedAppShell` boundary: `showStartupRuntimeBanner = showStartupBanner && !isBackgroundReady` plus `{showStartupRuntimeBanner ? <StartupRuntimeBanner /> : null}`.
- RED evidence before fixes: `npm.cmd run test:contract` failed 3 assertions (`0 !== 100`, `30 !== 130`, `25 !== 125`); `npm.cmd run test:e2e` failed one assertion (`30 !== 130`); `npm.cmd run verify:startup-runtime-banner-centering` failed on the stale inline JSX regex.
- GREEN evidence after fixes: `npm.cmd run test:contract` passed (18/18); `npm.cmd run test:e2e` passed (1/1); `npm.cmd run verify:startup-runtime-banner-centering` passed in fallback mode.
- Full release-style validation passed: `npm.cmd run verify:changes` passed, including architecture, governance, typecheck, spec, build, unit/integration/contract/e2e tests, prompt-group drag smoke, mobile settings smoke, desktop settings smoke, startup-runtime banner smoke, and encoding.
- Browser QA limitation: all Playwright smoke scripts fell back because headless Chromium launch is blocked by local `spawn EPERM`; fallback route checks returned HTTP 200 and the startup banner source contract verified, but pixel-level visual inspection is still unavailable in this environment.
- Active commit scope: `tests/contract/api-server-contract.test.ts`, `tests/contract/payment-sidecar.contract.test.ts`, `tests/e2e/release-smoke.test.ts`, `scripts/test/verify-startup-runtime-banner-centering.mjs`, and `status.md`.
- Explicitly excluded scope: billing production logic, payment sidecar production logic, UI components, release metadata, architecture helper extraction, and broad code-quality cleanup.

## Completed In `4cdbf4cf` (Dependency Security Audit Fix)

- `npm.cmd audit --omit=dev --audit-level=moderate` initially reported one critical production vulnerability: `protobufjs <7.5.5` via `@google/genai@1.50.0`.
- Added a root `overrides.protobufjs = "7.5.5"` entry and refreshed `package-lock.json`.
- First `npm.cmd update protobufjs` attempt hit a Windows `EPERM` while cleaning locked `node_modules` paths and left no git-tracked change. The follow-up `npm.cmd install --ignore-scripts --no-audit` updated the local install without running install scripts.
- Verified local dependency state: `npm.cmd ls protobufjs` reports `protobufjs@7.5.5 overridden`.
- Passed dependency audit after the fix: `npm.cmd audit --omit=dev --audit-level=moderate` reported `found 0 vulnerabilities`.
- Passed after the dependency update: `npm.cmd run typecheck`, `npm.cmd run test:unit` (1129/1129), `npm.cmd run build`, `npm.cmd run governance:security`, and `npm.cmd run check:encoding`.

## Completed In `567f85aa` (Portable Release Metadata Refresh)

- Regenerated/published portable release metadata so the tracked stable manifest no longer reports the former portable metadata `buildTime` mismatch.
- The former `governance:version` blocker is cleared; `npm.cmd run governance:check` now passes in the latest full gate.
- Commit scope was release metadata only and stayed separate from runtime/security code.

## Completed In `0c5cadde` (Nutrient OCR Key Hardening)

- Browser settings no longer store or submit a Nutrient OCR API key.
- `/api/nutrient-document` now reads only server-side `NUTRIENT_API_KEY` / `NUTRIENT_DWS_API_KEY`; browser-supplied `apiKey` form data is ignored.
- Settings/workbench copy now describes the server-key boundary instead of showing an editable client key field.
- Targeted OCR/API validation passed: `tests/unit/ocr-service-settings-contract.test.ts`, `tests/unit/ecommerce-analysis-client-fallback.test.ts`, `tests/unit/api-settings-capability-routing-contract.test.ts`, and `tests/unit/portable-app-server-document-proxy-contract.test.ts`.
- UI browser QA note: direct in-app Browser QA for the OCR/settings surface was attempted but blocked by transient local server listener loss; fallback desktop/mobile settings smoke checks passed. This is not browser-complete evidence for future UI changes.

## Completed In `333f2551` (PostCSS Security Patch)

- Updated `postcss` to `8.5.13` and refreshed the lockfile.
- `npm.cmd audit --audit-level=moderate` and `npm.cmd audit --omit=dev --audit-level=moderate` both report zero vulnerabilities in the latest audit gate.

## Completed In `b6620ef2` (Dead AI12 Service Pruning)

- Deleted the unused `src/services/api/AI12APIService.ts` after import/reference proof showed the canonical service path no longer needs the dead shim.
- Strengthened pruning coverage in `tests/unit/legacy-compatibility-pruning.test.ts`; `tests/unit/service-barrel-pruning.test.ts` was rerun with the pruning gate.
- Commit scope was dead-code cleanup only and did not touch active provider routing behavior.

## Stage One M6 Closeout Scan

- Result: M6 can be marked complete. No clear ecommerce-owned business branch remains in `src/App.tsx` that should be extracted as another M6 runtime slice.
- Remaining ecommerce references are orchestration/state wiring: `handleGenerate` calls `handleEcommerceSubmitGuard`, `handleImageClick` calls `resetEcommerceSourceSelectionState`, and `handlePartialRedrawRequest` delegates ecommerce inheritance/finalization to `resolveEcommercePartialRedrawContext` / `finalizeEcommercePartialRedrawResult`.
- The `src/App.tsx` ecommerce state adapter block is hook state patch wiring, not an unextracted business runtime. It may become a future `useEcommerceRuntimeStateAdapters` cleanup, but it is not an M6 blocker.
- Deferred non-M6 quality debt: duplicate ecommerce framework child hide predicates, prompt-click empty-prompt policy cleanup, and ecommerce thinking-mode resolver relocation.
- Browser QA: skipped because the closeout scan and ledger correction do not change UI behavior or visual surfaces.

## Completed Stage One Backfill M1 (Connector Renderer Hardening)

- Exported `ConnectorRenderSnapshot`, `UseConnectorRendererDeps`, and `UseConnectorRendererResult` from `src/app/useConnectorRenderer.ts` so the hook boundary is explicit and reusable for later App split work.
- Added `tests/unit/canvas-connector-throttling-contract.test.ts` coverage that asserts exported connector boundary types and prevents `App.tsx` from reintroducing connector snapshot builder/commit/scheduler helpers.
- Review follow-up: the connector boundary test now imports `ConnectorRenderSnapshot`, `UseConnectorRendererDeps`, and `UseConnectorRendererResult` as public types, so `npm.cmd run typecheck` validates the exported boundary instead of relying only on source regex.
- Added the connector throttling contract test to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 32 test files.
- Line counts after this slice: `src/App.tsx` 4904, `src/app/useConnectorRenderer.ts` 253, `tests/unit/canvas-connector-throttling-contract.test.ts` 75, `tsconfig.tests.json` 61.
- Browser QA: skipped because this is a non-UI hook type-boundary hardening and existing connector rendering behavior was not changed.

## Completed Stage One Backfill M2 (Prompt Group Layout Boundary)

- Exported `PromptGroupBounds`, `UsePromptGroupLayoutDeps`, `UsePromptGroupLayoutResult`, `UsePromptGroupStackingDeps`, and `UsePromptGroupStackingResult` from `src/app/usePromptGroupLayout.ts`; no prompt-group behavior or rendering code changed.
- Strengthened `tests/unit/prompt-group-regroup-behavior.test.ts` with `import type` coverage for the prompt-group public boundary and source guards that prevent `App.tsx` from reintroducing prompt group layout ownership.
- Added the prompt-group regroup behavior test to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 33 test files.
- Line counts for this slice before commit: `src/App.tsx` 4904, `src/app/usePromptGroupLayout.ts` 1348, `tests/unit/prompt-group-regroup-behavior.test.ts` 546, `tsconfig.tests.json` 62.
- RED evidence from this slice: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-group-regroup-behavior.test.ts` failed before the hook boundary types were exported.
- Targeted GREEN validation already run during the slice: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-local-performance-trace-contract.test.ts` passed (52/52).
- Passed during the slice: `npm.cmd run typecheck`; test semantic check covers 33 files via `tsconfig.tests.json`.
- Passed during the slice: `npm.cmd run test:unit` (1115/1115).
- Passed during the slice: `npm.cmd run build`.
- Passed during the slice: `npm.cmd run governance:agent-docs`.
- Passed during the slice: `npm.cmd run check:encoding`.
- Passed during the slice: path-limited alternate-git `diff --check` for `src/app/usePromptGroupLayout.ts`, `tests/unit/prompt-group-regroup-behavior.test.ts`, `tsconfig.tests.json`, and ledger files with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI hook type-boundary hardening and no visual surface changed.

## Completed Stage One Backfill M3 (Generation Runtime Boundary)

- Audited `src/App.tsx` generation wiring and `src/app/useGenerationRuntime.ts`; generation-owned start, billing attempt coordination, cancellation, retry, failure state, result persistence, and retry batch transaction ownership remain inside `useGenerationRuntime`.
- Strengthened `tests/unit/generation-runtime-contract.test.ts` with `import type` coverage for `UseGenerationRuntimeDeps`, `UseGenerationRuntimeResult`, `PrepareInitialGenerationSubmissionContextResult`, `RetryGeneratedMediaResultContext`, and `CompleteRetryGeneratedMediaBatchParams`.
- Added the generation runtime contract test to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 34 test files.
- Line counts for this slice before commit: `src/App.tsx` 4904, `src/app/useGenerationRuntime.ts` 2604, `tests/unit/generation-runtime-contract.test.ts` 1683, `tsconfig.tests.json` 63.
- RED evidence from this slice: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts` failed because `tests/unit/generation-runtime-contract.test.ts` was not included in `tsconfig.tests.json`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts` passed (52/52).
- Passed during the slice: `npm.cmd run typecheck`; test semantic check covers 34 files via `tsconfig.tests.json`.
- Browser QA: skipped because this is a non-UI runtime/type-boundary hardening and no visual surface changed.

## Completed Stage One Backfill M3 Follow-Up (Generation Billing Boundary)

- Removed the stale `buildGenerationAttemptRequestId` import from `src/App.tsx` after generation billing attempt ownership moved into `useGenerationRuntime`.
- Removed unused `ensureCreditAttemptCharged`, `resolveFailedCreditAttempt`, and `applyOptimisticServerCreditDebit` destructures from the `useGenerationRuntime` result in `src/App.tsx`; App still injects billing service dependencies into the hook but no longer receives unused billing helper callbacks.
- Strengthened `tests/unit/generation-billing-runtime-contract.test.ts` with `import type` coverage for `EnsureCreditAttemptChargedParams`, `EnsureCreditAttemptChargedResult`, and `GenerationCreditAttemptNode`.
- Added `tests/unit/generation-billing-runtime-contract.test.ts` to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 35 test files.
- RED evidence from this follow-up: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-billing-runtime-contract.test.ts` failed while App still imported `generationBillingCoordinator`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts` passed (52/52).
- Browser QA: skipped because this is non-UI runtime cleanup and semantic test coverage; no visual surface changed.

## Completed Stage One Backfill M5 (PPT Runtime Boundary)

- Strengthened `tests/unit/ppt-runtime-contract.test.ts` with `import type` coverage for `UsePptRuntimeDeps`, `UsePptRuntimeResult`, `PptOutlineLineParts`, ordered PPT preview/node bundles, editable export bundle, deck editor state, stack preview state, and `PptRuntimeCanvasSnapshot`.
- Added `tests/unit/ppt-runtime-contract.test.ts`, `tests/unit/ppt-runtime-helper-contract.test.ts`, and `tests/unit/ppt-deck-single-container-contract.test.ts` to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 38 test files.
- Line counts for this slice before commit: `src/App.tsx` 4900, `src/app/usePptRuntime.ts` 1289, `src/app/pptRuntimeHelpers.ts` 152, `tests/unit/ppt-runtime-contract.test.ts` 269, `tsconfig.tests.json` 67.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ppt-runtime-contract.test.ts` failed because `tsconfig.tests.json` did not include `tests/unit/ppt-runtime-contract.test.ts`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ppt-runtime-contract.test.ts tests/unit/ppt-runtime-helper-contract.test.ts tests/unit/ppt-deck-single-container-contract.test.ts` passed (6/6).
- Full validation passed: `npm.cmd run typecheck` with semantic checks for 38 test files, `npm.cmd run test:unit` (1116/1116), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- tests/unit/ppt-runtime-contract.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only before ledger edits.
- Independent review by subagent `019de8f6-54b8-7d23-8bf0-6f9effd102f1` approved the slice with no findings; residual risk was limited to not rerunning the full suite inside the review subagent.
- Touched-file debt check found no `as any`, `@ts-ignore` / `@ts-expect-error`, or bare `console.log` in `tests/unit/ppt-runtime-contract.test.ts` or `tsconfig.tests.json`.
- Browser QA: skipped because this is a non-UI runtime/type-boundary and test configuration slice; no visual surface, CSS, or browser behavior changed.

## Completed Stage Two M1 (CanvasContext State Boundary)

- Extracted `CanvasState`, `CanvasContextType`, `CanvasContext`, `SubCardLayout`, `ArrangeMode`, `MAX_CANVASES`, `generateId`, `createCanvasWorkflow`, `DEFAULT_CANVAS`, and `DEFAULT_STATE` into `src/context/canvasContextState.ts`.
- Moved canvas workflow/ecommerce compatibility syncing into `src/context/canvasCompatibility.ts` so the state model module does not own migration behavior.
- `src/context/CanvasContext.tsx` now imports and re-exports the state/context boundary from `canvasContextState.ts`, imports compatibility syncing from `canvasCompatibility.ts`, preserves existing public type import paths, and removes inline state/context/default definitions.
- Added `tests/unit/canvas-context-state-boundary.test.ts` to guard that `CanvasContext.tsx` delegates state/default/context ownership, no `LegacyInlineCanvas*` or `LEGACY_INLINE_DEFAULT_*` residue remains, `clearAllData` resets via `DEFAULT_STATE`, and compatibility syncing does not live in the state module.
- Added the new boundary test to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 39 test files.
- Line counts for this slice before commit: `src/context/CanvasContext.tsx` 4606, `src/context/canvasContextState.ts` 114, `src/context/canvasCompatibility.ts` 8, `tests/unit/canvas-context-state-boundary.test.ts` 48, `tsconfig.tests.json` 68.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-state-boundary.test.ts` failed while `CanvasContext` still created the React context inline and again while `LegacyInlineCanvas` residue remained in `src/context/CanvasContext.tsx`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` passed (3/3).
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run typecheck`, `npm.cmd run test:unit` (1117/1117), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Path-limited diff check passed before final ledger edits: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasContextState.ts tests/unit/canvas-context-state-boundary.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI architecture/state-boundary split and no visual surface, CSS, or browser behavior changed.
- Independent review by subagent `019de9c3-294d-7653-8bb5-e8de23521fe9` flagged three boundary concerns. The P2 issues were fixed by moving the React context object into `canvasContextState.ts` and making `clearAllData` reset via `DEFAULT_STATE`; the P3 design concern was addressed by moving compatibility syncing to `canvasCompatibility.ts`.

## Completed Stage Two M2 (Canvas Selection Reducer)

- Added `src/context/canvasSelection.ts` for the pure `resolveCanvasSelectionIds` helper and `CanvasSelectionMode` type.
- `src/context/CanvasContext.tsx` now delegates `selectNodes` replace/add/remove/toggle semantics to `resolveCanvasSelectionIds`; provider orchestration and public context shape stay in `CanvasContext.tsx`.
- Added `tests/unit/canvas-selection-runtime-contract.test.ts` to guard source ownership, exported public type coverage, `tsconfig.tests.json` inclusion, and current selection behavior.
- Added the new selection contract test to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 40 test files.
- Selection behavior preserved: `replace` preserves incoming array order and duplicates; `add`, `remove`, and `toggle` retain prior Set-based ordering and duplicate collapse semantics.
- Line counts for this slice before commit: `src/context/CanvasContext.tsx` 5271 text lines in the working tree, `src/context/canvasSelection.ts` 35 text lines, `tests/unit/canvas-selection-runtime-contract.test.ts` 48 text lines, `tsconfig.tests.json` 69 physical lines.
- Targeted validation already passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-selection-runtime-contract.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts` passed (44/44).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 40 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions.
- Passed: `npm.cmd run test:unit` (1119/1119).
- Passed: `npm.cmd run build`.
- Independent review by subagent `019de9d3-cc3d-76c3-9378-3b4842f6aa0b` found no blocking issues. Residual note: the new contract test does not explicitly cover duplicate collapse from an already-duplicated current selection for add/remove/toggle, but the implementation matches the old Set-based reducer.
- Browser QA: skipped because this is a non-UI reducer extraction and no visual surface, CSS, or browser behavior changed.

## Completed Stage Two M3 (Prompt Child Image Resolver)

- Added `src/context/canvasPromptChildImages.ts` for the pure `resolvePromptChildImageIds` helper.
- `src/context/CanvasContext.tsx` now imports the helper and retains only provider orchestration plus existing recovery/persistence call sites.
- Added `tests/unit/canvas-prompt-child-images-runtime-contract.test.ts` to guard ownership transfer, strong prompt ownership ordering, duplicate and missing ID filtering, `sourceImageId` exclusion, and legacy fallback behavior.
- Added the new prompt-child-image resolver contract test to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 41 test files.
- Line counts for this slice before commit: `src/context/CanvasContext.tsx` 5218 text lines, `src/context/canvasPromptChildImages.ts` 55 text lines, `tests/unit/canvas-prompt-child-images-runtime-contract.test.ts` 93 text lines, `tsconfig.tests.json` 70 physical lines.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-child-images-runtime-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasPromptChildImages.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-child-images-runtime-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` passed (7/7).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 41 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions.
- Passed: `npm.cmd run test:unit` (1123/1123).
- Passed: `npm.cmd run build`.
- Passed final docs/encoding validation: `npm.cmd run governance:agent-docs` and `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasPromptChildImages.ts tests/unit/canvas-prompt-child-images-runtime-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Independent review by subagent `019de9e0-f398-77f0-b779-1eea29494009` found no blocking issues and confirmed behavior-preserving extraction.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, or browser behavior changed.

## Current Stage Two M4 (Workflow Source Node ID Resolver)

- Added `src/context/canvasWorkflowSourceNodeIds.ts` for the pure `getWorkflowSourceNodeIds` helper.
- `src/context/CanvasContext.tsx` now imports the helper while keeping workflow edge creation, edge pruning, mutation handlers, and utility-kind guards in place.
- Added `tests/unit/canvas-workflow-source-node-ids-contract.test.ts` to guard ownership transfer, utility-only behavior, malformed `sourceNodeIds` handling, first-seen string de-duping, blank/non-string filtering, and non-trimming return semantics.
- Added the new workflow-source-node-ID resolver contract test to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 42 test files.
- Line counts for this slice before commit: `src/context/CanvasContext.tsx` 5202 text lines, `src/context/canvasWorkflowSourceNodeIds.ts` 19 text lines, `tests/unit/canvas-workflow-source-node-ids-contract.test.ts` 67 text lines, `tsconfig.tests.json` 71 physical lines.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-source-node-ids-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasWorkflowSourceNodeIds.ts`.
- Debug note: after creating the helper, the focused test initially exposed a Node direct-test import resolution issue and an overly narrow test fixture type. Root cause was fixed by using the existing `.ts` import style in the helper dependency and allowing malformed fixture data in the test.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-source-node-ids-contract.test.ts tests/unit/canvas-prompt-child-images-runtime-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` passed (9/9).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 42 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions.
- Passed: `npm.cmd run test:unit` (1126/1126).
- Passed: `npm.cmd run build`.
- Passed final docs/encoding validation: `npm.cmd run governance:agent-docs` and `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasWorkflowSourceNodeIds.ts tests/unit/canvas-workflow-source-node-ids-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Independent review by subagent `019de9ec-2ca0-7323-820c-9fb6b1595865` found no blocking or non-blocking issues and confirmed the `.ts` helper import matches existing project usage.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, or browser behavior changed.

## Completed In `ccf965c3` (Ecommerce Source Selection Runtime)

- Added `src/app/useEcommerceSourceSelectionRuntime.ts` for the ecommerce state reset that runs when an image is selected as the next source.
- `src/App.tsx` now wires the source-selection hook through `resetEcommerceSourceSelectionState`; App no longer owns the inline image-source ecommerce reset block in `handleImageClick`.
- The hook receives dependencies through `UseEcommerceSourceSelectionRuntimeDeps`: the ecommerce ratio override setter and the shared active-focus state patch adapter for `activeTaskNodeId`, `activeTaskState`, `activeFrameworkId`, and `activeGroupSheet`.
- New contract coverage in `tests/unit/ecommerce-source-selection-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, App wiring, and the extracted reset behavior.

## Completed In `cc24e19d` (Ecommerce Runtime Activation)

- Added `src/app/useEcommerceModeRuntime.ts` for the ecommerce mode guard/reset effect that clears active task state and forces high thinking mode in ecommerce mode.
- Added `src/app/useEcommercePromptActivationRuntime.ts` for prompt-click ecommerce activation and framework summary resolution.
- `src/App.tsx` now wires the new mode and prompt-activation hooks alongside the existing submit hook; App no longer owns the mode guard/reset effect, the prompt activation state block in `handlePromptClick`, or the prompt-node framework status callback.
- The new hooks receive all dependencies through `UseEcommerceModeRuntimeDeps` and `UseEcommercePromptActivationRuntimeDeps`.
- New contract coverage in `tests/unit/ecommerce-mode-runtime-contract.test.ts` and `tests/unit/ecommerce-prompt-activation-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, App wiring, and the extracted ecommerce activation branches.

## Completed In `184b158c` (Ecommerce Task Activation Runtime)

- Added `src/app/useEcommerceTaskActivationRuntime.ts` for source-key ecommerce task activation lookup and fallback activation state restoration.
- `src/App.tsx` now wires the task activation hook through `updateEcommerceTaskActivationRuntimeState`; App no longer owns inline `handleActivateEcommerceTaskBySourceKey`.
- The hook receives all dependencies through `UseEcommerceTaskActivationRuntimeDeps`: active canvas ref, ecommerce task-state map, task activation state adapter, and prompt activation callback.
- New contract coverage in `tests/unit/ecommerce-task-activation-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, App wiring, PromptBar activation callback threading, source-row matching, and fallback active-task/group-sheet restoration.
- `tsconfig.tests.json` now semantically checks 26 test files.
- Line counts after extraction: `src/App.tsx` 4931 physical lines; `src/app/useEcommerceTaskActivationRuntime.ts` 62 physical lines; `tests/unit/ecommerce-task-activation-runtime-contract.test.ts` 33 physical lines; `tsconfig.tests.json` 55 physical lines.
- Working-tree note: this slice was already present as an uncommitted hook/test pair when I picked up the next step, so there is no separate RED reproduction in this turn; the first local targeted run passed and the slice was reviewed from the current working tree forward.
- Targeted validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-task-activation-runtime-contract.test.ts tests/unit/ecommerce-mobile-continuation-runtime-contract.test.ts tests/unit/ecommerce-runtime-contract.test.ts` passed (3/3).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 26 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1102/1102).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommerceTaskActivationRuntime.ts tests/unit/ecommerce-task-activation-runtime-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped for this slice because it is non-UI runtime activation glue that preserves existing PromptBar/mobile component contracts. The Clay UI lane browser evidence remains recorded below.
- Commit include scope for this runtime slice: `status.md`, `plans.md`, `implement.md`, `validation.md`, `tsconfig.tests.json`, `src/App.tsx`, `src/app/useEcommerceTaskActivationRuntime.ts`, and `tests/unit/ecommerce-task-activation-runtime-contract.test.ts`.
- Explicitly excluded scope: Clay UI docs/styles/components, PPT/generation runtime files, and unrelated ecommerce runtime slices not touched by the task activation extraction.

## Completed In `782d30d3` (Ecommerce Mobile Continuation Runtime)

- Added `src/app/useEcommerceMobileContinuationRuntime.ts` for mobile ecommerce prompt-node lookup, task editing activation, mobile selection toggles, desktop confirmation forwarding, and mobile generation queue fallback handlers.
- `src/App.tsx` now wires the mobile continuation hook through existing node-generation, scheduler, and workspace handlers; App no longer owns inline `resolveMobileResultPromptNode`, `handleMobileEditEcommerceTask`, `handleMobileToggleEcommerceSelected`, `handleMobileConfirmEcommerceDesktop`, or `handleMobileGenerateEcommerceMobile`.
- The hook receives all dependencies through `UseEcommerceMobileContinuationRuntimeDeps`: active canvas ref, active sheet, workspace focus, mobile screen setter, prompt activation callback, selection toggle handler, desktop confirmation handler, mobile retry handler, framework queue enqueue/pump handlers, and framework view sync.
- New contract coverage in `tests/unit/ecommerce-mobile-continuation-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, App wiring, removal of inline App callbacks, queue fallback behavior, and mobile edit/confirm/generate forwarding. Existing mobile continuation surface tests continue to assert selector data and detail-screen action threading.
- `tsconfig.tests.json` now semantically checks 25 test files.
- Line counts after extraction: `src/App.tsx` 4931 physical lines; `src/app/useEcommerceMobileContinuationRuntime.ts` 146 physical lines; `tests/unit/ecommerce-mobile-continuation-runtime-contract.test.ts` 46 physical lines; `tests/unit/mobile-ecommerce-continuation-surface.test.ts` 171 physical lines; `tests/unit/mobile-feed-selectors.test.ts` 323 physical lines; `tsconfig.tests.json` 54 physical lines.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-mobile-continuation-runtime-contract.test.ts tests/unit/ecommerce-node-generation-runtime-contract.test.ts tests/unit/ecommerce-runtime-contract.test.ts` failed first because `src/app/useEcommerceMobileContinuationRuntime.ts` did not exist.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-mobile-continuation-runtime-contract.test.ts tests/unit/mobile-ecommerce-continuation-surface.test.ts tests/unit/ecommerce-node-generation-runtime-contract.test.ts tests/unit/ecommerce-runtime-contract.test.ts` passed (5/5).
- Active ecommerce mobile continuation gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-mobile-continuation-runtime-contract.test.ts tests/unit/mobile-ecommerce-continuation-surface.test.ts tests/unit/mobile-feed-selectors.test.ts tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-node-generation-runtime-contract.test.ts tests/unit/ecommerce-build-runtime-contract.test.ts` passed (13/13).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 25 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1101/1101).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommerceMobileContinuationRuntime.ts tests/unit/ecommerce-mobile-continuation-runtime-contract.test.ts tests/unit/mobile-ecommerce-continuation-surface.test.ts tests/unit/mobile-feed-selectors.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md`.

## Completed In `6dc8e391` (Ecommerce Node Generation Runtime)

- Added `src/app/useEcommerceNodeGenerationRuntime.ts` for ecommerce node state patching, prompt optimization execution, structured render-task generation, single-card generation, desktop confirmation, and mobile retry callbacks.
- `src/App.tsx` now wires the node generation hook through `updateEcommerceNodeGenerationRuntimeState`; App no longer owns inline `updateEcommerceNodeState`, `syncActiveEcommerceTask`, `runEcommerceNodeGeneration`, `handleGenerateEcommerceNode`, `handleConfirmEcommerceDesktop`, or `handleRetryEcommerceModule`.
- The hook receives all dependencies through `UseEcommerceNodeGenerationRuntimeDeps`: active canvas ref, active task draft state, state adapter, prompt optimization flag/prompt text, `updatePromptNode`, `handleRetryNode`, sizing policy resolver, generation settings resolver, and ecommerce thinking-mode resolver.
- New contract coverage in `tests/unit/ecommerce-node-generation-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, App wiring, removal of inline App callbacks, prompt optimizer/render-task ownership, desktop confirmation, and mobile retry routing. Existing build-runtime, scheduler-runtime, and structured-task source contracts were retargeted to the new hook boundary.
- `tsconfig.tests.json` now semantically checks 24 test files.
- Line counts after extraction: `src/App.tsx` 4987 physical lines; `src/app/useEcommerceNodeGenerationRuntime.ts` 295 physical lines; `tests/unit/ecommerce-node-generation-runtime-contract.test.ts` 53 physical lines; `tests/unit/ecommerce-build-runtime-contract.test.ts` 57 physical lines; `tests/unit/ecommerce-runtime-contract.test.ts` 72 physical lines; `tests/unit/ecommerce-structured-task-source-contract.test.ts` 72 physical lines; `tsconfig.tests.json` 53 physical lines.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-node-generation-runtime-contract.test.ts tests/unit/ecommerce-build-runtime-contract.test.ts tests/unit/ecommerce-runtime-contract.test.ts` failed before implementation because `App.tsx` did not call `useEcommerceNodeGenerationRuntime`.
- Targeted GREEN validation: the same command passed after implementation (4/4).

## Completed In `5acf9c27` (Ecommerce Post-Build Sync Runtime)

- Extracted ecommerce active task prompt/display synchronization and post-confirm built-card upload/reference rehydration into `src/app/useEcommercePostBuildSyncRuntime.ts`.
- `src/App.tsx` now wires the post-build sync hook through `updateEcommercePostBuildSyncState`; App no longer owns inline `findEcommerceAnalysisItemBySourceKey`, `buildRuntimeEcommerceAssetRoles`, the active task sync effect, or the post-confirm upload/reference sync effect.
- The broader post-build scope is intentional: both effects synchronize cards after build/selection state changes and share task-state update behavior. The temporary stricter built-card-only split is not present in the worktree.
- Upload-reference signatures and manual reference extraction remain injected from `useEcommerceUploadReferenceRuntime`; the post-build hook does not duplicate upload runtime identity logic.
- New contract coverage in `tests/unit/ecommerce-post-build-sync-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, helper migration, App wiring, and removal of the inline App effects. Existing build-runtime, upload-sync, display-label, and structured-task contracts were retargeted so build creation remains in `useEcommerceBuildRuntime` while post-build card rehydration and active-task display sync are asserted in `useEcommercePostBuildSyncRuntime`.
- The new contract test plus retargeted display-label and structured-task contracts are included in `tsconfig.tests.json`, so `npm.cmd run typecheck` now semantically checks 23 test files.
- Line counts after extraction: `src/App.tsx` 5159 physical lines; `src/app/useEcommercePostBuildSyncRuntime.ts` 299 physical lines; `tests/unit/ecommerce-post-build-sync-runtime-contract.test.ts` 34 physical lines; `tests/unit/ecommerce-runtime-upload-sync-contract.test.ts` 40 physical lines; `tests/unit/ecommerce-display-label-surface.test.ts` 27 physical lines; `tests/unit/ecommerce-structured-task-source-contract.test.ts` 71 physical lines; `tsconfig.tests.json` 52 physical lines.
- Targeted validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-display-label-surface.test.ts tests/unit/ecommerce-structured-task-source-contract.test.ts tests/unit/ecommerce-post-build-sync-runtime-contract.test.ts tests/unit/ecommerce-runtime-upload-sync-contract.test.ts` passed (4/4).
- Active ecommerce post-build gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-build-runtime-contract.test.ts tests/unit/ecommerce-post-build-sync-runtime-contract.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts tests/unit/ecommerce-runtime-upload-sync-contract.test.ts tests/unit/ecommerce-upload-references-contract.test.ts tests/unit/ecommerce-group-slot-integration.test.ts tests/unit/ecommerce-group-shell-contract.test.ts tests/unit/ecommerce-group-shell-app-contract.test.ts tests/unit/ecommerce-analysis-selection-contract.test.ts tests/unit/ecommerce-model-policy.test.ts tests/unit/ecommerce-task-services.test.ts tests/unit/ecommerce-runtime-contract.test.ts` passed (37/37).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 23 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1099/1099).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommerceNodeGenerationRuntime.ts tests/unit/ecommerce-node-generation-runtime-contract.test.ts tests/unit/ecommerce-build-runtime-contract.test.ts tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-structured-task-source-contract.test.ts tests/unit/generation-runtime-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommercePostBuildSyncRuntime.ts tests/unit/ecommerce-post-build-sync-runtime-contract.test.ts tests/unit/ecommerce-runtime-upload-sync-contract.test.ts tests/unit/ecommerce-build-runtime-contract.test.ts tests/unit/ecommerce-display-label-surface.test.ts tests/unit/ecommerce-structured-task-source-contract.test.ts tsconfig.tests.json plans.md implement.md status.md validation.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped for this slice because it is non-UI runtime synchronization glue. The Clay UI lane browser evidence remains recorded below.
- Commit include scope for this runtime slice: `status.md`, `plans.md`, `implement.md`, `validation.md`, `tsconfig.tests.json`, `src/App.tsx`, `src/app/useEcommercePostBuildSyncRuntime.ts`, `tests/unit/ecommerce-post-build-sync-runtime-contract.test.ts`, `tests/unit/ecommerce-runtime-upload-sync-contract.test.ts`, `tests/unit/ecommerce-build-runtime-contract.test.ts`, `tests/unit/ecommerce-display-label-surface.test.ts`, and `tests/unit/ecommerce-structured-task-source-contract.test.ts`.
- Explicitly excluded scope: Clay UI docs/styles/components, PPT/generation runtime files, and unrelated ecommerce runtime slices not touched by the post-build sync extraction.

## Completed In `d0a95f79` (Ecommerce Build Runtime)

- Extracted ecommerce analysis confirmation, framework/group/task node building, initial group slot creation, upload-reference caching for newly built cards, and framework runtime bootstrapping into `src/app/useEcommerceBuildRuntime.ts`.
- `src/App.tsx` now wires the build runtime through `updateEcommerceBuildRuntimeState`; App no longer owns inline `buildEcommerceFrameworkNode`, `buildEcommerceGroupNode`, `buildEcommercePromptNode`, or `handleConfirmEcommerceAnalysis`.
- Existing upload-sync and generation/scheduler runtime paths remain in `App.tsx` / `useEcommerceRuntime` for this slice; the build hook returns only `handleConfirmEcommerceAnalysis`.
- Subagent review confirmed the slice ownership boundary. Its P3 notification-control-flow concern was fixed by isolating success/failure notification delivery from build state transitions.
- New contract coverage in `tests/unit/ecommerce-build-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, current upload-reference caching, canvas group layout, group slot initialization, framework runtime initialization, success/failure notifications, App wiring, and separation from upload sync/generation runtime.
- Existing confirm-flow, group-shell, slot-integration, analysis-selection, and upload-sync source contracts were retargeted so build creation details are asserted in `src/app/useEcommerceBuildRuntime.ts`, while `src/App.tsx` remains responsible for wiring, upload-sync effects, and hidden-node rendering filters.
- The new contract test is included in `tsconfig.tests.json`.
- Line counts after extraction: `src/App.tsx` 5353 physical lines; `src/app/useEcommerceBuildRuntime.ts` 617 physical lines; `tests/unit/ecommerce-build-runtime-contract.test.ts` 51 physical lines; `tests/unit/ecommerce-confirm-build-flow.test.ts` 39 physical lines; `tests/unit/ecommerce-analysis-selection-contract.test.ts` 22 physical lines; `tests/unit/ecommerce-upload-references-contract.test.ts` 238 physical lines; `tsconfig.tests.json` 49 physical lines.
- Targeted validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-build-runtime-contract.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts` passed (4/4).
- Broadened ecommerce build/upload/group-shell validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-build-runtime-contract.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts tests/unit/ecommerce-runtime-upload-sync-contract.test.ts tests/unit/ecommerce-group-slot-integration.test.ts tests/unit/ecommerce-group-shell-contract.test.ts tests/unit/ecommerce-group-shell-app-contract.test.ts` passed (8/8) after retargeting stale App-inline assertions.
- Broadened active validation with analysis-selection/upload-reference/model/task/runtime contracts: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-build-runtime-contract.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts tests/unit/ecommerce-runtime-upload-sync-contract.test.ts tests/unit/ecommerce-group-slot-integration.test.ts tests/unit/ecommerce-group-shell-contract.test.ts tests/unit/ecommerce-group-shell-app-contract.test.ts tests/unit/ecommerce-analysis-selection-contract.test.ts tests/unit/ecommerce-upload-references-contract.test.ts tests/unit/ecommerce-model-policy.test.ts tests/unit/ecommerce-task-services.test.ts tests/unit/ecommerce-runtime-contract.test.ts` passed (36/36).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 20 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1098/1098).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommerceBuildRuntime.ts tests/unit/ecommerce-build-runtime-contract.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts tests/unit/ecommerce-runtime-upload-sync-contract.test.ts tests/unit/ecommerce-group-slot-integration.test.ts tests/unit/ecommerce-group-shell-contract.test.ts tests/unit/ecommerce-group-shell-app-contract.test.ts tests/unit/ecommerce-analysis-selection-contract.test.ts tests/unit/ecommerce-upload-references-contract.test.ts tsconfig.tests.json status.md plans.md implement.md validation.md` with LF/CRLF normalization warnings only.
- Passed staged diff check after path-limited staging: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --cached --check`.
- Browser QA: skipped for this slice because it is non-UI runtime build glue. The Clay UI lane browser evidence remains recorded below.
- Commit include scope for this runtime slice: `status.md`, `plans.md`, `implement.md`, `validation.md`, `tsconfig.tests.json`, `src/App.tsx`, `src/app/useEcommerceBuildRuntime.ts`, `tests/unit/ecommerce-build-runtime-contract.test.ts`, `tests/unit/ecommerce-confirm-build-flow.test.ts`, `tests/unit/ecommerce-runtime-upload-sync-contract.test.ts`, `tests/unit/ecommerce-group-slot-integration.test.ts`, `tests/unit/ecommerce-group-shell-contract.test.ts`, `tests/unit/ecommerce-group-shell-app-contract.test.ts`, `tests/unit/ecommerce-analysis-selection-contract.test.ts`, and `tests/unit/ecommerce-upload-references-contract.test.ts`.

## Completed In `017bb3a2` (Ecommerce Requirement Analysis Runtime)

- Extracted requirement-file pick, requirement clear, analysis reset, empty group slots, selected-item derivation, product-image AI enhancement data preparation, and requirement analysis execution into `src/app/useEcommerceRequirementAnalysisRuntime.ts`.
- `src/App.tsx` now wires the runtime through `updateEcommerceRequirementAnalysisState`; App no longer owns inline `createEcommerceAnalysisResetPatch`, `handlePickEcommerceRequirementFile`, `handleClearEcommerceRequirementFile`, `handleResetEcommerceAnalysis`, or `handleAnalyzeEcommerceRequirement`.
- `App.tsx` injects `analyzeEcommerceRequirementFile` through the hook's explicit dependency interface; App no longer owns the async analysis body or calls the analyzer directly inside inline handlers.
- The async analysis flow is executable through exported `runEcommerceRequirementAnalysis`, which keeps the hook thin and lets tests cover no-file warnings, analyzing/success/failure patches, AI enhancement data conversion, partial analyzer-result normalization, success notifications, and reference-preserving patch behavior.
- `handleGenerate` now includes `ecommerceState.analysis`, `handleAnalyzeEcommerceRequirement`, and `handleConfirmEcommerceAnalysis` in its dependency array so ecommerce submit does not keep stale no-file or stale-confirm closures.
- New contract coverage in `tests/unit/ecommerce-requirement-analysis-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, analysis reset and clear patch behavior, empty group slots, analysis counts, default selected items for main/A+ rows, product image data extraction, success and failure patch behavior, no-file warning, AI enhancement success, AI enhancement failure fallback, partial analyzer-result defaults, and ecommerce submit callback dependencies. Existing analysis button and upload removal source contracts were retargeted to hook ownership.
- The new contract test plus the retargeted ecommerce analysis-button and upload-removal tests are included in `tsconfig.tests.json`, so `npm.cmd run typecheck` now semantically checks 17 test files.
- Line counts after extraction: `src/App.tsx` 5760 physical lines; `src/app/useEcommerceRequirementAnalysisRuntime.ts` 317 physical lines; `tests/unit/ecommerce-requirement-analysis-runtime-contract.test.ts` 455 physical lines.
- Subagent review: source audit identified stale ecommerce submit dependencies, analyzer ownership drift, a P1 optional-collection dereference in the success notification, and P2 gaps for clear/AI fallback behavior coverage. The submit dependencies were fixed, analyzer execution is dependency-injected through the hook interface, partial analysis results are normalized inside the hook, and the runtime contract now executes clear, success, failure, AI fallback, and partial-result paths.
- Browser QA: skipped for this slice because it is non-UI runtime analysis glue. The Clay UI lane browser evidence remains recorded below.
- Commit include scope for this runtime slice: `status.md`, `plans.md`, `implement.md`, `validation.md`, `tsconfig.tests.json`, `src/App.tsx`, `src/app/useEcommerceRequirementAnalysisRuntime.ts`, `tests/unit/ecommerce-requirement-analysis-runtime-contract.test.ts`, `tests/unit/ecommerce-analysis-button-gate.test.ts`, and `tests/unit/ecommerce-upload-removal-contract.test.ts`.

## Completed In `bd265ec9` (Ecommerce Task State Runtime)

- Extracted initial ecommerce task-state building and task edit synchronization into `src/app/useEcommerceTaskStateRuntime.ts`.
- `src/App.tsx` now wires `useEcommerceTaskStateRuntime` through the narrow `updateEcommerceTaskStateRuntimeState` adapter; App no longer owns the inline `buildInitialEcommerceTaskStates` or `handleChangeEcommerceTaskState` callbacks.
- New contract coverage in `tests/unit/ecommerce-task-state-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, source-row keyed initial state, effective sizing application, stored task updates by row key or task id, active draft updates by task id, and no-op behavior when nothing matches.
- The new contract test is included in `tsconfig.tests.json`, so `npm.cmd run typecheck` now semantically checks 14 test files instead of 13.
- Line counts after extraction: `src/App.tsx` 5843 physical lines; `src/app/useEcommerceTaskStateRuntime.ts` 124 physical lines; `tests/unit/ecommerce-task-state-runtime-contract.test.ts` 232 physical lines.
- Subagent review: spec compliance review passed with no findings. Code-quality review found no runtime blockers; its P2 staging warning is addressed by including the new hook/test in the same commit, and its P3 test-typecheck warning was fixed by adding the test to `tsconfig.tests.json`.
- Browser QA: skipped for this slice because it is non-UI runtime task-state glue. The Clay UI lane browser evidence remains recorded below.
- Commit include scope for this runtime slice: `status.md`, `plans.md`, `implement.md`, `validation.md`, `tsconfig.tests.json`, `src/App.tsx`, `src/app/useEcommerceTaskStateRuntime.ts`, and `tests/unit/ecommerce-task-state-runtime-contract.test.ts`.

## Completed In `9cb4d2c4` (Ecommerce Sheet Settings Runtime)

- Extracted ecommerce sheet defaults, A+ control mode resolution, effective task sizing, node generation settings, and sheet-setting updates into `src/app/useEcommerceSheetSettingsRuntime.ts`.
- `src/App.tsx` now wires the hook through `useEcommerceSheetSettingsRuntime` and adapts `setEcommerceState` through `updateEcommerceSheetSettingsState`, keeping App as orchestration and prop wiring.
- Existing prompt bar ecommerce footer contract was retargeted so sheet settings defaults and A+ 4K enforcement are owned by the hook instead of inline App helpers.
- New contract coverage in `tests/unit/ecommerce-sheet-settings-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, default sheet settings, A+ sizing policy behavior, and desktop/mobile generation target resolution. Existing prompt-bar and prompt-optimizer source contracts were retargeted away from removed inline App helpers.
- Line counts after extraction: `src/App.tsx` 5877 physical lines; `src/app/useEcommerceSheetSettingsRuntime.ts` 351 physical lines; `tests/unit/ecommerce-sheet-settings-runtime-contract.test.ts` 168 physical lines.
- Review note: `App.tsx` still imports the hook file's exported `createDefaultEcommerceSheetSettings` helper for initial state and node-build fallbacks because those paths run before or outside the hook invocation. The inline App implementations were removed; strict helper-call removal is deferred until a broader ecommerce analysis/node-build runtime boundary owns those call sites.
- Browser QA: skipped for this slice because it is non-UI runtime sheet-setting glue. The Clay UI lane browser evidence remains recorded below.
- Commit include scope for this runtime slice: `status.md`, `plans.md`, `implement.md`, `validation.md`, `src/App.tsx`, `src/app/useEcommerceSheetSettingsRuntime.ts`, `tests/unit/ecommerce-sheet-settings-runtime-contract.test.ts`, `tests/unit/prompt-bar-ecommerce-footer-controls.test.ts`, and `tests/unit/prompt-optimizer-service-source-contract.test.ts`.
- Explicitly excluded dirty UI paths: none in the writable metadata after `9e7ae2b5`; if plain `.git` still reports UI files, those belong to the metadata mismatch and must not be staged through plain `.git`.

## Completed In `ec434f94` (Paused Runtime/Ecommerce Lane)

- Ecommerce framework runtime state/view helpers route through `src/app/useEcommerceFrameworkRuntimeState.ts`.
- Extracted state/view boundary: `ecommerceFrameworkRuntimeRef`, `resolveEcommerceFrameworkId`, `updateEcommerceFrameworkRuntime`, `syncEcommerceFrameworkView`, and `handleActivateEcommerceGroupSheet`.
- `src/app/useEcommerceRuntime.ts` now consumes a single `frameworkStateView` boundary object instead of individual App inline deps for framework runtime state/view.
- Contract hardening: `tests/unit/ecommerce-framework-runtime-state-contract.test.ts` covers hook existence, explicit deps/result interfaces, App ordering, runtime-before-state ordering, sync-before-meta ordering, and the preserved `GenerationMode.ECOMMERCE` framework filter. `tests/unit/ecommerce-framework-runtime-order.test.ts` now targets the extracted hook.
- RED evidence: framework state/view contract tests failed before the hook existed and before `useEcommerceRuntime` consumed `frameworkStateView`; the ecommerce-mode filter assertion failed before restoring the original guard.
- Line counts after extraction: `src/App.tsx` 6484 lines; `src/app/useEcommerceFrameworkRuntimeState.ts` 240 lines; `src/app/useEcommerceRuntime.ts` 385 lines.
- Subagent review: spec and code-quality reviewers found the extracted boundary shape correct. A P2 mode-filter regression was fixed before commit; a P3 order-test gap was tightened before final validation.
- Browser QA was skipped for this slice because it was non-UI runtime state/view glue. This current UI thread owns the required browser evidence for Clay surfaces.
- The runtime/ecommerce lane is paused again and must stay out of the UI commit.

## Completed In `cf34f12b` (Ecommerce Upload Reference Runtime)

- Extracted upload/reference binding runtime into `src/app/useEcommerceUploadReferenceRuntime.ts`.
- New hook owns upload/reference identity helpers, `ReferenceImage` construction from uploads/assets, reference signatures, product image ref derivation, manual reference lookup, and product/extra/item pick/remove handlers.
- `src/App.tsx` now wires hook results through `useEcommerceUploadReferenceRuntime`, while requirement file handlers, confirm flow, and the built-card upload sync effect remain in `App.tsx`.
- Behavior preserved: image-only upload filtering, append-with-cap for product/extra/item references (`4/4/6`), file identity format `labelPrefix-sanitizedName-size-lastModified`, base64 payload extraction, full data URL retention, first-product-only `productImageRef`, and manual binding lookup by `taskStateSeed.sourceRowKey`.
- Review follow-up completed: `extractEcommerceManualReferenceBindings` now depends only on `itemReferenceFiles`, and no-op removal handlers return `null` instead of widening state churn. Empty per-item manual reference buckets are removed after the final item is deleted.
- Contract hardening: `tests/unit/ecommerce-upload-references-contract.test.ts` covers hook ownership, exported deps/result interfaces, helper behavior, no-op removal guards, and empty bucket cleanup. Existing upload removal and built-card sync contracts were retargeted from App inline ownership to hook ownership.
- Line counts after extraction: `src/App.tsx` 5644 lines; `src/app/useEcommerceUploadReferenceRuntime.ts` 299 lines; `tests/unit/ecommerce-upload-references-contract.test.ts` 214 lines.
- Browser QA: skipped for this slice because it is non-UI runtime upload/reference glue. The active Clay UI lane owns browser evidence for Clay surfaces.
- Commit include scope was `status.md`, `src/App.tsx`, `src/app/useEcommerceUploadReferenceRuntime.ts`, `tests/unit/ecommerce-upload-references-contract.test.ts`, `tests/unit/ecommerce-upload-removal-contract.test.ts`, and `tests/unit/ecommerce-runtime-upload-sync-contract.test.ts`.

## Completed In `9b0f7dd3` (Ecommerce Group Export Runtime)

- Extracted ecommerce group export and slot-result synchronization into `src/app/useEcommerceGroupExportRuntime.ts`.
- New hook owns `sanitizeEcommerceExportName`, latest slot image resolution, group slot sync via `applyEcommerceSlotResult`, manifest construction via `buildEcommerceGroupExportManifest`, zip packaging, dynamic file-saver invocation, no-export warning, fallback-quality warning, and success notification.
- `src/App.tsx` now injects `activeCanvas`, `activeCanvasRef`, `ecommerceState`, `setEcommerceGroupExportState`, and `resolvePptImageBlob`, then only wires `handleExportEcommerceGroup` into prompt node props.
- Behavior preserved: default latest-image lookup still considers all delivery kinds when no `deliveryKind` is provided; `desktop-then-mobile` still records independent desktop/mobile deliverables; no generated deliverables still warn instead of exporting an empty zip; file-name sanitization preserves the previous replacement behavior.
- Hardening completed: file-saver is now dynamically imported through a CJS/ESM-compatible adapter for direct Node contract imports; `buildNextEcommerceGroupSlots` normalizes missing slot arrays, selected item maps, and delivery arrays before iterating.
- Contract updates: `tests/unit/ecommerce-group-export-runtime-contract.test.ts` covers hook ownership and pure helper behavior. Existing export entry, slot integration, ecommerce canvas, and no-export guard tests were retargeted from App inline ownership to hook ownership.
- Line counts after extraction: `src/App.tsx` 6062 lines; `src/app/useEcommerceGroupExportRuntime.ts` 365 lines; `tests/unit/ecommerce-group-export-runtime-contract.test.ts` 182 lines.
- Subagent review: governance review confirmed this slice should stay path-limited and avoid UI lane files. Code-quality review found no P1/P2 blockers, noted the default delivery semantics and runtime nullish hardening, and left a P3 follow-up to upgrade the no-export guard from source regex to behavior-level coverage later. The default behavior was kept as historical behavior, and the nullish hardening was applied.
- Browser QA: skipped for this slice because it is non-UI runtime export glue. The active Clay UI lane owns browser evidence for visual surfaces.
- Commit include scope for this runtime slice: `status.md`, `src/App.tsx`, `src/app/useEcommerceGroupExportRuntime.ts`, `tests/unit/ecommerce-group-export-runtime-contract.test.ts`, `tests/unit/ecommerce-group-export-entry.test.ts`, `tests/unit/ecommerce-group-slot-integration.test.ts`, `tests/unit/ecommerce-canvas-contract.test.ts`, and `tests/unit/ecommerce-export-button-guards.test.ts`.
- Explicitly excluded dirty UI paths: `plans.md`, `implement.md`, `validation.md`, `.agent/rules/skills/SKILL.md`, `src/app/AppDesktopChrome.tsx`, `src/components/**`, `src/index.css`, `src/main.tsx`, `src/workflow/nodes/WorkflowUtilityCard.tsx`, and Clay/theme UI tests.

## Completed In `be63eda2`

- Ecommerce selection actions now route through `src/app/useEcommerceRuntime.ts`, with pure state helpers in `src/app/ecommerceSelectionRuntime.ts`.
- Extracted actions: `handleToggleEcommerceAnalysisSelection`, `handleToggleEcommerceSelected`, and `handleSetEcommerceGroupSelection`.
- Contract hardening: `tests/unit/ecommerce-runtime-contract.test.ts` asserts selection handler ownership and App wiring; `tests/unit/ecommerce-runtime-selection.test.ts` verifies selected item and group slot synchronization.
- RED evidence: selection ownership and pure helper tests failed before hook/helper implementation; they passed after extraction and the narrowed `updateEcommerceSelectionState` dependency.
- Line counts after extraction: `src/App.tsx` 6658 lines; `src/app/useEcommerceRuntime.ts` 390 lines; `src/app/ecommerceSelectionRuntime.ts` 101 lines; `tests/unit/ecommerce-runtime-selection.test.ts` 119 lines.
- Validation passed before commit: targeted ecommerce selection tests (11/11), `npm.cmd run typecheck`, `npm.cmd run test:unit` (1066/1066), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and targeted `git diff --check`.

## Completed In `294b0d3e`

- `src/app/useEcommerceRuntime.ts` owns the ecommerce framework scheduler actions previously inline in `src/App.tsx`.
- Extracted actions: `resolveEcommerceFrameworkQueuePhases`, `enqueueEcommerceFrameworkNodes`, `pumpEcommerceFrameworkQueue`, `handleGenerateEcommerceFramework`, `handlePauseEcommerceFramework`, `handleResumeEcommerceFramework`, `handleCancelEcommerceFrameworkNodeQueue`, and `handleGenerateEcommerceGroup`.
- Contract hardening: `tests/unit/ecommerce-runtime-contract.test.ts` asserts hook ownership, explicit deps/result interfaces, and App wiring; `tests/unit/ecommerce-button-guards.test.ts` follows the no-eligible-card warning contract from the hook.
- Line counts after extraction: `src/App.tsx` 6716 lines; `src/app/useEcommerceRuntime.ts` 341 lines; `tests/unit/ecommerce-runtime-contract.test.ts` 44 lines.
- Validation passed before commit: targeted ecommerce framework tests (10/10), `npm.cmd run typecheck`, `npm.cmd run test:unit` (1065/1065), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and targeted `git diff --check`.

## Completed In `92abdacf`

- Hardened PPT runtime export ordering so `handleExportPptx`, `handleExportPptPackage`, and `handleExportPptSinglePage` route through `getOrderedPptNodeBundle`.
- Updated `tests/unit/ppt-runtime-contract.test.ts` to reject direct `getPromptPptImageNodes` usage in `src/app/usePptRuntime.ts`.
- Validation passed before commit: targeted PPT/runtime contracts, `npm.cmd run typecheck`, `npm.cmd run test:unit` (1064/1064), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and `git diff --check` with CRLF normalization warnings only.

## Completed In `4c448660`

### Clay UI

- Clay design and rule docs were reconciled with `DESIGN-clay.md` and the user override for controlled frosted material.
- Shared tokens were added for neutral dark surfaces and frosted inputs, main cards, sub cards, and framework cards.
- Dark mode now targets neutral black-gray surfaces: `#0b0b0c`, `#141414`, and `#1f1f1f`.
- Major UI surfaces were moved onto the shared material system: search palette, sidebar, prompt/composer inputs, mobile shell, settings, storage modal, ecommerce panels, and canvas/image cards.
- Contract coverage includes controlled frosted tokens, neutral dark aliases, legacy blue-black token regressions, ecommerce frosted surfaces, mobile workspace surfaces, and theme contrast.

### Runtime / PPT Boundary Work

- `src/App.tsx` was reduced to 6210 lines in the committed baseline.
- `src/app/useGenerationRuntime.ts` owns generation runtime orchestration and related retry/billing contracts.
- `src/app/usePptRuntime.ts` owns PPT runtime orchestration.
- `src/app/pptRuntimeHelpers.ts` centralizes PPT image ordering, stale child fallback, parent prompt rejection, deck child detection, and nullish image array guards.
- PPT and generation runtime contracts were expanded in the same committed baseline.

## Latest Recorded Validation

Fresh validation for the latest finalization/security cleanup line through `b6620ef2`:

- Passed targeted OCR/API gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ocr-service-settings-contract.test.ts tests/unit/ecommerce-analysis-client-fallback.test.ts tests/unit/api-settings-capability-routing-contract.test.ts tests/unit/portable-app-server-document-proxy-contract.test.ts`.
- Passed dead-code pruning gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/legacy-compatibility-pruning.test.ts tests/unit/service-barrel-pruning.test.ts`.
- Passed settings smoke fallback checks: `npm.cmd run verify:desktop-settings-smoke` and `npm.cmd run verify:mobile-settings-smoke` in fallback mode with route checks returning 200. Direct in-app Browser QA was attempted but blocked by the local server listener disappearing after the server printed ready.
- Passed full gates: `npm.cmd run architecture:check`, `npm.cmd run governance:check`, `npm.cmd run spec:check`, `npm.cmd audit --audit-level=moderate`, `npm.cmd audit --omit=dev --audit-level=moderate`, `npm.cmd run typecheck`, `npm.cmd run test:unit` (1131/1131), `npm.cmd run build`, `npm.cmd run check:encoding`, and `npm.cmd run governance:agent-docs`.
- Passed path-limited alternate-git diff checks for touched code/security/release files with only LF/CRLF normalization warnings.

Fresh validation for the ledger review follow-up:

- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.

Fresh validation for Stage Two M18 Canvas workflow update helper extraction:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-updates-contract.test.ts` failed first with 4/4 failures before the helper existed and before `CanvasContext.tsx` delegated to it.
- Passed standalone workflow updates contract after extraction: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-updates-contract.test.ts` (4/4).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-updates-contract.test.ts tests/unit/canvas-workflow-source-node-ids-contract.test.ts tests/unit/workflow-document-domain.test.ts tests/unit/canvas-cleanup-contract.test.ts` (12/12).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 56 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1190/1190).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasWorkflowUpdates.ts tests/unit/canvas-workflow-updates-contract.test.ts tests/unit/canvas-workflow-source-node-ids-contract.test.ts src/workflow/adapters/canvasToWorkflow.ts src/workflow/persistence/workflowSerializer.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.

Fresh validation for Stage Two M19 Canvas image delete helper extraction:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-image-links-contract.test.ts` failed first with 2 failures before `deleteCanvasImageNode` existed and before `CanvasContext.tsx` delegated to it.
- Passed standalone prompt-image links contract after extraction: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-image-links-contract.test.ts` (5/5).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-image-links-contract.test.ts tests/unit/canvas-workflow-updates-contract.test.ts tests/unit/canvas-cleanup-contract.test.ts` (12/12).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 56 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1191/1191).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasPromptImageLinks.ts tests/unit/canvas-prompt-image-links-contract.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.

Fresh validation for Stage Two M20 Canvas merge-into helper extraction:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-merge-into-contract.test.ts` failed first with 4/4 failures before the helper existed and before `CanvasContext.tsx` delegated to it.
- Passed standalone merge-into contract after extraction: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-merge-into-contract.test.ts` (4/4).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-merge-into-contract.test.ts tests/unit/canvas-merge-contract.test.ts tests/unit/canvas-cleanup-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts` (12/12).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 57 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1195/1195).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasMergeInto.ts tests/unit/canvas-merge-into-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.

Fresh validation for Stage Two M21 Canvas unused-code cleanup:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts` failed first before the unused imports/constants/writes were removed.
- Passed standalone cleanup contract after removal: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts` (1/1).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts tests/unit/canvas-merge-into-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts` (6/6).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 58 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1196/1196).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx tests/unit/canvas-context-unused-cleanup.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.

Fresh validation for Stage Two M6 prompt recovery extraction:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-recovery-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasPromptRecovery.ts`.
- Passed standalone prompt recovery contract after behavior coverage: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-recovery-contract.test.ts` (5/5).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-recovery-contract.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` (8/8).
- Passed: `npm.cmd run architecture:check` with the existing allowlisted migration and legacy bridge exceptions.
- Passed: `npm.cmd run typecheck`; test semantic check covers 44 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1136/1136).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasPromptRecovery.ts tests/unit/canvas-prompt-recovery-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Spec review by subagent `019dec5d-7052-7f73-b08d-68b5ec64f2fc` found no findings and confirmed async hydration/persisted-result recovery remained in `CanvasContext.tsx`.
- Re-review by subagents `019dec5d-7052-7f73-b08d-68b5ec64f2fc` and `019dec5d-b17d-7102-8ebf-18d6fa2fbf15` found no Critical or Important code findings after behavior coverage; the remaining action is explicit staging of the new helper and contract test.

Fresh validation for Stage Two M7 persisted image recovery extraction:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-persisted-image-recovery-contract.test.ts` failed first before the helper existed and before `CanvasContext.tsx` imported it.
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-persisted-image-recovery-contract.test.ts tests/unit/canvas-persisted-image-hydration-guard.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` (8/8).
- Passed: `npm.cmd run architecture:check` with the existing allowlisted migration and legacy bridge exceptions.
- Passed: `npm.cmd run typecheck`; test semantic check covers 45 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1140/1140).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasPersistedImageRecovery.ts tests/unit/canvas-persisted-image-recovery-contract.test.ts tests/unit/canvas-persisted-image-hydration-guard.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI context/helper extraction and no visual surface, CSS, route, or browser behavior changed.
- Spec review by subagent `019dec5d-7052-7f73-b08d-68b5ec64f2fc` found no findings. Code-quality review by subagent `019dec5d-b17d-7102-8ebf-18d6fa2fbf15` found no Critical issues; its coverage suggestion for URL resolution was addressed by executable tests, and its untracked-file warning was resolved by explicit path-based staging.

Fresh validation for Stage Two M2 Canvas selection reducer:

- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-selection-runtime-contract.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts` (44/44).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 40 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run architecture:check` with the existing allowlisted migration and legacy bridge exceptions.
- Passed: `npm.cmd run test:unit` (1119/1119).
- Passed: `npm.cmd run build`.
- Passed final docs/encoding validation: `npm.cmd run governance:agent-docs` and `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasSelection.ts tests/unit/canvas-selection-runtime-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.

Fresh validation for Stage Two M3 prompt child image resolver:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-child-images-runtime-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasPromptChildImages.ts`.
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-child-images-runtime-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` (7/7).
- Passed: `npm.cmd run architecture:check` with the existing allowlisted migration and legacy bridge exceptions.
- Passed: `npm.cmd run typecheck`; test semantic check now covers 41 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1123/1123).
- Passed: `npm.cmd run build`.
- Passed final docs/encoding validation: `npm.cmd run governance:agent-docs` and `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasPromptChildImages.ts tests/unit/canvas-prompt-child-images-runtime-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.

Fresh validation for Stage Two M4 workflow source node ID resolver:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-source-node-ids-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasWorkflowSourceNodeIds.ts`.
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-source-node-ids-contract.test.ts tests/unit/canvas-prompt-child-images-runtime-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` (9/9).
- Passed: `npm.cmd run architecture:check` with the existing allowlisted migration and legacy bridge exceptions.
- Passed: `npm.cmd run typecheck`; test semantic check now covers 42 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1126/1126).
- Passed: `npm.cmd run build`.
- Passed final docs/encoding validation: `npm.cmd run governance:agent-docs` and `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasWorkflowSourceNodeIds.ts tests/unit/canvas-workflow-source-node-ids-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.

Fresh validation for Stage Two M1 CanvasContext state boundary:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-state-boundary.test.ts` failed while `src/context/CanvasContext.tsx` still contained `LegacyInlineCanvas` residue, and failed again after review hardening while the React context object still lived inline.
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` (3/3).
- Passed: `npm.cmd run architecture:check` with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Passed: `npm.cmd run typecheck`; test semantic check now covers 39 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1117/1117).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check before final ledger edits: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasContextState.ts src/context/canvasCompatibility.ts tests/unit/canvas-context-state-boundary.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only.

Fresh validation for Stage One Backfill M5 PPT runtime boundary:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ppt-runtime-contract.test.ts` failed because `tests/unit/ppt-runtime-contract.test.ts` was not included in `tsconfig.tests.json`.
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ppt-runtime-contract.test.ts tests/unit/ppt-runtime-helper-contract.test.ts tests/unit/ppt-deck-single-container-contract.test.ts` (6/6).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 38 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1116/1116).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check before ledger edits: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- tests/unit/ppt-runtime-contract.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only.
- Passed final ledger validation after ledger edits: `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- tests/unit/ppt-runtime-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.

Fresh validation for Stage One Backfill M1 connector renderer hardening:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-connector-throttling-contract.test.ts` failed because `ConnectorRenderSnapshot`, `UseConnectorRendererDeps`, and `UseConnectorRendererResult` were not exported.
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-connector-throttling-contract.test.ts tests/unit/canvas-local-performance-trace-contract.test.ts tests/unit/canvas-live-scene-contract.test.ts` (14/14).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 32 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1114/1114).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/app/useConnectorRenderer.ts tests/unit/canvas-connector-throttling-contract.test.ts tsconfig.tests.json status.md` with LF/CRLF normalization warnings only.

Fresh validation for the completed ecommerce partial redraw runtime pass in `d12731ce`:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-partial-redraw-runtime-contract.test.ts tests/unit/ecommerce-structured-task-source-contract.test.ts tests/unit/partial-redraw-pipeline-contract.test.ts tests/unit/mobile-result-feed-app-contract.test.ts` (6/6).
- Passed: `npm.cmd run typecheck`; test semantic check covered 31 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1113/1113).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommercePartialRedrawRuntime.ts tests/unit/ecommerce-partial-redraw-runtime-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Additional recorded health gates after `d12731ce`: `npm.cmd run architecture:check` passed, `npm.cmd run spec:check` passed, and `npm.cmd run governance:check` had a portable metadata `governance:version` mismatch at that point; the mismatch was later cleared in `567f85aa`.

Fresh validation for the current ledger-only correction:

- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- plans.md implement.md status.md validation.md` with LF/CRLF normalization warnings only.

Historical validation for `017bb3a2` ecommerce requirement analysis runtime pass:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-requirement-analysis-runtime-contract.test.ts` failed first on missing `runEcommerceRequirementAnalysis` export.
- RED evidence: the ecommerce submit dependency contract failed first because the `handleGenerate` dependency list omitted `ecommerceState.analysis`, `handleAnalyzeEcommerceRequirement`, and `handleConfirmEcommerceAnalysis`.
- Passed after implementation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-requirement-analysis-runtime-contract.test.ts tests/unit/ecommerce-analysis-button-gate.test.ts tests/unit/ecommerce-upload-removal-contract.test.ts tests/unit/ecommerce-task-state-runtime-contract.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts` (22/22).
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-requirement-analysis-runtime-contract.test.ts tests/unit/ecommerce-analysis-button-gate.test.ts tests/unit/ecommerce-upload-removal-contract.test.ts tests/unit/ecommerce-task-state-runtime-contract.test.ts tests/unit/ecommerce-sheet-settings-runtime-contract.test.ts tests/unit/ecommerce-model-policy.test.ts tests/unit/ecommerce-task-services.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts tests/unit/ecommerce-runtime-contract.test.ts tests/unit/prompt-optimizer-service-source-contract.test.ts` (55/55).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 17 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1096/1096).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommerceRequirementAnalysisRuntime.ts tests/unit/ecommerce-requirement-analysis-runtime-contract.test.ts tests/unit/ecommerce-analysis-button-gate.test.ts tests/unit/ecommerce-upload-removal-contract.test.ts tsconfig.tests.json status.md plans.md implement.md validation.md` with LF/CRLF normalization warnings only.

Historical validation for `bd265ec9` ecommerce task state runtime pass:

- Passed RED first: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-task-state-runtime-contract.test.ts` failed on missing `src/app/useEcommerceTaskStateRuntime.ts`.
- Passed after implementation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-task-state-runtime-contract.test.ts` (4/4).
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-task-state-runtime-contract.test.ts tests/unit/ecommerce-sheet-settings-runtime-contract.test.ts tests/unit/ecommerce-model-policy.test.ts tests/unit/ecommerce-task-services.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts tests/unit/ecommerce-runtime-contract.test.ts` (33/33).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 14 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1082/1082).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommerceTaskStateRuntime.ts tests/unit/ecommerce-task-state-runtime-contract.test.ts tsconfig.tests.json status.md plans.md implement.md validation.md` with LF/CRLF normalization warnings only.

Historical validation for `9cb4d2c4` ecommerce sheet settings runtime pass:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-optimizer-service-source-contract.test.ts tests/unit/ecommerce-sheet-settings-runtime-contract.test.ts tests/unit/prompt-bar-ecommerce-footer-controls.test.ts tests/unit/ecommerce-model-policy.test.ts tests/unit/ecommerce-task-services.test.ts` (34/34).
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1078/1078).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommerceSheetSettingsRuntime.ts tests/unit/ecommerce-sheet-settings-runtime-contract.test.ts tests/unit/prompt-bar-ecommerce-footer-controls.test.ts tests/unit/prompt-optimizer-service-source-contract.test.ts status.md plans.md implement.md validation.md` with LF/CRLF normalization warnings only.

Fresh validation for the current Clay UI audit closure:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/clay-global-ui-refit-contract.test.ts tests/unit/clay-frosted-surface-contract.test.ts tests/unit/theme-contrast-contract.test.ts tests/unit/responsive-surface.test.ts tests/unit/theme-system-adaptation.test.ts tests/unit/settings-entry-surface-style-regression.test.ts` (37/37).
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1075/1075).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git diff --check` with LF/CRLF normalization warnings only.

Historical validation for the paused runtime/PPT follow-up pass:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ppt-runtime-contract.test.ts tests/unit/ppt-runtime-helper-contract.test.ts tests/unit/ppt-deck-single-container-contract.test.ts` (6/6).
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ppt-runtime-contract.test.ts tests/unit/ppt-runtime-helper-contract.test.ts tests/unit/ppt-deck-single-container-contract.test.ts tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts` (57/57).
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1064/1064).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git diff --check` with CRLF normalization warnings only.
- Re-run after ledger correction: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ppt-runtime-contract.test.ts tests/unit/ppt-runtime-helper-contract.test.ts tests/unit/ppt-deck-single-container-contract.test.ts` passed (6/6).
- Re-run after ledger correction: `npm.cmd run governance:agent-docs` passed.
- Re-run after ledger correction: `npm.cmd run check:encoding` passed.

Historical validation for the paused ecommerce runtime slice:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-framework-runtime.test.ts tests/unit/ecommerce-framework-contract.test.ts tests/unit/ecommerce-button-guards.test.ts` (10/10).
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1065/1065).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git diff --check -- src/App.tsx src/app/useEcommerceRuntime.ts tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-button-guards.test.ts status.md plans.md implement.md validation.md` with CRLF normalization warnings only.

Historical validation for the paused ecommerce selection runtime slice:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-runtime-selection.test.ts tests/unit/ecommerce-analysis-selection-contract.test.ts tests/unit/ecommerce-button-guards.test.ts tests/unit/ecommerce-group-slot-state.test.ts` (11/11).
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1066/1066).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git diff --check -- src/App.tsx src/app/useEcommerceRuntime.ts src/app/ecommerceSelectionRuntime.ts tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-runtime-selection.test.ts status.md` with CRLF normalization warnings only.

Historical validation for the paused ecommerce slot history runtime slice:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-group-slot-integration.test.ts tests/unit/ecommerce-group-slot-preview-contract.test.ts tests/unit/ecommerce-group-slot-state.test.ts` (8/8).
- Passed: `npm.cmd run typecheck`.
- Previous blocker now belongs to the active UI lane and was addressed by the current Clay frosted-surface contract update.
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.

Historical validation for `ec434f94` before the current UI closure pass:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-framework-runtime-state-contract.test.ts tests/unit/ecommerce-framework-runtime-order.test.ts tests/unit/ecommerce-framework-runtime.test.ts tests/unit/ecommerce-framework-contract.test.ts tests/unit/ecommerce-button-guards.test.ts tests/unit/ecommerce-runtime-selection.test.ts tests/unit/ecommerce-group-slot-state.test.ts tests/unit/ecommerce-group-slot-integration.test.ts tests/unit/ecommerce-group-slot-preview-contract.test.ts` (22/22).
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1069/1069).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.

Historical validation for the paused ecommerce upload/reference runtime WIP:

- Passed RED first: targeted upload/reference contract set failed on missing `src/app/useEcommerceUploadReferenceRuntime.ts` and App still owning inline upload handlers.
- Passed after implementation and review follow-up: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-upload-references-contract.test.ts tests/unit/ecommerce-upload-removal-contract.test.ts tests/unit/ecommerce-runtime-upload-sync-contract.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts` (7/7).
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1072/1072).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.

Historical validation for the paused ecommerce group export runtime WIP:

- Passed first targeted reproduction after fixes: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-group-export-runtime-contract.test.ts tests/unit/ecommerce-group-export-entry.test.ts tests/unit/ecommerce-group-slot-integration.test.ts` (4/4).
- Passed broadened ecommerce runtime/export suite: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-canvas-contract.test.ts tests/unit/ecommerce-export-button-guards.test.ts tests/unit/ecommerce-group-export-runtime-contract.test.ts tests/unit/ecommerce-group-export-entry.test.ts tests/unit/ecommerce-group-slot-integration.test.ts tests/unit/ecommerce-group-slot-preview-contract.test.ts tests/unit/ecommerce-group-slot-state.test.ts tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-framework-runtime-state-contract.test.ts tests/unit/ecommerce-framework-runtime-order.test.ts tests/unit/ecommerce-framework-runtime.test.ts tests/unit/ecommerce-framework-contract.test.ts tests/unit/ecommerce-button-guards.test.ts tests/unit/ecommerce-runtime-selection.test.ts tests/unit/ecommerce-upload-references-contract.test.ts tests/unit/ecommerce-upload-removal-contract.test.ts tests/unit/ecommerce-runtime-upload-sync-contract.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts` (34/34).
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1075/1075).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommerceGroupExportRuntime.ts tests/unit/ecommerce-group-export-runtime-contract.test.ts tests/unit/ecommerce-group-export-entry.test.ts tests/unit/ecommerce-group-slot-integration.test.ts tests/unit/ecommerce-canvas-contract.test.ts tests/unit/ecommerce-export-button-guards.test.ts status.md` with CRLF normalization warnings only.

## Browser QA

- Browser QA was completed for the historical Clay UI lane before `9e7ae2b5`.
- Current AchievementToast cleanup browser smoke was completed after the `f453cd9a` build at `http://127.0.0.1:3102/?qa=onboarding-unused-cleanup-1777890000000`: production login screen rendered with title `KK Studio - AI Image Workspace`, no connection-refused or render-error text, and `0` current-port console errors. The `AchievementToast` route state was not directly visible without completing onboarding tasks.
- Current Onboarding residual cleanup browser smoke: blocked by Codex in-app Browser automation timeouts before navigation; fallback HTTP smoke against the built `dist` returned 200/title `KK Studio - AI Image Workspace`, but no pixel-level browser verdict was obtained for this slice.
- Current pure image orphan cleanup browser QA: skipped because the slice deletes a non-UI utility module with no production imports and does not change browser-visible runtime behavior.
- Current dormant Pixi canvas cleanup browser QA: skipped because the slice deletes a dormant renderer module with no production imports and does not change browser-visible runtime behavior.
- Current dormant canvas residual cleanup browser QA: skipped because the slice only removes unread source values from dormant support files, preserves public optional props, and leaves live `InfiniteCanvas.tsx` untouched.
- Current browser target: `http://127.0.0.1:3000/?clayVerify=requestlog20260501` served from the local production/static path after `npm.cmd run build`.
- Theme and viewport checked: dark theme, mobile-width in-app Browser viewport; final refresh captured a visible viewport of about `872x985`; desktop/settings/search/API workbench surfaces were also inspected during the same pass.
- Verified surfaces: mobile shell, prompt/composer, SearchPalette default and multi-select states, settings overview, and API Workspace.
- Browser findings: dark mode reads as neutral black/gray; SearchPalette multi-select is readable; API Workspace Add API/Setup Status no longer render as nested stacked cards; `.theme-transitioning === 0`; stale chunk text count `0`.
- Light-theme readability is covered by the Clay emphasis contrast contract because the in-app Browser pass could not switch theme through the blocked `javascript:` injection path.

## Remaining Work

Fresh remaining-work assessment after `cb0d23c9` plus the current M110 working-tree slice:

- Current fact source: alternate-git HEAD before this code slice is `cb0d23c9`; `git --git-dir=node_modules/.codex-git-full --work-tree=. status --short --branch` was clean before M110 started.
- Current gate spot-checks: `npm.cmd run governance:check` passed; `npm.cmd run spec:check` passed; `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` passed.
- Largest real source files still above 2k lines: `src/App.tsx` 4812; `src/services/auth/keyManager.ts` 4310; `src/services/llm/OpenAICompatibleAdapter.ts` 4170; `src/components/layout/PromptBar.tsx` 3965; `src/components/settings/ApiSettingsView.tsx` 3347; `src/components/layout/ChatSidebar.tsx` 2743; `src/app/useGenerationRuntime.ts` 2603; `apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts` 2579; `src/context/CanvasContext.tsx` 2516; `src/components/canvas/PromptNodeComponent.tsx` 2241.
- Current broad debt counts across `src`, `apps`, and `server`: `as any` 131; broad `any` token matches 557; TS suppressions 133; `eslint-disable` 4; `console.log` 236; other `console.warn/error/debug/info` 464; `TODO/FIXME/HACK` 0.
- Interpretation: the project is functionally green by the latest gates, but not refactor-complete because Stage Two giant-file splitting, Stage Three quality governance, and Stage Four `apps/web` migration remain open.

1. The current noUnused filter is clean; the route-gate helpers are wired into live entrypoints; M107 moved OpenAI-compatible post-surface image dispatch planning into a pure helper; M108 moved image payload URL/base64 extraction into a pure helper; M109 moved OpenAI image sizing/profile logic into a pure helper; and M110 moved generic task payload parsing into a pure helper.
2. Next cleanup candidate should be chosen from a fresh TS6133 cluster scan or the next largest-file split. Keep the next slice separate from keyManager secrets/cloud sync, provider routing, storage persistence, release metadata, and UI behavior unless explicitly scoped.
3. Remaining OpenAI-compatible adapter seams: request builders, response parsing, provider quirks, task polling result helpers, and image/video/audio compatibility still need fresh maps. Do not change endpoint selection, auth, fetch behavior, or fallback ordering without a dedicated behavior test.
4. Follow-up server seam: dedupe route auth/header/query-key logic between `apps/api/src/modules/auth/application/user-route-diagnostics-service.ts` and `apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts`; verify provider auth/proxy and Gemini protocol guards plus API restart/probe on port `3001`.
5. Follow-up UI seam: split `src/components/layout/PromptBar.tsx` paste/drop/reference-image ingestion and drag handling only with browser QA, because it touches file-input UI behavior.
6. `keyManager.ts` still needs a fresh seam map before any additional work; do not enter key storage, cloud sync, provider persistence, credential management, permissions, encryption helpers, runtime routing, remote model fetch behavior, or shared pricing cache construction without a smaller proven boundary.
7. CanvasContext remains seam-selection-only for now; avoid `migrateNodes`, IndexedDB/local-folder movement, and persistence orchestration until a smaller diagnostics or hydration helper is mapped.
8. Stage Three quality governance is still open: direct `as any`, explicit any-type patterns, TS suppressions, and bare `console.log` must continue dropping inside touched files, not through one broad repository sweep.
9. Stage Four `apps/web` migration is still open and should not start until Stage Two boundaries are stable.
10. If release metadata changes again, rerun packaging/publish and the full release gate including `npm.cmd run governance:check`.

## Risks

- Original `.git` does not match the writable metadata copy in this session. Use the full writable metadata copy at `node_modules/.codex-git-full` for local commits unless the ACL is fixed outside the sandbox.
- Plain `.git` may show stale dirty state and must not be used as the commit-readiness source.
- The alternate-git worktree was clean at `cb0d23c9` before this M110 task payload helper extraction pass, but any staging must still be explicit path-based and reviewed before commit.
- Browser smoke tests currently pass only in fallback mode because headless Chromium launch is blocked by `spawn EPERM`; do not claim pixel-level UI validation until a real browser launch or in-app manual pass is available.
- Do not delete locks, change `.git` ACLs, revert paused runtime/PPT work, or stage unrelated runtime files without explicit user confirmation.
- Do not mix UI, PPT, runtime extraction, release metadata, and quality-debt cleanup in one commit.
