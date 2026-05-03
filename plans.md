# KK-Studio v1.4.2 Single-Line Convergence Plan

Last updated: 2026-05-03
Branch policy: continue on the current branch and current workspace unless the user explicitly asks for a branch or worktree.

## Summary

The plain `.git` metadata currently still reports baseline commit `4c448660 Refactor Clay UI and PPT runtime boundaries` and may show stale dirty state. The development fact source is the writable full Git metadata copy at `node_modules/.codex-git-full`; the latest clean baseline before the active Netlify raw-key endpoint cleanup is `c171de38 refactor: extract canvas layering helpers`. Use only `git --git-dir=node_modules/.codex-git-full --work-tree=.` for status, staging, diffs, and commits in this session.

The two prior execution threads are merged into one line:
- `019dd551...` remains the main refactor history.
- `019de168...` is treated as continuation work.
- Both are part of `Stage One M6 ecommerce runtime extraction`.

The active execution model for this thread has resumed Stage One convergence:
- Clay UI surface cleanup and browser evidence closed in `9e7ae2b5`.
- Ecommerce source selection closed in `ccf965c3`.
- Ecommerce partial redraw closed in `d12731ce`.
- Stage One M6 closeout scan found no remaining ecommerce-owned business branch in `src/App.tsx`; remaining ecommerce references are hook wiring, state adapters, UI prop forwarding, and render predicates.
- Connector renderer boundary hardening closed in `5f5b76e0`; the connector public-type review follow-up closed in `f06f1880`.
- Stage One Backfill M2 `usePromptGroupLayout` boundary hardening is completed in `8a458cd4`.
- Stage One Backfill M3 `useGenerationRuntime` boundary hardening is completed in `ab719c4a`; the generation billing follow-up is completed in `083db7f8`.
- Stage One Backfill M5 `usePptRuntime` quality check is completed in `569383aa`.
- Stage Two M1 `CanvasContext` state/default/context boundary extraction is completed in `92a9dc41`: it moves state model/defaults/context into `src/context/canvasContextState.ts` and canvas compatibility syncing into `src/context/canvasCompatibility.ts`.
- Stage Two M2 `CanvasContext` selection reducer extraction is completed in `e0f1b583`: it moves replace/add/remove/toggle selection semantics into `src/context/canvasSelection.ts`, without touching drag, persistence, or mutation ownership.
- Stage Two M3 `CanvasContext` prompt child image resolver extraction is completed in `83cc8d7f`: it moves prompt-to-generated-image child ID resolution into `src/context/canvasPromptChildImages.ts`, without touching startup recovery, persistence writes, drag, node mutations, UI, or release metadata.
- Stage Two M4 `CanvasContext` workflow source node ID resolver extraction is completed in `9ec4dbb1`: it moves utility workflow `data.sourceNodeIds` filtering/deduping into `src/context/canvasWorkflowSourceNodeIds.ts`, without touching workflow edge creation/pruning, drag, persistence, node mutations, UI, or release metadata.
- Stage Two M5 `CanvasContext` media recovery extraction is completed in `002ee6fe`: it moves recovered media cache hydration and original-source resolution into `src/context/canvasMediaRecovery.ts`, without touching startup restore ordering, persisted task hydration, local folder refresh behavior, UI, release metadata, drag, or node mutations.
- Security/release cleanup completed after M5: `4cdbf4cf` overrides `protobufjs` to `7.5.5`; `567f85aa` refreshes portable stable release metadata; `0c5cadde` keeps Nutrient OCR keys server-side; `333f2551` updates `postcss` to `8.5.13`; `b6620ef2` removes the dead AI12 service file after reference-proofed pruning.
- Stage Two M6 `CanvasContext` prompt recovery normalization extraction completed in `53f80d80`: it moved startup prompt recovery normalization into `src/context/canvasPromptRecovery.ts`, while leaving async persisted-result recovery and hydration effects in `CanvasContext.tsx`.
- Stage Two M7 `CanvasContext` persisted image recovery helper extraction completed in `0a5c2339`: it moved persisted task/result recovery entries, URL resolution, and recovery-signature construction into `src/context/canvasPersistedImageRecovery.ts`, while leaving the React hydration effect in `CanvasContext.tsx`.
- Stage Two M8 `CanvasContext` canvas merge helper extraction completed in `b68867dd`: it moved canvas card counting, snapshot merge, and preferred active-canvas selection into `src/context/canvasMerge.ts`, while leaving cloud/local-folder restore effects in `CanvasContext.tsx`.
- Stage Two M9 `CanvasContext` invalid-card cleanup helper extraction completed in `7d8a4331`: it moved invalid prompt/image cleanup, utility workflow pruning, group pruning, and selection filtering into `src/context/canvasCleanup.ts`, while leaving public context orchestration in `CanvasContext.tsx`.
- Stage Two M10 `CanvasContext` placement helper extraction completed in `3abdd250`: it moved next-card, smart-collision, and next-group position calculations into `src/context/canvasPlacement.ts`, while leaving public context callbacks in `CanvasContext.tsx`.
- Stage Two M11 `CanvasContext` layering helper extraction completed in `c171de38`: it moved bring-to-front z-index expansion and assignment into `src/context/canvasLayering.ts`, while leaving the public context callback in `CanvasContext.tsx`.
- The active finalization lane is a narrow security cleanup: remove legacy Netlify raw-key BYOK endpoints while preserving the legitimate `pricing-proxy` function.
- The project is functionally green after the latest audit gates, but not final-complete while `CanvasContext.tsx`, `keyManager.ts`, `PromptBar.tsx`, and `OpenAICompatibleAdapter.ts` remain giant-file split targets.

The Clay UI source remains `C:/Users/Administrator/Downloads/DESIGN-clay.md`, `DESIGN.md`, `docs/DESIGN.md`, `.agent/rules/skills/SKILL.md`, shared CSS tokens, and existing UI surfaces. Current user override: inputs, main cards, sub cards, and framework cards use controlled frosted material. Dark mode uses neutral black-gray surfaces (`#0b0b0c`, `#141414`, `#1f1f1f`), not teal/blue/indigo canvas. Clay brand colors are emphasis only.

Commit boundary going forward: UI fixes, runtime/PPT/ecommerce fixes, release metadata, final audit fixes, and Stage Two architecture splits must be staged separately. The next Stage Two slice should include only `CanvasContext.tsx` and the new focused module/tests needed for one responsibility.

## Current Baseline

- `src/App.tsx`: 4900 lines after the latest finalization/security cleanup line.
- `src/app/useConnectorRenderer.ts`: 253 lines, boundary hardened in `5f5b76e0` and review-follow-up typechecked in `f06f1880`.
- `src/app/usePromptGroupLayout.ts`: 1348 lines, extracted and boundary-hardened in `8a458cd4`.
- `src/app/useGenerationRuntime.ts`: 2604 lines, extracted and boundary-hardened in `ab719c4a`; generation billing cleanup completed in `083db7f8`.
- `src/app/usePptRuntime.ts`: 1289 lines, extracted in `4c448660` and semantically boundary-checked in `569383aa`.
- `src/app/pptRuntimeHelpers.ts`: 152 lines, semantically boundary-checked in `569383aa`.
- `src/context/CanvasContext.tsx`: 4080 text lines after Stage Two M11, down from 5218 text lines at the start of Stage Two.
- `src/context/canvasContextState.ts`: 114 lines, new Stage Two M1 state/default/context boundary module.
- `src/context/canvasCompatibility.ts`: 8 lines, new Stage Two M1 canvas workflow/ecommerce compatibility helper.
- `src/context/canvasSelection.ts`: 35 lines, new Stage Two M2 selection reducer helper.
- `src/context/canvasPromptChildImages.ts`: 55 lines, new Stage Two M3 prompt child image resolver helper.
- `src/context/canvasWorkflowSourceNodeIds.ts`: 19 lines, Stage Two M4 workflow source ID resolver helper.
- `src/context/canvasMediaRecovery.ts`: 82 lines, Stage Two M5 media recovery helper.
- `src/context/canvasPromptRecovery.ts`: 184 lines, Stage Two M6 prompt recovery helper.
- `src/context/canvasPersistedImageRecovery.ts`: 301 lines, Stage Two M7 persisted image recovery helper.
- `src/context/canvasMerge.ts`: 122 lines, Stage Two M8 canvas merge helper.
- `src/context/canvasCleanup.ts`: 155 lines, Stage Two M9 invalid-card cleanup helper.
- `src/context/canvasPlacement.ts`: 189 lines, Stage Two M10 placement helper.
- `src/context/canvasLayering.ts`: 185 lines, Stage Two M11 layering helper.
- `src/services/auth/keyManager.ts`: 5279 lines.
- `src/components/layout/PromptBar.tsx`: 4437 lines.
- `src/services/llm/OpenAICompatibleAdapter.ts`: 4517 lines.
- `apps/web/`: migration target, not the first edit location.
- `apps/api/`: DDD back-end structure, not part of this refactor unless compatibility checks require it.

## Execution Loop

Every milestone follows this order:

1. Read the local implementation and relevant tests.
2. Add or update a focused contract/unit test first when behavior or structure changes.
3. Implement only the scoped extraction or cleanup.
4. Run the milestone validation commands from `validation.md`.
5. Fix any new failure before continuing.
6. Update `status.md` with line counts, validation output, risks, and the next step.
7. Stage only files in scope.
8. Create one scoped git commit.
9. Continue to the next milestone.

## Milestones

### 0. Clay Frosted UI Audit (Completed In `9e7ae2b5`)

Goal: replace the older Apple/dark-heavy/Airtable UI drift with a Clay system: warm cream light theme, neutral black-gray dark theme, controlled frosted material for inputs/main cards/sub cards/framework cards, near-black or cream readable text, saturated color blocks for emphasis, no blue/teal dark canvas, and no whole-page theme flicker.

Current status: completed in this thread. Runtime/PPT/ecommerce work has resumed and must stay in separate runtime commits.

Scope:
- Create the root `DESIGN.md` Clay reference from the cached `getdesign` Clay guidance.
- Rewrite `docs/DESIGN.md` and `.agent/rules/skills/SKILL.md` so Clay is canonical.
- Refactor `src/index.css` tokens toward Clay canvas `#fffaf0`, ink `#0a0a0a`, neutral dark canvas `#0b0b0c`, neutral dark surfaces `#141414` / `#1f1f1f`, controlled frosted surface tokens, and Clay pink/coral/teal accents.
- Rework `SearchPalette.tsx`, `ThemeContext.tsx`, canvas-card shadow helpers, settings surface tokens, and responsive surface contracts around shared Clay tokens.
- Apply frosted tokens to search palette, sidebar, mobile shell, prompt/composer input, settings inputs/cards/shells, storage/tag/image option modals, prompt/image/framework canvas cards, and ecommerce panels where those surfaces already exist.
- Preserve unrelated billing/API backend work and do not stage unrelated paths.

Acceptance:
- UI contract tests cover Clay manual/rule presence, light/dark contrast, dark canvas neutrality, flat card depth, search palette constraints, responsive settings/search surfaces, and no whole-document theme transition.
- Search palette has no heavy Tailwind shadows, no local indigo selected state, no inline focus mutation, and uses separate desktop command-surface and mobile bottom-sheet geometry.
- Settings and onboarding keep separate mobile and desktop logic.
- Infinite canvas dark background is `#0b0b0c`, not blue/teal; main/sub/framework surfaces use tokenized frosted material with readable solid fallbacks.
- Documentation and agent rules name Clay as the canonical UI system and preserve existing governance-required rule sections.
- Clay/UI changes are reviewed separately from runtime/PPT changes, with browser evidence recorded before a UI commit.

Validation:
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/clay-global-ui-refit-contract.test.ts tests/unit/clay-frosted-surface-contract.test.ts tests/unit/theme-contrast-contract.test.ts tests/unit/responsive-surface.test.ts tests/unit/theme-system-adaptation.test.ts tests/unit/settings-entry-surface-style-regression.test.ts`
- `npm.cmd run verify:mobile-settings-smoke`
- `npm.cmd run verify:desktop-settings-smoke`
- `npm.cmd run typecheck`
- `npm.cmd run test:unit`
- `npm.cmd run build`
- `npm.cmd run governance:agent-docs`
- `npm.cmd run check:encoding`

Commit:
- `refactor: audit clay frosted ui surfaces`

### 1. Refactor Ledger Alignment

Goal: make `plans.md`, `implement.md`, `status.md`, and `validation.md` describe the v1.4.2 refactor line.

Acceptance:
- The four ledger files identify `d12731ce` as the then-current alternate-git baseline, name plain `.git` as stale/historical, and describe the single merged execution line.
- The previous recovery stream and dual-thread state remain acknowledged as history, not the active plan.
- The next active step is Stage One Backfill M1 `useConnectorRenderer` hardening.
- Documentation validation and encoding checks pass.

Validation:
- `npm.cmd run governance:agent-docs`
- `npm.cmd run check:encoding`

Commit:
- `docs: align v1.4.2 refactor plan`

### 2. Stage One M6 Closeout: Remaining Ecommerce Branch Scan (Completed)

Goal: finish Stage One M6 by proving whether any ecommerce-owned branch remains in `src/App.tsx`.

Scope:
- Scan `src/App.tsx` for remaining ecommerce-owned handlers, state branches, redraw/source-selection branches, and framework-status glue.
- If a clear remaining ecommerce branch exists, split exactly one smallest runtime hook and contract test.
- If no clear branch exists, update the ledger to mark Stage One M6 complete and move to Stage One backfill.
- Do not mix this scan with connector, prompt-group, generation, PPT, UI, or release metadata work.
- Result: no new M6 runtime slice is required. Remaining ecommerce hits in `src/App.tsx` are orchestration-only: source selection calls `resetEcommerceSourceSelectionState`, partial redraw calls `resolveEcommercePartialRedrawContext` and `finalizeEcommercePartialRedrawResult`, submit uses `handleEcommerceSubmitGuard`, and the state adapter block only patches hook state.

Acceptance:
- A source map records every remaining ecommerce reference category in `src/App.tsx`.
- The next action is explicit: either one named smallest hook slice with tests, or M6 completion.
- Browser QA is skipped only if no UI surface changed, with the reason recorded in `status.md`.

Validation:
- If docs/scan-only: `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited `git diff --check`.
- If runtime code changes: the active ecommerce targeted tests, `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited `git diff --check`.

Commit:
- `docs: close ecommerce runtime extraction map` if scan-only.
- `refactor: extract ecommerce <slice> runtime` if code changes.

### 3. Stage One Backfill M1: Connector Renderer Extraction Hardening (Completed In `5f5b76e0`, Follow-Up In `f06f1880`)

Goal: finish the already-started connector renderer extraction without re-creating the hook.

Scope:
- Audit `src/App.tsx` and `src/app/useConnectorRenderer.ts`.
- Confirm these methods live only inside the hook: `buildConnectorRenderSnapshot`, `commitConnectorRenderSnapshot`, `scheduleConnectorRenderSnapshot`, `resolveLivePromptPosition`, `resolveLiveImagePosition`, `resolveConnectorRenderPosition`.
- Tighten hook types with existing `CanvasPerformanceProfile` and `CanvasPoint` types.
- Add explicit `UseConnectorRendererResult`.
- Keep `App.tsx` as hook orchestration plus render usage only.

Acceptance:
- No duplicate connector snapshot logic remains in `App.tsx`.
- Connector rendering lists and position resolvers are returned from `useConnectorRenderer`.
- Connector throttling and live scene contract tests pass.
- `src/App.tsx` line count is recorded after the milestone.

Validation:
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-connector-throttling-contract.test.ts tests/unit/canvas-local-performance-trace-contract.test.ts tests/unit/canvas-live-scene-contract.test.ts`
- `npm.cmd run typecheck`
- `npm.cmd run test:unit`
- `npm.cmd run build`
- `npm.cmd run check:encoding`

Commit:
- `refactor: harden connector renderer boundary`

### 4. Stage One Backfill M2: Prompt Group Layout Runtime (Completed In Prompt-Group Commit)

Goal: harden the already extracted prompt group layout, bounds, overlap, regroup, and live scene derivation runtime in `src/app/usePromptGroupLayout.ts`.

Scope:
- Export `PromptGroupBounds`, `UsePromptGroupLayoutDeps`, `UsePromptGroupLayoutResult`, `UsePromptGroupStackingDeps`, and `UsePromptGroupStackingResult`.
- Confirm prompt group bounds, visible group views, regroup presentation state coordination, and live scene derivation remain in the hook.
- Keep drag handler hooks and rendering code compatible through explicit returned methods and state.

Acceptance:
- `App.tsx` does not reintroduce prompt group layout blocks after extraction.
- Existing prompt-group regroup and live-scene tests pass.
- Drag, focus, auto-repair, regroup settle, and connector rendering behavior stay contract-compatible.

Validation:
- Prompt group and live scene targeted tests.
- `npm.cmd run typecheck`
- `npm.cmd run test:unit`
- `npm.cmd run build`
- `npm.cmd run check:encoding`

Commit:
- `refactor: harden prompt group layout boundary`

### 5. Stage One Backfill M3: Generation Runtime Quality Check (Completed In `ab719c4a`, Follow-Up In `083db7f8`)

Goal: verify the already extracted generation execution runtime remains clean and does not need immediate follow-up before Stage Two.

Scope:
- Confirm generation start, billing attempt coordination, cancellation, retry, failure state, result node persistence, and preview state wiring remain in `src/app/useGenerationRuntime.ts`.
- Semantically typecheck the public generation runtime boundary through `tests/unit/generation-runtime-contract.test.ts`.
- Semantically typecheck generation billing boundary coverage through `tests/unit/generation-billing-runtime-contract.test.ts`.
- Remove stale App-side generation billing imports/destructures after ownership has moved into the runtime hook.
- Preserve current billing, API, storage, and generation service contracts.

Acceptance:
- Generation lifecycle behavior remains unchanged.
- Cancellation, retry, balance consume/refund, and result placement tests stay green.
- No API or billing protocol changes are introduced.
- `UseGenerationRuntimeDeps`, `UseGenerationRuntimeResult`, and retry/submission public boundary types are imported by a semantic test included in `tsconfig.tests.json`.

Commit:
- `refactor: harden generation runtime` if code changes.
- `docs: record generation runtime backfill` if scan-only.

### 6. Stage One Backfill M5: PPT Runtime Quality Check (Completed In `569383aa`)

Status: completed in `569383aa`. The first extraction pass landed in `4c448660`; this follow-up stayed separate from Clay UI files and hardened the semantic public boundary through contract tests.

Goal: verify the already extracted PPT editing, preview, export, and deck child image management boundaries remain clean and do not need immediate follow-up before Stage Two.

Scope:
- Keep `src/app/usePptRuntime.ts` as owner of PPT editable page building, slide synchronization, PPTX export, PPT preview, and deck child filtering orchestration.
- Keep `src/app/pptRuntimeHelpers.ts` as owner of PPT image ordering, stale child fallback, parent prompt rejection, deck child detection, and nullish image array guards.
- Semantically typecheck the public PPT runtime boundary through `tests/unit/ppt-runtime-contract.test.ts`.
- Add all three PPT contract tests to `tsconfig.tests.json`: `tests/unit/ppt-runtime-contract.test.ts`, `tests/unit/ppt-runtime-helper-contract.test.ts`, and `tests/unit/ppt-deck-single-container-contract.test.ts`.
- Preserve existing helper modules such as PPTX skeleton and slide document builders.

Acceptance:
- PPT preview and editable export behavior remains unchanged.
- Deck child image filtering remains compatible with canvas rendering.
- `UsePptRuntimeDeps`, `UsePptRuntimeResult`, PPT bundle/editor/preview public boundary types, and `PptRuntimeCanvasSnapshot` are imported by a semantic test included in `tsconfig.tests.json`.
- PPT-related targeted tests, typecheck, unit suite, build, agent-doc governance, encoding check, and path-limited `diff --check` pass.

Commit:
- `refactor: harden ppt runtime` if code changes.
- `docs: record ppt runtime backfill` if scan-only.

### 7. Stage One M6: Ecommerce Runtime

Goal: extract ecommerce framework/runtime logic last because it has the highest cross-reference count.

Scope:
- Build an ecommerce reference map before editing.
- Add source contract tests for framework cards, import/review flows, scheduler state, and product image result binding.
- Create `src/app/useEcommerceRuntime.ts`.
- Completed slice: extract ecommerce sheet defaults, A+ sizing policy resolution, node generation setting resolution, and sheet-setting update propagation into `src/app/useEcommerceSheetSettingsRuntime.ts`.
- Completed slice: extract initial ecommerce task-state building and task edit synchronization into `src/app/useEcommerceTaskStateRuntime.ts`.
- Completed slice: extract requirement-file pick/clear/reset and requirement analysis execution into `src/app/useEcommerceRequirementAnalysisRuntime.ts`.
- Completed slice in `d0a95f79`: extract ecommerce confirmation, framework/group/task node building, initial group slot creation, and framework runtime bootstrapping into `src/app/useEcommerceBuildRuntime.ts`.
- Completed slice in `5acf9c27`: extract active task prompt/display synchronization and post-confirm built-card upload/reference rehydration into `src/app/useEcommercePostBuildSyncRuntime.ts`.
- Completed slice in `6dc8e391`: extract ecommerce node generation execution, desktop confirmation, and mobile retry callbacks into `src/app/useEcommerceNodeGenerationRuntime.ts`.
- Completed slice in `782d30d3`: extract mobile ecommerce continuation lookup/edit/toggle/confirm/mobile-generate handlers into `src/app/useEcommerceMobileContinuationRuntime.ts`.
- Completed slice in `184b158c`: extract source-key ecommerce task activation fallback and prompt-node activation into `src/app/useEcommerceTaskActivationRuntime.ts`.
- Completed slice: extract the ecommerce submit branch in `handleGenerate` into `src/app/useEcommerceSubmitRuntime.ts`.
- Completed slice in `cc24e19d`: extract the ecommerce mode guard/reset and prompt activation branches into `src/app/useEcommerceModeRuntime.ts` and `src/app/useEcommercePromptActivationRuntime.ts`.
- Completed slice in `ccf965c3`: extract the image-source ecommerce reset branch in `handleImageClick` into `src/app/useEcommerceSourceSelectionRuntime.ts`.
- Completed slice in `d12731ce`: extract the ecommerce partial-redraw inheritance and result-finalization branch in `handlePartialRedrawRequest` into `src/app/useEcommercePartialRedrawRuntime.ts`.
- Closeout scan: completed. No remaining ecommerce-owned business branch blocks M6 completion; remaining App references are hook orchestration, state adapter wiring, UI prop forwarding, and duplicated render predicates to handle later.

Acceptance:
- Ecommerce references are routed through an explicit hook interface.
- Existing ecommerce contract tests do not regress.
- No unrelated generation or PPT behavior changes.
- Sheet settings runtime exposes explicit deps/result interfaces and App no longer owns inline sheet settings helpers.
- Task state runtime exposes explicit deps/result interfaces; App no longer owns inline task-state sizing/edit callbacks.
- Requirement analysis runtime exposes explicit deps/result interfaces; App no longer owns inline requirement reset/analyze callbacks.
- Build runtime exposes explicit deps/result interfaces; App no longer owns inline ecommerce framework/group/task builders or confirmation flow.
- Post-build sync runtime exposes explicit deps/result interfaces; App no longer owns active ecommerce task prompt/display synchronization or built-card upload/reference rehydration effects.
- Node generation runtime exposes explicit deps/result interfaces; App no longer owns ecommerce node state patching, prompt optimization execution, single-card generation, desktop confirmation, or mobile retry callbacks.
- Mobile continuation runtime exposes explicit deps/result interfaces; App no longer owns mobile ecommerce prompt-node resolution, task editing activation, selection toggles, desktop confirmation forwarding, or mobile generation queue fallback handlers.
- Task activation runtime exposes explicit deps/result interfaces; App no longer owns source-key ecommerce task activation lookup or fallback active-task/group-sheet restoration.
- Ecommerce submit runtime exposes explicit deps/result interfaces; App no longer owns the ecommerce-specific submit guard branch inside `handleGenerate`.
- Ecommerce mode runtime exposes explicit deps/result interfaces; App no longer owns the ecommerce mode guard/reset effect.
- Ecommerce prompt activation runtime exposes explicit deps/result interfaces; App no longer owns the ecommerce prompt activation state block or prompt-node framework status callback.
- Ecommerce source selection runtime exposes explicit deps/result interfaces; App no longer owns the image-source ecommerce reset block inside `handleImageClick`.
- Ecommerce partial redraw runtime exposes explicit deps/result interfaces; App no longer owns the ecommerce inherited redraw context resolution or ecommerce redraw result finalization branch inside `handlePartialRedrawRequest`.

Commit:
- `refactor: extract ecommerce partial redraw runtime` completed in `d12731ce`.
- M6 is complete after the closeout ledger update.

### 8. Stage Two: Secondary Giant File Split

Goal: split the next largest files while preserving public behavior.

Scope:
- Completed M1 slice in `92a9dc41`: extracted `CanvasState`, `CanvasContextType`, `CanvasContext`, layout mode types, `MAX_CANVASES`, default canvas/state construction, id generation, and workflow creation into `src/context/canvasContextState.ts`; canvas compatibility syncing lives in `src/context/canvasCompatibility.ts`.
- Completed M2 slice in `e0f1b583`: extracted the Canvas selection reducer from `src/context/CanvasContext.tsx` into a pure focused helper, preserving current selection ordering and duplicate semantics.
- Completed M3 slice in `83cc8d7f`: extracted `resolvePromptChildImageIds` from `src/context/CanvasContext.tsx` into a pure focused helper, preserving strong ownership, listed-order, duplicate filtering, source-image exclusion, and legacy fallback semantics.
- Completed M4 slice in `9ec4dbb1`: extracted `getWorkflowSourceNodeIds` from `src/context/CanvasContext.tsx` into a pure focused helper, preserving utility-only gating, first-seen string ID order, blank/non-string filtering, and non-trimming return semantics.
- Completed M5 slice in `002ee6fe`: extracted `hydrateRecoveredMediaCacheEntry` and `resolveOriginalPersistSourceForDisk` from `src/context/CanvasContext.tsx` into `src/context/canvasMediaRecovery.ts`, preserving protected original-slot behavior, video fallback behavior, and blob-source rejection.
- Completed M6 slice in `53f80d80`: extracted startup prompt recovery normalization from `src/context/CanvasContext.tsx` into `src/context/canvasPromptRecovery.ts`, preserving completed-prompt cleanup, interrupted synchronous-generation marking, and before-unload risk detection.
- Completed M7 slice in `0a5c2339`: extracted persisted image recovery helpers from `src/context/CanvasContext.tsx` into `src/context/canvasPersistedImageRecovery.ts`, preserving completed/persisted task entry merge, storage/original URL resolution order, recovery signature gating, and the existing React hydration effect.
- Completed M8 slice in `b68867dd`: extracted canvas merge helpers from `src/context/CanvasContext.tsx` into `src/context/canvasMerge.ts`, preserving non-empty snapshot preference, local item override during ID merge, max `lastModified`, and preferred active-canvas fallback ordering.
- Completed M9 slice in `7d8a4331`: extracted invalid-card cleanup helpers from `src/context/CanvasContext.tsx` into `src/context/canvasCleanup.ts`, preserving invalid prompt/image removal, utility workflow source/output pruning, workflow edge pruning, group pruning, selection filtering, and summary reporting.
- Completed M10 slice in `3abdd250`: extracted placement helpers from `src/context/CanvasContext.tsx` into `src/context/canvasPlacement.ts`, preserving fixed card-grid slots, smart collision shifts, utility workflow collision checks, and dynamic child-card group width accumulation.
- Completed M11 slice in `c171de38`: extracted layering helpers from `src/context/CanvasContext.tsx` into `src/context/canvasLayering.ts`, preserving prompt-group expansion, linked canvas group expansion, workflow node z-index promotion, and group z-index ordering.
- Current security slice: remove legacy Netlify raw-key BYOK endpoints `netlify/functions/keys.ts` and `netlify/functions/generate.ts`, keep `netlify/functions/pricing-proxy.ts`, and extend security governance to scan `netlify/`.
- Split `src/context/CanvasContext.tsx` by state model, selection/drag events, node mutations, and persistence sync.
- Split `src/services/auth/keyManager.ts` by key storage, permission checks, encryption helpers, and provider credential management.
- Split `src/components/layout/PromptBar.tsx` by composer state, attachments, ecommerce controls, and mobile/desktop presentation.
- Split `src/services/llm/OpenAICompatibleAdapter.ts` by request building, response parsing, provider quirks, and image/video/audio compatibility.
- Keep compatibility exports for existing import paths.

Acceptance:
- Public context/service APIs remain compatible.
- `CanvasContext.tsx` continues re-exporting public context types for existing import paths.
- Typecheck and related unit tests pass after each sub-split.
- Commits are scoped per submodule, not one large batch.

### 9. Stage Three: Global Quality Governance

Goal: reduce type ambiguity and repeated logic after the main extractions create stable seams.

Scope:
- Remove or narrow `any` only where it is touched by the current refactor.
- Reduce `@ts-ignore` / `@ts-expect-error` and bare `console.log` only in touched files unless a dedicated cleanup milestone is created.
- Consolidate repeated domain types into existing type files or focused domain files.
- Remove dead code introduced by the refactor.
- Extract repeated UI fragments only when the duplication is local and obvious.

Acceptance:
- No new type errors.
- Core UI contract tests do not regress.
- The cleanup does not alter visual flow or product behavior.

### 10. Stage Four: apps/web Migration

Goal: migrate stabilized front-end modules into `apps/web/` after boundaries are proven in `src/`.

Scope:
- Move modules by business domain.
- Preserve compatibility exports or update all imports atomically.
- Keep `apps/api/` untouched except for compatibility verification.

Acceptance:
- No duplicate source of truth remains between `src/` and `apps/web/`.
- Front-end build, typecheck, unit tests, and critical smoke checks pass.

## Historical Recovery Context

The earlier recovery convergence plan and its eleven milestones are considered complete historical work. The current line no longer uses those recovery milestones as active tasks, but their safety rules remain useful: protect the dirty worktree, avoid secret leakage, validate before committing, and keep commits scoped.
