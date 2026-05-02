# KK-Studio v1.4.2 Dual-Lane Refactor Plan

Last updated: 2026-05-02
Branch policy: continue on the current branch unless the user explicitly asks for a branch or worktree.

## Summary

The plain `.git` metadata currently still reports baseline commit `4c448660 Refactor Clay UI and PPT runtime boundaries`. The writable metadata copy used for this session is ahead at `184b158c refactor: extract ecommerce task activation runtime`; use that writable metadata copy for status, staging, and commits in this session.

The active execution model for this thread has resumed Stage One runtime extraction:
- Clay UI surface cleanup and browser evidence closed in `9e7ae2b5`.
- Current active slice is Stage One M6 ecommerce submit runtime extraction in `src/app/useEcommerceSubmitRuntime.ts`.

The Clay UI source remains `C:/Users/Administrator/Downloads/DESIGN-clay.md`, `DESIGN.md`, `docs/DESIGN.md`, `.agent/rules/skills/SKILL.md`, shared CSS tokens, and existing UI surfaces. Current user override: inputs, main cards, sub cards, and framework cards use controlled frosted material. Dark mode uses neutral black-gray surfaces (`#0b0b0c`, `#141414`, `#1f1f1f`), not teal/blue/indigo canvas. Clay brand colors are emphasis only.

Commit boundary going forward: UI fixes and runtime/PPT/ecommerce fixes must be staged separately even though the working tree is mixed. Current runtime staging must use `git --git-dir=node_modules/.codex-git-full --work-tree=.` and include only the active ecommerce submit runtime files plus ledger updates.

## Current Baseline

- `src/App.tsx`: 4410 lines after the current ecommerce submit runtime WIP.
- `src/app/useConnectorRenderer.ts`: 272 lines, already extracted and awaiting hardening.
- `src/context/CanvasContext.tsx`: 5434 lines.
- `src/services/auth/keyManager.ts`: 5280 lines.
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
- The four ledger files identify the current baseline, execution loop, milestone list, validation commands, and recovery context.
- The previous recovery stream remains acknowledged as history, not the active plan.
- Documentation validation and encoding checks pass.

Validation:
- `npm.cmd run governance:agent-docs`
- `npm.cmd run check:encoding`

Commit:
- `docs: align v1.4.2 refactor plan`

### 2. Stage One M1: Connector Renderer Extraction Hardening

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
- `refactor: harden connector renderer extraction`

### 3. Stage One M2: Prompt Group Layout Runtime

Goal: extract prompt group layout, bounds, overlap, regroup, and live scene derivation from `src/App.tsx` into `src/app/usePromptGroupLayout.ts`.

Scope:
- Define `UsePromptGroupLayoutDeps` and `UsePromptGroupLayoutResult`.
- Move prompt group bounds, visible group views, regroup presentation state coordination, and live scene derivation into the hook.
- Keep drag handler hooks and rendering code compatible through explicit returned methods and state.

Acceptance:
- `App.tsx` loses the prompt group layout block without behavior changes.
- Existing prompt-group regroup and live-scene tests pass.
- Drag, focus, auto-repair, regroup settle, and connector rendering behavior stay contract-compatible.

Validation:
- Prompt group and live scene targeted tests.
- `npm.cmd run typecheck`
- `npm.cmd run test:unit`
- `npm.cmd run build`
- `npm.cmd run check:encoding`

Commit:
- `refactor: extract prompt group layout runtime`

### 4. Stage One M3: Generation Runtime

Goal: extract generation execution orchestration from `src/App.tsx`.

Scope:
- Move generation start, billing attempt coordination, cancellation, retry, failure state, result node persistence, and preview state wiring into `src/app/useGenerationRuntime.ts`.
- Preserve current billing, API, storage, and generation service contracts.

Acceptance:
- Generation lifecycle behavior remains unchanged.
- Cancellation, retry, balance consume/refund, and result placement tests stay green.
- No API or billing protocol changes are introduced.

Commit:
- `refactor: extract generation runtime`

### 5. Stage One M5: PPT Runtime

Status: paused while the active Clay UI audit is closed. The first pass landed in `4c448660`; any follow-up must remain in a later runtime/PPT commit and stay separate from Clay UI files.

Goal: extract PPT editing, preview, export, and deck child image management from `src/App.tsx`.

Scope:
- Create `src/app/usePptRuntime.ts`.
- Move PPT editable page building, slide synchronization, PPTX export, PPT preview, and deck child filtering orchestration into the hook.
- Preserve existing helper modules such as PPTX skeleton and slide document builders.

Acceptance:
- PPT preview and editable export behavior remains unchanged.
- Deck child image filtering remains compatible with canvas rendering.
- PPT-related tests and build pass.

Commit:
- `refactor: extract ppt runtime`

### 6. Stage One M6: Ecommerce Runtime

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
- Current slice: extract the ecommerce submit branch in `handleGenerate` into `src/app/useEcommerceSubmitRuntime.ts`.

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

Commit:
- `refactor: extract ecommerce submit runtime`

### 7. Stage Two: Secondary Giant File Split

Goal: split the next largest files while preserving public behavior.

Scope:
- Split `src/context/CanvasContext.tsx` by state model, selection/drag events, node mutations, and persistence sync.
- Split `src/services/auth/keyManager.ts` by key storage, permission checks, encryption helpers, and provider credential management.
- Keep compatibility exports for existing import paths.

Acceptance:
- Public context/service APIs remain compatible.
- Typecheck and related unit tests pass after each sub-split.
- Commits are scoped per submodule, not one large batch.

### 8. Stage Three: Global Quality Governance

Goal: reduce type ambiguity and repeated logic after the main extractions create stable seams.

Scope:
- Remove or narrow `any` only where it is touched by the current refactor.
- Consolidate repeated domain types into existing type files or focused domain files.
- Remove dead code introduced by the refactor.
- Extract repeated UI fragments only when the duplication is local and obvious.

Acceptance:
- No new type errors.
- Core UI contract tests do not regress.
- The cleanup does not alter visual flow or product behavior.

### 9. Stage Four: apps/web Migration

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
