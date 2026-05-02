# KK-Studio v1.4.2 Single-Line Validation Matrix

Last updated: 2026-05-03

Use `npm.cmd` for npm scripts on Windows.

## Active Stage One M6 Closeout Gate

Use this gate while scanning or extending the remaining ecommerce runtime extraction. The partial redraw slice is already committed in `d12731ce`; rerun this set when the touched area overlaps redraw, source selection, or mobile result feed boundaries:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/ecommerce-partial-redraw-runtime-contract.test.ts" `
  "tests/unit/ecommerce-structured-task-source-contract.test.ts" `
  "tests/unit/partial-redraw-pipeline-contract.test.ts" `
  "tests/unit/mobile-result-feed-app-contract.test.ts"
```

Runtime commits also require `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and a path-limited alternate-git `diff --check` unless `status.md` records a specific blocker.

Ledger-only closeout commits require:

```powershell
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "plans.md" "implement.md" "status.md" "validation.md"
```

## Completed Clay UI Gate

Use this gate if the completed Clay UI audit lane is touched again:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/clay-global-ui-refit-contract.test.ts" `
  "tests/unit/clay-frosted-surface-contract.test.ts" `
  "tests/unit/theme-contrast-contract.test.ts" `
  "tests/unit/responsive-surface.test.ts" `
  "tests/unit/theme-system-adaptation.test.ts" `
  "tests/unit/settings-entry-surface-style-regression.test.ts"
```

Clay UI commits also require browser QA plus `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding` unless `status.md` records a specific blocker.

## Clay UI Contract Suite

Run the Clay UI contract suite for every UI-lane change in this active UI thread:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/clay-global-ui-refit-contract.test.ts" `
  "tests/unit/clay-frosted-surface-contract.test.ts" `
  "tests/unit/theme-contrast-contract.test.ts" `
  "tests/unit/responsive-surface.test.ts" `
  "tests/unit/theme-system-adaptation.test.ts" `
  "tests/unit/settings-entry-surface-style-regression.test.ts"
```

Run the additional surface regressions when the touched area overlaps them:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/ecommerce-frosted-surface-contract.test.ts" `
  "tests/unit/mobile-workspace-surface-contract.test.ts"
```

## Clay UI Browser Requirement

Browser QA is mandatory for Clay UI changes. The browser check must use the Codex in-app Browser and cover desktop and mobile viewports for the touched surfaces.

Preferred flow:
1. `npm.cmd run dev:restart`
2. If Vite is unhealthy, run `npm.cmd run build` and serve `dist/` through a stable local static server.
3. Open the app in the Codex in-app Browser and verify both desktop and mobile viewports.

Required browser checks:
- Light theme uses warm cream surfaces with readable dark text.
- Dark theme uses neutral black/gray surfaces, not blue, teal, or indigo canvas.
- Inputs, main cards, sub cards, and framework cards render as controlled frosted material with readable contrast and no heavy shadow.
- SearchPalette, settings/API workbench, prompt/composer, and any touched modal or chrome surface are checked.
- `.theme-transitioning === 0` and no stale chunk text are confirmed.
- Record the URL, route or surface, viewport, theme, and any visual issues or pass result in `status.md`.

## Stage One Backfill Runtime / PPT / Ecommerce Gate

Use this broader gate for runtime/PPT/ecommerce follow-up slices when their touched area overlaps generation or PPT runtime. Keep those commits separate from Clay UI commits.

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/ppt-runtime-contract.test.ts" `
  "tests/unit/ppt-runtime-helper-contract.test.ts" `
  "tests/unit/ppt-deck-single-container-contract.test.ts" `
  "tests/unit/generation-runtime-contract.test.ts" `
  "tests/unit/generation-billing-runtime-contract.test.ts"
```

PPT boundary slices also require `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and a path-limited alternate-git `diff --check`.

## Stage Two CanvasContext Split Gate

Use this gate for `src/context/CanvasContext.tsx` splits. Add or narrow targeted tests after the responsibility map identifies the exact boundary; do not use one broad commit for state model, mutations, drag/selection, and persistence at the same time. Stage Two M1 used this gate for the state/default/context boundary plus the separated canvas compatibility helper. Stage Two M2 used the selection reducer contract below. Stage Two M3 uses the prompt child image resolver contract below.

State-boundary targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-startup-local-restore.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts"
```

Selection-reducer targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-selection-runtime-contract.test.ts" `
  "tests/unit/prompt-group-drag-layout.test.ts" `
  "tests/unit/prompt-group-regroup-behavior.test.ts"
```

Prompt-child-image resolver targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-prompt-child-images-runtime-contract.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-startup-local-restore.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts"
```

Minimum architecture split gate:

```powershell
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/context/CanvasContext.tsx" "src/context/canvasContextState.ts" "src/context/canvasCompatibility.ts" "tests/unit" "plans.md" "implement.md" "validation.md" "status.md"
```

If the touched CanvasContext slice affects persistence or workspace layout, include:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/workspace-layout-contract.test.ts"
```

If the touched CanvasContext slice affects live scene, connector positions, or prompt grouping, include:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-live-scene-contract.test.ts" `
  "tests/unit/canvas-connector-throttling-contract.test.ts" `
  "tests/unit/prompt-group-regroup-behavior.test.ts"
```

## Stage One Backfill Generation Gate

Use this gate for the completed `useGenerationRuntime` boundary-hardening slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/generation-runtime-contract.test.ts" `
  "tests/unit/generation-billing-runtime-contract.test.ts"
```

This slice also requires `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and a path-limited alternate-git `diff --check`.

Generation billing follow-ups use the same generation gate and must keep stale App-side generation billing imports out of `src/App.tsx`.

## Stage One Backfill Prompt Group Gate

Use this gate for the active `usePromptGroupLayout` boundary-hardening slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/prompt-group-regroup-behavior.test.ts" `
  "tests/unit/prompt-group-drag-layout.test.ts" `
  "tests/unit/canvas-live-scene-contract.test.ts" `
  "tests/unit/canvas-local-performance-trace-contract.test.ts"
```

This slice also requires `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and a path-limited alternate-git `diff --check`.

## Release Gate

Run these before final sign-off:

```powershell
npm.cmd run governance:check
npm.cmd run spec:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run check:encoding
```

Current known non-code blocker: `npm.cmd run governance:check` fails inside `governance:version` until portable packaging/publish metadata is regenerated so `release/publish/stable/manifest.json` and `release/KK-Studio-Portable/app/dist/app-version.json` have matching `buildTime`. Handle this in the final packaging/publish phase, not inside the current runtime refactor slice.
