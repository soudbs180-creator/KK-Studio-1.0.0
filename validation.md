# KK-Studio v1.4.2 Dual-Lane Validation Matrix

Last updated: 2026-05-02

Use `npm.cmd` for npm scripts on Windows.

## Active Ecommerce Requirement Analysis Runtime Gate

Use this gate for the active ecommerce requirement analysis runtime extraction:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/ecommerce-requirement-analysis-runtime-contract.test.ts" `
  "tests/unit/ecommerce-analysis-button-gate.test.ts" `
  "tests/unit/ecommerce-upload-removal-contract.test.ts" `
  "tests/unit/ecommerce-task-state-runtime-contract.test.ts" `
  "tests/unit/ecommerce-sheet-settings-runtime-contract.test.ts" `
  "tests/unit/ecommerce-model-policy.test.ts" `
  "tests/unit/ecommerce-task-services.test.ts" `
  "tests/unit/ecommerce-confirm-build-flow.test.ts" `
  "tests/unit/ecommerce-runtime-contract.test.ts" `
  "tests/unit/prompt-optimizer-service-source-contract.test.ts"
```

Runtime commits also require `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and a path-limited `git diff --check` unless `status.md` records a specific blocker.

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

## Runtime / PPT / Ecommerce Gate

Use this broader gate for runtime/PPT/ecommerce follow-up slices when their touched area overlaps generation or PPT runtime. Keep those commits separate from Clay UI commits.

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/ppt-runtime-contract.test.ts" `
  "tests/unit/ppt-runtime-helper-contract.test.ts" `
  "tests/unit/ppt-deck-single-container-contract.test.ts" `
  "tests/unit/generation-runtime-contract.test.ts" `
  "tests/unit/generation-billing-runtime-contract.test.ts"
```

## Release Gate

Run these before sign-off:

```powershell
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
```
