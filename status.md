# KK Studio Recovery Status

Last updated: 2026-04-28

## Current Position

- Branch: `main`
- Baseline commit: `b630dd8a 00000000000`
- Workspace: `C:\Users\Administrator\Downloads\KK-Studio-1.0.0`
- Current milestone: VPS PostgreSQL login probe repair.
- Milestones 1, 2, 3, 4, 5, and 6 are complete.
- Merge status: local branch `codex/kk-studio-recovery-convergence` is an ancestor of `main`.
- Publish status: local `main` is ahead of `origin/main` by 17 commits after the 2026-04-28 Turnstile repair commit.

## Recovered Sources

The original Codex threads did not reappear in the sidebar, so they are now represented by the consolidated plan:

- `019dcef9-85e8-7240-81b3-3d953da633b7`
- `019dce21-fa3a-7df3-9858-33e9126ac74c`
- `019dca7a-1a34-7260-81d6-144ef5fdbc3a`
- `019dc9f2-c64d-7510-b018-03493bc39fe4`
- `019dcb03-dabe-7693-bf0c-b493ee821a11`

2026-04-28 review result:

- `019dcef9-85e8-7240-81b3-3d953da633b7`: represented by Milestone 6, multi-device result flow and mobile density. No thread-specific code gap found.
- `019dce21-fa3a-7df3-9858-33e9126ac74c`: represented by Milestone 5, PPT deck single-container workflow. Contract validation passed; no separate manual PPT product sign-off is recorded.
- `019dca7a-1a34-7260-81d6-144ef5fdbc3a`: represented by Milestone 2, login/auth/VPS PostgreSQL/recharge runtime. No thread-specific code gap found.
- `019dc9f2-c64d-7510-b018-03493bc39fe4`: represented by Milestone 3, settings and API capability workbench. Automated gates pass; manual UI acceptance remains an external product review item.
- `019dcb03-dabe-7693-bf0c-b493ee821a11`: represented by Milestone 4, ecommerce framework runtime. No thread-specific code gap found.

## Dirty Worktree Snapshot

Snapshot command: `git status --short`

- Total dirty entries: 515
- Tracked dirty entries: 403
- Untracked entries: 112
- Deleted-file markers: 146

Risk classes observed:

- Runtime/auth/billing/API: VPS PostgreSQL migration, Supabase removal, browser sessions, request authentication, model proxy, payment sidecar, recharge services.
- Settings/API configuration: settings workbench, API capability routing, OCR settings, prompt optimizer settings, settings tests.
- Ecommerce: framework runtime, import/review panels, composer scroll, task cards, XLSX parsing, ecommerce contract tests.
- PPT/App decomposition: canvas/app shell split files, PPT preview/export helpers, PPT deck module utilities.
- Mobile/responsive: mobile result tiles/detail screens, feed selectors, workspace surface, responsive utilities.
- Governance/scripts/docs: architecture checks, deployment scripts, hosted release docs, data registry docs.
- Local sensitive or generated files: `.codex-tmp-vps-key*`, `.codex-ssh-*`, `.codex-tmp-ssh-askpass.cmd`, `.tmp/`. These must remain out of commits and any exposed credentials must be rotated outside source control.

## Completed In This Session

- Created recovery branch `codex/kk-studio-recovery-convergence`.
- Loaded execution, TDD, verification, worktree, and parallel-agent rules.
- Created `plans.md`, `implement.md`, `status.md`, and `validation.md`.
- Validated Milestone 1 with governance and encoding checks.
- Committed Milestone 1 as `b1c4f983 docs: establish recovery convergence ledger`.
- Dispatched GPT-5.5 xhigh read-only explorer agents for:
  - auth/runtime/recharge,
  - settings/API capability architecture,
  - ecommerce framework/runtime,
  - PPT deck workflow,
  - responsive result flow.

## Completed In 2026-04-28 Post-Merge Review

- Confirmed current branch is `main`.
- Confirmed `codex/kk-studio-recovery-convergence` has been merged into `main`.
- Confirmed there are no local branches left unmerged into `main`.
- Confirmed `main` is ahead of `origin/main` and not behind it.
- Re-reviewed the five referenced Codex threads against `plans.md`, this status file, validation evidence, and git history.
- Fixed remaining mojibake in runtime-visible text, prompt optimization keyword detection, comments, and source-guard test literals.
- Converted intentional mojibake guard samples to Unicode escapes where practical so source files no longer contain raw corrupted text.
- Fixed post-merge review blockers:
  - Portable payment release packages `sidecar_compat_bridge.js`, the payment sidecar TypeScript runtime closure, app-level `package.json` with ESM mode, and `pg` in `app/node_modules`.
  - Capability route runtime selection now ignores disabled capability assignments, including stale per-mode key memory and stale assistant `@route` model selections.
  - Additional mojibake/control-character residues were removed from source, tests, release smoke scripts, and credits documentation.
- Added root ignore rules for `.codex-tmp-*`, `.codex-ssh-*`, and `.tmp/` so local key/tunnel artifacts and planning previews are not accidentally staged.

## Completed In 2026-04-28 Turnstile Repair

- Created local branch `codex/fix-turnstile-widget` from `main`; final commit landed on `main` after the branch context was superseded.
- Investigated Turnstile widget behavior in `src/config/turnstile.ts`, `src/components/auth/TurnstileWidget.tsx`, and `src/components/auth/LoginScreen.tsx`.
- Added a failing regression contract showing that `TURNSTILE_SITE_KEY` must come from explicit runtime configuration.
- Removed the built-in Turnstile site key fallback so missing `VITE_TURNSTILE_SITE_KEY` is surfaced as configuration error instead of rendering a broken Cloudflare widget.
- Updated `plans.md` and `validation.md` with the Turnstile repair milestone and validation commands.

## Completed In 2026-04-28 VPS PostgreSQL Login Probe Repair

- Investigated the login path from `LoginScreen` through KK API password auth, browser session bootstrap, and VPS PostgreSQL persistence.
- Confirmed auth/runtime regression tests pass locally.
- Found the first live VPS database probe failure was caused by PostgreSQL rejecting non-SSL connections.
- Added a regression test proving public `DATABASE_URL` PostgreSQL hosts must use SSL automatically.
- Updated `apps/api/src/lib/postgres.ts` so `DATABASE_URL` connections to public hosts use SSL by default while local/private database hosts can remain non-SSL.
- Confirmed the live probe now reaches PostgreSQL with SSL but is still rejected by server-side `pg_hba.conf` access control for the current client source.
- Attempted read-only SSH inspection of the VPS, but the existing local temporary SSH key files are unreadable by the current Windows ACLs.

## Completed In 2026-04-28 Responsive Result Flow Follow-Up

- Moved detail-screen low-frequency actions behind a secondary more menu so the first row stays focused on continue-create and original preview.
- Moved ecommerce edit/confirm/follow-up actions out of the detail content stack and into the same secondary action area.
- Switched the compact result feed from fixed grid rows to adaptive CSS columns driven by the shared responsive column utility.
- Made the standard/detail mode switch available on phone-sized result feeds instead of hiding it below the `sm` breakpoint.
- Updated the milestone validation matrix with the additional responsive, shell, and billing-header contract tests used for this follow-up.

## Validation Results

Milestone 1:

- Passed: `npm.cmd run governance:agent-docs`
- Passed: `npm.cmd run check:encoding`

Milestone 2:

- Passed: auth/runtime/recharge target tests:
  - `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/workspace-auth-gate.test.ts" "tests/unit/login-screen-auth-actions.test.ts" "tests/unit/kk-api-client-session-cookie.test.ts" "tests/unit/kk-api-session-bootstrap.test.ts" "tests/unit/auth-access-token.test.ts" "tests/unit/billing-http-routes.test.ts" "tests/unit/cost-estimation-admin-review-panel.test.ts"`
  - `node --test --test-isolation=none "apps/api/src/modules/auth/application/*.test.ts" "apps/api/src/modules/auth/presentation/*.test.ts"`
  - `node --test --test-isolation=none "apps/api/src/modules/billing/*.test.ts" "apps/api/src/modules/billing/**/*.test.ts"`
  - `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/server-runtime-config.test.ts" "tests/unit/kk-api-server-health-vps-contract.test.ts" "tests/unit/vps-postgres-audit-contract.test.ts" "tests/unit/payment-runtime-hardening.test.ts" "tests/unit/payment-server-status-route.test.ts"`
- Passed: mobile contract compatibility tests required to unblock global typecheck.
- Passed: `npm.cmd run typecheck`
- Passed: `npm.cmd run check:encoding`
- Committed: `e27ba63a feat: converge self-hosted auth runtime and recharge`

Milestone 3:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/settings-workbench-ui-refit.test.ts" "tests/unit/api-settings-capability-routing-contract.test.ts" "tests/unit/api-settings-provider-compact-ui-contract.test.ts" "tests/unit/api-settings-capability-layout-regression.test.ts" "tests/unit/ocr-service-settings-contract.test.ts" "tests/unit/prompt-optimizer-capability-route-contract.test.ts"`
- Committed: `ba91977e feat: unify settings API capability workbench`

Milestone 4:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/ecommerce-framework-contract.test.ts" "tests/unit/ecommerce-framework-runtime.test.ts" "tests/unit/ecommerce-framework-runtime-order.test.ts" "tests/unit/ecommerce-confirm-build-flow.test.ts" "tests/unit/ecommerce-composer-scroll-regression.test.ts" "tests/unit/ecommerce-xlsx-parser.test.ts" "tests/unit/prompt-bar-ecommerce-framework-companion.test.ts"`
- Passed after fixing remote provider lane fairness in `resolveEcommerceFrameworkDispatchPlan`.
- Passed: `npm.cmd run typecheck`
- Passed: `npm.cmd run check:encoding`
- Committed: `17b4b573 feat: add ecommerce framework runtime`

Milestone 5:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/ppt-deck-single-container-contract.test.ts"`
- Passed: `npm.cmd run typecheck`
- Passed: `npm.cmd run check:encoding`
- Committed: `edbc09aa docs: record ppt deck milestone validation`

Milestone 6:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/responsive-surface.test.ts" "tests/unit/mobile-result-feed-detail-contract.test.ts" "tests/unit/mobile-result-feed-app-contract.test.ts" "tests/unit/mobile-workspace-surface-contract.test.ts" "tests/unit/mobile-feed-selectors.test.ts"`
- Passed: `npm.cmd run typecheck`
- Passed: `npm.cmd run build`
- Passed after fixing legacy unit blockers: `npm.cmd run test:unit`
- Passed: `npm.cmd run check:encoding`

Final gate:

- Passed: `npm.cmd run typecheck`
- Passed: `npm.cmd run build`
- Passed: `npm.cmd run test:unit`
- Passed: `npm.cmd run check:encoding`

2026-04-28 post-merge review validation:

- Passed: `npm.cmd run governance:agent-docs`
- Passed: `npm.cmd run check:encoding`
- Passed: targeted encoding guard tests:
  - `tests/unit/login-screen-auth-actions.test.ts`
  - `tests/unit/api-settings-encoding-guard.test.ts`
  - `tests/unit/api-settings-view-source-guard.test.ts`
- Passed: `npm.cmd run typecheck`
- Passed: `npm.cmd run build`
- Passed: `npm.cmd run test:unit` (`933/933` tests)
- Passed: custom tracked-source mojibake scan excluding the encoding blacklist script (`0` hits)

2026-04-28 post-merge blocker validation:

- Passed: targeted capability, portable payment, ecommerce metadata, and mobile selector tests (`19/19` tests):
  - `tests/unit/capability-route-runtime-preference-contract.test.ts`
  - `tests/unit/prompt-optimizer-capability-route-contract.test.ts`
  - `tests/unit/portable-payment-package-contract.test.ts`
  - `tests/unit/ecommerce-framework-runtime.test.ts`
  - `tests/unit/ecommerce-prompt-node-metadata.test.ts`
  - `tests/unit/mobile-feed-selectors.test.ts`
- Passed: `npm.cmd --prefix payment-server ci --omit=dev --ignore-scripts --no-audit --no-fund --dry-run`
- Passed: `npm.cmd run typecheck:payment-server`
- Passed: `node --test --test-isolation=none tests/unit/payment-server-compat-bridge.test.ts` (`5/5` tests)
- Passed: `node scripts/release/create-portable-release.mjs`
- Passed: portable `pg` resolution probe from `release/KK-Studio-Portable/app/apps/payment-sidecar/src/lib/postgres.ts` to `release/KK-Studio-Portable/app/node_modules/pg/package.json`
- Passed: `npm.cmd run governance:agent-docs`
- Passed: `npm.cmd run check:encoding`
- Passed: `npm.cmd run typecheck`
- Passed: `npm.cmd run build`
- Passed: `npm.cmd run test:unit` (`936/936` tests)

2026-04-28 Turnstile repair validation:

- Passed: targeted Turnstile/auth tests (`16/16` tests):
  - `tests/unit/turnstile-runtime-config.test.ts`
  - `tests/unit/local-api-turnstile-bypass.test.ts`
  - `tests/unit/auth-http-routes.test.ts`
  - `tests/unit/login-screen-auth-actions.test.ts`
  - `tests/unit/local-env-contract.test.ts`
- Passed: `npm.cmd run typecheck`
- Passed: `npm.cmd run build`
- Passed: `npm.cmd run governance:agent-docs`
- Passed: `npm.cmd run check:encoding`

2026-04-28 VPS PostgreSQL login probe validation:

- Red/green verified: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/server-runtime-config.test.ts`
- Passed: auth/runtime regression tests (`38/38` tests):
  - `tests/unit/workspace-auth-gate.test.ts`
  - `tests/unit/login-screen-auth-actions.test.ts`
  - `tests/unit/kk-api-client-session-cookie.test.ts`
  - `tests/unit/kk-api-session-bootstrap.test.ts`
  - `tests/unit/auth-access-token.test.ts`
  - `tests/unit/billing-http-routes.test.ts`
  - `tests/unit/cost-estimation-admin-review-panel.test.ts`
  - `tests/unit/server-runtime-config.test.ts`
- Passed: `npm.cmd run typecheck`
- Passed: `npm.cmd run check:encoding`
- Live VPS probe: SSL is now enabled by app config, but PostgreSQL still rejects the client via `pg_hba.conf`; remote access-control repair remains blocked on usable VPS SSH access.
- Added dry-run-first helper `scripts/vps/repair-postgres-client-access.sh` for inspecting and appending a narrow `hostssl` client rule after a VPS shell is available.
- Red/green verified: `node --test --test-isolation=none tests/unit/vps-deploy-artifacts.test.ts`
- Passed: `node --test --test-isolation=none tests/unit/vps-deploy-contract.test.ts tests/unit/vps-postgres-audit-contract.test.ts tests/unit/server-runtime-config.test.ts` (`17/17` tests)
- Attempted a read-only SSH check through the existing local askpass helper without reading its contents; no usable VPS shell was established.

2026-04-28 responsive result flow follow-up validation:

- Passed: targeted responsive/mobile/billing contract tests (`19/19` tests):
  - `tests/unit/responsive-surface.test.ts`
  - `tests/unit/mobile-home-three-zone-contract.test.ts`
  - `tests/unit/mobile-result-feed-detail-contract.test.ts`
  - `tests/unit/mobile-workspace-surface-contract.test.ts`
  - `tests/unit/app-shell-surface-hook.test.ts`
  - `tests/unit/mobile-result-feed-app-contract.test.ts`
  - `tests/unit/billing-remaining-balance-contract.test.ts`
- Passed: `npm.cmd run typecheck`
- Passed: `npm.cmd run check:encoding`
- Passed: `npm.cmd run build`

## In Progress

- VPS PostgreSQL login probe repair is code-complete locally, including a dry-run `pg_hba.conf` repair helper.
- Remote PostgreSQL access-control repair remains blocked because the existing temporary SSH key files cannot be read under the current Windows ACLs and the askpass-based SSH attempt did not establish a shell.
- Existing unrelated settings/API, admin/API, mobile, and CSS dirty files remain outside this auth/PostgreSQL scope.

## Known Risks And Blockers To Verify

- Prior sessions exposed operational credentials; rotate them and do not commit local key/tunnel files.
- Supabase deletion and PostgreSQL replacement must be validated together to avoid leaving private front-end Supabase paths.
- Local `main` is ahead of `origin/main`; push status must be handled separately when publishing is desired.
- Unrelated dirty files are present and must not be staged in the VPS PostgreSQL login probe commit unless explicitly requested. Currently observed examples:
  - `apps/admin/src/pages/RechargeSubmissionsPage.tsx`
  - `src/components/mobile/MobileResultDetailScreen.tsx`
  - `src/components/mobile/MobileResultFeed.tsx`
  - `src/components/settings/ApiSettingsView.tsx`
  - `src/components/settings/apiWorkbenchSections.tsx`
  - `src/index.css`
- Ignored local files remain on disk: `.codex-tmp-vps-key*`, `.codex-ssh-*`, `.codex-tmp-ssh-askpass.cmd`, and `.tmp/`. They are excluded from ordinary Git status; deleting them requires explicit user confirmation.
- Current VPS PostgreSQL status: the app can configure SSL, but the server still needs a `hostssl` rule or equivalent firewall/tunnel path that permits the current client source to reach database `kkstudio` as `kkstudio_app`. The current rejected source observed from PostgreSQL is `13.208.210.0`; use the confirmed CIDR, ideally `/32`, before applying any `pg_hba.conf` rule.
- Manual product acceptance is still not recorded for real-device mobile touch feel, external login callback behavior, and final settings/PPT visual acceptance.

## Next Steps

1. Get a usable VPS shell, then run `KK_PG_CLIENT_CIDR="<client-cidr>" scripts/vps/repair-postgres-client-access.sh` as a dry-run.
2. After reviewing the proposed `hostssl` rule and receiving action-time confirmation, run the same script with `KK_APPLY_PG_CLIENT_ACCESS=true`.
3. Rerun `node scripts/dev/run-api-dev.mjs --check` and `http://127.0.0.1:3001/healthz?probe=1` after the server-side rule is fixed.
4. Keep unrelated dirty files out of the auth/PostgreSQL commit unless explicitly requested.
