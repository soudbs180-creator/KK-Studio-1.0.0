# KK-Studio v1.4.2 Refactor Status

Last updated: 2026-04-29

## Current Position

- Workspace: `C:\Users\Administrator\Downloads\KK-Studio-1.0.0`
- Active plan: Airtable-inspired global UI refit, then return to the v1.4.2 progressive refactor in `plans.md`
- Current milestone: Milestone 0, Airtable-inspired global UI refit
- Branch policy: continue on current branch unless the user explicitly asks otherwise
- `apps/api/`: compatibility checks only
- `apps/web/`: future migration target after `src/` boundaries are stable

## Baseline Snapshot

- `src/App.tsx`: 10395 lines
- `src/app/useConnectorRenderer.ts`: 272 lines
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

Status: validation passed; preparing scoped commit.

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

### Milestone 1: Refactor Ledger Alignment

Status: pending until Milestone 0 is committed.

Scope:
- Replace the old recovery-first ledger language with the active v1.4.2 refactor plan.
- Keep recovery history as background only.
- Define milestone gates, validation commands, and commit policy.

Validation to run:
- `npm.cmd run governance:agent-docs`
- `npm.cmd run check:encoding`

Next step:
- Run documentation validation, fix any issue, then commit `docs: align v1.4.2 refactor plan`.

### Milestone 2: Connector Renderer Extraction Hardening

Status: pending.

Known baseline:
- `src/app/useConnectorRenderer.ts` already exists.
- `src/App.tsx` imports and calls `useConnectorRenderer`.
- Prior read-only validation showed connector/live-scene targeted tests and typecheck passing before this execution line.

Planned work:
- Add or adjust source contract coverage if needed.
- Tighten hook types with `CanvasPerformanceProfile`, `CanvasPoint`, and `UseConnectorRendererResult`.
- Confirm no duplicate connector snapshot logic remains in `App.tsx`.

### Milestones 3-9

Status: pending. See `plans.md` for the full ordered list:
- `usePromptGroupLayout`
- `useGenerationRuntime`
- `usePptRuntime`
- `useEcommerceRuntime`
- `CanvasContext.tsx` and `keyManager.ts` split
- global quality governance
- staged `apps/web/` migration

## Validation Log

No validation has been run after this ledger update yet.

## Risk Log

- The largest risk is accidental behavior drift in `App.tsx` while extracting tightly coupled runtime logic.
- Stage One must avoid broad formatting churn so diffs stay reviewable.
- Ecommerce runtime remains last because it has the highest cross-reference count.
- Historical recovery files and local temporary files must not be reintroduced into commits.
