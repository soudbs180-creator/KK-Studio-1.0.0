# KK-Studio v1.4.2 Refactor Coordination Status

Last updated: 2026-05-01

## Active State

- Active lane in this thread: Stage One runtime/PPT hardening, after the Clay UI audit pass.
- Parallel UI lane: another Codex thread is handling Clay UI refactor; keep UI files and runtime/PPT files in separate commit scopes while keeping `plans.md`, `implement.md`, `validation.md`, and this status file as the shared ledger.
- UI source of truth: `C:/Users/Administrator/Downloads/DESIGN-clay.md`, `DESIGN.md`, `docs/DESIGN.md`, `.agent/rules/skills/SKILL.md`, `plans.md`, `implement.md`, and `validation.md`.
- Runtime source of truth: Stage One hook extraction rules in `plans.md`; all custom hooks stay under `src/app/` with explicit deps/result interfaces.
- Worktree is mixed with Clay UI WIP, generation runtime WIP, and PPT runtime WIP. Any staging must be explicit path-based and reviewed before commit.

## Completed

### Runtime / PPT

- `handleRetryPptSinglePage` is owned by `src/app/useGenerationRuntime.ts`; `src/App.tsx` only consumes the hook result and wires it to `onRetryPptPage`.
- `src/app/usePptRuntime.ts` now owns PPT preview opening via `tryOpenPptPreview`, with `setPreviewInitialIndex` injected through `UsePptRuntimeDeps`.
- `src/app/pptRuntimeHelpers.ts` centralizes PPT image ordering, stale `childImageIds` fallback, missing parent prompt rejection, PPT deck child detection, and nullish image array guards.
- `handleSavePptEditablePages` now builds an `image.id -> alias` map from each editable page's `backgroundImageId` / image layer id, avoiding array-index-only alias writes.
- PPT runtime contracts were updated and expanded with `tests/unit/ppt-runtime-helper-contract.test.ts`.

### Clay UI

- Clay design and rule docs were reconciled with the frosted override.
- Shared UI tokens were added for dark canvas and frosted input/main/sub/framework surfaces.
- Major Clay surfaces were moved onto the shared material system: `SearchPalette`, `Sidebar`, prompt/composer inputs, mobile shell, settings, storage modal, ecommerce panels, and canvas/image cards.
- Stale blue/indigo/heavy-shadow patterns were removed from the prompt bar, project manager, selection menu, notification/update surfaces, and the older dark settings token block.
- Theme and canvas-card shadow helpers were aligned with the Clay surface model.
- Contract coverage now includes controlled frosted tokens, neutral dark aliases, legacy blue-black token regressions, ecommerce frosted surfaces, mobile workspace surfaces, and theme contrast.

## Latest Validation

- Runtime/PPT targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ppt-runtime-contract.test.ts tests/unit/ppt-runtime-helper-contract.test.ts tests/unit/ppt-deck-single-container-contract.test.ts` (6/6).
- Current shared gate passed after PPT hardening: `npm.cmd run typecheck`, `npm.cmd run test:unit` (1063/1063), `npm.cmd run build`, and `npm.cmd run check:encoding`.
- Clay UI contract suite: passed, 35/35.
- Additional ecommerce/mobile surface contracts: passed, 9/9.
- `npm.cmd run verify:mobile-settings-smoke`: passed via fallback route checks; Playwright launch remains blocked by `spawn EPERM`.
- `npm.cmd run verify:desktop-settings-smoke`: passed via fallback route checks; Playwright launch remains blocked by `spawn EPERM`.
- Full gate passed after the latest token/test tightening and the minimal paused-PPT compile repair: `npm.cmd run typecheck`, `npm.cmd run test:unit` (1063/1063), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and `git diff --check`.

## Browser Notes

- `npm.cmd run dev:restart` reports ready, but `npm.cmd run dev:status` still shows Vite `running=False; healthy=False`; direct HTTP to the dev process was connection refused.
- A static preview server was started from `dist/` through the persistent Node REPL and confirmed `http://127.0.0.1:3000/?clayVerify=static20260501` returns 200.
- Codex in-app Browser was attempted with the browser-use `iab` backend. Browser tab creation/listing worked, but navigation and input both timed out in CDP (`Page.enable` and `Input.dispatchKeyEvent`), leaving the tab at `about:blank`.
- Because the in-app Browser could not navigate, current visual evidence is blocked at the browser plugin layer. Route-level smoke fallback passed for `/`, `/settings`, and `/settings/api-management`; do not treat that as a screenshot-based visual sign-off.

## Remaining Work

- Wait for the two active `gpt-5.5 xhigh` review agents to report on PPT runtime spec and code quality.
- Attempt scoped staging/commit for the runtime/PPT slice if local `.git/index.lock` permission errors are resolved; otherwise keep the exact blocker recorded.
- Continue Stage One with the next PPT runtime hardening or move to the next planned runtime module only after review issues are closed.
- Retry in-app Browser visual verification if the browser plugin/CDP channel recovers.
- If browser verification remains blocked, keep the limitation explicit in the handoff and do not claim screenshot-based desktop/mobile sign-off.
- Keep Clay UI and runtime/PPT lanes separate even though they share the same coordination ledger.

## UI Commit Include Scope

- UI docs/rules: `plans.md`, `implement.md`, `validation.md`, `status.md`, `DESIGN.md`, `docs/DESIGN.md`, `.agent/rules/skills/SKILL.md`.
- Clay UI implementation: `src/index.css`, `src/context/ThemeContext.tsx`, `src/utils/canvasCardShadow.ts`, and changed UI component files under `src/components/`, `src/components/layout/`, `src/components/mobile/`, `src/components/ecommerce/`, `src/components/canvas/`, `src/components/image/`, `src/components/common/`, `src/components/modals/`, plus `src/app/AppPromptComposer.tsx`.
- UI contracts: `tests/unit/clay-global-ui-refit-contract.test.ts`, `tests/unit/clay-frosted-surface-contract.test.ts`, `tests/unit/ecommerce-frosted-surface-contract.test.ts`, `tests/unit/mobile-workspace-surface-contract.test.ts`, `tests/unit/responsive-surface.test.ts`, `tests/unit/settings-entry-surface-style-regression.test.ts`, `tests/unit/theme-contrast-contract.test.ts`, `tests/unit/theme-system-adaptation.test.ts`, `tests/unit/canvas-visual-regression.test.ts`, `tests/unit/ecommerce-composer-scroll-regression.test.ts`.

## Commit Boundary Rules

Do not stage or commit these runtime/PPT files into the Clay UI audit commit:

- `src/App.tsx`
- `src/app/useGenerationRuntime.ts`
- `src/app/usePptRuntime.ts`
- `src/app/pptRuntimeHelpers.ts`
- `tests/unit/generation-runtime-contract.test.ts`
- `tests/unit/generation-billing-runtime-contract.test.ts`
- `tests/unit/ppt-runtime-contract.test.ts`
- `tests/unit/ppt-deck-single-container-contract.test.ts`
- `tests/unit/credit-route-classification.test.ts`
- `tests/unit/route-aware-credit-billing.test.ts`

For a runtime/PPT commit, do not stage Clay UI files such as `src/components/*`, `src/index.css`, `src/context/ThemeContext.tsx`, `DESIGN.md`, `docs/DESIGN.md`, `.agent/rules/skills/SKILL.md`, or Clay-specific tests unless the commit is explicitly the UI audit commit.

Current runtime/PPT line counts:

- `src/App.tsx`: 6963
- `src/app/useGenerationRuntime.ts`: 2605
- `src/app/usePptRuntime.ts`: 1293
- `src/app/pptRuntimeHelpers.ts`: 153
- `tests/unit/ppt-runtime-contract.test.ts`: 232
- `tests/unit/ppt-runtime-helper-contract.test.ts`: 38
- `tests/unit/ppt-deck-single-container-contract.test.ts`: 46

Runtime/PPT note: `src/App.tsx` is already substantially smaller than the original 10395-line baseline, but this line count includes earlier generation-runtime extraction WIP in the same mixed worktree.

## Risks

- Local git staging/commit may still be blocked by `.git/index.lock` permission errors.
- Browser visual QA is blocked by the in-app Browser/CDP channel in this environment; route-level fallback is not equivalent to visual evidence.
- The worktree remains mixed, so any staging must be explicit path-based and reviewed before commit.
- Latest staging attempt was blocked: `fatal: Unable to create 'C:/Users/Administrator/Downloads/KK-Studio-1.0.0/.git/index.lock': Permission denied`. No `.git` cleanup was performed.
