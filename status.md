# KK-Studio v1.4.2 Coordination Status

Last updated: 2026-05-04

## Active State

- Active lane in this thread: single-line Stage Two giant-file split plus finalization audit. Stage One M6 ecommerce runtime extraction is complete after the closeout scan; Stage One Backfill M1 `useConnectorRenderer` hardening is committed in `5f5b76e0`, with public-type review follow-up committed in `f06f1880`; Stage One Backfill M2 `usePromptGroupLayout` hardening is committed in `8a458cd4`; Stage One Backfill M3 `useGenerationRuntime` hardening is committed in `ab719c4a`; the generation billing follow-up is committed in `083db7f8`; Stage One Backfill M5 `usePptRuntime` public type-boundary coverage is committed in `569383aa`; Stage Two M1-M31 are committed through `56debf21`; Stage Two M32 provider linked-slot matching is committed in `615b7969`; Stage Two M33 provider usage helper extraction is committed in `dd3ad358`; Stage Two M34 route ID helper extraction is committed in `a598312d`; Stage Two M35 credential sanitizer extraction is committed in `531eae6b`; Stage Two M36 `keyManager` channel config secret redaction extraction is committed in `7b54fd1a`; Stage Two M37 `keyManager` dead-code pruning is committed in `4658d947`; Stage Two M38 `keyManager` browser-direct diagnostics message wrapper pruning is committed in `afe89b71`; Stage Two M39 `keyManager` legacy Google model constant pruning is the active current slice; the latest security/release cleanup commits are `4cdbf4cf`, `567f85aa`, `0c5cadde`, `333f2551`, `b6620ef2`, and `0603547a`.
- Clay UI audit closure landed in `9e7ae2b5` and is no longer the active lane.
- Current branch: `main`.
- Plain `.git` still reports `4c448660` and is a stale historical view. The writable full Git metadata copy at `node_modules/.codex-git-full` is the only development fact source and was clean at `afe89b71 refactor: prune key manager browser diagnostics wrapper` before the current M39 slice. Use `git --git-dir=node_modules/.codex-git-full --work-tree=.` for status/staging/commits in this session.
- Thread merge state: `019dd551...` is the main refactor history and `019de168...` is continuation history; both are part of the same Stage One M6 ecommerce runtime line.
- Alternate-git worktree was clean at `afe89b71` before this M39 slice.
- UI source of truth: `C:/Users/Administrator/Downloads/DESIGN-clay.md`, `DESIGN.md`, `docs/DESIGN.md`, `.agent/rules/skills/SKILL.md`, and shared CSS tokens in `src/index.css`.
- Runtime source of truth: Stage One hook extraction rules in `plans.md`; all custom hooks stay under `src/app/` with explicit deps/result interfaces.
- Current focus: finish and commit Stage Two M39 by pruning the now-unreferenced `LEGACY_GOOGLE_MODELS` constant from `src/services/auth/keyManager.ts`.
- Most recent code/security scopes: Stage Two M39 legacy Google model constant pruning in the active working tree; Stage Two M38 browser-direct diagnostics message wrapper pruning in `afe89b71`; Stage Two M37 dead-code pruning in `4658d947`; Stage Two M36 channel config secret redaction extraction in `7b54fd1a`; Stage Two M35 credential sanitizer extraction in `531eae6b`; Stage Two M34 route ID helper extraction in `a598312d`; Stage Two M33 provider usage helper extraction in `dd3ad358`; Stage Two M32 provider linked-slot matching helper extraction in `615b7969`; Stage Two M31 provider runtime-state merge helper extraction in `56debf21`; Stage Two M30 model normalization facade consolidation in `08eb89d8`; Stage Two M29 keyManager key type split in `3ce7ae59`; Stage Two M28 keyManager model helper split in `a174b557`; Stage Two M27 prompt-node update helper in `b16843ee`; Stage Two M26 auto-arrange helper in `7cbd7346`; Netlify raw-key endpoint cleanup in `0603547a`; protobuf override in `4cdbf4cf`; portable metadata refresh in `567f85aa`; Nutrient OCR server-key hardening in `0c5cadde`; PostCSS patch in `333f2551`; dead AI12 service pruning in `b6620ef2`.
- Current commit scope: `src/services/auth/keyManager.ts`, `tests/unit/key-manager-dead-code-pruning-contract.test.ts`, `plans.md`, `implement.md`, and `status.md`. UI, release metadata, Netlify endpoint cleanup, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence, cloud sync, channel config behavior, credential storage, token/backoff behavior, and exported API cleanup remain excluded from this commit.
- Browser QA: skipped for Stage Two M39 because this is a non-UI source-proven constant pruning slice with no component, CSS, route, or browser-visible workflow changed.

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

- Current giant tracked files after the active Stage Two M39 working tree: `src/services/auth/keyManager.ts` 4247 lines, `src/App.tsx` 4385 lines, `src/services/llm/OpenAICompatibleAdapter.ts` 3980 lines, `src/components/layout/PromptBar.tsx` 4075 lines, `src/context/CanvasContext.tsx` 2198 physical lines. `src/services/auth/keyManagerChannelConfigSecrets.ts` is 3 lines, `src/services/auth/keyManagerCredentialSanitizer.ts` is 3 lines, `src/services/auth/keyManagerRouteIds.ts` is 94 lines, `src/services/auth/keyManagerProviderUsage.ts` is 67 lines, `src/services/auth/keyManagerProviderLinks.ts` is 154 lines, `src/services/auth/keyManagerProviders.ts` is 102 lines, `src/services/auth/keyManagerModelHelpers.ts` is 168 lines, `src/services/auth/keyManagerKeyType.ts` is 9 lines, and `src/utils/modelIdNormalization.ts` is 6 lines.
- Current tracked TS/TSX debt scan by alternate-git `git grep` over `*.ts` / `*.tsx`: direct `as any` matches 156, explicit any-type pattern matches 370, `@ts-ignore` / `@ts-expect-error` matches 133, and `console.log` matches 251. These are refactor debt indicators, not release blockers by themselves.
- Quality rule going forward: reduce `any`, TypeScript suppressions, and bare `console.log` inside touched files when local and safe; do not perform a whole-repo cleanup inside one runtime or architecture extraction.
- Architecture status from the latest full check: `npm.cmd run architecture:check` passed with known allowlisted migration and legacy bridge exceptions; `npm.cmd run spec:check` passed.
- Version governance status from the latest full check: `npm.cmd run governance:check` passed after `567f85aa` refreshed portable release metadata.

## Finalization Audit Plan

1. Close the currently selected Stage Two `CanvasContext.tsx` seam first; do not run a final completion audit while an obvious giant-file split seam is active.
2. Run high-confidence local audits for unused code, TypeScript debt, bare debug logging, TODO/FIXME markers, sensitive storage/logging, architecture boundaries, specs, build, unit tests, and UI contract coverage.
3. Fix only narrow blockers found by the audits. Broad debt counts are tracked but are not safe to delete in one batch.
4. If packaging/publish metadata changes again, rerun `npm.cmd run package:portable`, `npm.cmd run publish:portable`, and `npm.cmd run governance:check` before final release sign-off.
5. Final completion can only be claimed after the release gate and UI/browser checks required by touched surfaces pass.

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
- Current browser target: `http://127.0.0.1:3000/?clayVerify=requestlog20260501` served from the local production/static path after `npm.cmd run build`.
- Theme and viewport checked: dark theme, mobile-width in-app Browser viewport; final refresh captured a visible viewport of about `872x985`; desktop/settings/search/API workbench surfaces were also inspected during the same pass.
- Verified surfaces: mobile shell, prompt/composer, SearchPalette default and multi-select states, settings overview, and API Workspace.
- Browser findings: dark mode reads as neutral black/gray; SearchPalette multi-select is readable; API Workspace Add API/Setup Status no longer render as nested stacked cards; `.theme-transitioning === 0`; stale chunk text count `0`.
- Light-theme readability is covered by the Clay emphasis contrast contract because the in-app Browser pass could not switch theme through the blocked `javascript:` injection path.

## Remaining Work

1. After the scoped Stage Two M39 commit lands, wait for the remaining read-only seam map before selecting another keyManager slice. Do not enter key storage, cloud sync, provider persistence, credential management, permissions, or encryption helpers without a smaller proven boundary.
2. Keep the M39 commit scope limited to `src/services/auth/keyManager.ts`, `tests/unit/key-manager-dead-code-pruning-contract.test.ts`, and the ledger files touched by this slice.
3. Follow-up server seam: dedupe route auth/header/query-key logic between `apps/api/src/modules/auth/application/user-route-diagnostics-service.ts` and `apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts`; verify provider auth/proxy and Gemini protocol guards plus API restart/probe on port `3001`.
4. Follow-up adapter seam: split `src/services/llm/OpenAICompatibleAdapter.ts` provider image routing and safe diagnostic preview/redaction; verify provider image routing, provider strategy, async image proxy, probe matrix, security, typecheck, unit, and build.
5. Follow-up UI seam: split `src/components/layout/PromptBar.tsx` paste/drop/reference-image ingestion and drag handling only with browser QA, because it touches file-input UI behavior.
6. CanvasContext remains seam-selection-only for now; avoid `migrateNodes`, IndexedDB/local-folder movement, and persistence orchestration until a smaller diagnostics or hydration helper is mapped.
7. If release metadata changes again, rerun packaging/publish and the full release gate including `npm.cmd run governance:check`.

## Risks

- Original `.git` does not match the writable metadata copy in this session. Use the full writable metadata copy at `node_modules/.codex-git-full` for local commits unless the ACL is fixed outside the sandbox.
- Plain `.git` may show stale dirty state and must not be used as the commit-readiness source.
- The alternate-git worktree was clean at `afe89b71` before this M39 slice, but any staging must still be explicit path-based and reviewed before commit.
- Do not delete locks, change `.git` ACLs, revert paused runtime/PPT work, or stage unrelated runtime files without explicit user confirmation.
- Do not mix UI, PPT, runtime extraction, release metadata, and quality-debt cleanup in one commit.
