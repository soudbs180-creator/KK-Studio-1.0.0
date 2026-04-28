# KK-Studio v1.4.2 Refactor Plan

Last updated: 2026-04-29
Branch policy: continue on the current branch unless the user explicitly asks for a branch or worktree.

## Summary

The current execution line is the KK-Studio v1.4.2 progressive refactor. The goal is to reduce the largest legacy front-end files without interrupting the existing `src/` runtime, then migrate stabilized modules to `apps/web/`.

The refactor must not become a rewrite. Each milestone is a small, verifiable extraction or cleanup with a scoped commit. `apps/api/` is structurally healthy and is only checked for compatibility when front-end contracts touch API behavior.

Current user override: execute the Airtable-inspired global UI refit before continuing the staged refactor milestones. This UI refit keeps the same execution loop: failing source contracts first, scoped UI/doc implementation second, validation third, status update fourth, then one scoped commit.

## Current Baseline

- `src/App.tsx`: 10395 lines.
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

### 0. Airtable-Inspired Global UI Refit

Goal: replace the older Apple/dark-heavy UI rules with a light-first Airtable-style system while keeping controlled frosted glass on key shells and cards.

Scope:
- Create the root `DESIGN.md` Airtable reference from the cached `getdesign` Airtable guidance without running unconfirmed external code.
- Rewrite `docs/DESIGN.md` and `.agent/rules/skills/SKILL.md` so Airtable clarity is canonical.
- Refactor `src/index.css` tokens toward deep navy text `#181d26`, Airtable Blue `#1b61c9`, subtle borders, low blue-tinted shadows, and capped glass depth.
- Rework `SearchPalette.tsx`, `SettingsScaffold.tsx`, `src/components/settings/ui/index.tsx`, and `ApiSettingsView.tsx` around shared motion, focus, selected-state, and operation-weighting rules.
- Preserve unrelated billing/API backend work and do not stage unrelated paths.

Acceptance:
- New UI contract tests cover the manual/rule presence, search palette constraints, settings primitive behavior, API default weighting, and shadow/glass depth.
- Search palette has no heavy Tailwind shadows, no local indigo selected state, no inline focus mutation, and no overflow-prone floating confirmation.
- Settings controls share the same motion scale and overflow-safe control sizing.
- API settings default view emphasizes add/edit/refresh actions over repeated status/explanatory blocks.
- Documentation and agent rules name Airtable as the canonical UI system and preserve existing governance-required rule sections.

Validation:
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/settings-ui-density-regression.test.ts tests/unit/api-settings-provider-compact-ui-contract.test.ts tests/unit/api-settings-simple-mode-contract.test.ts tests/unit/airtable-global-ui-refit-contract.test.ts`
- `npm.cmd run verify:mobile-settings-smoke`
- `npm.cmd run verify:desktop-settings-smoke`
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run governance:agent-docs`
- `npm.cmd run check:encoding`

Commit:
- `refactor: apply airtable global ui refit`

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

### 5. Stage One M4: PPT Runtime

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

### 6. Stage One M5: Ecommerce Runtime

Goal: extract ecommerce framework/runtime logic last because it has the highest cross-reference count.

Scope:
- Build an ecommerce reference map before editing.
- Add source contract tests for framework cards, import/review flows, scheduler state, and product image result binding.
- Create `src/app/useEcommerceRuntime.ts`.

Acceptance:
- Ecommerce references are routed through an explicit hook interface.
- Existing ecommerce contract tests do not regress.
- No unrelated generation or PPT behavior changes.

Commit:
- `refactor: extract ecommerce runtime`

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
