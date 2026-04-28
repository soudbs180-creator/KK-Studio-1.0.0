# KK Studio Recovery Convergence Plan

Last updated: 2026-04-29
Branch: `main` (current user instruction: do not create or switch branches)

## Summary

This plan merges five lost Codex work streams into one executable recovery line. The priority is to preserve the current dirty worktree, document the recovery baseline, then converge login/self-hosted runtime/recharge, settings/API architecture, ecommerce framework cards, PPT deck containers, and responsive result flows. The historical recovery branch has already been merged; remaining close-out work continues directly on `main` without creating new branches.

No existing uncommitted work may be reset or overwritten. Every milestone must produce tests or source contracts first, implementation second, validation third, status updates fourth, and a scoped git commit last.

## Recovered Thread Sources

- `codex://threads/019dcef9-85e8-7240-81b3-3d953da633b7`
- `codex://threads/019dce21-fa3a-7df3-9858-33e9126ac74c`
- `codex://threads/019dca7a-1a34-7260-81d6-144ef5fdbc3a`
- `codex://threads/019dc9f2-c64d-7510-b018-03493bc39fe4`
- `codex://threads/019dcb03-dabe-7693-bf0c-b493ee821a11`

These threads are treated as historical input. The canonical continuation point is this plan plus `implement.md`, `status.md`, and `validation.md`.

## Milestones

### 1. Recovery Baseline And Engineering Ledger

Goal: establish durable project control files and record the current dirty worktree before touching feature code.

Scope:
- Create and maintain `plans.md`, `implement.md`, `status.md`, and `validation.md`.
- Record branch, baseline commit, dirty worktree risk classes, recovered thread ids, validation policy, and secret-handling rules.
- Identify local files that may contain sensitive material, without copying secret values into docs.

Acceptance:
- The four ledger files explain what was recovered, what is next, and how validation is run.
- `status.md` includes current dirty worktree counts and risk classification.
- Credentials exposed in prior sessions are flagged for rotation or cleanup outside source control.
- Only the four ledger files are staged for the milestone commit.

Validation:
- `npm.cmd run governance:agent-docs`
- `npm.cmd run check:encoding`

### 2. Login, VPS PostgreSQL, Self-Hosted Runtime, Manual Recharge

Goal: make auth and billing runtime coherent without front-end private Supabase paths.

Scope:
- Restore mandatory login gating and 30-day browser session recovery.
- Align KK API session bootstrap with VPS API and PostgreSQL-backed runtime.
- Complete manual recharge flow: user creates order, marks paid, admin reviews in floating/admin surface, credits are posted idempotently.
- Keep Supabase migration/deletion boundaries consistent with the PostgreSQL runtime.

Acceptance:
- Unauthenticated users always land on the login screen.
- Login state can restore through the KK API session path.
- Recharge orders bind to a real `userId`.
- Repeated admin approval or webhook/review attempts cannot duplicate credits.
- No front-end code directly reaches private Supabase tables or functions.

Validation:
- Targeted auth/session/billing/recharge/admin tests.
- `npm.cmd run typecheck`
- `npm.cmd run check:encoding`

### 3. Settings UI And API Configuration Architecture

Goal: keep the settings workbench routing model while simplifying API configuration around unified route pools and capability roles.

Scope:
- Align Overview, API, Billing, Storage, and Logs visual language.
- Remove duplicate settings entries and mobile ambiguity.
- Convert API setup to a compact "route pool + capability roles" model.
- Support official API defaults plus proxy providers with vendor name, base URL, API key, model discovery, and billing limits.
- Configure prompt optimization and OCR as independent capabilities shared by assistant and generation flows.

Acceptance:
- Settings has one canonical entry path and no duplicate route surface.
- Toggle/switch controls do not overflow in desktop, tablet, or mobile layouts.
- Mobile settings exposes four clear high-level entries.
- API capability assignment saves, restores, and stays compact.
- Prompt optimizer and OCR settings are independently persisted and routable.

Validation:
- Settings workbench and API capability contract tests.
- OCR and prompt optimizer capability tests.
- `npm.cmd run typecheck`
- `npm.cmd run check:encoding`

### 4. Ecommerce Framework Card And Batch Scheduler

Goal: represent ecommerce work as one framework card on canvas while preserving independent task cards inside the framework runtime.

Scope:
- Create one primary framework card for ecommerce batch work.
- Move main image, A+ group shell, and task cards inside that framework.
- Add framework runtime queue with adaptive concurrency per provider/API capability.
- Support pause/resume and page switches without losing progress.
- Preserve in-flight API requests rather than force-killing them.
- Keep a lightweight mobile continuation surface and fix scroll height / duplicate warning regressions.

Acceptance:
- Confirm build creates one main framework entry on the canvas.
- Internal task cards remain viewable and individually inspectable.
- Multiple API providers schedule stably with clear pause/resume/cancel semantics.
- Page switch and restore keep progress.
- Mobile continuation does not duplicate warnings and scrolls correctly.

Validation:
- Ecommerce framework contract/runtime/order tests.
- Confirm build flow, composer scroll, XLSX parser, and warning dedupe tests.
- `npm.cmd run typecheck`
- `npm.cmd run check:encoding`

### 5. PPT BananaSlides Flow And Modular Deck Container

Goal: make PPT mode a single deck workflow, not scattered main-card/sub-card results.

Scope:
- Implement a BananaSlides-like flow: theme/import, outline, page descriptions, preview generation, per-page editing, export.
- Show only one PPT deck container on canvas.
- Move page images into internal module panels or a lightbox.
- Reuse the ecommerce module-card idea but restyle for KK Studio PPT needs.
- Preserve compatibility for existing `pptSlides` data.

Acceptance:
- PPT generation result is a single canvas deck.
- Page modules can be viewed, edited, regenerated, and exported.
- Legacy `pptSlides` data can still be read.
- PPT UI fits KK Studio styling rather than copying ecommerce visuals directly.

Validation:
- PPT deck single-container contract tests.
- PPT module utility tests.
- Export/package tests where applicable.
- `npm.cmd run typecheck`
- `npm.cmd run check:encoding`

### 6. Multi-Device Result Flow And Mobile Density

Goal: unify phone/tablet/desktop result surfaces across standard, ecommerce, and PPT modes.

Scope:
- Normalize breakpoints: phone `<= 768`, tablet `769-1024`, desktop `>= 1025`.
- Use one card-feed model for standard, ecommerce, and PPT results.
- Standard mode uses masonry; detail mode uses one-column large imagery.
- Keep credit chips on one line.
- Move low-frequency actions into secondary menus.
- Keep only high-frequency actions such as details and continue creation at list level.

Acceptance:
- 768, 769, 1024, and 1025 boundaries behave consistently.
- Phone buttons do not crowd or wrap badly.
- Ecommerce and standard results no longer maintain two mobile browsing implementations.
- PPT results use the same responsive surface model.

Validation:
- Responsive surface tests.
- Mobile result feed detail/app tests.
- Mobile workspace surface tests.
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run test:unit`
- `npm.cmd run check:encoding`

### 7. Turnstile Runtime Configuration Repair

Goal: prevent the login/register Turnstile widget from silently using an invalid or domain-bound built-in site key when the deployment has not provided `VITE_TURNSTILE_SITE_KEY`.

Scope:
- Remove the built-in Turnstile site key fallback from the frontend runtime config.
- Keep the local bypass opt-in behavior unchanged.
- Add a source-contract regression test covering explicit site key configuration.
- Verify the auth and Turnstile test surface after the change.

Acceptance:
- `TURNSTILE_SITE_KEY` resolves only from explicit runtime configuration.
- Missing `VITE_TURNSTILE_SITE_KEY` is reported as a configuration problem instead of attempting to render a broken Cloudflare widget.
- Existing local bypass behavior remains opt-in and local-only.

Validation:
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/turnstile-runtime-config.test.ts" "tests/unit/local-api-turnstile-bypass.test.ts" "tests/unit/auth-http-routes.test.ts" "tests/unit/login-screen-auth-actions.test.ts" "tests/unit/local-env-contract.test.ts"`
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run governance:agent-docs`
- `npm.cmd run check:encoding`

### 8. VPS PostgreSQL Client Access Repair

Goal: finish the live login path by allowing the intended API/client source to reach the VPS PostgreSQL database through a narrow `pg_hba.conf` rule.

Scope:
- Keep application-side PostgreSQL SSL behavior intact for public `DATABASE_URL` hosts.
- Add a dry-run-first VPS helper for inspecting and appending a scoped `hostssl` rule.
- Require an explicit client CIDR and an explicit apply flag before modifying `pg_hba.conf`.
- Re-run the local API startup probe after the VPS server-side rule is repaired.

Acceptance:
- `scripts/vps/repair-postgres-client-access.sh` defaults to dry-run and refuses to run without `KK_PG_CLIENT_CIDR`.
- The proposed rule targets `kkstudio` / `kkstudio_app` by default and can be overridden by env.
- The script backs up `pg_hba.conf` before appending and reloads PostgreSQL through `pg_reload_conf()`.
- `node scripts/dev/run-api-dev.mjs --check` passes after the remote PostgreSQL access rule is applied.

Validation:
- `node --test --test-isolation=none "tests/unit/vps-deploy-artifacts.test.ts"`
- `node --test --test-isolation=none "tests/unit/vps-deploy-contract.test.ts" "tests/unit/vps-postgres-audit-contract.test.ts" "tests/unit/server-runtime-config.test.ts"`
- `node scripts/dev/run-api-dev.mjs --check` after VPS access-control repair.
- `npm.cmd run check:encoding`

### 9. VPS API Dev Start Fail-Closed Runtime

Goal: keep local development pointed at the real VPS API/PostgreSQL runtime and prevent a local-only API from masking database access failures.

Scope:
- Detect non-local `VITE_KK_API_BASE_URL` during `dev:start` and verify the remote API through `/healthz?probe=1`.
- Do not start `run-api-local.mjs` after PostgreSQL preflight failure unless `-AllowLocalOnlyFallback` is explicitly requested.
- Refresh setup docs and env examples so active runtime setup references VPS API/PostgreSQL, not Supabase.
- Verify login/auth, manual recharge/admin handling, dev launcher, hosted guardrails, typecheck, build, and encoding.

Acceptance:
- `dev-launch.ps1 -SkipVite` reports the configured remote VPS API as ready when `VITE_KK_API_BASE_URL` points off localhost.
- Local-only fallback is opt-in and clearly labeled.
- Frontend on `127.0.0.1:3000` uses the VPS API path for login, billing, workspace persistence, and admin operations.
- The VPS `/healthz?probe=1` reports `canonicalPersistenceReady: true` and PostgreSQL repository backends.

Validation:
- Dev launcher and hosted guardrail contract tests.
- Auth, runtime wrapper, billing, manual recharge, and admin recharge UI contract tests.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/dev/dev-launch.ps1 -SkipVite`
- `npm.cmd run governance:agent-docs`
- `npm.cmd run typecheck`
- `npm.cmd run check:encoding`
- `npm.cmd run build`

### 10. Canvas Main/Sub Card Surface Parity

Goal: align the canvas main prompt card surface with the sub image card surface in both dark and light themes.

Scope:
- Replace the prompt card's darker translucent fill with the same `--bg-surface` theme token used by image cards.
- Keep card layout, shadows, borders, drag behavior, and content rendering unchanged.
- Add a focused visual source contract so future changes do not reintroduce a darker prompt-card-only fill.

Acceptance:
- Dark mode prompt cards use the same gray surface token as image cards.
- Light mode prompt cards use the same white surface token as image cards.
- Existing canvas visual contracts remain green.

Validation:
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/canvas-visual-regression.test.ts"`
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run check:encoding`
- `npm.cmd run governance:agent-docs`

### 11. Shared Theme Contrast Audit

Goal: ensure the shared app, settings, toolbar, navigation, input, and auth surfaces keep readable text contrast in light, dark, and system-resolved themes.

Scope:
- Add a broad source-contract contrast test for global theme surfaces, settings panel surfaces, settings navigation glass, and light auth support text.
- Keep the previous canvas-card parity intact.
- Adjust only low-contrast shared text tokens and auth support colors.

Acceptance:
- Global light/dark `primary`, `secondary`, and `tertiary` text tokens meet normal text contrast on common app surfaces, inputs, and toolbars.
- Settings light/dark text tokens meet normal text contrast on section cards, elevated cards, overlays, inputs, secondary buttons, and navigation glass.
- Light auth helper text and placeholders remain readable on light auth surfaces.

Validation:
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/theme-contrast-contract.test.ts" "tests/unit/canvas-visual-regression.test.ts"`
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run check:encoding`
- `npm.cmd run governance:agent-docs`

## Final Gate

After all milestones are complete:

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run test:unit`
- `npm.cmd run check:encoding`
- Additional smoke scripts listed in `validation.md` when affected.
