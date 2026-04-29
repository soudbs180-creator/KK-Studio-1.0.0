# KK-Studio v1.4.2 Refactor Status

Last updated: 2026-04-29

## Current Position

- Workspace: `C:\Users\Administrator\Downloads\KK-Studio-1.0.0`
- Active plan: v1.4.2 progressive refactor in `plans.md`
- Current milestone: Milestone 3 prompt group layout extraction in progress; eleventh prompt-node edit handler slice is complete in the current scoped change
- Branch policy: continue on current branch unless the user explicitly asks otherwise
- `apps/api/`: compatibility checks only
- `apps/web/`: future migration target after `src/` boundaries are stable

## Baseline Snapshot

- `src/App.tsx`: 10395 lines
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
  - `usePromptGroupDragHandlers.ts`
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

Status: in progress. First live-scene slice committed as `8d0f80e3 refactor: extract prompt group live scene layout`; second layout-runtime slice committed as `023fe7c3 refactor: extract prompt group layout runtime`; third presentation-state slice committed as `c8e6ca9f refactor: extract prompt group presentation state`; fourth child-map slice committed as `1944deb4 refactor: derive prompt group child maps in hook`; fifth live-position helper slice committed as `e74eafe9 refactor: extract prompt group live drag helpers`; sixth focus/height handler slice committed as `28386927 refactor: extract prompt group focus handlers`; seventh auto-repair slice committed as `ec0f1a60 refactor: move prompt layout auto repair into hook`; eighth live-position-change handler slice committed as `827b7310 refactor: extract prompt group live position handler`; ninth regroup predicate slice committed as `963aae4f refactor: move prompt regroup predicate into hook`; tenth drag-commit persistence slice committed as `476e2d8a refactor: extract prompt group drag commit persistence`; eleventh prompt-node edit handler slice completed in the current scoped change.

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
- Added a failing source-contract test first, verified it failed, then migrated implementation.

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
- Reused the hook's existing `promptNodesById` and `updatePromptNode` dependencies for prompt height persistence and tag removal.
- Kept prompt-group node selection, drag handler wiring, render wiring, and broader canvas reset/focus lifecycle in `src/App.tsx`.
- Added a failing source-contract test first, verified it failed, then migrated implementation.

Line count change after eleventh slice:
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
- Ninth slice source contract: prompt-group tests now assert `usePromptGroupLayout.ts` owns `shouldAutoRegroupPromptGroup` and `App.tsx` no longer defines it.
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

Validation not used as a commit gate:
- `npm.cmd run verify:prompt-group-drag`: failed in the local browser path because `http://127.0.0.1:3000` opened the auth/login screen and `[data-canvas-surface="prompt"]` never became visible within 30s. This is recorded as an environment/auth precondition issue for this browser smoke, not a unit/type/build regression.

Current risk:
- This slice intentionally does not move prompt-group node selection, drag handler wiring, render wiring, or the broader canvas reset/focus lifecycle yet, so `App.tsx` still owns those orchestration controls.
- The next slice should remain narrow and avoid generation/PPT/ecommerce runtime code.
- The source-contract tests cover ownership boundaries, but the browser drag smoke is still blocked by a local auth/login precondition and should not be treated as behavioral proof until a valid session fixture exists.
- Auto-repair, live-position change handling, regroup predicate checks, drag commit persistence, and prompt-node edit handlers now live in `usePromptGroupLayout.ts`; future slices should keep prompt-group changes narrow because remaining wiring still crosses render and selection behavior.

Review checkpoint after fourth slice:
- `src/App.tsx` now remains at `9845` lines and `src/app/usePromptGroupLayout.ts` at `749` lines.
- Confirmed `buildConnectorRenderSnapshot`, connector snapshot commit/schedule helpers, and connector position resolvers remain owned by `src/app/useConnectorRenderer.ts`.
- Confirmed `buildPromptGroupRegroupLayouts`, presentation-state mutation helpers, stable bounds/views caches, live-scene derivation, and child maps remain owned by `src/app/usePromptGroupLayout.ts`.
- Confirmed `App.tsx` still owns render wiring, selection behavior, and broader canvas reset/focus lifecycle.

Next step:
- Continue Milestone 3 with a separate RED source-contract test for the next safe boundary.
- Candidate next slice: audit whether prompt-group node selection or drag handler wiring can be split safely; keep render wiring isolated unless a dedicated contract proves the boundary.

### Milestones 4-9

Status: pending. GPT-5.5 xhigh subagents are used for exploration/implementation where they can work independently. See `plans.md` for the full ordered list:
- `useGenerationRuntime`
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
  - Prompt-group/live-scene/performance/connector targeted tests: passed, 47 tests.
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

## Risk Log

- The largest risk is accidental behavior drift in `App.tsx` while extracting tightly coupled runtime logic.
- Stage One must avoid broad formatting churn so diffs stay reviewable.
- Ecommerce runtime remains last because it has the highest cross-reference count.
- Historical recovery files and local temporary files must not be reintroduced into commits.
