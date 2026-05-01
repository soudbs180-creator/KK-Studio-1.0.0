# KK-Studio v1.4.2 Clay UI Validation Matrix

Last updated: 2026-05-01

Use `npm.cmd` for npm scripts on Windows.

## Active Clay UI Gate

Run the Clay UI contract suite for every UI-lane change:

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

## Browser Requirement

Browser QA is mandatory for Clay UI changes.

Preferred flow:
1. `npm.cmd run dev:restart`
2. If Vite is unhealthy, run `npm.cmd run build` and serve `dist/` through a stable local static server.
3. Open the app in the Codex in-app Browser and verify both desktop and mobile viewports.

Required browser checks:
- Light theme uses warm cream surfaces with readable dark text.
- Dark theme uses neutral black/gray surfaces, not blue, teal, or indigo canvas.
- Inputs, main cards, sub cards, and framework cards render as controlled frosted material with readable contrast and no heavy shadow.
- SearchPalette, settings/API workbench, `.theme-transitioning === 0`, and no stale chunk text are all confirmed.
- Record the URL, route or surface, viewport, theme, and any visual issues or pass result in `status.md`.

## Release Gate

Run these before sign-off:

```powershell
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
```

## Paused Lane

The runtime/PPT lane is paused and excluded from the Clay UI matrix. Do not mix its tests or files into the UI validation path.
