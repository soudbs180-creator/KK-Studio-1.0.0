# KK-Studio v1.4.2 Coordination Status

Last updated: 2026-05-01

## Active State

- Active lane in this thread: Stage One M6 ecommerce runtime extraction.
- Parallel UI lane: `codex://threads/019de168-0c09-7a03-8e64-124f722fa2fc` owns Clay UI audit, browser evidence, and UI-only commits.
- Current branch: `main`.
- Original `.git` remains blocked by deny ACLs for this session, so commits are recorded through the writable full Git metadata copy at `node_modules/.codex-git-full` with `git --git-dir=node_modules/.codex-git-full --work-tree=.`.
- Current worktree is mixed with Clay UI edits plus runtime/PPT files. Staging must remain path-limited.
- Runtime source of truth: Stage One hook extraction rules in `plans.md`; all custom hooks stay under `src/app/` with explicit deps/result interfaces.
- Current focus: commit the non-UI ecommerce slot history runtime slice, then continue Stage One M6 with the next contract-test-first ecommerce slice.

## Current Ecommerce Runtime Pass

- Implemented in the working tree: ecommerce slot history and preview entrypoints now route through `src/app/useEcommerceSlotHistoryRuntime.ts`.
- Extracted actions: `resolveEcommerceSlotState`, `handlePreviewEcommerceSlotHistory`, and `handlePreviewEcommerceSlotHistoryForNode`.
- Contract hardening: slot preview/source-shape tests now point at `useEcommerceSlotHistoryRuntime`; `App.tsx` imports and destructures the hook and no longer imports `buildEcommerceSlotPreviewBundle`.
- Line counts after extraction: `src/App.tsx` 6626 lines; `src/app/useEcommerceSlotHistoryRuntime.ts` 92 lines.
- Subagent review: spec reviewer passed the slice; code-quality reviewer reported no blocking findings. Follow-up debt: preserve non-`Error` queue messages in `useEcommerceRuntime` and replace the direct `keyManager` singleton with an injected lane/key resolver in a later scheduler-hardening slice.
- Browser QA remains skipped for non-UI runtime slices. Parallel UI thread owns browser evidence for Clay surfaces.
- Full `npm.cmd run test:unit` is currently blocked by parallel Clay UI work in `tests/unit/clay-frosted-surface-contract.test.ts`; the failures target `src/components/layout/ChatSidebar.tsx` and related UI-token assertions, not the slot history runtime slice.
- Commit include scope for this runtime slice: `status.md`, `src/App.tsx`, `src/app/useEcommerceSlotHistoryRuntime.ts`, `tests/unit/ecommerce-runtime-contract.test.ts`, `tests/unit/ecommerce-group-slot-integration.test.ts`, and `tests/unit/ecommerce-group-slot-preview-contract.test.ts`.
- Explicitly excluded dirty UI paths: `src/app/AppDesktopChrome.tsx`, `src/components/**`, `src/index.css`, `src/main.tsx`, `src/workflow/nodes/WorkflowUtilityCard.tsx`, and Clay UI tests.

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

The following validation was recorded before this status cleanup pass and belongs to the committed baseline:

- Clay UI contract suite: passed, 35/35.
- Additional ecommerce/mobile surface contracts: passed, 9/9.
- Runtime/PPT targeted validation: passed, 6/6.
- Shared gate: `npm.cmd run typecheck`, `npm.cmd run test:unit` (1063/1063), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and `git diff --check`.
- `npm.cmd run verify:mobile-settings-smoke`: passed via fallback route checks; Playwright launch was blocked by `spawn EPERM`.
- `npm.cmd run verify:desktop-settings-smoke`: passed via fallback route checks; Playwright launch was blocked by `spawn EPERM`.

Fresh validation for this runtime/PPT follow-up pass is tracked below:

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

Fresh validation for the current ecommerce runtime slice is tracked below:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-framework-runtime.test.ts tests/unit/ecommerce-framework-contract.test.ts tests/unit/ecommerce-button-guards.test.ts` (10/10).
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1065/1065).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git diff --check -- src/App.tsx src/app/useEcommerceRuntime.ts tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-button-guards.test.ts status.md plans.md implement.md validation.md` with CRLF normalization warnings only.

Fresh validation for the current ecommerce selection runtime slice is tracked below:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-runtime-selection.test.ts tests/unit/ecommerce-analysis-selection-contract.test.ts tests/unit/ecommerce-button-guards.test.ts tests/unit/ecommerce-group-slot-state.test.ts` (11/11).
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1066/1066).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git diff --check -- src/App.tsx src/app/useEcommerceRuntime.ts src/app/ecommerceSelectionRuntime.ts tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-runtime-selection.test.ts status.md` with CRLF normalization warnings only.

Fresh validation for the current ecommerce slot history runtime slice is tracked below:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-group-slot-integration.test.ts tests/unit/ecommerce-group-slot-preview-contract.test.ts tests/unit/ecommerce-group-slot-state.test.ts` (8/8).
- Passed: `npm.cmd run typecheck`.
- Blocked by parallel UI lane: `npm.cmd run test:unit` fails in `tests/unit/clay-frosted-surface-contract.test.ts` after Clay UI source assertions were tightened against dirty UI files. Scoped ecommerce slot tests above passed.
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.

## Browser QA

- Browser QA is not required for this non-UI runtime/PPT slice.
- Browser QA remains mandatory for the parallel Clay UI lane before a UI commit.

## Remaining Work

1. Stage only the current ecommerce slot history runtime slice through `node_modules/.codex-git-full`.
2. Create the scoped ecommerce slot history runtime commit.
3. Continue Stage One M6 ecommerce runtime with a reference map and contract tests before extraction.
4. Keep the parallel Clay UI files out of runtime/PPT commits.

## Risks

- Original `.git` is still not writable from this session. Use the full writable metadata copy at `node_modules/.codex-git-full` for local commits unless the ACL is fixed outside the sandbox.
- The worktree remains mixed, so any staging must be explicit path-based and reviewed before commit.
- Do not delete locks, change `.git` ACLs, or revert parallel UI work without explicit user confirmation.
