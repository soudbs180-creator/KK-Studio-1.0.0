# KK-Studio v1.4.2 Refactor Status

Last updated: 2026-04-29

## Current Position

- Workspace: `C:\Users\Administrator\Downloads\KK-Studio-1.0.0`
- Active plan: v1.4.2 progressive refactor in `plans.md`
- Current milestone: Milestone 2 complete; Milestone 3 prompt group layout extraction next
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

Status: in progress. First live-scene slice committed as `8d0f80e3 refactor: extract prompt group live scene layout`; second layout-runtime slice validated, but the scoped commit is blocked by the current sandbox being unable to create `.git/index.lock`.

Scope completed in the first slice:
- Added `src/app/usePromptGroupLayout.ts` with explicit `UsePromptGroupLayoutDeps` and `UsePromptGroupLayoutResult`.
- Moved prompt-group live scene snapshot derivation and `liveSceneRef` synchronization out of `src/App.tsx`.
- Kept `App.tsx` as the hook orchestrator for this slice and left bounds/overlap/regroup behavior in place for later extraction.
- Updated the live-scene contract test to assert the prompt-group live-scene builder is owned by the new hook.

Scope completed in the second slice:
- Moved prompt-group regroup layout building, regroup-layout trace instrumentation, bounds calculation, stable bounds/views caches, overlap recomputation, visible prompt-group views, and live-scene frame synchronization into `src/app/usePromptGroupLayout.ts`.
- Kept prompt-group drag commit, begin/settle/clear presentation mutations, and render wiring in `src/App.tsx` for the next isolated slice.
- Updated source-contract tests so App remains responsible for orchestration while `usePromptGroupLayout.ts` owns regroup layouts, bounds, views, overlap freeze, and live sync.

Line count change after second slice:
- `src/App.tsx`: `10395` baseline lines to `10333` lines after this slice.
- `src/App.tsx`: `10044` lines after second slice.
- `src/app/usePromptGroupLayout.ts`: `529` lines after second slice.

Validation passed:
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-connector-throttling-contract.test.ts`
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-connector-throttling-contract.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/prompt-group-regroup-layout.test.ts tests/unit/canvas-local-performance-trace-contract.test.ts`
- `npm.cmd run typecheck`
- `npm.cmd run test:unit` (`971` tests passed)
- `npm.cmd run build`
- `npm.cmd run check:encoding`

Validation not used as a commit gate:
- `npm.cmd run verify:prompt-group-drag`: failed in the local browser path because `http://127.0.0.1:3000` opened the auth/login screen and `[data-canvas-surface="prompt"]` never became visible within 30s. This is recorded as an environment/auth precondition issue for this browser smoke, not a unit/type/build regression.

Current risk:
- This slice intentionally does not move prompt-group begin/settle/clear presentation mutation or drag commit persistence yet, so `App.tsx` still owns the final prompt-group drag lifecycle controls.
- The next slice should remain narrow and avoid generation/PPT/ecommerce runtime code.

Next step:
- Commit this slice as `refactor: extract prompt group layout runtime` once `.git/index.lock` creation is allowed again. Current failed command: `git add -- src/App.tsx src/app/usePromptGroupLayout.ts status.md tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-local-performance-trace-contract.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts; git commit -m "refactor: extract prompt group layout runtime"`.
- Continue Milestone 3 by extracting prompt-group presentation state mutation helpers (`syncPromptGroupLayoutState`, `schedulePromptGroupRegroupAnimation`, `beginPromptGroupRegroup`, `settlePromptGroupRegroup`, `clearPromptGroupRegroup`) into `usePromptGroupLayout.ts` with drag commit persistence still in `App.tsx`.

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

## Risk Log

- The largest risk is accidental behavior drift in `App.tsx` while extracting tightly coupled runtime logic.
- Stage One must avoid broad formatting churn so diffs stay reviewable.
- Ecommerce runtime remains last because it has the highest cross-reference count.
- Historical recovery files and local temporary files must not be reintroduced into commits.
