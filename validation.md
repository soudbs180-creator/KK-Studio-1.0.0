# KK-Studio v1.4.8 Single-Line Validation Matrix

Last updated: 2026-05-24

Use `npm.cmd` for npm scripts on Windows.

## Current 1.4.8 Mobile Pin Interaction and Unused Gesture Cleanup Gate

Use this gate when touching mobile model lists, PromptBar UI gestures, or unused gesture tests:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ui-unused-cleanup-contract.test.ts
npm.cmd run typecheck
npm.cmd run governance:check
npm.cmd run check:encoding
npm.cmd run build
npm.cmd run verify:changes
```

Expected result: The mobile model selection cards render a direct toggle pin button (📌 / 📍) instead of conflicting swipe gestures, the `PromptBar` source code is completely free of legacy touch variables and handler boilerplate (preventing gesture/scroll collisions), and all three contract tests in `ui-unused-cleanup-contract.test.ts` pass cleanly along with typecheck, encoding and build pipelines.

Fresh result on 2026-05-24: `ui-unused-cleanup-contract.test.ts` passed 3/3, `npm.cmd run typecheck` passed, `npm.cmd run governance:check` passed, `npm.cmd run check:encoding` passed, and `npm.cmd run build` successfully bundled the frontend. All changes align with the Clay UI 3.0 design specification.

## Current User API Secret Boundary Gate

Use this gate when touching user BYOK/API settings persistence, KeyManager cloud/local payload sync, provider storage, or browser secret-boundary checks:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/key-manager-cloud-sync.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/key-manager-dead-code-pruning-contract.test.ts tests/unit/user-api-view-state.test.ts tests/unit/runtime-legacy-fallback-guards.test.ts tests/unit/auth-data-routes.test.ts tests/unit/file-auth-data-repository.test.ts
npm.cmd run governance:security
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerProviders.ts src/components/settings/ApiSettingsView.tsx src/services/api/userApiViewState.ts src/vite-env.d.ts scripts/governance/check-sensitive-boundaries.mjs tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/key-manager-cloud-sync.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/key-manager-dead-code-pruning-contract.test.ts tests/unit/user-api-view-state.test.ts plans.md implement.md status.md validation.md
```

Expected result: raw user API secrets are never persisted to browser `localStorage` for logged-in, temp, or sessionless local users; local/temp BYOK edits require a reachable persistent local API bridge; server reads return placeholders; system/provider keys remain backend-side; unallowlisted `VITE_*KEY/SECRET/TOKEN` frontend env names fail governance; and cloud/profile reads stay backup/readonly-safe rather than exposing raw secrets to the browser.

Fresh result on 2026-05-22: the targeted security boundary suite passed 50/50, `npm.cmd run governance:security` passed, `npm.cmd run typecheck` passed, `npm.cmd run test:unit` passed 1471/1471, `npm.cmd run build` passed and produced `dist/assets/index-DMW4Ppn9.js`, `npm.cmd run governance:agent-docs` passed, `npm.cmd run check:encoding` passed, and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.

Production result on 2026-05-22: `cmd /c npx vercel deploy --prod --yes` created `https://kk-studio-bikxw95np-yykks-projects-727e9560.vercel.app`; the deploy status query initially ended with a transient socket hang up, but `vercel inspect` confirmed deployment `dpl_D8tgr52sz26mshnG34Dd3LoJiJPW` became Production / Ready. `vercel alias set` moved `https://kkai.plus` and `https://www.kkai.plus` to that deployment. Live `app-version.json` returns build time `2026-05-22T06:58:20.303Z`; `/healthz`, `/api/healthz`, and direct VPS `/healthz` return `200`; active credit-model endpoints still return `items: []` until a real admin provider key/model row is saved.

## Current Admin Credit-Provider Bootstrap Gate

Use this gate when touching the admin provider editor, active credit-provider DTO mapping, or the empty active-model configuration path:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/admin-providers-page.test.ts
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/credit-provider-routes.test.ts
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/postgres-credit-provider-repository.test.ts
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/admin-model-service-credit-routes.test.ts
npm.cmd run admin:build
npm.cmd run typecheck
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- apps/admin/src/features/providers/providerEditorModel.ts apps/admin/src/pages/AdminProvidersPage.tsx apps/admin/src/styles/admin.css apps/api/src/modules/model-catalog/infrastructure/postgres-credit-provider-repository.ts apps/api/src/modules/model-catalog/infrastructure/in-memory-credit-provider-repository.ts packages/contracts/src/dto/model-catalog.ts tests/unit/admin-providers-page.test.ts plans.md implement.md status.md validation.md
```

Expected result: empty admin credit-provider state has a visible bootstrap path, new API keys are accepted only through a write-only editor field, retained raw keys are never rendered, `gemini-3.1-flash-image-preview` is the default ecommerce-ready system route draft, and admin save payloads preserve priority/weight.

Fresh result on 2026-05-22: RED confirmed the missing bootstrap helper, then a second RED confirmed the missing save guard for providers without any retained or newly entered API key. GREEN passed `admin-providers-page.test.ts` 5/5, `credit-provider-routes.test.ts` 3/3, `postgres-credit-provider-repository.test.ts` 5/5, `admin-model-service-credit-routes.test.ts` 2/2, `npm.cmd run admin:build`, `npm.cmd run typecheck`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check`. Full `npm.cmd run build` passed, and full `npm.cmd run test:unit` passed 1471/1471. Browser inspection opened `http://127.0.0.1:4176/providers` in the in-app Browser, clicked the bootstrap button through DOM CUA, and confirmed the provider/model/API-key fields. Screenshot capture timed out, so final evidence is DOM-based. Production deploy passed with `cmd /c npx vercel deploy --prod --yes`, and `vercel alias set` moved both `https://kkai.plus` and `https://www.kkai.plus` to `https://kk-studio-ge7pnllju-yykks-projects-727e9560.vercel.app`. Live `app-version.json` reports build time `2026-05-22T01:16:49.789Z`; `/healthz` and `/api/healthz` return `200`; `/api/v1/model-catalog/models?kind=image` returns public `Nano Banana`; `/api/v1/model-catalog/active` and `/active-credit-models` still return `items: []` until a real admin key/model row is saved. VPS admin static deploy later completed to `/var/www/kk-admin`; `http://172.245.156.16:4174/login`, `/providers`, and `/assets/index-DYGx7sqD.js` return `200`.

## Current Startup And File UI Density Gate

Use this gate when touching the startup restore screen, ecommerce import file cards, PromptBar-embedded import layout, or text-density guardrails:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/settings-entry-surface-style-regression.test.ts tests/unit/app-startup-screen-localization.test.ts tests/unit/ecommerce-import-panel-density-contract.test.ts tests/unit/tailwind-utility-cascade-contract.test.ts tests/unit/ecommerce-import-panel-preview-loop.test.ts tests/unit/ecommerce-frosted-surface-contract.test.ts tests/unit/clay-frosted-surface-contract.test.ts
npm.cmd run typecheck
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
```

Expected result: startup restore keeps the full 640px launch hall with branded header, title, progress, and status list; ecommerce import file cards use a component-width-aware compact grid inside PromptBar, avoid oversized empty card height, keep chips/buttons from wrapping into cramped text, and all global reset rules stay layered or padding/margin-free so Tailwind `px-*` / `py-*` / `m*` spacing utilities win over reset defaults.

Fresh result on 2026-05-21: RED confirmed the startup screen had collapsed to a tiny prompt by missing `KK Studio is restoring your workspace` and the brand/status hooks; ecommerce density RED failed on the old `py-3`/viewport-breakpoint grid; Tailwind cascade RED failed because the reset was not in `@layer base`. A follow-up browser/CSSOM check found the remaining live root cause in `index.html`: an unlayered inline `* { margin: 0; padding: 0; }` overrode layered Tailwind utilities even though `.px-3` and `.py-2.5` existed in the generated CSS. GREEN focused density cascade suite passed 2/2; `npm.cmd run typecheck` passed with 133 semantic test files; `npm.cmd run build` passed and produced `dist/assets/index-BD0WEJrr.css` plus `dist/assets/index-CpTmd36I.js`; `npm.cmd run check:encoding` passed. Browser geometry after removing the inline reset and changing the ecommerce import grid minimum to `196px` confirmed panel/card padding `10px 12px`, `mb-2`/`mt-2` restored to `8px`, 3 grid columns at `206px` each, ecommerce panel height `225px` instead of the broken `315px`, and PromptBar height `502px` instead of the broken `592px`. Full screenshot capture timed out in the in-app Browser, so final browser evidence is computed geometry/CSSOM rather than a saved screenshot.

Fresh production result on 2026-05-21: `npx.cmd vercel deploy --prod -y --scope yykks-projects-727e9560` built successfully and produced `https://kk-studio-g58urf6uy-yykks-projects-727e9560.vercel.app`; `vercel alias set` successfully pointed `https://kkai.plus` and `https://www.kkai.plus` to that deployment. `vercel inspect https://kkai.plus --scope yykks-projects-727e9560` reports Production / Ready for deployment `dpl_5yga2WPNKLvFryoM2FNjYo3e2q1e`. Live `app-version.json` returns `1.4.6` with build time `2026-05-21T07:04:58.419Z`, and live HTML no longer includes the unlayered global margin/padding reset. API smoke returned `200` JSON for `https://kkai.plus/healthz`, `/api/healthz`, and `/api/manifest`, expected unauthenticated `401 AUTH_REQUIRED` for `/api/v1/auth/session`, and `selfHostedCoreReady=true` with PostgreSQL-backed `creditProviders`. The active model picker blocker is not an API transport failure: `/api/v1/model-catalog/models?kind=image` returns `Nano Banana`, but `/api/v1/model-catalog/active` and `/api/v1/model-catalog/active-credit-models` return `200` with `items: []`, meaning production has no active `admin_credit_models.is_active = true` credit-provider rows.

## OpenAI-Compatible Error Helper Gate

Use this gate when touching OpenAI-compatible adapter error construction, HTTP error metadata, or compatibility-mode fallback error metadata:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-error-helper-contract.test.ts tests/unit/openai-compatible-unused-cleanup-contract.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/openai-compatible-diagnostics-contract.test.ts tests/unit/openai-compatible-image-routing-errors-contract.test.ts
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/llm/OpenAICompatibleAdapter.ts src/services/llm/openAICompatibleErrors.ts tests/unit/openai-compatible-error-helper-contract.test.ts tests/unit/openai-compatible-unused-cleanup-contract.test.ts tests/unit/provider-image-routing-regression.test.ts tsconfig.tests.json status.md validation.md
```

Expected result: OpenAI-compatible HTTP and compatibility-mode errors are constructed by `src/services/llm/openAICompatibleErrors.ts`, preserve diagnostic metadata, and keep automatic chat/images fallback disabled for billing safety.

Fresh result on 2026-05-14: RED confirmed the missing helper module and adapter-local private constructors; GREEN focused OpenAI-compatible error/diagnostics/routing suite passed 22/22. `npm.cmd run typecheck` passed with 133 semantic test files, `npm.cmd run test:unit` passed 1465/1465, `npm.cmd run build` passed, `npm.cmd run governance:agent-docs` passed, `npm.cmd run check:encoding` passed, and path-limited alternate-git `diff --check` passed. Browser QA was skipped because this was a non-UI service helper extraction.

## Tutorial Overlay Readability Gate

Use this gate when touching the first-run tutorial overlay, tutorial card sizing, or tutorial description rendering:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/tutorial-overlay-layout-regression.test.ts tests/unit/responsive-surface.test.ts tests/unit/clay-global-ui-refit-contract.test.ts tests/unit/onboarding-unused-cleanup-contract.test.ts
npm.cmd run typecheck
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
npm.cmd run test:unit
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/components/common/TutorialOverlay.tsx tests/unit/tutorial-overlay-layout-regression.test.ts status.md validation.md
```

Expected result: tutorial copy renders as readable paragraph/list content instead of one collapsed dense paragraph; desktop first-run overlay uses a wider card than mobile; mobile remains viewport-bound and unclipped.

Fresh result on 2026-05-10: RED/GREEN completed for `tests/unit/tutorial-overlay-layout-regression.test.ts`; focused tutorial/responsive/Clay/onboarding suite passed 22/22; `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and `npm.cmd run test:unit` 1462/1462 passed; path-limited alternate-git `diff --check` passed. Browser QA against local `http://127.0.0.1:3197/?qa=tutorial-geometry` in dark theme, with only `/api/v1/model-catalog/active` stubbed to remove unrelated local-preview CORS noise, confirmed desktop `1440x900` card `560x294` and mobile `390x844` card `366x284`, both unclipped, with 1 paragraph plus 4 list items, `.theme-transitioning=0`, stale chunk count `0`, console errors/warnings `0`, and horizontal document scroll `false`.

## ProjectManager Desktop Rail UI Gate

Use this gate when touching the desktop ProjectManager tool rail, idle collapse behavior, or its viewport positioning:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/project-manager-unused-cleanup-contract.test.ts
npm.cmd run typecheck
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
npm.cmd run test:unit
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/components/settings/ProjectManager.tsx tests/unit/project-manager-unused-cleanup-contract.test.ts status.md validation.md
```

Expected result: the desktop `#project-manager-container` stays fixed at the left viewport inset during idle collapse, lowers opacity only, and never uses `-translate-x-full` to move the rail offscreen.

Fresh result on 2026-05-10: RED/GREEN was completed for `tests/unit/project-manager-unused-cleanup-contract.test.ts`; the focused test first failed on the existing `-translate-x-full` desktop collapse class, then passed 2/2 after the fix. `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, `npm.cmd run test:unit` 1461/1461, and path-limited alternate-git `diff --check` passed. Browser QA against the built local `dist` at desktop `1440x900` dark theme confirmed `#project-manager-trigger` remained at `x=17,width=40` after the idle collapse timer; `.theme-transitioning=0` and stale chunk text count was `0`.

## PromptBar Footer Frost UI Recovery Gate

Use this gate when touching PromptBar footer frost bounds, mobile footer chrome, or the global PromptBar CSS variables:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-bar-layout-regression.test.ts
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:unit
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/index.css tests/unit/prompt-bar-layout-regression.test.ts status.md validation.md
```

Expected result: `.prompt-bar-footer-frost::before` uses `inset: 0` and no negative inset, matching the v1.4.5 footer bounds so the frosted layer does not intrude into the PromptBar input/control area.

Production verification after deploy:

```powershell
npx.cmd vercel deploy --prod -y --scope yykks-projects-727e9560
npx.cmd vercel inspect https://kkai.plus --scope yykks-projects-727e9560
node -e "fetch('https://kkai.plus/?probe='+Date.now()).then(r=>r.text()).then(async html=>{const css=[...html.matchAll(/assets\\/index-[^\"']+\\.css/g)].at(-1)?.[0]; if(!css) throw new Error('missing css asset'); const text=await fetch('https://kkai.plus/'+css+'?probe='+Date.now()).then(r=>r.text()); console.log(css, /prompt-bar-footer-frost:before\\{[^}]*inset:0/.test(text), /prompt-bar-footer-frost:before\\{[^}]*inset:-6px 0 0/.test(text));})"
```

Fresh local result on 2026-05-10: RED/GREEN was completed for `tests/unit/prompt-bar-layout-regression.test.ts`; the focused test passed 11/11 after restoring `inset: 0`; `npm.cmd run build` passed and produced `dist/assets/index-a8hsw9tV.css`; local built CSS contains `inset:0` for `.prompt-bar-footer-frost:before`; `npm.cmd run typecheck`, `npm.cmd run check:encoding`, `npm.cmd run test:unit` 1460/1460, `npm.cmd run governance:agent-docs`, and path-limited alternate-git `diff --check` passed.

Fresh production result on 2026-05-10: production deployment `dpl_8GrbT468nTemUAaqML1yn4pMLaEQ` is Ready and `kkai.plus` was explicitly aliased to it. The live HTML now loads `assets/index-C4Idgjym.css`; the live `.prompt-bar-footer-frost:before` rule has `inset:0`, and the old `inset:-6px 0 0` rule is absent. Browser QA entered the deployed workspace on desktop `1440x900` and mobile `390x844`; the mobile computed pseudo-element inset is `0px`, with workspace textarea visible, no stale chunk text, and screenshots saved under `output/playwright/promptbar-footer-frost-fix/`.

## Canvas Production UI Recovery Gate

Use this gate when touching persisted canvas geometry recovery, canvas localStorage restoration, or restored canvas view scale:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-persistence-geometry-sanitizer.test.ts
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-visual-regression.test.ts tests/unit/canvas-merge-contract.test.ts tests/unit/canvas-workflow-updates-contract.test.ts tests/unit/workspace-layout-contract.test.ts
npm.cmd run typecheck
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/canvasGeometrySanitizer.ts src/context/canvasPersistence.ts src/components/canvas/InfiniteCanvas.tsx tests/unit/canvas-persistence-geometry-sanitizer.test.ts tsconfig.tests.json status.md validation.md
```

Expected result: corrupted persisted prompt/workflow geometry is sanitized before render; malformed persisted canvas collections restore as an empty list instead of throwing; restored `kk_canvas_view` values below scale `0.35` are rejected so the canvas falls back to a centered scale `1` view.

Fresh local result on 2026-05-10: the real restore-path sanitizer test passed 4/4; the focused canvas suite passed 17/17; `npm.cmd run typecheck` passed with 132 semantic test files; `npm.cmd run build` passed and produced `dist/assets/canvas-core-Dium_GUZ.js`; `npm.cmd run governance:agent-docs` passed; `npm.cmd run check:encoding` passed; and path-limited alternate-git `diff --check` passed with Windows LF/CRLF normalization warnings only. Local browser smoke against the built `dist` at `http://127.0.0.1:4186/` injected bad persisted canvas state and confirmed the restored view reset to `{"x":720,"y":450,"scale":1}` with the prompt card rendered at `320x147` instead of a tiny overflowing box.

Production deploy verification after this gate:

```powershell
npx.cmd vercel deploy --prod -y --scope yykks-projects-727e9560
npx.cmd vercel inspect https://kkai.plus --scope yykks-projects-727e9560
node -e "fetch('https://kkai.plus/app-version.json?probe='+Date.now()).then(r=>r.text()).then(console.log)"
```

Browser verification: open `https://kkai.plus/` after deployment, inject bad `kk_studio_canvas_state` plus `kk_canvas_view` in a test session, reload, and confirm the workspace does not render tiny cards with overflowing text or a disordered canvas. The restored transform should either be at least `0.35` scale or reset to the centered fallback.

Fresh production result on 2026-05-10:

- `npx.cmd vercel deploy --prod -y --scope yykks-projects-727e9560` completed and created deployment `dpl_B7d8WLM3DpRJwvVKyWpq9GjiNs9Q`, URL `https://kk-studio-4kgevbd1t-yykks-projects-727e9560.vercel.app`.
- `npx.cmd vercel alias set kk-studio-4kgevbd1t-yykks-projects-727e9560.vercel.app kkai.plus --scope yykks-projects-727e9560` and the same command for `www.kkai.plus` completed because the custom domain was still pointing at the old rollback deployment after the deploy.
- `npx.cmd vercel inspect https://kkai.plus --scope yykks-projects-727e9560` now resolves `kkai.plus` to `dpl_B7d8WLM3DpRJwvVKyWpq9GjiNs9Q`.
- `https://kkai.plus/` serves the new production assets including `assets/canvas-core-BRGhbfQB.js`; the old rollback asset `assets/canvas-core-CUNRGw_l.js` is no longer referenced.
- Isolated production browser QA injected corrupted canvas persistence and restored to `{"x":720,"y":450,"scale":1}` with a normal `320x147` prompt card, no stale chunk text, no `.theme-transitioning`, no console warnings/errors, and no request failures.

## Hosted Vercel API Proxy Login Fix Gate

Use this gate when touching Vercel API proxy helper files, hosted `/api/v1/*` or `/api/auth/*` routing, Vercel rewrites, or hosted KK API base URL selection:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/hosted-release-guardrails.test.ts tests/unit/vercel-vps-proxy.test.ts tests/unit/kk-api-base-url-hosted-contract.test.ts tests/unit/input-autofill-style-contract.test.ts
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run check:encoding
npm.cmd run test:unit
node "C:\Users\Administrator\AppData\Roaming\npm\node_modules\vercel\dist\vc.js" inspect https://kkai.plus --scope yykks-projects-727e9560
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- api/_vpsProxy.ts api/_vpsProxy.js api/_vpsProxy.d.ts api/[...path].ts api/v1.ts api/v1/[...path].ts api/auth.ts api/auth/[...path].ts api/healthz.ts api/manifest.ts src/services/api/kkApiBaseUrl.ts tests/unit/hosted-release-guardrails.test.ts tests/unit/kk-api-base-url-hosted-contract.test.ts tests/unit/vercel-vps-proxy.test.ts vercel.json status.md validation.md
```

Fresh result on 2026-05-10: the focused hosted/proxy/input suite passed 22/22; `npm.cmd run typecheck` passed with semantic coverage for 131 test files; `npm.cmd run build` passed as `kk-studio@1.4.6` and transformed 2140 modules; `npm.cmd run check:encoding` passed; and `npm.cmd run test:unit` passed 1456/1456.

Fresh production evidence on 2026-05-10: `vercel inspect https://kkai.plus --scope yykks-projects-727e9560` reports deployment `dpl_9TzojFb3YM2UonhKwwFRu151v6fL`, target `production`, status `Ready`, URL `https://kk-studio-7d78nulgj-yykks-projects-727e9560.vercel.app`, aliased to `https://kkai.plus`. Production smoke returned `200` JSON for `/api/healthz`, `200` JSON for `/api/manifest`, expected `401 AUTH_REQUIRED` JSON for `/api/v1/auth/session`, expected `401 AUTH_REQUIRED` JSON for `/api/v1/profile/user-apis`, and expected `403 TURNSTILE_FAILED` JSON for `/api/v1/auth/login` with a fake Turnstile token. The login route now returns KK API JSON rather than Vercel HTML, Vercel 404, or a Vercel function import error.

Follow-up deploy evidence after commit `5b922928`: `vercel deploy . --prod -y --scope yykks-projects-727e9560` completed successfully; the remote build ran `npm run build` as `kk-studio@1.4.6`, transformed 2140 modules, and aliased `https://kkai.plus`. `vercel inspect https://kkai.plus --scope yykks-projects-727e9560` reports deployment `dpl_Ej3wrGiASL4FtBMZcARY81XszG34`, target `production`, status `Ready`, URL `https://kk-studio-e165sudnw-yykks-projects-727e9560.vercel.app`. Fresh production smoke returned `200` JSON for `/api/healthz`, `200` JSON for `/api/manifest`, expected `401 AUTH_REQUIRED` JSON for `/api/v1/auth/session`, and expected `403 TURNSTILE_FAILED` JSON for `/api/v1/auth/login` with a fake Turnstile token.

Fresh production page QA: Node fetch confirmed `https://kkai.plus/` returns `200 text/html` with `lang="zh-CN"` and `https://kkai.plus/app-version.json` returns version `1.4.6`. Headless Chromium opened the production login page at desktop `1440x900` and mobile `390x844`; both rendered Chinese login text, visible `v1.4.6`, email/password inputs, no stale chunk text, no `.theme-transitioning`, no page errors, and no request failures. The only `kkai.plus` console error was expected signed-out `/api/v1/auth/session` `401`; other console messages came from Cloudflare Turnstile/headless browser policy behavior. Artifacts: `output/playwright/hosted-login-smoke/summary.json`, `desktop-1440x900.png`, and `mobile-390x844.png`.

Remote reconciliation evidence: after inspecting remote-only commits, `git merge -s ours origin/main -m "chore: reconcile origin main release history"` created `6fcdb366` and kept the current release tree unchanged. Fresh focused hosted/proxy/input suite passed 22/22; `npm.cmd run typecheck` passed; `npm.cmd run build` passed; `npm.cmd run check:encoding` passed; production smoke returned `200` JSON for `/api/healthz`, expected `401 AUTH_REQUIRED` JSON for `/api/v1/auth/session`, and `app-version.json` returned `1.4.6`. `git merge-base --is-ancestor origin/main HEAD` returned exit code `0`. `git push origin main` was attempted but blocked by local GitHub credential state: `schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS`.

## Login/Input Hotfix Gate

Use this gate when touching hosted password login error presentation, KK API base URL selection in hosted runtime, or input autofill/selection styling:

```powershell
npm.cmd pkg get version
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/auth-localization.test.ts tests/unit/input-autofill-style-contract.test.ts tests/unit/kk-api-base-url-hosted-contract.test.ts tests/unit/kk-api-client.test.ts tests/unit/password-sign-in-fallback.test.ts tests/unit/theme-contrast-contract.test.ts
npm.cmd run typecheck
npm.cmd run build
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- apps/admin/src/styles/admin.css src/components/auth/LoginScreen.css src/components/auth/authLocalization.ts src/index.css src/services/api/kkApiBaseUrl.ts tests/unit/auth-localization.test.ts tests/unit/kk-api-base-url-hosted-contract.test.ts tests/unit/input-autofill-style-contract.test.ts status.md validation.md
```

Expected result: version metadata reports `1.4.6`; invalid credentials render as `邮箱或密码错误。`; hosted route/proxy failures render as a Chinese service-unavailable login message without raw transport codes; hosted browser runtime stays on same-origin API proxy for IP-like infrastructure hosts; and input autofill/selection overlays use theme tokens instead of browser default color blocks.

Fresh hotfix result on 2026-05-09: version check returned `1.4.6`; the targeted gate passed 45/45; `npm.cmd run governance:check`, `npm.cmd run audit:dependencies`, `npm.cmd run spec:check`, `npm.cmd run typecheck`, `npm.cmd run test:unit` passed 1451/1451, `npm.cmd run build`, `npm.cmd run admin:build`, and `npm.cmd run check:encoding` passed. Local static preview at `http://localhost:4173/` rendered the Chinese login page with `v1.4.6` and no visible input color strip; console output retained the known local admin-model fetch noise in static preview.

Production deploy result for commit `17973288`: `npx.cmd vercel deploy --prod -y --scope yykks-projects-727e9560` completed successfully, the remote build ran `npm run build` as `kk-studio@1.4.6`, and `npx.cmd vercel inspect https://kkai.plus --scope yykks-projects-727e9560` reports deployment `dpl_4U49MUEyEPtdjTBziC2rejxGeMMP`, target `production`, status `Ready`, URL `https://kk-studio-rja71b3e3-yykks-projects-727e9560.vercel.app`, aliased to `https://kkai.plus`.

## Login Turnstile Status Hotfix Gate

Use this gate when touching hosted login Turnstile status, submit blocking copy, or Cloudflare widget runtime configuration:

```powershell
npm.cmd pkg get version
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/login-screen-auth-actions.test.ts tests/unit/turnstile-runtime-config.test.ts tests/unit/hosted-release-guardrails.test.ts
npm.cmd run typecheck
npm.cmd run build
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/components/auth/LoginScreen.tsx src/components/auth/TurnstileWidget.tsx tests/unit/login-screen-auth-actions.test.ts status.md validation.md
```

Expected result: version metadata reports `1.4.6`; the login page distinguishes Turnstile `rendered`, `verified`, and `error` parent states; rendered-but-unverified Turnstile shows `Verify` plus `请完成 Cloudflare 安全验证后再登录。`; widget errors use the error badge instead of the loading badge; and the Cloudflare locale guard still requires `zh-cn`.

Fresh result on 2026-05-09: RED first reproduced the missing parent `error` status branch in `tests/unit/login-screen-auth-actions.test.ts`, then the focused login page test passed 4/4 after the fix. The broader login/Turnstile/hosted guardrail suite freshly passed 17/17; `npm.cmd run governance:agent-docs`, `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run check:encoding`, `npm.cmd pkg get version`, and path-limited alternate-git `diff --check` also passed for this hotfix.

Production deploy result for commit `78aa280f`: `npx.cmd vercel deploy --prod -y --scope yykks-projects-727e9560` completed successfully, the remote build ran `npm run build` as `kk-studio@1.4.6`, and `npx.cmd vercel inspect https://kkai.plus --scope yykks-projects-727e9560` reports deployment `dpl_4SXnYSMc3yeFCuLsgLEbJSR8ZnFV`, target `production`, status `Ready`, URL `https://kk-studio-o6m9dv4bi-yykks-projects-727e9560.vercel.app`, aliased to `https://kkai.plus`.

Production browser QA result: the in-app browser rendered the real hosted login page in Chinese with `v1.4.6`, no console warnings/errors, no Tailwind CDN warning, and no old `Language zh-CN` Turnstile warning. Turnstile status moved from `待验证 / 请完成 Cloudflare 安全验证后再登录。` to `已就绪 / 安全验证已完成。`. Independent headless Playwright from this machine was stopped by Vercel Security Check `429`, matching the known local automation limitation.

## Current 1.4.6 Production Deploy Evidence

Fresh final deploy gate before the `dpl_Ae8ckSKAuHthpkNssLnaB1dwHR5Y` production deployment:

```powershell
npm.cmd run governance:version
npm.cmd run governance:check
npm.cmd run audit:dependencies
npm.cmd run spec:check
npm.cmd run typecheck
npm.cmd run check:encoding
npm.cmd run build
npm.cmd run test:unit
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check
npx.cmd vercel deploy --prod -y --scope yykks-projects-727e9560
npx.cmd vercel inspect https://kkai.plus --scope yykks-projects-727e9560
```

Observed result: version metadata aligned to `1.4.6`; governance, dependency audit, spec, typecheck, encoding, build, and unit tests passed; unit tests reported 1441/1441 passing; Vercel production deploy completed and `kkai.plus` aliased `https://kk-studio-l8gex5abk-yykks-projects-727e9560.vercel.app`.

Fresh production inspect after `b6f1fd6f`: `npx.cmd vercel inspect https://kkai.plus --scope yykks-projects-727e9560` reports deployment `dpl_ACm7915SrSFiVQGNVJUDoDXMMQFA`, target `production`, status `Ready`, URL `https://kk-studio-u1atrmy8j-yykks-projects-727e9560.vercel.app`, and aliases `https://kkai.plus`, `https://www.kkai.plus`, `https://kk-studio.vercel.app`, `https://kk-studio-yykks-projects-727e9560.vercel.app`, and `https://kk-studio-yinchenkang0-1635-yykks-projects-727e9560.vercel.app`. The inspected Vercel build contains `api/auth/[...path]`, `api/v1/[...path]`, `api/healthz`, `api/ecommerce-analysis`, and `api/v1`.

Fresh production deployment after `0ec11cb9`: `npx.cmd vercel deploy --prod -y --scope yykks-projects-727e9560` completed successfully, uploaded only `363B` of changed data, restored the previous build cache, ran `npm run build` as `kk-studio@1.4.6`, transformed 2140 modules, completed the build, and aliased `https://kkai.plus`. `npx.cmd vercel inspect https://kkai.plus --scope yykks-projects-727e9560` reports deployment `dpl_BvSuUPCu4EWeBkoFcktZvDS5uJpV`, target `production`, status `Ready`, URL `https://kk-studio-a16e63rja-yykks-projects-727e9560.vercel.app`, and the expected public aliases.

Fresh HTTPS upstream workaround while `api.kkai.plus` DNS remains unavailable:

```powershell
scp -i .codex-tmp-vps-key2 scripts/vps/configure-kk-vps-api-tls.sh root@172.245.156.16:/tmp/configure-kk-vps-api-tls.sh
ssh -i .codex-tmp-vps-key2 root@172.245.156.16 "API_DOMAIN=172-245-156-16.sslip.io EXPECTED_API_IPV4=172.245.156.16 bash /tmp/configure-kk-vps-api-tls.sh"
npx.cmd vercel env add KK_VPS_API_BASE_URL production --value "https://172-245-156-16.sslip.io" --yes --scope yykks-projects-727e9560
npx.cmd vercel deploy --prod -y --scope yykks-projects-727e9560
npx.cmd vercel inspect https://kkai.plus --scope yykks-projects-727e9560
```

Observed result: the VPS resolves `172-245-156-16.sslip.io` to `172.245.156.16`, Certbot issued a Let's Encrypt certificate for the wildcard DNS hostname, nginx HTTPS config passed syntax checks and reloaded, and VPS-side HTTPS smoke returns `200` for `/healthz`, `200` for `/api/manifest`, expected unauthenticated `401` for `/api/v1/auth/session`, and `404` for `/internal` plus `/internal/`. Vercel Production now contains `KK_VPS_API_BASE_URL`, and the post-env deploy is `dpl_JBqdQMBorigt5kTExqRrv3JosAHc`, Ready, URL `https://kk-studio-icg1ticp2-yykks-projects-727e9560.vercel.app`, aliased to `https://kkai.plus`. Direct local `https://kkai.plus/api/*` smoke returns Vercel Security Check `429`, and the deployment URL returns Vercel Deployment Protection `401`; treat this as an automated-smoke limitation from this machine, not VPS HTTPS failure.

Latest 1.4.6 production deployment after `aa14ee33`:

```powershell
npm.cmd pkg get version
npx.cmd vercel env ls production --scope yykks-projects-727e9560
npx.cmd vercel inspect https://kkai.plus --scope yykks-projects-727e9560
```

Observed result: package metadata reports `1.4.6`; Vercel Production contains `KK_VPS_API_BASE_URL` and `VITE_KK_API_BASE_URL`; `npx.cmd vercel inspect https://kkai.plus --scope yykks-projects-727e9560` reports deployment `dpl_632NEDeDWYXHJtyjnxfgDgQfuHXo`, target `production`, status `Ready`, URL `https://kk-studio-gq1riacd7-yykks-projects-727e9560.vercel.app`, and aliases `https://kkai.plus`, `https://www.kkai.plus`, `https://kk-studio.vercel.app`, `https://kk-studio-yykks-projects-727e9560.vercel.app`, and `https://kk-studio-yinchenkang0-1635-yykks-projects-727e9560.vercel.app`. The remote deployment build ran as `kk-studio@1.4.6` and transformed 2140 modules.

Fresh DNS workaround fix after Cloudflare credentials were unavailable:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/vercel-vps-proxy.test.ts tests/unit/portable-payment-package-contract.test.ts tests/unit/hosted-release-guardrails.test.ts
$env:VITE_KK_API_BASE_URL='https://172-245-156-16.sslip.io'; $env:VITE_TURNSTILE_LOCAL_BYPASS='false'; npm.cmd run package:portable
npm.cmd run publish:portable
```

Observed result: RED first reproduced the proxy defaulting to unresolved `api.kkai.plus`; after the fix, the focused suite passed 19/19. Portable packaging rebuilt against `https://172-245-156-16.sslip.io`, `npm.cmd run publish:portable` updated `release/publish/stable/manifest.json`, and the current stable portable archive digest is `2ba18a49403584b9d934ae18b6059d77c655c772eca6701739c8a8e9153b07c3` with size `52901506`. Node HTTPS smoke shows `https://172-245-156-16.sslip.io/healthz` returns `200`, `https://172-245-156-16.sslip.io/api/v1/auth/session` returns expected unauthenticated `401` JSON, and CORS allows `Origin: http://127.0.0.1:3000`. Direct same-machine `https://kkai.plus/api/*` checks can still return Vercel Security Check `429`, so use Vercel inspect plus the HTTPS VPS upstream smoke as the automated evidence from this environment.

Latest production deployment after the DNS workaround fix:

```powershell
npx.cmd vercel deploy --prod -y --scope yykks-projects-727e9560
npx.cmd vercel inspect https://kkai.plus --scope yykks-projects-727e9560
npx.cmd vercel env ls production --scope yykks-projects-727e9560
node <https-vps-upstream-smoke>
```

Observed result: Vercel deploy completed, remote build ran `npm run build` as `kk-studio@1.4.6`, transformed 2140 modules, and aliased `https://kkai.plus`. Inspect reports deployment `dpl_DjvHLa9pM5jZmPDYjJBBNVVF4NK4`, target `production`, status `Ready`, URL `https://kk-studio-bp55q7fxi-yykks-projects-727e9560.vercel.app`, and the expected public aliases. Production env still lists `KK_VPS_API_BASE_URL` and `VITE_KK_API_BASE_URL`. HTTPS VPS upstream smoke returns `200` for `/healthz`, `200` for `/api/manifest`, expected `401` JSON for unauthenticated `/api/v1/auth/session`, `204` for CORS preflight from `http://127.0.0.1:3000`, and `404` for `/internal` plus `/internal/`.

Fresh permanent-domain blocker evidence: `Resolve-DnsName api.kkai.plus -Server 1.1.1.1 -Type A`, `Resolve-DnsName api.kkai.plus -Server 8.8.8.8 -Type A`, and direct checks using the Cloudflare nameserver hostnames return `198.18.0.73`, not `172.245.156.16`. `CF_API_TOKEN`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_ZONE_ID` are unset locally, `npx.cmd wrangler whoami` is unauthenticated, and `node scripts/deploy/cloudflare-upsert-api-dns.mjs` fails closed with the expected missing-token message. Treat `api.kkai.plus` as a follow-up canonical-domain hardening task until Cloudflare DNS edit access is available.

Fresh deployment-boundary guardrail after review:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/hosted-release-guardrails.test.ts
node scripts/deploy/cloudflare-upsert-api-dns.mjs
npm.cmd run governance:version
npm.cmd run check:encoding
```

Observed result: guardrail tests first failed on the duplicated Cloudflare `/client/v4` API path and missing `m/` upload exclusions, then passed 9/9 after the helper and upload-boundary fixes. The Cloudflare DNS helper still fails closed without `CF_API_TOKEN` or `CLOUDFLARE_API_TOKEN`, which is the expected local state until DNS credentials are supplied. Version governance remains aligned to `1.4.6`, and encoding check passed.

Fresh post-fix full gate:

```powershell
npm.cmd run governance:check
npm.cmd run audit:dependencies
npm.cmd run spec:check
npm.cmd run typecheck
npm.cmd run check:encoding
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/hosted-release-guardrails.test.ts tests/unit/vps-deploy-contract.test.ts tests/unit/vercel-vps-proxy.test.ts
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- .vercelignore scripts/deploy/cloudflare-upsert-api-dns.mjs scripts/deploy/vercel-preview-deploy.ps1 tests/unit/hosted-release-guardrails.test.ts status.md validation.md
npm.cmd run test:unit
npm.cmd run build
```

Observed result: governance, dependency audit, spec, typecheck, encoding, focused Hosted/VPS guardrails, and path-limited diff checks passed. `npm.cmd run test:unit` passed 1444/1444, and `npm.cmd run build` completed with Vite transforming 2140 modules.

## 1.4.6 Release Blocker Audit Gate

Use this gate when touching hosted Vercel proxy routes, VPS upstream security, release hosted preflight, payment-server dependency audit, visible Chinese text, PromptBar release QA, or VPS env examples:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/vercel-vps-proxy.test.ts" `
  "tests/unit/kk-api-base-url-hosted-contract.test.ts" `
  "tests/unit/hosted-release-guardrails.test.ts" `
  "tests/unit/vps-deploy-artifacts.test.ts" `
  "tests/unit/vps-deploy-contract.test.ts" `
  "tests/unit/prompt-bar-layout-regression.test.ts" `
  "tests/unit/encoding-check-contract.test.ts"
npm.cmd run governance:check
npm.cmd run audit:dependencies
npm.cmd run spec:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run check:encoding
npm.cmd run release:hosted:check
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check
```

Expected local result for `release:hosted:check`: it must fail while local `.env.local` contains `VITE_TURNSTILE_LOCAL_BYPASS=true` or a remote HTTP `VITE_KK_API_BASE_URL`. Treat that failure as the required clean-hosted-environment release blocker, not as a code failure. Before production release, rerun the same command in a clean hosted environment and require it to pass with HTTPS/same-origin API configuration plus real OAuth, Turnstile, and payment sidecar secrets.

Browser QA for this gate must cover desktop dark/light and 390px mobile surfaces: login, temporary local workspace, storage selection/browser-cache path, PromptBar/model menu, active toggle gradient, settings, recharge/balance entry, mobile footer, and mobile settings/more sheet. Record screenshots and `release-qa-summary-refreshed.json` under `output/playwright/1.4.6-release-qa/`; do not commit `output/`.

Deployment upload boundary must exclude local-only files and generated artifacts. Production `.vercelignore` and fallback `scripts/deploy/vercel-preview-deploy.ps1` tar packaging must keep `m/`, `output/`, `tests/`, `docs/`, `deploy/`, `release/`, AI ledgers, local env files, build outputs, caches, logs, and backup files out of uploaded artifacts while preserving runtime source, `api/` functions, package manifests, lockfiles, and Vercel config.

Hosted/VPS production smoke must also verify:

```powershell
npx.cmd vercel inspect https://kkai.plus --scope yykks-projects-727e9560
npx.cmd vercel env ls --scope yykks-projects-727e9560
curl.exe -vI https://api.kkai.plus/healthz
curl.exe -vI https://api.kkai.plus/api/manifest
curl.exe -vI https://api.kkai.plus/api/v1/auth/session
```

VPS API TLS helper syntax and fail-fast checks must also run on the VPS before enabling the API domain:

```bash
CF_API_TOKEN=<cloudflare-zone-dns-edit-token> node scripts/deploy/cloudflare-upsert-api-dns.mjs
bash -n /tmp/configure-kk-vps-api-tls.sh
API_DOMAIN=api.kkai.plus EXPECTED_API_IPV4=172.245.156.16 bash /tmp/configure-kk-vps-api-tls.sh
```

Without a Cloudflare token, the DNS helper must fail closed without mutating DNS. Before DNS is fixed, the VPS TLS command must stop at the DNS check and must not write nginx TLS state. After DNS points to the VPS, run the helper from `scripts/vps/configure-kk-vps-api-tls.sh`; it must serve only ACME challenge paths over temporary HTTP, then install the HTTPS virtual host. The HTTPS `api.kkai.plus` checks must complete TLS and return application/API responses before production release. Public `/internal` and `/internal/` paths must return `404` at nginx and must not proxy to the payment sidecar.

## 1.4.6 Version And Portable Alignment Gate

Use this gate when bumping release metadata, package versions, portable manifests, or portable release scanner logic:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/portable-payment-package-contract.test.ts" `
  "tests/unit/portable-app-server-document-proxy-contract.test.ts"
$env:VITE_KK_API_BASE_URL='https://api.kkai.plus'; npm.cmd run package:portable
npm.cmd run publish:portable
npm.cmd run governance:version
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check
```

Before committing, confirm no current release metadata points at `1.4.5`, `v1.4.5`, or `KK-Studio-Portable-1.4.5` outside explicitly historical status notes. Do not stage `release/KK-Studio-Portable/`, `output/`, local `.env*` files, or line-ending-only noise.

## Desktop Canvas Snap-To-Grid Hotfix Gate

Use this gate when touching the desktop left toolbar snap toggle, canvas snap helper, prompt/image/workflow card drag snapping, or selected-node movement snap behavior:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-snap-to-grid-contract.test.ts" `
  "tests/unit/canvas-movement-contract.test.ts"
npm.cmd run typecheck
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git diff --check -- `
  "src/utils/canvasSnapToGrid.ts" `
  "tests/unit/canvas-snap-to-grid-contract.test.ts" `
  "tsconfig.tests.json" `
  "src/components/settings/ProjectManager.tsx" `
  "src/App.tsx" `
  "src/context/canvasMovement.ts" `
  "src/context/canvasContextState.ts" `
  "src/context/CanvasContext.tsx" `
  "src/app/usePromptGroupDragHandlers.ts" `
  "src/components/canvas/PromptNodeComponent.tsx" `
  "src/components/image/ImageCard2.tsx" `
  "src/workflow/nodes/WorkflowUtilityCard.tsx" `
  "src/workflow/nodes/PreviewNodeCard.tsx" `
  "src/workflow/nodes/SaveNodeCard.tsx" `
  "src/workflow/nodes/AgentNodeCard.tsx" `
  "tests/unit/canvas-movement-contract.test.ts" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA is required because this changes visible desktop UI. Record the URL, viewport, theme, left-toolbar snap control, `aria-pressed` toggle, `.theme-transitioning`, stale chunk status, and console errors in `status.md`. If the in-app Browser is blocked, record that and use the repository Playwright/headless-browser fallback.

## Desktop Collapsed Manual Group Hotfix Gate

Use this gate when touching desktop manual canvas group collapse state, compact group cards, hidden group member render suppression, connector suppression, or collapsed group image-load scheduling:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-collapsed-groups-contract.test.ts" `
  "tests/unit/canvas-groups-contract.test.ts" `
  "tests/unit/prompt-group-regroup-behavior.test.ts" `
  "tests/unit/canvas-visual-regression.test.ts"
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/App.tsx" `
  "src/app/collapsedCanvasGroups.ts" `
  "src/components/canvas/CanvasGroupComponent.tsx" `
  "src/types.ts" `
  "tests/unit/canvas-collapsed-groups-contract.test.ts" `
  "tests/unit/canvas-visual-regression.test.ts" `
  "tsconfig.tests.json" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA is required because this changes visible desktop UI and resource loading. Record the URL, viewport, theme, collapsed card, expand/hide controls, hidden member prompt/image surfaces, connector count, `.theme-transitioning`, stale chunk status, and console errors in `status.md`. If the in-app Browser is blocked, record that and use the repository Playwright/headless-browser fallback.

## Hosted Production Startup Hotfix Gate

Use this gate when touching Vercel hosted routing, hosted session bootstrap, hosted auth startup recovery, or `kkai.plus` production login entry:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/hosted-release-guardrails.test.ts" `
  "tests/unit/workspace-auth-gate.test.ts" `
  "tests/unit/app-startup-coordinator.test.ts" `
  "tests/unit/kk-api-session-bootstrap.test.ts" `
  "tests/unit/kk-api-client.test.ts" `
  "tests/unit/kk-api-client-session-cookie.test.ts" `
  "tests/unit/kk-api-server-health-vps-contract.test.ts" `
  "tests/unit/auth-redirect.test.ts" `
  "tests/unit/login-screen-admin-entry.test.ts"
npm.cmd run typecheck
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/context/AuthContext.tsx" `
  "tests/unit/workspace-auth-gate.test.ts" `
  "tests/unit/hosted-release-guardrails.test.ts" `
  "vercel.json" `
  "status.md" `
  "validation.md"
vercel.cmd inspect https://kkai.plus --scope yykks-projects-727e9560
```

Production verification note: direct unauthenticated HTTP requests to `https://kkai.plus` from this environment can return Vercel Security Check `429`; use Vercel CLI inspect/alias checks as the authoritative deployment readiness signal here, and ask the user to hard-refresh or clear site data if their browser has cached the old bundle or a stale local temporary session.

## GPT Best Priority Provider Compatibility Gate

Use this gate when touching GPT Best, OpenAI-compatible provider strategy, model discovery metadata, connection-test model listing, or OpenAI-compatible image dispatch:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/openai-compatible-image-dispatch-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tests/unit/provider-strategy.test.ts" `
  "tests/unit/provider-probe-matrix.test.ts" `
  "tests/unit/key-manager-remote-model-discovery-contract.test.ts" `
  "tests/unit/connection-test-gpt-best-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/auth/keyManager.ts" `
  "src/services/auth/keyManagerRemoteModelDiscovery.ts" `
  "src/services/llm/OpenAICompatibleAdapter.ts" `
  "src/services/llm/openAICompatibleImageDispatch.ts" `
  "tests/unit/key-manager-remote-model-discovery-contract.test.ts" `
  "tests/unit/openai-compatible-image-dispatch-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tests/unit/provider-probe-matrix.test.ts" `
  "tests/unit/provider-strategy.test.ts" `
  "tests/unit/connection-test-gpt-best-contract.test.ts" `
  "tsconfig.tests.json" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it is a non-UI provider-routing/model-discovery slice with no JSX, CSS, or browser-visible surface change. Record the skip reason in `status.md`.

## Auth And VPS Login Hotfix Gate

Use this gate when touching the login screen default/auth state, KK API password login route, public runtime env helper, or VPS nginx/static deployment entry:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/workspace-auth-gate.test.ts" `
  "tests/unit/login-screen-admin-entry.test.ts" `
  "tests/unit/local-env-contract.test.ts" `
  "tests/unit/kk-api-client.test.ts" `
  "tests/unit/vps-deploy-contract.test.ts" `
  "tests/unit/vps-deploy-artifacts.test.ts"
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none --test-name-pattern "configured Cloudflare secret|legacy password login path|local web login" `
  "tests/unit/api-server-startup.test.ts"
npm.cmd run typecheck
npm.cmd run build
npm.cmd run admin:build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  ".env.example" `
  "apps/api/src/server.ts" `
  "deploy/nginx/kk-vps-gateway.conf" `
  "scripts/vps/bootstrap-kk-vps.sh" `
  "scripts/vps/deploy-kk-vps.sh" `
  "scripts/vps/kk-api.env.example" `
  "scripts/vps/kk-vps.env.example" `
  "scripts/vps/kk-web.env.example" `
  "src/components/auth/LoginScreen.tsx" `
  "src/context/AuthContext.tsx" `
  "src/utils/runtimeEnv.ts" `
  "tests/unit/api-server-startup.test.ts" `
  "tests/unit/kk-api-client.test.ts" `
  "tests/unit/local-env-contract.test.ts" `
  "tests/unit/login-screen-admin-entry.test.ts" `
  "tests/unit/vps-deploy-contract.test.ts" `
  "tests/unit/workspace-auth-gate.test.ts" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser/VPS QA requires deploying the updated bundle and nginx config to the VPS, then checking `http://172.245.156.16/` serves the login page, `POST http://172.245.156.16/api/v1/auth/login` reaches the API, the administrator button opens the configured admin `/login`, and temporary local access only happens after its explicit button is clicked.

## Ecommerce Framework Card Header And Arrange Gate

Use this gate when touching the ecommerce framework prompt-card header remark/tag surface or full-canvas ecommerce framework cohort auto-arrange ordering:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/ecommerce-display-label-surface.test.ts" `
  "tests/unit/canvas-auto-arrange-contract.test.ts" `
  "tests/unit/prompt-bar-ecommerce-framework-companion.test.ts" `
  "tests/unit/ecommerce-canvas-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/components/canvas/PromptNodeComponent.tsx" `
  "src/context/canvasAutoArrange.ts" `
  "tests/unit/ecommerce-display-label-surface.test.ts" `
  "tests/unit/canvas-auto-arrange-contract.test.ts" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA is required because this gate touches visible canvas UI. Use the Codex in-app Browser on the current built app or local dev server and record URL, title, framework remark/tag test-id counts, login/data limitation when applicable, `.theme-transitioning` or startup-screen state if available, stale chunk text count if checked, and console error count in `status.md`.

## Auth Logout Startup Gate

Use this gate when touching explicit logout behavior, hosted/runtime session recovery, `AppStartupScreen`, or startup warning readability:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/workspace-auth-gate.test.ts" `
  "tests/unit/app-startup-coordinator.test.ts" `
  "tests/unit/app-startup-screen-localization.test.ts" `
  "tests/unit/settings-entry-surface-style-regression.test.ts" `
  "tests/unit/theme-contrast-contract.test.ts" `
  "tests/unit/kk-api-session-bootstrap.test.ts"
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/context/AuthContext.tsx" `
  "src/components/common/AppStartupScreen.tsx" `
  "src/index.css" `
  "tests/unit/workspace-auth-gate.test.ts" `
  "tests/unit/settings-entry-surface-style-regression.test.ts" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA is required because this gate touches visible startup/login state. Use the Codex in-app Browser on a live local Vite app, verify clean signed-out state returns to the login page after session check, then enter with `临时用户（仅本地）`, click `退出登录`, and record URL, startup-screen count, login button count, temp-login button count, workspace prompt count, `.theme-transitioning`, stale chunk text count, and console error count in `status.md`.

Current code baseline before M130 after the M129 keyManager update diagnostic redaction at `740042c1`: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` exits 0. The M130 OpenAI-compatible diagnostics prompt redaction keeps this probe clean. Historical per-slice notes that mention an expected noUnused failure describe older cleanup milestones; new cleanup/refactor/UI slices should keep this probe clean unless `status.md` records a fresh, unrelated blocker.

## M130 OpenAI-Compatible Diagnostics Prompt Redaction Gate

Use this gate when touching OpenAI-compatible diagnostics previews, request-body preview redaction, or diagnostic python snippets:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/openai-compatible-diagnostics-contract.test.ts" `
  "tests/unit/openai-compatible-image-dispatch-contract.test.ts" `
  "tests/unit/openai-compatible-image-payload-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tests/unit/openai-compatible-image-sizing-contract.test.ts" `
  "tests/unit/openai-compatible-task-payload-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run governance:security
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/llm/OpenAICompatibleAdapter.ts" `
  "src/services/llm/openAICompatibleDiagnostics.ts" `
  "tests/unit/openai-compatible-diagnostics-contract.test.ts" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it changes only service diagnostics metadata and no JSX, CSS, route rendering, browser-visible UI, or release metadata. Record the skip reason in `status.md`.

## Prompt Optimizer Cache And Logging Redaction Gate

Use this gate when touching prompt optimizer cache keys, persisted optimizer cache results, optimizer fallback diagnostics, or generation-runtime prompt optimizer failure logging:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/prompt-optimizer-service-source-contract.test.ts" `
  "tests/unit/prompt-optimizer-autoroute-contract.test.ts" `
  "tests/unit/prompt-optimizer-capability-route-contract.test.ts" `
  "tests/unit/ecommerce-structured-task-source-contract.test.ts" `
  "tests/unit/generation-runtime-contract.test.ts" `
  "tests/unit/ecommerce-node-generation-runtime-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run governance:security
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/llm/promptOptimizerService.ts" `
  "src/app/optimizeGenerationPrompt.ts" `
  "src/app/useGenerationRuntime.ts" `
  "src/app/useEcommerceNodeGenerationRuntime.ts" `
  "tests/unit/prompt-optimizer-service-source-contract.test.ts" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it changes only service cache/logging behavior and no JSX, CSS, route rendering, browser-visible UI, or release metadata. Record the skip reason in `status.md`.

## M132 Shared Local User-Route Auth Inference Gate

Use this gate when touching local user-route auth/header/query-key inference, the shared local user-route auth helper, diagnostics route auth selection, or the model-proxy compatibility re-export:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/local-user-route-auth-contract.test.ts" `
  "tests/unit/user-route-diagnostics-routes.test.ts" `
  "tests/unit/user-route-pricing-endpoint-override.test.ts" `
  "tests/unit/user-route-proxy-routing.test.ts" `
  "tests/unit/twelve-ai-doc-alignment.test.ts" `
  "tests/unit/system-gemini-auth-regression.test.ts" `
  "tests/unit/provider-auth-proxy-regression.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run governance:security
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "apps/api/src/lib/local-user-route-auth.ts" `
  "apps/api/src/modules/auth/application/user-route-diagnostics-service.ts" `
  "apps/api/src/modules/model-proxy/application/local-user-route-auth.ts" `
  "tests/unit/local-user-route-auth-contract.test.ts" `
  "tests/unit/provider-auth-proxy-regression.test.ts" `
  "tests/unit/async-image-proxy-regression.test.ts" `
  "tests/unit/system-gemini-auth-regression.test.ts" `
  "tests/unit/twelve-ai-doc-alignment.test.ts" `
  "tests/unit/user-route-diagnostics-routes.test.ts" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it changes only server-side auth-helper/diagnostics behavior and source contracts, with no JSX, CSS, route rendering, browser-visible UI, or release metadata. Record the skip reason in `status.md`.

## User-Reported UI Regression Gate

Use this gate when touching the PromptBar shadows/mobile footer, settings shell/card chrome, ecommerce confirmed-build handoff, ecommerce canvas framework card, or ecommerce main-image ratio selector:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/prompt-bar-layout-regression.test.ts" `
  "tests/unit/settings-desktop-workbench-regression.test.ts" `
  "tests/unit/prompt-bar-ecommerce-framework-companion.test.ts" `
  "tests/unit/ecommerce-build-runtime-contract.test.ts" `
  "tests/unit/ecommerce-canvas-contract.test.ts" `
  "tests/unit/clay-frosted-surface-contract.test.ts" `
  "tests/unit/prompt-bar-ecommerce-footer-controls.test.ts" `
  "tests/unit/ecommerce-sheet-settings-runtime-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/app/useEcommerceBuildRuntime.ts" `
  "src/components/canvas/PromptNodeComponent.tsx" `
  "src/components/ecommerce/EcommerceCanvasWorkbenchCard.tsx" `
  "src/components/image/ImageOptionsPanel.tsx" `
  "src/components/layout/PromptBar.tsx" `
  "src/components/layout/prompt-bar/DesktopComposerModePanel.tsx" `
  "src/index.css" `
  "src/types.ts" `
  "tests/unit/ecommerce-build-runtime-contract.test.ts" `
  "tests/unit/ecommerce-canvas-contract.test.ts" `
  "tests/unit/prompt-bar-ecommerce-framework-companion.test.ts" `
  "tests/unit/prompt-bar-ecommerce-footer-controls.test.ts" `
  "tests/unit/prompt-bar-layout-regression.test.ts" `
  "tests/unit/settings-desktop-workbench-regression.test.ts" `
  "tests/unit/clay-frosted-surface-contract.test.ts" `
  "tests/unit/ecommerce-sheet-settings-runtime-contract.test.ts" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA is required for this gate. Use the Codex in-app Browser on the current local app and record URL, theme, desktop/mobile viewport or surface, PromptBar footer behavior, settings chrome/corner behavior, ecommerce framework card behavior when available, `.theme-transitioning`, stale chunk text count, and console error count in `status.md`.

## M129 KeyManager Update Diagnostic Redaction Gate

Use this gate when touching `keyManager.updateKey` diagnostics or key-manager secret redaction contracts:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/key-manager-channel-config-secrets-contract.test.ts" `
  "tests/unit/key-manager-credential-sanitizer-contract.test.ts" `
  "tests/unit/frontend-key-boundary-hardening.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run governance:security
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/auth/keyManager.ts" `
  "src/services/auth/keyManagerUpdateDiagnostics.ts" `
  "tests/unit/key-manager-channel-config-secrets-contract.test.ts" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it changes only a key-manager console diagnostic payload and a focused helper, with no JSX, CSS, route rendering, browser-visible UI, or release metadata change. Record the skip reason in `status.md`.

## M128 Dead Gemini Cache And Prompt Logging Cleanup Gate

Use this gate when touching the dead Gemini response cache module, prompt-content diagnostics, or the storage unused-cleanup source contract:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/storage-service-unused-cleanup-contract.test.ts"
rg -n "geminiCache|GeminiCache|kk_studio_gemini_cache|services/storage/cache|storage/cache" src tests apps packages
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/storage/cache.ts" `
  "src/context/CanvasContext.tsx" `
  "tests/unit/storage-service-unused-cleanup-contract.test.ts" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it removes a dead storage helper and redacts a console diagnostic without changing JSX, CSS, route rendering, browser-visible UI, or release metadata. Record the skip reason in `status.md`.

## M127 OpenAI-Compatible Image Reference Helper Gate

Use this gate when touching OpenAI-compatible reference-image formatting or chat image content-part helper ownership:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/openai-compatible-image-references-contract.test.ts" `
  "tests/unit/openai-compatible-unused-cleanup-contract.test.ts" `
  "tests/unit/openai-compatible-image-payload-contract.test.ts" `
  "tests/unit/openai-compatible-image-dispatch-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tests/unit/openai-compatible-image-sizing-contract.test.ts" `
  "tests/unit/openai-compatible-task-payload-contract.test.ts" `
  "tests/unit/openai-compatible-chat-payload-contract.test.ts" `
  "tests/unit/openai-compatible-google-extra-body-contract.test.ts" `
  "tests/unit/openai-compatible-twelve-ai-async-route-contract.test.ts" `
  "tests/unit/openai-compatible-acedata-route-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/llm/OpenAICompatibleAdapter.ts" `
  "src/services/llm/openAICompatibleImageReferences.ts" `
  "tests/unit/openai-compatible-image-references-contract.test.ts" `
  "tests/unit/openai-compatible-unused-cleanup-contract.test.ts" `
  "tsconfig.tests.json" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it is a non-UI service/helper extraction and dead-comment cleanup with no JSX, CSS, route rendering, browser-visible behavior, or release metadata change. Record the skip reason in `status.md`.

## M126 OpenAI-Compatible Image Payload Security Gate

Use this gate when touching image payload URL/MIME allowlisting:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/openai-compatible-image-payload-contract.test.ts" `
  "tests/unit/openai-compatible-image-dispatch-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tests/unit/openai-compatible-image-sizing-contract.test.ts" `
  "tests/unit/openai-compatible-task-payload-contract.test.ts" `
  "tests/unit/provider-surface-router.test.ts" `
  "tests/unit/provider-strategy.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run governance:security
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/llm/openAICompatibleImagePayload.ts" `
  "tests/unit/openai-compatible-image-payload-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it is a non-UI service/helper hardening with no JSX, CSS, route rendering, browser-visible behavior, or release metadata change. Record the skip reason in `status.md`.

## M125 OpenAI-Compatible 12AI Async And Chat Image Helper Gate

Use this gate when touching 12AI async route helper ownership or chat-image response extraction:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/openai-compatible-twelve-ai-async-route-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts"
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/openai-compatible-image-payload-contract.test.ts" `
  "tests/unit/openai-compatible-image-dispatch-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tests/unit/openai-compatible-image-sizing-contract.test.ts" `
  "tests/unit/openai-compatible-task-payload-contract.test.ts" `
  "tests/unit/provider-surface-router.test.ts" `
  "tests/unit/provider-strategy.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/llm/OpenAICompatibleAdapter.ts" `
  "src/services/llm/openAICompatible12AIAsyncRoute.ts" `
  "src/services/llm/openAICompatibleImagePayload.ts" `
  "tests/unit/openai-compatible-twelve-ai-async-route-contract.test.ts" `
  "tests/unit/openai-compatible-image-payload-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tsconfig.tests.json" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it is a non-UI service/helper extraction with no JSX, CSS, route rendering, browser-visible behavior, or release metadata change. Record the skip reason in `status.md`.

## M124 OpenAI-Compatible AceData Route Helper Gate

Use this gate when touching AceData route/base-url/reference-image/image-size helper ownership:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/openai-compatible-acedata-route-contract.test.ts" `
  "tests/unit/openai-compatible-wuyin-route-contract.test.ts" `
  "tests/unit/openai-compatible-image-dispatch-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tests/unit/openai-compatible-image-payload-contract.test.ts" `
  "tests/unit/openai-compatible-task-payload-contract.test.ts" `
  "tests/unit/provider-surface-router.test.ts" `
  "tests/unit/provider-strategy.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/llm/OpenAICompatibleAdapter.ts" `
  "src/services/llm/openAICompatibleAceDataRoute.ts" `
  "tests/unit/openai-compatible-acedata-route-contract.test.ts" `
  "tsconfig.tests.json" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it is a non-UI service/helper extraction with no JSX, CSS, route rendering, browser-visible behavior, or release metadata change. Record the skip reason in `status.md`.

## Post-M123 Settings UI Closure Gate

Use this gate when touching the already-dirty settings workbench shell/search/card flattening and M123 trace-contract follow-up:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/clay-frosted-surface-contract.test.ts" `
  "tests/unit/settings-desktop-workbench-regression.test.ts" `
  "tests/unit/settings-shell-scroll-regression.test.ts" `
  "tests/unit/settings-ui-density-regression.test.ts" `
  "tests/unit/settings-workbench-ui-refit.test.ts"
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/local-model-proxy-trace-contract.test.ts" `
  "tests/unit/secure-model-proxy-trace-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run spec:check
npm.cmd run governance:security
npm.cmd run audit:dependencies
npm.cmd run governance:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
npm.cmd run verify:desktop-settings-smoke
npm.cmd run verify:mobile-settings-smoke
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/components/settings/views/DashboardView.localized.tsx" `
  "src/components/settings/views/SystemLogsView.localized.tsx" `
  "src/index.css" `
  "tests/unit/clay-frosted-surface-contract.test.ts" `
  "tests/unit/local-model-proxy-trace-contract.test.ts" `
  "tests/unit/secure-model-proxy-trace-contract.test.ts" `
  "tests/unit/settings-desktop-workbench-regression.test.ts" `
  "tests/unit/settings-shell-scroll-regression.test.ts" `
  "tests/unit/settings-ui-density-regression.test.ts" `
  "tests/unit/settings-workbench-ui-refit.test.ts" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA is required because this slice touches visible settings UI. Record the Codex in-app Browser route, theme/surface, rendered controls, console error count, and any smoke-script fallback reason in `status.md`.

## M123 Local User-Route Task Token Helper Gate

Use this gate when touching local user-route task token helper ownership:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/local-user-route-task-token-contract.test.ts" `
  "tests/unit/local-user-route-task-signing-secret.test.ts" `
  "tests/unit/local-user-route-auth-contract.test.ts" `
  "tests/unit/local-user-route-endpoint-contract.test.ts" `
  "tests/unit/provider-auth-proxy-regression.test.ts" `
  "tests/unit/async-image-proxy-regression.test.ts" `
  "tests/unit/system-gemini-auth-regression.test.ts" `
  "tests/unit/twelve-ai-doc-alignment.test.ts" `
  "tests/unit/async-image-proxy-regression.test.ts" `
  "tests/unit/user-route-proxy-routing.test.ts" `
  "apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.test.ts" `
  "apps/api/src/modules/model-proxy/application/local-system-proxy-service.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run governance:security
npm.cmd run typecheck
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts" `
  "apps/api/src/modules/model-proxy/application/local-user-route-task-token.ts" `
  "tests/unit/local-user-route-task-token-contract.test.ts" `
  "tsconfig.tests.json" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it is a non-UI API helper extraction with no JSX, CSS, route rendering, or browser-visible behavior change. Record the skip reason in `status.md`. If unrelated UI WIP is present, keep the M123 commit path-limited and record any full-unit blocker separately.

## M122 Local User-Route Task Signing Security Gate

Use this gate when touching local user-route task token signing or verification:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/local-user-route-task-signing-secret.test.ts" `
  "tests/unit/local-user-route-auth-contract.test.ts" `
  "tests/unit/local-user-route-endpoint-contract.test.ts" `
  "tests/unit/provider-auth-proxy-regression.test.ts" `
  "tests/unit/system-gemini-auth-regression.test.ts" `
  "tests/unit/twelve-ai-doc-alignment.test.ts" `
  "tests/unit/async-image-proxy-regression.test.ts" `
  "tests/unit/user-route-proxy-routing.test.ts" `
  "apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.test.ts" `
  "apps/api/src/modules/model-proxy/application/local-system-proxy-service.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run governance:security
npm.cmd run architecture:check
npm.cmd run audit:dependencies
npm.cmd run spec:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "apps/api/src/lib/server-runtime-config.ts" `
  "apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts" `
  "tests/unit/local-user-route-task-signing-secret.test.ts" `
  "tsconfig.tests.json" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it is a non-UI API security hardening slice with no JSX, CSS, route rendering, or browser-visible behavior change. Record the skip reason in `status.md`.

## M121 OpenAI-Compatible Wuyin Route Helper Gate

Use this gate when touching the Wuyin route/base-url/reference-image/task-status helper boundary:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/openai-compatible-wuyin-route-contract.test.ts" `
  "tests/unit/openai-compatible-image-dispatch-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tests/unit/openai-compatible-image-payload-contract.test.ts" `
  "tests/unit/openai-compatible-task-payload-contract.test.ts" `
  "tests/unit/provider-surface-router.test.ts" `
  "tests/unit/provider-strategy.test.ts" `
  "tests/unit/twelve-ai-doc-alignment.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/llm/OpenAICompatibleAdapter.ts" `
  "src/services/llm/openAICompatibleWuyinRoute.ts" `
  "tests/unit/openai-compatible-wuyin-route-contract.test.ts" `
  "tsconfig.tests.json" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it is a non-UI service/helper extraction with no JSX, CSS, route rendering, or browser-visible behavior change. Record the skip reason in `status.md`.

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

## Post-M120 UI Split Gate

Use this gate for the completed ecommerce canvas workbench, PromptBar mobile action, and settings workbench chrome split:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/ecommerce-build-visibility-localization-regression.test.ts" `
  "tests/unit/ecommerce-build-runtime-contract.test.ts" `
  "tests/unit/ecommerce-group-shell-app-contract.test.ts" `
  "tests/unit/prompt-bar-ecommerce-framework-companion.test.ts" `
  "tests/unit/prompt-bar-ecommerce-group-workbench.test.ts" `
  "tests/unit/prompt-bar-layout-regression.test.ts" `
  "tests/unit/settings-desktop-workbench-regression.test.ts"
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/App.tsx" `
  "src/app/useEcommerceBuildRuntime.ts" `
  "src/components/canvas/PromptNodeComponent.tsx" `
  "src/components/ecommerce/EcommerceCanvasWorkbenchCard.tsx" `
  "src/components/layout/PromptBar.tsx" `
  "src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx" `
  "src/components/layout/prompt-bar/DesktopComposerModePanel.tsx" `
  "src/components/layout/prompt-bar/PromptBarFooterMobile.tsx" `
  "src/components/settings/desktop/SettingsDesktopWorkbenchHeader.tsx" `
  "src/index.css" `
  "tests/unit/ecommerce-build-runtime-contract.test.ts" `
  "tests/unit/ecommerce-build-visibility-localization-regression.test.ts" `
  "tests/unit/ecommerce-group-shell-app-contract.test.ts" `
  "tests/unit/prompt-bar-ecommerce-framework-companion.test.ts" `
  "tests/unit/prompt-bar-ecommerce-group-workbench.test.ts" `
  "tests/unit/prompt-bar-layout-regression.test.ts" `
  "tests/unit/settings-desktop-workbench-regression.test.ts"
```

Browser QA is required for this UI split. Record the Codex in-app Browser route, theme, `.theme-transitioning` count, stale chunk count, and console error count in `status.md`. If no seeded post-build ecommerce canvas fixture is available, record that limitation and keep the post-build canvas handoff covered by targeted source contracts.

## Ecommerce Requirement Analysis Fallback Gate

Use this gate when touching the ecommerce requirement-file analyzer client, especially static preview fallback, `.xlsx` local parsing, or upload endpoint response handling:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/ecommerce-analysis-client-fallback.test.ts" `
  "tests/unit/ecommerce-requirement-analysis-runtime-contract.test.ts" `
  "tests/unit/ecommerce-analysis-dev-proxy-contract.test.ts"
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/ecommerce/ecommerceAnalysisClient.ts" `
  "tests/unit/ecommerce-analysis-client-fallback.test.ts" `
  "validation.md" `
  "status.md"
```

Browser QA for this gate should verify the active app route loads without stale chunks or console errors. If the route is served from a static preview, record whether `/api/ecommerce-analysis` resolves to `200 text/html`; the automated fallback test covers that exact response shape for spreadsheet uploads.

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

## Ecommerce Task Merger Cleanup Gate

Use this gate for the ecommerce task merger unused-parameter cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/ecommerce-task-services.test.ts" "tests/unit/ecommerce-node-generation-runtime-contract.test.ts" "tests/unit/ecommerce-structured-task-source-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/ecommerce/taskMerger.ts" "tests/unit/ecommerce-task-services.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/ecommerce/taskMerger.ts` matches. Do not change sparse intent parsing, copy resolution, style/layout/inherit precedence, render task generation, or ecommerce runtime wiring in this cleanup slice.

## Model Display Name Cleanup Gate

Use this gate for the model display-name provider-parameter cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/model-display-name-regression.test.ts" "tests/unit/model-library-bootstrap-regression.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/model/modelCapabilities.ts" "tests/unit/model-display-name-regression.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/model/modelCapabilities.ts` matches. Do not change model/provider routing, admin model lookup, model-list bootstrapping, custom-label precedence, keyManager behavior, or API/settings surfaces in this cleanup slice.

## Video Service Unused Cleanup Gate

Use this gate for the video-service unused cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/video-service-unused-cleanup-contract.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/video/OpenAIVideoService.ts" "src/services/video/VeoVideoService.ts" "src/services/video/videoService.ts" "tests/unit/video-service-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/video` matches. Do not change browser fail-closed behavior, Veo request construction, API base normalization, progress labels, polling, download/auth headers, returned result shape, or provider routing in this cleanup slice.

## Image Service Unused Cleanup Gate

Use this gate for the image priority/LOD unused cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/image-service-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/image/imagePriorityLoader.ts" "src/services/image/lodService.ts" "tests/unit/image-service-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/image/imagePriorityLoader.ts` and zero `src/services/image/lodService.ts` matches. Do not change queue ordering, task execution, lazy-image import behavior, LOD thresholds, storage lookup order, cache mutation, memory-manager calls, fallback URL behavior, or browser-visible image rendering in this cleanup slice.

## Small LLM Adapter Unused Cleanup Gate

Use this gate for small audio/Volcengine adapter unused cleanup slices:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/llm-adapter-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/AudioCompatibleAdapter.ts" "src/services/llm/VolcengineAdapter.ts" "tests/unit/llm-adapter-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/llm/AudioCompatibleAdapter.ts` and zero `src/services/llm/VolcengineAdapter.ts` matches. Do not change audio request body construction, duration limiting, lyrics/style/continuation/TTS fields, polling, Volcengine endpoint selection, auth headers, or provider routing in this cleanup slice.

## Chat Service Unused Cleanup Gate

Use this gate for the chat-service unused cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/chat-service-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/chat/chatService.ts" "tests/unit/chat-service-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/chat/chatService.ts` matches. Do not change chat storage, saved-message/session behavior, request body construction, URL/header construction, keyManager success/failure reporting, provider/model routing, API/settings surfaces, endpoint/auth behavior, or browser-visible UI in this cleanup slice.

## Generation Runtime Contract Test Cleanup Gate

Use this gate for the test-only generation-runtime contract cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/generation-runtime-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true -p tsconfig.tests.json
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "tests/unit/generation-runtime-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true -p tsconfig.tests.json` probe is still expected to fail while broader test-config/type debt remains outside this slice; for this gate, filter the output and require zero `tests/unit/generation-runtime-contract.test.ts` matches. Do not change production generation runtime code, App wiring, retry generation behavior, billing behavior, provider routing, endpoint/auth behavior, release metadata, or browser-visible UI in this cleanup slice.

## Prompt Optimizer Duplicate Tab Cleanup Gate

Use this gate for the prompt optimizer duplicate-tab cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/prompt-optimizer-service-source-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/promptOptimizerService.ts" "tests/unit/prompt-optimizer-service-source-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/llm/promptOptimizerService.ts` matches. Do not change prompt optimization behavior, automatic route selection, provider routing, API/settings surfaces, endpoint/auth behavior, billing/payment behavior, storage persistence, release metadata, or browser-visible UI in this cleanup slice.

## KK API Client Unused DTO Cleanup Gate

Use this gate for the contract-client unused DTO cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/kk-api-client.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "packages/contracts/src/client/kk-api-client.ts" "tests/unit/kk-api-client.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `packages/contracts/src/client/kk-api-client.ts` matches. Do not change public DTO shapes, contract package exports, client endpoint paths, auth/header behavior, billing/payment business logic, provider routing, API/settings surfaces, storage persistence, release metadata, or browser-visible UI in this cleanup slice.

## User API Payload Secret-Constant Cleanup Gate

Use this gate for the user API payload unused secret-constant cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/billing-remaining-balance-contract.test.ts" "tests/unit/user-api-cloud-storage.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/api/userApiPayload.ts" "tests/unit/billing-remaining-balance-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/api/userApiPayload.ts` matches. Do not change secret redaction behavior, cloud record storage persistence behavior, API/settings surfaces, endpoint/auth behavior, billing/payment business logic, provider routing, storage migration, release metadata, or browser-visible UI in this cleanup slice.

## Cost Service Import-Only Cleanup Gate

Use this gate for the cost service import-only cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/import-only-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/billing/costService.ts" "tests/unit/import-only-unused-cleanup-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/billing/costService.ts` matches. Do not change pricing tables, cost calculation formulas, key-slot pricing snapshot lookup, cost recording/sync behavior, provider routing, API/settings surfaces, endpoint/auth behavior, storage persistence, release metadata, or browser-visible UI in this cleanup slice.

## Secure Model Proxy Unused-Helper Cleanup Gate

Use this gate for the secure model proxy unused-helper cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/user-route-proxy-routing.test.ts" "tests/unit/secure-model-proxy-credit-contract.test.ts" "tests/unit/secure-model-proxy-trace-contract.test.ts" "tests/unit/async-image-proxy-regression.test.ts" "tests/unit/local-model-proxy-trace-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/model/secureModelProxy.ts" "tests/unit/user-route-proxy-routing.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require that `src/services/model/secureModelProxy.ts` has no `buildInvocationError` diagnostic and only the two source-contracted local route gate diagnostics remain. Do not change local/system proxy endpoints, route-gate helper bodies, session/auth invalidation, retry behavior, provider routing, API/settings surfaces, billing/payment behavior, keyManager secret storage, storage persistence, release metadata, or browser-visible UI in this cleanup slice.

## User API Profile Import-Only Cleanup Gate

Use this gate for the user API profile import-only cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/runtime-legacy-fallback-guards.test.ts" "tests/unit/user-api-runtime-fallback.test.ts" "tests/unit/user-api-profile-storage-runtime-fallback.test.ts" "tests/unit/user-api-profile-storage-local-only.test.ts" "tests/unit/user-api-profile-storage-local-priority.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/api/userApiProfileStorage.ts" "tests/unit/runtime-legacy-fallback-guards.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/services/api/userApiProfileStorage.ts` diagnostics. Do not change typed auth API payload loading, local bridge reads/writes, cloud merge behavior, secret redaction behavior, provider routing, API/settings surfaces, billing/payment behavior, keyManager secret storage, storage persistence, release metadata, or browser-visible UI in this cleanup slice.

## UserProfileModal Billing Alias Cleanup Gate

Use this gate for the UserProfileModal stale billing alias cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/local-runtime-consistency-contract.test.ts" "tests/unit/kkai-billing-ui-surface.test.ts" "tests/unit/billing-remaining-balance-contract.test.ts" "tests/unit/user-profile-modal-auth-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/modals/UserProfileModal.tsx" "tests/unit/local-runtime-consistency-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/components/modals/UserProfileModal.tsx` diagnostics and no `billingFeatureEnabled` source matches. Because a UI component file is touched, run local browser QA before commit when the browser target is available. Do not change `BillingContext`, recharge services, balance/refund behavior, `KKAI_FEATURE_FLAGS.billing` semantics, provider routing, API/settings surfaces, keyManager secret storage, storage persistence, release metadata, or JSX/CSS in this cleanup slice.

## User API Cloud Helper Cleanup Gate

Use this gate for the user API cloud helper cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/runtime-legacy-fallback-guards.test.ts" "tests/unit/user-api-cloud-storage.test.ts" "tests/unit/user-api-profile-storage-runtime-fallback.test.ts" "tests/unit/user-api-profile-storage-local-only.test.ts" "tests/unit/user-api-profile-storage-local-priority.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/api/userApiCloudRecordStorage.ts" "tests/unit/runtime-legacy-fallback-guards.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/services/api/userApiCloudRecordStorage.ts` diagnostics and no `function getErrorMessage(` source match in that file. Do not change typed auth payload loading, local API fallback, cache behavior, payload compaction, secret redaction, provider routing, API/settings surfaces, billing/payment behavior, keyManager secret storage, storage persistence, release metadata, or browser-visible UI in this cleanup slice.

## NewAPI Management Service Unused Cleanup Gate

Use this gate for the NewAPI management service unused cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/billing-service-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/billing/newApiManagementService.ts" "tests/unit/billing-service-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/services/billing/newApiManagementService.ts` diagnostics, no stale `notify` import, and no unread `const channels = await this.getAllChannels();` binding. Preserve the `getAllChannels()` preflight side effect, `/api/channel/balance` request, `channels` cache key update, returned `updatedChannels` shape, NewAPI auth/header behavior, provider routing, API/settings surfaces, billing/payment behavior, storage persistence, release metadata, and browser-visible UI.

## Recharge Submission Service Unused Cleanup Gate

Use this gate for the recharge submission service unused cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/billing-service-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/billing/rechargeSubmissionService.ts" "tests/unit/billing-service-unused-cleanup-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/services/billing/rechargeSubmissionService.ts` diagnostics and no `function normalizeRechargePaymentChannelConfig(` source match. Preserve recharge bill/request construction, proof submission, route client behavior, default payment-channel config builder, `qrDisplay` mapping, channel list fallback behavior, billing/payment business logic, provider routing, API/settings surfaces, storage persistence, release metadata, and browser-visible UI.

## Storage Adapter Unused Cleanup Gate

Use this gate for the storage adapter unused cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/storage-service-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/storage/storageAdapter.ts" "tests/unit/storage-service-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/services/storage/storageAdapter.ts` diagnostics and no `compressIfNeeded` source match. Preserve OPFS/native/indexeddb import behavior, `getImageDimensionsFromFile` fallback semantics, `importImages` mode branching, `deleteImage` cleanup, and browser-visible storage behavior.

## Storage Preference Unused Cleanup Gate

Use this gate for the storage preference unused parameter cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/storage-service-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/storage/storagePreference.ts" "tests/unit/storage-service-unused-cleanup-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/services/storage/storagePreference.ts` diagnostics and require `saveOriginalToLocalFolder` to keep the third argument slot as `_prompt?: string`. Preserve local-folder write behavior, existing timestamp filename generation, `mergeStorages()` call shape, storage mode behavior, provider routing, API/settings surfaces, keyManager secret storage, release metadata, and browser-visible UI.

## Image Storage Unused Cleanup Gate

Use this gate for the image storage unused local cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/storage-service-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/storage/imageStorage.ts" "tests/unit/storage-service-unused-cleanup-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/services/storage/imageStorage.ts` diagnostics and require `cleanupOriginals()` to avoid reacquiring an unread IndexedDB handle. Preserve batch image pagination, compression, `saveImage` updates, saved-byte accounting, storage mode behavior, provider routing, API/settings surfaces, keyManager secret storage, release metadata, and browser-visible UI.

## Google Adapter Import Cleanup Gate

Use this gate for the Google adapter import-only cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/llm-adapter-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/GoogleAdapter.ts" "tests/unit/llm-adapter-unused-cleanup-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/services/llm/GoogleAdapter.ts` diagnostics and require `generateVideo()` to keep its inline `import('./LLMAdapter').VideoGenerationOptions` / `VideoGenerationResult` type references. Preserve Google/Gemini chat, image, audio, video request behavior, 12AI gateway handling, provider routing, API/settings surfaces, keyManager secret storage, release metadata, and browser-visible UI.

## Gemini Service Unused Cleanup Gate

Use this gate for the Gemini service import/helper cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/llm-service-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/geminiService.ts" "tests/unit/llm-service-unused-cleanup-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/services/llm/geminiService.ts` diagnostics and preserve `calculateCost(...)`, `classifyApiFailure`, `logError`, `getImage`, `llmService.generateImage(llmOptions)`, and the secure-proxy error helpers. Browser QA may be skipped for this slice because it is a non-UI service cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.

## Image Generation Hook Unused Cleanup Gate

Use this gate for the `useImageGeneration` unused-code cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/image-generation-unused-cleanup-contract.test.ts" "tests/unit/generation-billing-runtime-contract.test.ts" "tests/unit/generation-runtime-contract.test.ts" "tests/unit/ecommerce-structured-task-source-contract.test.ts" "tests/unit/partial-redraw-pipeline-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/hooks/useImageGeneration.ts" "tests/unit/image-generation-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/hooks/useImageGeneration.ts` diagnostics and preserve `saveOriginalImage`, `getImage`, `normalizePersistableMediaSource`, generation billing coordinator calls, sync bridge recovery, generated-media persistence, and pending-task state transitions. Browser QA may be skipped because this slice removes dead hook bindings only and does not change JSX, CSS, route rendering, or browser-visible UI behavior.

## API Settings Unused Cleanup Gate

Use this gate for the `ApiSettingsView` unused-code cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/api-settings*.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts" "tests/unit/settings-workbench-ui-refit.test.ts" "tests/unit/settings-canonical-entry-regression.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/settings/ApiSettingsView.tsx" "tests/unit/api-settings-unused-cleanup-contract.test.ts" "tests/unit/api-settings-view-source-guard.test.ts" "tests/unit/api-settings-encoding-guard.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/components/settings/ApiSettingsView.tsx` diagnostics and preserve API settings route visibility, readonly snapshot behavior, BYOK persistence, source encoding guards, and settings workbench contracts. Because this touches a visible settings view, run browser smoke after build when a local browser target is available.

## keyManager Unused Cleanup Gate

Use this gate for the `keyManager.ts` compiler-proven unused binding cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/google-official-gemini-protocol-guards.test.ts tests/unit/key-manager-dead-code-pruning-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager*.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts" "tests/unit/runtime-legacy-fallback-guards.test.ts" "tests/unit/route-aware-credit-billing.test.ts" "tests/unit/generation-runtime-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "tests/unit/key-manager-dead-code-pruning-contract.test.ts" "tests/unit/key-manager-model-helpers-contract.test.ts" "tests/unit/google-official-gemini-protocol-guards.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while the two source-contracted `src/services/model/secureModelProxy.ts` route-gate helper diagnostics remain outside this slice; for this gate, require zero `src/services/auth/keyManager.ts` diagnostics. Preserve `keyManagerModelHelpers.ts` compatibility re-exports, key storage, provider credential values, provider persistence, cloud payload shape, storage persistence, route selection behavior, release metadata, UI surfaces, and generation/PPT runtime behavior. Browser QA may be skipped because this is a non-UI service/source-contract cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.

## secureModelProxy Route Gate Wiring Gate

Use this gate for the `secureModelProxy.ts` route-gate helper wiring slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/user-route-proxy-routing.test.ts tests/unit/secure-model-proxy-credit-contract.test.ts tests/unit/frontend-key-boundary-hardening.test.ts
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/model/secureModelProxy.ts" "tests/unit/user-route-proxy-routing.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe should now pass cleanly for this slice because the only two secure proxy route-gate helpers are read from the live entrypoints. Preserve the current local user-route and local system proxy behavior, the no-browser-direct / no-stale-fallback contracts, billing metadata propagation, session invalidation behavior, provider routing, release metadata, and browser-visible UI.

## Stage Two CanvasContext Split Gate

Use this gate for `src/context/CanvasContext.tsx` splits. Add or narrow targeted tests after the responsibility map identifies the exact boundary; do not use one broad commit for state model, mutations, drag/selection, and persistence at the same time. Stage Two M1 used this gate for the state/default/context boundary plus the separated canvas compatibility helper. Stage Two M2 used the selection reducer contract below. Stage Two M3 used the prompt child image resolver contract below. Stage Two M4 used the workflow source node ID resolver contract below. Stage Two M5 used the media recovery contract below. Stage Two M10 used the placement contract below. Stage Two M11 used the layering contract below. Stage Two M12 used the group management contract below. Stage Two M13 used the movement contract below. Stage Two M14 used the tags contract below. Stage Two M15 used the node updates contract below. Stage Two M16 used the position updates contract below. Stage Two M17 used the prompt-image links contract below. Stage Two M18 used the workflow updates contract below. Stage Two M19 reused the prompt-image links contract below with the image deletion transform added. Stage Two M20 used the merge-into contract below. Stage Two M21 used the unused-code cleanup contract below. Stage Two M22 used the arrange-selection contract below. Stage Two M23 reused the unused-code cleanup contract below with the duplicate selected-arrange fallback guard added. Stage Two M24 used the arrange-selection contract below with selected-root cases added. Stage Two M25 used the arrange-selection contract below with selected grouped arrange and fallthrough cases added. Stage Two M26 used the auto-arrange contract below and is committed in `7cbd7346`. Stage Two M27 used the node updates contract below with prompt add/update reducers and is committed in `b16843ee`. Stage Two M79 reused the unused-code cleanup contract below with a type-import-only guard for `CanvasContextType` and `SubCardLayout`.

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

Workflow-source-node-ID resolver targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-workflow-source-node-ids-contract.test.ts" `
  "tests/unit/canvas-prompt-child-images-runtime-contract.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts"
```

Media recovery targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-media-recovery-contract.test.ts" `
  "tests/unit/canvas-startup-local-restore.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts"
```

Startup prompt recovery targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-prompt-recovery-contract.test.ts" `
  "tests/unit/canvas-startup-local-restore.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts"
```

Persisted image recovery targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-persisted-image-recovery-contract.test.ts" `
  "tests/unit/canvas-persisted-image-hydration-guard.test.ts" `
  "tests/unit/canvas-startup-local-restore.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts"
```

Canvas merge targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-merge-contract.test.ts" `
  "tests/unit/canvas-startup-local-restore.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts"
```

Canvas merge-into targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-merge-into-contract.test.ts" `
  "tests/unit/canvas-merge-contract.test.ts" `
  "tests/unit/canvas-cleanup-contract.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts"
```

Canvas unused-code cleanup targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-context-unused-cleanup.test.ts" `
  "tests/unit/canvas-merge-into-contract.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts"
```

Canvas arrange-selection targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-arrange-selection-contract.test.ts" `
  "tests/unit/prompt-group-regroup-layout.test.ts" `
  "tests/unit/prompt-group-regroup-behavior.test.ts" `
  "tests/unit/prompt-group-drag-layout.test.ts" `
  "tests/unit/canvas-live-scene-contract.test.ts" `
  "tests/unit/canvas-context-unused-cleanup.test.ts"
```

Canvas auto-arrange targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-auto-arrange-contract.test.ts" `
  "tests/unit/canvas-arrange-selection-contract.test.ts" `
  "tests/unit/prompt-group-regroup-layout.test.ts" `
  "tests/unit/prompt-group-regroup-behavior.test.ts" `
  "tests/unit/prompt-group-drag-layout.test.ts" `
  "tests/unit/canvas-live-scene-contract.test.ts" `
  "tests/unit/canvas-context-unused-cleanup.test.ts"
```

Canvas cleanup targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-cleanup-contract.test.ts" `
  "tests/unit/canvas-workflow-source-node-ids-contract.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts" `
  "tests/unit/canvas-startup-local-restore.test.ts"
```

Canvas placement targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-placement-contract.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts" `
  "tests/unit/canvas-startup-local-restore.test.ts" `
  "tests/unit/canvas-cleanup-contract.test.ts"
```

Canvas layering targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-layering-contract.test.ts" `
  "tests/unit/canvas-placement-contract.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts" `
  "tests/unit/canvas-startup-local-restore.test.ts" `
  "tests/unit/canvas-cleanup-contract.test.ts" `
  "tests/unit/prompt-group-regroup-behavior.test.ts" `
  "tests/unit/prompt-group-drag-layout.test.ts" `
  "tests/unit/canvas-live-scene-contract.test.ts" `
  "tests/unit/canvas-connector-throttling-contract.test.ts"
```

Canvas group management targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-groups-contract.test.ts" `
  "tests/unit/canvas-layering-contract.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-cleanup-contract.test.ts"
```

Canvas movement targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-movement-contract.test.ts" `
  "tests/unit/prompt-group-drag-layout.test.ts" `
  "tests/unit/prompt-group-regroup-behavior.test.ts" `
  "tests/unit/canvas-live-scene-contract.test.ts" `
  "tests/unit/canvas-connector-throttling-contract.test.ts"
```

Canvas tags targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-tags-contract.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts"
```

Canvas node updates targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-node-updates-contract.test.ts" `
  "tests/unit/canvas-persisted-image-hydration-guard.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts"
```

Canvas position updates targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-position-updates-contract.test.ts" `
  "tests/unit/prompt-group-drag-layout.test.ts" `
  "tests/unit/prompt-group-regroup-behavior.test.ts" `
  "tests/unit/canvas-live-scene-contract.test.ts"
```

Canvas prompt-image links targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-prompt-image-links-contract.test.ts" `
  "tests/unit/canvas-prompt-child-images-runtime-contract.test.ts" `
  "tests/unit/canvas-cleanup-contract.test.ts"
```

Canvas workflow updates targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-workflow-updates-contract.test.ts" `
  "tests/unit/canvas-workflow-source-node-ids-contract.test.ts" `
  "tests/unit/workflow-document-domain.test.ts" `
  "tests/unit/canvas-cleanup-contract.test.ts"
```

Minimum architecture split gate:

```powershell
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/context/CanvasContext.tsx" "src/context/canvasContextState.ts" "src/context/canvasCompatibility.ts" "src/context/canvasGroups.ts" "src/context/canvasMovement.ts" "src/context/canvasTags.ts" "src/context/canvasNodeUpdates.ts" "src/context/canvasPositionUpdates.ts" "src/context/canvasPromptImageLinks.ts" "src/context/canvasWorkflowUpdates.ts" "src/workflow/adapters/canvasToWorkflow.ts" "src/workflow/persistence/workflowSerializer.ts" "tests/unit" "plans.md" "implement.md" "validation.md" "status.md"
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

## Stage Two keyManager Split Gate

Use this gate for `src/services/auth/keyManager.ts` splits. Start with pure helpers that can be contract-tested without touching storage, permissions, encryption, provider credential state, UI, or release metadata.

Model parsing/normalization targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/model-id-normalization-parity-contract.test.ts" `
  "tests/unit/key-manager-model-helpers-contract.test.ts" `
  "tests/unit/key-manager-runtime-fallback.test.ts" `
  "tests/unit/official-route-default-models.test.ts" `
  "tests/unit/model-display-name-regression.test.ts" `
  "tests/unit/model-library-bootstrap-regression.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts"
```

Model-list normalization targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/key-manager-model-list-contract.test.ts" `
  "tests/unit/key-manager-model-helpers-contract.test.ts" `
  "tests/unit/key-manager-default-models-contract.test.ts" `
  "tests/unit/official-route-default-models.test.ts" `
  "tests/unit/model-id-normalization-parity-contract.test.ts" `
  "tests/unit/key-manager-runtime-fallback.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tests/unit/model-display-name-regression.test.ts" `
  "tests/unit/model-library-bootstrap-regression.test.ts" `
  "tests/unit/twelve-ai-doc-alignment.test.ts"
```

Model-list normalization slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerModelList.ts" "tests/unit/key-manager-model-list-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Effective provider model fallback targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/key-manager-effective-provider-models-contract.test.ts" `
  "tests/unit/official-route-default-models.test.ts" `
  "tests/unit/key-manager-runtime-fallback.test.ts" `
  "tests/unit/api-settings-view-source-guard.test.ts" `
  "tests/unit/model-library-bootstrap-regression.test.ts" `
  "tests/unit/key-manager-model-list-contract.test.ts"
```

Effective provider model fallback slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerEffectiveProviderModels.ts" "tests/unit/key-manager-effective-provider-models-contract.test.ts" "tests/unit/official-route-default-models.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Default model constants targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/key-manager-default-models-contract.test.ts" `
  "tests/unit/official-route-default-models.test.ts" `
  "tests/unit/key-manager-runtime-fallback.test.ts" `
  "tests/unit/twelve-ai-doc-alignment.test.ts"
```

Default model constants slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerDefaultModels.ts" "tests/unit/key-manager-default-models-contract.test.ts" "tests/unit/official-route-default-models.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Provider presets targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/key-manager-provider-presets-contract.test.ts" `
  "tests/unit/twelve-ai-doc-alignment.test.ts" `
  "tests/unit/flow2api-provider-support.test.ts" `
  "tests/unit/key-manager-runtime-fallback.test.ts" `
  "tests/unit/official-route-default-models.test.ts"
```

Provider presets slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerProviderPresets.ts" "tests/unit/key-manager-provider-presets-contract.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts" "tests/unit/flow2api-provider-support.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Documented static provider model helper slices reuse the provider presets gate above and this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerProviderPresets.ts" "tests/unit/key-manager-provider-presets-contract.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

Silent pricing URL helper targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/key-manager-pricing-url-contract.test.ts" `
  "tests/unit/key-manager-runtime-fallback.test.ts" `
  "tests/unit/user-route-pricing-endpoint-override.test.ts" `
  "tests/unit/kk-api-client.test.ts"
```

Key type/cycle-break targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/key-manager-key-type-contract.test.ts" `
  "tests/unit/key-manager-model-helpers-contract.test.ts" `
  "tests/unit/key-manager-runtime-fallback.test.ts" `
  "tests/unit/provider-strategy.test.ts" `
  "tests/unit/official-route-default-models.test.ts" `
  "tests/unit/model-library-bootstrap-regression.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts"
```

Provider runtime-state merge targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/key-manager-provider-persistence-contract.test.ts" `
  "tests/unit/key-manager-cloud-sync.test.ts" `
  "tests/unit/key-manager-runtime-fallback.test.ts" `
  "tests/unit/user-api-cloud-storage.test.ts" `
  "tests/unit/frontend-key-boundary-hardening.test.ts" `
  "tests/unit/auth-data-routes.test.ts"
```

Provider linked-slot matching targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/key-manager-provider-links-contract.test.ts" `
  "tests/unit/key-manager-provider-persistence-contract.test.ts" `
  "tests/unit/key-manager-runtime-fallback.test.ts" `
  "tests/unit/provider-strategy.test.ts" `
  "tests/unit/official-route-default-models.test.ts" `
  "tests/unit/model-library-bootstrap-regression.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tests/unit/user-api-cloud-storage.test.ts"
```

keyManager architecture slices also require:

```powershell
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerModelHelpers.ts" "src/services/auth/keyManagerKeyType.ts" "src/services/auth/keyManagerEffectiveSlot.ts" "tests/unit/key-manager-model-helpers-contract.test.ts" "tests/unit/key-manager-key-type-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Silent pricing URL helper slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerPricingUrl.ts" "tests/unit/key-manager-pricing-url-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Provider runtime-state merge slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerProviders.ts" "src/services/auth/keyManagerStorage.ts" "tests/unit/key-manager-provider-persistence-contract.test.ts" "tests/unit/key-manager-runtime-fallback.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Provider linked-slot matching slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerProviderLinks.ts" "tests/unit/key-manager-provider-links-contract.test.ts" "tests/unit/key-manager-runtime-fallback.test.ts" "tests/unit/key-manager-provider-persistence-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Provider usage helper slices should use this targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager-provider-usage-contract.test.ts" "tests/unit/key-manager-provider-links-contract.test.ts" "tests/unit/key-manager-runtime-fallback.test.ts" "tests/unit/key-manager-provider-persistence-contract.test.ts"
```

Provider usage delegator-pruning slices may use this narrower targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager-provider-usage-contract.test.ts" "tests/unit/key-manager-runtime-fallback.test.ts"
```

Provider usage delegator-pruning slices may use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "tests/unit/key-manager-provider-usage-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

Provider usage helper slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerProviderUsage.ts" "tests/unit/key-manager-provider-usage-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Route ID helper slices should use this targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager-route-ids-contract.test.ts" "tests/unit/key-manager-runtime-fallback.test.ts" "tests/unit/official-route-default-models.test.ts" "tests/unit/key-manager-provider-links-contract.test.ts"
```

Route ID helper slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerRouteIds.ts" "tests/unit/key-manager-route-ids-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Credential sanitizer slices should use this targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager-credential-sanitizer-contract.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts" "tests/unit/official-route-default-models.test.ts" "tests/unit/key-manager-key-type-contract.test.ts"
```

Credential sanitizer slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerCredentialSanitizer.ts" "tests/unit/key-manager-credential-sanitizer-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Channel config secret-boundary slices should use this targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager-channel-config-secrets-contract.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts" "tests/unit/key-manager-runtime-fallback.test.ts" "tests/unit/official-route-default-models.test.ts"
```

Channel config secret-boundary slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerChannelConfigSecrets.ts" "tests/unit/key-manager-channel-config-secrets-contract.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Dead-code pruning slices should use this targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager-dead-code-pruning-contract.test.ts" "tests/unit/model-library-bootstrap-regression.test.ts" "tests/unit/key-manager-runtime-fallback.test.ts"
```

Dead-code pruning slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "tests/unit/key-manager-dead-code-pruning-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

Browser-direct diagnostics guard slices should use this targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/frontend-key-boundary-hardening.test.ts" "tests/unit/key-manager-dead-code-pruning-contract.test.ts" "tests/unit/key-manager-channel-config-secrets-contract.test.ts" "tests/unit/key-manager-runtime-fallback.test.ts" "tests/unit/official-route-default-models.test.ts"
```

Browser-direct diagnostics guard slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "tests/unit/frontend-key-boundary-hardening.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

Model ID compatibility facade slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/utils/modelIdNormalization.ts" "src/services/auth/keyManagerModelHelpers.ts" "tests/unit/model-id-normalization-parity-contract.test.ts" "tests/unit/key-manager-model-helpers-contract.test.ts" "tests/unit/model-display-name-regression.test.ts" "tests/unit/provider-image-routing-regression.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
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

## OpenAI-Compatible Adapter Gates

## OpenAI-Compatible Gemini Image Sizing Helper Gate

Use this gate when touching Gemini image-size or requested aspect-ratio normalization for OpenAI-compatible image routes:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/openai-compatible-image-sizing-contract.test.ts" "tests/unit/openai-compatible-image-payload-contract.test.ts" "tests/unit/openai-compatible-image-dispatch-contract.test.ts" "tests/unit/openai-compatible-image-routing-errors-contract.test.ts" "tests/unit/provider-image-routing-regression.test.ts" "tests/unit/provider-surface-router.test.ts" "tests/unit/provider-strategy.test.ts" "tests/unit/provider-channel-surface-view.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts" "tests/unit/async-image-proxy-regression.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/OpenAICompatibleAdapter.ts" "src/services/llm/openAICompatibleImageSizing.ts" "tests/unit/openai-compatible-image-sizing-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

Browser QA may be skipped for this slice because it moves pure service normalization helpers with no JSX, CSS, route rendering, or browser-visible behavior change.

## OpenAI-Compatible Google Extra Body Helper Gate

Use this gate when touching New API Google `extra_body` construction or merge behavior for OpenAI-compatible routes:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/openai-compatible-google-extra-body-contract.test.ts" "tests/unit/openai-compatible-image-sizing-contract.test.ts" "tests/unit/openai-compatible-image-payload-contract.test.ts" "tests/unit/openai-compatible-image-dispatch-contract.test.ts" "tests/unit/openai-compatible-image-routing-errors-contract.test.ts" "tests/unit/provider-image-routing-regression.test.ts" "tests/unit/provider-surface-router.test.ts" "tests/unit/provider-strategy.test.ts" "tests/unit/provider-channel-surface-view.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts" "tests/unit/async-image-proxy-regression.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/OpenAICompatibleAdapter.ts" "src/services/llm/openAICompatibleGoogleExtraBody.ts" "tests/unit/openai-compatible-google-extra-body-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Browser QA may be skipped for this slice because it moves pure service helper logic with no JSX, CSS, route rendering, or browser-visible behavior change.

## OpenAI-Compatible Chat Payload Helper Gate

Use this gate when touching OpenAI-compatible chat message construction or chat-completions request body construction:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/openai-compatible-chat-payload-contract.test.ts" "tests/unit/openai-compatible-google-extra-body-contract.test.ts" "tests/unit/openai-compatible-image-sizing-contract.test.ts" "tests/unit/openai-compatible-task-payload-contract.test.ts" "tests/unit/provider-surface-router.test.ts" "tests/unit/provider-strategy.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/OpenAICompatibleAdapter.ts" "src/services/llm/openAICompatibleChatPayload.ts" "tests/unit/openai-compatible-chat-payload-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Browser QA may be skipped for this slice because it moves pure service helper logic with no JSX, CSS, route rendering, or browser-visible behavior change.

Use this gate for OpenAI-compatible adapter structural slices, including diagnostics preview helper extraction, image-routing error classifier extraction, unreachable image fallback cleanup, the M107 image-dispatch helper extraction, the M108 image-payload helper extraction, and the M109 image-sizing helper extraction:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/openai-compatible-image-sizing-contract.test.ts" "tests/unit/openai-compatible-image-payload-contract.test.ts" "tests/unit/openai-compatible-image-dispatch-contract.test.ts" "tests/unit/openai-compatible-image-routing-errors-contract.test.ts" "tests/unit/openai-compatible-diagnostics-contract.test.ts" "tests/unit/provider-image-routing-regression.test.ts" "tests/unit/provider-surface-router.test.ts" "tests/unit/provider-strategy.test.ts" "tests/unit/provider-channel-surface-view.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts" "tests/unit/async-image-proxy-regression.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run governance:security
npm.cmd run audit:dependencies
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
```

This slice also requires this path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/OpenAICompatibleAdapter.ts" "src/services/llm/openAICompatibleDiagnostics.ts" "src/services/llm/openAICompatibleImageDispatch.ts" "src/services/llm/openAICompatibleImagePayload.ts" "src/services/llm/openAICompatibleImageSizing.ts" "src/services/llm/openAICompatibleImageRoutingErrors.ts" "tests/unit/openai-compatible-diagnostics-contract.test.ts" "tests/unit/openai-compatible-image-dispatch-contract.test.ts" "tests/unit/openai-compatible-image-payload-contract.test.ts" "tests/unit/openai-compatible-image-sizing-contract.test.ts" "tests/unit/openai-compatible-image-routing-errors-contract.test.ts" "tests/unit/provider-image-routing-regression.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

## Local User-Route Auth Helper Gate

Use this gate for the historical M112 server-side local user-route auth/header/query-key helper extraction and the current compatibility wrapper over the shared helper:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/local-user-route-auth-contract.test.ts" "tests/unit/provider-auth-proxy-regression.test.ts" "tests/unit/system-gemini-auth-regression.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts" "tests/unit/async-image-proxy-regression.test.ts" "tests/unit/user-route-proxy-routing.test.ts" "apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "apps/api/src/lib/local-user-route-auth.ts" "apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts" "apps/api/src/modules/model-proxy/application/local-user-route-auth.ts" "tests/unit/local-user-route-auth-contract.test.ts" "tests/unit/provider-auth-proxy-regression.test.ts" "tests/unit/system-gemini-auth-regression.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts" "tests/unit/async-image-proxy-regression.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Do not change endpoint selection, fetch execution, task operation routing, credential retrieval/storage, keyManager/cloud sync, provider branch execution, fallback ordering, billing metadata, release metadata, or UI behavior in this slice. Browser QA may be skipped for this non-UI server/helper extraction after recording the skip reason in `status.md`.

## Local User-Route Endpoint Helper Gate

Use this gate for the M113 server-side local user-route direct endpoint URL normalization helper extraction:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/local-user-route-endpoint-contract.test.ts" "tests/unit/local-user-route-auth-contract.test.ts" "tests/unit/provider-auth-proxy-regression.test.ts" "tests/unit/system-gemini-auth-regression.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts" "tests/unit/async-image-proxy-regression.test.ts" "tests/unit/user-route-proxy-routing.test.ts" "apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "apps/api/src/lib/local-user-route-auth.ts" "apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts" "apps/api/src/modules/model-proxy/application/local-user-route-auth.ts" "apps/api/src/modules/model-proxy/application/local-user-route-endpoints.ts" "tests/unit/local-user-route-endpoint-contract.test.ts" "tests/unit/local-user-route-auth-contract.test.ts" "tests/unit/provider-auth-proxy-regression.test.ts" "tests/unit/system-gemini-auth-regression.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts" "tests/unit/async-image-proxy-regression.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Do not change auth/header/query-key behavior, endpoint call-site behavior, fetch behavior, task operation routing, credential retrieval/storage, keyManager/cloud sync, provider branch execution, fallback ordering, logging, billing metadata, release metadata, or UI behavior in this slice. Browser QA may be skipped for this non-UI server/helper extraction after recording the skip reason in `status.md`.

## Post-M113 Review Fix Gate

Use this gate for the review-fix/gate-repair closeout that touches auth signing, system proxy task signing, Postgres session rotation, release guardrails, OCR defaults, and canvas id forwarding:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/workspace-auth-gate.test.ts" "tests/unit/ocr-service-settings-contract.test.ts" "tests/unit/local-env-contract.test.ts" "tests/unit/portable-payment-package-contract.test.ts" "tests/unit/portable-app-server-document-proxy-contract.test.ts" "tests/unit/hosted-release-guardrails.test.ts" "tests/unit/vps-postgres-audit-contract.test.ts" "tests/unit/postgres-user-session-repository.test.ts" "tests/unit/kk-session-token.test.ts" "tests/unit/request-authenticator.test.ts" "apps/api/src/modules/model-proxy/application/local-system-proxy-service.test.ts" "tests/unit/canvas-live-unused-cleanup-contract.test.ts" "tests/unit/ecommerce-wheel-scroll-guard.test.ts" "tests/unit/governance-contract.test.ts"
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
npm.cmd run spec:check
npm.cmd run governance:check
npm.cmd run audit:dependencies
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- ".env.example" "apps/api/sql/bootstrap-self-hosted-postgres.sql" "apps/api/src/modules/auth/infrastructure/kk-session-token.ts" "apps/api/src/modules/auth/infrastructure/postgres-user-session-repository.ts" "apps/api/src/modules/model-proxy/application/local-system-proxy-service.ts" "apps/api/src/modules/model-proxy/application/local-system-proxy-service.test.ts" "scripts/postgres/bootstrap-kk-vps.sql" "scripts/release-hosted.mjs" "scripts/release/create-portable-release.mjs" "scripts/release/portable-app-server.cjs" "scripts/test/set-log-level.mjs" "src/app/authGate.ts" "src/app/AuthenticatedAppShell.tsx" "src/components/canvas/InfiniteCanvas.tsx" "src/services/document/nutrientDocumentService.ts" "tests/unit" "plans.md" "implement.md" "validation.md" "status.md"
```

Because this gate touches `src/components/canvas/InfiniteCanvas.tsx`, browser QA is mandatory. Record the in-app Browser URL, title, visible `#canvas-container`, root count, and console error count in `status.md`.

## Legacy Payment-Server Security Gate

Use this gate when touching legacy `payment-server` callback configuration, WeChat Pay webhook validation, or legacy payment return/notify URL defaults:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/payment-server-legacy-security-contract.test.ts" "tests/unit/payment-webhook-wechat-raw-body.test.ts" "tests/unit/payment-webhook-fail-closed.test.ts" "tests/unit/payment-runtime-hardening.test.ts"
npm.cmd run typecheck:payment-server
node scripts/ci/check-tests-types.mjs tsconfig.tests.json
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
npm.cmd run governance:security
npm.cmd run audit:dependencies
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "payment-server/index.js" "payment-server/webhook.js" "tests/unit/payment-server-legacy-security-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Browser QA may be skipped for this slice because it hardens the legacy payment server and tests request/server behavior without JSX, CSS, route rendering, or browser-visible UI changes.

## keyManager Shared Pricing Helper Gate

Use this gate for the M114 shared pricing catalog/snapshot helper extraction:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager-shared-pricing-contract.test.ts" "tests/unit/key-manager-model-helpers-contract.test.ts" "tests/unit/key-manager-pricing-url-contract.test.ts" "tests/unit/key-manager-provider-persistence-contract.test.ts" "tests/unit/key-manager-provider-usage-contract.test.ts" "tests/unit/key-manager-runtime-fallback.test.ts" "tests/unit/user-api-cloud-storage.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerSharedPricing.ts" "tests/unit/key-manager-shared-pricing-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Do not change provider fetches, provider persistence, cloud sync, key storage, route selection, runtime model resolution, localStorage policy, release metadata, or UI behavior in this slice. Browser QA may be skipped for this non-UI service/helper extraction after recording the skip reason in `status.md`.

## keyManager Remote Model Discovery Helper Gate

Use this gate for the M115 remote model discovery response parsing helper extraction:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager-remote-model-discovery-contract.test.ts"
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager-remote-model-discovery-contract.test.ts" "tests/unit/key-manager-model-helpers-contract.test.ts" "tests/unit/key-manager-model-list-contract.test.ts" "tests/unit/key-manager-shared-pricing-contract.test.ts" "tests/unit/key-manager-pricing-url-contract.test.ts" "tests/unit/key-manager-api-type-contract.test.ts" "tests/unit/google-official-gemini-protocol-guards.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerRemoteModelDiscovery.ts" "tests/unit/key-manager-remote-model-discovery-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Do not change provider fetch execution, endpoint selection, auth/header/query-key behavior, provider persistence, cloud sync, key storage, route selection, runtime model resolution, localStorage policy, release metadata, or UI behavior in this slice. Browser QA may be skipped for this non-UI service/helper extraction after recording the skip reason in `status.md`.

## UI Unused Cleanup Gate

Use this gate for PromptBar/ImageCard and legacy dashboard compiler-source cleanup slices:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/prompt-bar-*.test.ts" "tests/unit/canvas-live-scene-contract.test.ts" "tests/unit/canvas-visual-regression.test.ts" "tests/unit/ui-unused-cleanup-contract.test.ts" "tests/unit/dashboard-settings-overview-regression.test.ts" "tests/unit/dashboard-settings-legacy-pruning.test.ts" "tests/unit/billing-remaining-balance-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run architecture:check
npm.cmd run governance:security
npm.cmd run audit:dependencies
npm.cmd run spec:check
npm.cmd run governance:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/layout/PromptBar.tsx" "src/components/image/ImageCard2.tsx" "src/components/settings/views/DashboardView.tsx" "tests/unit/ui-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is expected to fail while broader TS6133 debt remains outside this slice; for this gate, filter the output and require zero `PromptBar.tsx`, `ImageCard2.tsx`, and `src/components/settings/views/DashboardView.tsx` matches for the touched file set.

## File-System Compatibility Stub Cleanup Gate

Use this gate for `fileSystemService.ts` tag/settings compatibility stub parameter cleanup:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/filesystem-tag-shortcut-compat-contract.test.ts" "tests/unit/canvas-filesystem-persistence-scope.test.ts" "tests/unit/filesystem-startup-consolidation-deferral.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run architecture:check
npm.cmd run governance:security
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/storage/fileSystemService.ts" "tests/unit/filesystem-tag-shortcut-compat-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is expected to fail while broader TS6133 debt remains outside this slice; for this gate, filter the output and require zero `src/services/storage/fileSystemService.ts` matches. Do not remove or implement the compatibility stubs in this cleanup slice.

## Import-Only Unused Cleanup Gate

Use this gate for import/type-list-only cleanup slices:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/import-only-unused-cleanup-contract.test.ts" "tests/unit/partial-redraw-lightbox-contract.test.ts" "tests/unit/responsive-surface.test.ts" "tests/unit/google-official-gemini-protocol-guards.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/image/GlobalLightbox.tsx" "src/hooks/useImageQuality.ts" "src/services/model/modelRegistry.ts" "tests/unit/import-only-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is expected to fail while broader TS6133 debt remains outside this slice; for this gate, filter the output and require zero matches for the touched import-only file set.

## Live Canvas Residual Cleanup Gate

Use this gate for live `InfiniteCanvas.tsx` residual noUnused cleanup:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/canvas-live-unused-cleanup-contract.test.ts" "tests/unit/canvas-live-scene-contract.test.ts" "tests/unit/canvas-visual-regression.test.ts" "tests/unit/ecommerce-wheel-scroll-guard.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/canvas/InfiniteCanvas.tsx" "tests/unit/canvas-live-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is expected to fail while broader TS6133 debt remains outside this slice; for this gate, filter the output and require zero `src/components/canvas/InfiniteCanvas.tsx` matches. Do not narrow `InfiniteCanvasProps` or change JSX/interaction behavior in this cleanup slice.

## Workflow Actions Import Cleanup Gate

Use this gate for `src/app/useWorkflowActions.ts` import-only cleanup:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/workflow-actions-unused-cleanup-contract.test.ts" "tests/unit/canvas-workflow-updates-contract.test.ts" "tests/unit/canvas-workflow-source-node-ids-contract.test.ts" "tests/unit/workflow-document-domain.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/app/useWorkflowActions.ts" "tests/unit/workflow-actions-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/app/useWorkflowActions.ts` matches. Do not change template definitions, `App.tsx` template-list wiring, workflow card factories, or workflow UI behavior in this cleanup slice.

## Common ErrorBoundary Unused Cleanup Gate

Use this gate for `src/components/common/ErrorBoundary.tsx` unused-parameter cleanup:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/startup-error-localization.test.ts" "tests/unit/app-startup-screen-localization.test.ts" "tests/unit/clay-frosted-surface-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/common/ErrorBoundary.tsx" "tests/unit/startup-error-localization.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/components/common/ErrorBoundary.tsx` matches. Do not change captured-error localization, frosted error UI, reload behavior, startup error rendering, or global error handling in this cleanup slice.

## Generation Runtime Import Cleanup Gate

Use this gate for `src/app/useGenerationRuntime.ts` import-only cleanup:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/generation-runtime-contract.test.ts"
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/generation-billing-runtime-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/app/useGenerationRuntime.ts" "tests/unit/generation-runtime-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/app/useGenerationRuntime.ts` matches. Do not change generation execution, retry billing, model-label behavior, App runtime wiring, provider routing, or UI behavior in this cleanup slice.

## App Unused Cleanup Gate

Use this gate for the App compiler-source cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/app-unused-cleanup-contract.test.ts" "tests/unit/ui-unused-cleanup-contract.test.ts" "tests/unit/canvas-live-scene-contract.test.ts" "tests/unit/canvas-visual-regression.test.ts" "tests/unit/canvas-connector-throttling-contract.test.ts" "tests/unit/generation-runtime-contract.test.ts" "tests/unit/prompt-group-regroup-behavior.test.ts" "tests/unit/prompt-group-drag-layout.test.ts" "tests/unit/canvas-workflow-source-node-ids-contract.test.ts" "tests/unit/canvas-workflow-updates-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/App.tsx" "tests/unit/app-unused-cleanup-contract.test.ts" "tests/unit/ecommerce-framework-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/App.tsx` matches.

## OpenAI-Compatible Unused Cleanup Gate

Use this gate for the OpenAI-compatible compiler-source cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/openai-compatible-unused-cleanup-contract.test.ts" "tests/unit/openai-compatible-image-routing-errors-contract.test.ts" "tests/unit/openai-compatible-diagnostics-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/OpenAICompatibleAdapter.ts" "tests/unit/openai-compatible-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/llm/OpenAICompatibleAdapter.ts` matches.

## LLMService Unused Cleanup Gate

Use this gate for the LLMService compiler-source cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/llm-service-unused-cleanup-contract.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts" "tests/unit/user-route-proxy-routing.test.ts" "tests/unit/async-image-proxy-regression.test.ts" "tests/unit/secure-model-proxy-credit-contract.test.ts" "tests/unit/secure-model-proxy-trace-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/LLMService.ts" "tests/unit/llm-service-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/llm/LLMService.ts` matches.

## Pure Utility Unused Cleanup Gate

Use this gate for the pure utility compiler-source cleanup and pure image orphan cleanup slices:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/pure-utility-unused-cleanup-contract.test.ts" "tests/unit/prompt-group-regroup-behavior.test.ts" "tests/unit/prompt-group-drag-layout.test.ts" "tests/unit/ui-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
if ((rg -n "imageCompression" src -S) -ne $null) { throw "imageCompression source reference remains" }
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/App.tsx" "src/app/promptGroupRenderLayout.ts" "src/utils/modelSorting.ts" "src/services/image/imageCompression.ts" "tests/unit/pure-utility-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/app/promptGroupRenderLayout.ts`, `src/utils/modelSorting.ts`, `src/App.tsx`, and `src/services/image/imageCompression.ts` matches. For the pure image orphan cleanup, the `rg` guard must find no `imageCompression` source references.

## ChatSidebar Unused Cleanup Gate

Use this gate for the ChatSidebar compiler-source cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/chat-sidebar-unused-cleanup-contract.test.ts" "tests/unit/billing-remaining-balance-contract.test.ts" "tests/unit/capability-route-runtime-preference-contract.test.ts" "tests/unit/kkai-billing-ui-surface.test.ts" "tests/unit/model-library-public-admin-browse.test.ts" "tests/unit/model-library-open-guards.test.ts" "tests/unit/prompt-bar-model-library-loading.test.ts" "tests/unit/clay-frosted-surface-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/layout/ChatSidebar.tsx" "tests/unit/chat-sidebar-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/components/layout/ChatSidebar.tsx` matches.

## Dormant Canvas Unused Cleanup Gate

Use this gate for source-proven dormant canvas support cleanup slices:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/canvas-dormant-unused-cleanup-contract.test.ts" "tests/unit/clay-frosted-surface-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
if ((rg -n "PixiCanvas|preloadPixi|isPixiAvailable" src -S) -ne $null) { throw "Pixi canvas source reference remains" }
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/canvas/PixiCanvas.tsx" "src/components/canvas/Canvas.tsx" "src/components/canvas/PendingNode.tsx" "tests/unit/canvas-dormant-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/components/canvas/PixiCanvas`, `src/components/canvas/Canvas`, and `src/components/canvas/PendingNode` matches. Browser QA may be skipped when the slice deletes or cleans only dormant canvas support code with no live production imports; record the skip reason in `status.md`.

## PromptNode Unused Cleanup Gate

Use this gate for the PromptNode compiler-source cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/prompt-node-unused-cleanup-contract.test.ts" "tests/unit/prompt-node-optimizer-display-contract.test.ts" "tests/unit/prompt-optimizer-service-source-contract.test.ts" "tests/unit/canvas-live-scene-contract.test.ts" "tests/unit/canvas-visual-regression.test.ts" "tests/unit/ppt-deck-single-container-contract.test.ts" "tests/unit/ecommerce-card-thumbnail-labels.test.ts" "tests/unit/ecommerce-canvas-contract.test.ts" "tests/unit/ecommerce-display-label-surface.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/canvas/PromptNodeComponent.tsx" "tests/unit/prompt-node-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/components/canvas/PromptNodeComponent.tsx` matches. Because this is a visible component file, record browser smoke evidence after build even when the source cleanup is intended to be visual-no-op.

## SystemLogs Unused Cleanup Gate

Use this gate for the SystemLogs compiler-source cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/system-logs-unused-cleanup-contract.test.ts" "tests/unit/settings-workbench-ui-refit.test.ts" "tests/unit/settings-canonical-entry-regression.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/settings/views/SystemLogsView.tsx" "src/components/settings/views/SystemLogsView.localized.tsx" "tests/unit/system-logs-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/components/settings/views/SystemLogsView` matches. Because this touches visible settings views, record browser smoke evidence after build even when the cleanup is intended to be visual-no-op.

## ProjectManager Unused Cleanup Gate

Use this gate for the ProjectManager prop-destructure cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/project-manager-unused-cleanup-contract.test.ts" "tests/unit/clay-frosted-surface-contract.test.ts" "tests/unit/theme-system-adaptation.test.ts" "tests/unit/workspace-layout-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/settings/ProjectManager.tsx" "tests/unit/project-manager-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/components/settings/ProjectManager.tsx` matches. Keep `ProjectManagerProps` compatibility declarations and do not change JSX, controls, visual styling, dropdown behavior, workflow UI, or canvas operations in this cleanup slice.

## Onboarding Unused Cleanup Gate

Use this gate for the AchievementToast and Onboarding residual compiler-source cleanup slices:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/onboarding-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/Onboarding/AchievementToast.tsx" "src/components/Onboarding/OnboardingManager.tsx" "src/components/Onboarding/OnboardingOverlay.tsx" "src/components/Onboarding/useOnboardingProgress.ts" "tests/unit/onboarding-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/components/Onboarding` matches. Because this touches visible onboarding components, record browser smoke evidence after build even when the cleanup is intended to be visual-no-op.

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

## M116 Ecommerce Visibility Localization Gate

Use this gate for the active ecommerce visibility/localization UI closure slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-node-updates-contract.test.ts" `
  "tests/unit/ecommerce-build-runtime-contract.test.ts" `
  "tests/unit/ecommerce-build-visibility-localization-regression.test.ts" `
  "tests/unit/ecommerce-button-guards.test.ts" `
  "tests/unit/ecommerce-canvas-contract.test.ts" `
  "tests/unit/ecommerce-canvas-flow-contract.test.ts" `
  "tests/unit/ecommerce-framework-contract.test.ts" `
  "tests/unit/ecommerce-framework-runtime-state-contract.test.ts" `
  "tests/unit/ecommerce-group-shell-app-contract.test.ts" `
  "tests/unit/ecommerce-runtime-contract.test.ts" `
  "tests/unit/prompt-bar-ecommerce-framework-companion.test.ts" `
  "tests/unit/prompt-bar-ecommerce-group-workbench.test.ts" `
  "tests/unit/mobile-ecommerce-continuation-surface.test.ts" `
  "tests/unit/mobile-result-feed-detail-contract.test.ts" `
  "tests/unit/mobile-workspace-surface-contract.test.ts"
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/App.tsx" `
  "src/app/useEcommerceBuildRuntime.ts" `
  "src/app/useEcommerceRuntime.ts" `
  "src/app/usePromptGroupLayout.ts" `
  "src/components/ecommerce/EcommerceCardActions.tsx" `
  "src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx" `
  "src/components/mobile/MobileResultDetailScreen.tsx" `
  "src/components/mobile/MobileResultFeed.tsx" `
  "src/context/CanvasContext.tsx" `
  "tests/unit/canvas-node-updates-contract.test.ts" `
  "tests/unit/ecommerce-build-runtime-contract.test.ts" `
  "tests/unit/ecommerce-build-visibility-localization-regression.test.ts" `
  "tests/unit/ecommerce-button-guards.test.ts" `
  "tests/unit/ecommerce-canvas-contract.test.ts" `
  "tests/unit/ecommerce-canvas-flow-contract.test.ts" `
  "tests/unit/ecommerce-framework-contract.test.ts" `
  "tests/unit/ecommerce-framework-runtime-state-contract.test.ts" `
  "tests/unit/ecommerce-group-shell-app-contract.test.ts" `
  "tests/unit/ecommerce-runtime-contract.test.ts" `
  "tests/unit/prompt-bar-ecommerce-framework-companion.test.ts" `
  "tests/unit/prompt-bar-ecommerce-group-workbench.test.ts" `
  "tests/unit/mobile-ecommerce-continuation-surface.test.ts" `
  "tests/unit/mobile-result-feed-detail-contract.test.ts" `
  "tests/unit/mobile-workspace-surface-contract.test.ts" `
  "tsconfig.tests.json" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Because this slice touches visible UI, record Codex in-app Browser evidence in `status.md`: URL, viewport, theme, ecommerce/mobile surface checked, `.theme-transitioning`, stale chunk text count, and console error count.

## Current Startup Simple Progress UI Gate

Use this gate for the startup loading screen redesign:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/settings-entry-surface-style-regression.test.ts tests/unit/app-startup-screen-localization.test.ts
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/app-startup-coordinator.test.ts tests/unit/workspace-auth-gate.test.ts tests/unit/workspace-startup-skeleton-contract.test.ts
npm.cmd run typecheck
npm.cmd run build
npm.cmd run check:encoding
```

Fresh evidence for this slice:

- RED first: the simple progress regression failed because the current component had no `getStageProgress` stage-driven width contract.
- GREEN: the startup surface/localization tests passed 5/5.
- GREEN: startup coordinator/auth gate/skeleton contract tests passed 12/12.
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1466/1466).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run check:encoding`.
- Browser QA: local built-fixture desktop 1280x720 and mobile 390x844 checks passed with a single prompt, a 0-100 progress fill, no overflow, and text-fit true; screenshots are in `output/playwright/`.
- Vercel preview deploy passed: `https://kk-studio-6n5q1hmzi-yykks-projects-727e9560.vercel.app`.

## Release Gate

Run these before final sign-off:

```powershell
npm.cmd run governance:check
npm.cmd run audit:dependencies
npm.cmd run spec:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run check:encoding
```

## Current Hosted Login Route Fix Gate

Use this gate for the `kkai.plus` hosted login route fix:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/kk-api-base-url-hosted-contract.test.ts tests/unit/vps-deploy-contract.test.ts tests/unit/vps-deploy-artifacts.test.ts
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none --test-name-pattern "kkai.plus browser CORS preflight" tests/unit/api-server-startup.test.ts
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- apps/api/src/server.ts scripts/vps/kk-api.env.example scripts/vps/kk-vps.env.example src/services/api/kkApiBaseUrl.ts tests/unit/api-server-startup.test.ts tests/unit/kk-api-base-url-hosted-contract.test.ts tests/unit/vps-deploy-artifacts.test.ts tests/unit/vps-deploy-contract.test.ts status.md validation.md
```

Fresh evidence for this slice:

- RED first: `tests/unit/kk-api-base-url-hosted-contract.test.ts` failed because hosted `kkai.plus` still resolved `https://172-245-156-16.sslip.io` to `https://kkai.plus`.
- RED first: `tests/unit/api-server-startup.test.ts --test-name-pattern "kkai.plus browser CORS preflight"` failed because `access-control-allow-origin` was missing for `https://kkai.plus`.
- GREEN: the targeted base URL/VPS deployment/CORS tests passed 8/8 plus the focused CORS test 1/1.
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1454/1454).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run check:encoding`.
- Passed: path-limited alternate-git `diff --check` with Windows LF/CRLF normalization warnings only.

Production smoke requirement after deploy:

```powershell
node -e "fetch('https://172-245-156-16.sslip.io/api/v1/auth/login',{method:'OPTIONS',headers:{origin:'https://kkai.plus','access-control-request-method':'POST','access-control-request-headers':'content-type,x-client-version'}}).then(r=>console.log(r.status,r.headers.get('access-control-allow-origin'),r.headers.get('access-control-allow-credentials')))"
```

Expected: `204 https://kkai.plus true`. If this still returns missing CORS headers, deploy or restart the VPS API with either the committed code or `KK_API_ALLOWED_ORIGINS=https://kkai.plus,https://www.kkai.plus`.

## Security Cleanup Gate

Use this gate for narrow endpoint or secret-boundary cleanup slices:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/governance-contract.test.ts"
npm.cmd run governance:security
npm.cmd run audit:dependencies
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
npm.cmd run governance:check
```

Current release status: the former `governance:version` portable metadata mismatch was cleared by `567f85aa`, and `npm.cmd run governance:check` passed in the latest full gate. Rerun this gate after any future packaging or publish metadata change.

## Current Admin Login UI Fix Gate

```powershell
node --test --test-isolation=none tests/unit/admin-login-page-surface.test.ts
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/admin-login-page-surface.test.ts
npm.cmd run admin:build
npm.cmd run typecheck
npm.cmd run check:encoding
```

Browser validation: Codex in-app Browser checked built `apps/admin/dist` at `http://127.0.0.1:4174/login` on desktop 1280x720 and mobile 390x844; console error count was `0`.

## Finalization Audit Gate

Use this after the active Stage Two slice is closed and before claiming full project completion:

```powershell
npm.cmd run architecture:check
npm.cmd run spec:check
npm.cmd run governance:security
npm.cmd run audit:dependencies
npm.cmd run governance:agent-docs
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run check:encoding
```

If UI files were touched since the last browser evidence, rerun the Clay UI contract suite and Codex in-app Browser QA before final sign-off. If only runtime/docs files were touched, record the browser skip reason in `status.md`.

## Canvas Card Overflow Rollback Gate

Use this gate for the canvas card text overflow rollback:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-visual-regression.test.ts
npm.cmd run typecheck
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
```

Fresh production rollback evidence:

- Bad hosted deployment inspected before rollback: `npx.cmd vercel inspect https://kkai.plus --scope yykks-projects-727e9560` reported production deployment `dpl_3WRjJS4YvCfLCCcwpcpTa5ArWnnH`, URL `https://kk-studio-7bki6mquo-yykks-projects-727e9560.vercel.app`, `commitSha: 3267afb381377580170e96b9952467952bea63d0`.
- Rollback command passed: `npx.cmd vercel rollback https://kk-studio-2dege9hxw-yykks-projects-727e9560.vercel.app -y --scope yykks-projects-727e9560 --timeout 5m`.
- Rollback status passed: `npx.cmd vercel rollback status kk-studio --scope yykks-projects-727e9560` reported success for `kk-studio-2dege9hxw-yykks-projects-727e9560.vercel.app` (`dpl_J9bcG4DvMeuE2ZrfivQMLD8NF637`).
- Post-rollback inspect passed: `npx.cmd vercel inspect https://kkai.plus --scope yykks-projects-727e9560` reports production deployment `dpl_J9bcG4DvMeuE2ZrfivQMLD8NF637`.
- Post-rollback asset/version fetch passed: `https://kkai.plus/` serves `assets/index-C92hbb3n.js`, `assets/canvas-core-CUNRGw_l.js`, and `assets/index-BSLZ6Um1.css`; `https://kkai.plus/app-version.json` reports `buildTime: 2026-05-09T20:15:06.564Z` and `commitSha: 9aa070f87ec4cb1e494404b2eb4f2e04d197772b`.
- Local code rollback: the `PromptNodeComponent` text-wrap helper, the `WorkflowUtilityCard` width/height clamp, and the source-level regression test for that withdrawn fix were removed from the working tree so a future local deploy does not reintroduce the hosted UI regression.
