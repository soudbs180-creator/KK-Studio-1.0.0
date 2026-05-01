# KK-Studio v1.4.2 Clay UI Audit Plan

Last updated: 2026-05-01
Branch policy: continue on the current branch unless the user explicitly asks for a branch or worktree.

## Summary

The active execution lane is the KK-Studio Clay UI audit. Stage One PPT/runtime extraction is paused in this thread and remains dirty work only; keep its files out of the UI audit commit. Browser inspection applies to this UI lane.

The work must remain surgical. Reconcile `C:/Users/Administrator/Downloads/DESIGN-clay.md`, `DESIGN.md`, `docs/DESIGN.md`, `.agent/rules/skills/SKILL.md`, shared CSS tokens, and existing UI surfaces without redesigning flows or folding in unrelated runtime/PPT WIP.

Current user override: inputs, main cards, sub cards, and framework cards must use controlled frosted material. Dark mode must use neutral black-gray surfaces (`#0b0b0c`, `#141414`, `#1f1f1f`), not teal/blue/indigo canvas. Keep Clay brand colors for emphasis only.

Commit boundary: UI audit files and tests only. Existing dirty runtime/PPT files such as `src/App.tsx`, `src/app/useGenerationRuntime.ts`, `src/app/usePptRuntime.ts`, and PPT/generation runtime tests must not be staged into the UI commit; they remain paused until a separate runtime pass resumes them.

## Current Baseline

- `src/App.tsx`: 6961 lines in the current mixed worktree; runtime/PPT edits remain paused and outside the UI commit boundary.
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

### 0. Clay Frosted UI Audit

Goal: replace the older Apple/dark-heavy/Airtable UI drift with a Clay system: warm cream light theme, neutral black-gray dark theme, controlled frosted material for inputs/main cards/sub cards/framework cards, near-black or cream readable text, saturated color blocks for emphasis, no blue/teal dark canvas, and no whole-page theme flicker.

Current status: active in this thread. PPT/runtime work is paused and must keep its own future commit boundary.

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

Validation:
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/clay-global-ui-refit-contract.test.ts tests/unit/clay-frosted-surface-contract.test.ts tests/unit/theme-contrast-contract.test.ts tests/unit/responsive-surface.test.ts tests/unit/theme-system-adaptation.test.ts tests/unit/settings-entry-surface-style-regression.test.ts`
- `npm.cmd run verify:mobile-settings-smoke`
- `npm.cmd run verify:desktop-settings-smoke`
- `npm.cmd run typecheck`
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

Status: paused while the Clay UI audit is active. Keep the PPT commit boundary separate from the UI audit lane.

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
