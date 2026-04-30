# KK-Studio v1.4.2 Refactor Status

Last updated: 2026-04-30

## Current Position

- Workspace: `C:\Users\Administrator\Downloads\KK-Studio-1.0.0`
- Active plan: v1.4.2 progressive refactor in `plans.md`
- Current milestone: Milestone 4 generation runtime extraction is in progress; retry generation task prompt context slice is complete in the current working line
- Branch policy: continue on current branch unless the user explicitly asks otherwise
- `apps/api/`: compatibility checks only
- `apps/web/`: future migration target after `src/` boundaries are stable
- UI/visual optimization policy: browser inspection through the Codex in-app Browser is mandatory for UI changes before commit; non-UI runtime refactors may skip it with an explicit note.

## Baseline Snapshot

- `src/App.tsx`: 8878 lines after Milestone 4 retry generation task prompt context extraction
- `src/app/useConnectorRenderer.ts`: 284 lines after Milestone 2 type hardening
- `src/context/CanvasContext.tsx`: 5434 lines
- `src/services/auth/keyManager.ts`: 5280 lines
- Existing extracted app hooks:
  - `useAppPromptBarProps.ts`
  - `useCanvasDragConnection.ts`
  - `useCanvasNodeSelection.ts`
  - `useCanvasSelectionBox.ts`
  - `useConnectorRenderer.ts`
  - `useDraftNodeSync.ts`
  - `useGenerationPlacement.ts`
  - `useGenerationReferenceImages.ts`
  - `useGenerationRuntime.ts`
  - `useGenerationSubmitGuard.ts`
  - `usePromptGroupDragHandlers.ts`
  - `usePromptGroupSelection.ts`
  - `useSelectionMenuOverlay.ts`
  - `useWorkflowActions.ts`
  - `useWorkflowSourceResolvers.ts`

## Milestone Progress

### Milestone 0: Airtable-Inspired Global UI Refit

Status: complete and committed as `bb0d3f52 refactor: apply airtable global ui refit`.

Scope:
- Add a failing UI source-contract test for Airtable manual/rules, global tokens, search palette, settings primitives, and API settings weighting.
- Rework the global UI system toward light-first Airtable clarity with controlled frosted glass on key shells/cards.
- Use four GPT-5.5 xhigh subagents with disjoint write scopes for docs/rules, CSS, search/settings primitives, and API settings weighting.
- Keep unrelated billing/API backend files untouched.

Validation to run:
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/settings-ui-density-regression.test.ts tests/unit/api-settings-provider-compact-ui-contract.test.ts tests/unit/api-settings-simple-mode-contract.test.ts tests/unit/airtable-global-ui-refit-contract.test.ts`
- `npm.cmd run verify:mobile-settings-smoke`
- `npm.cmd run verify:desktop-settings-smoke`
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run governance:agent-docs`
- `npm.cmd run check:encoding`

Current notes:
- The new UI contract test has been written and was verified failing before implementation.
- Four GPT-5.5 xhigh worker subagents were dispatched for docs/rules, CSS, search/settings primitives, and API settings weighting. All returned `BLOCKED` without file edits, so the main thread completed the implementation and integration.

Completed changes:
- Added root `DESIGN.md` and rewrote `docs/DESIGN.md` around Airtable clarity, controlled frosted glass, radius, shadow, focus, typography, and motion rules.
- Updated `.agent/rules/skills/SKILL.md` to v3.0 with the Airtable UI system while preserving Cadence and vendor-routing governance anchors.
- Added Airtable UI contract tests.
- Refactored global CSS tokens, settings glass/shadow caps, search palette tokens, settings primitive motion, and API settings default action weighting.

Validation passed:
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/airtable-global-ui-refit-contract.test.ts`
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/settings-ui-density-regression.test.ts tests/unit/api-settings-provider-compact-ui-contract.test.ts tests/unit/api-settings-simple-mode-contract.test.ts tests/unit/airtable-global-ui-refit-contract.test.ts`
- `npm.cmd run verify:mobile-settings-smoke`
- `npm.cmd run verify:desktop-settings-smoke`
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run governance:agent-docs`
- `npm.cmd run check:encoding`

Post-commit follow-up:
- With user confirmation, `npx getdesign@latest add airtable` was executed on 2026-04-29.
- The tool wrote `airtable/DESIGN.md` because the root `DESIGN.md` already existed.
- The generated file matched the Airtable reference direction already merged into root `DESIGN.md`, `docs/DESIGN.md`, `.agent/rules/skills/SKILL.md`, and UI tokens, so the isolated `airtable/` reference folder was removed after review.

### Milestone 1: Refactor Ledger Alignment

Status: complete and committed as `33afff9b docs: align v1.4.2 refactor plan`.

Scope:
- Replace the old recovery-first ledger language with the active v1.4.2 refactor plan.
- Keep recovery history as background only.
- Define milestone gates, validation commands, and commit policy.

Validation passed:
- `npm.cmd run governance:agent-docs`
- `npm.cmd run check:encoding`

Notes:
- The later UI refit commit updated the ledger again and is now part of the current branch history.

### Milestone 2: Connector Renderer Extraction Hardening

Status: complete and committed as `db0d9247 refactor: harden connector renderer extraction`.

Known baseline:
- `src/app/useConnectorRenderer.ts` already exists.
- `src/App.tsx` imports and calls `useConnectorRenderer`.
- Prior read-only validation showed connector/live-scene targeted tests and typecheck passing before this execution line.

Planned work:
- Tightened `src/app/useConnectorRenderer.ts` with `CanvasPerformanceProfile`, `CanvasPoint`, and explicit `UseConnectorRendererResult`.
- Confirmed `App.tsx` remains at 10395 lines and only consumes the hook output.
- Kept connector snapshot builder, commit, scheduler, and position resolvers internal to the hook.
- Updated the stale capability-layout source contract to match the committed Airtable toggle primitive after `test:unit` exposed the mismatch.

Changed files:
- `src/app/useConnectorRenderer.ts`
- `tests/unit/api-settings-capability-layout-regression.test.ts`
- `status.md`

Validation passed:
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-connector-throttling-contract.test.ts tests/unit/canvas-local-performance-trace-contract.test.ts tests/unit/canvas-live-scene-contract.test.ts`
- `npm.cmd run typecheck`
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/api-settings-capability-layout-regression.test.ts tests/unit/airtable-global-ui-refit-contract.test.ts`
- `npm.cmd run test:unit` (`971` tests passed)
- `npm.cmd run build`
- `npm.cmd run check:encoding`

### Milestone 3: Prompt Group Layout Extraction

Status: complete. First live-scene slice committed as `8d0f80e3 refactor: extract prompt group live scene layout`; second layout-runtime slice committed as `023fe7c3 refactor: extract prompt group layout runtime`; third presentation-state slice committed as `c8e6ca9f refactor: extract prompt group presentation state`; fourth child-map slice committed as `1944deb4 refactor: derive prompt group child maps in hook`; fifth live-position helper slice committed as `e74eafe9 refactor: extract prompt group live drag helpers`; sixth focus/height handler slice committed as `28386927 refactor: extract prompt group focus handlers`; seventh auto-repair slice committed as `ec0f1a60 refactor: move prompt layout auto repair into hook`; eighth live-position-change handler slice committed as `827b7310 refactor: extract prompt group live position handler`; ninth regroup predicate slice committed as `963aae4f refactor: move prompt regroup predicate into hook`; tenth drag-commit persistence slice committed as `476e2d8a refactor: extract prompt group drag commit persistence`; eleventh prompt-node edit handler slice committed as `c0760ab8 refactor: extract prompt group prompt edit handlers`; twelfth active-canvas lifecycle cleanup slice committed as `fc83ec3f refactor: move prompt group lifecycle cleanup into hook`; thirteenth stacking and expanded-selection slice committed as `172a8a11 refactor: extract prompt group stacking selection state`; fourteenth visible-derived-view and hidden legacy prompt-group cleanup slice committed as `a4a14bf2 refactor: prune prompt group legacy render branches`; fifteenth unused prompt-group return cleanup slice committed as `a8b4caab refactor: remove unused prompt group derived returns`; sixteenth legacy branch and selection-wrapper cleanup slice committed as `03cda6f1 refactor: prune prompt group legacy selection wiring`; seventeenth renderer dependency cleanup slice committed as `5a4287f1 refactor: tighten prompt group renderer deps`.

Scope completed in the first slice:
- Added `src/app/usePromptGroupLayout.ts` with explicit `UsePromptGroupLayoutDeps` and `UsePromptGroupLayoutResult`.
- Moved prompt-group live scene snapshot derivation and `liveSceneRef` synchronization out of `src/App.tsx`.
- Kept `App.tsx` as the hook orchestrator for this slice and left bounds/overlap/regroup behavior in place for later extraction.
- Updated the live-scene contract test to assert the prompt-group live-scene builder is owned by the new hook.

Scope completed in the second slice:
- Moved prompt-group regroup layout building, regroup-layout trace instrumentation, bounds calculation, stable bounds/views caches, overlap recomputation, visible prompt-group views, and live-scene frame synchronization into `src/app/usePromptGroupLayout.ts`.
- Kept prompt-group drag commit, begin/settle/clear presentation mutations, and render wiring in `src/App.tsx` for the next isolated slice.
- Updated source-contract tests so App remains responsible for orchestration while `usePromptGroupLayout.ts` owns regroup layouts, bounds, views, overlap freeze, and live sync.

Scope completed in the third slice:
- Moved prompt-group presentation state mutation helpers into `src/app/usePromptGroupLayout.ts`: `syncPromptGroupLayoutState`, `schedulePromptGroupRegroupAnimation`, `beginPromptGroupRegroup`, `settlePromptGroupRegroup`, and `clearPromptGroupRegroup`.
- Kept drag commit persistence, auto-repair, render wiring, and selection behavior in `src/App.tsx`.
- Added a failing source-contract test first, verified it failed, then migrated implementation and updated existing contract anchors.

Scope completed in the fourth slice:
- Moved prompt-group child image and node id map derivation into `src/app/usePromptGroupLayout.ts`: `actualChildImagesByPromptId`, `actualChildImageIdsByPromptId`, and `promptGroupNodeIdsById`.
- Kept callers in `src/App.tsx` unchanged by returning the derived maps from the hook.
- Added a source-contract test and verified its baseline assertion failed against the previous `HEAD` before implementation.

Scope completed in the fifth slice:
- Moved prompt-group live drag helper ownership into `src/app/usePromptGroupLayout.ts`: `resolvePromptGroupIdForNodeId`, `resolveCanvasNodePositionForLiveDrag`, and `applyLiveNodeDeltaToDraggedSet`.
- Injected `imageNodesById`, `workflowUtilityNodesById`, and `liveDerivedNodeIdsByOwnerRef` through `UsePromptGroupLayoutDeps` instead of reading `App.tsx` scope.
- Kept `handleLiveNodePositionChange`, drag commit persistence, auto-repair, render wiring, and selection behavior in `src/App.tsx`.
- Added a failing source-contract test first, verified it failed, then migrated implementation.

Scope completed in the sixth slice:
- Moved prompt-group focus and image-height handler ownership into `src/app/usePromptGroupLayout.ts`: `handleFocusPromptGroup` and `handleImageCardHeightChange`.
- Injected `selectNodes`, `setFocusedGroupId`, and `setImageCardHeightById` through `UsePromptGroupLayoutDeps`.
- Kept auto-repair, `handleLiveNodePositionChange`, drag commit persistence, render wiring, and selection behavior in `src/App.tsx`.
- Added a failing source-contract test first, verified it failed, then migrated implementation.

Scope completed in the seventh slice:
- Moved prompt-layout auto-repair ownership into `src/app/usePromptGroupLayout.ts`, including the repair-key ref, active-drag/manual-layout guards, drift detection, and `buildGeneratedImageBatchPositions` repair placement.
- Injected `updateImageNodePosition` through `UsePromptGroupLayoutDeps` instead of reading `App.tsx` scope.
- Kept `handleLiveNodePositionChange`, drag commit persistence, render wiring, and selection behavior in `src/App.tsx`.
- Added a failing source-contract test first, verified it failed, then migrated implementation and tightened the regroup-layout source slice boundary.

Scope completed in the eighth slice:
- Moved `handleLiveNodePositionChange` ownership into `src/app/usePromptGroupLayout.ts`.
- Injected `moveSelectedNodesImmediate` and `setLockedGroupBoundsById` through `UsePromptGroupLayoutDeps` so the hook owns live-position cleanup, derived-live cleanup, final queued-delta flush, and locked bounds updates.
- Kept drag commit persistence, render wiring, selection behavior, and broader canvas reset/focus lifecycle in `src/App.tsx`.
- Added a failing source-contract test first, verified it failed, then migrated implementation.

Scope completed in the ninth slice:
- Moved `shouldAutoRegroupPromptGroup` ownership into `src/app/usePromptGroupLayout.ts`.
- Injected `selectedNodeIds` through `UsePromptGroupLayoutDeps` and normalized it inside the hook before use.
- Kept `commitPromptGroupDrag`, drag handler wiring, render wiring, and selection behavior in `src/App.tsx`.
- Added a failing source-contract test first, verified it failed, then migrated implementation and updated the drag-layout regroup predicate contract to read the hook.

Scope completed in the tenth slice:
- Moved `commitPromptGroupDrag` ownership into `src/app/usePromptGroupLayout.ts`.
- Injected `updatePromptNode` through `UsePromptGroupLayoutDeps` so the hook owns final prompt position persistence, child image commit positions, and settle/clear routing.
- Kept drag handler wiring, render wiring, selection behavior, and broader canvas reset/focus lifecycle in `src/App.tsx`.
- Updated source-contract tests so commit persistence and settle-after-drop ownership are asserted in the hook instead of `App.tsx`.

Scope completed in the eleventh slice:
- Moved prompt-group prompt-node edit handler ownership into `src/app/usePromptGroupLayout.ts`: `handlePromptGroupNodeHeightChange` and `handlePromptGroupTagRemove`.
- Reused the hook-owned `currentPromptNodesById` map and injected `updatePromptNode` dependency for prompt height persistence and tag removal.
- Kept prompt-group node selection, drag handler wiring, render wiring, and broader canvas reset/focus lifecycle in `src/App.tsx`.
- Added a failing source-contract test first, verified it failed, then migrated implementation.

Scope completed in the twelfth slice:
- Moved prompt-group active-canvas lifecycle cleanup into `src/app/usePromptGroupLayout.ts`.
- Hook now owns image-card height reset on canvas switch, live/derived live reset when the canvas clears, prompt-group layout state reset, locked bounds clear, and focus cleanup for stale or empty selections.
- Kept prompt-group node selection, drag handler wiring, and render wiring in `src/App.tsx`.
- Added a failing source-contract test first, verified it failed, then migrated implementation.

Scope completed in the thirteenth slice:
- Extracted prompt-group stacking map derivation into `usePromptGroupStacking` in `src/app/usePromptGroupLayout.ts` while keeping the call before App stacking consumers that need the maps.
- Moved `expandedSelectedNodeIds` derivation into `usePromptGroupLayout.ts`, reusing hook-owned `actualChildImageIdsByPromptId` and normalized selected ids.
- Kept prompt-group node selection, drag handler wiring, and render wiring in `src/App.tsx`.
- Added source-contract coverage for the new hook-owned expanded selection and stacking boundaries, then completed the implementation.

Scope completed in the fourteenth slice:
- Moved visible prompt-group child-image and standalone-image derivations into `usePromptGroupLayout.ts`: `visibleChildImagesByPromptId` and `standaloneVisibleImageNodes`.
- Removed hidden `false && visiblePromptNodes.map(...)` and `false && standaloneVisibleImageNodes.map(...)` prompt-group render branches from `src/App.tsx`.
- Removed the now-unused `handleLegacyImageRelativeDrag` helper and its duplicate expanded-selection logic.
- Added source-contract tests so prompt-group visible-derived views, dead render branches, and duplicate expanded-selection logic cannot return to App.

Scope completed in the fifteenth slice:
- Removed unused prompt-group hook return fields from `UsePromptGroupLayoutResult`: `actualChildImagesByPromptId`, `visibleChildImagesByPromptId`, and `promptGroupViews`.
- Removed unused App-side `visibleImageNodesById` and `visibleImageNodeIds` memo caches.
- Tightened source-contract tests so App cannot keep stale prompt-group derived values it no longer consumes.

Scope completed in the sixteenth slice:
- Added `src/app/usePromptGroupSelection.ts` with explicit `UsePromptGroupSelectionDeps` and `UsePromptGroupSelectionResult`.
- Moved `handlePromptGroupNodeSelect` out of `src/App.tsx` so prompt-group selection focus wrapping is hook-owned.
- Removed the remaining hidden connector and group render branches from `src/App.tsx`.
- Removed `useConnectorRenderer` outputs and dependencies that only supported the deleted hidden connector branch.
- Tightened source-contract tests for the selection hook, hidden legacy branches, and connector dead outputs.

Scope completed in the seventeenth slice:
- Added a RED source-contract test that fails when `renderPromptGroupWorkflowItem` carries dependencies it does not read.
- Removed stale dependency-array entries from the prompt-group renderer callback without changing JSX or workflow behavior.
- Kept animation-forcing dependencies such as `nowTimestamp` and `promptGroupLayoutVersion` in place because they intentionally refresh ref-backed prompt-group render state.

Line count change during Milestone 3:
- `src/App.tsx`: `10395` baseline lines to `10333` lines after first slice.
- `src/App.tsx`: `10044` lines after second slice.
- `src/app/usePromptGroupLayout.ts`: `529` lines after second slice.
- `src/App.tsx`: `9882` lines after third slice.
- `src/app/usePromptGroupLayout.ts`: `699` lines after third slice.
- `src/App.tsx`: `9845` lines after fourth slice.
- `src/app/usePromptGroupLayout.ts`: `749` lines after fourth slice.
- `src/App.tsx`: `9761` lines after fifth slice.
- `src/app/usePromptGroupLayout.ts`: `879` lines after fifth slice.
- `src/App.tsx`: `9739` lines after sixth slice.
- `src/app/usePromptGroupLayout.ts`: `923` lines after sixth slice.
- `src/App.tsx`: `9675` lines after seventh slice.
- `src/app/usePromptGroupLayout.ts`: `994` lines after seventh slice.
- `src/App.tsx`: `9588` lines after eighth slice.
- `src/app/usePromptGroupLayout.ts`: `1095` lines after eighth slice.
- `src/App.tsx`: `9580` lines after ninth slice.
- `src/app/usePromptGroupLayout.ts`: `1114` lines after ninth slice.
- `src/App.tsx`: `9549` lines after tenth slice.
- `src/app/usePromptGroupLayout.ts`: `1165` lines after tenth slice.
- `src/App.tsx`: `9532` lines after eleventh slice.
- `src/app/usePromptGroupLayout.ts`: `1192` lines after eleventh slice.
- `src/App.tsx`: `9493` lines after twelfth slice.
- `src/app/usePromptGroupLayout.ts`: `1242` lines after twelfth slice.
- `src/App.tsx`: `9434` lines after thirteenth slice.
- `src/app/usePromptGroupLayout.ts`: `1343` lines after thirteenth slice.
- `src/App.tsx`: `9285` lines after fourteenth slice.
- `src/app/usePromptGroupLayout.ts`: `1369` lines after fourteenth slice.
- `src/App.tsx`: `9272` lines after fifteenth slice.
- `src/app/usePromptGroupLayout.ts`: `1349` lines after fifteenth slice.
- `src/App.tsx`: `9175` lines after sixteenth slice.
- `src/app/useConnectorRenderer.ts`: `253` lines after sixteenth slice.
- `src/app/usePromptGroupSelection.ts`: `25` lines after sixteenth slice.
- `src/App.tsx`: `9165` lines after seventeenth slice.
- `tests/unit/prompt-group-regroup-behavior.test.ts`: `515` lines after seventeenth slice.

Validation passed:
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-connector-throttling-contract.test.ts`
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-connector-throttling-contract.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/prompt-group-regroup-layout.test.ts tests/unit/canvas-local-performance-trace-contract.test.ts`
- `npm.cmd run typecheck`
- `npm.cmd run test:unit` (`971` tests passed)
- `npm.cmd run build`
- `npm.cmd run check:encoding`
- Third slice RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed as expected before implementation because `usePromptGroupLayout.ts` did not own presentation state mutation helpers.
- Third slice targeted tests: prompt-group/live-scene/performance/connector/layout tests passed, `42` tests.
- Fourth slice RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed as expected before implementation because `usePromptGroupLayout.ts` did not own prompt-group child maps.
- Fourth slice targeted tests: prompt-group/live-scene/performance/connector/layout tests passed, `43` tests.
- Fifth slice RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed as expected before implementation because `usePromptGroupLayout.ts` did not own prompt-group live drag position helpers.
- Fifth slice targeted tests: prompt-group/live-scene/performance/connector/layout tests passed, `44` tests.
- Fifth slice `npm.cmd run typecheck`: passed.
- Fifth slice `npm.cmd run test:unit`: passed, `974` tests.
- Fifth slice `npm.cmd run build`: passed.
- Sixth slice RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed as expected before implementation because `usePromptGroupLayout.ts` did not own prompt-group focus and height handlers.
- Sixth slice targeted tests: prompt-group/live-scene/performance/connector/layout tests passed, `45` tests.
- Sixth slice `npm.cmd run typecheck`: passed.
- Sixth slice `npm.cmd run test:unit`: passed, `975` tests.
- Sixth slice `npm.cmd run build`: passed.
- Sixth slice `npm.cmd run governance:agent-docs`: passed after status update.
- Sixth slice `npm.cmd run check:encoding`: passed after status update.
- Sixth slice `git diff --check`: passed with LF/CRLF working-copy warnings only.
- Seventh slice RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed as expected before implementation because `usePromptGroupLayout.ts` did not own prompt-layout auto-repair.
- Seventh slice targeted tests: prompt-group/live-scene/performance/connector/layout tests passed, `46` tests.
- Seventh slice `npm.cmd run typecheck`: passed.
- Seventh slice `npm.cmd run test:unit`: passed, `976` tests.
- Seventh slice `npm.cmd run build`: passed.
- Seventh slice `npm.cmd run governance:agent-docs`: passed after status update.
- Seventh slice `npm.cmd run check:encoding`: passed after status update.
- Seventh slice `git diff --check`: passed with LF/CRLF working-copy warnings only.
- Eighth slice source contract: `tests/unit/prompt-group-regroup-behavior.test.ts` now asserts `usePromptGroupLayout.ts` owns `handleLiveNodePositionChange` and `App.tsx` no longer defines it.
- Eighth slice targeted tests: prompt-group/live-scene/performance/connector/layout tests passed, `47` tests.
- Eighth slice `npm.cmd run typecheck`: passed.
- Eighth slice `npm.cmd run test:unit`: passed, `978` tests.
- Eighth slice `npm.cmd run build`: passed.
- Eighth slice `npm.cmd run governance:agent-docs`: passed after status update.
- Eighth slice `npm.cmd run check:encoding`: passed after status update.
- Eighth slice `git diff --check`: passed with LF/CRLF working-copy warnings only.
- Ninth slice RED: prompt-group source-contract tests failed before implementation because `usePromptGroupLayout.ts` did not own `shouldAutoRegroupPromptGroup`.
- Ninth slice targeted tests: prompt-group/live-scene/performance/connector/layout tests passed, `48` tests.
- Ninth slice `npm.cmd run typecheck`: passed.
- Ninth slice `npm.cmd run test:unit`: passed, `978` tests.
- Ninth slice `npm.cmd run build`: passed.
- Ninth slice `npm.cmd run governance:agent-docs`: passed after status update.
- Ninth slice `npm.cmd run check:encoding`: passed after status update.
- Ninth slice `git diff --check`: passed with LF/CRLF working-copy warnings only.
- Tenth slice RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed before final implementation because the settle-after-drop source contract still expected `App.tsx` ownership after commit persistence moved.
- Tenth slice targeted tests: prompt-group/live-scene/performance/connector/layout tests passed, `49` tests.
- Tenth slice `npm.cmd run typecheck`: passed.
- Tenth slice `npm.cmd run test:unit`: passed, `979` tests.
- Tenth slice `npm.cmd run build`: passed.
- Tenth slice `npm.cmd run governance:agent-docs`: passed after status update.
- Tenth slice `npm.cmd run check:encoding`: passed after status update.
- Tenth slice `git diff --check`: passed with LF/CRLF working-copy warnings only.
- Eleventh slice RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed before implementation because `usePromptGroupLayout.ts` did not own prompt-group prompt-node edit handlers.
- Eleventh slice targeted tests: prompt-group/live-scene/performance/connector/layout tests passed, `50` tests.
- Eleventh slice `npm.cmd run typecheck`: passed.
- Eleventh slice `npm.cmd run test:unit`: passed, `980` tests.
- Eleventh slice `npm.cmd run build`: passed.
- Eleventh slice `npm.cmd run governance:agent-docs`: passed after status update.
- Eleventh slice `npm.cmd run check:encoding`: passed after status update.
- Eleventh slice `git diff --check`: passed with LF/CRLF working-copy warnings only.
- Twelfth slice RED baseline proof: source-contract assertion against previous `HEAD:src/app/usePromptGroupLayout.ts` failed because the hook did not own prompt-group active-canvas lifecycle cleanup.
- Twelfth slice targeted tests: prompt-group/live-scene/performance/connector/layout tests passed, `51` tests.
- Twelfth slice `npm.cmd run typecheck`: passed.
- Twelfth slice `npm.cmd run test:unit`: passed, `981` tests.
- Twelfth slice `npm.cmd run build`: passed.
- Twelfth slice `npm.cmd run governance:agent-docs`: passed after status update.
- Twelfth slice `npm.cmd run check:encoding`: passed after status update.
- Twelfth slice `git diff --check`: passed with LF/CRLF working-copy warnings only.
- Thirteenth slice RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed before final implementation because expanded selection still lived in `App.tsx` and the stacking-map hook boundary was not fully integrated.
- Thirteenth slice targeted tests: prompt-group/live-scene/performance/connector/layout tests passed, `53` tests.
- Thirteenth slice `npm.cmd run typecheck`: passed after preserving early App stacking-map availability via `usePromptGroupStacking`.
- Thirteenth slice `npm.cmd run test:unit`: passed, `983` tests.
- Thirteenth slice `npm.cmd run build`: passed.
- Thirteenth slice `npm.cmd run governance:agent-docs`: passed after status update.
- Thirteenth slice `npm.cmd run check:encoding`: passed after status update.
- Thirteenth slice `git diff --check`: passed with LF/CRLF working-copy warnings only.
- Fourteenth slice RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed before cleanup because App still contained visible derived prompt-group view logic, hidden legacy prompt-group render branches, and `handleLegacyImageRelativeDrag`.
- Fourteenth slice targeted tests: prompt-group/live-scene/performance/connector/layout tests passed, `55` tests.
- Fourteenth slice `npm.cmd run typecheck`: passed.
- Fourteenth slice `npm.cmd run test:unit`: passed, `985` tests.
- Fourteenth slice `npm.cmd run build`: passed.
- Fourteenth slice `npm.cmd run governance:agent-docs`: passed after status update.
- Fourteenth slice `npm.cmd run check:encoding`: passed after status update.
- Fourteenth slice `git diff --check`: passed with LF/CRLF working-copy warnings only.
- Fifteenth slice source contract: prompt-group tests now assert App and `usePromptGroupLayout.ts` no longer expose unused visible/child prompt-group derived values.
- Fifteenth slice targeted tests: prompt-group/live-scene/performance/connector/layout tests passed, `61` tests.
- Fifteenth slice `npm.cmd run typecheck`: passed.
- Fifteenth slice `npm.cmd run test:unit`: passed, `985` tests.
- Fifteenth slice `npm.cmd run build`: passed.
- Fifteenth slice `npm.cmd run governance:agent-docs`: passed after status update.
- Fifteenth slice `npm.cmd run check:encoding`: passed after status update.
- Fifteenth slice `git diff --check`: passed with LF/CRLF working-copy warnings only.
- Sixteenth slice RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed before cleanup because App still contained hidden connector/group `false &&` render branches.
- Sixteenth slice source contract: prompt-group tests assert App no longer contains hidden connector/group branches, `useConnectorRenderer.ts` no longer exposes connector child-image maps for those branches, and `usePromptGroupSelection.ts` owns the prompt-group node selection wrapper.
- Sixteenth slice targeted tests: prompt-group/live-scene/performance/connector targeted tests passed, `47` tests.
- Sixteenth slice `npm.cmd run typecheck`: passed.
- Sixteenth slice `npm.cmd run test:unit`: passed, `986` tests.
- Sixteenth slice `npm.cmd run build`: passed.
- Sixteenth slice `npm.cmd run governance:agent-docs`: passed after status update.
- Sixteenth slice `npm.cmd run check:encoding`: passed after status update.
- Sixteenth slice `git diff --check`: passed with LF/CRLF working-copy warnings only.
- Seventeenth slice RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed before cleanup because `renderPromptGroupWorkflowItem` still listed stale dependencies such as `deleteImageNode`.
- Seventeenth slice source contract: prompt-group tests assert the renderer callback dependency array excludes values that are not read by the renderer body.
- Seventeenth slice targeted tests: prompt-group/live-scene/performance/connector/layout targeted tests passed, `57` tests.
- Seventeenth slice `npm.cmd run typecheck`: passed.
- Seventeenth slice `npm.cmd run test:unit`: passed, `987` tests.
- Seventeenth slice `npm.cmd run build`: passed.
- Seventeenth slice `npm.cmd run governance:agent-docs`: passed after status update.
- Seventeenth slice `npm.cmd run check:encoding`: passed after status update.
- Seventeenth slice `git diff --check`: passed with LF/CRLF working-copy warnings only.

Validation not used as a commit gate:
- `npm.cmd run verify:prompt-group-drag`: failed in the local browser path because `http://127.0.0.1:3000` opened the auth/login screen and `[data-canvas-surface="prompt"]` never became visible within 30s. This is recorded as an environment/auth precondition issue for this browser smoke, not a unit/type/build regression.

Current risk:
- Milestone 3 stops before extracting the remaining prompt-group render wiring because it is JSX-heavy and tied to shared action props, selection, live scene, and workflow registry behavior.
- Milestone 4 must start with a narrow generation runtime source-contract test before moving code; generation touches billing, PPT, ecommerce, retry, cancellation, partial redraw, and provider routing.
- The source-contract tests cover ownership boundaries, but the browser drag smoke is still blocked by a local auth/login precondition and should not be treated as behavioral proof until a valid session fixture exists.
- Auto-repair, live-position change handling, regroup predicate checks, drag commit persistence, prompt-node edit handlers, active-canvas lifecycle cleanup, expanded selection, standalone visible image derivation, prompt-group stacking derivation, and prompt-group node selection now live in prompt-group hooks; hidden legacy prompt-group render branches, hidden connector/group branches, unused prompt-group return values, connector dead outputs, and stale prompt-group renderer dependencies have been removed. Future slices should keep prompt-group changes narrow because remaining wiring still crosses active render and drag behavior.

Review checkpoint after seventeenth slice:
- `src/App.tsx` now remains at `9165` lines, `src/app/usePromptGroupLayout.ts` at `1349` lines, `src/app/useConnectorRenderer.ts` at `253` lines, and `src/app/usePromptGroupSelection.ts` at `25` lines.
- Confirmed `buildConnectorRenderSnapshot`, connector snapshot commit/schedule helpers, and connector position resolvers remain owned by `src/app/useConnectorRenderer.ts`.
- Confirmed `buildPromptGroupRegroupLayouts`, presentation-state mutation helpers, stable bounds/views caches, live-scene derivation, and child maps remain owned by `src/app/usePromptGroupLayout.ts`.
- Confirmed `App.tsx` still owns render wiring and broader canvas reset/focus lifecycle.

Next step:
- Start Milestone 4 with a RED source-contract test for the first safe generation runtime boundary.
- Candidate first slice: audit existing generation helpers and `src/hooks/useImageGeneration.ts`, then extract only orchestration glue that is not PPT/ecommerce-specific.

### Milestone 4: Generation Runtime

Status: in progress. Nineteen narrow generation-runtime slices are extracted and validated, through retry generation task prompt context ownership.

First slice scope:
- Added `tests/unit/generation-runtime-contract.test.ts` and verified RED before implementation because the new generation runtime hook boundary did not exist.
- Added `src/app/useGenerationRuntime.ts` with explicit `UseGenerationRuntimeDeps` and `UseGenerationRuntimeResult`.
- Moved `handleCancelGeneration` out of `src/App.tsx`, including per-node cancellation, global generating-node cancellation, system proxy cancellation, and cancelled-node patching.
- Added `src/app/useGenerationSubmitGuard.ts` with explicit `UseGenerationSubmitGuardDeps` and `UseGenerationSubmitGuardResult`.
- Moved generation submit cooldown, duplicate-signature detection, submit signature construction, and duplicate-send warning out of `src/App.tsx`.
- Kept billing, retry execution, PPT, ecommerce confirmation, partial redraw, provider routing, and actual `executeGeneration` orchestration in `src/App.tsx` for later narrower slices.

Line count change during Milestone 4 first slice:
- `src/App.tsx`: `9165` lines at previous `HEAD` -> `9101` lines.
- `src/app/useGenerationRuntime.ts`: new, `73` lines.
- `src/app/useGenerationSubmitGuard.ts`: new, `96` lines.
- `tests/unit/generation-runtime-contract.test.ts`: new, `67` lines.

Validation passed:
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-billing-coordinator.test.ts tests/unit/billing-remaining-balance-contract.test.ts`: passed, `13` tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:unit`: passed, `989` tests.
- `npm.cmd run build`: passed.
- `npm.cmd run check:encoding`: passed.

Current risk:
- The submit guard intentionally treats ecommerce mode as an allowed early branch before empty-prompt rejection, matching previous `handleGenerate` behavior.
- `App.tsx` still owns the billing and execution path; the next slice should avoid moving billing/PPT/ecommerce logic together.

Second slice scope:
- Extended `src/app/useGenerationRuntime.ts` with generation credit helper ownership: `ensureCreditAttemptCharged`, `resolveFailedCreditAttempt`, and `applyOptimisticServerCreditDebit`.
- Injected billing/auth dependencies through `UseGenerationRuntimeDeps` instead of reading `App.tsx` scope.
- Updated generation billing source contracts so attempt id/idempotency and failure-state assertions follow the new hook boundary.
- Kept billing protocol, `BillingContext`, `generationBillingCoordinator`, storage, retry body, PPT body, ecommerce body, and provider routing behavior unchanged.

Line count change during Milestone 4 second slice:
- `src/App.tsx`: `9101` lines after first slice -> `9012` lines.
- `src/app/useGenerationRuntime.ts`: `73` lines -> `236` lines.
- `tests/unit/generation-runtime-contract.test.ts`: `67` lines -> `93` lines.

Validation passed:
- RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because billing helper ownership was still in `App.tsx`.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-billing-coordinator.test.ts tests/unit/billing-remaining-balance-contract.test.ts`: passed, `14` tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:unit`: passed, `990` tests.
- `npm.cmd run build`: passed.
- `npm.cmd run check:encoding`: passed.
- `npm.cmd run governance:agent-docs`: passed.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

Current risk:
- The runtime hook now receives a broad billing/auth dependency set; the next extraction should not add PPT/ecommerce-specific dependencies to the same hook unless they are truly shared generation runtime concerns.
- `App.tsx` still owns the large `handleGenerate`, `handleRetryNode`, and PPT retry bodies; the next safe slice should isolate a pure/shared helper rather than moving the whole execution body.

Third slice scope:
- Added hook-owned `prepareInitialCreditSettlement` with explicit `PrepareInitialCreditSettlementParams` and `PrepareInitialCreditSettlementResult`.
- Moved the initial `handleGenerate` credit auth/loading/balance/client-precharge branch into `src/app/useGenerationRuntime.ts`.
- Preserved the previous notification copy and early-return order for managed credit models.
- Kept generation billing-state resolution, route selection, prompt node construction, persistence, and `executeGeneration` in `App.tsx`.

Line count change during Milestone 4 third slice:
- `src/App.tsx`: `9012` lines after second slice -> `8981` lines.
- `src/app/useGenerationRuntime.ts`: `236` lines -> `312` lines.
- `tests/unit/generation-runtime-contract.test.ts`: `93` lines -> `111` lines.

Validation passed:
- RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because initial credit settlement still lived in `App.tsx`.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-billing-coordinator.test.ts tests/unit/billing-remaining-balance-contract.test.ts`: passed, `15` tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:unit`: passed, `991` tests.
- `npm.cmd run build`: passed.
- `npm.cmd run check:encoding`: passed.
- `npm.cmd run governance:agent-docs`: passed.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

Current risk:
- `prepareInitialCreditSettlement` intentionally calls `ensureCreditAttemptCharged` after preserving the existing pre-checks, so the helper still shares the canonical debit/idempotency path.
- The next slice should avoid combining retry result persistence, PPT retry, and initial generation persistence in one change.

Fourth slice scope:
- Added hook-owned `prepareGenerationDraftContext` with explicit `PrepareGenerationDraftContextArgs` and `PrepareGenerationDraftContextResult`.
- Moved follow-up detection, existing draft lookup, reusable draft detection, and new prompt node id creation out of `src/App.tsx`.
- Preserved reusable follow-up draft behavior by reading `activeCanvasRef.current?.promptNodes` through an injected method argument, not through hidden hook scope.
- Kept prompt placement, billing, prompt node construction, persistence, retry, PPT, ecommerce, and execution behavior in `App.tsx`.

Line count change during Milestone 4 fourth slice:
- `src/App.tsx`: `8981` lines after third slice -> `8982` lines.
- `src/app/useGenerationRuntime.ts`: `312` lines -> `357` lines.
- `tests/unit/generation-runtime-contract.test.ts`: `111` lines -> `133` lines.

Validation passed:
- RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because draft-context ownership still lived in `App.tsx`.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-billing-coordinator.test.ts tests/unit/billing-remaining-balance-contract.test.ts`: passed, `16` tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:unit`: passed, `992` tests.
- `npm.cmd run build`: passed.
- `npm.cmd run check:encoding`: passed after status update.
- `npm.cmd run governance:agent-docs`: passed after status update.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

Current risk:
- `prepareGenerationDraftContext` still accepts `activeCanvasRef` from `App.tsx` because this slice preserves the existing async fresh-state access pattern; a later broader runtime extraction can revisit that dependency once prompt persistence is moved.
- The next slice should target another narrow shared generation boundary without touching PPT/ecommerce execution bodies.

Fifth slice scope:
- Added hook-owned `prepareInitialBillingAttemptContext` with explicit `PrepareInitialBillingAttemptContextParams` and `PrepareInitialBillingAttemptContextResult`.
- Moved initial credit-route snapshot lookup, billing attempt construction, execution lane extraction, and server-side settlement flag extraction into `src/app/useGenerationRuntime.ts`.
- Updated generation billing and credit-route source contracts so `buildGenerationBillingAttempt` and execution-lane ownership follow the new hook boundary.
- Kept selected-key resolution, billing-state resolution, prompt node construction, persistence, retry, PPT, ecommerce, and execution behavior in `App.tsx`.

Line count change during Milestone 4 fifth slice:
- `src/App.tsx`: `8982` lines after fourth slice -> `8981` lines.
- `src/app/useGenerationRuntime.ts`: `357` lines -> `403` lines.
- `tests/unit/generation-runtime-contract.test.ts`: `133` lines -> `155` lines.
- `tests/unit/generation-billing-runtime-contract.test.ts`: `63` lines -> `64` lines.
- `tests/unit/generation-billing-coordinator.test.ts`: unchanged at `115` lines.
- `tests/unit/credit-route-classification.test.ts`: unchanged at `78` lines.

Validation passed:
- RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because initial billing attempt context ownership still lived in `App.tsx`.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-billing-coordinator.test.ts tests/unit/billing-remaining-balance-contract.test.ts`: passed, `17` tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:unit`: passed, `993` tests.
- `npm.cmd run build`: passed.
- `npm.cmd run check:encoding`: passed after status update.
- `npm.cmd run governance:agent-docs`: passed after status update.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

Current risk:
- `prepareInitialBillingAttemptContext` intentionally calls `adminModelService.getCreditRouteSnapshot` from the generation runtime hook; this is a shared generation billing concern, but later slices should avoid pulling unrelated model/provider UI logic into the same hook.
- The next slice should avoid moving the full `handleGenerate` body; a pure prompt-node assembly helper is still the safer boundary.

Sixth slice scope:
- Added hook-owned `prepareGenerationBillingStateContext` with explicit `PrepareGenerationBillingStateContextParams` and `PrepareGenerationBillingStateContextResult`.
- Moved generation billing customization lookup, preferred billing key resolution, selected billing key lookup, `resolveGenerationBillingState`, and the billing debug log into `src/app/useGenerationRuntime.ts`.
- Updated route-aware billing and credit-route source contracts so key selection and billing-state ownership follow the new hook boundary.
- Kept prompt draft handling, billing attempt context, prompt node construction, persistence, retry, PPT, ecommerce, and execution behavior unchanged.

Line count change during Milestone 4 sixth slice:
- `src/App.tsx`: `8981` lines after fifth slice -> `8961` lines.
- `src/app/useGenerationRuntime.ts`: `403` lines -> `457` lines.
- `tests/unit/generation-runtime-contract.test.ts`: `155` lines -> `175` lines.
- `tests/unit/credit-route-classification.test.ts`: `78` lines -> `79` lines.
- `tests/unit/route-aware-credit-billing.test.ts`: `34` lines -> `39` lines.

Validation passed:
- RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because generation billing state context still lived in `App.tsx`.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-billing-coordinator.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/route-aware-credit-billing.test.ts tests/unit/credit-route-classification.test.ts`: passed, `21` tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:unit`: passed, `994` tests.
- `npm.cmd run build`: passed.
- `npm.cmd run check:encoding`: passed after status update.
- `npm.cmd run governance:agent-docs`: passed after status update.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

Current risk:
- `prepareGenerationBillingStateContext` reads `localStorage` inside the hook to preserve the existing customization lookup; future hardening can inject a storage adapter if this runtime becomes easier to unit test directly.
- The next safe boundary remains initial prompt-node assembly or failure patch preparation; do not merge PPT/ecommerce extraction into generation runtime.

Seventh slice scope:
- Added hook-owned `prepareInitialGeneratingPromptNode` with explicit `PrepareInitialGeneratingPromptNodeParams` and `PrepareInitialGeneratingPromptNodeResult`.
- Moved initial `resolveGenerationPreviewState` and `buildGeneratingPromptNode` assembly out of `src/App.tsx` and into `src/app/useGenerationRuntime.ts`.
- Updated billing coordinator, billing runtime, and credit-route contracts so prompt-node billing markers are asserted at the new hook boundary.
- Kept prompt optimization, generation reference preparation, prompt-node persistence, optimistic debit, execution, retry, PPT, and ecommerce bodies in `App.tsx`.

Line count change during Milestone 4 seventh slice:
- `src/App.tsx`: `8961` lines after sixth slice -> `8943` lines.
- `src/app/useGenerationRuntime.ts`: `457` lines -> `529` lines.
- `tests/unit/generation-runtime-contract.test.ts`: `175` lines -> `194` lines.
- `tests/unit/generation-billing-runtime-contract.test.ts`: unchanged at `64` lines.
- `tests/unit/generation-billing-coordinator.test.ts`: unchanged at `115` lines.
- `tests/unit/credit-route-classification.test.ts`: unchanged at `79` lines.

Validation passed:
- RED baseline proof: source-contract checks against `HEAD` showed `useGenerationRuntime.ts` did not own `prepareInitialGeneratingPromptNode`, while `App.tsx` still owned `resolveGenerationPreviewState` and `buildGeneratingPromptNode`.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-billing-coordinator.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/credit-route-classification.test.ts tests/unit/route-aware-credit-billing.test.ts`: passed, `22` tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:unit`: passed, `995` tests.
- `npm.cmd run build`: passed.
- `npm.cmd run check:encoding`: passed after status update.
- `npm.cmd run governance:agent-docs`: passed after status update.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

Current risk:
- `prepareInitialGeneratingPromptNode` has a deliberately wide params surface because it preserves existing prompt-node metadata exactly; do not expand it into persistence or execution until those boundaries have separate contracts.
- The next safe slice should target prompt-node persistence wrapping or initial post-persist cleanup, not retry/PPT/ecommerce bodies.

Eighth slice scope:
- Added hook-owned `persistInitialGeneratingPromptNode` with explicit `PersistInitialGeneratingPromptNodeParams` and `PersistInitialGeneratingPromptNodeResult`.
- Moved the initial `persistGeneratingPromptNode` call and its `updatePromptNode` closure dependency from `src/App.tsx` into `src/app/useGenerationRuntime.ts`.
- Kept prompt optimization, prompt-node assembly, post-persist draft cleanup, optimistic debit, execution, retry, PPT, and ecommerce bodies unchanged.
- Tightened the wrapper `getCanvas` contract to return `undefined` instead of `null`, matching the underlying persistence helper.

Line count change during Milestone 4 eighth slice:
- `src/App.tsx`: `8943` lines after seventh slice -> `8943` lines.
- `src/app/useGenerationRuntime.ts`: `529` lines -> `565` lines.
- `tests/unit/generation-runtime-contract.test.ts`: `194` lines -> `213` lines.

Validation passed:
- RED baseline proof: source-contract checks against `HEAD` showed `useGenerationRuntime.ts` did not own `persistInitialGeneratingPromptNode`, while `App.tsx` still imported and called `persistGeneratingPromptNode` directly.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-billing-coordinator.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/route-aware-credit-billing.test.ts tests/unit/credit-route-classification.test.ts`: passed, `23` tests.
- `npm.cmd run typecheck`: passed after tightening the persistence wrapper `getCanvas` return type.
- `npm.cmd run test:unit`: passed, `996` tests.
- `npm.cmd run build`: passed.
- `npm.cmd run check:encoding`: passed after status update.
- `npm.cmd run governance:agent-docs`: passed after status update.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

Current risk:
- `persistInitialGeneratingPromptNode` intentionally closes over `updatePromptNode` from hook deps while keeping other canvas mutation callbacks as call params; this preserves current behavior but should not be expanded into execution or retry logic without a separate contract.
- The next safe slice should target prompt optimization wrapping or initial post-persist cleanup, not PPT/ecommerce bodies.

Ninth slice scope:
- Added hook-owned `prepareInitialGenerationPromptOptimization` with explicit `PrepareInitialGenerationPromptOptimizationParams` and `PrepareInitialGenerationPromptOptimizationResult`.
- Moved initial generation prompt optimization enablement, options assembly, model capability lookup, and fallback notification wiring into `src/app/useGenerationRuntime.ts`.
- Kept retry/ecommerce prompt optimization paths in `src/App.tsx`, because they use different context and should be split under separate contracts.
- Kept reference image preparation, prompt-node assembly, persistence, post-persist cleanup, optimistic debit, execution, retry, PPT, and ecommerce bodies unchanged.

Line count change during Milestone 4 ninth slice:
- `src/App.tsx`: `8942` lines after eighth slice -> `8925` lines.
- `src/app/useGenerationRuntime.ts`: `564` lines -> `604` lines.
- `tests/unit/generation-runtime-contract.test.ts`: `212` lines -> `230` lines.

Validation passed:
- RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `prepareInitialGenerationPromptOptimization`, while `App.tsx` still owned initial optimization enablement and `getModelCapabilities(config.model)`.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-billing-coordinator.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/route-aware-credit-billing.test.ts tests/unit/credit-route-classification.test.ts`: passed, `24` tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:unit`: passed, `997` tests.
- `npm.cmd run build`: passed.
- `npm.cmd run check:encoding`: passed after status update.
- `npm.cmd run governance:agent-docs`: passed after status update.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

Current risk:
- `prepareInitialGenerationPromptOptimization` imports `GenerationMode` and `getModelCapabilities` into the runtime hook for the initial path only; retry/ecommerce optimization should remain separate until their own contract is added.
- The next safe slice should target initial post-persist cleanup or failure patch preparation, not PPT/ecommerce bodies.

Tenth slice scope:
- Added hook-owned `completeInitialGenerationPromptSubmission` with explicit `CompleteInitialGenerationPromptSubmissionParams`.
- Moved the initial generation success cleanup for `setDraftNodeId(null)`, prompt/reference reset, and active source image reset into `src/app/useGenerationRuntime.ts`.
- Kept other `setDraftNodeId(null)` call sites in `App.tsx` untouched because they belong to draft deletion, pinning, selection, and canvas-click flows.
- Kept optimistic debit, execution, retry, PPT, and ecommerce bodies unchanged.

Line count change during Milestone 4 tenth slice:
- `src/App.tsx`: `8925` lines after ninth slice -> `8928` lines.
- `src/app/useGenerationRuntime.ts`: `604` lines -> `618` lines.
- `tests/unit/generation-runtime-contract.test.ts`: `230` lines -> `250` lines.

Validation passed:
- RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `completeInitialGenerationPromptSubmission`, while `App.tsx` still had the initial post-persist cleanup block.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-billing-coordinator.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/route-aware-credit-billing.test.ts tests/unit/credit-route-classification.test.ts`: passed, `25` tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:unit`: passed, `998` tests.
- `npm.cmd run build`: passed.
- `npm.cmd run check:encoding`: passed after status update.
- `npm.cmd run governance:agent-docs`: passed after status update.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

Current risk:
- `completeInitialGenerationPromptSubmission` intentionally takes React state setters as call params so the runtime hook does not own broader prompt composer state. A later broader extraction can move this state only with separate UI contracts.
- The next safe slice should target failure patch preparation, retry-timeout cancellation, or another narrow shared generation runtime boundary, not PPT/ecommerce bodies.

Eleventh slice scope:
- Added hook-owned `commitRetryGenerationFailure` with explicit `CommitRetryGenerationFailureParams`.
- Moved retry failure billing-state resolution, failed prompt-node patching, error-detail extraction call site, and retry failure notification into `src/app/useGenerationRuntime.ts`.
- Kept retry success result alignment, cost recording, generated-image insertion, PPT retry, and ecommerce flows unchanged.
- Kept `resolveFailedCreditAttempt` exported from the hook because PPT retry still uses it.

Line count change during Milestone 4 eleventh slice:
- `src/App.tsx`: `8928` lines after tenth slice -> `8922` lines.
- `src/app/useGenerationRuntime.ts`: `618` lines -> `645` lines.
- `tests/unit/generation-runtime-contract.test.ts`: `250` lines -> `274` lines.

Validation passed:
- RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `commitRetryGenerationFailure`, while `App.tsx` still owned retry failure billing-state resolution and notification.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-billing-coordinator.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/route-aware-credit-billing.test.ts tests/unit/credit-route-classification.test.ts`: passed, `26` tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:unit`: passed, `999` tests.
- `npm.cmd run build`: passed.
- `npm.cmd run check:encoding`: passed after status update.
- `npm.cmd run governance:agent-docs`: passed after status update.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

Current risk:
- `commitRetryGenerationFailure` accepts `extractErrorDetails` as a callback, keeping App-specific error parsing outside the runtime hook. Do not move retry success result alignment in the same slice.
- The next safe slice should target retry-timeout cancellation, initial execution kickoff, or another narrow shared generation runtime boundary, not PPT/ecommerce bodies.

Twelfth slice scope:
- Added hook-owned `executeInitialGenerationPromptNode` with explicit `ExecuteInitialGenerationPromptNodeParams`.
- Moved the initial generation post-persistence execution kickoff into `src/app/useGenerationRuntime.ts`: optimistic server-side credit debit, then `executeGeneration`.
- Reused the hook-owned `applyOptimisticServerCreditDebit` internally while keeping it exported for retry and PPT retry flows.
- Kept catch/finally handling, retry success alignment, PPT, and ecommerce flows unchanged.

Line count change during Milestone 4 twelfth slice:
- `src/App.tsx`: `8922` lines after eleventh slice -> `8926` lines.
- `src/app/useGenerationRuntime.ts`: `645` lines -> `659` lines.
- `tests/unit/generation-runtime-contract.test.ts`: `274` lines -> `294` lines.

Validation passed:
- RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `executeInitialGenerationPromptNode`, while `App.tsx` still directly called `applyOptimisticServerCreditDebit` and `executeGeneration` in the initial path.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-billing-coordinator.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/route-aware-credit-billing.test.ts tests/unit/credit-route-classification.test.ts`: passed, `27` tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:unit`: passed, `1000` tests.
- `npm.cmd run build`: passed.
- `npm.cmd run check:encoding`: passed after status update.
- `npm.cmd run governance:agent-docs`: passed after status update.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

Current risk:
- `executeInitialGenerationPromptNode` intentionally takes `executeGeneration` as a call param so the hook does not yet own the full generation executor. Moving the executor itself needs a separate contract.
- The next safe slice should target retry-timeout cancellation, initial generation catch handling, or another narrow shared generation runtime boundary, not PPT/ecommerce bodies.

Thirteenth slice scope:
- Added hook-owned `reportInitialGenerationFailure` with explicit `ReportInitialGenerationFailureParams`.
- Moved the initial generation catch-path console logging, fallback message normalization, and failure notification into `src/app/useGenerationRuntime.ts`.
- Kept retry timeout handling, retry success alignment, PPT retry, and ecommerce flows unchanged.
- Kept the function synchronous because it mirrors the previous fire-and-forget notification behavior.

Line count change during Milestone 4 thirteenth slice:
- `src/App.tsx`: `8926` lines after twelfth slice -> `8924` lines.
- `src/app/useGenerationRuntime.ts`: `659` lines -> `673` lines.
- `tests/unit/generation-runtime-contract.test.ts`: `294` lines -> `313` lines.

Validation passed:
- RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `App.tsx` still owned the initial `handleGenerate` catch logging and notification.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-billing-coordinator.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/route-aware-credit-billing.test.ts tests/unit/credit-route-classification.test.ts`: passed, `28` tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:unit`: passed, `1001` tests.
- `npm.cmd run build`: passed.
- `npm.cmd run check:encoding`: passed after status update.
- `npm.cmd run governance:agent-docs`: passed after status update.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

Current risk:
- `reportInitialGenerationFailure` only owns the initial generation catch path. Retry, PPT, and ecommerce failure reporting remain separate until their own contracts are added.
- The next safe slice should target retry-timeout cancellation or another narrow shared generation runtime boundary, not PPT/ecommerce bodies.

Fourteenth slice scope:
- Added hook-owned `createRetryGenerationTimeoutGuard` with explicit `CreateRetryGenerationTimeoutGuardParams` and `CreateRetryGenerationTimeoutGuardResult`.
- Moved retry generation timeout cancellation and timeout prompt-node patching into `src/app/useGenerationRuntime.ts`.
- Replaced inline `setTimeout`, direct `cancelGeneration(requestId)`, and retry timeout patching in `App.tsx` with a guard object that exposes `markFinished` and `clear`.
- Kept retry request execution, retry success result alignment, cost recording, PPT retry, and ecommerce flows unchanged.

Line count change during Milestone 4 fourteenth slice:
- `src/App.tsx`: `8924` lines after thirteenth slice -> `8912` lines.
- `src/app/useGenerationRuntime.ts`: `673` lines -> `714` lines.
- `tests/unit/generation-runtime-contract.test.ts`: `313` lines -> `340` lines.

Validation passed:
- RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `createRetryGenerationTimeoutGuard`, while `App.tsx` still had inline retry timeout cancellation and patching.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-billing-coordinator.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/route-aware-credit-billing.test.ts tests/unit/credit-route-classification.test.ts`: passed, `29` tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:unit`: passed, `1002` tests.
- `npm.cmd run build`: passed.
- `npm.cmd run check:encoding`: passed after status update.
- `npm.cmd run governance:agent-docs`: passed after status update.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

Current risk:
- The timeout guard intentionally uses fire-and-forget `void updatePromptNode` to preserve the previous non-awaited timer behavior. Converting timer handling to awaited state transitions needs a separate behavior test.
- The next safe slice should target another retry micro-boundary or initial/retry result bookkeeping, not PPT/ecommerce bodies.

Fifteenth slice scope:
- Added hook-owned `commitRetryGenerationStart` with explicit `CommitRetryGenerationStartParams`.
- Moved retry start prompt-node patching and optimistic server-side credit debit into `src/app/useGenerationRuntime.ts`.
- Kept `resolveModelDisplayName` injected by parameter so the runtime hook does not import display utilities directly.
- Kept retry request execution, timeout guard, success result alignment, cost recording, PPT retry, and ecommerce flows unchanged.

Line count change during Milestone 4 fifteenth slice:
- `src/App.tsx`: `8912` lines after fourteenth slice -> `8904` lines.
- `src/app/useGenerationRuntime.ts`: `714` lines -> `738` lines.
- `tests/unit/generation-runtime-contract.test.ts`: `340` lines -> `367` lines.

Validation passed:
- RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `commitRetryGenerationStart`, while `App.tsx` still directly patched the retry node and applied optimistic debit.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-billing-coordinator.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/route-aware-credit-billing.test.ts tests/unit/credit-route-classification.test.ts`: passed, `30` tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:unit`: passed, `1003` tests.
- `npm.cmd run build`: passed.
- `npm.cmd run check:encoding`: passed after status update.
- `npm.cmd run governance:agent-docs`: passed after status update.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

Current risk:
- `commitRetryGenerationStart` still accepts display-name resolution from `App.tsx`. Moving model display normalization into runtime needs a separate dependency-boundary decision.
- The next safe slice should target retry recovery notification or another small retry bookkeeping boundary, not PPT/ecommerce bodies.

Sixteenth slice scope:
- Added hook-owned `reportRetryRecoveryResult` with explicit `ReportRetryRecoveryResultParams`.
- Moved retry recovery notification message selection and `notify.info('恢复历史结果', message)` into `src/app/useGenerationRuntime.ts`.
- Replaced inline retry recovery notification code in `App.tsx` with a single runtime call.
- Kept recovery detection, retry request execution, timeout guard, start commit, success result alignment, PPT retry, and ecommerce flows unchanged.

Line count change during Milestone 4 sixteenth slice:
- `src/App.tsx`: `8904` lines after fifteenth slice -> `8900` lines.
- `src/app/useGenerationRuntime.ts`: `738` lines -> `757` lines.
- `tests/unit/generation-runtime-contract.test.ts`: `367` lines -> `386` lines.

Validation passed:
- RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `reportRetryRecoveryResult`, while `App.tsx` still built and sent the retry recovery notification directly.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts`: passed, `17` tests.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-billing-coordinator.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/route-aware-credit-billing.test.ts tests/unit/credit-route-classification.test.ts`: passed, `31` tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:unit`: passed, `1004` tests.
- `npm.cmd run build`: passed.
- `npm.cmd run check:encoding`: passed after status update.
- `npm.cmd run governance:agent-docs`: passed after status update.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

Current risk:
- The previous test-only commit `4ebf35fc` introduced the retry recovery contract before the implementation landed in this working line; this slice closes that RED gap with the minimal runtime extraction.
- The next safe slice should target another small retry bookkeeping boundary, not PPT/ecommerce bodies.

Seventeenth slice scope:
- Added hook-owned `prepareRetryGenerationRequestContext` with explicit params/result interfaces.
- Moved retry `currentNodeId`, requested parallel count, and PPT count clamping into `src/app/useGenerationRuntime.ts`.
- Replaced the inline retry request-count block in `App.tsx` with a runtime context call.
- Kept retry recovery, billing preparation, start commit, timeout guard, request execution, success result alignment, PPT retry, and ecommerce flows unchanged.

Line count change during Milestone 4 seventeenth slice:
- `src/App.tsx`: `8900` lines after sixteenth slice -> `8902` lines.
- `src/app/useGenerationRuntime.ts`: `757` lines -> `777` lines.
- `tests/unit/generation-runtime-contract.test.ts`: `386` lines -> `407` lines.

Validation passed:
- RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `prepareRetryGenerationRequestContext`, while `App.tsx` still computed retry request ids/counts directly.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts`: passed, `18` tests.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-billing-coordinator.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/route-aware-credit-billing.test.ts tests/unit/credit-route-classification.test.ts`: passed, `32` tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:unit`: passed, `1005` tests.
- `npm.cmd run build`: passed.
- Browser inspection: skipped; this slice is a non-UI runtime refactor.
- `npm.cmd run check:encoding`: passed after status update.
- `npm.cmd run governance:agent-docs`: passed after status update.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

Current risk:
- `prepareRetryGenerationRequestContext` keeps PPT count clamping in runtime but does not yet own billing preparation or generated-result layout. Those remain separate future slices.
- The next safe slice should target retry success side effects or another small retry bookkeeping boundary, not PPT/ecommerce bodies.

Eighteenth slice scope:
- Added hook-owned `reportRetryGenerationSuccess` with explicit success params and debug-result types.
- Moved retry success cost recording and `notify.success('生成完成', '重新生成成功')` into `src/app/useGenerationRuntime.ts`.
- Replaced inline cost-service and notification imports in `App.tsx` with a single runtime side-effect call.
- Kept generated image result construction, layout alignment, `addImageNodes`, failure handling, PPT retry, and ecommerce flows unchanged.

Line count change during Milestone 4 eighteenth slice:
- `src/App.tsx`: `8902` lines after seventeenth slice -> `8884` lines.
- `src/app/useGenerationRuntime.ts`: `777` lines -> `816` lines.
- `tests/unit/generation-runtime-contract.test.ts`: `407` lines -> `428` lines.

Validation passed:
- RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `reportRetryGenerationSuccess`, while `App.tsx` still imported cost and notification services directly in the retry success path.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts`: passed, `19` tests.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-billing-coordinator.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/route-aware-credit-billing.test.ts tests/unit/credit-route-classification.test.ts`: passed, `33` tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:unit`: passed, `1006` tests.
- `npm.cmd run build`: passed.
- Browser inspection: skipped; this slice is a non-UI runtime refactor.
- `npm.cmd run check:encoding`: passed after status update.
- `npm.cmd run governance:agent-docs`: passed after status update.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

Current risk:
- Retry success result construction and layout alignment remain in `App.tsx`. Extracting them is larger and should be split behind separate contracts.
- The next safe slice should target retry request execution metadata or another narrow retry bookkeeping boundary, not PPT/ecommerce bodies.

Nineteenth slice scope:
- Added hook-owned `prepareRetryGenerationTaskPromptContext` with explicit params/result interfaces.
- Moved retry `currentMode` resolution and PPT page task-prompt construction into `src/app/useGenerationRuntime.ts`.
- Replaced inline PPT slide prompt selection, style directive selection, and fallback source prompt usage in `App.tsx` with a runtime context call.
- Kept image/video request execution, timeout guard, result construction, layout alignment, success/failure side effects, PPT retry, and ecommerce flows unchanged.

Line count change during Milestone 4 nineteenth slice:
- `src/App.tsx`: `8884` lines after eighteenth slice -> `8878` lines.
- `src/app/useGenerationRuntime.ts`: `816` lines -> `852` lines.
- `tests/unit/generation-runtime-contract.test.ts`: `428` lines -> `450` lines.

Validation passed:
- RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `prepareRetryGenerationTaskPromptContext`, while `App.tsx` still built retry task prompts directly.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts`: passed, `20` tests.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-billing-coordinator.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/route-aware-credit-billing.test.ts tests/unit/credit-route-classification.test.ts`: passed, `34` tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:unit`: passed, `1007` tests.
- `npm.cmd run build`: passed.
- Browser inspection: skipped; this slice is a non-UI runtime refactor.
- `npm.cmd run check:encoding`: passed after status update.
- `npm.cmd run governance:agent-docs`: passed after status update.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

Current risk:
- Request execution and result normalization still live in `App.tsx`; moving them needs smaller follow-up contracts because it touches provider-specific image/video fields.
- The next safe slice should target retry video request options or another narrow request-metadata helper, not result layout.

Next step:
- Continue M4 with the next RED source contract around retry video request options or another narrow request-metadata helper.

### Milestones 5-9

Status: pending. See `plans.md` for the full ordered list:
- `usePptRuntime`
- `useEcommerceRuntime`
- `CanvasContext.tsx` and `keyManager.ts` split
- global quality governance
- staged `apps/web/` migration

## Validation Log

- 2026-04-29 Milestone 1:
  - `npm.cmd run governance:agent-docs`: passed.
  - `npm.cmd run check:encoding`: passed.
- 2026-04-29 Milestone 2:
  - Connector/live-scene targeted tests: passed, 13 tests.
  - `npm.cmd run typecheck`: passed.
  - UI contract regression rerun: passed, 6 tests.
  - `npm.cmd run test:unit`: passed, 971 tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed.
- 2026-04-29 Milestone 3 first slice:
  - Prompt-group/live-scene targeted tests: passed.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, 971 tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-29 Milestone 3 second slice:
  - Prompt-group/live-scene/performance targeted tests: passed, 38 tests.
  - `tests/unit/prompt-group-regroup-layout.test.ts`: passed, 3 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, 971 tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed after final status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
  - `npm.cmd run verify:prompt-group-drag`: failed on local auth/login precondition, recorded outside the commit gate.
- 2026-04-29 Milestone 3 third slice:
  - RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed before implementation because `usePromptGroupLayout.ts` did not own presentation state mutation helpers.
  - Prompt-group/live-scene/performance targeted tests: passed, 42 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, 972 tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-29 Milestone 3 fourth slice:
  - RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed before implementation because `usePromptGroupLayout.ts` did not own prompt-group child maps.
  - Prompt-group/live-scene/performance targeted tests: passed, 43 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, 973 tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-29 Milestone 3 review checkpoint after fourth slice:
  - Prompt-group/live-scene/performance/connector targeted tests: passed, 43 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run governance:agent-docs`: passed after correcting stale status wording.
  - `npm.cmd run check:encoding`: passed after correcting stale status wording.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-29 Milestone 3 fifth slice:
  - RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed before implementation because `usePromptGroupLayout.ts` did not own prompt-group live drag position helpers.
  - Prompt-group/live-scene/performance/connector targeted tests: passed, 44 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, 974 tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `npm.cmd run check:encoding`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-29 Milestone 3 sixth slice:
  - RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed before implementation because `usePromptGroupLayout.ts` did not own prompt-group focus and height handlers.
  - Prompt-group/live-scene/performance/connector targeted tests: passed, 45 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, 975 tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `npm.cmd run check:encoding`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-29 Milestone 3 seventh slice:
  - RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed before implementation because `usePromptGroupLayout.ts` did not own prompt-layout auto-repair.
  - Prompt-group/live-scene/performance/connector targeted tests: passed, 46 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, 976 tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `npm.cmd run check:encoding`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-29 Milestone 3 eighth slice:
  - Source contract: `tests/unit/prompt-group-regroup-behavior.test.ts` asserts `usePromptGroupLayout.ts` owns `handleLiveNodePositionChange` and `App.tsx` no longer defines it.
  - Prompt-group/live-scene/performance/connector/layout targeted tests: passed, 63 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, 978 tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `npm.cmd run check:encoding`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-29 Milestone 3 ninth slice:
  - Source contract: prompt-group tests assert `usePromptGroupLayout.ts` owns `shouldAutoRegroupPromptGroup` and `App.tsx` no longer defines it.
  - Prompt-group/live-scene/performance/connector targeted tests: passed, 48 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, 978 tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `npm.cmd run check:encoding`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-29 Milestone 3 tenth slice:
  - RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed before final implementation because the settle-after-drop source contract still expected `App.tsx` ownership after commit persistence moved.
  - Prompt-group/live-scene/performance/connector targeted tests: passed, 49 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, 979 tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `npm.cmd run check:encoding`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-29 Milestone 3 eleventh slice:
  - RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed before implementation because `usePromptGroupLayout.ts` did not own prompt-group prompt-node edit handlers.
  - Prompt-group/live-scene/performance/connector targeted tests: passed, 50 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, 980 tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `npm.cmd run check:encoding`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-29 Milestone 3 twelfth slice:
  - RED baseline proof: source-contract assertion against previous `HEAD:src/app/usePromptGroupLayout.ts` failed because the hook did not own prompt-group active-canvas lifecycle cleanup.
  - Prompt-group/live-scene/performance/connector/layout targeted tests: passed, 51 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, 981 tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `npm.cmd run check:encoding`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-29 Milestone 3 thirteenth slice:
  - RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed before final implementation because expanded selection still lived in `App.tsx` and the stacking-map hook boundary was not fully integrated.
  - Prompt-group/live-scene/performance/connector/layout targeted tests: passed, 53 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, 983 tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `npm.cmd run check:encoding`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-29 Milestone 3 fourteenth slice:
  - RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed before cleanup because App still contained visible derived prompt-group view logic, hidden legacy prompt-group render branches, and `handleLegacyImageRelativeDrag`.
  - Prompt-group/live-scene/performance/connector/layout targeted tests: passed, 55 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, 985 tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `npm.cmd run check:encoding`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-29 Milestone 3 fifteenth slice:
  - Source contract: prompt-group tests assert App and `usePromptGroupLayout.ts` no longer expose unused visible/child prompt-group derived values.
  - Prompt-group/live-scene/performance/connector/layout targeted tests: passed, 61 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, 985 tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `npm.cmd run check:encoding`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-29 Milestone 3 sixteenth slice:
  - RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed before cleanup because App still contained hidden connector/group `false &&` render branches.
  - Source contract: prompt-group tests assert the hidden connector/group branches and their connector child-image derived returns are gone, and `usePromptGroupSelection.ts` owns prompt-group node selection.
  - Prompt-group/live-scene/performance/connector targeted tests: passed, 47 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, 986 tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `npm.cmd run check:encoding`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 3 seventeenth slice:
  - RED: `tests/unit/prompt-group-regroup-behavior.test.ts` failed before cleanup because `renderPromptGroupWorkflowItem` still carried stale dependency-array entries.
  - Source contract: prompt-group tests assert the renderer dependency array excludes dependencies not read by the renderer body.
  - Prompt-group/live-scene/performance/connector/layout targeted tests: passed, 57 tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, 987 tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `npm.cmd run check:encoding`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 4 first slice:
  - RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because the generation runtime/submit guard boundaries did not exist.
  - Source contract: generation runtime tests assert cancellation ownership lives in `useGenerationRuntime.ts` and submit cooldown/signature state lives in `useGenerationSubmitGuard.ts`.
  - Targeted M4 tests: passed, `13` tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, `989` tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed.
  - `npm.cmd run governance:agent-docs`: passed after final status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 4 second slice:
  - RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because billing helper ownership was still in `App.tsx`.
  - Targeted M4 billing tests: passed, `14` tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, `990` tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed.
  - `npm.cmd run governance:agent-docs`: passed.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 4 third slice:
  - RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because initial credit settlement still lived in `App.tsx`.
  - Targeted M4 billing tests: passed, `15` tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, `991` tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed.
  - `npm.cmd run governance:agent-docs`: passed.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 4 fourth slice:
  - RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because draft-context ownership still lived in `App.tsx`.
  - Targeted M4 billing/runtime tests: passed, `16` tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, `992` tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed after status update.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 4 fifth slice:
  - RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because initial billing attempt context still lived in `App.tsx`.
  - Targeted M4 billing/runtime tests: passed, `17` tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, `993` tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed after status update.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 4 sixth slice:
  - RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because generation billing state context still lived in `App.tsx`.
  - Targeted M4 billing/runtime/route tests: passed, `21` tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, `994` tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed after status update.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 4 seventh slice:
  - RED baseline proof: source-contract checks against `HEAD` showed `useGenerationRuntime.ts` did not own `prepareInitialGeneratingPromptNode`, while `App.tsx` still owned `resolveGenerationPreviewState` and `buildGeneratingPromptNode`.
  - Targeted M4 billing/runtime/route tests: passed, `22` tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, `995` tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed after status update.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 4 eighth slice:
  - RED baseline proof: source-contract checks against `HEAD` showed `useGenerationRuntime.ts` did not own `persistInitialGeneratingPromptNode`, while `App.tsx` still imported and called `persistGeneratingPromptNode` directly.
  - Targeted M4 billing/runtime/route tests: passed, `23` tests.
  - `npm.cmd run typecheck`: passed after tightening the persistence wrapper `getCanvas` return type.
  - `npm.cmd run test:unit`: passed, `996` tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed after status update.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 4 ninth slice:
  - RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `prepareInitialGenerationPromptOptimization`, while `App.tsx` still owned initial optimization enablement and `getModelCapabilities(config.model)`.
  - Targeted M4 billing/runtime/route tests: passed, `24` tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, `997` tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed after status update.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 4 tenth slice:
  - RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `completeInitialGenerationPromptSubmission`, while `App.tsx` still had the initial post-persist cleanup block.
  - Targeted M4 billing/runtime/route tests: passed, `25` tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, `998` tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed after status update.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 4 eleventh slice:
  - RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `commitRetryGenerationFailure`, while `App.tsx` still owned retry failure billing-state resolution and notification.
  - Targeted M4 billing/runtime/route tests: passed, `26` tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, `999` tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed after status update.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 4 twelfth slice:
  - RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `executeInitialGenerationPromptNode`, while `App.tsx` still directly called `applyOptimisticServerCreditDebit` and `executeGeneration` in the initial path.
  - Targeted M4 billing/runtime/route tests: passed, `27` tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, `1000` tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed after status update.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 4 thirteenth slice:
  - RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `App.tsx` still owned the initial `handleGenerate` catch logging and notification.
  - Targeted M4 billing/runtime/route tests: passed, `28` tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, `1001` tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed after status update.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 4 fourteenth slice:
  - RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `createRetryGenerationTimeoutGuard`, while `App.tsx` still had inline retry timeout cancellation and patching.
  - Targeted M4 billing/runtime/route tests: passed, `29` tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, `1002` tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed after status update.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 4 fifteenth slice:
  - RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `commitRetryGenerationStart`, while `App.tsx` still directly patched the retry node and applied optimistic debit.
  - Targeted M4 billing/runtime/route tests: passed, `30` tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, `1003` tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed after status update.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 4 sixteenth slice:
  - RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `reportRetryRecoveryResult`, while `App.tsx` still built and sent the retry recovery notification directly.
  - Targeted M4 billing/runtime/route tests: passed, `31` tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, `1004` tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run check:encoding`: passed after status update.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 UI validation policy update:
  - Added mandatory browser inspection rules for UI/visual optimization work to `implement.md` and `validation.md`.
  - Current change is documentation/governance only; no browser run required because no UI surface changed.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `npm.cmd run check:encoding`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 4 seventeenth slice:
  - RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `prepareRetryGenerationRequestContext`, while `App.tsx` still computed retry request ids/counts directly.
  - Targeted M4 billing/runtime/route tests: passed, `32` tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, `1005` tests.
  - `npm.cmd run build`: passed.
  - Browser inspection: skipped; this slice is a non-UI runtime refactor.
  - `npm.cmd run check:encoding`: passed after status update.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 4 eighteenth slice:
  - RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `reportRetryGenerationSuccess`, while `App.tsx` still imported cost and notification services directly in the retry success path.
  - Targeted M4 billing/runtime/route tests: passed, `33` tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, `1006` tests.
  - `npm.cmd run build`: passed.
  - Browser inspection: skipped; this slice is a non-UI runtime refactor.
  - `npm.cmd run check:encoding`: passed after status update.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.
- 2026-04-30 Milestone 4 nineteenth slice:
  - RED: `tests/unit/generation-runtime-contract.test.ts` failed before implementation because `useGenerationRuntime.ts` did not own `prepareRetryGenerationTaskPromptContext`, while `App.tsx` still built retry task prompts directly.
  - Targeted M4 billing/runtime/route tests: passed, `34` tests.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run test:unit`: passed, `1007` tests.
  - `npm.cmd run build`: passed.
  - Browser inspection: skipped; this slice is a non-UI runtime refactor.
  - `npm.cmd run check:encoding`: passed after status update.
  - `npm.cmd run governance:agent-docs`: passed after status update.
  - `git diff --check`: passed with LF/CRLF working-copy warnings only.

## Risk Log

- The largest risk is accidental behavior drift in `App.tsx` while extracting tightly coupled runtime logic.
- Stage One must avoid broad formatting churn so diffs stay reviewable.
- Ecommerce runtime remains last because it has the highest cross-reference count.
- Historical recovery files and local temporary files must not be reintroduced into commits.
