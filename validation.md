# KK Studio Validation Matrix

Last updated: 2026-04-29

Use `npm.cmd` on Windows.

## Baseline Commands

- Documentation and agent-rule changes: `npm.cmd run governance:agent-docs`
- Encoding gate: `npm.cmd run check:encoding`
- Type checking: `npm.cmd run typecheck`
- Build: `npm.cmd run build`
- Unit tests: `npm.cmd run test:unit`
- Full local change gate when feasible: `npm.cmd run verify:changes`

## Milestone 1: Recovery Ledger

Commands:

```powershell
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
```

Expected result: both pass. If governance ignores root ledger files, that is acceptable as long as the command exits successfully.

## Milestone 2: Auth, Runtime, Recharge

Targeted tests:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/workspace-auth-gate.test.ts" `
  "tests/unit/login-screen-auth-actions.test.ts" `
  "tests/unit/kk-api-client-session-cookie.test.ts" `
  "tests/unit/kk-api-session-bootstrap.test.ts" `
  "tests/unit/auth-access-token.test.ts" `
  "tests/unit/billing-http-routes.test.ts" `
  "tests/unit/cost-estimation-admin-review-panel.test.ts"
```

API package tests to run when server modules change:

```powershell
node --test "apps/api/src/modules/auth/application/*.test.ts" "apps/api/src/modules/auth/presentation/*.test.ts"
node --test "apps/api/src/modules/billing/*.test.ts" "apps/api/src/modules/billing/**/*.test.ts"
```

Milestone gate:

```powershell
npm.cmd run typecheck
npm.cmd run check:encoding
```

## Milestone 3: Settings And API Capabilities

Targeted tests:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/settings-workbench-ui-refit.test.ts" `
  "tests/unit/api-settings-capability-routing-contract.test.ts" `
  "tests/unit/api-settings-provider-compact-ui-contract.test.ts" `
  "tests/unit/api-settings-capability-layout-regression.test.ts" `
  "tests/unit/ocr-service-settings-contract.test.ts" `
  "tests/unit/prompt-optimizer-capability-route-contract.test.ts"
```

Milestone gate:

```powershell
npm.cmd run typecheck
npm.cmd run check:encoding
```

## Milestone 4: Ecommerce Framework And Scheduler

Targeted tests:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/ecommerce-framework-contract.test.ts" `
  "tests/unit/ecommerce-framework-runtime.test.ts" `
  "tests/unit/ecommerce-framework-runtime-order.test.ts" `
  "tests/unit/ecommerce-confirm-build-flow.test.ts" `
  "tests/unit/ecommerce-composer-scroll-regression.test.ts" `
  "tests/unit/ecommerce-xlsx-parser.test.ts" `
  "tests/unit/prompt-bar-ecommerce-framework-companion.test.ts"
```

Milestone gate:

```powershell
npm.cmd run typecheck
npm.cmd run check:encoding
```

## Milestone 5: PPT Deck Container

Targeted tests:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/ppt-deck-single-container-contract.test.ts"
```

Add or expand tests around `src/utils/pptDeckModules.ts`, PPT preview helpers, and export package helpers before changing production code.

Milestone gate:

```powershell
npm.cmd run typecheck
npm.cmd run check:encoding
```

## Milestone 6: Responsive Result Flow

Targeted tests:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/responsive-surface.test.ts" `
  "tests/unit/mobile-home-three-zone-contract.test.ts" `
  "tests/unit/mobile-result-feed-detail-contract.test.ts" `
  "tests/unit/mobile-result-feed-app-contract.test.ts" `
  "tests/unit/mobile-workspace-surface-contract.test.ts" `
  "tests/unit/app-shell-surface-hook.test.ts" `
  "tests/unit/billing-remaining-balance-contract.test.ts" `
  "tests/unit/mobile-feed-selectors.test.ts"
```

Milestone gate:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:unit
npm.cmd run check:encoding
```

Strict masonry / PromptBar density follow-up:

```powershell
node --test --test-isolation=none `
  "tests/unit/responsive-surface.test.ts" `
  "tests/unit/mobile-home-three-zone-contract.test.ts" `
  "tests/unit/mobile-result-feed-detail-contract.test.ts" `
  "tests/unit/mobile-workspace-surface-contract.test.ts" `
  "tests/unit/app-shell-surface-hook.test.ts" `
  "tests/unit/mobile-result-feed-app-contract.test.ts"
npm.cmd run typecheck
npm.cmd run build
npm.cmd run check:encoding
```

## Smoke Scripts

Run when the touched surface requires browser-level confidence:

```powershell
npm.cmd run verify:prompt-group-drag
npm.cmd run verify:mobile-settings-smoke
npm.cmd run verify:desktop-settings-smoke
npm.cmd run verify:startup-runtime-banner-centering
```

## Post-Merge Review Checks

Run these when touching capability runtime routing, portable payment release packaging, or encoding cleanup:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/capability-route-runtime-preference-contract.test.ts" `
  "tests/unit/prompt-optimizer-capability-route-contract.test.ts" `
  "tests/unit/portable-payment-package-contract.test.ts"
npm.cmd --prefix payment-server ci --omit=dev --ignore-scripts --no-audit --no-fund --dry-run
npm.cmd run typecheck:payment-server
node --test --test-isolation=none "tests/unit/payment-server-compat-bridge.test.ts"
node scripts/release/create-portable-release.mjs
```

After `node scripts/release/create-portable-release.mjs`, verify portable payment TypeScript sources can resolve `pg` from the app-level dependency tree:

```powershell
.\release\KK-Studio-Portable\runtime\node.exe -e "const { createRequire } = require('node:module'); const req = createRequire(require('node:path').resolve('release/KK-Studio-Portable/app/apps/payment-sidecar/src/lib/postgres.ts')); console.log(req.resolve('pg/package.json'));"
```

Expected path includes `release\KK-Studio-Portable\app\node_modules\pg\package.json`.

## Turnstile Auth Widget Repair

Run these when touching Turnstile runtime config, auth CAPTCHA handling, or login/register Turnstile UI:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/turnstile-runtime-config.test.ts" `
  "tests/unit/local-api-turnstile-bypass.test.ts" `
  "tests/unit/auth-http-routes.test.ts" `
  "tests/unit/login-screen-auth-actions.test.ts" `
  "tests/unit/local-env-contract.test.ts"
npm.cmd run typecheck
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
```

## VPS PostgreSQL Login Probe And Client Access Repair

Run these when touching VPS PostgreSQL connection behavior, deployment scripts, or the login persistence probe:

```powershell
node --test --test-isolation=none "tests/unit/vps-deploy-artifacts.test.ts"
node --test --test-isolation=none `
  "tests/unit/vps-deploy-contract.test.ts" `
  "tests/unit/vps-postgres-audit-contract.test.ts" `
  "tests/unit/server-runtime-config.test.ts"
node scripts/dev/run-api-dev.mjs --check
npm.cmd run check:encoding
```

After a VPS shell is available and the remote access-control change is confirmed, dry-run first:

```bash
KK_PG_CLIENT_CIDR="<client-ip-or-cidr>/32" scripts/vps/repair-postgres-client-access.sh
```

Apply only after reviewing the proposed `hostssl` rule:

```bash
KK_PG_CLIENT_CIDR="<client-ip-or-cidr>/32" KK_APPLY_PG_CLIENT_ACCESS=true scripts/vps/repair-postgres-client-access.sh
```

If the live client source keeps changing between probes, validate through an SSH tunnel instead of chasing public `/32` rules. Start a local tunnel from `127.0.0.1:15432` to the VPS `127.0.0.1:5432`, then run the tunnel wrapper:

```powershell
node scripts/dev/run-api-dev-vps-tunnel.mjs --check
```

Use `KK_PG_TUNNEL_HOST` and `KK_PG_TUNNEL_PORT` when the local tunnel uses a non-default host or port. For full runtime confidence, start the API with the tunnel wrapper and verify `http://127.0.0.1:3001/healthz?probe=1` reports `canonicalPersistenceReady: true`.

## Settings Smoke And Admin Recharge Follow-Up

Run these when touching settings direct routes, API simple/advanced mode, settings browser smoke scripts, or the admin recharge review surface:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/admin-credit-lookup-contract.test.ts" `
  "tests/unit/api-settings-provider-compact-ui-contract.test.ts" `
  "tests/unit/mobile-settings-browser-verify-script.test.ts"
npm.cmd run verify:mobile-settings-smoke
npm.cmd run verify:desktop-settings-smoke
npm.cmd run typecheck
npm.cmd run admin:build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
```

## Recharge PostgreSQL Runtime Repair

Run these when touching manual recharge PostgreSQL persistence or VPS recharge table bootstrap behavior:

```powershell
node --test --test-isolation=none `
  "tests/unit/postgres-recharge-submission-repository.test.ts" `
  "tests/unit/vps-postgres-audit-contract.test.ts" `
  "tests/unit/billing-http-routes.test.ts" `
  "apps/api/src/modules/billing/local-static-recharge.test.ts"
npm.cmd run typecheck
npm.cmd run check:encoding
npm.cmd run build
```

For local API settings add-entry changes without admin recharge changes, use this narrower gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/api-settings-local-preset-entry.test.ts" `
  "tests/unit/api-settings-workbench-structure.test.ts" `
  "tests/unit/api-settings-capability-layout-regression.test.ts" `
  "tests/unit/api-settings-stage-semantics.test.ts" `
  "tests/unit/api-settings-simple-mode-contract.test.ts" `
  "tests/unit/api-settings-provider-compact-ui-contract.test.ts" `
  "tests/unit/api-settings-routing-regression.test.ts" `
  "tests/unit/mobile-settings-browser-verify-script.test.ts"
npm.cmd run typecheck
npm.cmd run verify:mobile-settings-smoke
npm.cmd run verify:desktop-settings-smoke
npm.cmd run check:encoding
```

For API settings simple-mode density or unified provider-list changes, also run:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/billing-remaining-balance-contract.test.ts" `
  "tests/unit/frontend-key-boundary-hardening.test.ts" `
  "tests/unit/settings-ui-density-regression.test.ts" `
  "tests/unit/prompt-bar-layout-regression.test.ts"
```

## Final Settings/API Density Close-Out

Run these when closing settings/API simple mode, local API add-entry, BYOK boundary, PromptBar mobile density, or settings density contract changes:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/api-settings-local-preset-entry.test.ts" `
  "tests/unit/api-settings-capability-layout-regression.test.ts" `
  "tests/unit/api-settings-provider-compact-ui-contract.test.ts" `
  "tests/unit/api-settings-routing-regression.test.ts" `
  "tests/unit/api-settings-simple-mode-contract.test.ts" `
  "tests/unit/api-settings-workbench-structure.test.ts" `
  "tests/unit/billing-remaining-balance-contract.test.ts" `
  "tests/unit/dashboard-settings-overview-regression.test.ts" `
  "tests/unit/frontend-key-boundary-hardening.test.ts" `
  "tests/unit/prompt-bar-layout-regression.test.ts" `
  "tests/unit/settings-ui-density-regression.test.ts" `
  "tests/unit/api-server-startup.test.ts" `
  "tests/unit/user-route-diagnostics-routes.test.ts"
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:unit
npm.cmd run check:encoding
npm.cmd run governance:agent-docs
```

## Local API Model Discovery Diagnostics

Run these when touching saved user-route connectivity checks, local API model discovery, or the secure diagnostics path that powers the settings-page `Fetch models` action:

```powershell
node --test --test-isolation=none "tests/unit/user-route-diagnostics-routes.test.ts"
npm.cmd run typecheck
npm.cmd run check:encoding
```

## Official API Default Models

Run these when touching official Google/OpenAI route defaults, official route model helpers in settings, or slot channel config fallback behavior:

```powershell
node --test --test-isolation=none "tests/unit/official-route-default-models.test.ts"
npm.cmd run typecheck
npm.cmd run check:encoding
```

## VPS API Dev Start Fail-Closed

Run these when touching `scripts/dev/dev-launch.ps1`, local API startup policy, remote VPS API routing, auth bootstrap, or manual recharge runtime wiring:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/dev-script-project-root.test.ts" `
  "tests/unit/dev-script-port-owner-guards.test.ts" `
  "tests/unit/dev-start-entrypoint.test.ts" `
  "tests/unit/hosted-release-guardrails.test.ts" `
  "tests/unit/auth-http-routes.test.ts" `
  "tests/unit/login-screen-auth-actions.test.ts" `
  "tests/unit/run-api-dev-config-guards.test.ts" `
  "tests/unit/billing-http-routes.test.ts" `
  "apps/api/src/modules/billing/local-static-recharge.test.ts" `
  "tests/unit/kkai-billing-ui-surface.test.ts"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/dev/dev-launch.ps1 -SkipVite
npm.cmd run governance:agent-docs
npm.cmd run typecheck
npm.cmd run check:encoding
npm.cmd run build
```

Expected runtime smoke: `dev-launch.ps1 -SkipVite` should report a ready remote VPS API when `VITE_KK_API_BASE_URL` is non-local, and `http://<vps-api>/healthz?probe=1` should report `canonicalPersistenceReady: true` with PostgreSQL repository backends.

## Official Defaults And VPS Tunnel Close-Out

Run these when touching official-route default model fallback, auth login/register rule alignment, or VPS API/tunnel dev startup:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/api-settings-local-preset-entry.test.ts" `
  "tests/unit/api-settings-workbench-structure.test.ts" `
  "tests/unit/api-settings-simple-mode-contract.test.ts" `
  "tests/unit/api-settings-routing-regression.test.ts" `
  "tests/unit/official-route-default-models.test.ts" `
  "tests/unit/auth-http-routes.test.ts" `
  "tests/unit/login-screen-auth-actions.test.ts" `
  "tests/unit/dev-script-project-root.test.ts" `
  "tests/unit/run-api-dev-config-guards.test.ts" `
  "tests/unit/canvas-connector-throttling-contract.test.ts" `
  "tests/unit/canvas-local-performance-trace-contract.test.ts" `
  "tests/unit/prompt-group-regroup-behavior.test.ts"
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:unit
npm.cmd run check:encoding
npm.cmd run governance:agent-docs
git diff --check
node --check scripts/dev/run-api-dev-vps-tunnel.mjs
```

## Local Image Proxy Payload Limits

Run these when touching `/api/v1/model-proxy/system`, `/api/v1/model-proxy/user`, secure image proxy payload sizing, or route-specific JSON body limits:

```powershell
node --test --test-isolation=none `\
  "tests/unit/api-server-startup.test.ts" `\
  "tests/unit/user-route-diagnostics-routes.test.ts" `\
  "tests/unit/official-route-default-models.test.ts"
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:unit
npm.cmd run check:encoding
npm.cmd run governance:agent-docs
```

## Canvas Main/Sub Card Surface Parity

Run these when touching canvas prompt-card or image-card surface colors, theme background tokens, or visual source contracts:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/canvas-visual-regression.test.ts"
npm.cmd run typecheck
npm.cmd run build
npm.cmd run check:encoding
npm.cmd run governance:agent-docs
```

## Shared Theme Contrast

Run these when touching global theme tokens, settings panel theme tokens, toolbar/nav/input surfaces, auth theme colors, or contrast source contracts:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/theme-contrast-contract.test.ts" "tests/unit/canvas-visual-regression.test.ts"
npm.cmd run typecheck
npm.cmd run build
npm.cmd run check:encoding
npm.cmd run governance:agent-docs
```

## Mobile Overlay Breakpoints

Run these when touching modal/lightbox/sidebar/search overlays, settings shell compact behavior, canvas mobile positioning, responsive surface helpers, or mobile/tablet breakpoint behavior:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/responsive-surface.test.ts"
npm.cmd run typecheck
npm.cmd run build
npm.cmd run check:encoding
```

## Final Gate

Before declaring the recovery complete:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:unit
npm.cmd run check:encoding
npm.cmd run governance:agent-docs
```
