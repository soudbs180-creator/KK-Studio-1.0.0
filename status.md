# KK-Studio v1.4.6 Coordination Status

Last updated: 2026-05-09

## Current 1.4.6 Release Blocker Audit

- Active user issue: align the release candidate to v1.4.6 after adding desktop snap-to-grid and collapsed manual canvas groups, while preserving hosted/VPS security, dependency audit, visible Chinese text, PromptBar UI details, local storage safety, and real browser QA gates.
- Current 1.4.6 version-alignment scope: root package metadata, lockfiles, payment-server metadata, workspace package metadata, release manifest, stable portable manifest, README/agent/development ledgers, and portable release URL scanners are being aligned to `1.4.6`. The two feature commits already in the alternate-git history are `7d4b83bb feat: add canvas snap to grid toggle` and `f5d15c44 feat: collapse manual canvas groups`.
- Portable packaging fix: `scripts/release/create-portable-release.mjs` and `scripts/release/portable-app-server.cjs` now detect `VITE_KK_API_BASE_URL` when the built Vite bundle emits the value with backticks, double quotes, or single quotes. Focused contracts in `tests/unit/portable-payment-package-contract.test.ts` and `tests/unit/portable-app-server-document-proxy-contract.test.ts` guard this scanner behavior.
- Portable publish evidence: `VITE_KK_API_BASE_URL=https://api.kkai.plus npm.cmd run package:portable` completed and regenerated `release/KK-Studio-Portable`; `npm.cmd run publish:portable` completed after the payment-server dependency audit fix and updated `release/publish/stable/manifest.json` for `KK-Studio-Portable-1.4.6.zip` with SHA-256 `f7dd639e1e8ce2f17a029ea02aeb2ed28af72884a8588fae49a8c0151689e22f` and size `52899158`.
- Implemented scope for this audit: `api/_vpsProxy.ts` plus the `api/v1/*`, `api/auth/*`, `api/healthz.ts`, and `api/manifest.ts` Vercel functions; `src/services/api/kkApiBaseUrl.ts`; `scripts/diagnose-hosted-release.mjs`; `payment-server/package.json` and lockfile overrides; `scripts/vps/kk-api.env.example`; `scripts/vps/kk-vps.env.example`; `scripts/vps/configure-kk-vps-api-tls.sh`; `src/components/layout/PromptBar.tsx`; `src/components/canvas/PendingNode.tsx`; `tests/unit/vercel-vps-proxy.test.ts`; `tests/unit/kk-api-base-url-hosted-contract.test.ts`; `tests/unit/hosted-release-guardrails.test.ts`; `tests/unit/vps-deploy-artifacts.test.ts`; `tests/unit/vps-deploy-contract.test.ts`; `tests/unit/prompt-bar-layout-regression.test.ts`; and `tests/unit/encoding-check-contract.test.ts`.
- Browser QA evidence: previous refreshed Chromium fallback QA ran at `http://127.0.0.1:4327` with desktop dark `1600x1000`, desktop light `1440x920`, and mobile dark `390x844`. The old summary file is [output/playwright/1.4.5-release-qa/release-qa-summary-refreshed.json](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/output/playwright/1.4.5-release-qa/release-qa-summary-refreshed.json). Fresh v1.4.6 targeted browser smoke now passes through `npm.cmd run verify:desktop-settings-smoke` and `npm.cmd run verify:mobile-settings-smoke` at `http://127.0.0.1:3000` using same-process Vite plus `chromium_headless_shell-1217`. Desktop viewport `1600x980` covered direct settings, API management, advanced/diagnostics controls, and workspace settings overlay. Mobile viewport `430x932` covered mobile workspace, seeded result tile/detail, more sheet settings entry, settings overview, API workbench, diagnostics, and platform sections. Desktop smoke still logs the known isolated admin model fetch console error during local model catalog loading, but both browser smoke scripts completed in `mode: browser`.
- Browser QA tooling fix: the browser verification scripts now prefer stable Playwright npx cache entries over alpha cache entries before falling back to mtime ordering. This avoids selecting a stale alpha cache whose browser revision is not installed, and is covered by `tests/unit/mobile-settings-browser-verify-script.test.ts`.
- Browser QA surface notes: login, temporary local workspace, PromptBar/model menu, settings, recharge/balance entry, mobile footer, mobile more sheet, and mobile settings all rendered without console or page errors. The model control showed the expected single-row mobile width and the active toggle retained a gradient background on the desktop login surface.
- Validation status: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/vercel-vps-proxy.test.ts tests/unit/kk-api-base-url-hosted-contract.test.ts tests/unit/hosted-release-guardrails.test.ts tests/unit/vps-deploy-artifacts.test.ts tests/unit/vps-deploy-contract.test.ts tests/unit/prompt-bar-layout-regression.test.ts tests/unit/encoding-check-contract.test.ts` passed 29/29; the portable scanner focused gate passed 5/5; the browser-verifier source contract gate passed 14/14; `npm.cmd run verify:desktop-settings-smoke` passed; `npm.cmd run verify:mobile-settings-smoke` passed; `npm.cmd run audit:dependencies` passed with root and `payment-server` both reporting 0 vulnerabilities after overriding `fast-uri` to `^3.1.2`; `npm.cmd run spec:check` passed; `npm.cmd run typecheck` passed with semantic coverage for 130 test files; `npm.cmd run test:unit` passed 1441/1441; `npm.cmd run build` passed; `npm.cmd run governance:check` passed; `npm.cmd run governance:agent-docs` passed; `npm.cmd run check:encoding` passed; and alternate-git `diff --check` passed with Windows LF/CRLF normalization warnings only.
- Fresh VPS TLS/dependency follow-up evidence: a TDD regression first failed on the missing exact `/internal` nginx rule, then passed after adding `location = /internal { return 404; }` beside the `/internal/` block. `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/vps-deploy-contract.test.ts tests/unit/hosted-release-guardrails.test.ts tests/unit/kk-api-client.test.ts` passed 36/36. `payment-server` now overrides `hono` to `^4.12.18`, `payment-server/package-lock.json` resolves `hono@4.12.18`, and `npm.cmd run audit:dependencies` reports 0 vulnerabilities in both root and `payment-server`.
- Fresh final validation for this follow-up: `npm.cmd run governance:check`, `npm.cmd run audit:dependencies`, `npm.cmd run spec:check`, `npm.cmd run typecheck`, `npm.cmd run test:unit` (1442/1442), `npm.cmd run build`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check` all passed. VPS script verification copied the helper to `/tmp`, `bash -n` passed, and the run stopped at the expected DNS fail-fast message before nginx/certbot state changes.
- Hosted release blocker: `npm.cmd run release:hosted:check` is still blocked by the local dirty snapshot because `.env.local` contains `VITE_TURNSTILE_LOCAL_BYPASS=true` and `VITE_KK_API_BASE_URL=http://172.245.156.16`. It also reports several hosted OAuth/Turnstile/payment-sidecar secrets as missing from the local snapshot. This must be rerun in a clean hosted environment before a production release can be called ready.
- Clean-env preflight evidence: temporarily moving local `.env.local` and `apps/api/.env.local` aside, injecting non-secret process-env stand-ins, and restoring the files after the command made `npm.cmd run release:hosted:check` pass with `Immediate Blockers: none`, `Remote Checks: none`, and `Warnings: none`.
- Final Vercel package-boundary fix: `.vercelignore` now explicitly excludes `output/`, `tests/`, `docs/`, and local AI coordination ledgers in addition to `.env*`, `dist`, `build`, `deploy`, `release`, `node_modules`, logs, caches, and local temp directories. This keeps Playwright QA logs/screenshots, test-only files, and generated local artifacts out of the production Vercel upload while preserving the runtime source, API functions, package manifests, lockfiles, and configuration required for a complete hosted build.
- Final production deploy evidence: after the package-boundary fix, `npx.cmd vercel deploy --prod -y --scope yykks-projects-727e9560` completed successfully from the repository root. Vercel warned about the sibling `deploy/` directory, but only `361B` of changed upload data was sent before the remote build downloaded 1588 deployment files, restored cache from `dpl_CeHJvnqAFdcj5YTiFVeMnRNAmZ7V`, ran `npm run build` as `kk-studio@1.4.6`, transformed 2140 modules, and completed the production build. `npx.cmd vercel inspect https://kkai.plus --scope yykks-projects-727e9560` now reports deployment `dpl_Ae8ckSKAuHthpkNssLnaB1dwHR5Y`, target `production`, status `Ready`, URL `https://kk-studio-l8gex5abk-yykks-projects-727e9560.vercel.app`, with aliases `https://kkai.plus`, `https://www.kkai.plus`, `https://kk-studio.vercel.app`, `https://kk-studio-yykks-projects-727e9560.vercel.app`, and `https://kk-studio-yinchenkang0-1635-yykks-projects-727e9560.vercel.app`.
- Latest production redeploy evidence: after commits `517a2b1c` and `b61c22ce`, `npx.cmd vercel deploy --prod -y --scope yykks-projects-727e9560` completed successfully from the repository root. The remote build ran `npm run build` as `kk-studio@1.4.6`, transformed 2140 modules, completed in Vercel, and aliased `https://kkai.plus`. `npx.cmd vercel inspect https://kkai.plus --scope yykks-projects-727e9560` now reports deployment `dpl_6s5DUt2GbjqiBgDH9boXXfnjnz7B`, target `production`, status `Ready`, URL `https://kk-studio-2djvg3elv-yykks-projects-727e9560.vercel.app`, with aliases `https://kkai.plus`, `https://www.kkai.plus`, `https://kk-studio.vercel.app`, `https://kk-studio-yykks-projects-727e9560.vercel.app`, and `https://kk-studio-yinchenkang0-1635-yykks-projects-727e9560.vercel.app`.
- Prior production environment evidence: an earlier `npx.cmd vercel inspect https://kkai.plus --scope yykks-projects-727e9560` check reported deployment `dpl_FZvsN9pLa7fB2mib9tWTGUt3KqyR`, target `production`, status `Ready`, with aliases `https://kkai.plus` and `https://www.kkai.plus`. `npx.cmd vercel env ls --scope yykks-projects-727e9560` showed production frontend env keys for `VITE_KK_API_BASE_URL`, `VITE_AUTH_REDIRECT_ORIGIN`, `VITE_KK_ADMIN_URL`, `VITE_TURNSTILE_SITE_KEY`, and `VITE_TURNSTILE_ENABLED`; legacy Supabase env keys are still present in Vercel and should be removed from the hosted project once no older deployment depends on them.
- VPS API TLS guardrail: `scripts/vps/configure-kk-vps-api-tls.sh` now defaults to `API_DOMAIN=api.kkai.plus` and `EXPECTED_API_IPV4=172.245.156.16`, fails before nginx/certbot changes when DNS is not pointed at the VPS, installs a webroot Let's Encrypt certificate after DNS is correct, writes the HTTPS nginx virtual host, keeps exact `/internal` and prefix `/internal/` closed with `404`, and serves only ACME challenge paths during the temporary HTTP phase so authenticated API traffic is not exposed before TLS is ready. Focused contracts cover the helper and the runbook.
- Current VPS smoke evidence: Cloudflare DNS lookup for `api.kkai.plus` still returns `198.18.0.73`, while the VPS itself sees no usable A record for the domain. Raw VPS HTTP API health remains good: `http://172.245.156.16/healthz` returns `200` with PostgreSQL-backed auth, billing, workspace, key-manager, and session persistence ready; `http://172.245.156.16/api/manifest` returns `200`; and unauthenticated `http://172.245.156.16/api/v1/auth/session` returns the expected `401 AUTH_REQUIRED` JSON envelope.
- Fresh VPS nginx exposure fix: the live VPS nginx config was updated from the committed gateway template and reloaded after `nginx -t` passed. `nginx -T` now shows exact `/internal` and prefix `/internal/` 404 blocks and no `/internal/` proxy to the payment sidecar. HTTP smoke confirms `http://172.245.156.16/internal` and `http://172.245.156.16/internal/` return nginx `404`; `http://172.245.156.16/healthz` and `/api/manifest` still return `200`.
- Cloudflare DNS automation: authoritative DNS for `kkai.plus` is Cloudflare (`autumn.ns.cloudflare.com`, `langston.ns.cloudflare.com`), and the repository now has `scripts/deploy/cloudflare-upsert-api-dns.mjs` to upsert `api.kkai.plus` as a DNS-only A record to `172.245.156.16` when `CF_API_TOKEN` or `CLOUDFLARE_API_TOKEN` is available. Current machine state has no visible Cloudflare token and `wrangler whoami` is unauthenticated, so the helper correctly fails closed with a missing-token message instead of pretending the DNS blocker is solved.
- Remaining production blocker: public DNS for `api.kkai.plus` must be changed to `A api -> 172.245.156.16` at the authoritative DNS provider, then `scripts/vps/configure-kk-vps-api-tls.sh` must be rerun on the VPS so port 443 serves a valid certificate for `api.kkai.plus`. Before full-line release can be called ready, `/healthz`, `/api/manifest`, and `/api/v1/auth/session` must smoke over HTTPS and public `/internal` plus `/internal/` paths must return `404`.
- VPS exposure hardening: `deploy/nginx/kk-vps-gateway.conf` and `deploy/nginx/kk-vps.conf` now return `404` for public `/internal/` locations instead of proxying them to the payment sidecar. Focused VPS contract tests cover this fail-closed behavior.
- Dirty-worktree guard: do not stage `output/` or the local dirty env files. Existing unrelated snap-to-grid, collapsed-group, and other canvas hotfix work remains dirty and must stay excluded from the release audit commit line.

## Current Desktop Snap-To-Grid Hotfix

- Active user issue: add a desktop left-toolbar snap feature so dragging canvas cards can snap to the grid when enabled.
- Implemented scope: `src/utils/canvasSnapToGrid.ts` defines the 16-unit snap helper; `src/components/settings/ProjectManager.tsx` adds the magnet toolbar toggle with `data-testid="canvas-snap-to-grid-toggle"` and `aria-pressed`; `src/App.tsx` owns the `snapToGrid` state and passes it to prompt/image/workflow utility cards plus selected-node/group drag commit paths; prompt cards, image cards, and workflow utility cards apply the helper during drag position updates; preview/save/agent workflow wrapper props accept the forwarded snap flag; `src/context/canvasMovement.ts` snaps each moved selected node's final persisted position when requested.
- Review follow-up: a read-only subagent review found workflow utility cards could persist off-grid positions at non-100% zoom because snapped coordinates were passed through render pixel rounding, and multi-selected drags could leave companion cards off-grid. Fixed by persisting `nextPosition` directly in `WorkflowUtilityCard.tsx` and by adding optional snap behavior to `moveSelectedCanvasNodes`, `CanvasContext`, `usePromptGroupDragHandlers`, and App drag commit calls.
- Focused contract: `tests/unit/canvas-snap-to-grid-contract.test.ts` covers enabled/disabled snapping, invalid coordinate preservation, toolbar contract, workflow utility non-resnap behavior, and drag wiring. `tests/unit/canvas-movement-contract.test.ts` covers snap-enabled multi-node movement across prompt, image, and workflow utility nodes. `tsconfig.tests.json` includes the new snap contract.
- Browser QA: Codex in-app Browser was attempted against `http://localhost:3000/` and was blocked by the local browser with `net::ERR_BLOCKED_BY_CLIENT`. Fallback browser QA used the repository same-process Vite helper and local headless Chromium at `http://127.0.0.1:4324`, viewport `1600x980`, dark theme.
- Browser evidence: `output/playwright/snap-grid/result.json` and `output/playwright/snap-grid/desktop-snap-toggle.png` record the desktop left toolbar snap toggle. The toggle was visible once, `aria-pressed` changed from `false` to `true`, the button bounding box stayed `40x40` at `x=23,y=358`, `.theme-transitioning` count was `0`, stale chunk text was `false`, and console error count was `0`.
- Dev-server note: detached `npm.cmd run dev:start`, manual Vite, and Vite preview processes reported ready but did not expose a listening port in this local process environment. The same-process Vite helper returned `200 text/html`, so browser QA used that path.
- Dirty-worktree guard: many unrelated files are already dirty, including hosted/VPS/payment/PromptBar/settings/encoding/collapsed-group work. Exclude all unrelated dirty files and stage only snap-to-grid files plus the four ledger files for this commit.
- Fresh validation already run for this slice: focused snap contract passed 3/3 after the review fix; focused canvas movement contract passed 8/8 after the review fix; `npm.cmd run build` passed; browser QA passed through the fallback path above. Remaining before commit: rerun the full hotfix gate after ledger updates, including `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited `git diff --check`.

## Current Desktop Collapsed Manual Group Hotfix

- Active user issue: after manually grouping desktop canvas cards, add an eye icon so clicking it hides that group, leaving only a small card with expand and group name to reduce resource loading.
- Implemented scope: `src/types.ts` adds optional `CanvasGroup.collapsed`; `src/app/collapsedCanvasGroups.ts` resolves hidden member ids; `src/components/canvas/CanvasGroupComponent.tsx` adds the expanded `EyeOff` hide button and compact `.canvas-group-collapsed-card` with `Eye`, `展开分组`, and group label; `src/App.tsx` excludes collapsed group members from prompt/image/workflow render queues, prompt-group child render data, image-load scheduling, connectors, and `InfiniteCanvas.cardPositions`.
- Review follow-up: read-only subagents found two blockers. Hidden members could leak through SVG connectors because connector code still consulted full node maps, and collapsed-card viewport culling could use stale persisted `group.bounds` while rendering used computed bounds. Both were fixed with RED/GREEN coverage in `tests/unit/canvas-collapsed-groups-contract.test.ts`.
- Focused contracts: `tests/unit/canvas-collapsed-groups-contract.test.ts` covers collapsed state persistence, hidden-id helper behavior, render/prefetch/card-position/connector suppression, computed-bounds culling, and hide/expand controls. `tests/unit/canvas-visual-regression.test.ts` covers the collapsed card frosted material contract. `tsconfig.tests.json` includes both collapsed-group and visual-regression contracts for test typecheck coverage.
- Browser QA: Codex in-app Browser was previously blocked on local targets with `net::ERR_BLOCKED_BY_CLIENT`, so this slice used a repository Playwright/headless fallback with same-process Vite at `http://127.0.0.1:3000`, viewport `1440x960`, dark theme.
- Browser evidence: `.tmp-playwright/collapsed-canvas-group/collapsed-canvas-group-result.json`, `collapsed.png`, and `expanded.png` record the UI check. Collapsed state showed one compact card sized `320x44`, one `展开分组` control, group name present, hidden member prompt/image text absent, visible outside prompt/image surfaces count `1/1`, connector count `0`, `.theme-transitioning` count `0`, stale chunk text `false`, and console errors `0`. After expanding, the compact card disappeared, one `折叠分组` control rendered, prompt/image surfaces restored to `2/2`, and connectors restored to `2`.
- Dirty-worktree guard: many unrelated files remain dirty, including hosted/VPS/payment/PromptBar/settings/snap-to-grid work. Exclude all unrelated dirty files. Mixed files require hunk staging: stage only collapsed-group hunks in `src/App.tsx` and only the collapsed/visual test registrations in `tsconfig.tests.json`; do not stage snap-to-grid or Vercel/VPS hunks.
- Fresh validation passed for this slice: targeted collapsed/group/regroup/visual suite passed 52/52; `npm.cmd run typecheck` passed with semantic test coverage for 130 test files; `npm.cmd run test:unit` passed 1439/1439; `npm.cmd run build` passed; `npm.cmd run governance:agent-docs` passed; `npm.cmd run check:encoding` passed; strict no-unused TypeScript passed; and path-limited alternate-git `diff --check` passed with Windows LF/CRLF normalization warnings only.

## Current Encoding Mojibake Guard Hotfix

- Active user issue: resolve the validation error left after the PromptBar UI slice.
- Root cause: `tests/unit/encoding-check-contract.test.ts` added a release-UI mojibake guard, but `scripts/ci/check-encoding.js` did not yet have the broader `suspiciousMojibakePatterns` scan path, and two release-facing UI files still contained visible mojibake text.
- Implemented scope: `scripts/ci/check-encoding.js` now applies broad mojibake regexes to release/runtime source roots while preserving the existing explicit fragment and suspicious-character checks. `src/app/useGenerationRuntime.ts` and `src/components/canvas/PendingNode.tsx` have the affected user-facing strings repaired. `tests/unit/encoding-check-contract.test.ts` locks the scanner contract and the two fixed UI surfaces.
- Dirty-worktree guard: unrelated hosted/API/payment files remain dirty in the alternate git worktree and are excluded from this encoding hotfix. Stage only `scripts/ci/check-encoding.js`, `src/app/useGenerationRuntime.ts`, `src/components/canvas/PendingNode.tsx`, `tests/unit/encoding-check-contract.test.ts`, and this `status.md` update.
- Fresh validation for this slice: focused encoding contract passed 2/2; `npm.cmd run typecheck` passed; `npm.cmd run test:unit` passed 1431/1431; `npm.cmd run build` passed; `npm.cmd run governance:agent-docs` passed; `npm.cmd run check:encoding` passed; and path-limited alternate-git `diff --check` passed with Windows LF/CRLF normalization warnings only.

## Current PromptBar Frosted Controls Hotfix

- Active user issue: the model library should read as a frosted surface, the divider under the input/buttons should move upward, action buttons should stay flat by default and show gradients only on hover, and enabled toggles should use a brighter active style.
- Implemented scope: `src/index.css` now makes PromptBar liquid button/group defaults flat `rgba(...)` surfaces, keeps gradients on hover-only tokens, moves the footer frost separator upward with a single `inset: -6px 0 0` mechanism, and adds bright active-toggle tokens for light/dark themes. `src/components/layout/PromptBar.tsx` applies the shared frosted framework material to the model library search/list surfaces, makes the current model credit button flat by default with hover-only emphasis, and gives desktop network toggles a stable transparent border when inactive. `src/components/image/ImageOptionsPanel.tsx` uses the same bright active-toggle tokens for enabled option buttons. `tests/unit/prompt-bar-layout-regression.test.ts` covers the new frosted/flat/hover-only/bright-toggle contract and guards against double-moving the footer separator.
- Browser QA: the Codex in-app Browser was attempted against `http://localhost:3000` and was blocked by the local browser with `net::ERR_BLOCKED_BY_CLIENT`, so the UI check used a local Playwright fallback that starts Vite in-process at `http://127.0.0.1:4312`.
- Playwright evidence: desktop viewport `1600x1000` and mobile viewport `390x844` screenshots were captured under `.tmp-playwright/promptbar-ui-qa/`. `result.json` records model/button defaults with `backgroundImage: "none"`, hover gradient on the model control, frosted dropdown `backdropFilter: "blur(24px) saturate(1.18)"`, mobile footer `flexWrap: "nowrap"` and `overflowX: "auto"`, `.theme-transitioning` count `0`, and stale chunk text `false`. One console error remains from the local admin model API fetch failing in this isolated run, so the model list stayed in "正在同步最新模型库..." state; the active-toggle style is covered by source contract and token assertions for this local no-model condition.
- Current dirty-worktree guard: unrelated hosted/API files remain dirty in the alternate git worktree and are excluded from this UI milestone. Stage only `src/index.css`, `src/components/layout/PromptBar.tsx`, `src/components/image/ImageOptionsPanel.tsx`, `tests/unit/prompt-bar-layout-regression.test.ts`, and this `status.md` update.
- Fresh validation for this UI slice: focused PromptBar/Clay/theme/token suite passed 25/25; path-limited alternate-git `diff --check` passed with Windows LF/CRLF normalization warnings only; `npm.cmd run typecheck` passed; `npm.cmd run build` passed; `npm.cmd run governance:agent-docs` passed; `npm.cmd run check:encoding` passed. The unrelated dirty-worktree encoding failure observed during the UI slice is handled in the current encoding hotfix.

## Current Hosted Production Startup Hotfix

- Active user issue: `https://kkai.plus/` loads the frontend but remains on the startup screen with "Confirming your session" / `正在确认会话`.
- Root cause: Vercel production was missing hosted API/admin/runtime env and same-origin rewrites, so `/api/v1/auth/session` did not reach the VPS API. The frontend then treated non-auth hosted session failures with no cached token as retryable forever, keeping `sessionRecoveryLoading=true` and preventing the signed-out login page from rendering.
- Implemented scope: `vercel.json` now rewrites `/api/v1/*`, `/api/auth/*`, `/healthz`, and `/api/manifest` to the VPS gateway. `AuthContext` now treats hosted cookie recovery failure with no cached token as a terminal signed-out startup state by clearing hosted runtime state instead of scheduling another startup retry.
- Vercel production env configured for this hotfix: `VITE_KK_API_BASE_URL=https://kkai.plus`, `VITE_KK_ADMIN_URL=http://172.245.156.16:4174`, and `VITE_AUTH_REDIRECT_ORIGIN=https://kkai.plus`. Existing Turnstile production env remains in place.
- RED/GREEN evidence: the new `workspace-auth-gate` regression failed before the code change because hosted no-token failure still scheduled retry, then passed after the no-token fallback cleared hosted state. The hosted/auth focused suite passed 53/53 after the fix.
- Fresh validation passed for this slice: hosted/auth focused suite 53/53, `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, path-limited alternate-git `diff --check`, and `npm.cmd run release:hosted:check` with no immediate blockers in the local snapshot. The preflight still lists local snapshot reminders for Google/WeChat/payment-sidecar server secrets because it does not read the remote VPS environment.
- Production deployment result: `vercel.cmd deploy . --prod -y --scope yykks-projects-727e9560` produced `dpl_2R1WWxiMQujUJX3iXFpQ9sbDxjmi`, URL `https://kk-studio-fctb3qx3f-yykks-projects-727e9560.vercel.app`, and aliases `https://kkai.plus` plus `https://www.kkai.plus`. `vercel.cmd inspect https://kkai.plus --scope yykks-projects-727e9560` confirmed target `production` and status `Ready`.
- Direct unauthenticated HTTP fetches to `https://kkai.plus` from this environment can be blocked by Vercel Security Check `429`, so production alias readiness is verified with Vercel CLI inspect. If a browser still shows the old startup loop, hard refresh or clear site data to discard the old bundle/session cache.

## Completed In `fe99e829` (GPT Best Provider Compatibility)

- Active user issue: verify whether the GPT Best API project documented at `https://gpt-best.apifox.cn/llms.txt` is compatible enough to become a priority provider, while preserving official OpenAI API behavior.
- Live-doc calibration: GPT Best is treated as a workbench/runtime Base URL provider using Bearer-header auth, `/v1/models` model discovery, `/v1/chat/completions` chat, `/v1/images/generations` images, async image generation through `?async=true`, and model-level `supported_endpoint_types` surface hints. The Apifox docs host is not an API Base URL.
- Root cause found during RED/GREEN: local GPT Best routing already recognized aliases and provider strategy, but remote OpenAI-compatible model discovery did not preserve endpoint metadata for runtime dispatch. Image/chat-image, general chat/stream, Gemini-native image, and connection-test model-list paths could also silently reuse official provider defaults when a third-party provider slot had no Base URL, which would blur GPT Best and official OpenAI/Google boundaries. Route-qualified model IDs could shadow remote endpoint metadata before dispatch saw it.
- Implemented scope: remote OpenAI-compatible discovery now preserves endpoint metadata and registers it in model metadata; route-qualified model IDs merge remote endpoint metadata before global list metadata; GPT Best image dispatch consumes endpoint hints so image-generation models use native images while chat-only hints use chat; GPT Best connection/model-list contract checks provider runtime auth and headers; non-OpenAI compatible image/chat-image/chat/stream/Gemini-native and model-list paths now fail fast if Base URL is missing; official OpenAI empty-base fallback and official Google/Anthropic/12AI native defaults remain allowed.
- Current changed-file line counts before commit: `src/services/llm/OpenAICompatibleAdapter.ts` 2883 lines; `src/services/api/connectionTest.ts` 732 lines; `src/services/llm/openAICompatibleImageDispatch.ts` 114 lines; `src/services/auth/keyManager.ts` 4135 lines; `src/services/auth/keyManagerRemoteModelDiscovery.ts` 223 lines; `tests/unit/connection-test-gpt-best-contract.test.ts` 61 lines.
- Validation passed before commit: initial RED failed for missing remote metadata, GPT Best endpoint-type dispatch, and missing Base URL guard coverage; GREEN focused provider image/metadata/connection set passed 16/16; full GPT Best provider gate passed 44/44; strict no-unused TypeScript passed; `npm.cmd run typecheck` passed with 126 semantic test files and payment-server syntax check; `npm.cmd run test:unit` passed 1415/1415; `npm.cmd run build` passed; `npm.cmd run governance:agent-docs` passed; `npm.cmd run check:encoding` passed; and path-limited alternate-git `diff --check` passed.
- Browser QA: skipped for this slice because the changes are provider-routing/model-discovery service logic with no JSX, CSS, route rendering, or browser-visible UI change.
- Commit result: staged only the GPT Best provider compatibility slice and committed it as `fe99e829 fix: prioritize gpt best provider routing`.
- Next exact step: finish the prompt optimizer cache/logging redaction ledger, rerun the fresh docs/encoding/diff gates, commit that service slice, then choose the next narrow non-UI Stage Two seam.

## Current Auth And VPS Login Hotfix

- Active user issue: default open entered the local workspace instead of the login page, the administrator entry reported `VITE_KK_ADMIN_URL must be configured for the admin redirect.`, and normal password login surfaced `HTTP_404: Request failed`.
- Root cause evidence: the VPS API is reachable on `/healthz`, `/api/manifest`, and `/api/v1/auth/login`, but the bare `http://172.245.156.16/` entry was being served by the API default virtual host. The VPS deploy script also built the main web app without publishing `dist/`, so the normal login page bundle and its `VITE_KK_ADMIN_URL` injection could be stale or missing.
- Implemented scope: default auth state now stays signed out unless a user explicitly chooses temporary local access; the login screen keeps temporary local access beside administrator sign-in; `VITE_KK_ADMIN_URL` is part of the runtime env helper; stale clients hitting `/api/auth/login` are bridged to the versioned login handler; the VPS gateway default server now serves `/var/www/kk-app` and proxies `/api/` plus `/healthz`; the deploy script now builds and publishes both `dist/` and `apps/admin/dist/` with optional `/etc/kk-studio/kk-web.env` and `/etc/kk-studio/kk-admin.env` files.
- Follow-up VPS hardening: the deploy script now installs `deploy/nginx/kk-vps-gateway.conf`, disables the old enabled `kk-api.conf` default site that was capturing `http://172.245.156.16/`, disables the legacy `kk-admin-4174.conf` site that pointed at `/var/www/kk-admin/dist`, and runs `nginx -t` before reload. The gateway now serves the admin SPA on port 4174 from `/var/www/kk-admin`, matching the deploy script output. The API default Turnstile verifier now uses `TURNSTILE_SECRET_KEY` against Cloudflare siteverify, while self-hosted operators can explicitly set `KK_AUTH_REQUIRE_TURNSTILE=false` when they have not provisioned Turnstile yet.
- Fresh validation passed: targeted auth/VPS suite passed 44/44; focused VPS deploy contract passed 2/2 after the 4174 gateway and optional-service restart updates; focused API startup Turnstile/CORS/legacy-login gate passed 3/3; `npm.cmd run typecheck` passed; `npm.cmd run build` passed; `npm.cmd run admin:build` passed; `npm.cmd run governance:agent-docs` passed; `npm.cmd run check:encoding` passed.
- VPS deployment result: deployed latest alternate-git head `19c18649` to `172.245.156.16` from `/tmp/kk-studio-deploy`; `npm ci`, main build, admin build, `nginx -t`, `kk-api` restart, and nginx reload completed. The VPS does not have `kk-payment-sidecar.service`, so the deploy script skipped that optional service. Live verification now returns `200 text/html` for `http://172.245.156.16/`, `http://172.245.156.16/login`, and `http://172.245.156.16:4174/login`; `GET /healthz` returns 200; `dist/app-version.json` is served with build time `2026-05-08T05:22:51.292Z`; `POST /api/v1/auth/login` and legacy `POST /api/auth/login` both reach the API and return Turnstile validation errors instead of 404.
- Repository deployment guard: `.gitattributes` now forces LF line endings for VPS shell scripts, nginx configs, and VPS env examples so Linux deployment scripts are not reintroduced with CRLF line endings from Windows.
- Turnstile production config update: the user provided Cloudflare Turnstile keys; the VPS now has `VITE_TURNSTILE_ENABLED=true` plus the site key in `/etc/kk-studio/kk-web.env` and `KK_AUTH_REQUIRE_TURNSTILE=true` plus the secret key in `/etc/kk-studio/kk-api.env`. The main web bundle was rebuilt and published, and `kk-api` was restarted. `kk-api.env` must remain readable by the `kkstudio` service user, so deploy now enforces `root:${APP_GROUP}` with mode `0640`; setting it to `root:root 0600` causes `node --env-file=/etc/kk-studio/kk-api.env` to fail and nginx to return 502.
- Turnstile verification result: live bundle probing confirmed the Turnstile site key and enabled flag are present in served assets. `GET /`, `GET /login`, `GET /healthz`, and admin `/login` return 200; password login without a Turnstile token now returns `400 AUTH_INVALID_REQUEST`; a fake Turnstile token returns `403 TURNSTILE_FAILED`; and legacy `POST /api/auth/login` with a fake Turnstile token also returns `403 TURNSTILE_FAILED`, proving the server-side verifier is active and the legacy login path is no longer 404/502.
- Auth hardening follow-up: password login now requires a Turnstile token whenever Turnstile is required, matching registration behavior and preventing callers from bypassing CAPTCHA by omitting `turnstileToken`. Focused auth service/HTTP-route tests passed 17/17, API startup Turnstile/CORS/legacy-login tests passed 3/3, and typecheck/build/admin-build/governance/encoding gates passed before deployment.
- Deployment note: browser site data may still need clearing if an old `temp_user_session_v1` exists. Turnstile is now enabled on the VPS; browser QA against a fresh context shows `/` and `/login` render the login panel, not the local workspace, and the administrator button redirects to `http://172.245.156.16:4174/login?from=...`. The remaining live-login blocker on the bare VPS IP is external Cloudflare Turnstile domain allowlisting: the widget reports that the current host is not allowed, so add the exact public host to the Turnstile widget configuration or use an already-allowed domain before expecting password login to complete on that host.

## Active State

- Completed deployment override (2026-05-07): bumped the hosted release metadata from `1.4.2` to `1.4.5`, rebuilt `dist/app-version.json`, verified version governance, committed the release metadata slice, and deployed production to Vercel for `https://kkai.plus/`.
- Previous 1.4.5 Vercel production result: `vercel.cmd deploy . --prod -y --scope yykks-projects-727e9560` built `kk-studio@1.4.5`, produced deployment `dpl_Hn9PiFbDcmJxVj4dJEAhh4APs7XV`, and aliased it to `https://kkai.plus`. `vercel.cmd inspect https://kkai.plus --scope yykks-projects-727e9560` confirmed target `production`, status `Ready`, deployment URL `https://kk-studio-p8in8al56-yykks-projects-727e9560.vercel.app`, and aliases `https://kkai.plus`, `https://www.kkai.plus`, and Vercel project aliases. v1.4.6 still needs a fresh production deployment and smoke after the DNS/TLS gate is fixed.
- Current service override (2026-05-08): close M132 shared local user-route auth inference. The local proxy helper body moved to `apps/api/src/lib/local-user-route-auth.ts`, the old model-proxy helper path is now a compatibility re-export, and user-route diagnostics imports the same auth/header/query-key inference used by proxy execution.
- Current commit scope: `apps/api/src/lib/local-user-route-auth.ts`, `apps/api/src/modules/auth/application/user-route-diagnostics-service.ts`, `apps/api/src/modules/model-proxy/application/local-user-route-auth.ts`, `tests/unit/local-user-route-auth-contract.test.ts`, `tests/unit/provider-auth-proxy-regression.test.ts`, `tests/unit/system-gemini-auth-regression.test.ts`, `tests/unit/twelve-ai-doc-alignment.test.ts`, `tests/unit/user-route-diagnostics-routes.test.ts`, and ledger files only. Endpoint URL construction, fetch execution, pricing payloads, key storage, provider persistence, billing, fallback ordering, release metadata, payment/server behavior, PromptBar controls, settings UI, storage ownership, and unrelated runtime extraction work are excluded.
- Root cause: diagnostics had a private auth/header inference copy that diverged from the proxy helper. GPT Best Gemini diagnostics could obey persisted `authMethod: "query"` or default Gemini `x-goog-api-key` behavior instead of the provider-aware Bearer header rule used by local proxy execution.
- Current targeted validation: RED was confirmed for GPT Best Gemini diagnostics because `Authorization: Bearer gb-token` was missing before the shared helper wiring. RED was also confirmed for copied API key whitespace normalization. GREEN passed for the focused local user-route/auth suite after centralizing the helper, preserving 12AI auto-format diagnostics endpoint behavior, adding GPT Best Gemini pricing parity coverage, and normalizing tokens.
- Browser QA for the current M132 slice: skipped because this is a non-UI server/auth helper and diagnostics change with no JSX, CSS, route rendering, browser-visible UI, or release metadata change.

- Active lane in this thread: non-UI M132 shared local user-route auth inference after M131 prompt optimizer cache/logging redaction. Stage One M6 and Stage One Backfill are complete; the post-M120 UI closure line is split and committed in `da4ffc79`, `485a6bef`, and `1ca080eb`; M121-M131 are committed and M132 is pending commit.
- Current slice override: share local user-route auth/header/query-key inference between diagnostics and proxy. Endpoint URL construction, fetch execution, polling, billing, fallback ordering, key storage, provider persistence, release metadata, payment/server behavior, settings UI, PromptBar controls, storage ownership, and unrelated runtime extraction work are excluded.
- Clay UI audit closure landed in `9e7ae2b5` and is no longer the active lane.
- Current branch: `main`.
- Plain `.git` still reports a stale historical view. The writable full Git metadata copy at `node_modules/.codex-git-full` is the only development fact source; the latest committed code baseline before the M132 server/auth slice is `dade1de4 fix: redact prompt optimizer cache diagnostics`. Use `git --git-dir=node_modules/.codex-git-full --work-tree=.` for status/staging/commits in this session.
- Thread merge state: `019dd551...` is the main refactor history and `019de168...` is continuation history; both are part of the same Stage One M6 ecommerce runtime line.
- Alternate-git worktree was clean at `296c1203` before the M113 extraction pass; M113 is now committed at `617491b3`.
- UI source of truth: `C:/Users/Administrator/Downloads/DESIGN-clay.md`, `DESIGN.md`, `docs/DESIGN.md`, `.agent/rules/skills/SKILL.md`, and shared CSS tokens in `src/index.css`.
- Runtime source of truth: Stage One hook extraction rules in `plans.md`; all custom hooks stay under `src/app/` with explicit deps/result interfaces.
- Current focus: finish fresh post-ledger validation and commit the M132 shared local user-route auth inference slice.
- Most recent committed scopes before M130: M129 keyManager update diagnostic redaction in `740042c1`; M128 dead Gemini response cache cleanup in `7d65c686`; M127 OpenAI-compatible image reference cleanup in `1f0ce6bd`; M126 image payload security hardening in `342ae802`; M125 12AI async/chat-image helper extraction in `42dcaa17`; M124 AceData route helper extraction in `53338975`; post-M123 settings UI closure in `5dda8972`; M123 local user-route task token helper extraction in `9e4b409e`; M122 local user-route task signing hardening in `dcf38e87`; M121 Wuyin route helper extraction in `74dbdbf1`; settings workbench chrome flattening in `1ca080eb`; PromptBar mobile action flattening in `485a6bef`; ecommerce canvas workbench split in `da4ffc79`; M120 OpenAI-compatible chat payload helper extraction in `cff75d23`; M119 OpenAI-compatible Google extra-body helper extraction in `8545513b`; M118 legacy payment-server security hardening in `2dbb402e`; M117 Gemini image sizing helper extraction in `c0c96808`.
- Current changed-file line counts before commit: `apps/api/src/lib/local-user-route-auth.ts` 320 lines; `apps/api/src/modules/auth/application/user-route-diagnostics-service.ts` 528 lines; `apps/api/src/modules/model-proxy/application/local-user-route-auth.ts` 1 line; `tests/unit/async-image-proxy-regression.test.ts` 79 lines; `tests/unit/local-user-route-auth-contract.test.ts` 143 lines; `tests/unit/provider-auth-proxy-regression.test.ts` 31 lines; `tests/unit/system-gemini-auth-regression.test.ts` 39 lines; `tests/unit/twelve-ai-doc-alignment.test.ts` 85 lines; `tests/unit/user-route-diagnostics-routes.test.ts` 409 lines.
- Code-review follow-up: a read-only subagent is checking the current M132 dirty diff for risks while local ledger sync and validation proceed. Final commit will wait for its findings or a timeout plus local diff review.

## Current Finalization Gate

- Previous 1.4.5 release metadata gate results: `npm.cmd run governance:version` passed with version metadata aligned to `1.4.5`; `npm.cmd run governance:agent-docs` passed; `npm.cmd run check:encoding` passed; `npm.cmd run governance:check` passed; `npm.cmd run typecheck` passed; `npm.cmd run test:unit` passed 1402/1402; `npm.cmd run build` passed and regenerated `dist/app-version.json` for `1.4.5`. v1.4.6 validation must be rerun after metadata alignment.
- Current ecommerce framework card header/arrange hotfix gate results: focused RED/GREEN passed; focused ecommerce prompt/arrange suite passed 8/8; `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` passed; `npm.cmd run typecheck` passed after replacing mojibake-prone main-sheet literals in the new test with an ASCII unicode escape constant; `npm.cmd run test:unit` passed 1402/1402; `npm.cmd run build` passed; browser smoke was completed through the Codex in-app Browser as recorded in Active State; `npm.cmd run governance:agent-docs` passed; `npm.cmd run check:encoding` passed; path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.

- Current UI ratio hotfix gate results: focused RED/GREEN passed, expanded UI/ecommerce focused gate passed 30/30, `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` passed, `npm.cmd run typecheck` passed, `npm.cmd run test:unit` passed 1395/1395, `npm.cmd run build` passed, `npm.cmd run governance:agent-docs` passed before and after ledger sync, `npm.cmd run check:encoding` passed before and after ledger sync, and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only. Browser QA was completed through the Codex in-app Browser as recorded in Active State.
- Fresh full gate passed on 2026-05-06 after the settings UI closure refresh: `npm.cmd run governance:check`, `npm.cmd run architecture:check`, `npm.cmd run governance:security`, `npm.cmd run spec:check`, `npm.cmd run audit:dependencies`, `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build`, and `npm.cmd run check:encoding`.
- Current M130 targeted gate result: RED confirmed diagnostics previews still exposed prompt/message content and OpenAI-compatible python snippets still embedded raw request bodies/prompts; GREEN focused validation passed 4/4 after prompt redaction and snippet rewiring.
- Current M130 full repository gate passed before commit: targeted OpenAI-compatible diagnostics/adjacent contracts passed 34/34; strict no-unused TypeScript passed; architecture, security, typecheck, unit, build, agent-docs, and encoding checks passed.
- Current prompt optimizer cache/logging redaction gate result: RED confirmed cache-result and logging source contracts failed before implementation; GREEN focused prompt optimizer/runtime suite passed 67/67 after cache fingerprinting, v5 cache namespacing, cache-result redaction, and summarized error logging. Strict no-unused TypeScript, `npm.cmd run governance:security`, `npm.cmd run typecheck`, `npm.cmd run test:unit` passed 1417/1417, and `npm.cmd run build` passed before ledger sync. Fresh post-ledger `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check` passed.
- Current prompt optimizer browser QA: skipped because this slice changes only service cache/logging behavior and source contracts, with no JSX, CSS, route rendering, browser-visible UI, or release metadata change.
- Current M132 shared local user-route auth inference gate result: RED confirmed GPT Best Gemini diagnostics used divergent auth before the helper sharing; token-normalization RED confirmed copied key whitespace was not normalized consistently. After subagent review and the first full-unit failure, the slice was tightened so diagnostics keeps historical 12AI auto-format OpenAI action probe selection while sharing auth/header inference. Fresh focused local user-route/auth gate passed 28/28; strict no-unused TypeScript passed; `npm.cmd run governance:security` passed; `npm.cmd run architecture:check` passed; `npm.cmd run typecheck` passed; `npm.cmd run test:unit` passed 1421/1421; `npm.cmd run build` passed; `npm.cmd run governance:agent-docs` passed; `npm.cmd run check:encoding` passed; path-limited alternate-git `diff --check` passed with Windows LF/CRLF normalization warnings only.
- Current M132 browser QA: skipped because this slice changes only server-side auth-helper/diagnostics behavior and source contracts, with no JSX, CSS, route rendering, browser-visible UI, or release metadata change.
- Dependency/security result: root and `payment-server` production audits reported 0 vulnerabilities, and sensitive storage/logging boundaries passed.
- Architecture/spec result: import boundaries passed with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions; OpenAPI spec validation passed.
- Strict no-unused probe passed: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false`; `npm.cmd run typecheck` semantic test check now covers 125 files; `npm.cmd run test:unit` passed 1394/1394.
- Browser QA: the in-app Browser confirmed the settings API page and rebuilt compact logs page render correctly in dark theme; the smoke scripts only fell back because Playwright launch hit `spawn EPERM`.
- Interpretation: the repository is build/test/security-green, but this is not final refactor completion because Stage Two giant-file splitting, Stage Three debt governance, and Stage Four `apps/web` migration remain open.

## Completed In `2dbb402e` M118 (Legacy Payment-Server Security Fail-Closed)

- Audit evidence: the finalization security scan found two release blockers in the tracked legacy `payment-server`: WeChat Pay webhook construction used literal `public-key` / `private-key` fallbacks when cert/private-key env vars were missing, and legacy payment route default return/notify URLs fell back to production `https://kkai.plus` URLs.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/payment-server-legacy-security-contract.test.ts` failed 0/2 before the fix: the WeChat webhook returned 200 instead of 500 when certificate config was incomplete, and `/api/pay/qrcode` sent `https://kkai.plus/pay/success` instead of a request-origin URL.
- Fix scope: `payment-server/webhook.js` now checks `WECHATPAY_API_V3_KEY`, `WECHATPAY_APPID`, `WECHATPAY_MCHID`, `WECHATPAY_PUBLIC_CERT`, and `WECHATPAY_PRIVATE_KEY` before loading `wechatpay-node-v3`, returns a fail-closed JSON error when any required key is missing, and passes only configured cert/private-key values to `WxPay`.
- Fix scope: `payment-server/index.js` now derives missing legacy `returnUrl` and `notifyUrl` from `buildLegacyOrigin(req)` for `/api/pay/qrcode` and `/api/pay`, while preserving explicit `PAYMENT_RETURN_URL` / `AP_RETURN_URL` and `PAYMENT_NOTIFY_URL` / `AP_NOTIFY_URL` overrides.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/payment-server-legacy-security-contract.test.ts` passed 2/2; the related payment set `tests/unit/payment-server-legacy-security-contract.test.ts tests/unit/payment-webhook-wechat-raw-body.test.ts tests/unit/payment-webhook-fail-closed.test.ts tests/unit/payment-runtime-hardening.test.ts` passed 10/10.
- Fresh type validation passed: `npm.cmd run typecheck:payment-server`; `node scripts/ci/check-tests-types.mjs tsconfig.tests.json`; and `npm.cmd run typecheck`.
- Fresh repository validation passed: `npm.cmd run test:unit` passed 1353/1353; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; `npm.cmd run governance:security`; `npm.cmd run governance:check`; `npm.cmd run audit:dependencies` reported 0 vulnerabilities in root and `payment-server`; and the M118 path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Direct `npx.cmd tsc --noEmit -p tsconfig.tests.json --pretty false` remains a known noisy raw TypeScript invocation with pre-existing `ApiResponse.error` / nullable-size diagnostics; the project-owned semantic test checker and full `npm.cmd run typecheck` are the active gates and passed.
- Browser QA skipped: this is a non-UI legacy payment server hardening slice with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `payment-server/index.js` is 350 physical lines; `payment-server/webhook.js` is 283 physical lines; `tests/unit/payment-server-legacy-security-contract.test.ts` is 273 physical lines; `tsconfig.tests.json` is 146 physical lines.

## Completed In `8545513b` M119 (OpenAI-Compatible Google Extra Body Helper)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-google-extra-body-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` because `src/services/llm/openAICompatibleGoogleExtraBody.ts` did not exist.
- Extracted only shallow `extra_body` merging and New API Google `extra_body` construction into `src/services/llm/openAICompatibleGoogleExtraBody.ts`; `OpenAICompatibleAdapter.ts` now imports `mergeExtraBody()` and `buildNewApiGoogleExtraBody()` while preserving endpoint selection, auth, fetch behavior, provider routing, fallback ordering, billing, UI, and release metadata.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-google-extra-body-contract.test.ts` passed 3/3; the adjacent OpenAI/provider image gate passed 68/68.
- Fresh structural validation passed: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false`; `npm.cmd run architecture:check`; and `npm.cmd run typecheck` with semantic coverage for 118 test files.
- Fresh full validation passed: `npm.cmd run test:unit` passed 1356/1356; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and the M119 path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI service/helper extraction with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` is 3940 physical lines; `src/services/llm/openAICompatibleGoogleExtraBody.ts` is 62 physical lines; `tests/unit/openai-compatible-google-extra-body-contract.test.ts` is 112 physical lines; `tsconfig.tests.json` is 147 physical lines.

## Completed In `cff75d23` M120 (OpenAI-Compatible Chat Payload Helper)

- Scope: move only chat message construction and chat-completions request body construction from `OpenAICompatibleAdapter.ts` into `src/services/llm/openAICompatibleChatPayload.ts`.
- `OpenAICompatibleAdapter.ts` now imports `buildOpenAICompatibleMessages()` and `buildChatCompletionsBody()` while preserving endpoint selection, auth, fetch behavior, provider routing, fallback ordering, billing, UI, and release metadata.
- Contract coverage added in `tests/unit/openai-compatible-chat-payload-contract.test.ts` for system prompt ordering, inline image attachment to the last user message, `extraBody` top-level overrides, default `max_tokens`, adapter delegation, and `tsconfig.tests.json` registration.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-chat-payload-contract.test.ts tests/unit/openai-compatible-google-extra-body-contract.test.ts tests/unit/openai-compatible-image-sizing-contract.test.ts tests/unit/openai-compatible-task-payload-contract.test.ts tests/unit/provider-surface-router.test.ts tests/unit/provider-strategy.test.ts tests/unit/twelve-ai-doc-alignment.test.ts` passed 54/54.
- Fresh structural validation passed: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false`; `npm.cmd run architecture:check` passed with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions; and `npm.cmd run typecheck` passed with semantic coverage for 119 test files.
- Fresh repository validation passed: `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and the M120 path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Temporary mixed-worktree blocker resolved: the excluded PromptBar/ecommerce UI-contract WIP was split into `da4ffc79`, `485a6bef`, and `1ca080eb`; the full unit gate passed on the final content.
- Browser QA skipped for M120 because this is a non-UI service/helper extraction with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice before commit: `src/services/llm/OpenAICompatibleAdapter.ts` is 3896 physical lines; `src/services/llm/openAICompatibleChatPayload.ts` is 66 physical lines; `tests/unit/openai-compatible-chat-payload-contract.test.ts` is 99 physical lines; `tsconfig.tests.json` is 148 physical lines.
- The previously excluded UI/WIP files are now committed as the post-M120 UI closure line.

## Completed In `da4ffc79`, `485a6bef`, And `1ca080eb` (Post-M120 UI Closure)

- Scope: `da4ffc79` moves ecommerce post-build editing from PromptBar into one visible canvas framework workbench card; `485a6bef` keeps mobile PromptBar actions in a single horizontal row and removes normal liquid-button shadows; `1ca080eb` flattens cramped settings workbench header/container chrome.
- Fresh targeted validation passed: the combined UI set `tests/unit/ecommerce-build-visibility-localization-regression.test.ts tests/unit/ecommerce-build-runtime-contract.test.ts tests/unit/ecommerce-group-shell-app-contract.test.ts tests/unit/prompt-bar-ecommerce-framework-companion.test.ts tests/unit/prompt-bar-ecommerce-group-workbench.test.ts tests/unit/prompt-bar-layout-regression.test.ts tests/unit/settings-desktop-workbench-regression.test.ts` passed 20/20; post-split spot checks passed `prompt-bar-layout-regression.test.ts` 9/9 and `settings-desktop-workbench-regression.test.ts` 3/3.
- Fresh repository validation passed before splitting the staged commits: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1363/1363; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` for the UI touched paths.
- Browser QA: Codex in-app Browser used a temporary Node static server for the built `dist/` at `http://127.0.0.1:4310`; shell-launched Vite dev/preview processes returned 200 briefly but were cleaned up before browser navigation. A local temporary user entered the workspace, the mobile-width ecommerce input surface rendered requirement/product/reference upload controls, advanced settings expanded in-place without the footer splitting into two rows, the settings/API surface rendered in the same session, and console errors stayed at `0` apart from the existing Tailwind CDN warning. Live post-build canvas workbench inspection was limited by the absence of a seeded post-build browser fixture in this session, so the canvas handoff is held by the new source contracts.
- Auxiliary settings smoke scripts: `npm.cmd run verify:desktop-settings-smoke` passed in fallback mode after Playwright browser launch hit `spawn EPERM`; `npm.cmd run verify:mobile-settings-smoke` initially failed because it was run in parallel with the desktop smoke on the same temporary `127.0.0.1:3000` server, then passed when rerun alone in fallback mode.

## Completed M121 (OpenAI-Compatible Wuyin Route Helper)

- Scope: moved only pure Wuyin base-url normalization, direct async endpoint extraction, model alias route resolution, pricing-snapshot route matching, size/aspect normalization, reference-image normalization, task-id extraction, and task-status mapping into `src/services/llm/openAICompatibleWuyinRoute.ts`.
- `OpenAICompatibleAdapter.ts` still owns linked-provider lookup through `keyManager`, request target construction, auth/header behavior, fetch execution, polling loops, error construction, billing-safe fallback behavior, task metadata, UI, and release metadata.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-wuyin-route-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` because `src/services/llm/openAICompatibleWuyinRoute.ts` did not exist.
- Fresh targeted validation passed: `tests/unit/openai-compatible-wuyin-route-contract.test.ts` passed 4/4; the adjacent OpenAI/provider image routing set passed 60/60.
- Fresh structural validation passed: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false`; `npm.cmd run architecture:check`; and `npm.cmd run typecheck`, with semantic coverage for 120 test files.
- Fresh repository validation passed: `npm.cmd run test:unit` passed 1367/1367; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and the M121 path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI service/helper extraction with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice before commit: `src/services/llm/OpenAICompatibleAdapter.ts` is 3570 physical lines, down from 3896 after M120; `src/services/llm/openAICompatibleWuyinRoute.ts` is 377 physical lines; `tests/unit/openai-compatible-wuyin-route-contract.test.ts` is 123 physical lines; `tsconfig.tests.json` is 149 physical lines.
- Next priority: security hardening for local user-route task signing secret fallback, found by the finalization audit. Do not continue lower-priority giant-file cleanup until that fallback is mapped and fixed.

## Completed M122 (Local User-Route Task Signing Security)

- Scope: removed the unconditional `userApiEncryptionSecret || "kkai-local-route-task-secret"` fallback from `LocalUserRouteProxyService`. Task token signing and verification now require a configured secret, unless `allowInsecureLocalTaskSigningFallback: true` is passed explicitly for local/test fallback mode.
- Safety behavior: image/video requests fail closed before route resolution or upstream invocation when task signing is unavailable, preventing orphaned provider tasks that cannot be returned safely. Follow-up task operations fail closed before token verification, so tokens signed with the public legacy default are not accepted by default.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/local-user-route-task-signing-secret.test.ts` failed first with `Missing expected rejection` because a token signed with `kkai-local-route-task-secret` was accepted.
- Fresh targeted validation passed: the new regression passed 1/1; the local user-route/system proxy adjacency set passed 28/28; `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` passed.
- Fresh security/architecture validation passed: `npm.cmd run governance:security`, `npm.cmd run architecture:check`, `npm.cmd run audit:dependencies`, and `npm.cmd run spec:check`.
- Fresh repository validation passed: `npm.cmd run typecheck` with semantic coverage for 121 test files; `npm.cmd run test:unit` passed 1368/1368; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and the M122 path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI API security slice with no JSX, CSS, route rendering, or browser-visible behavior change.
- Next priority: return to a fresh seam map or quality slice. The remaining refactor-completion blockers are still giant-file splits, type/log debt governance, the `apps/web` migration, and final release metadata alignment.

## Completed M123 (Local User-Route Task Token Helper)

- Scope: moved local user-route task token prefix/default-secret ownership, base64url encoding, HMAC signing, timing-safe verification, task payload parsing, and missing-secret result normalization into `apps/api/src/modules/model-proxy/application/local-user-route-task-token.ts`.
- `LocalUserRouteProxyService` now keeps route resolution, auth/header assembly, provider fetch execution, billing-safe transport shaping, and error-class wrapping. It delegates token encode/decode and secret resolution to the helper.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/local-user-route-task-token-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` because the helper module did not exist.
- Fresh targeted validation passed: `tests/unit/local-user-route-task-token-contract.test.ts`, `tests/unit/local-user-route-task-signing-secret.test.ts`, and local user-route/system proxy service tests passed 7/7; the broadened local route gate passed 31/31; `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` passed.
- Fresh structural/security validation passed: `npm.cmd run architecture:check`, `npm.cmd run governance:security`, `npm.cmd run typecheck` with semantic coverage for 122 test files, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Full unit follow-up status: the unrelated settings UI WIP that previously blocked full unit verification is now closed by the post-M123 settings UI closure slice; the current `npm.cmd run test:unit` gate passes 1373/1373.
- Browser QA skipped for M123: this is a non-UI API helper extraction with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts after this slice and later cleanup: `apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts` is 1907 physical lines, down from 2207 after M122; `apps/api/src/modules/model-proxy/application/local-user-route-task-token.ts` is 160 physical lines; `tests/unit/local-user-route-task-token-contract.test.ts` is 89 physical lines.

## Completed Post-M123 Settings UI Closure

- Scope: flattened the remaining settings workbench nested shell/card/search chrome by keeping the page shell as the visual framework layer, making dashboard health rings and logs filters use plain sections, and keeping quick actions/search inputs visually flat inside their containers.
- Scope: updated `tests/unit/clay-frosted-surface-contract.test.ts` so Clay framework material ownership follows `.settings-shell-desktop` / `.settings-shell-mobile` instead of reintroducing the outer `.settings-shell` blur/border/shadow layer.
- Scope: updated local/secure proxy trace contracts so request trace metadata checks follow the M123 `local-user-route-task-token.ts` helper boundary.
- Fresh targeted validation passed: settings/Clay set passed 28/28; local/secure trace contract set passed 2/2.
- Fresh repository validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1373/1373; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; `npm.cmd run architecture:check`; `npm.cmd run spec:check`; `npm.cmd run governance:security`; `npm.cmd run audit:dependencies`; `npm.cmd run governance:check`; and `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false`.
- Path-limited alternate-git `diff --check` passed for the settings, Clay, trace, and ledger paths with LF/CRLF normalization warnings only.
- Browser QA passed through the Codex in-app Browser on `http://127.0.0.1:3100/settings/api-management` in dark theme: the flattened settings sidebar/search, API hero, provider list card, official/direct and proxy action buttons rendered visibly, and console error count was `0`.
- Supplemental settings smoke scripts `npm.cmd run verify:desktop-settings-smoke` and `npm.cmd run verify:mobile-settings-smoke` exited 0 in fallback mode after headless Chromium launch hit `spawn EPERM`; their route fallback checks returned HTTP 200 for root, `/settings`, and `/settings/api-management`.
- Line counts for this slice: `src/components/settings/views/DashboardView.localized.tsx` is 872 physical lines; `src/components/settings/views/SystemLogsView.localized.tsx` is 417 physical lines; `src/index.css` is 11831 physical lines; `tests/unit/clay-frosted-surface-contract.test.ts` is 238 physical lines; `tests/unit/settings-desktop-workbench-regression.test.ts` is 106 physical lines; `tests/unit/settings-shell-scroll-regression.test.ts` is 76 physical lines; `tests/unit/settings-ui-density-regression.test.ts` is 157 physical lines; `tests/unit/settings-workbench-ui-refit.test.ts` is 123 physical lines.

## Completed M124 (OpenAI-Compatible AceData Route Helper)

- Scope: moved only pure AceData base URL normalization, direct image/task route extraction, model alias route resolution, candidate task route ordering, reference-image normalization, and image-size delegation into `src/services/llm/openAICompatibleAceDataRoute.ts`.
- `OpenAICompatibleAdapter.ts` now imports `normalizeAceDataBaseUrl()`, `resolveAceDataCandidateRoutes()`, `resolveAceDataImageRoute()`, `normalizeAceDataReferenceImage()`, and `resolveAceDataImageSize()` while preserving endpoint selection, auth/header behavior, fetch execution, polling loops, billing metadata, fallback ordering, UI, and release metadata.
- RED evidence from the handoff: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-acedata-route-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` because `src/services/llm/openAICompatibleAceDataRoute.ts` did not exist.
- Fresh targeted validation passed: `tests/unit/openai-compatible-acedata-route-contract.test.ts` passed 4/4 after the helper import was made Node-test resolvable.
- Fresh adjacent validation passed: `tests/unit/openai-compatible-acedata-route-contract.test.ts tests/unit/openai-compatible-wuyin-route-contract.test.ts tests/unit/openai-compatible-image-dispatch-contract.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/openai-compatible-image-payload-contract.test.ts tests/unit/openai-compatible-task-payload-contract.test.ts tests/unit/provider-surface-router.test.ts tests/unit/provider-strategy.test.ts` passed 58/58.
- Fresh structural validation passed: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false`; `npm.cmd run architecture:check` passed with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions; and `npm.cmd run typecheck` passed with semantic coverage for 123 test files.
- Fresh repository validation passed: `npm.cmd run test:unit` passed 1377/1377; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Browser QA skipped: this is a non-UI service/helper extraction with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` is 3004 physical lines, down from 3148 after the prior adjacent adapter/server cleanup; `src/services/llm/openAICompatibleAceDataRoute.ts` is 153 physical lines; `tests/unit/openai-compatible-acedata-route-contract.test.ts` is 87 physical lines; `tsconfig.tests.json` is 152 physical lines.
- Next priority: continue fresh seam-map Stage Two work. Remaining OpenAI-compatible adapter candidates are request builders, provider quirks, response parsing, polling fetch helpers, and image/video/audio compatibility; keep endpoint/auth/fetch/fallback behavior out unless a dedicated behavior test selects it.

## Completed M125 (OpenAI-Compatible 12AI Async And Chat Image Helpers)

- Scope: moved pure 12AI async route/base-url/model/size/quality/reference-image helpers from `OpenAICompatibleAdapter.ts` into `src/services/llm/openAICompatible12AIAsyncRoute.ts` and moved structured chat-image candidate selection into `src/services/llm/openAICompatibleImagePayload.ts`.
- `OpenAICompatibleAdapter.ts` now imports `normalize12AIBaseUrl()`, `is12AIAsyncImageModel()`, `shouldUse12AIAsyncImageRoute()`, `resolve12AIAsyncImageSize()`, `resolve12AIAsyncImageQuality()`, `normalize12AIAsyncReferenceImage()`, and `extractOpenAICompatibleChatImageUrls()` while preserving endpoint selection, auth/header behavior, fetch execution, polling loops, billing metadata, fallback ordering, UI, and release metadata.
- Contract coverage: `tests/unit/openai-compatible-twelve-ai-async-route-contract.test.ts` locks helper ownership and 12AI behavior; `tests/unit/openai-compatible-image-payload-contract.test.ts` now covers structured chat-image candidate selection; `tests/unit/provider-image-routing-regression.test.ts` follows the delegated 12AI async route helper.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-twelve-ai-async-route-contract.test.ts tests/unit/provider-image-routing-regression.test.ts` passed 10/10.
- Fresh adjacent validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-payload-contract.test.ts tests/unit/openai-compatible-image-dispatch-contract.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/openai-compatible-image-sizing-contract.test.ts tests/unit/openai-compatible-task-payload-contract.test.ts tests/unit/provider-surface-router.test.ts tests/unit/provider-strategy.test.ts` passed 57/57.
- Fresh structural validation passed: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false`; `npm.cmd run architecture:check` passed with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions; and `npm.cmd run typecheck` passed with semantic coverage for 124 test files.
- Fresh repository validation passed: `npm.cmd run test:unit` passed 1381/1381; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Path-limited alternate-git `diff --check` passed for the M125 code/test/ledger paths with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI service/helper extraction with no JSX, CSS, route rendering, browser-visible behavior, or release metadata change.
- Subagent review found no blocking behavior or header/key leakage regression. It flagged a P2 follow-up that structured chat-image URL and MIME values should be allowlisted; that is intentionally split into M126 because it changes parsing policy rather than pure extraction.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` is 2789 physical lines, down from 3004 after M124; `src/services/llm/openAICompatible12AIAsyncRoute.ts` is 100 physical lines; `src/services/llm/openAICompatibleImagePayload.ts` is 206 physical lines; `tests/unit/openai-compatible-twelve-ai-async-route-contract.test.ts` is 73 physical lines; `tests/unit/openai-compatible-image-payload-contract.test.ts` is 95 physical lines; `tests/unit/provider-image-routing-regression.test.ts` is 169 physical lines; `tsconfig.tests.json` is 153 physical lines.
- Next priority after M125: run M126 as a separate chat-image URL/MIME allowlisting hardening slice. Do not mix endpoint/auth/fetch/fallback behavior into the M125 commit.

## Completed M126 (OpenAI-Compatible Image Payload Security Hardening)

- Scope: allowlist image payload URL schemes and MIME types inside `src/services/llm/openAICompatibleImagePayload.ts`.
- Security behavior: structured response URLs now accept only `http:`, `https:`, or allowed raster `data:image/*;base64` URLs; `javascript:`, `file:`, and non-image data URLs are skipped. Raw base64 fields with invalid provider MIME labels fall back to `image/png`, while non-image data URLs embedded as URLs are rejected.
- Selection behavior: unsafe structured chat-image candidates are filtered before best-candidate selection, so a safe lower-weight image candidate can still be returned instead of falling back to unsafe content.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-payload-contract.test.ts` passed 8/8.
- Fresh adjacent validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-payload-contract.test.ts tests/unit/openai-compatible-image-dispatch-contract.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/openai-compatible-image-sizing-contract.test.ts tests/unit/openai-compatible-task-payload-contract.test.ts tests/unit/provider-surface-router.test.ts tests/unit/provider-strategy.test.ts` passed 60/60.
- Current structural/security validation passed: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false`; `npm.cmd run architecture:check`; `npm.cmd run governance:security`; and `npm.cmd run typecheck` with semantic coverage for 124 test files.
- Current repository validation passed: `npm.cmd run test:unit` passed 1384/1384; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and the M126 path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI service/helper hardening with no JSX, CSS, route rendering, browser-visible behavior, or release metadata change.
- Line counts for this slice: `src/services/llm/openAICompatibleImagePayload.ts` is 254 physical lines; `tests/unit/openai-compatible-image-payload-contract.test.ts` is 146 physical lines; `tests/unit/provider-image-routing-regression.test.ts` is 173 physical lines.
- Next priority after M126: return to fresh seam-map Stage Two work or a Stage Three quality-governance slice.

## Completed M127 (OpenAI-Compatible Image Reference Cleanup)

- Scope: move repeated OpenAI-compatible reference-image data URI / preserved-URL formatting into `src/services/llm/openAICompatibleImageReferences.ts`, delegate repeated adapter call sites to that helper, and remove three unreachable commented legacy bodies after the `chat`, `chatStream`, and `generateImageStandard_OpenAI_Strict` delegates.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-unused-cleanup-contract.test.ts` failed first because `chat()` still contained the commented legacy `/chat/completions` implementation after `return this.chatWithCompatibleResponses(...)`.
- Runtime-resolution repair: the new helper must import `./LLMAdapter.ts` because the Node test runner directly loads the TS helper as ESM; the no-extension import passed TypeScript but failed the targeted Node test with `ERR_MODULE_NOT_FOUND`.
- Fresh targeted validation passed: `tests/unit/openai-compatible-image-references-contract.test.ts` and `tests/unit/openai-compatible-unused-cleanup-contract.test.ts` passed 6/6; the validation-matrix OpenAI-compatible targeted set passed 49/49; the broader OpenAI/provider adjacency set passed 69/69; `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` passed.
- Fresh repository validation passed: `npm.cmd run architecture:check`; `npm.cmd run typecheck` with semantic coverage for 125 test files; `npm.cmd run test:unit` passed 1389/1389; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and the M127 path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped for M127: this is a non-UI service/helper cleanup with no JSX, CSS, route rendering, browser-visible behavior, or release metadata change.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` is 2862 physical lines, down from 3155 at the start of this working slice; `src/services/llm/openAICompatibleImageReferences.ts` is 57 physical lines; `tests/unit/openai-compatible-image-references-contract.test.ts` is 72 physical lines; `tests/unit/openai-compatible-unused-cleanup-contract.test.ts` is 66 physical lines; `tsconfig.tests.json` is 154 physical lines.
- Next priority after M127: choose the next fresh Stage Two seam from the read-only subagent candidates, with high-confidence options including OpenAI-compatible error helpers, keyManager raw `updateKey` log redaction, or dead Gemini cache cleanup; keep each in its own commit.

## Completed M128 (Dead Gemini Cache And Prompt Logging Cleanup)

- Scope: delete the source-proven unreferenced `src/services/storage/cache.ts` Gemini response cache, extend `tests/unit/storage-service-unused-cleanup-contract.test.ts` to guard the deleted module, and remove prompt text from the `CanvasContext.addPromptNode` diagnostic log while leaving active storage persistence, image storage, file-system behavior, UI, release metadata, provider routing, and auth/header behavior unchanged.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/storage-service-unused-cleanup-contract.test.ts` failed first after the prompt-content assertion was added because `CanvasContext.addPromptNode` still logged `node.prompt?.substring(0, 50)`.
- Source-proof evidence: `rg -n "geminiCache|GeminiCache|kk_studio_gemini_cache|services/storage/cache|storage/cache" src tests apps packages` now finds only the storage cleanup contract reference.
- Fresh validation passed: `tests/unit/storage-service-unused-cleanup-contract.test.ts` passed 4/4; the dead-cache source-proof scan now finds only the storage cleanup contract reference; `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false`; `npm.cmd run architecture:check`; `npm.cmd run typecheck` with semantic coverage for 125 test files; `npm.cmd run test:unit` passed 1390/1390; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and the M128 path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped for M128: this is a non-UI dead-helper/log-redaction cleanup with no JSX, CSS, route rendering, browser-visible UI, or release metadata change.
- Line counts for this slice: `src/context/CanvasContext.tsx` is 2517 physical lines; `tests/unit/storage-service-unused-cleanup-contract.test.ts` is 54 physical lines; `src/services/storage/cache.ts` is removed from the tracked worktree after deleting its 163-line baseline module.
- Next priority after M128: the read-only audits selected keyManager raw `updateKey` log redaction as the highest-priority narrow security slice.

## Completed M129 (KeyManager Update Diagnostic Redaction)

- Scope: add `src/services/auth/keyManagerUpdateDiagnostics.ts` and make `keyManager.updateKey()` log only slot id, sorted updated field names, secret/supported-model update booleans, and previous supported-model metadata instead of the raw `updates` object.
- Security behavior: raw `key` / `apiKey` values passed through settings API edits are no longer emitted by the `updateKey` console diagnostic; persistence, provider sync, model discovery, route selection, auth/header behavior, UI, and release metadata are unchanged.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-channel-config-secrets-contract.test.ts` failed first with 2/4 failing because `src/services/auth/keyManagerUpdateDiagnostics.ts` did not exist and `keyManager.ts` did not import/delegate to it.
- GREEN evidence: the same focused contract passed 5/5 after the helper was added, wired, and widened to all supported secret field names; the key-manager adjacent security set passed 14/14.
- Fresh validation passed: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false`; `npm.cmd run architecture:check`; `npm.cmd run governance:security`; `npm.cmd run typecheck` with semantic coverage for 125 test files; `npm.cmd run test:unit` passed 1393/1393; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and the M129 path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped for M129: this is a non-UI key-manager diagnostic redaction with no JSX, CSS, route rendering, browser-visible UI, or release metadata change.
- Line counts for this slice: `src/services/auth/keyManager.ts` is 3595 physical lines; `src/services/auth/keyManagerUpdateDiagnostics.ts` is 30 physical lines; `tests/unit/key-manager-channel-config-secrets-contract.test.ts` is 89 physical lines.
- Next priority after M129: choose one fresh Stage Two seam from the read-only candidates, with high-confidence options including OpenAI-compatible error helper extraction, prompt-bearing OpenAI diagnostics redaction, prompt optimizer cache redaction, or shared user-route auth inference.

## Completed M130 (OpenAI-Compatible Diagnostics Prompt Redaction)

- Scope: extend `src/services/llm/openAICompatibleDiagnostics.ts` so prompt-like fields are redacted from JSON and multipart diagnostics previews, and update `OpenAICompatibleAdapter` diagnostic python snippets to use redacted request previews or a fixed `<omitted:prompt>` placeholder.
- Security behavior: prompt/message/content/input/raw-prompt values no longer persist through OpenAI-compatible `requestBodyPreview` or diagnostic snippets; endpoint selection, auth/header behavior, fetch execution, polling, billing, fallback ordering, UI, and release metadata are unchanged.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-diagnostics-contract.test.ts` failed first with 3/4 failing because prompt fields and multipart prompts were still visible and snippets still used raw body/prompt stringification.
- GREEN evidence: the same focused diagnostics contract passed 4/4 after prompt redaction and snippet rewiring.
- Fresh validation passed: targeted OpenAI-compatible diagnostics/dispatch/payload/routing/sizing/task-payload contracts passed 34/34; `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false`; `npm.cmd run architecture:check`; `npm.cmd run governance:security`; `npm.cmd run typecheck` with semantic coverage for 125 test files; `npm.cmd run test:unit` passed 1394/1394; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and the M130 path-limited alternate-git `diff --check` is the remaining pre-commit whitespace gate.
- Browser QA skipped for M130: this is a non-UI service diagnostics metadata redaction with no JSX, CSS, route rendering, browser-visible UI, or release metadata change.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` is 2536 physical lines; `src/services/llm/openAICompatibleDiagnostics.ts` is 95 physical lines; `tests/unit/openai-compatible-diagnostics-contract.test.ts` is 75 physical lines.
- Next priority after M130: return to the user-reported visible UI regressions covering PromptBar button shadows, ecommerce card creation/layout, settings chrome alignment, and mobile selector wrapping.

## Completed M131 (Prompt Optimizer Cache And Logging Redaction)

- Scope: update `src/services/llm/promptOptimizerService.ts` so optimizer cache keys fingerprint prompt/reference content, migrate the cache namespace from v4 to v5, remove legacy v4 cache entries on read, and redact raw prompt fields from persisted cache result metadata.
- Runtime logging behavior: `summarizePromptOptimizerError()` now emits only diagnostic-safe name/code/status tokens; generation runtime and ecommerce node generation runtime use that summary for console warnings and user fallback notifications instead of passing arbitrary error objects.
- Security behavior: raw input prompts, reference-image data prefixes, `fullResult.raw_prompt_original`, and `fullResult.params.subject` are not persisted through optimizer cache/logging paths. Prompt optimization request behavior, provider selection, endpoint/auth behavior, billing, storage ownership, UI, and route fallback semantics are unchanged.
- RED evidence: `tests/unit/prompt-optimizer-service-source-contract.test.ts` failed first when the cache contract expected fingerprinting/cache-result redaction and when the logging contract expected summarized error logging.
- GREEN evidence: focused prompt optimizer/runtime validation passed 67/67 after implementation.
- Fresh validation before ledger sync: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-optimizer-service-source-contract.test.ts tests/unit/prompt-optimizer-autoroute-contract.test.ts tests/unit/prompt-optimizer-capability-route-contract.test.ts tests/unit/ecommerce-structured-task-source-contract.test.ts tests/unit/generation-runtime-contract.test.ts tests/unit/ecommerce-node-generation-runtime-contract.test.ts` passed 67/67; `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` passed; `npm.cmd run governance:security` passed; `npm.cmd run typecheck` passed; `npm.cmd run test:unit` passed 1417/1417; `npm.cmd run build` passed. Fresh post-ledger `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped for M131: this is a non-UI service cache/logging redaction with no JSX, CSS, route rendering, browser-visible UI, or release metadata change.
- Line counts for this slice: `src/services/llm/promptOptimizerService.ts` is 871 physical lines; `src/app/optimizeGenerationPrompt.ts` is 74 physical lines; `src/app/useGenerationRuntime.ts` is 2341 physical lines; `src/app/useEcommerceNodeGenerationRuntime.ts` is 262 physical lines; `tests/unit/prompt-optimizer-service-source-contract.test.ts` is 125 physical lines.
- Next priority after M131: inspect shared local user-route auth/header/query-key inference as a narrow server seam, using a read-only subagent map before any edits.

## Completed In `5aaccf50` (Ecommerce XLSX Static Preview Analysis)

- User report: uploading a spreadsheet requirement file in ecommerce mode showed an analysis failure with `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`, while the in-app Browser was on `http://127.0.0.1:3104/?qa=ecommerce-card-visibility-localization-final`.
- Root cause: the static preview server returns `dist/index.html` as `200 text/html` for `/api/ecommerce-analysis`; `analyzeEcommerceRequirementFile()` treated every successful response as JSON and surfaced the browser JSON parser error instead of using the existing local `.xlsx` fallback parser.
- Fix scope: `src/services/ecommerce/ecommerceAnalysisClient.ts` now checks response `Content-Type` before JSON parsing, falls back to local analysis for supported files on non-JSON responses, and emits localized format errors for unsupported/non-parseable response shapes. `.xlsx` keeps using `parseOpenXmlWorkbook()` plus `normalizeEcommerceAnalysis()`.
- Regression coverage: `tests/unit/ecommerce-analysis-client-fallback.test.ts` now covers `200 text/html` static-preview responses for a real in-memory `.xlsx` workbook and asserts local workbook analysis succeeds.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-analysis-client-fallback.test.ts` failed first on the new static-preview `.xlsx` test with `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-analysis-client-fallback.test.ts` passed 4/4; `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-analysis-client-fallback.test.ts tests/unit/ecommerce-requirement-analysis-runtime-contract.test.ts tests/unit/ecommerce-analysis-dev-proxy-contract.test.ts` passed 19/19.
- Fresh repository validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1350/1350; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` for the hotfix touched paths.
- Browser QA: refreshed the Codex in-app Browser at `http://127.0.0.1:3104/?qa=ecommerce-card-visibility-localization-final`; the static server still returns `200 text/html` for `/api/ecommerce-analysis`, matching the regression; page title was `KK Studio - AI Image Workspace`, ecommerce analysis controls were present, stale chunk text count was 0, and console error count was 0. File-picker upload was not automated; the exact response condition is covered by the new unit regression.

## Completed In `52074495` M116 (Ecommerce Visibility And Localization UI Closure)

- Scope: keep generated ecommerce main/module task cards visible on the canvas while hiding only framework-owned `a-plus-group` helper cards; localize ecommerce build/runtime notifications, post-build controls, PromptBar companion labels, mobile result feed chrome, and mobile detail framework queue chrome; make `addPromptNode` return after visible card insertion instead of awaiting reference image persistence.
- Commit included: `src/App.tsx`, `src/app/useEcommerceBuildRuntime.ts`, `src/app/useEcommerceRuntime.ts`, `src/app/usePromptGroupLayout.ts`, `src/components/ecommerce/EcommerceCardActions.tsx`, `src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx`, `src/components/mobile/MobileResultDetailScreen.tsx`, `src/components/mobile/MobileResultFeed.tsx`, `src/context/CanvasContext.tsx`, `tests/unit/canvas-node-updates-contract.test.ts`, `tests/unit/ecommerce-build-runtime-contract.test.ts`, `tests/unit/ecommerce-button-guards.test.ts`, `tests/unit/ecommerce-group-shell-app-contract.test.ts`, `tests/unit/ecommerce-runtime-contract.test.ts`, `tests/unit/mobile-ecommerce-continuation-surface.test.ts`, `tests/unit/mobile-result-feed-detail-contract.test.ts`, `tests/unit/ecommerce-build-visibility-localization-regression.test.ts`, `tsconfig.tests.json`, and ledger updates.
- Fresh test registration: M116 tests are registered in `tsconfig.tests.json`; `npm.cmd run typecheck` reports semantic coverage for 116 test files.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-build-runtime-contract.test.ts tests/unit/ecommerce-button-guards.test.ts tests/unit/ecommerce-group-shell-app-contract.test.ts tests/unit/ecommerce-build-visibility-localization-regression.test.ts tests/unit/ecommerce-runtime-contract.test.ts tests/unit/mobile-ecommerce-continuation-surface.test.ts tests/unit/mobile-result-feed-detail-contract.test.ts tests/unit/canvas-node-updates-contract.test.ts` passed 24/24.
- Fresh repository validation passed: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false`; `npm.cmd run architecture:check`; `npm.cmd run typecheck` with semantic coverage for 116 test files; `npm.cmd run test:unit` passed 1349/1349; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` for the M116 touched paths.
- Post-commit spot-check passed: the same targeted M116/canvas contract set passed 24/24; `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` passed; `npm.cmd run architecture:check` passed with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Browser QA passed in Codex in-app Browser at `http://127.0.0.1:3100/?qa=m116-ecommerce-localization`: title `KK Studio - AI Image Workspace`; `html lang="zh-CN"`; dark theme via `html.dark` and `body.dark-mode`; mobile result feed showed localized Results/Standard/Detail/Waiting labels; ecommerce panel showed localized requirement-import, upload-requirement, analyze-requirement, upload-product-image, and supplemental-reference-image controls; `.theme-transitioning` count `0`; stale chunk text count `0`; app root count `1`; console error count `0`. Screenshot capture timed out, so the evidence is DOM/console based rather than pixel-image based.
- Known follow-up kept out of M116: deeper business-copy language separation (`copyZh`/`copyEn` through normalized ecommerce data and prompt generation) still needs a separate data-model milestone.

## Completed In `ed444606` M115 (keyManager Remote Model Discovery Helper)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-remote-model-discovery-contract.test.ts` failed first because `src/services/auth/keyManagerRemoteModelDiscovery.ts` did not exist and `keyManager.ts` still retained inline remote model discovery parsing/dedupe logic.
- Extracted only pure Google model whitelist/default merge, Gemini-compatible model ID normalization, and OpenAI-compatible canonical model dedupe into `src/services/auth/keyManagerRemoteModelDiscovery.ts`.
- Updated `src/services/auth/keyManager.ts` to import the helper while preserving provider fetch execution, endpoint selection, auth/header/query-key behavior, provider persistence, cloud sync, key storage, route selection, runtime model resolution, localStorage policy, release metadata, and UI behavior.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-remote-model-discovery-contract.test.ts` passed 4/4; the broader keyManager model/pricing/boundary targeted gate passed 31/31.
- Fresh structural validation passed: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false`; `npm.cmd run typecheck` passed with the semantic test check covering 112 files via `tsconfig.tests.json`.
- Fresh full-gate validation passed in the current mixed working tree: `npm.cmd run architecture:check` passed with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions; `npm.cmd run test:unit` passed 1345/1345 after updating the excluded ecommerce source contracts to match the already-dirty UI/ecommerce behavior; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and the M115 path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI service/helper extraction with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/auth/keyManager.ts` is 3594 physical lines; `src/services/auth/keyManagerRemoteModelDiscovery.ts` is 130 physical lines; `tests/unit/key-manager-remote-model-discovery-contract.test.ts` is 118 physical lines; `tsconfig.tests.json` is 141 physical lines.
- Excluded dirty files for this commit: `src/App.tsx`, `src/app/useEcommerceBuildRuntime.ts`, `src/app/usePromptGroupLayout.ts`, `src/components/ecommerce/EcommerceCardActions.tsx`, `src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx`, `tests/unit/ecommerce-build-runtime-contract.test.ts`, `tests/unit/ecommerce-button-guards.test.ts`, `tests/unit/ecommerce-group-shell-app-contract.test.ts`, and `tests/unit/ecommerce-build-visibility-localization-regression.test.ts`.

## Review Fix Slice (2026-05-05)

- Scope: closes review/gate findings around explicit KK API session signing secrets, system proxy task-token signing fail-closed behavior, recharge idempotency uniqueness, hosted preview release isolation, portable remote KK API guardrails, local auth-gate routing, refresh-token rotation race handling, canvas container id forwarding, `.env.example` remote API defaults, and OCR default-language fallback.
- Root-cause repair during validation: the first full `npm.cmd run test:unit` failed 1335/1336 because the local ignored portable release bundle copy was stale against `scripts/release/portable-app-server.cjs`; the local bundle copy was synchronized so the workspace governance contract can evaluate the tracked source script.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/workspace-auth-gate.test.ts tests/unit/ocr-service-settings-contract.test.ts tests/unit/local-env-contract.test.ts tests/unit/portable-payment-package-contract.test.ts tests/unit/portable-app-server-document-proxy-contract.test.ts tests/unit/hosted-release-guardrails.test.ts tests/unit/vps-postgres-audit-contract.test.ts tests/unit/postgres-user-session-repository.test.ts tests/unit/kk-session-token.test.ts tests/unit/request-authenticator.test.ts apps/api/src/modules/model-proxy/application/local-system-proxy-service.test.ts tests/unit/canvas-live-unused-cleanup-contract.test.ts tests/unit/ecommerce-wheel-scroll-guard.test.ts tests/unit/governance-contract.test.ts` passed 60/60.
- Fresh repository validation passed in this turn: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1336/1336 after the local portable bundle sync; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; `npm.cmd run spec:check`; `npm.cmd run governance:check`; and `npm.cmd run audit:dependencies` reported 0 production vulnerabilities in both root and `payment-server`.
- Browser QA passed: in-app Browser smoke on `http://127.0.0.1:3100/?qa=gate-repair-infinite-canvas` showed title `KK Studio - AI Image Workspace`, visible `#canvas-container`, one visible app root, and zero console errors.

## Completed Working Tree M114 (keyManager Shared Pricing Helper)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-shared-pricing-contract.test.ts` failed first because `src/services/auth/keyManagerSharedPricing.ts` did not exist and `keyManager.ts` still retained the inline shared pricing helpers.
- Extracted only shared pricing catalog model normalization and pricing snapshot construction into `src/services/auth/keyManagerSharedPricing.ts`.
- Updated `src/services/auth/keyManager.ts` to import the helper while preserving provider fetches, provider persistence, cloud sync, key storage, route selection, runtime model resolution, localStorage policy, and UI behavior.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-shared-pricing-contract.test.ts` passed 3/3; the broader keyManager/pricing/cloud storage targeted gate passed 49/49.
- Fresh structural validation passed: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false`; `npm.cmd run architecture:check` passed with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions; `npm.cmd run typecheck` passed with the semantic test check covering 111 files via `tsconfig.tests.json`.
- Fresh full-gate validation passed: `npm.cmd run test:unit` passed 1339/1339; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Browser QA skipped: this is a non-UI service/helper extraction with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/auth/keyManager.ts` is 3655 physical lines; `src/services/auth/keyManagerSharedPricing.ts` is 136 physical lines; `tests/unit/key-manager-shared-pricing-contract.test.ts` is 108 physical lines; `tsconfig.tests.json` is 140 physical lines.

## Completed Working Tree M102 (Gemini Service Unused Cleanup)

- Removed only compiler-proven unused imports/helpers from `src/services/llm/geminiService.ts`: the stale `GenerationMode`, auth/keyManager, API config, proxy config imports, the unused fallback flag cache/helper, the unused local-dev flag, and the unused `calculateImageTokens()` helper.
- Renamed the unread `negativePrompt` parameter to `_negativePrompt`, preserving the public parameter slot while keeping `llmService.generateImage(llmOptions)` and `calculateCost(...)` call shapes intact.
- Extended `tests/unit/llm-service-unused-cleanup-contract.test.ts` so the stale Gemini service imports/helpers do not return and the live generation/cost call sites remain source-contracted.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/llm-service-unused-cleanup-contract.test.ts` passed 2/2.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 24 broader historical diagnostics, with zero `src/services/llm/geminiService.ts` matches. The remaining diagnostics are `ApiSettingsView.tsx` 8, `useImageGeneration.ts` 8, `keyManager.ts` 6, and 2 source-contracted `secureModelProxy.ts` route-gate helpers.
- Fresh full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1296/1296; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and the path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI service cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/llm/geminiService.ts` is 523 physical lines; `tests/unit/llm-service-unused-cleanup-contract.test.ts` is 54 physical lines.

## Completed Working Tree M103 (Image Generation Hook Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/image-generation-unused-cleanup-contract.test.ts` failed first while `src/hooks/useImageGeneration.ts` still retained the stale imports, unused `useCanvas` destructures, the `GENERATE_TIMEOUT_MS` constant, the unused `uniqueRecoveredUrls.map(..., index)` parameter, and the unread `pendingTaskIds` local.
- Removed only the compiler-proven dead bindings from `src/hooks/useImageGeneration.ts`: `saveImage`, `isCreditBasedModel`, `GENERATE_TIMEOUT_MS`, `deleteImageNode`, `updateImageNode`, `updateImageNodePosition`, the unused `index` parameter in the recovered-url mapping, and the unread `pendingTaskIds` local.
- Added `tests/unit/image-generation-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so the stale hook bindings do not return while the persisted-media imports, billing coordinator calls, sync bridge recovery, and pending-task state transitions remain source-contracted.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/image-generation-unused-cleanup-contract.test.ts` passed 1/1.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 16 broader historical diagnostics, with zero `src/hooks/useImageGeneration.ts` matches. The remaining diagnostics are `ApiSettingsView.tsx` 8, `keyManager.ts` 6, and 2 source-contracted `secureModelProxy.ts` route-gate helpers.
- Fresh targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/image-generation-unused-cleanup-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts tests/unit/generation-runtime-contract.test.ts tests/unit/ecommerce-structured-task-source-contract.test.ts tests/unit/partial-redraw-pipeline-contract.test.ts` passed 56/56.
- Fresh full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1297/1297; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and the path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI hook cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/hooks/useImageGeneration.ts` is 1863 physical lines; `tests/unit/image-generation-unused-cleanup-contract.test.ts` is 22 physical lines.

## Completed Working Tree M104 (API Settings Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/api-settings-unused-cleanup-contract.test.ts tests/unit/api-settings-view-source-guard.test.ts tests/unit/api-settings-encoding-guard.test.ts` failed first while `ApiSettingsView.tsx` still retained the stale health helper import, duplicate non-UI budget constants, unused provider metric helpers, and unread readonly fallback helpers.
- Removed only compiler-proven unused bindings from `src/components/settings/ApiSettingsView.tsx`: `isKkApiUserDataPersistedInCloudFromHealth`, the duplicate `TOKEN_UNIT_LABEL` / `LEGACY_TOKEN_LIMIT_LABEL` / `BUDGET_OPTIONS` constants, `getProviderUsageSummary`, `getProviderActivityLine`, `shouldUseReadonlyProfileFallback`, and `userApiReadOnlyHelper`.
- Added `tests/unit/api-settings-unused-cleanup-contract.test.ts`, updated the source/encoding guards to keep the active `UI_*` budget constants only, and registered the new contract in `tsconfig.tests.json`.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/api-settings-unused-cleanup-contract.test.ts tests/unit/api-settings-view-source-guard.test.ts tests/unit/api-settings-encoding-guard.test.ts` passed 6/6.
- Fresh API settings gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/api-settings*.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts" "tests/unit/settings-workbench-ui-refit.test.ts" "tests/unit/settings-canonical-entry-regression.test.ts"` passed 54/54.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 8 broader historical diagnostics, with zero `src/components/settings/ApiSettingsView.tsx` matches. The remaining diagnostics are `keyManager.ts` 6 and 2 source-contracted `secureModelProxy.ts` route-gate helpers.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1298/1298; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Browser QA passed through the Codex in-app Browser on `http://127.0.0.1:3100/settings/api-management?qa=api-settings-unused-cleanup-m104`: after using the local temporary-user entry, the API settings route rendered the expected API settings overview and provider sections, page title was `KK Studio - AI Image Workspace`, and current-tab console error count was `0`.
- Line counts for this slice: `src/components/settings/ApiSettingsView.tsx` is 3347 physical lines; `tests/unit/api-settings-unused-cleanup-contract.test.ts` is 28 physical lines.

## Completed Working Tree M105 (keyManager Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-dead-code-pruning-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts` failed first while `src/services/auth/keyManager.ts` still retained the stale `getProviderStorageKey`, `DEPRECATED_MODELS`, and `isDeprecatedModel` imports, unread `authHasSession`, unused private `getProviderStorageKey()` wrapper, unread `isCreditModel` local, and unused private `flushPendingProviderCloudSync()` wrapper.
- Removed only compiler-proven unused bindings from `src/services/auth/keyManager.ts`; provider persistence still marks `markPendingProviderCloudSync(this.cloudSyncState)` and calls the existing unified `flushPendingCloudSync()` path.
- Updated `tests/unit/key-manager-dead-code-pruning-contract.test.ts` and `tests/unit/key-manager-model-helpers-contract.test.ts` so the stale keyManager dead bindings cannot return while compatibility re-exports from `keyManagerModelHelpers.ts` remain intact.
- Updated `tests/unit/google-official-gemini-protocol-guards.test.ts` so Google TTS/audio coverage follows the live `modelCapabilities` / `keyManagerModelHelpers` / `inferModelType(baseId)` path instead of requiring the removed dead `isCreditModel` local.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/google-official-gemini-protocol-guards.test.ts tests/unit/key-manager-dead-code-pruning-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts` passed 11/11.
- Fresh keyManager/security-adjacent validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager*.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts" "tests/unit/runtime-legacy-fallback-guards.test.ts" "tests/unit/route-aware-credit-billing.test.ts" "tests/unit/generation-runtime-contract.test.ts"` passed 116/116.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 2 broader historical diagnostics, with zero `src/services/auth/keyManager.ts` matches. The remaining diagnostics are the 2 source-contracted `src/services/model/secureModelProxy.ts` route-gate helpers.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1298/1298; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Browser QA skipped: this is a non-UI service/source-contract cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/auth/keyManager.ts` is 4310 physical lines; `tests/unit/key-manager-dead-code-pruning-contract.test.ts` is 32 physical lines; `tests/unit/key-manager-model-helpers-contract.test.ts` is 217 physical lines; `tests/unit/google-official-gemini-protocol-guards.test.ts` is 60 physical lines.

## Completed Working Tree M106 (secureModelProxy Route Gate Wiring)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/user-route-proxy-routing.test.ts` failed first because `shouldUseLocalUserRouteApi` and `shouldUseLocalSystemProxy` were still dead declarations.
- Wired `shouldUseLocalUserRouteApi()` into `invokeLocalUserRouteProxy()` and `shouldUseLocalSystemProxy()` into `invokeLocalSystemProxy()` so the route gates are exercised at the live entrypoints without changing the current `return true` behavior.
- Updated `tests/unit/user-route-proxy-routing.test.ts` to lock the new gate usage and preserve the no-browser-direct / no-stale-fallback contracts.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/user-route-proxy-routing.test.ts tests/unit/secure-model-proxy-credit-contract.test.ts tests/unit/frontend-key-boundary-hardening.test.ts` passed 12/12.
- Fresh noUnused probe passed cleanly: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` returned exit 0.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1298/1298; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Browser QA skipped: this is a non-UI service/source-contract wiring slice with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/model/secureModelProxy.ts` is 1332 physical lines.

## Completed In `9764ba70` M107 (OpenAI-Compatible Image Dispatch Helper)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-dispatch-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` because `src/services/llm/openAICompatibleImageDispatch.ts` did not exist.
- Added `src/services/llm/openAICompatibleImageDispatch.ts` as a pure post-surface dispatch-plan helper. It returns only a `kind` plan and does not import or call request execution helpers, endpoint builders, auth helpers, fetch, or fallback handlers.
- Updated `src/services/llm/OpenAICompatibleAdapter.ts` so `generateImage()` still owns doc URL rejection, Wuyin/AceData short-circuits, `resolveChannelRuntime`, `resolveImageSurface`, logging, all `this.generate...` calls, endpoint/auth/fetch behavior, and the billing-safe compatibility throws, while the provider/image branch choice comes from `dispatchPlan.kind`.
- Updated `tests/unit/provider-image-routing-regression.test.ts` and added `tests/unit/openai-compatible-image-dispatch-contract.test.ts` so Suxi, GPT Best, Antigravity, 12AI async, chat strictness, provider-chat, and default fail-closed dispatch ordering remain source-contracted.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-dispatch-contract.test.ts tests/unit/openai-compatible-image-routing-errors-contract.test.ts tests/unit/openai-compatible-diagnostics-contract.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/provider-surface-router.test.ts tests/unit/provider-strategy.test.ts tests/unit/provider-channel-surface-view.test.ts tests/unit/twelve-ai-doc-alignment.test.ts tests/unit/async-image-proxy-regression.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/governance-contract.test.ts` passed 78/78.
- Fresh noUnused probe passed cleanly: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` returned exit 0.
- Fresh architecture and security validation passed: `npm.cmd run architecture:check`; `npm.cmd run governance:security`; `npm.cmd run audit:dependencies` found 0 vulnerabilities in root and `payment-server`.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1301/1301; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Browser QA skipped: this is a non-UI service/source-contract extraction with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` is 4339 physical lines; `src/services/llm/openAICompatibleImageDispatch.ts` is 91 physical lines; `tests/unit/openai-compatible-image-dispatch-contract.test.ts` is 127 physical lines; `tests/unit/provider-image-routing-regression.test.ts` is 173 physical lines.

## Completed In `268ed882` M108 (OpenAI-Compatible Image Payload Helper)

- RED evidence: the payload contract failed first before `src/services/llm/openAICompatibleImagePayload.ts` existed, and the existing base64 mime regression then failed because it still inspected the removed adapter-local implementation.
- Added `src/services/llm/openAICompatibleImagePayload.ts` as a pure payload parser for image URLs and base64 image fields. It accepts `unknown`, uses typed record/path helpers instead of adapter-local `any`, preserves upstream `mime_type` / `mimeType` values, and falls back to `image/png` only when no provider mime is present.
- Updated `src/services/llm/OpenAICompatibleAdapter.ts` to import `extractImageUrlsFromPayload()` and delegate all previous `this.extractImageUrlsFromPayload(...)` call sites. Endpoint selection, auth, fetch behavior, task polling, provider routing, and compatibility fallback ordering stayed in the adapter.
- Added `tests/unit/openai-compatible-image-payload-contract.test.ts`, registered it in `tsconfig.tests.json`, and retargeted the existing base64 mime regression to the helper source so the contract follows the new ownership boundary.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-payload-contract.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/openai-compatible-image-dispatch-contract.test.ts tests/unit/openai-compatible-image-routing-errors-contract.test.ts tests/unit/openai-compatible-diagnostics-contract.test.ts tests/unit/provider-surface-router.test.ts tests/unit/provider-strategy.test.ts tests/unit/provider-channel-surface-view.test.ts tests/unit/twelve-ai-doc-alignment.test.ts tests/unit/async-image-proxy-regression.test.ts` passed 62/62.
- Fresh noUnused probe passed cleanly: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` returned exit 0.
- Fresh architecture and security validation passed: `npm.cmd run architecture:check`; `npm.cmd run governance:security`; `npm.cmd run audit:dependencies` found 0 vulnerabilities in root and `payment-server`.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1305/1305; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Passed path-limited cached diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --cached --check -- src/services/llm/OpenAICompatibleAdapter.ts src/services/llm/openAICompatibleImagePayload.ts tests/unit/openai-compatible-image-payload-contract.test.ts tests/unit/provider-image-routing-regression.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md`.
- Browser QA skipped: this is a non-UI service/source-contract extraction with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` is 4247 physical lines; `src/services/llm/openAICompatibleImagePayload.ts` is 141 physical lines; `tests/unit/openai-compatible-image-payload-contract.test.ts` is 83 physical lines; `tests/unit/provider-image-routing-regression.test.ts` is 185 physical lines; `tsconfig.tests.json` is 135 physical lines.

## Completed In `f2de4377` M109 (OpenAI-Compatible Image Sizing Helper)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-sizing-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` because `src/services/llm/openAICompatibleImageSizing.ts` did not exist.
- Added `src/services/llm/openAICompatibleImageSizing.ts` as a pure helper for OpenAI image profile classification, aspect orientation, image-count clamping, generation-size resolution, and edit-size resolution.
- Updated `src/services/llm/OpenAICompatibleAdapter.ts` to delegate those helper calls while preserving `shouldUseOpenAIEditsEndpoint`, endpoint selection, auth, fetch behavior, task polling, provider routing, and compatibility fallback ordering in the adapter.
- Added `tests/unit/openai-compatible-image-sizing-contract.test.ts` and registered it in `tsconfig.tests.json` so model profile, aspect/count, generation sizes, edit sizes, and adapter delegation stay covered.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-sizing-contract.test.ts` passed 5/5.
- Fresh OpenAI/provider gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-sizing-contract.test.ts tests/unit/openai-compatible-image-payload-contract.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/openai-compatible-image-dispatch-contract.test.ts tests/unit/openai-compatible-image-routing-errors-contract.test.ts tests/unit/openai-compatible-diagnostics-contract.test.ts tests/unit/provider-surface-router.test.ts tests/unit/provider-strategy.test.ts tests/unit/provider-channel-surface-view.test.ts tests/unit/twelve-ai-doc-alignment.test.ts tests/unit/async-image-proxy-regression.test.ts` passed 67/67.
- Fresh noUnused probe passed cleanly: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` returned exit 0.
- Fresh architecture and security validation passed: `npm.cmd run architecture:check`; `npm.cmd run governance:security`; `npm.cmd run audit:dependencies` found 0 vulnerabilities in root and `payment-server`.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1310/1310; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Passed path-limited cached diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --cached --check -- src/services/llm/OpenAICompatibleAdapter.ts src/services/llm/openAICompatibleImageSizing.ts tests/unit/openai-compatible-image-sizing-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md`.
- Browser QA skipped: this is a non-UI service/source-contract extraction with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` is 4170 physical lines; `src/services/llm/openAICompatibleImageSizing.ts` is 81 physical lines; `tests/unit/openai-compatible-image-sizing-contract.test.ts` is 97 physical lines; `tsconfig.tests.json` is 136 physical lines.

## Completed In `d229c791` M110 (OpenAI-Compatible Task Payload Helper)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-task-payload-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` because `src/services/llm/openAICompatibleTaskPayload.ts` did not exist.
- Added `src/services/llm/openAICompatibleTaskPayload.ts` as a pure helper for generic task ID extraction, generic task status mapping, and batch task-item list extraction.
- Updated `src/services/llm/OpenAICompatibleAdapter.ts` to delegate those payload parsing calls while preserving `extractProviderMessage`, `buildPolledTaskResult`, endpoint selection, auth, fetch behavior, polling request URLs, backoff, provider branch selection, result metadata assembly, and fallback ordering in the adapter.
- Added `tests/unit/openai-compatible-task-payload-contract.test.ts` and registered it in `tsconfig.tests.json` so nested task IDs, mixed status signals, image URL success signals, batch item order, and adapter delegation stay covered.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-task-payload-contract.test.ts` passed 4/4.
- Fresh OpenAI/provider gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-task-payload-contract.test.ts tests/unit/openai-compatible-image-payload-contract.test.ts tests/unit/openai-compatible-image-sizing-contract.test.ts tests/unit/openai-compatible-image-dispatch-contract.test.ts tests/unit/openai-compatible-image-routing-errors-contract.test.ts tests/unit/provider-image-routing-regression.test.ts` passed 27/27.
- Fresh noUnused probe passed cleanly: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` returned exit 0.
- Fresh architecture validation passed: `npm.cmd run architecture:check` passed with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1314/1314; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Browser QA skipped: this is a non-UI service/source-contract extraction with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` is 4051 physical lines; `src/services/llm/openAICompatibleTaskPayload.ts` is 151 physical lines; `tests/unit/openai-compatible-task-payload-contract.test.ts` is 55 physical lines; `tsconfig.tests.json` is 137 physical lines.

## Completed Working Tree M111 (OpenAI-Compatible Task Result Helper)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-task-payload-contract.test.ts` failed first because `src/services/llm/openAICompatibleTaskPayload.ts` did not export `buildOpenAICompatiblePolledTaskResult`.
- Extended `src/services/llm/openAICompatibleTaskPayload.ts` with pure provider message extraction and polled task result assembly.
- Updated `src/services/llm/OpenAICompatibleAdapter.ts` to delegate provider message/result helpers while preserving endpoint selection, auth, fetch behavior, polling request URLs, backoff, provider branch selection, immediate result handling, and fallback ordering in the adapter.
- Extended `tests/unit/openai-compatible-task-payload-contract.test.ts` so nested provider messages, provider metadata, response message metadata, and the success-without-URL downgrade to `processing` stay covered.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-task-payload-contract.test.ts` passed 6/6.
- Fresh OpenAI/provider gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-task-payload-contract.test.ts tests/unit/openai-compatible-image-payload-contract.test.ts tests/unit/openai-compatible-image-sizing-contract.test.ts tests/unit/openai-compatible-image-dispatch-contract.test.ts tests/unit/openai-compatible-image-routing-errors-contract.test.ts tests/unit/provider-image-routing-regression.test.ts` passed 29/29.
- Fresh noUnused probe passed cleanly: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` returned exit 0.
- Fresh architecture validation passed: `npm.cmd run architecture:check` passed with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1316/1316; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Browser QA skipped: this is a non-UI service/source-contract extraction with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` is 4008 physical lines; `src/services/llm/openAICompatibleTaskPayload.ts` is 219 physical lines; `tests/unit/openai-compatible-task-payload-contract.test.ts` is 105 physical lines.

## Completed In `c0c96808` M117 (OpenAI-Compatible Gemini Image Sizing Helper)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-sizing-contract.test.ts` failed first because `src/services/llm/openAICompatibleImageSizing.ts` did not export `normalizeGeminiImageSize` or `normalizeRequestedAspectRatio`.
- Moved only Gemini image-size normalization and requested aspect-ratio normalization into `src/services/llm/openAICompatibleImageSizing.ts`; `OpenAICompatibleAdapter.ts` now imports the helpers while preserving endpoint selection, auth, fetch behavior, provider routing, fallback ordering, billing, UI, and release metadata.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-sizing-contract.test.ts` passed 6/6; the broader OpenAI/provider image gate passed 65/65.
- Fresh structural validation passed: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false`; `npm.cmd run architecture:check`; `npm.cmd run typecheck` with semantic coverage for 116 test files.
- Fresh full validation passed: `npm.cmd run test:unit` passed 1351/1351; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Browser QA skipped: this is a non-UI service/helper extraction with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` is 3999 physical lines; `src/services/llm/openAICompatibleImageSizing.ts` is 99 physical lines; `tests/unit/openai-compatible-image-sizing-contract.test.ts` is 115 physical lines.

## Completed Working Tree M112 (Local User-Route Auth Helper)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/local-user-route-auth-contract.test.ts` failed first because `apps/api/src/modules/model-proxy/application/local-user-route-auth.ts` did not exist.
- Extracted local user-route auth/header/query-key, route strategy, route format, and image-surface pure helpers into `apps/api/src/modules/model-proxy/application/local-user-route-auth.ts`.
- Updated `apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts` to delegate the helper surface while preserving endpoint selection, fetch execution, task operation routing, credential retrieval/storage, provider branch execution, fallback ordering, billing metadata, release metadata, and UI behavior.
- Updated source-contract tests to follow the helper ownership instead of requiring the auth logic to stay inline in the service.
- Added behavior coverage for official Gemini query-key auth, GPT Best forced Bearer headers, 12AI query-key auth with existing query params preserved, Wuyin raw Authorization, and custom non-Authorization raw-token headers.
- Fresh targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/local-user-route-auth-contract.test.ts tests/unit/provider-auth-proxy-regression.test.ts tests/unit/system-gemini-auth-regression.test.ts tests/unit/twelve-ai-doc-alignment.test.ts tests/unit/async-image-proxy-regression.test.ts tests/unit/user-route-proxy-routing.test.ts apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.test.ts` passed 21/21.
- Fresh noUnused probe passed: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false`.
- Fresh architecture validation passed: `npm.cmd run architecture:check` passed with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Fresh typecheck passed: `npm.cmd run typecheck`; test semantic check covers 109 files via `tsconfig.tests.json`.
- Full validation passed: `npm.cmd run test:unit` passed 1322/1322; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; and `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts apps/api/src/modules/model-proxy/application/local-user-route-auth.ts tests/unit/local-user-route-auth-contract.test.ts tests/unit/provider-auth-proxy-regression.test.ts tests/unit/system-gemini-auth-regression.test.ts tests/unit/twelve-ai-doc-alignment.test.ts tests/unit/async-image-proxy-regression.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI server/helper/source-contract extraction with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts` is 2232 physical lines; `apps/api/src/modules/model-proxy/application/local-user-route-auth.ts` is 370 physical lines; `tests/unit/local-user-route-auth-contract.test.ts` is 132 physical lines.

## Completed Working Tree M113 (Local User-Route Endpoint Helper)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/local-user-route-endpoint-contract.test.ts` failed first because `apps/api/src/modules/model-proxy/application/local-user-route-endpoints.ts` did not exist.
- Extracted only direct OpenAI/Claude/Gemini endpoint URL normalization into `apps/api/src/modules/model-proxy/application/local-user-route-endpoints.ts`.
- Updated `apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts` to delegate endpoint helper calls while preserving auth/header/query-key behavior, endpoint call sites, fetch execution, task operation routing, credential retrieval/storage, provider branch execution, fallback ordering, logging, billing metadata, release metadata, and UI behavior.
- Added behavior coverage for OpenAI-compatible endpoint stripping/default `/v1`, Claude endpoint stripping/default `/v1`, Gemini generateContent/model suffix stripping, and source ownership delegation.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/local-user-route-endpoint-contract.test.ts tests/unit/local-user-route-auth-contract.test.ts tests/unit/provider-auth-proxy-regression.test.ts tests/unit/system-gemini-auth-regression.test.ts tests/unit/twelve-ai-doc-alignment.test.ts tests/unit/async-image-proxy-regression.test.ts tests/unit/user-route-proxy-routing.test.ts apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.test.ts` passed 25/25.
- Fresh structural validation passed: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false`; `npm.cmd run architecture:check` passed with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions; `npm.cmd run typecheck` passed with the semantic test check covering 110 files via `tsconfig.tests.json`.
- Fresh full-gate validation passed in the current mixed working tree after the separate release-bundle alignment repair: `npm.cmd run test:unit` passed 1336/1336; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and the M113 path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI server/helper/source-contract extraction with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts` is 1959 physical lines; `apps/api/src/modules/model-proxy/application/local-user-route-endpoints.ts` is 46 physical lines; `tests/unit/local-user-route-endpoint-contract.test.ts` is 71 physical lines; `tsconfig.tests.json` is 139 physical lines.

## Completed Working Tree M93 (User API Profile Import-Only Cleanup)

- Removed only the unused `loadUserApisPayloadFromCloudRecord` named import from `src/services/api/userApiProfileStorage.ts`; the live metadata and cloud merge imports remain unchanged.
- Extended `tests/unit/runtime-legacy-fallback-guards.test.ts` so the stale import cannot return while typed auth API fallback, local bridge read/write, cloud merge, and legacy runtime guards stay covered by existing targeted tests.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/runtime-legacy-fallback-guards.test.ts tests/unit/user-api-runtime-fallback.test.ts tests/unit/user-api-profile-storage-runtime-fallback.test.ts tests/unit/user-api-profile-storage-local-only.test.ts tests/unit/user-api-profile-storage-local-priority.test.ts` passed 16/16.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits 2 on 45 broader historical diagnostics, with zero `src/services/api/userApiProfileStorage.ts` matches.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1289/1289; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` for the M93 paths passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI service import cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Next low-risk cleanup candidate after the M93 commit: remove the stale `billingFeatureEnabled` alias in `src/components/modals/UserProfileModal.tsx` and update `tests/unit/local-runtime-consistency-contract.test.ts` to assert the active `billingUiEnabled` gate instead.

## Completed Working Tree M94 (UserProfileModal Billing Alias Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/local-runtime-consistency-contract.test.ts` failed after the contract was updated to forbid `billingFeatureEnabled`, because the stale alias still existed in `src/components/modals/UserProfileModal.tsx`.
- Removed only the duplicate `const billingFeatureEnabled = KKAI_FEATURE_FLAGS.billing;` alias from `src/components/modals/UserProfileModal.tsx`; the live `billingUiEnabled` feature gate and all billing UI conditionals remain unchanged.
- Updated `tests/unit/local-runtime-consistency-contract.test.ts` to assert the live `billingUiEnabled` gate and prevent the stale alias from returning.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/local-runtime-consistency-contract.test.ts tests/unit/kkai-billing-ui-surface.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/user-profile-modal-auth-contract.test.ts` passed 10/10.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits 2 on 44 broader historical diagnostics, with zero `src/components/modals/UserProfileModal.tsx` and zero `billingFeatureEnabled` diagnostics.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1289/1289; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` for the M94 paths passed with LF/CRLF normalization warnings only.
- Browser QA passed: in-app browser smoke on `http://127.0.0.1:3100/?qa=user-profile-modal-billing-alias-m94` showed title `KK Studio - AI Image Workspace`, one visible `#root`, and zero browser console errors. Temporary Vite was stopped after the check.
- Line counts for this slice: `src/components/modals/UserProfileModal.tsx` 1388 lines; `tests/unit/local-runtime-consistency-contract.test.ts` 63 lines.

## Completed Working Tree M95 (User API Cloud Helper Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/runtime-legacy-fallback-guards.test.ts` failed after the contract was updated to forbid `function getErrorMessage(` in `src/services/api/userApiCloudRecordStorage.ts`.
- Removed only the uncalled private `getErrorMessage(error, fallback)` helper from `src/services/api/userApiCloudRecordStorage.ts`; no typed auth payload loading, local API fallback, cache, compaction, or secret redaction behavior changed.
- Extended `tests/unit/runtime-legacy-fallback-guards.test.ts` so the stale helper cannot return while existing legacy fallback and runtime routing guards remain intact.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/runtime-legacy-fallback-guards.test.ts tests/unit/user-api-cloud-storage.test.ts tests/unit/user-api-profile-storage-runtime-fallback.test.ts tests/unit/user-api-profile-storage-local-only.test.ts tests/unit/user-api-profile-storage-local-priority.test.ts` passed 33/33.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits 2 on 43 broader historical diagnostics, with zero `src/services/api/userApiCloudRecordStorage.ts` and zero `getErrorMessage` diagnostics.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1289/1289; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` for the M95 paths passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI API service helper cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/api/userApiCloudRecordStorage.ts` 840 lines; `tests/unit/runtime-legacy-fallback-guards.test.ts` 77 lines.

## Completed Working Tree M96 (NewAPI Management Service Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/billing-service-unused-cleanup-contract.test.ts` failed after the contract was added because `src/services/billing/newApiManagementService.ts` still imported unused `notify`.
- Removed only the unused `notify` import from `src/services/billing/newApiManagementService.ts` and changed `const channels = await this.getAllChannels();` to `await this.getAllChannels();`, preserving the preflight/cache side effect before the `/api/channel/balance` request.
- Added `tests/unit/billing-service-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so the stale import and unread binding do not return while the balance refresh request, cache update, and returned `updatedChannels` shape remain source-contracted.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/billing-service-unused-cleanup-contract.test.ts` passed 1/1.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 41 broader historical diagnostics, with zero `src/services/billing/newApiManagementService.ts` diagnostics.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1290/1290; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` for the M96 paths passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI billing service cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/billing/newApiManagementService.ts` moved from 553 to 552 physical lines; `tests/unit/billing-service-unused-cleanup-contract.test.ts` is 23 physical lines.

## Completed Working Tree M97 (Recharge Submission Service Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/billing-service-unused-cleanup-contract.test.ts` failed after the contract was extended because `src/services/billing/rechargeSubmissionService.ts` still declared `function normalizeRechargePaymentChannelConfig(`.
- Removed only the uncalled private `normalizeRechargePaymentChannelConfig(value)` helper from `src/services/billing/rechargeSubmissionService.ts`; no recharge bill/request construction, proof submission, route client, or channel list fallback behavior changed.
- Extended `tests/unit/billing-service-unused-cleanup-contract.test.ts` so the stale helper cannot return while `buildDefaultRechargePaymentChannelConfigs()`, `qrDisplay: normalizeQrDisplay({ ... })`, and `items: buildDefaultRechargePaymentChannelConfigs()` remain source-contracted.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/billing-service-unused-cleanup-contract.test.ts` passed 2/2.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 40 broader historical diagnostics, with zero `src/services/billing/rechargeSubmissionService.ts` diagnostics.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1291/1291; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` for the M97 paths passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI billing service cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/billing/rechargeSubmissionService.ts` moved from 688 to 670 physical lines; `tests/unit/billing-service-unused-cleanup-contract.test.ts` moved from 23 to 31 physical lines.

## Completed Working Tree M98 (Storage Adapter Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/storage-service-unused-cleanup-contract.test.ts` failed after adding the contract because `src/services/storage/storageAdapter.ts` still imported unused `compressIfNeeded`.
- Removed only the unused `compressIfNeeded` import from `src/services/storage/storageAdapter.ts` and dropped the unused `reject` Promise executor parameter in `getImageDimensionsFromFile`.
- Added `tests/unit/storage-service-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so the stale OPFS import and unused Promise parameter do not return while `img.onerror` still resolves the default `1024x1024` fallback.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/storage-service-unused-cleanup-contract.test.ts` passed 1/1.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 38 broader historical diagnostics, with zero `src/services/storage/storageAdapter.ts` diagnostics.
- Fresh full validation passed in this pass: `npm.cmd run typecheck`, `npm.cmd run test:unit` (1292/1292), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check`.
- Browser QA skipped: this is a non-UI storage adapter cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/storage/storageAdapter.ts` moved from 408 to 407 physical lines; `tests/unit/storage-service-unused-cleanup-contract.test.ts` is 18 physical lines.

## Completed Working Tree M99 (Storage Preference Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/storage-service-unused-cleanup-contract.test.ts` failed after adding the contract because `saveOriginalToLocalFolder` still exposed the unread `prompt?: string` parameter.
- Renamed only the unused `prompt` parameter in `src/services/storage/storagePreference.ts` to `_prompt`, preserving the public third-argument slot and the `saveOriginalToLocalFolder(id, blob, undefined, timestamp)` merge call shape.
- Extended `tests/unit/storage-service-unused-cleanup-contract.test.ts` so the local-folder save function keeps `_prompt?: string`, keeps the timestamp filename generation, and does not reintroduce the stale parameter name.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/storage-service-unused-cleanup-contract.test.ts` passed 2/2.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 37 broader historical diagnostics, with zero `src/services/storage/storagePreference.ts` diagnostics.
- Fresh full validation passed in this pass: `npm.cmd run typecheck`, `npm.cmd run test:unit` (1293/1293), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check`.
- Browser QA skipped: this is a non-UI storage preference parameter cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/storage/storagePreference.ts` stayed at 334 physical lines; `tests/unit/storage-service-unused-cleanup-contract.test.ts` moved from 18 to 25 physical lines.

## Completed Working Tree M100 (Image Storage Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/storage-service-unused-cleanup-contract.test.ts` failed after adding the contract because `cleanupOriginals()` still acquired an unread `const db = await openDB();` handle.
- Removed only the unused `db` local from `src/services/storage/imageStorage.ts` `cleanupOriginals()`, preserving `getImageCount()`, `getImagesPage()`, compression, `saveImage()`, and saved-byte accounting.
- Extended `tests/unit/storage-service-unused-cleanup-contract.test.ts` so the cleanup helper keeps paginated reads and saves while the stale unread database handle does not return.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/storage-service-unused-cleanup-contract.test.ts` passed 3/3.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 36 broader historical diagnostics, with zero `src/services/storage/imageStorage.ts` diagnostics.
- Fresh full validation passed in this pass: `npm.cmd run typecheck`, `npm.cmd run test:unit` (1294/1294), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check`.
- Browser QA skipped: this is a non-UI image storage cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/storage/imageStorage.ts` moved from 1072 to 1071 physical lines; `tests/unit/storage-service-unused-cleanup-contract.test.ts` moved from 25 to 35 physical lines.

## Completed Working Tree M101 (Google Adapter Import Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/llm-adapter-unused-cleanup-contract.test.ts` failed after adding the contract because `src/services/llm/GoogleAdapter.ts` still imported unused `ProviderConfig`, `VideoGenerationOptions`, `VideoGenerationResult`, and `logWarning`.
- Removed only those import-only unused symbols from `src/services/llm/GoogleAdapter.ts`, preserving `logError` and the inline `import('./LLMAdapter').VideoGenerationOptions` / `VideoGenerationResult` references in `generateVideo()`.
- Extended `tests/unit/llm-adapter-unused-cleanup-contract.test.ts` so the Google adapter import list stays clean while the inline video generation type references remain present.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/llm-adapter-unused-cleanup-contract.test.ts` passed 2/2.
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits non-zero on 32 broader historical diagnostics, with zero `src/services/llm/GoogleAdapter.ts` diagnostics.
- Fresh full validation passed in this pass: `npm.cmd run typecheck`, `npm.cmd run test:unit` (1295/1295), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check`.
- Browser QA skipped: this is a non-UI import-only Google adapter cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.
- Line counts for this slice: `src/services/llm/GoogleAdapter.ts` stayed at 823 physical lines; `tests/unit/llm-adapter-unused-cleanup-contract.test.ts` moved from 20 to 30 physical lines.

## Completed In `9e7ae2b5` (Clay UI Audit Closure)

- User override remains active: inputs, main cards, sub cards, and framework cards must use controlled frosted material; dark mode must use neutral black/gray surfaces, not teal/blue/indigo canvas.
- Fixed in this pass: Profile Modal action list/security surfaces, toolbar selected tokens, TagInputModal shell/input/footer, ProjectManager dropdown/modal sub surfaces, ChatSidebar message/attachment sub surfaces, PromptBar sky/white-glass skeleton and drag placeholder surfaces, mobile framework shell glass aliases, mobile advanced drawer white-glass utilities, mobile card index/empty/badge blue surfaces, EcommerceImportPanel hover glass, SearchPalette multi-select readability, RechargeModal dark CTA readability, API Workspace nested-card reduction, ChatSidebar agent active state, and PromptNode violet/blue badge drift.
- Light-theme readability was hardened by adding readable Clay emphasis text tokens (`--clay-brand-pink-ink`, `--clay-brand-coral-ink`) while keeping brand pink/coral for tinted fills and borders.
- Contract coverage now includes frosted input/main/sub/framework tokens, neutral black-gray dark variables, readable light emphasis text on tinted states, toolbar selected tokens, ProjectManager sub surfaces, ChatSidebar message/attachment surfaces, TagInputModal frosted tokens, PromptBar stale blue/white-glass regressions, mobile shell and mobile badge/index regressions, ecommerce hover token use, SearchPalette multi-select token use, RechargeModal CTA readability, API Workspace reduced nesting, ChatSidebar active-state token use, and PromptNode badge color regressions.
- Browser QA for this lane is complete and tracked below.
- Commit scope was UI/doc/test only and explicitly excluded runtime/PPT/ecommerce extraction WIP.

## Completed In `d12731ce` (Ecommerce Partial Redraw Runtime)

- Added `src/app/useEcommercePartialRedrawRuntime.ts` for ecommerce inherited redraw context resolution and ecommerce redraw result finalization.
- `src/App.tsx` now wires the partial-redraw hook through `resolveEcommercePartialRedrawContext` and `finalizeEcommercePartialRedrawResult`; App no longer owns the inline ecommerce inherited redraw context branch or the ecommerce redraw result re-parent/finalization branch inside `handlePartialRedrawRequest`.
- The hook receives dependencies through `UseEcommercePartialRedrawRuntimeDeps`: active canvas ref plus the image/prompt mutation callbacks needed to re-parent finalized ecommerce redraw results.
- New contract coverage in `tests/unit/ecommerce-partial-redraw-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, App wiring, and the extracted ecommerce redraw inheritance/finalization behavior. Existing `ecommerce-structured-task-source`, `partial-redraw-pipeline`, and `mobile-result-feed-app` tests were rerun as redraw-path regression guards.
- `tsconfig.tests.json` now semantically checks 31 test files.
- Line counts after extraction: `src/App.tsx` 4389 physical lines; `src/app/useEcommercePartialRedrawRuntime.ts` 91 physical lines; `tests/unit/ecommerce-partial-redraw-runtime-contract.test.ts` 55 physical lines; `tsconfig.tests.json` 60 physical lines.
- Targeted validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-partial-redraw-runtime-contract.test.ts tests/unit/ecommerce-structured-task-source-contract.test.ts tests/unit/partial-redraw-pipeline-contract.test.ts tests/unit/mobile-result-feed-app-contract.test.ts` passed (6/6).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 31 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1113/1113).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommercePartialRedrawRuntime.ts tests/unit/ecommerce-partial-redraw-runtime-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped for this slice because it is non-UI runtime glue that preserves the existing workspace and prompt surfaces. The Clay UI lane browser evidence remains recorded below.
- Commit include scope for this runtime slice: `status.md`, `plans.md`, `implement.md`, `validation.md`, `tsconfig.tests.json`, `src/App.tsx`, `src/app/useEcommercePartialRedrawRuntime.ts`, and `tests/unit/ecommerce-partial-redraw-runtime-contract.test.ts`.
- Explicitly excluded scope: Clay UI docs/styles/components, non-ecommerce redraw UI surfaces, PPT/generation runtime files, and unrelated ecommerce runtime slices not touched by the current partial-redraw extraction.

## Current Quality Baseline

- Current giant tracked files after M120: `src/index.css` 13552 physical lines, `src/App.tsx` 4812, `src/services/auth/keyManager.ts` 4100, `src/components/layout/PromptBar.tsx` 3965, `src/services/llm/OpenAICompatibleAdapter.ts` 3896, `src/components/settings/ApiSettingsView.tsx` 3347, `src/components/layout/ChatSidebar.tsx` 2743, `src/app/useGenerationRuntime.ts` 2603, `src/context/CanvasContext.tsx` 2517, `src/components/canvas/PromptNodeComponent.tsx` 2241, `apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts` 2184, `apps/api/src/server.ts` 2117, and `src/hooks/useImageGeneration.ts` 2031.
- Current tracked TS/TSX debt scan by alternate-git over `*.ts` / `*.tsx`: direct `as any` matches 155, broad `any` token matches 586, `@ts-ignore` / `@ts-expect-error` matches 133, and `console.log` matches 245. Broad workspace scan excluding `node_modules`, `dist`, `release`, and `coverage` is noisier: `as any` 164, `any` token 672, TS suppressions 137, and `console.log` 416. The production noUnused probe now passes cleanly with `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false`. These are refactor debt indicators, not release blockers by themselves.
- Quality rule going forward: reduce `any`, TypeScript suppressions, and bare `console.log` inside touched files when local and safe; do not perform a whole-repo cleanup inside one runtime or architecture extraction.
- Architecture status from the latest full check: `npm.cmd run architecture:check` passed with 5 allowlisted migration exceptions and 2 allowlisted legacy bridge exceptions; `npm.cmd run spec:check` passed.
- Version governance status from the previous full check: `npm.cmd run governance:check` passed; version metadata was aligned to `1.4.5`. v1.4.6 version governance is the active gate now.
- Dependency audit status: `npm.cmd run audit:dependencies` passed for both root and `payment-server` production dependency graphs with `found 0 vulnerabilities`.

## Working Tree M86 (Chat Service Unused Cleanup)

- RED evidence from the prior handoff was preserved: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/chat-service-unused-cleanup-contract.test.ts` failed first while `GOOGLE_API_BASE` and `const errorText = await response.text();` were still present.
- Removed only the compiler-proven unused `GOOGLE_API_BASE` import and unread `errorText` local from `src/services/chat/chatService.ts`.
- Added `tests/unit/chat-service-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so those stale service locals do not return.
- Review fix: preserved the existing `await response.text();` call on non-OK responses so body-read rejection behavior remains unchanged while the unread `errorText` binding stays removed. RED evidence for this review fix: the updated contract failed while the body read was absent, then passed after restoring the awaited read.
- Preserved chat storage, saved-message/session behavior, request body construction, URL/header construction through `buildApiUrl` and `buildHeaders`, keyManager success/failure reporting, provider/model routing, and the existing `API 请求失败: ${status}` error semantics.
- Fresh targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/chat-service-unused-cleanup-contract.test.ts` (1/1).
- Fresh noUnused probe: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` still fails on broader repository TS6133/TS619x debt but has zero `src/services/chat/chatService.ts` matches and 53 diagnostics overall.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed `1288/1288`; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` for the M86 paths passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI service cleanup with no JSX/CSS/browser-visible behavior changes.
- Explicitly excluded scope: chat UI, storage persistence redesign, request body changes, keyManager behavior, provider routing, API/settings surfaces, endpoint/auth changes, release metadata, payment business logic, security policy changes, and broad any/console cleanup.

## Completed In `a4032085` (Generation Runtime Contract Test Cleanup)

- RED evidence: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false -p tsconfig.tests.json` reported unused locals in `tests/unit/generation-runtime-contract.test.ts` at the retry video request/result/timing source-slice checks.
- Removed only compiler-proven unused local source slices from `tests/unit/generation-runtime-contract.test.ts`; the production `src/app/useGenerationRuntime.ts` source and runtime behavior were not changed.
- While fixing the cleanup, the targeted contract test caught one over-broad slice restoration; the final patch narrows the two used `retryAttemptsSource` slices to the `runRetryGeneratedMediaAttempts` function body only.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts` passed `51/51`.
- Filtered noUnused validation passed: forcing `tsconfig.tests.json` with noUnused still reports broader historical test-config/type debt, but has zero `tests/unit/generation-runtime-contract.test.ts` matches.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed `1288/1288`; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` for the M87 paths passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a test-only cleanup with no production source, JSX, CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: production generation runtime code, App wiring, billing behavior, retry generation behavior, provider routing, endpoint/auth changes, release metadata, UI/browser behavior, and broad any/console cleanup.

## Completed In `d075e6fd` (Prompt Optimizer Duplicate Tab Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-optimizer-service-source-contract.test.ts` failed while `src/services/llm/promptOptimizerService.ts` still declared `const DEFAULT_TABS:`.
- Removed only the duplicate unused `DEFAULT_TABS` constant from `src/services/llm/promptOptimizerService.ts`; the live `HUMAN_DEFAULT_TABS` constant and `tabs: HUMAN_DEFAULT_TABS,` result payload wiring remain intact.
- Added source-contract assertions in `tests/unit/prompt-optimizer-service-source-contract.test.ts` so the `DEFAULT_TABS` declaration and `tabs: DEFAULT_TABS,` payload wiring do not return, and `HUMAN_DEFAULT_TABS` remains the prompt optimizer tab payload source.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-optimizer-service-source-contract.test.ts` passed 6/6.
- Filtered noUnused validation passed for this slice: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits 2 on 52 broader historical diagnostics, but has zero `src/services/llm/promptOptimizerService.ts` matches.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 100 files); `npm.cmd run test:unit` passed 1288/1288; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI service/source-contract cleanup with no JSX/CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: prompt optimization behavior, automatic route selection, provider routing, Gemini/API settings, endpoint/auth changes, billing/payment behavior, release metadata, UI/browser behavior, storage persistence, keyManager secrets, and broad any/console cleanup.

## Completed In `0cc6c77c` (KK API Client Unused DTO Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/kk-api-client.test.ts` failed while `packages/contracts/src/client/kk-api-client.ts` still imported `AdminRechargeSubmissionDto`.
- Removed only the compiler-proven unused direct `AdminRechargeSubmissionDto` import from `packages/contracts/src/client/kk-api-client.ts`; the public DTO remains exported from `packages/contracts/src/dto/billing.ts` through the package index.
- Added source-contract coverage in `tests/unit/kk-api-client.test.ts` so the public billing DTO export remains present, the client does not regain the unused direct DTO import, and the recharge-submission client methods keep the response DTO types.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/kk-api-client.test.ts` passed 24/24.
- Review-fix validation passed after replacing deep `packages/contracts/src/` string literals in the test with `path.join(...)`: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/kk-api-client.test.ts tests/unit/governance-contract.test.ts` passed 37/37.
- Filtered noUnused validation passed for this slice: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits 2 on 51 broader historical diagnostics, but has zero `packages/contracts/src/client/kk-api-client.ts` matches.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 100 files); `npm.cmd run test:unit` passed 1289/1289; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a contract-client type import cleanup with no JSX/CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: public DTO shape changes, client endpoint path changes, auth/header behavior, payment/billing business logic, provider routing, API/settings UI files, release metadata, storage persistence, and broad any/console cleanup.

## Completed In `63386046` (User API Payload Secret-Constant Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/billing-remaining-balance-contract.test.ts tests/unit/user-api-cloud-storage.test.ts` failed while `src/services/api/userApiPayload.ts` still declared `CLIENT_VISIBLE_SECRET_PLACEHOLDER`.
- Removed only the compiler-proven unused duplicate `CLIENT_VISIBLE_SECRET_PLACEHOLDER` and `REDACTED_SECRET_PREFIX` constants from `src/services/api/userApiPayload.ts`.
- Added source-contract coverage in `tests/unit/billing-remaining-balance-contract.test.ts` so the live placeholder/redaction policy remains in `src/services/api/userApiCloudRecordStorage.ts`, while the payload sanitizer does not regain the unused duplicate constants.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/billing-remaining-balance-contract.test.ts tests/unit/user-api-cloud-storage.test.ts` passed 27/27.
- Filtered noUnused validation passed for this slice: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits 2 on 49 broader historical diagnostics, but has zero `src/services/api/userApiPayload.ts` matches.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 100 files); `npm.cmd run test:unit` passed 1289/1289; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI API payload/source-contract cleanup with no JSX/CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: secret redaction behavior changes, cloud record storage persistence behavior, API/settings UI files, endpoint/auth behavior, billing/payment business logic, provider routing, release metadata, storage migration, and broad any/console cleanup.

## Completed In `651b54c5` (Cost Service Import-Only Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/import-only-unused-cleanup-contract.test.ts` failed while `src/services/billing/costService.ts` still imported `ModelType` and `getRefImageTokenEstimate`.
- Removed only the compiler-proven unused `ModelType` and `getRefImageTokenEstimate` imports from `src/services/billing/costService.ts`.
- Added source-contract coverage in `tests/unit/import-only-unused-cleanup-contract.test.ts` so `costService.ts` keeps the live `ImageSize`, `getModelPricing`, `getImageTokenEstimate`, `calculateCost`, and `resolveImageCost` surface while the stale imports do not return.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/import-only-unused-cleanup-contract.test.ts` passed 1/1.
- Filtered noUnused validation passed for this slice: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits 2 on 47 broader historical diagnostics, but has zero `src/services/billing/costService.ts` matches.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 100 files); `npm.cmd run test:unit` passed 1289/1289; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI import-only service/source-contract cleanup with no JSX/CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: pricing tables, cost calculation formulas, key-slot pricing snapshot lookup, cost recording/sync behavior, provider routing, API/settings UI files, endpoint/auth behavior, storage persistence, release metadata, and broad any/console cleanup.

## Working Tree M92 (Secure Model Proxy Unused-Helper Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/user-route-proxy-routing.test.ts` failed while `src/services/model/secureModelProxy.ts` still declared `async function buildInvocationError(`.
- Removed only the uncalled private `buildInvocationError` helper from `src/services/model/secureModelProxy.ts`.
- Added source-contract coverage in `tests/unit/user-route-proxy-routing.test.ts` so the local system/user-route gate helpers remain present and `buildInvocationError` does not return.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/user-route-proxy-routing.test.ts tests/unit/secure-model-proxy-credit-contract.test.ts tests/unit/secure-model-proxy-trace-contract.test.ts tests/unit/async-image-proxy-regression.test.ts tests/unit/local-model-proxy-trace-contract.test.ts` passed 9/9.
- Filtered noUnused validation passed for this slice: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` still exits 2 on 46 broader historical diagnostics; `src/services/model/secureModelProxy.ts` has only the two expected local route gate diagnostics and no `buildInvocationError` diagnostic.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 100 files); `npm.cmd run test:unit` passed 1289/1289; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI proxy service/source-contract cleanup with no JSX/CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: local/system proxy endpoints, route-gate helper bodies, session/auth invalidation, retry behavior, provider routing, API/settings UI files, billing/payment behavior, keyManager secret storage, storage persistence, release metadata, and broad any/console cleanup.

## Completed In `b9baa445` (PromptBar/ImageCard Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ui-unused-cleanup-contract.test.ts` failed first on the stale `PromptBar` ratio icon helpers and `ImageCard2` lightbox imports/state.
- Removed unused `PromptBar.tsx` imports, stale ratio icon helpers, unused surface constants, unreachable flying-image animation state/JSX, unread hover timer state, unused dropped data extraction, unused current-model surface flag, duplicate unused JSX node islands, and unused destructured props. The model settings modal save button now calls `saveModelCustomization(...)` instead of closing without persisting.
- Removed unused `ImageCard2.tsx` imports, stale lightbox zoom/pan refs/state, and the unused adaptive sub-border calculation.
- Added `tests/unit/ui-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so the removed stale UI code does not return.
- Fresh TS6133 probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `PromptBar.tsx` / `ImageCard2.tsx` matches. The broader repository still has TS6133 debt led by `src/App.tsx` plus other legacy files, so those cleanups remain separate future slices.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-bar-*.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-visual-regression.test.ts tests/unit/ui-unused-cleanup-contract.test.ts` passed 39/39.
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run governance:security`, `npm.cmd run audit:dependencies`, `npm.cmd run spec:check`, `npm.cmd run governance:check`, `npm.cmd run typecheck`, `npm.cmd run test:unit` (1262/1262), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check`.
- Browser QA passed through the Codex in-app Browser against a temporary static server serving `dist` at `http://127.0.0.1:3000/`: title `KK Studio - AI Image Workspace`, workspace/login/prompt signals present, prompt composer text present, and console error count `0`. The project `dev:start` Vite process still exits immediately in this desktop environment, so this browser QA used the already-built production output instead of Vite HMR.
- Explicitly excluded scope: `src/App.tsx`, OpenAI provider routing, API/auth routes, payment/server logic, release metadata, PPT/runtime behavior, and broad any/console cleanup.

## Completed In `b6767e85` (App Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/app-unused-cleanup-contract.test.ts` failed first on stale App imports such as `PendingNode`.
- Removed compiler-proven unused `src/App.tsx` imports, context/hook destructures, the stale `pendingPrompt` state tuple, unused connector/prompt-group/workflow resolver outputs, dormant cut-connection/image-pin callbacks with no live callers, and unused callback parameters.
- Added `tests/unit/app-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so removed App stale symbols do not return.
- Fresh TS6133/TS619x probe at that commit: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` had zero `src/App.tsx` matches. The broader repository still had TS6133/TS619x debt led by `src/services/llm/OpenAICompatibleAdapter.ts`, `src/services/llm/LLMService.ts`, `src/components/layout/ChatSidebar.tsx`, and `src/components/canvas/PromptNodeComponent.tsx`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/app-unused-cleanup-contract.test.ts tests/unit/ecommerce-framework-contract.test.ts tests/unit/ui-unused-cleanup-contract.test.ts` passed 4/4, and the broader App/Canvas/Workflow targeted gate passed 121/121.
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run governance:security`, `npm.cmd run audit:dependencies`, `npm.cmd run spec:check`, `npm.cmd run governance:check`, `npm.cmd run typecheck` (test semantic coverage 81 files), `npm.cmd run test:unit` (1263/1263), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check`.
- Explicitly excluded scope: OpenAI provider routing, keyManager, ChatSidebar, PromptNodeComponent, API/auth routes, release metadata, payment business logic, PPT/runtime behavior, and broad any/console cleanup.

## Completed In `fafecef9` (OpenAI-Compatible Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-unused-cleanup-contract.test.ts` failed first on stale imports such as `AudioGenerationOptions`.
- Removed compiler/source-proven unused `OpenAICompatibleAdapter.ts` imports, renamed the unread `supports` parameter, deleted the private unused `is12AIGateway` helper, deleted the unused static `normalizeUrl` helper, and removed unread chat-image local variables without changing endpoint selection, auth, fetch behavior, fallback ordering, request body routing, UI, or release metadata.
- Added `tests/unit/openai-compatible-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so those stale adapter symbols do not return.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/services/llm/OpenAICompatibleAdapter.ts` matches. The broader repository still has 154 TS6133/TS619x diagnostics led by `src/services/llm/LLMService.ts`, `src/components/layout/ChatSidebar.tsx`, `src/components/canvas/PromptNodeComponent.tsx`, and `src/services/storage/fileSystemService.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-unused-cleanup-contract.test.ts tests/unit/openai-compatible-image-routing-errors-contract.test.ts tests/unit/openai-compatible-diagnostics-contract.test.ts` passed 8/8.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 82 files), `npm.cmd run test:unit` (1264/1264), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check`.
- Explicitly excluded scope: OpenAI provider routing extraction, endpoint/auth changes, fallback-order changes, keyManager, LLMService, ChatSidebar, PromptNodeComponent, API/auth routes, release metadata, payment business logic, PPT/runtime behavior, UI behavior, and broad any/console cleanup.

## Completed In `783fddeb` (LLMService Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/llm-service-unused-cleanup-contract.test.ts` failed first on stale imports such as `ProviderConfig`.
- Removed compiler/source-proven unused `LLMService.ts` imports, stale private direct adapter call helpers, unused adapter fields, and unread public parameters while preserving the existing local user-route proxy first, secure proxy fallback, billing metadata, task status routing, and browser-direct blocking contracts.
- Added `tests/unit/llm-service-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so those stale LLMService symbols do not return.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/services/llm/LLMService.ts` matches. The broader repository still has 140 TS6133/TS619x diagnostics led by `src/components/layout/ChatSidebar.tsx`, `src/components/canvas/PromptNodeComponent.tsx`, `src/services/storage/fileSystemService.ts`, `src/services/llm/geminiService.ts`, `src/components/settings/ApiSettingsView.tsx`, and `src/hooks/useImageGeneration.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/llm-service-unused-cleanup-contract.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/user-route-proxy-routing.test.ts tests/unit/async-image-proxy-regression.test.ts tests/unit/secure-model-proxy-credit-contract.test.ts tests/unit/secure-model-proxy-trace-contract.test.ts` passed 16/16.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 83 files), `npm.cmd run test:unit` (1265/1265), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check`.
- Explicitly excluded scope: proxy route order changes, endpoint/auth changes, fallback behavior changes, keyManager, ChatSidebar, PromptNodeComponent, API/auth routes, release metadata, payment business logic, PPT/runtime behavior, UI behavior, and broad any/console cleanup.

## Completed In `92ee7a4f` (Pure Utility Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/pure-utility-unused-cleanup-contract.test.ts` failed first on stale `promptCardHeight`.
- Removed compiler/source-proven unused layout locals and the now-unused layout helper arguments from `src/app/promptGroupRenderLayout.ts` plus the corresponding `src/App.tsx` call site. Removed unused private helper constants/functions from `src/utils/modelSorting.ts`.
- Added `tests/unit/pure-utility-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so those stale utility symbols do not return.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/app/promptGroupRenderLayout.ts`, `src/utils/modelSorting.ts`, and `src/App.tsx` matches. The broader repository still has 135 TS6133/TS619x diagnostics led by `src/components/layout/ChatSidebar.tsx`, `src/components/canvas/PromptNodeComponent.tsx`, `src/services/storage/fileSystemService.ts`, `src/services/llm/geminiService.ts`, `src/components/settings/ApiSettingsView.tsx`, and `src/hooks/useImageGeneration.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/pure-utility-unused-cleanup-contract.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/ui-unused-cleanup-contract.test.ts` passed 45/45.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 84 files), `npm.cmd run test:unit` (1266/1266), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check` with LF/CRLF normalization warnings only.
- Explicitly excluded scope: prompt-group behavior changes, model sorting behavior changes, ChatSidebar, PromptNodeComponent, file-system persistence behavior, keyManager, provider routing, endpoint/auth changes, release metadata, payment business logic, PPT/runtime behavior, visible UI behavior changes, and broad any/console cleanup.

## Completed In `3108a29f` (ChatSidebar Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/chat-sidebar-unused-cleanup-contract.test.ts` failed first on stale `Eraser`.
- Removed compiler/source-proven unused ChatSidebar icon imports, the unread `viewportHeight` state/update, stale derived session lists, unused drag/source-preview/clear/transform callbacks, and no model-selection, billing, session-tree, provider-routing, or visual redesign behavior.
- Added `tests/unit/chat-sidebar-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so those stale ChatSidebar symbols do not return.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/layout/ChatSidebar.tsx` matches. The broader repository still has 123 TS6133/TS619x diagnostics led by `src/components/canvas/PromptNodeComponent.tsx`, `src/services/storage/fileSystemService.ts`, `src/components/settings/ApiSettingsView.tsx`, `src/services/llm/geminiService.ts`, and `src/hooks/useImageGeneration.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/chat-sidebar-unused-cleanup-contract.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/capability-route-runtime-preference-contract.test.ts tests/unit/kkai-billing-ui-surface.test.ts tests/unit/model-library-public-admin-browse.test.ts tests/unit/model-library-open-guards.test.ts tests/unit/prompt-bar-model-library-loading.test.ts tests/unit/clay-frosted-surface-contract.test.ts` passed 25/25.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 85 files), `npm.cmd run test:unit` (1267/1267), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check` with LF/CRLF normalization warnings only.
- Explicitly excluded scope: model-selection behavior changes, billing behavior changes, session-tree behavior changes, provider routing, endpoint/auth changes, release metadata, payment business logic, PPT/runtime behavior, broad UI redesign, PromptNodeComponent, fileSystemService, keyManager, and broad any/console cleanup.

## Completed In `0efba271` (PromptNode Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-node-unused-cleanup-contract.test.ts` failed first on stale `Pin` / `ChevronRight` imports and unused component locals.
- Removed compiler/source-proven unused PromptNode icon imports, unused destructured props, and write-only error/trace detail state resets. Kept `PromptNodeProps` and the memo comparator fields intact so App/interface compatibility is not narrowed by this cleanup.
- Added `tests/unit/prompt-node-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so those stale PromptNode locals do not return.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/canvas/PromptNodeComponent.tsx` matches. The broader repository still has 112 TS6133/TS619x diagnostics led by `src/services/storage/fileSystemService.ts`, `src/components/settings/ApiSettingsView.tsx`, `src/services/llm/geminiService.ts`, `src/hooks/useImageGeneration.ts`, and `src/services/auth/keyManager.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-node-unused-cleanup-contract.test.ts tests/unit/prompt-node-optimizer-display-contract.test.ts tests/unit/prompt-optimizer-service-source-contract.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-visual-regression.test.ts tests/unit/ppt-deck-single-container-contract.test.ts tests/unit/ecommerce-card-thumbnail-labels.test.ts tests/unit/ecommerce-canvas-contract.test.ts tests/unit/ecommerce-display-label-surface.test.ts` passed 28/28.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 86 files), `npm.cmd run test:unit` (1268/1268), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check` with LF/CRLF normalization warnings only.
- Browser QA passed through the Codex in-app Browser against a clean no-store static server serving the production `dist` at `http://127.0.0.1:3100/?qa=prompt-node-current-filter-1777885534253`: title `KK Studio - AI Image Workspace`, workspace/app signals present, no connection-refused text, no render-error text, and `0` console errors when filtered to `127.0.0.1:3100`. The reused `127.0.0.1:3000` browser context still reports stale old `SettingsPanel-B5I0Hz83.js` chunk errors from old `index-BXDFT_I2.js` / `vendor-BDC5j-FW.js`; current served `dist/index.html` points at the new `index-CMum-9ZQ.js`, so the stale 3000 logs are recorded as browser cache residue rather than a current-build blocker.
- Explicitly excluded scope: PromptNode visual redesign, App prop/interface narrowing, ecommerce/PPT/runtime behavior changes, provider routing, endpoint/auth changes, storage behavior, release metadata, payment business logic, ChatSidebar, keyManager, and broad any/console cleanup.

## Completed In `0797bf95` (SystemLogs Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/system-logs-unused-cleanup-contract.test.ts` failed first on the stale `Activity` import and unused `importantLogs` derived values.
- Removed compiler/source-proven unused `Activity` from `src/components/settings/views/SystemLogsView.tsx` and removed the unused `importantLogs` `useMemo` blocks from both SystemLogs view variants. No log filtering, export, stream, clear, confirmation, notification, or settings routing behavior was changed.
- Added `tests/unit/system-logs-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so those stale SystemLogs locals do not return.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/settings/views/SystemLogsView` matches. The broader repository still has 109 TS6133/TS619x diagnostics led by `src/services/storage/fileSystemService.ts`, `src/hooks/useImageGeneration.ts`, `src/components/settings/ApiSettingsView.tsx`, `src/services/llm/geminiService.ts`, and `src/services/auth/keyManager.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/system-logs-unused-cleanup-contract.test.ts tests/unit/settings-workbench-ui-refit.test.ts tests/unit/settings-canonical-entry-regression.test.ts` passed 15/15.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 87 files), `npm.cmd run test:unit` (1269/1269), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited alternate-git `diff --check` with LF/CRLF normalization warnings only.
- Browser QA passed through the Codex in-app Browser against a clean no-store static server serving the production `dist` at `http://127.0.0.1:3101/?qa=system-logs-cleanup-1777887594776`: title `KK Studio - AI Image Workspace`, workspace/app signals present, no connection-refused text, no render-error text, and `0` console errors when filtered to `127.0.0.1:3101`.
- Explicitly excluded scope: SystemLogs visual redesign, destructive log action changes, settings routing changes, storage behavior, keyManager secret storage, provider routing, proxy/billing routes, endpoint/auth changes, release metadata, payment business logic, PPT/runtime behavior, and broad any/console cleanup.

## Completed In `f453cd9a` (AchievementToast Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/onboarding-unused-cleanup-contract.test.ts` failed first on the stale `Star` import in `src/components/Onboarding/AchievementToast.tsx`.
- Removed compiler/source-proven unused `Star` from `src/components/Onboarding/AchievementToast.tsx`. No onboarding behavior, timing, visibility, or close handling changed.
- Added `tests/unit/onboarding-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so that stale import does not return.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/Onboarding/AchievementToast.tsx` matches. The broader repository still has 108 TS6133/TS619x diagnostics led by `src/services/storage/fileSystemService.ts`, `src/hooks/useImageGeneration.ts`, `src/components/settings/ApiSettingsView.tsx`, `src/services/llm/geminiService.ts`, and `src/services/auth/keyManager.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/onboarding-unused-cleanup-contract.test.ts` passed 1/1.
- Browser QA passed through the Codex in-app Browser against a no-store Node static server serving the production `dist` at `http://127.0.0.1:3102/?qa=onboarding-unused-cleanup-1777890000000`: title `KK Studio - AI Image Workspace`, login screen DOM visible, no connection-refused text, no render-error text, and `0` console errors when filtered to `127.0.0.1:3102`. The achievement toast was not directly visible on the default unauthenticated route because it requires completing onboarding tasks; this slice only removes an unused import and does not change toast JSX, timing, or visibility logic.
- Explicitly excluded scope: onboarding redesign, animation changes, toast timing changes, task panel cleanup, storage behavior, keyManager secret storage, provider routing, proxy/billing routes, and destructive log actions.

## Completed In `e661630e` (Onboarding Residual Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/onboarding-unused-cleanup-contract.test.ts` failed first on compiler-proven residual Onboarding unused symbols after the `AchievementToast` import cleanup had already passed.
- Removed compiler/source-proven unused `OnboardingProgress` import, `updateProgress` destructure, no-op `task` callback parameter, `ChevronLeft` and `Keyboard` imports, and the unread `getTasksByPhase` parameter. No onboarding task state, overlay progression, skip behavior, reward display, storage key, or timing behavior changed.
- Extended `tests/unit/onboarding-unused-cleanup-contract.test.ts` so those residual stale symbols do not return.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/Onboarding` matches. The broader repository still has 102 TS6133/TS619x diagnostics led by non-Onboarding hotspots.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/onboarding-unused-cleanup-contract.test.ts` passed 2/2.
- Browser QA: blocked because the Codex in-app Browser automation timed out twice while initializing the browser debug channel before navigation. Fallback HTTP smoke of the built `dist` at `http://127.0.0.1:3102/?qa=onboarding-residual-cleanup-1777891200000` returned status 200 with title `KK Studio - AI Image Workspace`; this is not a substitute for pixel-level browser QA.
- Explicitly excluded scope: onboarding redesign, overlay flow changes, task panel behavior changes, progress storage behavior, storage/auth/proxy/billing files, provider routing, endpoint/auth changes, and broad any/console cleanup.

## Completed In `05394f83` (Pure Image Orphan Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/pure-utility-unused-cleanup-contract.test.ts` failed first because `src/services/image/imageCompression.ts` still existed.
- Deleted the unreferenced `src/services/image/imageCompression.ts` module after source/import proof. No production source imports `imageCompression`, and this slice did not touch `src/services/storage/imageStorage.ts`, `src/services/storage/fileSystemService.ts`, or their storage-owned compression helpers.
- Extended `tests/unit/pure-utility-unused-cleanup-contract.test.ts` so the removed module and import paths do not return.
- Fresh source/noUnused probes: `rg -n "imageCompression" src -S` returned no matches; `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/services/image/imageCompression` matches. The broader repository still has 101 TS6133/TS619x diagnostics led by non-imageCompression hotspots.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/pure-utility-unused-cleanup-contract.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/ui-unused-cleanup-contract.test.ts` passed 46/46.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1272/1272; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI orphan module deletion with no live production imports and no browser-visible behavior path.
- Explicitly excluded scope: storage compression behavior, image storage persistence, file-system storage, LOD/image loader behavior, provider routing, keyManager secret storage, proxy/billing routes, endpoint/auth changes, and broad any/console cleanup.

## Completed In `eeb377d5` (Dormant Pixi Canvas Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-dormant-unused-cleanup-contract.test.ts` failed first because `src/components/canvas/PixiCanvas.tsx` still existed.
- Deleted the unreferenced `src/components/canvas/PixiCanvas.tsx` dormant renderer after source/import proof. No production source imports `PixiCanvas`, `preloadPixi`, or `isPixiAvailable`, and this slice did not touch live `src/components/canvas/InfiniteCanvas.tsx`.
- Added `tests/unit/canvas-dormant-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so the removed dormant renderer and entrypoints do not return.
- Fresh source/noUnused probes: the Pixi source-reference guard returned no matches; `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/canvas/PixiCanvas` matches. The broader repository still has 95 TS6133/TS619x diagnostics led by non-Pixi hotspots.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-dormant-unused-cleanup-contract.test.ts` passed 1/1.
- Full validation passed: `npm.cmd run typecheck` with 89 semantically checked test files; `npm.cmd run test:unit` passed 1273/1273; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a dormant module deletion with no live production imports and no browser-visible behavior path.
- Explicitly excluded scope: live `InfiniteCanvas.tsx`, canvas transform behavior, prompt/image drag behavior, storage persistence, provider routing, keyManager secret storage, proxy/billing routes, endpoint/auth changes, and broad any/console cleanup.

## Completed In `9ce70e96` (Dormant Canvas Residual Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-dormant-unused-cleanup-contract.test.ts` failed first because `src/components/canvas/Canvas.tsx` still destructured unused `onAutoArrange`.
- Removed compiler-proven unused `onAutoArrange`, `isMobile`, and `sourcePosition` destructured values while preserving their props interface fields for compatibility; changed the unread `idleTime` state value to an elided tuple binding while preserving the timeout state setter.
- Extended `tests/unit/canvas-dormant-unused-cleanup-contract.test.ts` so those stale destructures do not return while the public optional prop fields remain.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` had zero `src/components/canvas/Canvas` and `src/components/canvas/PendingNode` matches. The broader repository still had 91 TS6133 diagnostics plus 4 TS619x diagnostics led by non-canvas-residual hotspots.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-dormant-unused-cleanup-contract.test.ts tests/unit/clay-frosted-surface-contract.test.ts` passed 9/9.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1274/1274; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a visual-no-op source cleanup in dormant support files; `PendingNode` frosted-surface contract passed and live `InfiniteCanvas.tsx` was not changed.
- Explicitly excluded scope: live `InfiniteCanvas.tsx`, canvas transform behavior, prompt/image drag behavior, removing `PendingNode` itself, storage persistence, provider routing, keyManager secret storage, proxy/billing routes, endpoint/auth changes, and broad any/console cleanup.

## Completed In `58161f20` (Legacy Dashboard Unused-Icon Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ui-unused-cleanup-contract.test.ts` failed first because legacy plain `DashboardView.tsx` still imported unused `AlertTriangle`, `ShieldCheck`, and `Wallet` icons.
- Removed only those compiler-proven unused icon imports from `src/components/settings/views/DashboardView.tsx`. The live localized dashboard route, dashboard JSX, billing remaining-balance logic, storage refresh logic, and settings routing remain untouched.
- Extended `tests/unit/ui-unused-cleanup-contract.test.ts` so the stale plain-dashboard icon imports do not return while `DashboardView.localized.tsx` continues to retain its live `Wallet` usage.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/settings/views/DashboardView.tsx` matches. The broader repository still has 88 TS6133 diagnostics plus 4 TS619x diagnostics led by `fileSystemService.ts`, `useImageGeneration.ts`, `ApiSettingsView.tsx`, `geminiService.ts`, and `keyManager.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ui-unused-cleanup-contract.test.ts tests/unit/dashboard-settings-overview-regression.test.ts tests/unit/dashboard-settings-legacy-pruning.test.ts tests/unit/billing-remaining-balance-contract.test.ts` passed 10/10.
- Full validation passed: `npm.cmd run architecture:check`; `npm.cmd run governance:security`; `npm.cmd run audit:dependencies`; `npm.cmd run spec:check`; `npm.cmd run governance:check`; `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1275/1275; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is an import-only cleanup in the legacy plain dashboard file; the live settings route imports `DashboardView.localized.tsx`, and the localized dashboard/billing source contracts passed.
- Explicitly excluded scope: live `DashboardView.localized.tsx`, settings routing, dashboard layout/visual redesign, billing behavior, storage behavior, provider routing, keyManager secret storage, proxy/billing routes, endpoint/auth changes, release metadata, and broad any/console cleanup.

## Completed In `7d2c2584` (File-System Compatibility Stub Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/filesystem-tag-shortcut-compat-contract.test.ts` failed first because the tag/settings compatibility stubs still used the unused `handle` and `isVideo` parameter names.
- Renamed only unused no-op stub parameters in `src/services/storage/fileSystemService.ts` to `_handle` and `_isVideo`; kept public methods, parameter order, App call sites, tag/settings no-op behavior, and `loadSettings` returning `null`.
- Added `tests/unit/filesystem-tag-shortcut-compat-contract.test.ts` and registered it in `tsconfig.tests.json` so these stubs remain no-op and noUnused-clean while App keeps the existing public call signature.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/services/storage/fileSystemService.ts` matches. The broader repository still has 78 TS6133 diagnostics plus 4 TS619x diagnostics led by `ApiSettingsView.tsx`, `geminiService.ts`, `useImageGeneration.ts`, `keyManager.ts`, `GoogleAdapter.ts`, and `ProjectManager.tsx`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/filesystem-tag-shortcut-compat-contract.test.ts tests/unit/canvas-filesystem-persistence-scope.test.ts tests/unit/filesystem-startup-consolidation-deferral.test.ts` passed 4/4.
- Full validation passed: `npm.cmd run architecture:check`; `npm.cmd run governance:security`; `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1277/1277; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a non-UI parameter-name cleanup in no-op storage compatibility stubs with source contracts covering no new tag/settings file-system side effects.
- Explicitly excluded scope: real file-system persistence, tag shortcut implementation, settings file writing, storage migration, image/video persistence, storage adapters, keyManager secret storage, provider routing, proxy/billing routes, endpoint/auth changes, release metadata, and broad any/console cleanup.

## Completed In `5dac56e8` (Import-Only Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/import-only-unused-cleanup-contract.test.ts` failed first because `GlobalLightbox.tsx` still imported unused `NormalizedRect`.
- Removed only import/type-list unused symbols: `NormalizedRect` from `GlobalLightbox.tsx`, `ImageQuality` from `useImageQuality.ts`, and `ModelType` / `ImageSize` from `modelRegistry.ts`; converted the remaining `Provider` import to `import type`.
- Added `tests/unit/import-only-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so these cleanup boundaries remain import-only while exports and key behavior contracts stay present.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/image/GlobalLightbox.tsx`, `src/hooks/useImageQuality.ts`, and `src/services/model/modelRegistry.ts` matches. The broader repository still has 74 TS6133 diagnostics plus 4 TS619x diagnostics led by `useImageGeneration.ts`, `geminiService.ts`, `ApiSettingsView.tsx`, `keyManager.ts`, `GoogleAdapter.ts`, and `ProjectManager.tsx`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/import-only-unused-cleanup-contract.test.ts tests/unit/partial-redraw-lightbox-contract.test.ts tests/unit/responsive-surface.test.ts tests/unit/google-official-gemini-protocol-guards.test.ts` passed 14/14.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1278/1278; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is an import-only cleanup with no JSX, hook logic, registry data, provider routing, or visible UI changes.
- Explicitly excluded scope: lightbox behavior, partial redraw behavior, image quality selection behavior, model registry data, provider routing, keyManager, billing, storage persistence, endpoint/auth changes, release metadata, and broad any/console cleanup.

## Completed In `bdb082d7` (Live Canvas Residual Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-live-unused-cleanup-contract.test.ts` failed first because live `InfiniteCanvas.tsx` still destructured unused `onAutoArrange`.
- Removed only unused `onAutoArrange` and `id` destructured values from `src/components/canvas/InfiniteCanvas.tsx`; kept `InfiniteCanvasProps` optional fields, callback wiring, drag/drop, transform, zoom, and JSX behavior intact.
- Added `tests/unit/canvas-live-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so public props remain while stale destructures do not return.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/canvas/InfiniteCanvas.tsx` matches. The broader repository still has 72 TS6133 diagnostics plus 4 TS619x diagnostics led by `useImageGeneration.ts`, `geminiService.ts`, `ApiSettingsView.tsx`, `keyManager.ts`, `ProjectManager.tsx`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-live-unused-cleanup-contract.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-visual-regression.test.ts tests/unit/ecommerce-wheel-scroll-guard.test.ts` passed 17/17.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1279/1279; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a no-op destructure cleanup with public props preserved; canvas live/visual source contracts passed and no JSX/CSS changed.
- Explicitly excluded scope: canvas transform behavior, drag/drop behavior, zoom behavior, canvas visual redesign, App wiring, storage persistence, provider routing, keyManager, billing, endpoint/auth changes, release metadata, and broad any/console cleanup.

## Completed In `e714380b` (Workflow Actions Import Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/workflow-actions-unused-cleanup-contract.test.ts` failed first because `src/app/useWorkflowActions.ts` still imported `WORKFLOW_TEMPLATES`.
- Removed only the unused `WORKFLOW_TEMPLATES` import from `src/app/useWorkflowActions.ts`; kept `WorkflowTemplateId`, `createAgentWorkflowNode`, `createPreviewWorkflowNode`, `createSaveWorkflowNode`, and the `App.tsx` `workflowTemplates={WORKFLOW_TEMPLATES}` UI ownership intact.
- Added `tests/unit/workflow-actions-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so the hook cannot re-import the template list while App and `workflowTemplates.ts` keep list ownership.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/app/useWorkflowActions.ts` matches. The broader repository still has 71 TS6133 diagnostics plus 4 TS619x diagnostics led by `useImageGeneration.ts`, `geminiService.ts`, `ApiSettingsView.tsx`, `keyManager.ts`, `ProjectManager.tsx`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/workflow-actions-unused-cleanup-contract.test.ts tests/unit/canvas-workflow-updates-contract.test.ts tests/unit/canvas-workflow-source-node-ids-contract.test.ts tests/unit/workflow-document-domain.test.ts` passed 10/10.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1280/1280; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is an import-only runtime hook cleanup with no JSX, CSS, workflow template definitions, or visible UI changes.
- Explicitly excluded scope: workflow template behavior, template list content, ProjectManager prop usage cleanup, workflow card factories, App workflow wiring beyond source ownership proof, storage persistence, provider routing, keyManager, billing, endpoint/auth changes, release metadata, and broad any/console cleanup.

## Completed In `57e8c05b` (Common ErrorBoundary Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/startup-error-localization.test.ts` failed first because `src/components/common/ErrorBoundary.tsx` still declared `localizeBoundaryErrorText(language, ...)`.
- Renamed only the unread `language` parameter to `_language`; kept the helper call shape, `localizeUserFacingText(value) || value`, frosted error UI, reload button, and `getBoundaryLanguage` document sync unchanged.
- Extended `tests/unit/startup-error-localization.test.ts` and registered it in `tsconfig.tests.json` so the stale parameter name does not return while the captured-error localization contract remains.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` has zero `src/components/common/ErrorBoundary.tsx` matches. The broader repository still has 70 TS6133 diagnostics plus 4 TS619x diagnostics led by `useImageGeneration.ts`, `geminiService.ts`, `ApiSettingsView.tsx`, `keyManager.ts`, `ProjectManager.tsx`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/startup-error-localization.test.ts tests/unit/app-startup-screen-localization.test.ts tests/unit/clay-frosted-surface-contract.test.ts` passed 10/10.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1280/1280; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a parameter-name-only source cleanup with no JSX/CSS/error behavior change; localization and frosted-surface contracts passed.
- Explicitly excluded scope: error UI redesign, error text changes, startup error behavior, global error handling, browser QA claims, storage persistence, provider routing, keyManager, billing, endpoint/auth changes, release metadata, and broad any/console cleanup.

## Completed In `d4291729` (Generation Runtime Import Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts` failed first because `src/app/useGenerationRuntime.ts` still imported `resolveModelDisplayName` from `../utils/modelDisplayName`.
- Removed only the unused `resolveModelDisplayName` import from `src/app/useGenerationRuntime.ts`; kept `UseGenerationRuntimeDeps.resolveModelDisplayName`, retry/generation model label calls, dependency destructuring, and App-side injection ownership intact.
- Extended `tests/unit/generation-runtime-contract.test.ts` so the runtime cannot re-import the display-name helper while the public deps boundary and `params.resolveModelDisplayName(...)` usage remain covered.
- Line counts after cleanup: `src/app/useGenerationRuntime.ts` moved from 2604 to 2603 physical lines; `tests/unit/generation-runtime-contract.test.ts` is 1696 physical lines after adding the source contract.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` has zero `src/app/useGenerationRuntime.ts` matches. The broader repository now has 69 TS6133 diagnostics plus 4 TS619x diagnostics led by `ApiSettingsView.tsx`, `useImageGeneration.ts`, `geminiService.ts`, `keyManager.ts`, `ProjectManager.tsx`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts` passed 51/51, and `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-billing-runtime-contract.test.ts` passed 2/2.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1281/1281; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is an import-only runtime hook cleanup with no JSX, CSS, route rendering, or visible UI changes.
- Explicitly excluded scope: generation behavior changes, retry billing/model-label behavior changes, App runtime wiring changes, provider routing, endpoint/auth changes, release metadata, payment business logic, PPT behavior, UI behavior, storage persistence, keyManager, and broad any/console cleanup.

## Completed In `c29effe5` (CanvasContext Type Import Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts` failed first because `src/context/CanvasContext.tsx` still imported `type CanvasContextType` and `type SubCardLayout` from `./canvasContextState`.
- Removed only the unused `CanvasContextType` and `SubCardLayout` type imports from the `canvasContextState` import block; kept `CanvasState`, `ArrangeMode`, runtime context imports, and `export type { ArrangeMode, CanvasContextType, CanvasState, SubCardLayout } from './canvasContextState';` intact.
- Extended `tests/unit/canvas-context-unused-cleanup.test.ts` so the stale type imports cannot return while the public type re-export compatibility boundary remains covered.
- Line counts after cleanup: `src/context/CanvasContext.tsx` moved from 2518 to 2516 physical lines; `tests/unit/canvas-context-unused-cleanup.test.ts` is 41 physical lines after adding the source contract.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` has zero `src/context/CanvasContext.tsx` matches. The broader repository now has 67 TS6133 diagnostics plus 4 TS619x diagnostics led by `ApiSettingsView.tsx`, `useImageGeneration.ts`, `geminiService.ts`, `keyManager.ts`, `ProjectManager.tsx`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts` passed 1/1, and `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-state-boundary.test.ts` passed 1/1.
- Full validation passed: `npm.cmd run architecture:check`; `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1281/1281; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a type-import-only cleanup with no JSX, CSS, route rendering, persistence, hydration, cloud sync, local folder, or browser-visible behavior changes.
- Explicitly excluded scope: Canvas persistence, hydration, cloud sync, local folder refresh/connect logic, storage behavior, node mutation behavior, drag/selection behavior, UI behavior, provider routing, endpoint/auth changes, release metadata, payment business logic, keyManager, and broad any/console cleanup.

## Completed In `c4526e6b` (ProjectManager Prop Destructure Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/project-manager-unused-cleanup-contract.test.ts` failed first because `src/components/settings/ProjectManager.tsx` still destructured the four mobile prompt optimization props.
- Removed only `mobilePromptOptimizationEnabled`, `mobilePromptOptimizationSupported`, `onToggleMobilePromptOptimization`, and `onOpenMobilePromptLibrary` from the component destructuring list; kept the `ProjectManagerProps` declarations for compatibility and did not change JSX or controls.
- Added `tests/unit/project-manager-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json` so the public props remain declared but are not destructured unless they become live again.
- Line counts after cleanup: `src/components/settings/ProjectManager.tsx` is 840 physical lines; `tests/unit/project-manager-unused-cleanup-contract.test.ts` is 36 physical lines; `tsconfig.tests.json` is 124 physical lines after registering the test.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` has zero `src/components/settings/ProjectManager.tsx` matches. The broader repository now has 63 TS6133 diagnostics plus 4 TS619x diagnostics led by `ApiSettingsView.tsx`, `useImageGeneration.ts`, `geminiService.ts`, `keyManager.ts`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/project-manager-unused-cleanup-contract.test.ts` passed 1/1, and `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/clay-frosted-surface-contract.test.ts tests/unit/theme-system-adaptation.test.ts tests/unit/workspace-layout-contract.test.ts` passed 12/12.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1282/1282; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a destructure-only cleanup with no JSX, CSS, route rendering, dropdown/control behavior, workflow UI, or browser-visible behavior changes.
- Explicitly excluded scope: ProjectManager JSX/control behavior, visual styling, dropdown behavior, workflow UI, canvas operations, provider routing, endpoint/auth changes, release metadata, payment business logic, PPT behavior, storage behavior, keyManager, and broad any/console cleanup.

## Completed In `d8845775` (Ecommerce Task Merger Parameter Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-task-services.test.ts` failed first because `buildTemplateCopySeed` still named its unused template parameter `seriesTemplate`.
- Renamed only the private unused `buildTemplateCopySeed` parameter to `_seriesTemplate`; kept the call `buildTemplateCopySeed(input.baseTask.copy, input.seriesTemplate)`, copy seed shape, sparse intent patching, copy resolution, style/layout/inherit precedence, and consistency checks unchanged.
- Extended `tests/unit/ecommerce-task-services.test.ts` with a source contract that keeps the parameter marked unused while preserving the compatibility call.
- Line counts after cleanup: `src/services/ecommerce/taskMerger.ts` is 164 physical lines; `tests/unit/ecommerce-task-services.test.ts` is 424 physical lines after adding the source contract.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` has zero `src/services/ecommerce/taskMerger.ts` matches. The broader repository now has 62 TS6133 diagnostics plus 4 TS619x diagnostics led by `ApiSettingsView.tsx`, `useImageGeneration.ts`, `geminiService.ts`, `keyManager.ts`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-task-services.test.ts` passed 10/10, and `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-node-generation-runtime-contract.test.ts tests/unit/ecommerce-structured-task-source-contract.test.ts` passed 2/2.
- Full validation passed: `npm.cmd run typecheck`; `npm.cmd run test:unit` passed 1283/1283; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a private service parameter-name cleanup with no JSX, CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: sparse intent parsing changes, copy resolution changes, style/layout/inherit precedence changes, render task generation changes, ecommerce runtime wiring, UI behavior, provider routing, endpoint/auth changes, release metadata, payment business logic, storage behavior, keyManager, and broad any/console cleanup.

## Completed In `37540efc` (Model Display Name Provider Parameter Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/model-display-name-regression.test.ts` first failed because `getModelDisplayName` still exposed the unused third parameter as `provider` instead of `_provider`; an earlier direct service import approach was rejected because Node ESM hit the existing `src/types` directory import boundary before the intended assertion.
- Restored the pre-existing model display-name regression tests in `tests/unit/model-display-name-regression.test.ts` and appended the new source contract, avoiding loss of existing Nano Banana normalization coverage.
- Renamed only `getModelDisplayName(modelId, customLabel, provider)` to `getModelDisplayName(modelId, customLabel, _provider)` in `src/services/model/modelCapabilities.ts`; third-argument compatibility, custom-label precedence, global/admin model lookup, keyManager behavior, and model-list bootstrapping remain unchanged.
- Registered `tests/unit/model-display-name-regression.test.ts` in `tsconfig.tests.json`.
- Line counts after cleanup: `src/services/model/modelCapabilities.ts` is 1806 physical lines; `tests/unit/model-display-name-regression.test.ts` is 76 physical lines; `tsconfig.tests.json` is 125 physical lines.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` has zero `src/services/model/modelCapabilities.ts` matches. The broader repository now has 61 TS6133 diagnostics plus 4 TS619x diagnostics led by `ApiSettingsView.tsx`, `useImageGeneration.ts`, `geminiService.ts`, `keyManager.ts`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/model-display-name-regression.test.ts tests/unit/model-library-bootstrap-regression.test.ts` passed 8/8.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 96 files); `npm.cmd run test:unit` passed 1284/1284; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a service/test/docs cleanup with no JSX, CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: model/provider routing behavior changes, admin model lookup behavior changes, model-list bootstrapping behavior changes, keyManager, API/settings UI files, endpoint/auth changes, release metadata, payment business logic, PPT behavior, storage behavior, and broad any/console cleanup.

## Completed In `324b42a6` (Video Service Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/video-service-unused-cleanup-contract.test.ts` failed first because `mapAspectRatioToSize` still exposed the unused `model` parameter instead of `_model`; the same source contract also guards the Veo unused import removal and the `executeVideoGeneration` `modeLabel` parameter cleanup.
- Renamed only `mapAspectRatioToSize`'s unused second parameter to `_model` in `src/services/video/OpenAIVideoService.ts`, preserving public arity and aspect-ratio mapping behavior.
- Removed the unused `buildApiUrl` / `buildHeaders` import from `src/services/video/VeoVideoService.ts`, preserving the existing explicit URL/header construction in that service.
- Stopped passing `modeLabel` into the private `executeVideoGeneration` helper in `src/services/video/videoService.ts`; kept the local `modeLabel` progress label in `generateVideo`, request body construction, base URL normalization, polling, download/auth headers, and returned mode unchanged.
- Added `tests/unit/video-service-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json`.
- Line counts after cleanup: `src/services/video/OpenAIVideoService.ts` is 46 physical lines; `src/services/video/VeoVideoService.ts` is 199 physical lines; `src/services/video/videoService.ts` is 394 physical lines; `tests/unit/video-service-unused-cleanup-contract.test.ts` is 31 physical lines; `tsconfig.tests.json` is 126 physical lines.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` has zero `src/services/video` matches. The broader repository now has 59 TS6133 diagnostics plus 3 TS619x diagnostics led by `ApiSettingsView.tsx`, `useImageGeneration.ts`, `geminiService.ts`, `keyManager.ts`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/video-service-unused-cleanup-contract.test.ts tests/unit/frontend-key-boundary-hardening.test.ts` passed 8/8.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 97 files); `npm.cmd run test:unit` passed 1285/1285; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a service/test/docs cleanup with no JSX, CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: video request construction changes, API base normalization changes, progress label content changes, polling changes, download/auth header changes, returned result shape changes, provider routing, model routing, API/settings UI files, endpoint/auth changes, release metadata, payment business logic, PPT behavior, storage behavior, and broad any/console cleanup.

## Completed In `b31edef5` (Image Service Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/image-service-unused-cleanup-contract.test.ts` failed first because `imagePriorityLoader.ts` still imported `isElementInViewport` and retained an unread `intervalId` handle; the same source contract also guards the stale LOD quality mapping cleanup.
- Removed the unused `isElementInViewport` import and unread `intervalId` field/assignment from `src/services/image/imagePriorityLoader.ts`; kept the 200ms priority loop, queue sorting by `distanceFromViewportCenter`, concurrency limit, cancellation, and task execution behavior unchanged.
- Removed unused `QUALITY_CONFIGS`, the private `lodToQuality` helper, and the unread `quality` local from `src/services/image/lodService.ts`; kept LOD thresholds, quality ID selection, storage lookup order, blob URL registration/release, fallback URL behavior, and cache mutation unchanged.
- Added `tests/unit/image-service-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json`.
- Line counts after cleanup: `src/services/image/imagePriorityLoader.ts` is 91 physical lines; `src/services/image/lodService.ts` is 258 physical lines; `tests/unit/image-service-unused-cleanup-contract.test.ts` is 26 physical lines; `tsconfig.tests.json` is 127 physical lines.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` has zero `src/services/image/imagePriorityLoader.ts` and zero `src/services/image/lodService.ts` matches. The broader repository now has 55 TS6133 diagnostics plus 3 TS619x diagnostics led by `ApiSettingsView.tsx`, `useImageGeneration.ts`, `geminiService.ts`, `keyManager.ts`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/image-service-unused-cleanup-contract.test.ts` passed 1/1.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 98 files); `npm.cmd run test:unit` passed 1286/1286; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a service/test/docs cleanup with no JSX, CSS, route rendering, or browser-visible image rendering changes.
- Explicitly excluded scope: queue ordering changes, task execution changes, lazy-image behavior changes, LOD threshold changes, storage lookup order changes, cache mutation changes, memory-manager behavior changes, fallback URL behavior changes, UI image rendering, provider routing, endpoint/auth changes, release metadata, payment business logic, storage persistence policy, and broad any/console cleanup.

## Completed In `56ffe696` (Small LLM Adapter Unused Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/llm-adapter-unused-cleanup-contract.test.ts` failed first because `AudioCompatibleAdapter.ts` still imported `getAudioCapability` / `isAudioModel` and assigned unread `audioCaps`; the same source contract also guards the `VolcengineAdapter.supports` unused parameter rename.
- Removed unused `getAudioCapability` and `isAudioModel` imports plus the unread `audioCaps` local from `src/services/llm/AudioCompatibleAdapter.ts`; kept `getMaxAudioDuration`, lyrics/style/continuation/TTS fields, request body construction, polling, and error handling unchanged.
- Renamed only `VolcengineAdapter.supports(modelId)` to `supports(_modelId)` in `src/services/llm/VolcengineAdapter.ts`, preserving the permissive support behavior.
- Added `tests/unit/llm-adapter-unused-cleanup-contract.test.ts` and registered it in `tsconfig.tests.json`.
- Line counts after cleanup: `src/services/llm/AudioCompatibleAdapter.ts` is 262 physical lines; `src/services/llm/VolcengineAdapter.ts` is 87 physical lines; `tests/unit/llm-adapter-unused-cleanup-contract.test.ts` is 25 physical lines; `tsconfig.tests.json` is 128 physical lines.
- Fresh TS6133/TS619x probe: `npx.cmd tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` has zero `src/services/llm/AudioCompatibleAdapter.ts` and zero `src/services/llm/VolcengineAdapter.ts` matches. The broader repository now has 52 TS6133 diagnostics plus 3 TS619x diagnostics led by `ApiSettingsView.tsx`, `useImageGeneration.ts`, `geminiService.ts`, `keyManager.ts`, and `GoogleAdapter.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/llm-adapter-unused-cleanup-contract.test.ts` passed 1/1.
- Full validation passed: `npm.cmd run typecheck` (test semantic coverage 99 files); `npm.cmd run test:unit` passed 1287/1287; `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`; and path-limited alternate-git `diff --check` passed with LF/CRLF normalization warnings only.
- Browser QA skipped: this is a service/test/docs cleanup with no JSX, CSS, route rendering, or browser-visible behavior changes.
- Explicitly excluded scope: audio request body changes, duration limiting changes, lyrics/style/continuation/TTS field changes, polling changes, Volcengine endpoint selection changes, auth header changes, provider routing, model routing, API/settings UI files, endpoint/auth changes, release metadata, payment business logic, and broad any/console cleanup.

## Finalization Audit Plan

1. Close the current user API payload unused secret-constant cleanup slice first; do not claim final completion while additional Stage Two seams and remaining TS6133/TS619x hotspots remain open.
2. Run high-confidence local audits for unused code, TypeScript debt, bare debug logging, TODO/FIXME markers, sensitive storage/logging, dependency audits for root and `payment-server`, architecture boundaries, specs, build, unit tests, and UI contract coverage.
3. Fix only narrow blockers found by the audits. Broad debt counts are tracked but are not safe to delete in one batch.
4. If packaging/publish metadata changes again, rerun `npm.cmd run package:portable`, `npm.cmd run publish:portable`, and `npm.cmd run governance:check` before final release sign-off.
5. Final completion can only be claimed after the release gate and UI/browser checks required by touched surfaces pass.

## Completed In `58be183d` (Dependency-Security Slice)

- Fixed the separate `payment-server` dependency audit gap by overriding transitive `@hono/node-server` to `^1.19.14` and `hono` to `^4.12.16`; the payment lockfile now resolves `@hono/node-server 1.19.14` and `hono 4.12.16`.
- Added root script `npm.cmd run audit:dependencies` to audit both the root lockfile and `payment-server`, and inserted it into `npm.cmd run verify:changes`.
- Updated `implement.md`, `validation.md`, and `plans.md` so dependency-security and final release gates include the sidecar audit.
- Validation passed before commit: `npm.cmd run audit:dependencies` reported `found 0 vulnerabilities` for both lockfiles; `npm.cmd run typecheck:payment-server` passed syntax checks for 3 files; `npm.cmd run governance:agent-docs` passed; `npm.cmd run check:encoding` passed.
- Full gate passed after the script change: `npm.cmd run verify:changes` passed architecture, governance, dependency audit, typecheck, spec, build, unit/integration/contract/e2e tests, prompt-group drag smoke, mobile settings smoke, desktop settings smoke, startup banner smoke, and encoding.
- Browser smoke status: all four smoke scripts used fallback mode because local headless Chromium launch is blocked by `spawn EPERM`; route checks and source contracts passed, but pixel-level browser rendering is still not proven by this gate.
- Browser QA for this slice: skipped because only dependency metadata, scripts, and ledger files changed; no UI, CSS, route component, or browser-visible behavior changed.

## Completed In `0edb13f5` (OpenAI-Compatible Diagnostics Extraction)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-diagnostics-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` because `src/services/llm/openAICompatibleDiagnostics.ts` did not exist.
- Extracted safe JSON request body and multipart `FormData` preview redaction into `src/services/llm/openAICompatibleDiagnostics.ts`; `OpenAICompatibleAdapter.ts` now imports `buildSafeRequestBodyPreview` and `buildSafeFormDataPreview` instead of owning private methods.
- The new helper keeps existing JSON redaction behavior for nested sensitive keys, data URIs, long URLs, long base64 strings, and long strings; multipart previews now also redact secret-like field names such as `apiKey` while keeping file metadata.
- Added `tests/unit/openai-compatible-diagnostics-contract.test.ts` and registered it in `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 78 test files.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` 4451 physical lines, `src/services/llm/openAICompatibleDiagnostics.ts` 86 physical lines, `tests/unit/openai-compatible-diagnostics-contract.test.ts` 64 physical lines, `tsconfig.tests.json` 107 physical lines.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-diagnostics-contract.test.ts` passed (3/3).
- Provider/security targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-diagnostics-contract.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/provider-surface-router.test.ts tests/unit/provider-strategy.test.ts tests/unit/async-image-proxy-regression.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/governance-contract.test.ts` passed (61/61).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run governance:security`.
- Passed: `npm.cmd run audit:dependencies` with both root and `payment-server` audits reporting `found 0 vulnerabilities`.
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1255/1255).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Browser QA: skipped because this is a non-UI diagnostics/helper extraction and no visual surface, CSS, route component, or browser-visible behavior changed.

## Completed In `8f878b3a` (OpenAI-Compatible Image Routing Error Classifier Extraction)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-routing-errors-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` because `src/services/llm/openAICompatibleImageRoutingErrors.ts` did not exist.
- Extracted quota-like image error, chat endpoint compatibility error, and image endpoint compatibility error classifiers into `src/services/llm/openAICompatibleImageRoutingErrors.ts`; `OpenAICompatibleAdapter.ts` now imports `isChatEndpointCompatibilityError` and `isImageEndpointCompatibilityError` instead of owning local closures in `generateImage`.
- The helper preserves historical message-only matching, quota fail-closed behavior, broad chat/image compatibility substrings, and non-`Error` object handling. Raw string/null/undefined inputs continue to evaluate as non-compatibility signals because the historical code only read `.message`.
- Added `tests/unit/openai-compatible-image-routing-errors-contract.test.ts` and registered it in `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 79 test files.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` 4412 physical lines, `src/services/llm/openAICompatibleImageRoutingErrors.ts` 49 physical lines, `tests/unit/openai-compatible-image-routing-errors-contract.test.ts` 90 physical lines, `tsconfig.tests.json` 108 physical lines.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-routing-errors-contract.test.ts` passed (4/4).
- Provider/security targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-routing-errors-contract.test.ts tests/unit/openai-compatible-diagnostics-contract.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/provider-surface-router.test.ts tests/unit/provider-strategy.test.ts tests/unit/async-image-proxy-regression.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/governance-contract.test.ts` passed (65/65).
- Passed: `npm.cmd run architecture:check` with existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions only.
- Passed: `npm.cmd run governance:security`.
- Passed: `npm.cmd run audit:dependencies` with both root and `payment-server` audits reporting `found 0 vulnerabilities`.
- Passed: `npm.cmd run typecheck`; test semantic check covers 79 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1259/1259).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/llm/OpenAICompatibleAdapter.ts src/services/llm/openAICompatibleImageRoutingErrors.ts tests/unit/openai-compatible-image-routing-errors-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Subagent review found no blocking behavior or security issue. Residual risk remains the historical broad substring policy (`endpoint`, `invalid request`, and `unsupported`); this slice preserves that policy instead of changing routing semantics.
- Browser QA: skipped because this is a non-UI classifier/helper extraction and no visual surface, CSS, route component, or browser-visible behavior changed.

## Completed In `96b94e5e` (OpenAI-Compatible Unreachable Image Fallback Cleanup)

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/provider-image-routing-regression.test.ts` failed after adding the source contract because `OpenAICompatibleAdapter.ts` still contained post-throw automatic fallback snippets (`Chat API 不兼容，回退 Images API` and `Images API 疑似不兼容，自动回退 Chat API`).
- Removed only the unreachable fallback code after `throw this.buildImageCompatibilityModeError('chat', ...)` and `throw this.buildImageCompatibilityModeError('standard', ...)`; billing-safe fail-closed behavior remains the live path.
- Added source-contract coverage in `tests/unit/provider-image-routing-regression.test.ts` so the old automatic fallback snippets do not return behind the fail-closed compatibility errors.
- Line counts for this slice: `src/services/llm/OpenAICompatibleAdapter.ts` 4405 physical lines and `tests/unit/provider-image-routing-regression.test.ts` 153 physical lines.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/provider-image-routing-regression.test.ts` passed (7/7).
- Provider/security targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-image-routing-errors-contract.test.ts tests/unit/openai-compatible-diagnostics-contract.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/provider-surface-router.test.ts tests/unit/provider-strategy.test.ts tests/unit/async-image-proxy-regression.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/governance-contract.test.ts` passed (66/66).
- Passed: `npm.cmd run architecture:check` with existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions only.
- Passed: `npm.cmd run governance:security`.
- Passed: `npm.cmd run audit:dependencies` with both root and `payment-server` audits reporting `found 0 vulnerabilities`.
- Passed: `npm.cmd run typecheck`; test semantic check covers 79 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1260/1260).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Browser QA: skipped because this is non-UI dead-code cleanup and no visual surface, CSS, route component, or browser-visible behavior changed.

## Stage Two M5 Media Recovery Extraction

- Extracted `hydrateRecoveredMediaCacheEntry`, `resolveOriginalPersistSourceForDisk`, and the local media cache entry type into `src/context/canvasMediaRecovery.ts`.
- `src/context/CanvasContext.tsx` now imports the media recovery helpers and no longer owns the local recovered media cache helper block.
- Added `tests/unit/canvas-media-recovery-contract.test.ts` to guard helper ownership, explicit exports, protected original-slot behavior, stable original-source preference, video fallback, and blob-source rejection.
- Added the media recovery contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 43 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4457, `src/context/canvasMediaRecovery.ts` 69, `tests/unit/canvas-media-recovery-contract.test.ts` 38, `tsconfig.tests.json` 72.
- Initial targeted run exposed a Node strip-only TypeScript runtime limitation when the test directly imported a helper that imports an enum dependency; the final contract keeps runtime source checks plus type-only coverage and leaves semantic validation to `npm.cmd run typecheck`.
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-media-recovery-contract.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` (6/6).
- Passed: `npm.cmd run typecheck`; test semantic check covers 43 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run architecture:check` with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Passed: `npm.cmd run test:unit` (1129/1129).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasMediaRecovery.ts tests/unit/canvas-media-recovery-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI context/helper extraction and no visual surface, CSS, route, or browser behavior changed.

## Stage Two M6 Prompt Recovery Extraction

- Extracted startup prompt recovery normalization into `src/context/canvasPromptRecovery.ts`.
- `src/context/CanvasContext.tsx` now imports `normalizeCanvasPromptRecovery`, `markInterruptedSyncPromptGenerations`, and `hasUnrecoverableSyncGenerationInFlight`; it no longer owns `normalizeRecoveredPromptNode`, pending task parsing, interrupted sync-generation marking, or prompt recovery risk detection.
- At M6 close, kept the async persisted-result recovery path in `CanvasContext.tsx` for a future smaller seam.
- Added `tests/unit/canvas-prompt-recovery-contract.test.ts` to guard helper ownership, export shape, completed-prompt pending-state cleanup, interrupted sync-generation marking, before-unload persistence wiring, and executable helper behavior for completed recovered prompts and interrupted sync prompts.
- Added the prompt recovery contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 44 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4951, `src/context/canvasPromptRecovery.ts` 184, `tests/unit/canvas-prompt-recovery-contract.test.ts` 228, `tsconfig.tests.json` 73.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-recovery-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasPromptRecovery.ts`.
- The behavior tests execute the helper source through test-local TypeScript transpilation with dependency stubs because Node strip-only TS cannot directly import the helper's extensionless production dependency graph; the assertions call `normalizeCanvasPromptRecovery`, `markInterruptedSyncPromptGenerations`, and `hasUnrecoverableSyncGenerationInFlight`.
- Browser QA: skipped because this is a non-UI context/helper extraction and no visual surface, CSS, route, or browser behavior changed.

## Stage Two M7 Persisted Image Recovery Extraction

- Extracted persisted task/result recovery helper ownership into `src/context/canvasPersistedImageRecovery.ts`.
- `src/context/CanvasContext.tsx` now imports `buildPersistedImageRecoverySignature`, `buildPromptRecoveryEntries`, `resolveImageRecoveryUrlFromMetadata`, `resolvePromptRecoveryEntrySource`, and `PromptRecoveryEntry`; it no longer owns task result URL indexing, storage-id normalization, stored-result lookup, prompt recovery entry merge, image recovery URL resolution, or recovery-signature construction.
- Kept the React hydration effect in `CanvasContext.tsx`: task loading, `tasksByPromptId`, cache write scheduling, recovered node construction, `updateNodes`, and `addImageNodes` remain in place for a future smaller seam.
- Added `tests/unit/canvas-persisted-image-recovery-contract.test.ts` to guard helper ownership, export shape, completed/persisted task merge behavior, duplicate suppression, recovery-signature gating, storage-original preference, cached-source fallback, and stale blob URL rejection.
- Updated `tests/unit/canvas-persisted-image-hydration-guard.test.ts` to preserve the startup guard contract after signature construction moved out of `CanvasContext.tsx`.
- Added the persisted image recovery contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 45 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4666, `src/context/canvasPersistedImageRecovery.ts` 301, `tests/unit/canvas-persisted-image-recovery-contract.test.ts` 283, `tests/unit/canvas-persisted-image-hydration-guard.test.ts` 21, `tsconfig.tests.json` 74.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-persisted-image-recovery-contract.test.ts` failed first because `CanvasContext.tsx` had no `canvasPersistedImageRecovery` import and the helper exports did not exist.
- Targeted GREEN validation already run during the slice: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-persisted-image-recovery-contract.test.ts tests/unit/canvas-persisted-image-hydration-guard.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` passed (8/8).
- Browser QA: skipped because this is a non-UI context/helper extraction and no visual surface, CSS, route, or browser behavior changed.

## Stage Two M8 Canvas Merge Extraction

- Extracted canvas merge helper ownership into `src/context/canvasMerge.ts`.
- `src/context/CanvasContext.tsx` now imports `mergeCanvases` and `resolvePreferredActiveCanvasId`; it no longer owns `getCanvasCardCount`, `isCanvasEffectivelyEmpty`, `mergeItemsById`, `mergeSingleCanvas`, `mergeCanvases`, or preferred active-canvas selection.
- Kept cloud sync, local-folder restore, local-folder connect, and local-folder refresh effects in `CanvasContext.tsx`; those call `mergeCanvases(..., normalizeCanvasPromptRecovery)` explicitly so prompt recovery normalization remains owned by the caller.
- Added `tests/unit/canvas-merge-contract.test.ts` to guard helper ownership, non-empty snapshot preference, ID merge ordering, local item override semantics, max `lastModified`, and active canvas fallback ordering.
- Added the canvas merge contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 46 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4556, `src/context/canvasMerge.ts` 122, `tests/unit/canvas-merge-contract.test.ts` 121, `tsconfig.tests.json` 75.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-merge-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasMerge.ts`.
- Targeted GREEN validation already run during the slice: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-merge-contract.test.ts` passed (4/4).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-merge-contract.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` passed (7/7).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 46 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1144/1144).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasMerge.ts tests/unit/canvas-merge-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route, or browser behavior changed.

## Stage Two M9 Invalid-Card Cleanup Extraction

- Extracted invalid-card cleanup helper ownership into `src/context/canvasCleanup.ts`.
- `src/context/CanvasContext.tsx` now imports `cleanupInvalidCanvasCardsForCanvas` and keeps only the public `cleanupInvalidCards` context wrapper plus state update orchestration.
- The helper owns invalid prompt removal, invalid image removal, prompt child ID pruning, utility workflow source/output pruning, workflow edge pruning, group pruning, selected-node filtering, and summary reporting.
- Added `tests/unit/canvas-cleanup-contract.test.ts` to guard helper ownership, executable cleanup behavior, workflow pruning, group/selection pruning, summary counts, and unchanged clean-canvas behavior.
- Added the cleanup contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 47 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4462, `src/context/canvasCleanup.ts` 155, `tests/unit/canvas-cleanup-contract.test.ts` 131, `tsconfig.tests.json` 76.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-cleanup-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasCleanup.ts`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-cleanup-contract.test.ts` passed (3/3).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-cleanup-contract.test.ts tests/unit/canvas-workflow-source-node-ids-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts tests/unit/canvas-startup-local-restore.test.ts` passed (9/9).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 47 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1147/1147).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasCleanup.ts tests/unit/canvas-cleanup-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route, or browser behavior changed.

## Stage Two M10 Canvas Placement Extraction

- Extracted next-card, smart-collision, and next-group placement helper ownership into `src/context/canvasPlacement.ts`.
- `src/context/CanvasContext.tsx` now imports `resolveNextCardPosition`, `resolveSmartCanvasPosition`, and `resolveNextGroupPosition`; it keeps the public placement callbacks and delegates calculation to the helper.
- The helper owns fixed five-column card slot calculation, prompt/image/group/workflow utility collision checks, shift fallback ordering, and dynamic child-card group width accumulation.
- Added `tests/unit/canvas-placement-contract.test.ts` to guard helper ownership, exported helper shape, fixed card-grid behavior, prompt/workflow utility collision shifts, fallback behavior when no canvas is active, and dynamic group width accumulation.
- Added the placement contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 48 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4263, `src/context/canvasPlacement.ts` 189, `tests/unit/canvas-placement-contract.test.ts` 113, `tsconfig.tests.json` 77.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-placement-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasPlacement.ts`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-placement-contract.test.ts` passed (4/4).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-placement-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-cleanup-contract.test.ts` passed (10/10).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 48 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1151/1151).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasPlacement.ts tests/unit/canvas-placement-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route, or browser behavior changed.

## Stage Two M11 Canvas Layering Extraction

- Extracted bring-to-front layering helper ownership into `src/context/canvasLayering.ts`.
- `src/context/CanvasContext.tsx` now imports `bringCanvasNodesToFront`; it keeps the public `bringNodesToFront` callback and delegates z-index calculation to the helper.
- The helper owns prompt-group expansion, parent-linked child image promotion, linked canvas group expansion, workflow utility node promotion, max z-index calculation, and group z-index ordering.
- Added `tests/unit/canvas-layering-contract.test.ts` to guard helper ownership, wrapper delegation, prompt/child image co-promotion, linked workflow utility promotion, linked canvas group z-index ordering, multi-id ordering, standalone image promotion, and empty no-op behavior.
- Added the layering contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 49 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4080, `src/context/canvasLayering.ts` 185, `tests/unit/canvas-layering-contract.test.ts` 183, `tsconfig.tests.json` 78.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-layering-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasLayering.ts`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-layering-contract.test.ts` passed (5/5).
- Passed initial targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-layering-contract.test.ts tests/unit/canvas-placement-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-cleanup-contract.test.ts` passed (13/13).
- Passed extended targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-layering-contract.test.ts tests/unit/canvas-placement-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-cleanup-contract.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-connector-throttling-contract.test.ts` passed (69/69).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 49 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1156/1156).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasLayering.ts tests/unit/canvas-layering-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route, or browser behavior changed.
- Parallel security scan during this slice flagged two high-priority Netlify legacy BYOK endpoints: `netlify/functions/keys.ts` and `netlify/functions/generate.ts`. They are excluded from M11 and must be handled as a separate security cleanup after this commit.

## Completed In `0603547a` (Netlify Legacy Raw-Key Endpoint Cleanup)

- Removed `netlify/functions/keys.ts`, which exposed `/api/keys`, wildcard CORS, raw BYOK validation against Gemini query-string key auth, and browser-localStorage key guidance.
- Removed `netlify/functions/generate.ts`, which exposed `/api/generate`, wildcard CORS, public request-body `apiKey` handling, and direct `GoogleGenAI` calls.
- Kept `netlify/functions/pricing-proxy.ts`; `netlify.toml` still publishes Netlify functions for that vetted pricing proxy only.
- Extended `scripts/governance/check-sensitive-boundaries.mjs` to scan `netlify/`.
- Added `tests/unit/governance-contract.test.ts` coverage so `netlify/functions/keys.ts`, `netlify/functions/generate.ts`, `/api/keys`, `/api/generate`, localStorage key guidance, and raw-api-key `GoogleGenAI` Netlify functions do not return.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/governance-contract.test.ts` failed first on the legacy Netlify functions boundary; the guard was then narrowed after confirming `netlify/functions/pricing-proxy.ts` is still a legitimate vetted function.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/governance-contract.test.ts` passed (13/13).
- Reference grep: `rg -n 'path:\s*["'']/(api/)?(keys|generate)["'']|GoogleGenAI|Keys are stored locally|Store them locally|/api/keys|/api/generate' netlify scripts tests src apps package.json` only matched the new guard assertion.
- Passed: `npm.cmd run governance:security`.
- Passed: `npm.cmd audit --omit=dev --audit-level=moderate` (`found 0 vulnerabilities`).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 49 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1157/1157).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `npm.cmd run governance:check`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- netlify.toml netlify/functions/generate.ts netlify/functions/keys.ts scripts/governance/check-sensitive-boundaries.mjs tests/unit/governance-contract.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is endpoint/config/governance cleanup only and no UI surface, CSS, route component, or browser-visible workflow changed.

## Completed In `5994c34b` (Stage Two M12 Canvas Group Management Extraction)

- Extracted Canvas group management helper ownership into `src/context/canvasGroups.ts`.
- `src/context/CanvasContext.tsx` now imports `addCanvasGroupToCanvas`, `removeCanvasGroupFromCanvas`, and `updateCanvasGroupInCanvas`; it keeps the public `addGroup`, `removeGroup`, and `updateGroup` callbacks as wrappers around `updateCanvas`.
- The helper owns explicit z-index preservation, next z-index calculation from prompt nodes, image nodes, and existing groups only, all-matching-ID group removal, and replace-only update semantics for existing group IDs.
- Kept `updateCanvas` ownership in `CanvasContext.tsx`, so `lastModified: Date.now()` and `syncCanvasCompatibility` behavior remain outside the pure helper.
- Added `tests/unit/canvas-groups-contract.test.ts` to guard helper ownership, wrapper delegation, next z-index behavior excluding workflow nodes, explicit `zIndex: 0` preservation, missing-group-array append behavior, remove-all matching IDs, untouched node/drawing references, and no append when updating a missing group ID.
- Added the group management contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 50 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4059, `src/context/canvasGroups.ts` 41, `tests/unit/canvas-groups-contract.test.ts` 181, `tsconfig.tests.json` 79.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-groups-contract.test.ts` failed first with 5/5 failures because `src/context/canvasGroups.ts` did not exist and `CanvasContext.tsx` did not import or delegate to `canvasGroups`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-groups-contract.test.ts` passed (5/5).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-groups-contract.test.ts tests/unit/canvas-layering-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cleanup-contract.test.ts` passed (14/14).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 50 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1162/1162).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`; no suspicious mojibake text or traditional Chinese characters found after normalizing the touched files.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasGroups.ts tests/unit/canvas-groups-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- EOL check: `git --git-dir=node_modules/.codex-git-full --work-tree=. ls-files --eol -- src/context/CanvasContext.tsx tsconfig.tests.json plans.md implement.md validation.md status.md` reports `w/lf` for all touched tracked files.
- Code review: Goodall found no spec-compliance issues; Aristotle found no behavior/security issues and requested line-ending normalization before staging. `src/context/CanvasContext.tsx` and `tsconfig.tests.json` were normalized from `w/mixed` to `w/lf` before final validation.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Completed In `4722acbe` (Stage Two M13 Canvas Movement Extraction)

- Extracted selected-node movement helper ownership into `src/context/canvasMovement.ts`.
- `src/context/CanvasContext.tsx` now imports `moveSelectedCanvasNodes`; it keeps `applyMoveSelectedNodes`, pending delta/source refs, RAF batching, immediate flush behavior, and public `moveSelectedNodes` / `moveSelectedNodesImmediate` callbacks.
- The helper owns source override resolution, selected prompt movement, prompt child-image co-movement, direct image `userMoved` marking, workflow utility-only movement, and no-op behavior when there are no effective selected IDs.
- Kept `lastModified` untouched, matching the previous movement path; no `updateCanvas` or compatibility-sync behavior moved into the helper.
- Added `tests/unit/canvas-movement-contract.test.ts` to guard helper ownership, wrapper delegation, source override semantics, prompt-child movement, image manual override marking, workflow utility gating, and empty-selection no-op behavior.
- Updated `tests/unit/prompt-group-drag-layout.test.ts` so the manual-layout override regression follows the new helper boundary instead of the old inline `CanvasContext.tsx` block.
- Added the movement contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 51 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4015, `src/context/canvasMovement.ts` 84, `tests/unit/canvas-movement-contract.test.ts` 227, `tests/unit/prompt-group-drag-layout.test.ts` 66, `tsconfig.tests.json` 80.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-movement-contract.test.ts tests/unit/prompt-group-drag-layout.test.ts` failed first with 8 failures because `src/context/canvasMovement.ts` did not exist and `CanvasContext.tsx` still owned the movement block.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-movement-contract.test.ts tests/unit/prompt-group-drag-layout.test.ts` passed (13/13).
- Passed expanded targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-movement-contract.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-connector-throttling-contract.test.ts` passed (61/61).
- Passed post-review targeted gate with batching and `lastModified` assertions: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-movement-contract.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-connector-throttling-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts` passed (62/62).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 51 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1169/1169).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasMovement.ts tests/unit/canvas-movement-contract.test.ts tests/unit/prompt-group-drag-layout.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Seam review: Poincare confirmed the boundary should keep RAF batching and source resolution in `CanvasContext.tsx`; its recommended extra assertions for batching refs/source resolution and unchanged `lastModified` were added before the final gate.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Completed In `d7a9d0a7` (Stage Two M14 Canvas Tags Extraction)

- Extracted node tag helper ownership into `src/context/canvasTags.ts`.
- `src/context/CanvasContext.tsx` now imports `setCanvasNodeTags`; it keeps the public `setNodeTags` callback and delegates tag replacement through `updateCanvas`.
- The helper owns prompt/image tag replacement for matching IDs, clear-tags behavior, and leaving groups, drawings, and `lastModified` untouched.
- Kept `lastModified` and `syncCanvasCompatibility` ownership in `updateCanvas`, matching the previous `setNodeTags` path.
- Added `tests/unit/canvas-tags-contract.test.ts` to guard helper ownership, wrapper delegation, prompt/image-only replacement, clear-tags behavior, untouched groups/drawings, and unmatched-node stability.
- Added the tags contract to `tsconfig.tests.json`.
- Line counts for this slice: `src/context/CanvasContext.tsx` 4012, `src/context/canvasTags.ts` 9, `tests/unit/canvas-tags-contract.test.ts` 133, `tsconfig.tests.json` 81.
- RED evidence recorded for the draft: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-tags-contract.test.ts` failed first with 3/3 failures because `src/context/canvasTags.ts` did not exist and `CanvasContext.tsx` did not import or delegate to `canvasTags`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-tags-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts` passed (4/4).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 52 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1172/1172).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasTags.ts tests/unit/canvas-tags-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Code review: Godel confirmed the implementation preserves the old `setNodeTags` behavior and keeps the slice narrow; its staging and stale-status warnings are addressed by explicit path-based staging and this M14 ledger update.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Completed In `c9d39bb2` (Stage Two M15 Canvas Node Updates Extraction)

- Extracted node update helper ownership into `src/context/canvasNodeUpdates.ts`.
- `src/context/CanvasContext.tsx` now imports `updateCanvasImageNodeDimensions`, `updateCanvasImageNode`, and `applyCanvasNodeBatchUpdates`; it keeps the public `updateImageNodeDimensions`, `updateImageNode`, and `updateNodes` callbacks as wrappers around `updateCanvas`.
- The helper owns image dimension updates, image shallow-merge updates, batch prompt/image updates, duplicate-ID last-write-wins semantics, and empty/no-match batch no-ops.
- Kept `lastModified` and `syncCanvasCompatibility` ownership in `updateCanvas`, matching the previous node update paths.
- Added `tests/unit/canvas-node-updates-contract.test.ts` to guard helper ownership, wrapper delegation, unchanged prompt/image references, empty update object behavior, duplicate update IDs, and original-canvas return for empty or unmatched batches.
- Added the node update contract to `tsconfig.tests.json`.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3977, `src/context/canvasNodeUpdates.ts` 56, `tests/unit/canvas-node-updates-contract.test.ts` 197, `tsconfig.tests.json` 82.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-node-updates-contract.test.ts` failed first with 5/5 failures because `src/context/canvasNodeUpdates.ts` did not exist and `CanvasContext.tsx` did not import or delegate to `canvasNodeUpdates`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-node-updates-contract.test.ts` passed (5/5).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-node-updates-contract.test.ts tests/unit/canvas-persisted-image-hydration-guard.test.ts tests/unit/canvas-context-state-boundary.test.ts` passed (7/7).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 53 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1177/1177).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check after intent-to-add for new files: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasNodeUpdates.ts tests/unit/canvas-node-updates-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Code review note: a follow-up read-only subagent was requested but did not return before the validation gate; local diff review found the slice stayed within node update helper extraction and preserved `updateCanvas` ownership.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Completed In `c80ffa70` (Stage Two M16 Canvas Position Updates Extraction)

- Extracted prompt/image position update helper ownership into `src/context/canvasPositionUpdates.ts`.
- `src/context/CanvasContext.tsx` now imports `updateCanvasPromptNodePosition` and `updateCanvasImageNodePosition`; it keeps the public `updatePromptNodePosition` and `updateImageNodePosition` callbacks as wrappers around `updateCanvas`.
- The helper owns prompt child-image movement, selected prompt/image group movement, `moveChildren`, `ignoreSelection`, and missing-target no-op behavior.
- Kept `lastModified` and `syncCanvasCompatibility` ownership in `updateCanvas`, matching the previous position update paths.
- Added `tests/unit/canvas-position-updates-contract.test.ts` to guard helper ownership, wrapper delegation, prompt child movement, selected group movement, ignored selection single-image movement, and missing target no-ops.
- Added the position update contract to `tsconfig.tests.json`.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3890, `src/context/canvasPositionUpdates.ts` 104, `tests/unit/canvas-position-updates-contract.test.ts` 201, `tsconfig.tests.json` 83.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-position-updates-contract.test.ts` failed first with 5/5 failures because `src/context/canvasPositionUpdates.ts` did not exist and `CanvasContext.tsx` did not import or delegate to `canvasPositionUpdates`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-position-updates-contract.test.ts` passed (5/5).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-position-updates-contract.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/canvas-live-scene-contract.test.ts` passed (55/55).
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run typecheck`, `npm.cmd run test:unit` (1182/1182), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasPositionUpdates.ts tests/unit/canvas-position-updates-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Completed In `c46a4c49` (Stage Two M17 Canvas Prompt-Image Links Extraction)

- Extracted prompt/image relationship helper ownership into `src/context/canvasPromptImageLinks.ts`.
- `src/context/CanvasContext.tsx` now imports `deleteCanvasPromptNode`, `linkCanvasPromptToImage`, and `unlinkCanvasPromptFromImage`; it keeps public `deletePromptNode`, `linkNodes`, and `unlinkNodes` callbacks as wrappers around `updateCanvas`.
- The helper owns deleted-prompt child image orphaning, prompt child ID appends/removals, duplicate link no-ops, missing prompt link no-ops, missing image link behavior, and unlink orphaning even when the prompt is absent.
- Kept `pushToHistory`, `urgentSaveRef`, `lastModified`, and `syncCanvasCompatibility` ownership in `CanvasContext.tsx`/`updateCanvas`.
- Added `tests/unit/canvas-prompt-image-links-contract.test.ts` to guard helper ownership, wrapper delegation, delete behavior, link behavior, duplicate/missing prompt behavior, and unlink behavior.
- Added the prompt-image links contract to `tsconfig.tests.json`.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3852, `src/context/canvasPromptImageLinks.ts` 50, `tests/unit/canvas-prompt-image-links-contract.test.ts` 172, `tsconfig.tests.json` 84.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-image-links-contract.test.ts` failed first with 4/4 failures because `src/context/canvasPromptImageLinks.ts` did not exist and `CanvasContext.tsx` did not import or delegate to `canvasPromptImageLinks`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-image-links-contract.test.ts` passed (4/4).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-image-links-contract.test.ts tests/unit/canvas-prompt-child-images-runtime-contract.test.ts tests/unit/canvas-cleanup-contract.test.ts` passed (11/11).
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run typecheck` with semantic checks for 55 test files, `npm.cmd run test:unit` (1186/1186), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasPromptImageLinks.ts tests/unit/canvas-prompt-image-links-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with CRLF normalization warnings only.
- Seam review: Mendel recommended this seam over workflow updates because it is pure array transformation with no async, IndexedDB, local folder, dynamic import, DOM/browser API, storage deletion, or layout math; workflow updates remain a runner-up seam for a future slice.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M18 Canvas Workflow Updates Extraction

- Extracted workflow utility node update helper ownership into `src/context/canvasWorkflowUpdates.ts`.
- `src/context/CanvasContext.tsx` now imports `addCanvasWorkflowNode`, `updateCanvasWorkflowNode`, `updateCanvasWorkflowNodePosition`, and `deleteCanvasWorkflowNode`; it keeps public workflow callbacks as wrappers around `updateCanvas`.
- The helper owns utility node add duplicate checks, source-control edge creation, update ID/kind preservation, source-edge rebuilding, workflow node position updates, and workflow node deletion edge pruning.
- Kept the non-utility legacy-node warning/guard, `pushToHistory`, `lastModified`, and `syncCanvasCompatibility` ownership in `CanvasContext.tsx`/`updateCanvas`.
- Added `tests/unit/canvas-workflow-updates-contract.test.ts` to guard helper ownership, wrapper delegation, utility add behavior, source edge filtering/deduping, update semantics, position semantics, and delete semantics.
- Updated `tests/unit/canvas-workflow-source-node-ids-contract.test.ts` because M18 moves `getWorkflowSourceNodeIds` consumption from `CanvasContext.tsx` into the workflow update helper.
- Added `.ts` local import specifiers in `src/workflow/adapters/canvasToWorkflow.ts` and `src/workflow/persistence/workflowSerializer.ts` so the new helper can be loaded directly by Node contract tests without extensionless ESM resolution failure.
- Added the workflow updates contract to `tsconfig.tests.json`.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3733, `src/context/canvasWorkflowUpdates.ts` 148, `tests/unit/canvas-workflow-updates-contract.test.ts` 189, `tests/unit/canvas-workflow-source-node-ids-contract.test.ts` 69, `src/workflow/adapters/canvasToWorkflow.ts` 131, `src/workflow/persistence/workflowSerializer.ts` 87, `tsconfig.tests.json` 85.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-updates-contract.test.ts` failed first with 4/4 failures because `src/context/canvasWorkflowUpdates.ts` did not exist and `CanvasContext.tsx` did not import or delegate to `canvasWorkflowUpdates`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-updates-contract.test.ts` passed (4/4) after the helper extraction and ESM import-specifier fix.
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-updates-contract.test.ts tests/unit/canvas-workflow-source-node-ids-contract.test.ts tests/unit/workflow-document-domain.test.ts tests/unit/canvas-cleanup-contract.test.ts` passed (12/12).
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run typecheck` with semantic checks for 56 test files, `npm.cmd run test:unit` (1190/1190), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasWorkflowUpdates.ts tests/unit/canvas-workflow-updates-contract.test.ts tests/unit/canvas-workflow-source-node-ids-contract.test.ts src/workflow/adapters/canvasToWorkflow.ts src/workflow/persistence/workflowSerializer.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M19 Canvas Image Delete Helper Extraction

- Extracted the pure image-node deletion transform into `src/context/canvasPromptImageLinks.ts` as `deleteCanvasImageNode`.
- `src/context/CanvasContext.tsx` now imports `deleteCanvasImageNode`; it keeps `pushToHistory`, IndexedDB deletion, physical storage deletion adapter invocation, Blob URL revocation, urgent-save, and `updateCanvas` ownership.
- The helper owns image removal, parent prompt `childImageIds` pruning, and clearing `sourceImageId` when the deleted image was a follow-up source.
- Extended `tests/unit/canvas-prompt-image-links-contract.test.ts` to guard helper ownership, wrapper delegation, image deletion behavior, source-image cleanup, unchanged drawings, and unchanged `lastModified`.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3724, `src/context/canvasPromptImageLinks.ts` 62, `tests/unit/canvas-prompt-image-links-contract.test.ts` 210.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-image-links-contract.test.ts` failed first with 2 failures because `deleteCanvasImageNode` did not exist and `CanvasContext.tsx` still owned the inline transform.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-image-links-contract.test.ts` passed (5/5).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-image-links-contract.test.ts tests/unit/canvas-workflow-updates-contract.test.ts tests/unit/canvas-cleanup-contract.test.ts` passed (12/12).
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run typecheck` with semantic checks for 56 test files, `npm.cmd run test:unit` (1191/1191), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasPromptImageLinks.ts tests/unit/canvas-prompt-image-links-contract.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M20 Canvas Merge-Into Helper Extraction

- Extracted `mergeCanvasInto` pure state-transform ownership into `src/context/canvasMergeInto.ts`.
- `src/context/CanvasContext.tsx` now imports `mergeCanvasIntoState`; it keeps the public `mergeCanvasInto` wrapper, `setState` ownership, and returned summary shape.
- The helper owns same-canvas/missing-canvas no-ops, default `deleteSource` behavior, duplicate prompt/image/group skipping, target card X offsetting, moved image `canvasId` reassignment, moved group node filtering, optional source emptying, active canvas reassignment when deleting the active source, selection clearing, and summary counts.
- Added `tests/unit/canvas-merge-into-contract.test.ts` to guard helper ownership, wrapper delegation, delete-source behavior, empty-source behavior, duplicate filtering, group filtering, unchanged invalid merge requests, and deterministic `lastModified` behavior.
- Added the merge-into contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 57 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3641, `src/context/canvasMergeInto.ts` 130, `tests/unit/canvas-merge-into-contract.test.ts` 228, `tsconfig.tests.json` 86.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-merge-into-contract.test.ts` failed first with 4/4 failures because `src/context/canvasMergeInto.ts` did not exist and `CanvasContext.tsx` did not import or delegate to it.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-merge-into-contract.test.ts` passed (4/4).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-merge-into-contract.test.ts tests/unit/canvas-merge-contract.test.ts tests/unit/canvas-cleanup-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts` passed (12/12).
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run typecheck` with semantic checks for 57 test files, `npm.cmd run test:unit` (1195/1195), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasMergeInto.ts tests/unit/canvas-merge-into-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M21 Canvas Unused-Code Cleanup

- Removed source-proven unused `CanvasContext.tsx` imports: `getAllImages`, `getImagesPage`, and `getCachedStrippedCanvases`.
- Removed unused initial auto-arrange constants `PROMPT_HEIGHT`, `GAP_X`, `GAP_Y`, and `IMAGE_GAP`; kept the active `AUTO_ARRANGE_*` constants.
- Removed write-only `currentX` tracking in the global auto-arrange row-assignment pass; row wrapping is count-based and never read that X accumulator.
- Reworded the migration comment so it no longer references the removed `getAllImages` symbol.
- Added `tests/unit/canvas-context-unused-cleanup.test.ts` to guard the cleanup proof and added it to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 58 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3633, `tests/unit/canvas-context-unused-cleanup.test.ts` 28, `tsconfig.tests.json` 87.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts` failed first because the unused imports/constants/writes were still present.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts` passed (1/1).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts tests/unit/canvas-merge-into-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts` passed (6/6).
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run typecheck` with semantic checks for 58 test files, `npm.cmd run test:unit` (1196/1196), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx tests/unit/canvas-context-unused-cleanup.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI cleanup and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M22 Canvas Arrange Selection Extraction

- Extracted the single selected prompt child-card arrangement branch into `src/context/canvasArrangeSelection.ts`.
- `src/context/CanvasContext.tsx` now imports `arrangeSingleSelectedPromptChildren` and delegates the selected prompt child-card layout path before the broader selected-root arrange path.
- The helper preserves row, grid, and column child image positioning, PPT prompt forced column layout, `lastModified`, and returned `subCardLayoutMode` behavior.
- Added `tests/unit/canvas-arrange-selection-contract.test.ts` to guard helper ownership, wrapper delegation, executable row/grid/column positioning, PPT column forcing, unchanged no-child/no-single-selection behavior, and deterministic `lastModified` handling.
- Added the arrange-selection contract to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 59 test files.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3571, `src/context/canvasArrangeSelection.ts` 102, `tests/unit/canvas-arrange-selection-contract.test.ts` 165, `tsconfig.tests.json` 88.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-arrange-selection-contract.test.ts` failed first with 4/4 failures because `src/context/canvasArrangeSelection.ts` did not exist and `CanvasContext.tsx` did not import or delegate to it.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-arrange-selection-contract.test.ts` passed (4/4).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-arrange-selection-contract.test.ts tests/unit/prompt-group-regroup-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/canvas-live-scene-contract.test.ts` passed (57/57).
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run typecheck` with semantic checks for 59 test files, `npm.cmd run test:unit` (1200/1200), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasArrangeSelection.ts tests/unit/canvas-arrange-selection-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI helper/layout logic extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M23 Canvas Duplicate Selected-Arrange Cleanup

- Removed the unreachable duplicate selected-arrange fallback from `src/context/CanvasContext.tsx`.
- The remaining selected-group arrange path builds `selectedGroupsForArrange` and returns for every `selectedCount > 1` prompt/image selection case, so the legacy fallback block after it was dead code.
- Extended `tests/unit/canvas-context-unused-cleanup.test.ts` to guard that the old fallback markers (`SelectionGroup`, `processedImageIds`, and standalone image reserve-height branch) do not return.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3404, `tests/unit/canvas-context-unused-cleanup.test.ts` 32, `tsconfig.tests.json` 88.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts` passed (1/1).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts tests/unit/canvas-arrange-selection-contract.test.ts tests/unit/prompt-group-regroup-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/canvas-live-scene-contract.test.ts` passed (58/58).
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run typecheck` with semantic checks for 59 test files, `npm.cmd run test:unit` (1200/1200), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx tests/unit/canvas-context-unused-cleanup.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is non-UI dead-branch cleanup and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M24 Canvas Selected-Root Arrange Extraction

- Extracted the multi-root selected arrange branch into `src/context/canvasArrangeSelection.ts` as `arrangeSelectedRootNodes`.
- `src/context/CanvasContext.tsx` now delegates selected prompt-only, image-only, and mixed root arrangement to the helper and no longer owns the local `let roots: any[]` root list.
- The helper preserves selected standalone image row layout, prompt-root child image syncing by root delta, mixed child-to-parent root promotion, grid/row/column root placement, deterministic `lastModified`, and null behavior when a selection collapses to one root.
- Cleaned the touched arrange block by removing the unused `dimensions` parameter from the remaining `CanvasContext.tsx` local image-dimension helper call sites.
- Extended `tests/unit/canvas-arrange-selection-contract.test.ts` to guard helper ownership, Context delegation, standalone image row layout, prompt-root child syncing, and one-root no-op behavior.
- Line counts for this slice: `src/context/CanvasContext.tsx` 3201, `src/context/canvasArrangeSelection.ts` 338, `tests/unit/canvas-arrange-selection-contract.test.ts` 241, `tsconfig.tests.json` 88.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-arrange-selection-contract.test.ts` failed first with 4/8 failures because `arrangeSelectedRootNodes` did not exist and `CanvasContext.tsx` still owned the inline selected-root branch.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-arrange-selection-contract.test.ts` passed (8/8).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-arrange-selection-contract.test.ts tests/unit/prompt-group-regroup-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-context-unused-cleanup.test.ts` passed (62/62).
- Type validation passed: `npm.cmd run typecheck` with semantic checks for 59 test files.
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing allowlisted migration and legacy bridge exceptions.
- Unit validation passed: `npm.cmd run test:unit` passed (1204/1204).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasArrangeSelection.ts tests/unit/canvas-arrange-selection-contract.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI helper/layout logic extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M25 Canvas Selected-Group Arrange Extraction

- Extracted the remaining selected grouped arrange fallback into `src/context/canvasArrangeSelection.ts` as `arrangeSelectedGroupedNodes`.
- `src/context/CanvasContext.tsx` now delegates selected prompt+child single-root/group fallback arrangement after `arrangeSingleSelectedPromptChildren` and `arrangeSelectedRootNodes`, preserving the existing helper order.
- The helper preserves prompt+child grouped layout, standalone selected image fallback grouping, row/grid/column group placement, PPT child column override, selected-count fallthrough, deterministic `lastModified`, and requested `subCardLayoutMode` behavior.
- Extended `tests/unit/canvas-arrange-selection-contract.test.ts` to guard helper ownership, Context delegation, prompt+child grouped layout behavior, and `selectedCount <= 1` null/fallthrough behavior.
- Line counts for this slice: `src/context/CanvasContext.tsx` 2968, `src/context/canvasArrangeSelection.ts` 601, `tests/unit/canvas-arrange-selection-contract.test.ts` 306.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-arrange-selection-contract.test.ts` failed first with 2/10 failures because `arrangeSelectedGroupedNodes` did not exist and `CanvasContext.tsx` still owned the selected grouped fallback.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-arrange-selection-contract.test.ts` passed (11/11).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-arrange-selection-contract.test.ts tests/unit/prompt-group-regroup-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-context-unused-cleanup.test.ts` passed (65/65).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing allowlisted migration and legacy bridge exceptions.
- Type validation passed: `npm.cmd run typecheck` with semantic checks for 59 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1207/1207).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasArrangeSelection.ts tests/unit/canvas-arrange-selection-contract.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI helper/layout logic extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M26 Canvas Auto-Arrange Extraction

- Extracted full-canvas auto-arrange position calculation into `src/context/canvasAutoArrange.ts` as `resolveCanvasAutoArrangePositions`.
- `src/context/CanvasContext.tsx` now delegates normal prompt groups, follow-up source prompt placement, orphan prompt/image placement, and error prompt row positioning to the helper while preserving `setState`, `lastModified`, and localStorage persistence ownership in Context.
- Removed the now-unused `getCardDimensions` import from `src/context/CanvasContext.tsx`; dimension calculation moved with the helper and still uses `getCardDimensions(..., true)`.
- Added `tests/unit/canvas-auto-arrange-contract.test.ts` and included it in `tsconfig.tests.json`.
- Line counts for this slice: `src/context/CanvasContext.tsx` 2563, `src/context/canvasAutoArrange.ts` 360, `tests/unit/canvas-auto-arrange-contract.test.ts` 113, `tsconfig.tests.json` 89.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-auto-arrange-contract.test.ts` failed first with 2/2 failures because `src/context/canvasAutoArrange.ts` did not exist and `CanvasContext.tsx` still owned full-canvas auto-arrange internals.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-auto-arrange-contract.test.ts` passed (2/2).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-auto-arrange-contract.test.ts tests/unit/canvas-arrange-selection-contract.test.ts tests/unit/prompt-group-regroup-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-context-unused-cleanup.test.ts` passed (67/67).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing allowlisted migration and legacy bridge exceptions.
- Type validation passed: `npm.cmd run typecheck` with semantic checks for 60 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1209/1209).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasAutoArrange.ts tests/unit/canvas-auto-arrange-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure position-calculation extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M27 Canvas Prompt Node Updates Extraction

- Extended `src/context/canvasNodeUpdates.ts` with `addCanvasPromptNode` and `updateCanvasPromptNode`.
- `src/context/CanvasContext.tsx` now delegates prompt-node z-index promotion, duplicate prompt skip, defensive prompt/reference merge, and stale generating guards to the helper while preserving reference-image persistence, logging, notifications, `updateCanvas`, and `lastModified` ownership in Context.
- Updated `tests/unit/canvas-node-updates-contract.test.ts` with helper ownership and behavior coverage for prompt add/update reducers.
- Line counts for this slice: `src/context/CanvasContext.tsx` 2518, `src/context/canvasNodeUpdates.ts` 108, `tests/unit/canvas-node-updates-contract.test.ts` 302, `tsconfig.tests.json` 89.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-node-updates-contract.test.ts` failed first with 4/8 failures because `addCanvasPromptNode` and `updateCanvasPromptNode` did not exist and `CanvasContext.tsx` still owned the inline prompt add/update reducer logic.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-node-updates-contract.test.ts` passed (8/8).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-node-updates-contract.test.ts tests/unit/canvas-persisted-image-hydration-guard.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-prompt-child-images-runtime-contract.test.ts` passed (14/14).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing allowlisted migration and legacy bridge exceptions.
- Type validation passed: `npm.cmd run typecheck` with semantic checks for 60 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1212/1212).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasNodeUpdates.ts tests/unit/canvas-node-updates-contract.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure reducer extraction and no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M28 keyManager Model Helper Extraction

- Extracted `parseModelString`, `MODEL_MIGRATION_MAP`, `DEPRECATED_MODELS`, `normalizeModelId`, `ModelVariantMeta`, `parseModelVariantMeta`, and `appendModelVariantLabel` into `src/services/auth/keyManagerModelHelpers.ts`.
- `src/services/auth/keyManager.ts` imports the helpers for internal use and re-exports the same public helper/type names to preserve existing import paths for `App.tsx`, model caller/pricing, Gemini service, and retry-node construction.
- `src/services/auth/keyManagerEffectiveSlot.ts` now imports `parseModelString` directly from `keyManagerModelHelpers.ts`; it still imports `determineKeyType` from `keyManager.ts`, so the remaining cycle is documented for the next keyManager seam.
- Added `tests/unit/key-manager-model-helpers-contract.test.ts` and included it in `tsconfig.tests.json`.
- Line counts for this slice: `src/services/auth/keyManager.ts` 5076, `src/services/auth/keyManagerModelHelpers.ts` 194, `src/services/auth/keyManagerEffectiveSlot.ts` 99, `tests/unit/key-manager-model-helpers-contract.test.ts` 102, `tsconfig.tests.json` 90.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` failed first with 2/2 failures because `src/services/auth/keyManagerModelHelpers.ts` did not exist and `keyManager.ts` still owned inline helper exports.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` passed (2/2).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/official-route-default-models.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/provider-image-routing-regression.test.ts` passed (31/31).
- Additional reviewer-recommended targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/route-aware-credit-billing.test.ts` passed (19/19).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Type validation passed: `npm.cmd run typecheck` with semantic checks for 61 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1214/1214).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Browser QA: skipped because this is a non-UI pure service/helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.
- Follow-up debt: `src/utils/modelIdNormalization.ts` still duplicates model migration/normalization helpers and should be consolidated or parity-guarded in a later narrow slice.

## Stage Two M29 keyManager Key Type Helper Extraction

- Extracted `determineKeyType` into `src/services/auth/keyManagerKeyType.ts`.
- `src/services/auth/keyManager.ts` imports `determineKeyType` from the helper for internal use and re-exports it to preserve existing public import paths such as `src/services/billing/costService.ts`.
- `src/services/auth/keyManagerEffectiveSlot.ts` now imports `determineKeyType` from `keyManagerKeyType.ts`; this removes its remaining direct import from `keyManager.ts` and breaks the `keyManager.ts -> keyManagerEffectiveSlot.ts -> keyManager.ts` cycle.
- Added `tests/unit/key-manager-key-type-contract.test.ts`, updated `tests/unit/key-manager-model-helpers-contract.test.ts`, and included the new contract in `tsconfig.tests.json`.
- Line counts for this slice: `src/services/auth/keyManager.ts` 5070, `src/services/auth/keyManagerKeyType.ts` 10, `src/services/auth/keyManagerEffectiveSlot.ts` 99, `tests/unit/key-manager-key-type-contract.test.ts` 46, `tsconfig.tests.json` 91.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-key-type-contract.test.ts` failed first with 2/2 failures because `src/services/auth/keyManagerKeyType.ts` did not exist and `keyManager.ts` still owned inline `determineKeyType`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-key-type-contract.test.ts` passed (2/2).
- Full targeted slice gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-key-type-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/provider-strategy.test.ts tests/unit/official-route-default-models.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/provider-image-routing-regression.test.ts` passed (48/48).
- Parallel read-only reviewer gate passed: `cmd /c node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-key-type-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/provider-strategy.test.ts tests/unit/key-manager-runtime-fallback.test.ts` passed (35/35).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Type validation passed: `npm.cmd run typecheck` with semantic checks for 62 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1216/1216).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Browser QA: skipped because this is a non-UI pure service/helper extraction and no visual surface, CSS, route component, or browser-visible workflow changed.
- Follow-up debt addressed by Stage Two M30: `src/utils/modelIdNormalization.ts` duplicated model migration/normalization helpers and became the next keyManager-adjacent seam.

## Stage Two M30 modelIdNormalization Compatibility Consolidation

- Consolidated `src/utils/modelIdNormalization.ts` into a thin compatibility facade that re-exports `MODEL_MIGRATION_MAP`, `normalizeModelId`, `parseModelVariantMeta`, and `ModelVariantMeta` from `src/services/auth/keyManagerModelHelpers.ts`.
- Added `tests/unit/model-id-normalization-parity-contract.test.ts` and included it in `tsconfig.tests.json`.
- The new contract guards source ownership, canonical export identity, migration aliases, provider variant suffix normalization, and the current `fast`/quality/ratio variant parser behavior.
- Read-only model normalization review found no direct import cycle; the dependency direction risk is constrained by keeping the facade pointed at leaf-like `keyManagerModelHelpers.ts`, not `keyManager.ts`.
- Line counts for this slice: `src/utils/modelIdNormalization.ts` 6 lines, down from 84 duplicated helper lines; `src/services/auth/keyManagerModelHelpers.ts` remains 194 lines; `tests/unit/model-id-normalization-parity-contract.test.ts` 69 lines; `tsconfig.tests.json` 92 lines.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/model-id-normalization-parity-contract.test.ts` failed first with 2/2 failures because `src/utils/modelIdNormalization.ts` still declared its own migration map/parser/normalizer and the exported map was not reference-identical to the canonical helper map.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/model-id-normalization-parity-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/provider-image-routing-regression.test.ts` passed (15/15).
- Full model parsing/normalization targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/model-id-normalization-parity-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/official-route-default-models.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/provider-image-routing-regression.test.ts` passed (33/33).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage now includes 63 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1218/1218).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/utils/modelIdNormalization.ts src/services/auth/keyManagerModelHelpers.ts tests/unit/model-id-normalization-parity-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/provider-image-routing-regression.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure compatibility/helper consolidation with no visual surface, CSS, route component, or browser-visible workflow changed.

## Stage Two M31 keyManager Provider Runtime-State Merge Extraction

- Extracted `mergeCloudProvidersWithLocalRuntimeState` from the `KeyManager` class into `src/services/auth/keyManagerProviders.ts`.
- `src/services/auth/keyManager.ts` now calls the provider helper with normalized cloud providers and the current local provider list; the class no longer owns the private merge method.
- The helper preserves local `pricingSnapshot` and `activitySummary` only when the cloud provider omits those fields; cloud provider config and cloud-provided runtime fields remain authoritative.
- Provider IDs continue to match by trimmed string ID, preserving the prior runtime-state fallback behavior.
- `src/services/auth/keyManagerStorage.ts` now imports `../api/kkApiClient.ts` so Node ESM unit imports can execute the provider helper dependency graph.
- Added `tests/unit/key-manager-provider-persistence-contract.test.ts` and included it in `tsconfig.tests.json`.
- Updated `tests/unit/key-manager-runtime-fallback.test.ts` so the runtime fallback guard follows the new provider helper boundary.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4408 lines; `src/services/auth/keyManagerProviders.ts` 102 lines; `src/services/auth/keyManagerStorage.ts` 34 lines; `tests/unit/key-manager-provider-persistence-contract.test.ts` 66 lines; `tests/unit/key-manager-runtime-fallback.test.ts` 96 lines; `tsconfig.tests.json` 93 lines.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-persistence-contract.test.ts` failed first because `src/services/auth/keyManagerProviders.ts` did not export `mergeCloudProvidersWithLocalRuntimeState` and `keyManager.ts` still owned the private implementation.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-persistence-contract.test.ts tests/unit/key-manager-cloud-sync.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/user-api-cloud-storage.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/auth-data-routes.test.ts` passed (59/59).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing allowlisted migration and legacy bridge exceptions.
- Security validation passed: `npm.cmd run governance:security`.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage now includes 64 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1220/1220).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Independent spec review reported no blockers and reran `cmd /c npm run typecheck` plus focused provider persistence/runtime fallback tests (13/13).
- Independent security/code-quality review reported no findings and reran focused provider persistence/runtime fallback tests (13/13), `cmd /c npm run typecheck:tests`, and `cmd /c npm run governance:security`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerProviders.ts src/services/auth/keyManagerStorage.ts tests/unit/key-manager-provider-persistence-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure service/helper extraction with no visual surface, CSS, route component, or browser-visible workflow changed.
- Explicitly excluded scope: cloud save/load semantics, token refresh, backoff, localStorage policy, credential redaction, empty-cloud preservation guards, UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, and `OpenAICompatibleAdapter.ts`.

## Stage Two M32 keyManager Provider Linked-Slot Matching Extraction

- Extracted provider-to-legacy-slot matching into `findProviderLinkedSlots` in `src/services/auth/keyManagerProviderLinks.ts`.
- `syncLegacySlotsWithProvider` now delegates slot matching with `{ allowSingleBaseUrlFallback: true }`, preserving the previous sync-only fallback that links a single slot with the same normalized base URL when no apiKey/name match exists.
- `clearLegacySlotsForRemovedProvider` now delegates exact provider slot matching without fallback, preserving stricter removal behavior.
- Slot mutation, `saveState`, runtime/auth/model resolution, provider persistence orchestration, cloud sync, credentials, tokens, and localStorage policy remain in their previous owners.
- Added `tests/unit/key-manager-provider-links-contract.test.ts` and included it in `tsconfig.tests.json`.
- Changed `src/services/auth/keyManagerProviderLinks.ts` to import `../api/apiConfig.ts` so Node ESM contract tests can import the helper directly.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4367 lines; `src/services/auth/keyManagerProviderLinks.ts` 154 lines; `tests/unit/key-manager-provider-links-contract.test.ts` 78 lines; `tsconfig.tests.json` 94 lines.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-links-contract.test.ts` failed first with 2/2 failures because `findProviderLinkedSlots` did not exist and `keyManagerProviderLinks.ts` still imported `../api/apiConfig` without the `.ts` extension needed by Node ESM.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-links-contract.test.ts` passed (2/2).
- Broader provider/keyManager targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-links-contract.test.ts tests/unit/key-manager-provider-persistence-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/provider-strategy.test.ts tests/unit/official-route-default-models.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/user-api-cloud-storage.test.ts` passed (70/70).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing allowlisted migration and legacy bridge exceptions.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage now includes 65 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1222/1222).
- Build validation passed: `npm.cmd run build`.
- Security validation passed: `npm.cmd run governance:security`.
- Review fix: independent spec and security review both caught that fallback must not use `previousProvider.baseUrl` when current `provider.baseUrl` is blank. The helper now falls back only through the original first provider base URL, and the contract test covers the blank-current/previous-old-base case.
- Post-review targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-links-contract.test.ts tests/unit/key-manager-provider-persistence-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/provider-strategy.test.ts tests/unit/official-route-default-models.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/user-api-cloud-storage.test.ts` passed (70/70).
- Post-review type validation passed: `npm.cmd run typecheck`; semantic test coverage remains 65 test files.
- Post-review security validation passed: `npm.cmd run governance:security`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerProviderLinks.ts tests/unit/key-manager-provider-links-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/key-manager-provider-persistence-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI pure service/helper extraction with no visual surface, CSS, route component, or browser-visible workflow changed.
- Explicitly excluded scope: slot mutation semantics, provider save/remove side effects, `saveState`, model/runtime/auth resolution, credential persistence, token refresh, cloud sync, localStorage policy, UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, and `OpenAICompatibleAdapter.ts`.

## Stage Two M33 keyManager Provider Usage Helper Extraction

- Extracted `isUsageLimitExceeded` and provider usage delta math into `src/services/auth/keyManagerProviderUsage.ts`.
- `src/services/auth/keyManager.ts` now delegates slot/provider usage limit checks and provider usage counter mutation to the helper.
- The helper preserves budget/token limit checks, usage initialization, daily reset, total/daily clamping, and `updatedAt` mutation behavior.
- `KeyManager` still owns provider lookup, provider loading, save/notify/cloud-sync orchestration, credential policy, token refresh, backoff, localStorage policy, slot mutation, and runtime/model resolution.
- Added `tests/unit/key-manager-provider-usage-contract.test.ts` and included it in `tsconfig.tests.json`.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4948 lines; `src/services/auth/keyManagerProviderUsage.ts` 67 lines; `tests/unit/key-manager-provider-usage-contract.test.ts` 99 lines; `tsconfig.tests.json` 95 lines.
- TDD evidence: RED was verified earlier in this slice by the contract failing before `src/services/auth/keyManagerProviderUsage.ts` existed and while `keyManager.ts` still owned the private usage helper; GREEN is refreshed below with the targeted provider/keyManager gate and full required validation.
- Independent spec/code-quality review reported no M33 blockers and confirmed no secret-bearing persistence, API key/token logging, or provider lookup/save/cloud-sync movement was introduced.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-usage-contract.test.ts tests/unit/key-manager-provider-links-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/key-manager-provider-persistence-contract.test.ts` passed (17/17).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy-zone bridge exceptions.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage now includes 66 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1224/1224).
- Build validation passed: `npm.cmd run build`.
- Security validation passed: `npm.cmd run governance:security`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerProviderUsage.ts tests/unit/key-manager-provider-usage-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M33 is a non-UI service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerProviderUsage.ts`, `tests/unit/key-manager-provider-usage-contract.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, credential storage, token/backoff behavior, and broad dead-code cleanup.

## Stage Two M34 keyManager Route ID Helper Extraction

- Extracted `extractSlotRouteTarget`, `decodeRouteSuffix`, `matchesSlotRouteSuffix`, `matchesProviderRouteSuffix`, `buildStableSystemRouteId`, `buildUserSlotRouteId`, and `buildProviderRouteId` into `src/services/auth/keyManagerRouteIds.ts`.
- `src/services/auth/keyManager.ts` now imports those pure helpers and retains routing selection, model filtering, slot/provider lookup, provider load/save, cloud sync, credential policy, token refresh, backoff, localStorage policy, and persistence orchestration.
- The helper preserves legacy suffix behavior, including trim/lowercase-before-decode, malformed percent-encoding fallback, `slot_key_*` target extraction, provider-prefixed route targets, slot id/name/provider/serverName matching, provider id/name matching, and encoded route ID builders.
- Added `tests/unit/key-manager-route-ids-contract.test.ts` and included it in `tsconfig.tests.json`.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4870 lines; `src/services/auth/keyManagerRouteIds.ts` 94 lines; `tests/unit/key-manager-route-ids-contract.test.ts` 97 lines; `tsconfig.tests.json` 96 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-route-ids-contract.test.ts` failed first (0/3) because `src/services/auth/keyManagerRouteIds.ts` did not exist and `keyManager.ts` still owned the local helpers.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-route-ids-contract.test.ts` passed (3/3).
- Broader route/provider targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-route-ids-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/official-route-default-models.test.ts tests/unit/key-manager-provider-links-contract.test.ts` passed (21/21).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy-zone bridge exceptions.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage now includes 67 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1227/1227).
- Build validation passed: `npm.cmd run build`.
- Security validation passed: `npm.cmd run governance:security`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerRouteIds.ts tests/unit/key-manager-route-ids-contract.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M34 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerRouteIds.ts`, `tests/unit/key-manager-route-ids-contract.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, channel-config key non-exposure hardening, credential sanitizer cleanup, provider persistence redesign, cloud sync movement, token/backoff behavior, and broad dead-code cleanup.

## Stage Two M35 keyManager Credential Sanitizer Extraction

- Extracted the duplicated ASCII API-key sanitizer into `src/services/auth/keyManagerCredentialSanitizer.ts`.
- `src/services/auth/keyManager.ts` now delegates the `testChannel` clean key path and `addKey` trimmed key path to `sanitizeAsciiApiKey`.
- The helper preserves the existing behavior exactly: remove non-ASCII characters first, then trim whitespace.
- Credential storage, provider persistence, cloud sync, browser diagnostics fail-closed policy, runtime routing, token refresh, backoff, and localStorage policy remain in their previous owners.
- Added `tests/unit/key-manager-credential-sanitizer-contract.test.ts` and included it in `tsconfig.tests.json`.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4871 lines; `src/services/auth/keyManagerCredentialSanitizer.ts` 3 lines; `tests/unit/key-manager-credential-sanitizer-contract.test.ts` 43 lines; `tsconfig.tests.json` 97 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-credential-sanitizer-contract.test.ts` failed first (0/2) because `src/services/auth/keyManagerCredentialSanitizer.ts` did not exist and `keyManager.ts` still owned the duplicated sanitizer expression.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-credential-sanitizer-contract.test.ts` passed (2/2).
- Broader credential/security targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-credential-sanitizer-contract.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/official-route-default-models.test.ts tests/unit/key-manager-key-type-contract.test.ts` passed (16/16).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy-zone bridge exceptions.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage now includes 68 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1229/1229).
- Build validation passed: `npm.cmd run build`.
- Security validation passed: `npm.cmd run governance:security`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerCredentialSanitizer.ts tests/unit/key-manager-credential-sanitizer-contract.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M35 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerCredentialSanitizer.ts`, `tests/unit/key-manager-credential-sanitizer-contract.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, channel-config key non-exposure hardening, provider persistence redesign, cloud sync movement, token/backoff behavior, localStorage policy changes, and broad dead-code cleanup.

## Stage Two M36 keyManager Channel Config Secret Redaction Extraction

- Extracted channel config API-key redaction into `src/services/auth/keyManagerChannelConfigSecrets.ts`.
- `src/services/auth/keyManager.ts` now uses `getRedactedChannelConfigApiKey()` for both slot and provider channel config `apiKey` fields instead of hard-coded empty strings.
- The helper preserves the existing public channel config behavior: channel configs never expose stored slot or provider API keys.
- Existing `tests/unit/frontend-key-boundary-hardening.test.ts` now asserts the redaction helper is used and that the old literal `apiKey: ''` pattern does not return to `keyManager.ts`.
- Credential storage, provider persistence, cloud sync, browser diagnostics fail-closed policy, runtime routing, token refresh, backoff, localStorage policy, and channel config construction remain in their previous owners.
- Added `tests/unit/key-manager-channel-config-secrets-contract.test.ts` and included it in `tsconfig.tests.json`.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4872 lines; `src/services/auth/keyManagerChannelConfigSecrets.ts` 3 lines; `tests/unit/key-manager-channel-config-secrets-contract.test.ts` 39 lines; `tsconfig.tests.json` 98 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-channel-config-secrets-contract.test.ts` failed first (0/2) because `src/services/auth/keyManagerChannelConfigSecrets.ts` did not exist and `keyManager.ts` still owned hard-coded channel `apiKey: ''` fields.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-channel-config-secrets-contract.test.ts` passed (2/2).
- Broader channel/security targeted gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-channel-config-secrets-contract.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/official-route-default-models.test.ts` passed (25/25).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy-zone bridge exceptions.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage now includes 69 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1231/1231).
- Build validation passed: `npm.cmd run build`.
- Security validation passed: `npm.cmd run governance:security`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerChannelConfigSecrets.ts tests/unit/key-manager-channel-config-secrets-contract.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M36 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerChannelConfigSecrets.ts`, `tests/unit/key-manager-channel-config-secrets-contract.test.ts`, `tests/unit/frontend-key-boundary-hardening.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, token/backoff behavior, localStorage policy changes, and broad dead-code cleanup.

## Stage Two M37 keyManager Dead-Code Pruning

- Removed three source-proven unused local definitions from `src/services/auth/keyManager.ts`: `isLegacyGoogleModelList`, private `migrateFromOldFormat`, and local `getDefaultGoogleModels`.
- Added `tests/unit/key-manager-dead-code-pruning-contract.test.ts` to keep those local helper definitions from returning, and included it in `tsconfig.tests.json`.
- Reference proof: `rg -n "isLegacyGoogleModelList|migrateFromOldFormat|getDefaultGoogleModels" . -g "!node_modules/**" -g "!dist/**"` now only finds the pruning contract.
- Read-only scope review by subagent Peirce found no accidental broad cleanup, no exported API removal, no UI/release/provider-routing/runtime changes, and no key storage regression in the edited area.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4252 lines; `tests/unit/key-manager-dead-code-pruning-contract.test.ts` 16 lines; `tsconfig.tests.json` 99 lines.
- TDD RED evidence was verified earlier in this slice: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-dead-code-pruning-contract.test.ts` failed before the three definitions were deleted.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-dead-code-pruning-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/official-route-default-models.test.ts tests/unit/governance-contract.test.ts` passed (21/21).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy-zone bridge exceptions.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage now includes 70 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1232/1232).
- Build validation passed: `npm.cmd run build`.
- Security validation passed: `npm.cmd run governance:security`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts tests/unit/key-manager-dead-code-pruning-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M37 is a non-UI dead-code pruning slice with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `tests/unit/key-manager-dead-code-pruning-contract.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, localStorage policy changes, and exported API cleanup.

## Stage Two M38 keyManager Browser Diagnostics Message Wrapper Pruning

- Removed the private `getBrowserDirectProviderChecksDisabledMessage()` wrapper from `src/services/auth/keyManager.ts`.
- `testChannel`, `validateKey`, and `syncProviderPricingDetailed` now return `BROWSER_DIRECT_PROVIDER_CHECKS_DISABLED_MESSAGE` directly for browser-runtime diagnostics blocks.
- `src/services/auth/keyManagerStorage.ts` remains the single owner of the disabled browser-direct diagnostics message and disabled-error factory.
- `tests/unit/frontend-key-boundary-hardening.test.ts` now asserts the wrapper stays absent and that the three browser-runtime diagnostic returns use the storage-owned constant directly.
- Credential storage, provider persistence, cloud sync, channel config construction, runtime routing, token refresh, backoff, localStorage policy, and exported fetch helper fail-closed behavior remain unchanged.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4249 lines; `tests/unit/frontend-key-boundary-hardening.test.ts` 216 lines; `tsconfig.tests.json` 99 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/frontend-key-boundary-hardening.test.ts` failed first because `private getBrowserDirectProviderChecksDisabledMessage(): string` still existed.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/key-manager-dead-code-pruning-contract.test.ts tests/unit/key-manager-channel-config-secrets-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/official-route-default-models.test.ts` passed (26/26).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy-zone bridge exceptions.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage remains 70 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1232/1232).
- Build validation passed: `npm.cmd run build`.
- Security validation passed: `npm.cmd run governance:security`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts tests/unit/frontend-key-boundary-hardening.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M38 is a non-UI diagnostics-source cleanup with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `tests/unit/frontend-key-boundary-hardening.test.ts`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, localStorage policy changes, and exported API cleanup.

## Stage Two M39 keyManager Legacy Google Model Constant Pruning

- Removed the now-unreferenced `LEGACY_GOOGLE_MODELS` constant from `src/services/auth/keyManager.ts`.
- Extended `tests/unit/key-manager-dead-code-pruning-contract.test.ts` so the legacy constant cannot return alongside the previously pruned unused helpers.
- Source reference proof: `rg -n "LEGACY_GOOGLE_MODELS|isLegacyGoogleModelList|migrateFromOldFormat|getDefaultGoogleModels" src tests -g "!node_modules/**" -g "!dist/**"` now finds `LEGACY_GOOGLE_MODELS` only in the pruning contract.
- Read-only subagent review independently identified the same constant as the next safest source-proven cleanup and did not recommend entering key storage, cloud sync, provider persistence, or credential management.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4247 lines; `tests/unit/key-manager-dead-code-pruning-contract.test.ts` 17 lines; `tsconfig.tests.json` 99 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-dead-code-pruning-contract.test.ts` failed first because `const LEGACY_GOOGLE_MODELS =` still existed.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-dead-code-pruning-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/official-route-default-models.test.ts tests/unit/governance-contract.test.ts` passed (21/21).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy-zone bridge exceptions.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage remains 70 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1232/1232).
- Build validation passed: `npm.cmd run build`.
- Security validation passed: `npm.cmd run governance:security`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Source reference check passed: `rg -n "LEGACY_GOOGLE_MODELS|isLegacyGoogleModelList|migrateFromOldFormat|getDefaultGoogleModels" src tests -g "!node_modules/**" -g "!dist/**"` finds only pruning-contract assertions.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts tests/unit/key-manager-dead-code-pruning-contract.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M39 is a non-UI source-proven constant pruning slice with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `tests/unit/key-manager-dead-code-pruning-contract.test.ts`, `plans.md`, `implement.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, localStorage policy changes, and exported API cleanup.

## Stage Two M40 keyManager Pricing Model ID Extraction Helper Split

- Moved the pure `extractModelIdsFromPricingData` helper from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerModelHelpers.ts`.
- `src/services/auth/keyManager.ts` now imports the helper but does not re-export it, preserving the existing public `keyManager.ts` API surface.
- Extended `tests/unit/key-manager-model-helpers-contract.test.ts` to assert helper ownership and preserve non-array handling, candidate priority, `models/` prefix stripping order, whitespace trim, empty filtering, and first-seen dedupe behavior.
- Read-only subagent review confirmed this is the safest next M40 seam and explicitly warned not to merge the adjacent shared pricing cache/snapshot ID resolver in this slice.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4228 lines; `src/services/auth/keyManagerModelHelpers.ts` 197 lines; `tests/unit/key-manager-model-helpers-contract.test.ts` 121 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` failed first because `keyManagerModelHelpers.ts` did not export `extractModelIdsFromPricingData`.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` passed (3/3).
- Model helper/keyManager regression validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/model-id-normalization-parity-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/official-route-default-models.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/provider-image-routing-regression.test.ts` passed (34/34).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy-zone bridge exceptions.
- Security validation passed: `npm.cmd run governance:security`.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage remains 70 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1233/1233).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Source ownership check passed: `rg -n "function extractModelIdsFromPricingData|extractModelIdsFromPricingData" src/services/auth/keyManager.ts src/services/auth/keyManagerModelHelpers.ts tests/unit/key-manager-model-helpers-contract.test.ts` shows the function definition only in `keyManagerModelHelpers.ts`, with one `keyManager.ts` import and one runtime call.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerModelHelpers.ts tests/unit/key-manager-model-helpers-contract.test.ts plans.md implement.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M40 is a non-UI pure helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerModelHelpers.ts`, `tests/unit/key-manager-model-helpers-contract.test.ts`, `plans.md`, `implement.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, localStorage policy changes, and exported API cleanup.

## Stage Two M41 keyManager Model Category Helper Split

- Moved the pure public `categorizeModels` helper from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerModelHelpers.ts`.
- `src/services/auth/keyManager.ts` now imports the helper and re-exports it from the compatibility barrel, preserving the existing public API.
- Extended `tests/unit/key-manager-model-helpers-contract.test.ts` to assert helper ownership, compatibility re-export, video-first category precedence, image/chat/other heuristics, and hybrid category behavior.
- Read-only seam review independently selected this as the safest M41 seam and confirmed the call sites to preserve: channel capability grouping and auto-detect category output.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4172 lines; `src/services/auth/keyManagerModelHelpers.ts` 255 lines; `tests/unit/key-manager-model-helpers-contract.test.ts` 151 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` failed first because `categorizeModels` was still owned by `keyManager.ts`.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` passed (4/4).
- Model helper/keyManager regression validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/model-id-normalization-parity-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/official-route-default-models.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/provider-image-routing-regression.test.ts` passed (35/35).
- Architecture validation passed: `npm.cmd run architecture:check` with only the existing 5 allowlisted migration exceptions and 2 legacy-zone bridge exceptions.
- Security validation passed: `npm.cmd run governance:security`.
- Type validation passed: `npm.cmd run typecheck`; semantic test coverage remains 70 test files.
- Unit validation passed: `npm.cmd run test:unit` passed (1234/1234).
- Build validation passed: `npm.cmd run build`.
- Agent-doc validation passed: `npm.cmd run governance:agent-docs`.
- Encoding validation passed: `npm.cmd run check:encoding`.
- Source ownership check passed: `rg -n "export function categorizeModels|categorizeModels" src/services/auth/keyManager.ts src/services/auth/keyManagerModelHelpers.ts tests/unit/key-manager-model-helpers-contract.test.ts` shows the function definition only in `keyManagerModelHelpers.ts`, with `keyManager.ts` import/re-export and runtime call sites preserved.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerModelHelpers.ts tests/unit/key-manager-model-helpers-contract.test.ts plans.md implement.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M41 is a non-UI pure helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerModelHelpers.ts`, `tests/unit/key-manager-model-helpers-contract.test.ts`, `plans.md`, `implement.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, localStorage policy changes, and exported API cleanup.

## Stage Two M42 keyManager Model Type Inference Helper Split

- Moved the pure `inferModelType` classifier and `GlobalModelType` type from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerModelHelpers.ts`.
- `src/services/auth/keyManager.ts` now imports the classifier and type from the helper module and re-exports `GlobalModelType` for compatibility.
- Extended `tests/unit/key-manager-model-helpers-contract.test.ts` to assert helper ownership and preserve video-first, image, audio, chat, OpenRouter, and default-chat inference behavior.
- Updated `tests/unit/google-official-gemini-protocol-guards.test.ts` so its TTS routing source-contract follows the moved classifier owner in `keyManagerModelHelpers.ts`.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4720 lines; `src/services/auth/keyManagerModelHelpers.ts` 333 lines; `tests/unit/key-manager-model-helpers-contract.test.ts` 183 lines; `tests/unit/google-official-gemini-protocol-guards.test.ts` 58 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` failed first because `inferModelType` and `GlobalModelType` were still owned by `keyManager.ts`.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` passed (5/5).
- Source-contract owner validation passed after the moved TTS heuristic assertion was updated: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/google-official-gemini-protocol-guards.test.ts tests/unit/key-manager-model-helpers-contract.test.ts` passed (8/8).
- Browser QA: skipped because M42 is a non-UI pure helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerModelHelpers.ts`, `tests/unit/key-manager-model-helpers-contract.test.ts`, `tests/unit/google-official-gemini-protocol-guards.test.ts`, `plans.md`, `implement.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, localStorage policy changes, and exported API cleanup.

## Stage Two M43 keyManager Silent Pricing URL Helper Split

- Moved the pure silent provider pricing URL normalization from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerPricingUrl.ts`.
- `src/services/auth/keyManager.ts` now calls `buildSilentProviderPricingUrl(cleanUrl)` while preserving the existing non-blocking pricing fetch, headers, pricing override application, and local error handling.
- Added `tests/unit/key-manager-pricing-url-contract.test.ts` to guard helper ownership and preserve marketing-suffix stripping, trailing-slash trimming, `/v1` removal, and final `/pricing` endpoint behavior.
- Added the pricing URL contract to `tsconfig.tests.json`.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4714 lines; `src/services/auth/keyManagerPricingUrl.ts` 12 lines; `tests/unit/key-manager-pricing-url-contract.test.ts` 48 lines; `tsconfig.tests.json` 100 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-pricing-url-contract.test.ts` failed first because `src/services/auth/keyManagerPricingUrl.ts` did not exist and `keyManager.ts` still owned inline pricing URL construction.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-pricing-url-contract.test.ts` passed (2/2).
- Targeted M43 regression gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-pricing-url-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/user-route-pricing-endpoint-override.test.ts tests/unit/kk-api-client.test.ts` passed (37/37).
- Passed: `npm.cmd run architecture:check` with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Passed: `npm.cmd run governance:security`.
- Passed: `npm.cmd run typecheck`; test semantic check now covers 71 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1237/1237).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Source ownership check passed: `rg -n "PROVIDER_MARKETING_SUFFIX_RE|buildSilentProviderPricingUrl|sanitizedPricingBase|const pricingUrl =" src/services/auth/keyManager.ts src/services/auth/keyManagerPricingUrl.ts tests/unit/key-manager-pricing-url-contract.test.ts` shows the regex and normalization internals only in `keyManagerPricingUrl.ts`, with `keyManager.ts` limited to import and call.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerPricingUrl.ts tests/unit/key-manager-pricing-url-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M43 is a non-UI pure helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerPricingUrl.ts`, `tests/unit/key-manager-pricing-url-contract.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, localStorage policy changes, and exported API cleanup.

## Stage Two M44 keyManager Deprecated-Model Helper Split

- Moved the pure `isDeprecatedModel` membership helper from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerModelHelpers.ts`.
- `src/services/auth/keyManager.ts` now imports and re-exports `isDeprecatedModel` from the helper module, preserving the existing public import path.
- Extended `tests/unit/key-manager-model-helpers-contract.test.ts` to assert helper ownership, compatibility re-export, and exact case-sensitive `DEPRECATED_MODELS.includes(modelId)` behavior.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4709 lines; `src/services/auth/keyManagerModelHelpers.ts` 337 lines; `tests/unit/key-manager-model-helpers-contract.test.ts` 196 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` failed first because `isDeprecatedModel` was still owned by `keyManager.ts` and was not exported from `keyManagerModelHelpers.ts`.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` passed (6/6).
- Model-helper validation gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/model-id-normalization-parity-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/google-official-gemini-protocol-guards.test.ts` passed (37/37).
- Architecture and security gates passed: `npm.cmd run architecture:check` passed; `npm.cmd run governance:security` passed.
- Full validation passed for this slice: `npm.cmd run typecheck`, `npm.cmd run test:unit` (1238/1238), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- plans.md implement.md status.md src/services/auth/keyManager.ts src/services/auth/keyManagerModelHelpers.ts tests/unit/key-manager-model-helpers-contract.test.ts`.
- Ownership check passed: `rg -n "isDeprecatedModel" src/services/auth/keyManager.ts src/services/auth/keyManagerModelHelpers.ts tests/unit/key-manager-model-helpers-contract.test.ts` shows the helper implementation only in `src/services/auth/keyManagerModelHelpers.ts`; `src/services/auth/keyManager.ts` keeps only import and compatibility re-export references.
- Browser QA: skipped because M44 is a non-UI pure helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerModelHelpers.ts`, `tests/unit/key-manager-model-helpers-contract.test.ts`, `plans.md`, `implement.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, model filtering semantics, localStorage policy changes, and exported API cleanup.

## Stage Two M45 keyManager 12AI Base URL Dead-Code Pruning

- Removed the source-proven unused private `get12AIBaseUrl` wrapper from `src/services/auth/keyManager.ts`.
- Removed the now-unused `RegionService` import from `src/services/auth/keyManager.ts`.
- Kept the actual 12AI runtime URL source of truth unchanged in `src/services/system/RegionService.ts`; `src/services/llm/OpenAICompatibleAdapter.ts` still imports and calls `RegionService.get12AIBaseUrl()` directly.
- Extended `tests/unit/key-manager-dead-code-pruning-contract.test.ts` with absence assertions for the local wrapper and import.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4701 lines; `tests/unit/key-manager-dead-code-pruning-contract.test.ts` 23 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-dead-code-pruning-contract.test.ts` failed first because the `RegionService` import and `get12AIBaseUrl` wrapper still existed in `keyManager.ts`.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-dead-code-pruning-contract.test.ts` passed (1/1).
- Architecture and security gates passed: `npm.cmd run architecture:check` passed; `npm.cmd run governance:security` passed.
- Full validation passed for this slice: `npm.cmd run typecheck`, `npm.cmd run test:unit` (1238/1238), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- plans.md implement.md status.md src/services/auth/keyManager.ts tests/unit/key-manager-dead-code-pruning-contract.test.ts`.
- Ownership check passed: `rg -n "RegionService|get12AIBaseUrl" src/services/auth/keyManager.ts tests/unit/key-manager-dead-code-pruning-contract.test.ts src/services/system/RegionService.ts src/services/llm/OpenAICompatibleAdapter.ts` shows no `RegionService` or `get12AIBaseUrl` reference in `src/services/auth/keyManager.ts`; the remaining live runtime calls are in `src/services/llm/OpenAICompatibleAdapter.ts`.
- Read-only subagent risk review found no blocker: `get12AIBaseUrl` had no key-manager call sites, while global `RegionService` must remain because `OpenAICompatibleAdapter.ts` has live direct callers.
- Browser QA: skipped because M45 is a non-UI source-proven dead-code pruning slice with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `tests/unit/key-manager-dead-code-pruning-contract.test.ts`, `plans.md`, `implement.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, 12AI runtime URL resolution, model filtering semantics, localStorage policy changes, and exported API cleanup.

## Stage Two M46 keyManager Google Official Model Predicate Split

- Moved the pure `isGoogleOfficialModelId` predicate from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerModelHelpers.ts`.
- `src/services/auth/keyManager.ts` now imports the predicate from the helper and re-exports it from the compatibility facade.
- Preserved the existing behavior exactly: case-sensitive `models/` prefix stripping, lowercased prefix matching, no trimming, and `gemini-` / `imagen-` / `veo-` pass conditions.
- Extended `tests/unit/key-manager-model-helpers-contract.test.ts` to assert helper ownership, facade re-export, no helper back-edge to `keyManager.ts`, and predicate behavior for `models/gemini-*`, uppercase model IDs, image/video prefixes, non-Google IDs, uppercase `Models/` prefix, and leading whitespace.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4698 lines; `src/services/auth/keyManagerModelHelpers.ts` 342 lines; `tests/unit/key-manager-model-helpers-contract.test.ts` 215 lines.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` failed first because `keyManager.ts` still owned `isGoogleOfficialModelId` and the helper did not export it.
- Review RED evidence: after the initial move, the same targeted command failed because `keyManager.ts` did not yet re-export `isGoogleOfficialModelId` from the compatibility facade.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-helpers-contract.test.ts` passed (7/7).
- Model-helper validation gate passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/model-id-normalization-parity-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/google-official-gemini-protocol-guards.test.ts` passed (23/23).
- Architecture and security gates passed: `npm.cmd run architecture:check` passed; `npm.cmd run governance:security` passed.
- Full validation passed for this slice: `npm.cmd run typecheck`, `npm.cmd run test:unit` (1239/1239), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- plans.md implement.md status.md src/services/auth/keyManager.ts src/services/auth/keyManagerModelHelpers.ts tests/unit/key-manager-model-helpers-contract.test.ts`.
- Ownership check passed: `rg -n "isGoogleOfficialModelId" src/services/auth/keyManager.ts src/services/auth/keyManagerModelHelpers.ts tests/unit/key-manager-model-helpers-contract.test.ts` shows the helper implementation only in `src/services/auth/keyManagerModelHelpers.ts`; `src/services/auth/keyManager.ts` keeps import/re-export references and the three preserved model-list filtering call sites.
- Read-only subagent risk review found only the missing facade re-export; current owner/call-site review confirmed the predicate had three `keyManager.ts` call sites and no external production callers before extraction.
- Browser QA: skipped because M46 is a non-UI pure model predicate extraction with no component, CSS, route, or browser-visible workflow changes.
- Commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerModelHelpers.ts`, `tests/unit/key-manager-model-helpers-contract.test.ts`, `plans.md`, `implement.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, model-list filtering call sites, 12AI runtime URL resolution, localStorage policy changes, and exported API cleanup beyond the compatibility facade.

## Stage Two M47 keyManager Channel Capabilities Helper Split

- Moved the pure `buildChannelCapabilities` helper from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerChannelCapabilities.ts`.
- `src/services/auth/keyManager.ts` now imports the helper and delegates both slot and provider channel config capability construction through it.
- Preserved the existing behavior exactly: raw `'*'` wildcard enables all core modalities; empty or non-array model lists keep `chat: true`; non-empty unknown models do not imply chat; pipe/parenthetical display names are parsed before category checks; `pricingDiscovery` and `managementApi` only follow native support flags; audio uses the historical `/audio|tts|suno|lyria|minimax-t2a/i` regex.
- Added `tests/unit/key-manager-channel-capabilities-contract.test.ts` and included it in `tsconfig.tests.json`.
- Contract coverage guards helper ownership, no back-edge to `keyManager.ts` or storage/persistence/UI/adapter modules, both `keyManager.ts` call sites, empty/null/undefined inputs, exact wildcard behavior, parsed model category precedence, support-flag mapping, and audio positive/negative parity cases.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4682 lines; `src/services/auth/keyManagerChannelCapabilities.ts` 23 lines; `tests/unit/key-manager-channel-capabilities-contract.test.ts` 173 lines; `tsconfig.tests.json` 101 lines.
- Initial targeted RED/GREEN note: this slice was already in-progress when resumed; the first local targeted run failed only on a contract regex that falsely matched `keyManagerModelHelpers` and a Node direct-import extension issue, then passed after the minimal fixes.
- Targeted GREEN validation passed after review hardening: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-channel-capabilities-contract.test.ts` passed (2/2).
- Read-only subagent risk review found no implementation delta from the old private method, then requested stronger negative capability parity coverage; the negative cases were added before the final gate.
- Architecture and security gates passed: `npm.cmd run architecture:check` passed with existing allowlisted exceptions; `npm.cmd run governance:security` passed.
- Full validation passed for this slice: `npm.cmd run typecheck`; `npm.cmd run test:unit` (1241/1241); `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerChannelCapabilities.ts tests/unit/key-manager-channel-capabilities-contract.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only.
- Browser QA: skipped because M47 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerChannelCapabilities.ts`, `tests/unit/key-manager-channel-capabilities-contract.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior beyond the pure capabilities builder, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, model-list filtering call sites, 12AI runtime URL resolution, localStorage policy changes, and exported API cleanup.

## Stage Two M48 keyManager API Type Detector Helper Split

- Moved the pure `detectApiType` string classifier from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerApiType.ts`.
- `src/services/auth/keyManager.ts` now imports `detectApiType` for `autoDetectAndConfigureModels` and re-exports it for compatibility.
- Preserved the existing behavior exactly: `AIza` keys or lowercase Google API substrings classify as `google-official`; `sk-` keys with no base URL or an `api.openai.com` base classify as `openai`; any other non-empty non-Google base URL classifies as `proxy`; otherwise the result is `unknown`. Historical case-sensitive substring matching and no trimming are intentionally locked.
- Added `tests/unit/key-manager-api-type-contract.test.ts` and included it in `tsconfig.tests.json`.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-api-type-contract.test.ts` failed first because `src/services/auth/keyManagerApiType.ts` did not exist and `keyManager.ts` still owned the inline exported function.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-api-type-contract.test.ts` passed (2/2).
- Adjacent targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-api-type-contract.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/key-manager-channel-capabilities-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts` passed (18/18).
- Architecture and security gates passed: `npm.cmd run architecture:check` passed with existing allowlisted exceptions; `npm.cmd run governance:security` passed.
- Full validation passed for this slice: `npm.cmd run typecheck`; `npm.cmd run test:unit` (1243/1243); `npm.cmd run build`.
- Agent-doc and encoding validation passed: `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- plans.md implement.md status.md src/services/auth/keyManager.ts src/services/auth/keyManagerApiType.ts tests/unit/key-manager-api-type-contract.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4662 lines; `src/services/auth/keyManagerApiType.ts` 23 lines; `tests/unit/key-manager-api-type-contract.test.ts` 50 lines; `tsconfig.tests.json` 102 lines.
- Browser QA: skipped because M48 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerApiType.ts`, `tests/unit/key-manager-api-type-contract.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, remote model fetch behavior, model-list filtering call sites, 12AI runtime URL resolution, localStorage policy changes, and exported API cleanup beyond the compatibility facade.

## Stage Two M49 keyManager Default Model Constants Helper Split

- Moved default/whitelist model constants from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerDefaultModels.ts`.
- `src/services/auth/keyManager.ts` now imports only the internally used `DEFAULT_GOOGLE_MODELS`, `DEFAULT_OPENAI_MODELS`, and `GOOGLE_IMAGE_WHITELIST`, and re-exports all six constants for compatibility: `GOOGLE_IMAGE_WHITELIST`, `VIDEO_MODEL_WHITELIST`, `ADVANCED_IMAGE_MODEL_WHITELIST`, `AUDIO_MODEL_WHITELIST`, `DEFAULT_GOOGLE_MODELS`, and `DEFAULT_OPENAI_MODELS`.
- Preserved the existing values exactly, including `VIDEO_MODEL_WHITELIST` value `sv3d`, `DEFAULT_OPENAI_MODELS = ['dall-e-3', 'dall-e-2', 'gpt-4o', 'gpt-4o-mini']`, and `DEFAULT_GOOGLE_MODELS` spreading `GOOGLE_IMAGE_WHITELIST`.
- Added `tests/unit/key-manager-default-models-contract.test.ts` and included it in `tsconfig.tests.json`.
- Updated `tests/unit/official-route-default-models.test.ts` so the official route default-model contract reads constants from the new helper while preserving the `keyManager.ts` routing behavior assertions.
- RED evidence from the resumed WIP: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-default-models-contract.test.ts tests/unit/official-route-default-models.test.ts` initially failed because `src/services/auth/keyManagerDefaultModels.ts` did not exist and constants still lived inline in `keyManager.ts`.
- Targeted GREEN validation passed after implementation and test expectation correction: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-default-models-contract.test.ts tests/unit/official-route-default-models.test.ts` passed (7/7).
- Adjacent keyManager/provider targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-default-models-contract.test.ts tests/unit/official-route-default-models.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/twelve-ai-doc-alignment.test.ts` passed (24/24).
- Architecture and security gates passed: `npm.cmd run architecture:check` passed with existing allowlisted exceptions; `npm.cmd run governance:security` passed.
- Full validation passed for this slice: `npm.cmd run typecheck`; `npm.cmd run test:unit` (1245/1245); `npm.cmd run build`.
- Agent-doc and encoding validation passed: `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- plans.md implement.md validation.md status.md src/services/auth/keyManager.ts src/services/auth/keyManagerDefaultModels.ts tests/unit/key-manager-default-models-contract.test.ts tests/unit/official-route-default-models.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4622 lines; `src/services/auth/keyManagerDefaultModels.ts` 53 lines; `tests/unit/key-manager-default-models-contract.test.ts` 79 lines; `tsconfig.tests.json` 103 lines.
- Subagent read-only review found no behavior drift and flagged one staging risk: the new helper must be tracked with `keyManager.ts`; this commit scope includes it.
- Browser QA: skipped because M49 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerDefaultModels.ts`, `tests/unit/key-manager-default-models-contract.test.ts`, `tests/unit/official-route-default-models.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, remote model fetch behavior, model-list filtering call sites, 12AI runtime URL resolution, localStorage policy changes, and exported API cleanup beyond the compatibility facade.

## Stage Two M50 keyManager Provider Presets Helper Split

- Moved provider preset data from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerProviderPresets.ts`.
- `src/services/auth/keyManager.ts` now imports `PROVIDER_PRESETS` for provider creation and documented 12AI model fallback, and re-exports it for compatibility.
- Preserved the existing preset order and values, including `openclaw.defaultApiKey`, `custom.format = 'auto'`, `12ai`/`12ai-nanobanana` Gemini preset models, Flow2API defaults, and Wuyin NanoBanana2 defaults.
- Added `tests/unit/key-manager-provider-presets-contract.test.ts` and included it in `tsconfig.tests.json`.
- Updated `tests/unit/twelve-ai-doc-alignment.test.ts` and `tests/unit/flow2api-provider-support.test.ts` so preset-content assertions follow the new helper while `keyManager.ts` still owns runtime mapping behavior checks.
- TDD RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-presets-contract.test.ts tests/unit/twelve-ai-doc-alignment.test.ts` failed first because `src/services/auth/keyManagerProviderPresets.ts` did not exist and `keyManager.ts` still owned the inline `PROVIDER_PRESETS` block.
- Targeted GREEN validation passed after implementation and adjacent contract updates: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-presets-contract.test.ts tests/unit/twelve-ai-doc-alignment.test.ts tests/unit/flow2api-provider-support.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/official-route-default-models.test.ts` passed (25/25).
- Architecture and security gates passed: `npm.cmd run architecture:check` passed with existing allowlisted exceptions; `npm.cmd run governance:security` passed.
- Typecheck initially failed because the helper used `satisfies` and lost the old string index signature for `PROVIDER_PRESETS[presetKey]`; the helper now exports `Record<string, KeyManagerProviderPreset>` to preserve old dynamic preset-key lookup behavior.
- Full validation passed for this slice: `npm.cmd run typecheck`; `npm.cmd run test:unit` (1247/1247); `npm.cmd run build`.
- Agent-doc and encoding validation passed: `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerProviderPresets.ts tests/unit/key-manager-provider-presets-contract.test.ts tests/unit/twelve-ai-doc-alignment.test.ts tests/unit/flow2api-provider-support.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4485 lines; `src/services/auth/keyManagerProviderPresets.ts` 149 lines; `tests/unit/key-manager-provider-presets-contract.test.ts` 64 lines; `tsconfig.tests.json` 104 lines.
- Browser QA: skipped because M50 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerProviderPresets.ts`, `tests/unit/key-manager-provider-presets-contract.test.ts`, `tests/unit/twelve-ai-doc-alignment.test.ts`, `tests/unit/flow2api-provider-support.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, remote model fetch behavior, model-list filtering call sites, 12AI runtime URL resolution, localStorage policy changes, and exported API cleanup beyond the compatibility facade.

## Stage Two M51 keyManager Documented Static Model Helper Split

- Moved `getDocumentedStaticModelsForProvider` from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerProviderPresets.ts`.
- `src/services/auth/keyManager.ts` now imports and re-exports `getDocumentedStaticModelsForProvider` from the provider presets helper for compatibility while preserving all existing call sites.
- The helper remains pure preset-derived data: non-`12ai` strategy IDs return `[]`; `12ai` returns the unique union of `PROVIDER_PRESETS['12ai'].models` and `PROVIDER_PRESETS['12ai-nanobanana'].models`.
- Updated `tests/unit/key-manager-provider-presets-contract.test.ts` to verify helper ownership, compatibility export behavior, non-12AI empty fallback, and the 12AI unique union.
- Updated `tests/unit/twelve-ai-doc-alignment.test.ts` so ownership assertions follow `keyManagerProviderPresets.ts` while runtime call-site checks remain in `keyManager.ts` and `connectionTest.ts`.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-presets-contract.test.ts tests/unit/twelve-ai-doc-alignment.test.ts tests/unit/flow2api-provider-support.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/official-route-default-models.test.ts` passed (25/25).
- Architecture and security gates passed: `npm.cmd run architecture:check` passed with existing allowlisted exceptions; `npm.cmd run governance:security` passed.
- Full validation passed for this slice: `npm.cmd run typecheck`; `npm.cmd run test:unit` (1247/1247); `npm.cmd run build`.
- Agent-doc and encoding validation passed: `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerProviderPresets.ts tests/unit/key-manager-provider-presets-contract.test.ts tests/unit/twelve-ai-doc-alignment.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Line counts for this slice: `src/services/auth/keyManager.ts` 3913 lines, down from 3922 at `549a2422`; `src/services/auth/keyManagerProviderPresets.ts` 156 lines, up from 147 at `549a2422`; `tests/unit/key-manager-provider-presets-contract.test.ts` 70 lines; `tests/unit/twelve-ai-doc-alignment.test.ts` 79 lines.
- Subagent seam review disagreed on the next candidate: one recommended this narrower provider-preset-adjacent move, while another recommended model-list filtering extraction. This slice intentionally chose the smaller current WIP and defers `normalizeModelList` / `BLACKLIST_MODELS` because those cross provider compatibility filtering and many call sites.
- Browser QA: skipped because M51 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerProviderPresets.ts`, `tests/unit/key-manager-provider-presets-contract.test.ts`, `tests/unit/twelve-ai-doc-alignment.test.ts`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, remote model fetch behavior, model-list filtering call sites, 12AI runtime URL resolution, localStorage policy changes, and exported API cleanup beyond the compatibility facade.

## Stage Two M52 keyManager Model-List Normalization Helper Split

- Moved `BLACKLIST_MODELS`, the private `shouldFilterModel` predicate, and public `normalizeModelList` from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerModelList.ts`.
- `src/services/auth/keyManager.ts` now imports `normalizeModelList` and re-exports `BLACKLIST_MODELS` plus `normalizeModelList` for compatibility.
- The helper uses explicit `.ts` imports for its runtime dependencies because the focused contract directly imports it through Node's TypeScript test loader.
- Preserved official Google migration/filtering/deduplication behavior, including Nano Banana alias migration, Imagen dated preview filtering, whitelist precedence, and the historical Gemini 2.0 image alias migration into `gemini-2.5-flash-image`.
- Preserved non-official raw alias behavior and provider compatibility filtering, including allowing raw `nano-banana-2` on proxy routes and filtering unsupported 12AI image models.
- Added `tests/unit/key-manager-model-list-contract.test.ts` and included it in `tsconfig.tests.json`.
- RED evidence: the initial targeted run failed because extensionless helper imports could not be resolved by the Node test loader; after adding explicit `.ts` imports, the behavior assertion exposed and then documented the existing Gemini 2.0 image alias migration.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-model-list-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts tests/unit/key-manager-default-models-contract.test.ts tests/unit/official-route-default-models.test.ts tests/unit/model-id-normalization-parity-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/provider-image-routing-regression.test.ts tests/unit/model-display-name-regression.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/twelve-ai-doc-alignment.test.ts` passed (49/49).
- Architecture and security gates passed: `npm.cmd run architecture:check` passed with existing allowlisted exceptions; `npm.cmd run governance:security` passed.
- Full validation passed for this slice: `npm.cmd run typecheck` with semantic checks for 76 test files; `npm.cmd run test:unit` (1250/1250); `npm.cmd run build`.
- Agent-doc and encoding validation passed: `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerModelList.ts tests/unit/key-manager-model-list-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Line counts for this slice: `src/services/auth/keyManager.ts` 3845 lines, down from 3913 at `81ba2a24`; `src/services/auth/keyManagerModelList.ts` 80 lines; `tests/unit/key-manager-model-list-contract.test.ts` 70 lines; `tsconfig.tests.json` 105 lines.
- Browser QA: skipped because M52 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerModelList.ts`, `tests/unit/key-manager-model-list-contract.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, remote model fetch behavior, 12AI runtime URL resolution, localStorage policy changes, and exported API cleanup beyond the compatibility facade.

## Stage Two M53 keyManager Global-Model Dead-Code Cleanup

- Removed the duplicate `getGlobalModelList` JSDoc block from `src/services/auth/keyManager.ts`; the canonical detailed JSDoc remains in place.
- Removed the unused local `chatModelIds` allocation from `getGlobalModelList`. The allocation was source-proven dead because no reads existed in the method after M52 moved model-list normalization into `src/services/auth/keyManagerModelList.ts`.
- Extended `tests/unit/key-manager-dead-code-pruning-contract.test.ts` to guard both the duplicate JSDoc and `chatModelIds` from returning.
- Current line counts for this slice: `src/services/auth/keyManager.ts` 4387 physical lines; `tests/unit/key-manager-dead-code-pruning-contract.test.ts` 25 physical lines.
- Browser QA: skipped because M53 is a non-UI source cleanup with no component, CSS, route, or browser-visible workflow changes.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-dead-code-pruning-contract.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/key-manager-runtime-fallback.test.ts` passed (14/14).
- Architecture gate passed: `npm.cmd run architecture:check` passed with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Full validation passed for this slice: `npm.cmd run typecheck` with semantic checks for 76 test files; `npm.cmd run test:unit` (1250/1250); `npm.cmd run build`.
- Agent-doc and encoding validation passed: `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts tests/unit/key-manager-dead-code-pruning-contract.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Active commit scope: `src/services/auth/keyManager.ts`, `tests/unit/key-manager-dead-code-pruning-contract.test.ts`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, remote model fetch behavior, 12AI runtime URL resolution, localStorage policy changes, helper extraction, and exported API cleanup.

## Stage Two M54 keyManager Effective Provider Model Helper Split

- Added `src/services/auth/keyManagerEffectiveProviderModels.ts` for the pure effective provider model fallback path.
- Moved only `resolveEffectiveProviderModels` and its private official-default selector out of `src/services/auth/keyManager.ts`.
- `src/services/auth/keyManager.ts` now imports the helper for internal call sites and re-exports `resolveEffectiveProviderModels` for compatibility with existing imports from `keyManager.ts`.
- The helper preserves normalized saved model priority, official Google defaults, official OpenAI defaults only for `api.openai.com` or omitted base URL, and documented 12AI static fallback behavior.
- Updated `tests/unit/official-route-default-models.test.ts` so the default-route source guards follow the new helper boundary.
- Added `tests/unit/key-manager-effective-provider-models-contract.test.ts` and included it in `tsconfig.tests.json`.
- RED evidence: the first targeted run failed because `src/services/auth/keyManagerEffectiveProviderModels.ts` did not exist and `keyManager.ts` still owned `resolveEffectiveProviderModels`; after implementation, a too-broad no-monolith-import regex was narrowed because it incorrectly matched sibling helper imports.
- Targeted GREEN validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-effective-provider-models-contract.test.ts tests/unit/official-route-default-models.test.ts tests/unit/key-manager-runtime-fallback.test.ts tests/unit/api-settings-view-source-guard.test.ts tests/unit/model-library-bootstrap-regression.test.ts tests/unit/key-manager-model-list-contract.test.ts` passed (27/27).
- Line counts for this slice: `src/services/auth/keyManager.ts` 4343 physical lines; `src/services/auth/keyManagerEffectiveProviderModels.ts` 54 lines; `tests/unit/key-manager-effective-provider-models-contract.test.ts` 69 lines; `tests/unit/official-route-default-models.test.ts` 59 lines; `tsconfig.tests.json` 106 lines.
- Browser QA: skipped because M54 is a non-UI pure service/helper extraction with no component, CSS, route, or browser-visible workflow changes.
- Architecture gate passed: `npm.cmd run architecture:check` passed with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Full validation passed for this slice: `npm.cmd run typecheck` with semantic checks for 77 test files; `npm.cmd run test:unit` (1252/1252); `npm.cmd run build`.
- Agent-doc and encoding validation passed: `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts src/services/auth/keyManagerEffectiveProviderModels.ts tests/unit/key-manager-effective-provider-models-contract.test.ts tests/unit/official-route-default-models.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Active commit scope: `src/services/auth/keyManager.ts`, `src/services/auth/keyManagerEffectiveProviderModels.ts`, `tests/unit/key-manager-effective-provider-models-contract.test.ts`, `tests/unit/official-route-default-models.test.ts`, `tsconfig.tests.json`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, remote model fetch behavior, 12AI runtime URL resolution, localStorage policy changes, and exported API cleanup beyond the compatibility facade.

## Stage Two M55 keyManager Provider Limit Delegator Pruning

- Removed the redundant private `resolveProviderBudgetLimit` and `resolveProviderTokenLimit` forwarding methods from `src/services/auth/keyManager.ts`.
- `src/services/auth/keyManager.ts` now calls the already extracted `resolveProviderBudgetLimit` and `resolveProviderTokenLimit` helpers directly for route materialization and provider availability checks.
- Updated `tests/unit/key-manager-provider-usage-contract.test.ts` so the provider usage contract prevents the private delegator wrappers from returning and verifies the direct helper call sites.
- Line counts for this slice: `src/services/auth/keyManager.ts` 4338 physical lines; `tests/unit/key-manager-provider-usage-contract.test.ts` 103 lines.
- Browser QA: skipped because M55 is a non-UI private service wrapper cleanup with no component, CSS, route, or browser-visible workflow changes.
- Targeted GREEN validation passed before the full gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-provider-usage-contract.test.ts tests/unit/key-manager-runtime-fallback.test.ts` passed (13/13).
- Full validation passed for this slice: `npm.cmd run architecture:check` with the existing allowlisted migration and legacy bridge exceptions; `npm.cmd run typecheck` with semantic checks for 77 test files; `npm.cmd run test:unit` (1252/1252); `npm.cmd run build`; `npm.cmd run governance:agent-docs`; `npm.cmd run check:encoding`.
- Path-limited whitespace validation passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/services/auth/keyManager.ts tests/unit/key-manager-provider-usage-contract.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Active commit scope: `src/services/auth/keyManager.ts`, `tests/unit/key-manager-provider-usage-contract.test.ts`, `plans.md`, `implement.md`, `validation.md`, and `status.md`.
- Explicitly excluded scope: UI, release metadata, `CanvasContext.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, provider persistence redesign, cloud sync movement, channel config behavior, credential storage, token/backoff behavior, shared pricing cache construction, runtime routing, fetch/header behavior, remote model fetch behavior, 12AI runtime URL resolution, localStorage policy changes, and exported API cleanup beyond the two private delegator wrappers.

## Final-Gate Fixture Repair

- Root cause found during full `npm.cmd run verify:changes`: `test:contract` and `test:e2e` still expected old implicit `InMemoryCreditAccountRepository` default balance `100`, while `56797310` intentionally hardened repository defaults to `0`.
- Fixed only test fixtures by constructing `InMemoryCreditAccountRepository(100)` in `tests/contract/api-server-contract.test.ts`, `tests/contract/payment-sidecar.contract.test.ts`, and `tests/e2e/release-smoke.test.ts`; production repository defaults remain `0`.
- Fixed `scripts/test/verify-startup-runtime-banner-centering.mjs` source-contract fallback to match the current `AuthenticatedAppShell` boundary: `showStartupRuntimeBanner = showStartupBanner && !isBackgroundReady` plus `{showStartupRuntimeBanner ? <StartupRuntimeBanner /> : null}`.
- RED evidence before fixes: `npm.cmd run test:contract` failed 3 assertions (`0 !== 100`, `30 !== 130`, `25 !== 125`); `npm.cmd run test:e2e` failed one assertion (`30 !== 130`); `npm.cmd run verify:startup-runtime-banner-centering` failed on the stale inline JSX regex.
- GREEN evidence after fixes: `npm.cmd run test:contract` passed (18/18); `npm.cmd run test:e2e` passed (1/1); `npm.cmd run verify:startup-runtime-banner-centering` passed in fallback mode.
- Full release-style validation passed: `npm.cmd run verify:changes` passed, including architecture, governance, typecheck, spec, build, unit/integration/contract/e2e tests, prompt-group drag smoke, mobile settings smoke, desktop settings smoke, startup-runtime banner smoke, and encoding.
- Browser QA limitation: all Playwright smoke scripts fell back because headless Chromium launch is blocked by local `spawn EPERM`; fallback route checks returned HTTP 200 and the startup banner source contract verified, but pixel-level visual inspection is still unavailable in this environment.
- Active commit scope: `tests/contract/api-server-contract.test.ts`, `tests/contract/payment-sidecar.contract.test.ts`, `tests/e2e/release-smoke.test.ts`, `scripts/test/verify-startup-runtime-banner-centering.mjs`, and `status.md`.
- Explicitly excluded scope: billing production logic, payment sidecar production logic, UI components, release metadata, architecture helper extraction, and broad code-quality cleanup.

## Completed In `4cdbf4cf` (Dependency Security Audit Fix)

- `npm.cmd audit --omit=dev --audit-level=moderate` initially reported one critical production vulnerability: `protobufjs <7.5.5` via `@google/genai@1.50.0`.
- Added a root `overrides.protobufjs = "7.5.5"` entry and refreshed `package-lock.json`.
- First `npm.cmd update protobufjs` attempt hit a Windows `EPERM` while cleaning locked `node_modules` paths and left no git-tracked change. The follow-up `npm.cmd install --ignore-scripts --no-audit` updated the local install without running install scripts.
- Verified local dependency state: `npm.cmd ls protobufjs` reports `protobufjs@7.5.5 overridden`.
- Passed dependency audit after the fix: `npm.cmd audit --omit=dev --audit-level=moderate` reported `found 0 vulnerabilities`.
- Passed after the dependency update: `npm.cmd run typecheck`, `npm.cmd run test:unit` (1129/1129), `npm.cmd run build`, `npm.cmd run governance:security`, and `npm.cmd run check:encoding`.

## Completed In `567f85aa` (Portable Release Metadata Refresh)

- Regenerated/published portable release metadata so the tracked stable manifest no longer reports the former portable metadata `buildTime` mismatch.
- The former `governance:version` blocker is cleared; `npm.cmd run governance:check` now passes in the latest full gate.
- Commit scope was release metadata only and stayed separate from runtime/security code.

## Completed In `0c5cadde` (Nutrient OCR Key Hardening)

- Browser settings no longer store or submit a Nutrient OCR API key.
- `/api/nutrient-document` now reads only server-side `NUTRIENT_API_KEY` / `NUTRIENT_DWS_API_KEY`; browser-supplied `apiKey` form data is ignored.
- Settings/workbench copy now describes the server-key boundary instead of showing an editable client key field.
- Targeted OCR/API validation passed: `tests/unit/ocr-service-settings-contract.test.ts`, `tests/unit/ecommerce-analysis-client-fallback.test.ts`, `tests/unit/api-settings-capability-routing-contract.test.ts`, and `tests/unit/portable-app-server-document-proxy-contract.test.ts`.
- UI browser QA note: direct in-app Browser QA for the OCR/settings surface was attempted but blocked by transient local server listener loss; fallback desktop/mobile settings smoke checks passed. This is not browser-complete evidence for future UI changes.

## Completed In `333f2551` (PostCSS Security Patch)

- Updated `postcss` to `8.5.13` and refreshed the lockfile.
- `npm.cmd audit --audit-level=moderate` and `npm.cmd audit --omit=dev --audit-level=moderate` both report zero vulnerabilities in the latest audit gate.

## Completed In `b6620ef2` (Dead AI12 Service Pruning)

- Deleted the unused `src/services/api/AI12APIService.ts` after import/reference proof showed the canonical service path no longer needs the dead shim.
- Strengthened pruning coverage in `tests/unit/legacy-compatibility-pruning.test.ts`; `tests/unit/service-barrel-pruning.test.ts` was rerun with the pruning gate.
- Commit scope was dead-code cleanup only and did not touch active provider routing behavior.

## Stage One M6 Closeout Scan

- Result: M6 can be marked complete. No clear ecommerce-owned business branch remains in `src/App.tsx` that should be extracted as another M6 runtime slice.
- Remaining ecommerce references are orchestration/state wiring: `handleGenerate` calls `handleEcommerceSubmitGuard`, `handleImageClick` calls `resetEcommerceSourceSelectionState`, and `handlePartialRedrawRequest` delegates ecommerce inheritance/finalization to `resolveEcommercePartialRedrawContext` / `finalizeEcommercePartialRedrawResult`.
- The `src/App.tsx` ecommerce state adapter block is hook state patch wiring, not an unextracted business runtime. It may become a future `useEcommerceRuntimeStateAdapters` cleanup, but it is not an M6 blocker.
- Deferred non-M6 quality debt: duplicate ecommerce framework child hide predicates, prompt-click empty-prompt policy cleanup, and ecommerce thinking-mode resolver relocation.
- Browser QA: skipped because the closeout scan and ledger correction do not change UI behavior or visual surfaces.

## Completed Stage One Backfill M1 (Connector Renderer Hardening)

- Exported `ConnectorRenderSnapshot`, `UseConnectorRendererDeps`, and `UseConnectorRendererResult` from `src/app/useConnectorRenderer.ts` so the hook boundary is explicit and reusable for later App split work.
- Added `tests/unit/canvas-connector-throttling-contract.test.ts` coverage that asserts exported connector boundary types and prevents `App.tsx` from reintroducing connector snapshot builder/commit/scheduler helpers.
- Review follow-up: the connector boundary test now imports `ConnectorRenderSnapshot`, `UseConnectorRendererDeps`, and `UseConnectorRendererResult` as public types, so `npm.cmd run typecheck` validates the exported boundary instead of relying only on source regex.
- Added the connector throttling contract test to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 32 test files.
- Line counts after this slice: `src/App.tsx` 4904, `src/app/useConnectorRenderer.ts` 253, `tests/unit/canvas-connector-throttling-contract.test.ts` 75, `tsconfig.tests.json` 61.
- Browser QA: skipped because this is a non-UI hook type-boundary hardening and existing connector rendering behavior was not changed.

## Completed Stage One Backfill M2 (Prompt Group Layout Boundary)

- Exported `PromptGroupBounds`, `UsePromptGroupLayoutDeps`, `UsePromptGroupLayoutResult`, `UsePromptGroupStackingDeps`, and `UsePromptGroupStackingResult` from `src/app/usePromptGroupLayout.ts`; no prompt-group behavior or rendering code changed.
- Strengthened `tests/unit/prompt-group-regroup-behavior.test.ts` with `import type` coverage for the prompt-group public boundary and source guards that prevent `App.tsx` from reintroducing prompt group layout ownership.
- Added the prompt-group regroup behavior test to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 33 test files.
- Line counts for this slice before commit: `src/App.tsx` 4904, `src/app/usePromptGroupLayout.ts` 1348, `tests/unit/prompt-group-regroup-behavior.test.ts` 546, `tsconfig.tests.json` 62.
- RED evidence from this slice: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-group-regroup-behavior.test.ts` failed before the hook boundary types were exported.
- Targeted GREEN validation already run during the slice: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-group-regroup-behavior.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/canvas-local-performance-trace-contract.test.ts` passed (52/52).
- Passed during the slice: `npm.cmd run typecheck`; test semantic check covers 33 files via `tsconfig.tests.json`.
- Passed during the slice: `npm.cmd run test:unit` (1115/1115).
- Passed during the slice: `npm.cmd run build`.
- Passed during the slice: `npm.cmd run governance:agent-docs`.
- Passed during the slice: `npm.cmd run check:encoding`.
- Passed during the slice: path-limited alternate-git `diff --check` for `src/app/usePromptGroupLayout.ts`, `tests/unit/prompt-group-regroup-behavior.test.ts`, `tsconfig.tests.json`, and ledger files with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI hook type-boundary hardening and no visual surface changed.

## Completed Stage One Backfill M3 (Generation Runtime Boundary)

- Audited `src/App.tsx` generation wiring and `src/app/useGenerationRuntime.ts`; generation-owned start, billing attempt coordination, cancellation, retry, failure state, result persistence, and retry batch transaction ownership remain inside `useGenerationRuntime`.
- Strengthened `tests/unit/generation-runtime-contract.test.ts` with `import type` coverage for `UseGenerationRuntimeDeps`, `UseGenerationRuntimeResult`, `PrepareInitialGenerationSubmissionContextResult`, `RetryGeneratedMediaResultContext`, and `CompleteRetryGeneratedMediaBatchParams`.
- Added the generation runtime contract test to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 34 test files.
- Line counts for this slice before commit: `src/App.tsx` 4904, `src/app/useGenerationRuntime.ts` 2604, `tests/unit/generation-runtime-contract.test.ts` 1683, `tsconfig.tests.json` 63.
- RED evidence from this slice: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts` failed because `tests/unit/generation-runtime-contract.test.ts` was not included in `tsconfig.tests.json`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts` passed (52/52).
- Passed during the slice: `npm.cmd run typecheck`; test semantic check covers 34 files via `tsconfig.tests.json`.
- Browser QA: skipped because this is a non-UI runtime/type-boundary hardening and no visual surface changed.

## Completed Stage One Backfill M3 Follow-Up (Generation Billing Boundary)

- Removed the stale `buildGenerationAttemptRequestId` import from `src/App.tsx` after generation billing attempt ownership moved into `useGenerationRuntime`.
- Removed unused `ensureCreditAttemptCharged`, `resolveFailedCreditAttempt`, and `applyOptimisticServerCreditDebit` destructures from the `useGenerationRuntime` result in `src/App.tsx`; App still injects billing service dependencies into the hook but no longer receives unused billing helper callbacks.
- Strengthened `tests/unit/generation-billing-runtime-contract.test.ts` with `import type` coverage for `EnsureCreditAttemptChargedParams`, `EnsureCreditAttemptChargedResult`, and `GenerationCreditAttemptNode`.
- Added `tests/unit/generation-billing-runtime-contract.test.ts` to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 35 test files.
- RED evidence from this follow-up: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-billing-runtime-contract.test.ts` failed while App still imported `generationBillingCoordinator`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts` passed (52/52).
- Browser QA: skipped because this is non-UI runtime cleanup and semantic test coverage; no visual surface changed.

## Completed Stage One Backfill M5 (PPT Runtime Boundary)

- Strengthened `tests/unit/ppt-runtime-contract.test.ts` with `import type` coverage for `UsePptRuntimeDeps`, `UsePptRuntimeResult`, `PptOutlineLineParts`, ordered PPT preview/node bundles, editable export bundle, deck editor state, stack preview state, and `PptRuntimeCanvasSnapshot`.
- Added `tests/unit/ppt-runtime-contract.test.ts`, `tests/unit/ppt-runtime-helper-contract.test.ts`, and `tests/unit/ppt-deck-single-container-contract.test.ts` to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 38 test files.
- Line counts for this slice before commit: `src/App.tsx` 4900, `src/app/usePptRuntime.ts` 1289, `src/app/pptRuntimeHelpers.ts` 152, `tests/unit/ppt-runtime-contract.test.ts` 269, `tsconfig.tests.json` 67.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ppt-runtime-contract.test.ts` failed because `tsconfig.tests.json` did not include `tests/unit/ppt-runtime-contract.test.ts`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ppt-runtime-contract.test.ts tests/unit/ppt-runtime-helper-contract.test.ts tests/unit/ppt-deck-single-container-contract.test.ts` passed (6/6).
- Full validation passed: `npm.cmd run typecheck` with semantic checks for 38 test files, `npm.cmd run test:unit` (1116/1116), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Path-limited diff check passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- tests/unit/ppt-runtime-contract.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only before ledger edits.
- Independent review by subagent `019de8f6-54b8-7d23-8bf0-6f9effd102f1` approved the slice with no findings; residual risk was limited to not rerunning the full suite inside the review subagent.
- Touched-file debt check found no `as any`, `@ts-ignore` / `@ts-expect-error`, or bare `console.log` in `tests/unit/ppt-runtime-contract.test.ts` or `tsconfig.tests.json`.
- Browser QA: skipped because this is a non-UI runtime/type-boundary and test configuration slice; no visual surface, CSS, or browser behavior changed.

## Completed Stage Two M1 (CanvasContext State Boundary)

- Extracted `CanvasState`, `CanvasContextType`, `CanvasContext`, `SubCardLayout`, `ArrangeMode`, `MAX_CANVASES`, `generateId`, `createCanvasWorkflow`, `DEFAULT_CANVAS`, and `DEFAULT_STATE` into `src/context/canvasContextState.ts`.
- Moved canvas workflow/ecommerce compatibility syncing into `src/context/canvasCompatibility.ts` so the state model module does not own migration behavior.
- `src/context/CanvasContext.tsx` now imports and re-exports the state/context boundary from `canvasContextState.ts`, imports compatibility syncing from `canvasCompatibility.ts`, preserves existing public type import paths, and removes inline state/context/default definitions.
- Added `tests/unit/canvas-context-state-boundary.test.ts` to guard that `CanvasContext.tsx` delegates state/default/context ownership, no `LegacyInlineCanvas*` or `LEGACY_INLINE_DEFAULT_*` residue remains, `clearAllData` resets via `DEFAULT_STATE`, and compatibility syncing does not live in the state module.
- Added the new boundary test to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 39 test files.
- Line counts for this slice before commit: `src/context/CanvasContext.tsx` 4606, `src/context/canvasContextState.ts` 114, `src/context/canvasCompatibility.ts` 8, `tests/unit/canvas-context-state-boundary.test.ts` 48, `tsconfig.tests.json` 68.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-state-boundary.test.ts` failed while `CanvasContext` still created the React context inline and again while `LegacyInlineCanvas` residue remained in `src/context/CanvasContext.tsx`.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` passed (3/3).
- Full validation passed: `npm.cmd run architecture:check`, `npm.cmd run typecheck`, `npm.cmd run test:unit` (1117/1117), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding`.
- Path-limited diff check passed before final ledger edits: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasContextState.ts tests/unit/canvas-context-state-boundary.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI architecture/state-boundary split and no visual surface, CSS, or browser behavior changed.
- Independent review by subagent `019de9c3-294d-7653-8bb5-e8de23521fe9` flagged three boundary concerns. The P2 issues were fixed by moving the React context object into `canvasContextState.ts` and making `clearAllData` reset via `DEFAULT_STATE`; the P3 design concern was addressed by moving compatibility syncing to `canvasCompatibility.ts`.

## Completed Stage Two M2 (Canvas Selection Reducer)

- Added `src/context/canvasSelection.ts` for the pure `resolveCanvasSelectionIds` helper and `CanvasSelectionMode` type.
- `src/context/CanvasContext.tsx` now delegates `selectNodes` replace/add/remove/toggle semantics to `resolveCanvasSelectionIds`; provider orchestration and public context shape stay in `CanvasContext.tsx`.
- Added `tests/unit/canvas-selection-runtime-contract.test.ts` to guard source ownership, exported public type coverage, `tsconfig.tests.json` inclusion, and current selection behavior.
- Added the new selection contract test to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 40 test files.
- Selection behavior preserved: `replace` preserves incoming array order and duplicates; `add`, `remove`, and `toggle` retain prior Set-based ordering and duplicate collapse semantics.
- Line counts for this slice before commit: `src/context/CanvasContext.tsx` 5271 text lines in the working tree, `src/context/canvasSelection.ts` 35 text lines, `tests/unit/canvas-selection-runtime-contract.test.ts` 48 text lines, `tsconfig.tests.json` 69 physical lines.
- Targeted validation already passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-selection-runtime-contract.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts` passed (44/44).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 40 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions.
- Passed: `npm.cmd run test:unit` (1119/1119).
- Passed: `npm.cmd run build`.
- Independent review by subagent `019de9d3-cc3d-76c3-9378-3b4842f6aa0b` found no blocking issues. Residual note: the new contract test does not explicitly cover duplicate collapse from an already-duplicated current selection for add/remove/toggle, but the implementation matches the old Set-based reducer.
- Browser QA: skipped because this is a non-UI reducer extraction and no visual surface, CSS, or browser behavior changed.

## Completed Stage Two M3 (Prompt Child Image Resolver)

- Added `src/context/canvasPromptChildImages.ts` for the pure `resolvePromptChildImageIds` helper.
- `src/context/CanvasContext.tsx` now imports the helper and retains only provider orchestration plus existing recovery/persistence call sites.
- Added `tests/unit/canvas-prompt-child-images-runtime-contract.test.ts` to guard ownership transfer, strong prompt ownership ordering, duplicate and missing ID filtering, `sourceImageId` exclusion, and legacy fallback behavior.
- Added the new prompt-child-image resolver contract test to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 41 test files.
- Line counts for this slice before commit: `src/context/CanvasContext.tsx` 5218 text lines, `src/context/canvasPromptChildImages.ts` 55 text lines, `tests/unit/canvas-prompt-child-images-runtime-contract.test.ts` 93 text lines, `tsconfig.tests.json` 70 physical lines.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-child-images-runtime-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasPromptChildImages.ts`.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-child-images-runtime-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` passed (7/7).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 41 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions.
- Passed: `npm.cmd run test:unit` (1123/1123).
- Passed: `npm.cmd run build`.
- Passed final docs/encoding validation: `npm.cmd run governance:agent-docs` and `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasPromptChildImages.ts tests/unit/canvas-prompt-child-images-runtime-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Independent review by subagent `019de9e0-f398-77f0-b779-1eea29494009` found no blocking issues and confirmed behavior-preserving extraction.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, or browser behavior changed.

## Current Stage Two M4 (Workflow Source Node ID Resolver)

- Added `src/context/canvasWorkflowSourceNodeIds.ts` for the pure `getWorkflowSourceNodeIds` helper.
- `src/context/CanvasContext.tsx` now imports the helper while keeping workflow edge creation, edge pruning, mutation handlers, and utility-kind guards in place.
- Added `tests/unit/canvas-workflow-source-node-ids-contract.test.ts` to guard ownership transfer, utility-only behavior, malformed `sourceNodeIds` handling, first-seen string de-duping, blank/non-string filtering, and non-trimming return semantics.
- Added the new workflow-source-node-ID resolver contract test to `tsconfig.tests.json`; `npm.cmd run typecheck` now semantically checks 42 test files.
- Line counts for this slice before commit: `src/context/CanvasContext.tsx` 5202 text lines, `src/context/canvasWorkflowSourceNodeIds.ts` 19 text lines, `tests/unit/canvas-workflow-source-node-ids-contract.test.ts` 67 text lines, `tsconfig.tests.json` 71 physical lines.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-source-node-ids-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasWorkflowSourceNodeIds.ts`.
- Debug note: after creating the helper, the focused test initially exposed a Node direct-test import resolution issue and an overly narrow test fixture type. Root cause was fixed by using the existing `.ts` import style in the helper dependency and allowing malformed fixture data in the test.
- Targeted validation passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-source-node-ids-contract.test.ts tests/unit/canvas-prompt-child-images-runtime-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` passed (9/9).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 42 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions.
- Passed: `npm.cmd run test:unit` (1126/1126).
- Passed: `npm.cmd run build`.
- Passed final docs/encoding validation: `npm.cmd run governance:agent-docs` and `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasWorkflowSourceNodeIds.ts tests/unit/canvas-workflow-source-node-ids-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Independent review by subagent `019de9ec-2ca0-7323-820c-9fb6b1595865` found no blocking or non-blocking issues and confirmed the `.ts` helper import matches existing project usage.
- Browser QA: skipped because this is a non-UI pure helper extraction and no visual surface, CSS, or browser behavior changed.

## Completed In `ccf965c3` (Ecommerce Source Selection Runtime)

- Added `src/app/useEcommerceSourceSelectionRuntime.ts` for the ecommerce state reset that runs when an image is selected as the next source.
- `src/App.tsx` now wires the source-selection hook through `resetEcommerceSourceSelectionState`; App no longer owns the inline image-source ecommerce reset block in `handleImageClick`.
- The hook receives dependencies through `UseEcommerceSourceSelectionRuntimeDeps`: the ecommerce ratio override setter and the shared active-focus state patch adapter for `activeTaskNodeId`, `activeTaskState`, `activeFrameworkId`, and `activeGroupSheet`.
- New contract coverage in `tests/unit/ecommerce-source-selection-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, App wiring, and the extracted reset behavior.

## Completed In `cc24e19d` (Ecommerce Runtime Activation)

- Added `src/app/useEcommerceModeRuntime.ts` for the ecommerce mode guard/reset effect that clears active task state and forces high thinking mode in ecommerce mode.
- Added `src/app/useEcommercePromptActivationRuntime.ts` for prompt-click ecommerce activation and framework summary resolution.
- `src/App.tsx` now wires the new mode and prompt-activation hooks alongside the existing submit hook; App no longer owns the mode guard/reset effect, the prompt activation state block in `handlePromptClick`, or the prompt-node framework status callback.
- The new hooks receive all dependencies through `UseEcommerceModeRuntimeDeps` and `UseEcommercePromptActivationRuntimeDeps`.
- New contract coverage in `tests/unit/ecommerce-mode-runtime-contract.test.ts` and `tests/unit/ecommerce-prompt-activation-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, App wiring, and the extracted ecommerce activation branches.

## Completed In `184b158c` (Ecommerce Task Activation Runtime)

- Added `src/app/useEcommerceTaskActivationRuntime.ts` for source-key ecommerce task activation lookup and fallback activation state restoration.
- `src/App.tsx` now wires the task activation hook through `updateEcommerceTaskActivationRuntimeState`; App no longer owns inline `handleActivateEcommerceTaskBySourceKey`.
- The hook receives all dependencies through `UseEcommerceTaskActivationRuntimeDeps`: active canvas ref, ecommerce task-state map, task activation state adapter, and prompt activation callback.
- New contract coverage in `tests/unit/ecommerce-task-activation-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, App wiring, PromptBar activation callback threading, source-row matching, and fallback active-task/group-sheet restoration.
- `tsconfig.tests.json` now semantically checks 26 test files.
- Line counts after extraction: `src/App.tsx` 4931 physical lines; `src/app/useEcommerceTaskActivationRuntime.ts` 62 physical lines; `tests/unit/ecommerce-task-activation-runtime-contract.test.ts` 33 physical lines; `tsconfig.tests.json` 55 physical lines.
- Working-tree note: this slice was already present as an uncommitted hook/test pair when I picked up the next step, so there is no separate RED reproduction in this turn; the first local targeted run passed and the slice was reviewed from the current working tree forward.
- Targeted validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-task-activation-runtime-contract.test.ts tests/unit/ecommerce-mobile-continuation-runtime-contract.test.ts tests/unit/ecommerce-runtime-contract.test.ts` passed (3/3).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 26 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1102/1102).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommerceTaskActivationRuntime.ts tests/unit/ecommerce-task-activation-runtime-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped for this slice because it is non-UI runtime activation glue that preserves existing PromptBar/mobile component contracts. The Clay UI lane browser evidence remains recorded below.
- Commit include scope for this runtime slice: `status.md`, `plans.md`, `implement.md`, `validation.md`, `tsconfig.tests.json`, `src/App.tsx`, `src/app/useEcommerceTaskActivationRuntime.ts`, and `tests/unit/ecommerce-task-activation-runtime-contract.test.ts`.
- Explicitly excluded scope: Clay UI docs/styles/components, PPT/generation runtime files, and unrelated ecommerce runtime slices not touched by the task activation extraction.

## Completed In `782d30d3` (Ecommerce Mobile Continuation Runtime)

- Added `src/app/useEcommerceMobileContinuationRuntime.ts` for mobile ecommerce prompt-node lookup, task editing activation, mobile selection toggles, desktop confirmation forwarding, and mobile generation queue fallback handlers.
- `src/App.tsx` now wires the mobile continuation hook through existing node-generation, scheduler, and workspace handlers; App no longer owns inline `resolveMobileResultPromptNode`, `handleMobileEditEcommerceTask`, `handleMobileToggleEcommerceSelected`, `handleMobileConfirmEcommerceDesktop`, or `handleMobileGenerateEcommerceMobile`.
- The hook receives all dependencies through `UseEcommerceMobileContinuationRuntimeDeps`: active canvas ref, active sheet, workspace focus, mobile screen setter, prompt activation callback, selection toggle handler, desktop confirmation handler, mobile retry handler, framework queue enqueue/pump handlers, and framework view sync.
- New contract coverage in `tests/unit/ecommerce-mobile-continuation-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, App wiring, removal of inline App callbacks, queue fallback behavior, and mobile edit/confirm/generate forwarding. Existing mobile continuation surface tests continue to assert selector data and detail-screen action threading.
- `tsconfig.tests.json` now semantically checks 25 test files.
- Line counts after extraction: `src/App.tsx` 4931 physical lines; `src/app/useEcommerceMobileContinuationRuntime.ts` 146 physical lines; `tests/unit/ecommerce-mobile-continuation-runtime-contract.test.ts` 46 physical lines; `tests/unit/mobile-ecommerce-continuation-surface.test.ts` 171 physical lines; `tests/unit/mobile-feed-selectors.test.ts` 323 physical lines; `tsconfig.tests.json` 54 physical lines.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-mobile-continuation-runtime-contract.test.ts tests/unit/ecommerce-node-generation-runtime-contract.test.ts tests/unit/ecommerce-runtime-contract.test.ts` failed first because `src/app/useEcommerceMobileContinuationRuntime.ts` did not exist.
- Targeted GREEN validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-mobile-continuation-runtime-contract.test.ts tests/unit/mobile-ecommerce-continuation-surface.test.ts tests/unit/ecommerce-node-generation-runtime-contract.test.ts tests/unit/ecommerce-runtime-contract.test.ts` passed (5/5).
- Active ecommerce mobile continuation gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-mobile-continuation-runtime-contract.test.ts tests/unit/mobile-ecommerce-continuation-surface.test.ts tests/unit/mobile-feed-selectors.test.ts tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-node-generation-runtime-contract.test.ts tests/unit/ecommerce-build-runtime-contract.test.ts` passed (13/13).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 25 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1101/1101).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommerceMobileContinuationRuntime.ts tests/unit/ecommerce-mobile-continuation-runtime-contract.test.ts tests/unit/mobile-ecommerce-continuation-surface.test.ts tests/unit/mobile-feed-selectors.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md`.

## Completed In `6dc8e391` (Ecommerce Node Generation Runtime)

- Added `src/app/useEcommerceNodeGenerationRuntime.ts` for ecommerce node state patching, prompt optimization execution, structured render-task generation, single-card generation, desktop confirmation, and mobile retry callbacks.
- `src/App.tsx` now wires the node generation hook through `updateEcommerceNodeGenerationRuntimeState`; App no longer owns inline `updateEcommerceNodeState`, `syncActiveEcommerceTask`, `runEcommerceNodeGeneration`, `handleGenerateEcommerceNode`, `handleConfirmEcommerceDesktop`, or `handleRetryEcommerceModule`.
- The hook receives all dependencies through `UseEcommerceNodeGenerationRuntimeDeps`: active canvas ref, active task draft state, state adapter, prompt optimization flag/prompt text, `updatePromptNode`, `handleRetryNode`, sizing policy resolver, generation settings resolver, and ecommerce thinking-mode resolver.
- New contract coverage in `tests/unit/ecommerce-node-generation-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, App wiring, removal of inline App callbacks, prompt optimizer/render-task ownership, desktop confirmation, and mobile retry routing. Existing build-runtime, scheduler-runtime, and structured-task source contracts were retargeted to the new hook boundary.
- `tsconfig.tests.json` now semantically checks 24 test files.
- Line counts after extraction: `src/App.tsx` 4987 physical lines; `src/app/useEcommerceNodeGenerationRuntime.ts` 295 physical lines; `tests/unit/ecommerce-node-generation-runtime-contract.test.ts` 53 physical lines; `tests/unit/ecommerce-build-runtime-contract.test.ts` 57 physical lines; `tests/unit/ecommerce-runtime-contract.test.ts` 72 physical lines; `tests/unit/ecommerce-structured-task-source-contract.test.ts` 72 physical lines; `tsconfig.tests.json` 53 physical lines.
- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-node-generation-runtime-contract.test.ts tests/unit/ecommerce-build-runtime-contract.test.ts tests/unit/ecommerce-runtime-contract.test.ts` failed before implementation because `App.tsx` did not call `useEcommerceNodeGenerationRuntime`.
- Targeted GREEN validation: the same command passed after implementation (4/4).

## Completed In `5acf9c27` (Ecommerce Post-Build Sync Runtime)

- Extracted ecommerce active task prompt/display synchronization and post-confirm built-card upload/reference rehydration into `src/app/useEcommercePostBuildSyncRuntime.ts`.
- `src/App.tsx` now wires the post-build sync hook through `updateEcommercePostBuildSyncState`; App no longer owns inline `findEcommerceAnalysisItemBySourceKey`, `buildRuntimeEcommerceAssetRoles`, the active task sync effect, or the post-confirm upload/reference sync effect.
- The broader post-build scope is intentional: both effects synchronize cards after build/selection state changes and share task-state update behavior. The temporary stricter built-card-only split is not present in the worktree.
- Upload-reference signatures and manual reference extraction remain injected from `useEcommerceUploadReferenceRuntime`; the post-build hook does not duplicate upload runtime identity logic.
- New contract coverage in `tests/unit/ecommerce-post-build-sync-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, helper migration, App wiring, and removal of the inline App effects. Existing build-runtime, upload-sync, display-label, and structured-task contracts were retargeted so build creation remains in `useEcommerceBuildRuntime` while post-build card rehydration and active-task display sync are asserted in `useEcommercePostBuildSyncRuntime`.
- The new contract test plus retargeted display-label and structured-task contracts are included in `tsconfig.tests.json`, so `npm.cmd run typecheck` now semantically checks 23 test files.
- Line counts after extraction: `src/App.tsx` 5159 physical lines; `src/app/useEcommercePostBuildSyncRuntime.ts` 299 physical lines; `tests/unit/ecommerce-post-build-sync-runtime-contract.test.ts` 34 physical lines; `tests/unit/ecommerce-runtime-upload-sync-contract.test.ts` 40 physical lines; `tests/unit/ecommerce-display-label-surface.test.ts` 27 physical lines; `tests/unit/ecommerce-structured-task-source-contract.test.ts` 71 physical lines; `tsconfig.tests.json` 52 physical lines.
- Targeted validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-display-label-surface.test.ts tests/unit/ecommerce-structured-task-source-contract.test.ts tests/unit/ecommerce-post-build-sync-runtime-contract.test.ts tests/unit/ecommerce-runtime-upload-sync-contract.test.ts` passed (4/4).
- Active ecommerce post-build gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-build-runtime-contract.test.ts tests/unit/ecommerce-post-build-sync-runtime-contract.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts tests/unit/ecommerce-runtime-upload-sync-contract.test.ts tests/unit/ecommerce-upload-references-contract.test.ts tests/unit/ecommerce-group-slot-integration.test.ts tests/unit/ecommerce-group-shell-contract.test.ts tests/unit/ecommerce-group-shell-app-contract.test.ts tests/unit/ecommerce-analysis-selection-contract.test.ts tests/unit/ecommerce-model-policy.test.ts tests/unit/ecommerce-task-services.test.ts tests/unit/ecommerce-runtime-contract.test.ts` passed (37/37).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 23 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1099/1099).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommerceNodeGenerationRuntime.ts tests/unit/ecommerce-node-generation-runtime-contract.test.ts tests/unit/ecommerce-build-runtime-contract.test.ts tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-structured-task-source-contract.test.ts tests/unit/generation-runtime-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommercePostBuildSyncRuntime.ts tests/unit/ecommerce-post-build-sync-runtime-contract.test.ts tests/unit/ecommerce-runtime-upload-sync-contract.test.ts tests/unit/ecommerce-build-runtime-contract.test.ts tests/unit/ecommerce-display-label-surface.test.ts tests/unit/ecommerce-structured-task-source-contract.test.ts tsconfig.tests.json plans.md implement.md status.md validation.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped for this slice because it is non-UI runtime synchronization glue. The Clay UI lane browser evidence remains recorded below.
- Commit include scope for this runtime slice: `status.md`, `plans.md`, `implement.md`, `validation.md`, `tsconfig.tests.json`, `src/App.tsx`, `src/app/useEcommercePostBuildSyncRuntime.ts`, `tests/unit/ecommerce-post-build-sync-runtime-contract.test.ts`, `tests/unit/ecommerce-runtime-upload-sync-contract.test.ts`, `tests/unit/ecommerce-build-runtime-contract.test.ts`, `tests/unit/ecommerce-display-label-surface.test.ts`, and `tests/unit/ecommerce-structured-task-source-contract.test.ts`.
- Explicitly excluded scope: Clay UI docs/styles/components, PPT/generation runtime files, and unrelated ecommerce runtime slices not touched by the post-build sync extraction.

## Completed In `d0a95f79` (Ecommerce Build Runtime)

- Extracted ecommerce analysis confirmation, framework/group/task node building, initial group slot creation, upload-reference caching for newly built cards, and framework runtime bootstrapping into `src/app/useEcommerceBuildRuntime.ts`.
- `src/App.tsx` now wires the build runtime through `updateEcommerceBuildRuntimeState`; App no longer owns inline `buildEcommerceFrameworkNode`, `buildEcommerceGroupNode`, `buildEcommercePromptNode`, or `handleConfirmEcommerceAnalysis`.
- Existing upload-sync and generation/scheduler runtime paths remain in `App.tsx` / `useEcommerceRuntime` for this slice; the build hook returns only `handleConfirmEcommerceAnalysis`.
- Subagent review confirmed the slice ownership boundary. Its P3 notification-control-flow concern was fixed by isolating success/failure notification delivery from build state transitions.
- New contract coverage in `tests/unit/ecommerce-build-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, current upload-reference caching, canvas group layout, group slot initialization, framework runtime initialization, success/failure notifications, App wiring, and separation from upload sync/generation runtime.
- Existing confirm-flow, group-shell, slot-integration, analysis-selection, and upload-sync source contracts were retargeted so build creation details are asserted in `src/app/useEcommerceBuildRuntime.ts`, while `src/App.tsx` remains responsible for wiring, upload-sync effects, and hidden-node rendering filters.
- The new contract test is included in `tsconfig.tests.json`.
- Line counts after extraction: `src/App.tsx` 5353 physical lines; `src/app/useEcommerceBuildRuntime.ts` 617 physical lines; `tests/unit/ecommerce-build-runtime-contract.test.ts` 51 physical lines; `tests/unit/ecommerce-confirm-build-flow.test.ts` 39 physical lines; `tests/unit/ecommerce-analysis-selection-contract.test.ts` 22 physical lines; `tests/unit/ecommerce-upload-references-contract.test.ts` 238 physical lines; `tsconfig.tests.json` 49 physical lines.
- Targeted validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-build-runtime-contract.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts` passed (4/4).
- Broadened ecommerce build/upload/group-shell validation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-build-runtime-contract.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts tests/unit/ecommerce-runtime-upload-sync-contract.test.ts tests/unit/ecommerce-group-slot-integration.test.ts tests/unit/ecommerce-group-shell-contract.test.ts tests/unit/ecommerce-group-shell-app-contract.test.ts` passed (8/8) after retargeting stale App-inline assertions.
- Broadened active validation with analysis-selection/upload-reference/model/task/runtime contracts: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-build-runtime-contract.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts tests/unit/ecommerce-runtime-upload-sync-contract.test.ts tests/unit/ecommerce-group-slot-integration.test.ts tests/unit/ecommerce-group-shell-contract.test.ts tests/unit/ecommerce-group-shell-app-contract.test.ts tests/unit/ecommerce-analysis-selection-contract.test.ts tests/unit/ecommerce-upload-references-contract.test.ts tests/unit/ecommerce-model-policy.test.ts tests/unit/ecommerce-task-services.test.ts tests/unit/ecommerce-runtime-contract.test.ts` passed (36/36).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 20 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1098/1098).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommerceBuildRuntime.ts tests/unit/ecommerce-build-runtime-contract.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts tests/unit/ecommerce-runtime-upload-sync-contract.test.ts tests/unit/ecommerce-group-slot-integration.test.ts tests/unit/ecommerce-group-shell-contract.test.ts tests/unit/ecommerce-group-shell-app-contract.test.ts tests/unit/ecommerce-analysis-selection-contract.test.ts tests/unit/ecommerce-upload-references-contract.test.ts tsconfig.tests.json status.md plans.md implement.md validation.md` with LF/CRLF normalization warnings only.
- Passed staged diff check after path-limited staging: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --cached --check`.
- Browser QA: skipped for this slice because it is non-UI runtime build glue. The Clay UI lane browser evidence remains recorded below.
- Commit include scope for this runtime slice: `status.md`, `plans.md`, `implement.md`, `validation.md`, `tsconfig.tests.json`, `src/App.tsx`, `src/app/useEcommerceBuildRuntime.ts`, `tests/unit/ecommerce-build-runtime-contract.test.ts`, `tests/unit/ecommerce-confirm-build-flow.test.ts`, `tests/unit/ecommerce-runtime-upload-sync-contract.test.ts`, `tests/unit/ecommerce-group-slot-integration.test.ts`, `tests/unit/ecommerce-group-shell-contract.test.ts`, `tests/unit/ecommerce-group-shell-app-contract.test.ts`, `tests/unit/ecommerce-analysis-selection-contract.test.ts`, and `tests/unit/ecommerce-upload-references-contract.test.ts`.

## Completed In `017bb3a2` (Ecommerce Requirement Analysis Runtime)

- Extracted requirement-file pick, requirement clear, analysis reset, empty group slots, selected-item derivation, product-image AI enhancement data preparation, and requirement analysis execution into `src/app/useEcommerceRequirementAnalysisRuntime.ts`.
- `src/App.tsx` now wires the runtime through `updateEcommerceRequirementAnalysisState`; App no longer owns inline `createEcommerceAnalysisResetPatch`, `handlePickEcommerceRequirementFile`, `handleClearEcommerceRequirementFile`, `handleResetEcommerceAnalysis`, or `handleAnalyzeEcommerceRequirement`.
- `App.tsx` injects `analyzeEcommerceRequirementFile` through the hook's explicit dependency interface; App no longer owns the async analysis body or calls the analyzer directly inside inline handlers.
- The async analysis flow is executable through exported `runEcommerceRequirementAnalysis`, which keeps the hook thin and lets tests cover no-file warnings, analyzing/success/failure patches, AI enhancement data conversion, partial analyzer-result normalization, success notifications, and reference-preserving patch behavior.
- `handleGenerate` now includes `ecommerceState.analysis`, `handleAnalyzeEcommerceRequirement`, and `handleConfirmEcommerceAnalysis` in its dependency array so ecommerce submit does not keep stale no-file or stale-confirm closures.
- New contract coverage in `tests/unit/ecommerce-requirement-analysis-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, analysis reset and clear patch behavior, empty group slots, analysis counts, default selected items for main/A+ rows, product image data extraction, success and failure patch behavior, no-file warning, AI enhancement success, AI enhancement failure fallback, partial analyzer-result defaults, and ecommerce submit callback dependencies. Existing analysis button and upload removal source contracts were retargeted to hook ownership.
- The new contract test plus the retargeted ecommerce analysis-button and upload-removal tests are included in `tsconfig.tests.json`, so `npm.cmd run typecheck` now semantically checks 17 test files.
- Line counts after extraction: `src/App.tsx` 5760 physical lines; `src/app/useEcommerceRequirementAnalysisRuntime.ts` 317 physical lines; `tests/unit/ecommerce-requirement-analysis-runtime-contract.test.ts` 455 physical lines.
- Subagent review: source audit identified stale ecommerce submit dependencies, analyzer ownership drift, a P1 optional-collection dereference in the success notification, and P2 gaps for clear/AI fallback behavior coverage. The submit dependencies were fixed, analyzer execution is dependency-injected through the hook interface, partial analysis results are normalized inside the hook, and the runtime contract now executes clear, success, failure, AI fallback, and partial-result paths.
- Browser QA: skipped for this slice because it is non-UI runtime analysis glue. The Clay UI lane browser evidence remains recorded below.
- Commit include scope for this runtime slice: `status.md`, `plans.md`, `implement.md`, `validation.md`, `tsconfig.tests.json`, `src/App.tsx`, `src/app/useEcommerceRequirementAnalysisRuntime.ts`, `tests/unit/ecommerce-requirement-analysis-runtime-contract.test.ts`, `tests/unit/ecommerce-analysis-button-gate.test.ts`, and `tests/unit/ecommerce-upload-removal-contract.test.ts`.

## Completed In `bd265ec9` (Ecommerce Task State Runtime)

- Extracted initial ecommerce task-state building and task edit synchronization into `src/app/useEcommerceTaskStateRuntime.ts`.
- `src/App.tsx` now wires `useEcommerceTaskStateRuntime` through the narrow `updateEcommerceTaskStateRuntimeState` adapter; App no longer owns the inline `buildInitialEcommerceTaskStates` or `handleChangeEcommerceTaskState` callbacks.
- New contract coverage in `tests/unit/ecommerce-task-state-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, source-row keyed initial state, effective sizing application, stored task updates by row key or task id, active draft updates by task id, and no-op behavior when nothing matches.
- The new contract test is included in `tsconfig.tests.json`, so `npm.cmd run typecheck` now semantically checks 14 test files instead of 13.
- Line counts after extraction: `src/App.tsx` 5843 physical lines; `src/app/useEcommerceTaskStateRuntime.ts` 124 physical lines; `tests/unit/ecommerce-task-state-runtime-contract.test.ts` 232 physical lines.
- Subagent review: spec compliance review passed with no findings. Code-quality review found no runtime blockers; its P2 staging warning is addressed by including the new hook/test in the same commit, and its P3 test-typecheck warning was fixed by adding the test to `tsconfig.tests.json`.
- Browser QA: skipped for this slice because it is non-UI runtime task-state glue. The Clay UI lane browser evidence remains recorded below.
- Commit include scope for this runtime slice: `status.md`, `plans.md`, `implement.md`, `validation.md`, `tsconfig.tests.json`, `src/App.tsx`, `src/app/useEcommerceTaskStateRuntime.ts`, and `tests/unit/ecommerce-task-state-runtime-contract.test.ts`.

## Completed In `9cb4d2c4` (Ecommerce Sheet Settings Runtime)

- Extracted ecommerce sheet defaults, A+ control mode resolution, effective task sizing, node generation settings, and sheet-setting updates into `src/app/useEcommerceSheetSettingsRuntime.ts`.
- `src/App.tsx` now wires the hook through `useEcommerceSheetSettingsRuntime` and adapts `setEcommerceState` through `updateEcommerceSheetSettingsState`, keeping App as orchestration and prop wiring.
- Existing prompt bar ecommerce footer contract was retargeted so sheet settings defaults and A+ 4K enforcement are owned by the hook instead of inline App helpers.
- New contract coverage in `tests/unit/ecommerce-sheet-settings-runtime-contract.test.ts` covers hook ownership, explicit deps/result interfaces, default sheet settings, A+ sizing policy behavior, and desktop/mobile generation target resolution. Existing prompt-bar and prompt-optimizer source contracts were retargeted away from removed inline App helpers.
- Line counts after extraction: `src/App.tsx` 5877 physical lines; `src/app/useEcommerceSheetSettingsRuntime.ts` 351 physical lines; `tests/unit/ecommerce-sheet-settings-runtime-contract.test.ts` 168 physical lines.
- Review note: `App.tsx` still imports the hook file's exported `createDefaultEcommerceSheetSettings` helper for initial state and node-build fallbacks because those paths run before or outside the hook invocation. The inline App implementations were removed; strict helper-call removal is deferred until a broader ecommerce analysis/node-build runtime boundary owns those call sites.
- Browser QA: skipped for this slice because it is non-UI runtime sheet-setting glue. The Clay UI lane browser evidence remains recorded below.
- Commit include scope for this runtime slice: `status.md`, `plans.md`, `implement.md`, `validation.md`, `src/App.tsx`, `src/app/useEcommerceSheetSettingsRuntime.ts`, `tests/unit/ecommerce-sheet-settings-runtime-contract.test.ts`, `tests/unit/prompt-bar-ecommerce-footer-controls.test.ts`, and `tests/unit/prompt-optimizer-service-source-contract.test.ts`.
- Explicitly excluded dirty UI paths: none in the writable metadata after `9e7ae2b5`; if plain `.git` still reports UI files, those belong to the metadata mismatch and must not be staged through plain `.git`.

## Completed In `ec434f94` (Paused Runtime/Ecommerce Lane)

- Ecommerce framework runtime state/view helpers route through `src/app/useEcommerceFrameworkRuntimeState.ts`.
- Extracted state/view boundary: `ecommerceFrameworkRuntimeRef`, `resolveEcommerceFrameworkId`, `updateEcommerceFrameworkRuntime`, `syncEcommerceFrameworkView`, and `handleActivateEcommerceGroupSheet`.
- `src/app/useEcommerceRuntime.ts` now consumes a single `frameworkStateView` boundary object instead of individual App inline deps for framework runtime state/view.
- Contract hardening: `tests/unit/ecommerce-framework-runtime-state-contract.test.ts` covers hook existence, explicit deps/result interfaces, App ordering, runtime-before-state ordering, sync-before-meta ordering, and the preserved `GenerationMode.ECOMMERCE` framework filter. `tests/unit/ecommerce-framework-runtime-order.test.ts` now targets the extracted hook.
- RED evidence: framework state/view contract tests failed before the hook existed and before `useEcommerceRuntime` consumed `frameworkStateView`; the ecommerce-mode filter assertion failed before restoring the original guard.
- Line counts after extraction: `src/App.tsx` 6484 lines; `src/app/useEcommerceFrameworkRuntimeState.ts` 240 lines; `src/app/useEcommerceRuntime.ts` 385 lines.
- Subagent review: spec and code-quality reviewers found the extracted boundary shape correct. A P2 mode-filter regression was fixed before commit; a P3 order-test gap was tightened before final validation.
- Browser QA was skipped for this slice because it was non-UI runtime state/view glue. This current UI thread owns the required browser evidence for Clay surfaces.
- The runtime/ecommerce lane is paused again and must stay out of the UI commit.

## Completed In `cf34f12b` (Ecommerce Upload Reference Runtime)

- Extracted upload/reference binding runtime into `src/app/useEcommerceUploadReferenceRuntime.ts`.
- New hook owns upload/reference identity helpers, `ReferenceImage` construction from uploads/assets, reference signatures, product image ref derivation, manual reference lookup, and product/extra/item pick/remove handlers.
- `src/App.tsx` now wires hook results through `useEcommerceUploadReferenceRuntime`, while requirement file handlers, confirm flow, and the built-card upload sync effect remain in `App.tsx`.
- Behavior preserved: image-only upload filtering, append-with-cap for product/extra/item references (`4/4/6`), file identity format `labelPrefix-sanitizedName-size-lastModified`, base64 payload extraction, full data URL retention, first-product-only `productImageRef`, and manual binding lookup by `taskStateSeed.sourceRowKey`.
- Review follow-up completed: `extractEcommerceManualReferenceBindings` now depends only on `itemReferenceFiles`, and no-op removal handlers return `null` instead of widening state churn. Empty per-item manual reference buckets are removed after the final item is deleted.
- Contract hardening: `tests/unit/ecommerce-upload-references-contract.test.ts` covers hook ownership, exported deps/result interfaces, helper behavior, no-op removal guards, and empty bucket cleanup. Existing upload removal and built-card sync contracts were retargeted from App inline ownership to hook ownership.
- Line counts after extraction: `src/App.tsx` 5644 lines; `src/app/useEcommerceUploadReferenceRuntime.ts` 299 lines; `tests/unit/ecommerce-upload-references-contract.test.ts` 214 lines.
- Browser QA: skipped for this slice because it is non-UI runtime upload/reference glue. The active Clay UI lane owns browser evidence for Clay surfaces.
- Commit include scope was `status.md`, `src/App.tsx`, `src/app/useEcommerceUploadReferenceRuntime.ts`, `tests/unit/ecommerce-upload-references-contract.test.ts`, `tests/unit/ecommerce-upload-removal-contract.test.ts`, and `tests/unit/ecommerce-runtime-upload-sync-contract.test.ts`.

## Completed In `9b0f7dd3` (Ecommerce Group Export Runtime)

- Extracted ecommerce group export and slot-result synchronization into `src/app/useEcommerceGroupExportRuntime.ts`.
- New hook owns `sanitizeEcommerceExportName`, latest slot image resolution, group slot sync via `applyEcommerceSlotResult`, manifest construction via `buildEcommerceGroupExportManifest`, zip packaging, dynamic file-saver invocation, no-export warning, fallback-quality warning, and success notification.
- `src/App.tsx` now injects `activeCanvas`, `activeCanvasRef`, `ecommerceState`, `setEcommerceGroupExportState`, and `resolvePptImageBlob`, then only wires `handleExportEcommerceGroup` into prompt node props.
- Behavior preserved: default latest-image lookup still considers all delivery kinds when no `deliveryKind` is provided; `desktop-then-mobile` still records independent desktop/mobile deliverables; no generated deliverables still warn instead of exporting an empty zip; file-name sanitization preserves the previous replacement behavior.
- Hardening completed: file-saver is now dynamically imported through a CJS/ESM-compatible adapter for direct Node contract imports; `buildNextEcommerceGroupSlots` normalizes missing slot arrays, selected item maps, and delivery arrays before iterating.
- Contract updates: `tests/unit/ecommerce-group-export-runtime-contract.test.ts` covers hook ownership and pure helper behavior. Existing export entry, slot integration, ecommerce canvas, and no-export guard tests were retargeted from App inline ownership to hook ownership.
- Line counts after extraction: `src/App.tsx` 6062 lines; `src/app/useEcommerceGroupExportRuntime.ts` 365 lines; `tests/unit/ecommerce-group-export-runtime-contract.test.ts` 182 lines.
- Subagent review: governance review confirmed this slice should stay path-limited and avoid UI lane files. Code-quality review found no P1/P2 blockers, noted the default delivery semantics and runtime nullish hardening, and left a P3 follow-up to upgrade the no-export guard from source regex to behavior-level coverage later. The default behavior was kept as historical behavior, and the nullish hardening was applied.
- Browser QA: skipped for this slice because it is non-UI runtime export glue. The active Clay UI lane owns browser evidence for visual surfaces.
- Commit include scope for this runtime slice: `status.md`, `src/App.tsx`, `src/app/useEcommerceGroupExportRuntime.ts`, `tests/unit/ecommerce-group-export-runtime-contract.test.ts`, `tests/unit/ecommerce-group-export-entry.test.ts`, `tests/unit/ecommerce-group-slot-integration.test.ts`, `tests/unit/ecommerce-canvas-contract.test.ts`, and `tests/unit/ecommerce-export-button-guards.test.ts`.
- Explicitly excluded dirty UI paths: `plans.md`, `implement.md`, `validation.md`, `.agent/rules/skills/SKILL.md`, `src/app/AppDesktopChrome.tsx`, `src/components/**`, `src/index.css`, `src/main.tsx`, `src/workflow/nodes/WorkflowUtilityCard.tsx`, and Clay/theme UI tests.

## Completed In `be63eda2`

- Ecommerce selection actions now route through `src/app/useEcommerceRuntime.ts`, with pure state helpers in `src/app/ecommerceSelectionRuntime.ts`.
- Extracted actions: `handleToggleEcommerceAnalysisSelection`, `handleToggleEcommerceSelected`, and `handleSetEcommerceGroupSelection`.
- Contract hardening: `tests/unit/ecommerce-runtime-contract.test.ts` asserts selection handler ownership and App wiring; `tests/unit/ecommerce-runtime-selection.test.ts` verifies selected item and group slot synchronization.
- RED evidence: selection ownership and pure helper tests failed before hook/helper implementation; they passed after extraction and the narrowed `updateEcommerceSelectionState` dependency.
- Line counts after extraction: `src/App.tsx` 6658 lines; `src/app/useEcommerceRuntime.ts` 390 lines; `src/app/ecommerceSelectionRuntime.ts` 101 lines; `tests/unit/ecommerce-runtime-selection.test.ts` 119 lines.
- Validation passed before commit: targeted ecommerce selection tests (11/11), `npm.cmd run typecheck`, `npm.cmd run test:unit` (1066/1066), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and targeted `git diff --check`.

## Completed In `294b0d3e`

- `src/app/useEcommerceRuntime.ts` owns the ecommerce framework scheduler actions previously inline in `src/App.tsx`.
- Extracted actions: `resolveEcommerceFrameworkQueuePhases`, `enqueueEcommerceFrameworkNodes`, `pumpEcommerceFrameworkQueue`, `handleGenerateEcommerceFramework`, `handlePauseEcommerceFramework`, `handleResumeEcommerceFramework`, `handleCancelEcommerceFrameworkNodeQueue`, and `handleGenerateEcommerceGroup`.
- Contract hardening: `tests/unit/ecommerce-runtime-contract.test.ts` asserts hook ownership, explicit deps/result interfaces, and App wiring; `tests/unit/ecommerce-button-guards.test.ts` follows the no-eligible-card warning contract from the hook.
- Line counts after extraction: `src/App.tsx` 6716 lines; `src/app/useEcommerceRuntime.ts` 341 lines; `tests/unit/ecommerce-runtime-contract.test.ts` 44 lines.
- Validation passed before commit: targeted ecommerce framework tests (10/10), `npm.cmd run typecheck`, `npm.cmd run test:unit` (1065/1065), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and targeted `git diff --check`.

## Completed In `92abdacf`

- Hardened PPT runtime export ordering so `handleExportPptx`, `handleExportPptPackage`, and `handleExportPptSinglePage` route through `getOrderedPptNodeBundle`.
- Updated `tests/unit/ppt-runtime-contract.test.ts` to reject direct `getPromptPptImageNodes` usage in `src/app/usePptRuntime.ts`.
- Validation passed before commit: targeted PPT/runtime contracts, `npm.cmd run typecheck`, `npm.cmd run test:unit` (1064/1064), `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and `git diff --check` with CRLF normalization warnings only.

## Completed In `4c448660`

### Clay UI

- Clay design and rule docs were reconciled with `DESIGN-clay.md` and the user override for controlled frosted material.
- Shared tokens were added for neutral dark surfaces and frosted inputs, main cards, sub cards, and framework cards.
- Dark mode now targets neutral black-gray surfaces: `#0b0b0c`, `#141414`, and `#1f1f1f`.
- Major UI surfaces were moved onto the shared material system: search palette, sidebar, prompt/composer inputs, mobile shell, settings, storage modal, ecommerce panels, and canvas/image cards.
- Contract coverage includes controlled frosted tokens, neutral dark aliases, legacy blue-black token regressions, ecommerce frosted surfaces, mobile workspace surfaces, and theme contrast.

### Runtime / PPT Boundary Work

- `src/App.tsx` was reduced to 6210 lines in the committed baseline.
- `src/app/useGenerationRuntime.ts` owns generation runtime orchestration and related retry/billing contracts.
- `src/app/usePptRuntime.ts` owns PPT runtime orchestration.
- `src/app/pptRuntimeHelpers.ts` centralizes PPT image ordering, stale child fallback, parent prompt rejection, deck child detection, and nullish image array guards.
- PPT and generation runtime contracts were expanded in the same committed baseline.

## Latest Recorded Validation

Fresh validation for the latest finalization/security cleanup line through `b6620ef2`:

- Passed targeted OCR/API gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ocr-service-settings-contract.test.ts tests/unit/ecommerce-analysis-client-fallback.test.ts tests/unit/api-settings-capability-routing-contract.test.ts tests/unit/portable-app-server-document-proxy-contract.test.ts`.
- Passed dead-code pruning gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/legacy-compatibility-pruning.test.ts tests/unit/service-barrel-pruning.test.ts`.
- Passed settings smoke fallback checks: `npm.cmd run verify:desktop-settings-smoke` and `npm.cmd run verify:mobile-settings-smoke` in fallback mode with route checks returning 200. Direct in-app Browser QA was attempted but blocked by the local server listener disappearing after the server printed ready.
- Passed full gates: `npm.cmd run architecture:check`, `npm.cmd run governance:check`, `npm.cmd run spec:check`, `npm.cmd audit --audit-level=moderate`, `npm.cmd audit --omit=dev --audit-level=moderate`, `npm.cmd run typecheck`, `npm.cmd run test:unit` (1131/1131), `npm.cmd run build`, `npm.cmd run check:encoding`, and `npm.cmd run governance:agent-docs`.
- Passed path-limited alternate-git diff checks for touched code/security/release files with only LF/CRLF normalization warnings.

Fresh validation for the ledger review follow-up:

- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.

Fresh validation for Stage Two M18 Canvas workflow update helper extraction:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-updates-contract.test.ts` failed first with 4/4 failures before the helper existed and before `CanvasContext.tsx` delegated to it.
- Passed standalone workflow updates contract after extraction: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-updates-contract.test.ts` (4/4).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-updates-contract.test.ts tests/unit/canvas-workflow-source-node-ids-contract.test.ts tests/unit/workflow-document-domain.test.ts tests/unit/canvas-cleanup-contract.test.ts` (12/12).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 56 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1190/1190).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasWorkflowUpdates.ts tests/unit/canvas-workflow-updates-contract.test.ts tests/unit/canvas-workflow-source-node-ids-contract.test.ts src/workflow/adapters/canvasToWorkflow.ts src/workflow/persistence/workflowSerializer.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.

Fresh validation for Stage Two M19 Canvas image delete helper extraction:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-image-links-contract.test.ts` failed first with 2 failures before `deleteCanvasImageNode` existed and before `CanvasContext.tsx` delegated to it.
- Passed standalone prompt-image links contract after extraction: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-image-links-contract.test.ts` (5/5).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-image-links-contract.test.ts tests/unit/canvas-workflow-updates-contract.test.ts tests/unit/canvas-cleanup-contract.test.ts` (12/12).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 56 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1191/1191).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasPromptImageLinks.ts tests/unit/canvas-prompt-image-links-contract.test.ts plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.

Fresh validation for Stage Two M20 Canvas merge-into helper extraction:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-merge-into-contract.test.ts` failed first with 4/4 failures before the helper existed and before `CanvasContext.tsx` delegated to it.
- Passed standalone merge-into contract after extraction: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-merge-into-contract.test.ts` (4/4).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-merge-into-contract.test.ts tests/unit/canvas-merge-contract.test.ts tests/unit/canvas-cleanup-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts` (12/12).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 57 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1195/1195).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasMergeInto.ts tests/unit/canvas-merge-into-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.

Fresh validation for Stage Two M21 Canvas unused-code cleanup:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts` failed first before the unused imports/constants/writes were removed.
- Passed standalone cleanup contract after removal: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts` (1/1).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-unused-cleanup.test.ts tests/unit/canvas-merge-into-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts` (6/6).
- Passed: `npm.cmd run architecture:check` with existing allowlisted migration and legacy bridge exceptions only.
- Passed: `npm.cmd run typecheck`; test semantic check covers 58 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1196/1196).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx tests/unit/canvas-context-unused-cleanup.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.

Fresh validation for Stage Two M6 prompt recovery extraction:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-recovery-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasPromptRecovery.ts`.
- Passed standalone prompt recovery contract after behavior coverage: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-recovery-contract.test.ts` (5/5).
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-recovery-contract.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` (8/8).
- Passed: `npm.cmd run architecture:check` with the existing allowlisted migration and legacy bridge exceptions.
- Passed: `npm.cmd run typecheck`; test semantic check covers 44 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1136/1136).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasPromptRecovery.ts tests/unit/canvas-prompt-recovery-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Spec review by subagent `019dec5d-7052-7f73-b08d-68b5ec64f2fc` found no findings and confirmed async hydration/persisted-result recovery remained in `CanvasContext.tsx`.
- Re-review by subagents `019dec5d-7052-7f73-b08d-68b5ec64f2fc` and `019dec5d-b17d-7102-8ebf-18d6fa2fbf15` found no Critical or Important code findings after behavior coverage; the remaining action is explicit staging of the new helper and contract test.

Fresh validation for Stage Two M7 persisted image recovery extraction:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-persisted-image-recovery-contract.test.ts` failed first before the helper existed and before `CanvasContext.tsx` imported it.
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-persisted-image-recovery-contract.test.ts tests/unit/canvas-persisted-image-hydration-guard.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` (8/8).
- Passed: `npm.cmd run architecture:check` with the existing allowlisted migration and legacy bridge exceptions.
- Passed: `npm.cmd run typecheck`; test semantic check covers 45 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1140/1140).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasPersistedImageRecovery.ts tests/unit/canvas-persisted-image-recovery-contract.test.ts tests/unit/canvas-persisted-image-hydration-guard.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Browser QA: skipped because this is a non-UI context/helper extraction and no visual surface, CSS, route, or browser behavior changed.
- Spec review by subagent `019dec5d-7052-7f73-b08d-68b5ec64f2fc` found no findings. Code-quality review by subagent `019dec5d-b17d-7102-8ebf-18d6fa2fbf15` found no Critical issues; its coverage suggestion for URL resolution was addressed by executable tests, and its untracked-file warning was resolved by explicit path-based staging.

Fresh validation for Stage Two M2 Canvas selection reducer:

- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-selection-runtime-contract.test.ts tests/unit/prompt-group-drag-layout.test.ts tests/unit/prompt-group-regroup-behavior.test.ts` (44/44).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 40 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run architecture:check` with the existing allowlisted migration and legacy bridge exceptions.
- Passed: `npm.cmd run test:unit` (1119/1119).
- Passed: `npm.cmd run build`.
- Passed final docs/encoding validation: `npm.cmd run governance:agent-docs` and `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasSelection.ts tests/unit/canvas-selection-runtime-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.

Fresh validation for Stage Two M3 prompt child image resolver:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-child-images-runtime-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasPromptChildImages.ts`.
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-prompt-child-images-runtime-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` (7/7).
- Passed: `npm.cmd run architecture:check` with the existing allowlisted migration and legacy bridge exceptions.
- Passed: `npm.cmd run typecheck`; test semantic check now covers 41 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1123/1123).
- Passed: `npm.cmd run build`.
- Passed final docs/encoding validation: `npm.cmd run governance:agent-docs` and `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasPromptChildImages.ts tests/unit/canvas-prompt-child-images-runtime-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.

Fresh validation for Stage Two M4 workflow source node ID resolver:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-source-node-ids-contract.test.ts` failed first with `ERR_MODULE_NOT_FOUND` for `src/context/canvasWorkflowSourceNodeIds.ts`.
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-workflow-source-node-ids-contract.test.ts tests/unit/canvas-prompt-child-images-runtime-contract.test.ts tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` (9/9).
- Passed: `npm.cmd run architecture:check` with the existing allowlisted migration and legacy bridge exceptions.
- Passed: `npm.cmd run typecheck`; test semantic check now covers 42 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1126/1126).
- Passed: `npm.cmd run build`.
- Passed final docs/encoding validation: `npm.cmd run governance:agent-docs` and `npm.cmd run check:encoding`.
- Passed path-limited diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasWorkflowSourceNodeIds.ts tests/unit/canvas-workflow-source-node-ids-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.

Fresh validation for Stage Two M1 CanvasContext state boundary:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-state-boundary.test.ts` failed while `src/context/CanvasContext.tsx` still contained `LegacyInlineCanvas` residue, and failed again after review hardening while the React context object still lived inline.
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-state-boundary.test.ts tests/unit/canvas-startup-local-restore.test.ts tests/unit/canvas-cloud-sync-signature.test.ts` (3/3).
- Passed: `npm.cmd run architecture:check` with the existing 5 allowlisted migration exceptions and 2 legacy bridge exceptions.
- Passed: `npm.cmd run typecheck`; test semantic check now covers 39 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1117/1117).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check before final ledger edits: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/context/CanvasContext.tsx src/context/canvasContextState.ts src/context/canvasCompatibility.ts tests/unit/canvas-context-state-boundary.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only.

Fresh validation for Stage One Backfill M5 PPT runtime boundary:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ppt-runtime-contract.test.ts` failed because `tests/unit/ppt-runtime-contract.test.ts` was not included in `tsconfig.tests.json`.
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ppt-runtime-contract.test.ts tests/unit/ppt-runtime-helper-contract.test.ts tests/unit/ppt-deck-single-container-contract.test.ts` (6/6).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 38 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1116/1116).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check before ledger edits: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- tests/unit/ppt-runtime-contract.test.ts tsconfig.tests.json` with LF/CRLF normalization warnings only.
- Passed final ledger validation after ledger edits: `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- tests/unit/ppt-runtime-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.

Fresh validation for Stage One Backfill M1 connector renderer hardening:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-connector-throttling-contract.test.ts` failed because `ConnectorRenderSnapshot`, `UseConnectorRendererDeps`, and `UseConnectorRendererResult` were not exported.
- Passed targeted gate: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-connector-throttling-contract.test.ts tests/unit/canvas-local-performance-trace-contract.test.ts tests/unit/canvas-live-scene-contract.test.ts` (14/14).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 32 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1114/1114).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/app/useConnectorRenderer.ts tests/unit/canvas-connector-throttling-contract.test.ts tsconfig.tests.json status.md` with LF/CRLF normalization warnings only.

Fresh validation for the completed ecommerce partial redraw runtime pass in `d12731ce`:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-partial-redraw-runtime-contract.test.ts tests/unit/ecommerce-structured-task-source-contract.test.ts tests/unit/partial-redraw-pipeline-contract.test.ts tests/unit/mobile-result-feed-app-contract.test.ts` (6/6).
- Passed: `npm.cmd run typecheck`; test semantic check covered 31 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1113/1113).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed tracked diff check: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommercePartialRedrawRuntime.ts tests/unit/ecommerce-partial-redraw-runtime-contract.test.ts tsconfig.tests.json plans.md implement.md validation.md status.md` with LF/CRLF normalization warnings only.
- Additional recorded health gates after `d12731ce`: `npm.cmd run architecture:check` passed, `npm.cmd run spec:check` passed, and `npm.cmd run governance:check` had a portable metadata `governance:version` mismatch at that point; the mismatch was later cleared in `567f85aa`.

Fresh validation for the current ledger-only correction:

- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- plans.md implement.md status.md validation.md` with LF/CRLF normalization warnings only.

Historical validation for `017bb3a2` ecommerce requirement analysis runtime pass:

- RED evidence: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-requirement-analysis-runtime-contract.test.ts` failed first on missing `runEcommerceRequirementAnalysis` export.
- RED evidence: the ecommerce submit dependency contract failed first because the `handleGenerate` dependency list omitted `ecommerceState.analysis`, `handleAnalyzeEcommerceRequirement`, and `handleConfirmEcommerceAnalysis`.
- Passed after implementation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-requirement-analysis-runtime-contract.test.ts tests/unit/ecommerce-analysis-button-gate.test.ts tests/unit/ecommerce-upload-removal-contract.test.ts tests/unit/ecommerce-task-state-runtime-contract.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts` (22/22).
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-requirement-analysis-runtime-contract.test.ts tests/unit/ecommerce-analysis-button-gate.test.ts tests/unit/ecommerce-upload-removal-contract.test.ts tests/unit/ecommerce-task-state-runtime-contract.test.ts tests/unit/ecommerce-sheet-settings-runtime-contract.test.ts tests/unit/ecommerce-model-policy.test.ts tests/unit/ecommerce-task-services.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts tests/unit/ecommerce-runtime-contract.test.ts tests/unit/prompt-optimizer-service-source-contract.test.ts` (55/55).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 17 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1096/1096).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommerceRequirementAnalysisRuntime.ts tests/unit/ecommerce-requirement-analysis-runtime-contract.test.ts tests/unit/ecommerce-analysis-button-gate.test.ts tests/unit/ecommerce-upload-removal-contract.test.ts tsconfig.tests.json status.md plans.md implement.md validation.md` with LF/CRLF normalization warnings only.

Historical validation for `bd265ec9` ecommerce task state runtime pass:

- Passed RED first: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-task-state-runtime-contract.test.ts` failed on missing `src/app/useEcommerceTaskStateRuntime.ts`.
- Passed after implementation: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-task-state-runtime-contract.test.ts` (4/4).
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-task-state-runtime-contract.test.ts tests/unit/ecommerce-sheet-settings-runtime-contract.test.ts tests/unit/ecommerce-model-policy.test.ts tests/unit/ecommerce-task-services.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts tests/unit/ecommerce-runtime-contract.test.ts` (33/33).
- Passed: `npm.cmd run typecheck`; test semantic check now covers 14 files via `tsconfig.tests.json`.
- Passed: `npm.cmd run test:unit` (1082/1082).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommerceTaskStateRuntime.ts tests/unit/ecommerce-task-state-runtime-contract.test.ts tsconfig.tests.json status.md plans.md implement.md validation.md` with LF/CRLF normalization warnings only.

Historical validation for `9cb4d2c4` ecommerce sheet settings runtime pass:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-optimizer-service-source-contract.test.ts tests/unit/ecommerce-sheet-settings-runtime-contract.test.ts tests/unit/prompt-bar-ecommerce-footer-controls.test.ts tests/unit/ecommerce-model-policy.test.ts tests/unit/ecommerce-task-services.test.ts` (34/34).
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1078/1078).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommerceSheetSettingsRuntime.ts tests/unit/ecommerce-sheet-settings-runtime-contract.test.ts tests/unit/prompt-bar-ecommerce-footer-controls.test.ts tests/unit/prompt-optimizer-service-source-contract.test.ts status.md plans.md implement.md validation.md` with LF/CRLF normalization warnings only.

Fresh validation for the current Clay UI audit closure:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/clay-global-ui-refit-contract.test.ts tests/unit/clay-frosted-surface-contract.test.ts tests/unit/theme-contrast-contract.test.ts tests/unit/responsive-surface.test.ts tests/unit/theme-system-adaptation.test.ts tests/unit/settings-entry-surface-style-regression.test.ts` (37/37).
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1075/1075).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git diff --check` with LF/CRLF normalization warnings only.

Historical validation for the paused runtime/PPT follow-up pass:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ppt-runtime-contract.test.ts tests/unit/ppt-runtime-helper-contract.test.ts tests/unit/ppt-deck-single-container-contract.test.ts` (6/6).
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ppt-runtime-contract.test.ts tests/unit/ppt-runtime-helper-contract.test.ts tests/unit/ppt-deck-single-container-contract.test.ts tests/unit/generation-runtime-contract.test.ts tests/unit/generation-billing-runtime-contract.test.ts` (57/57).
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1064/1064).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git diff --check` with CRLF normalization warnings only.
- Re-run after ledger correction: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ppt-runtime-contract.test.ts tests/unit/ppt-runtime-helper-contract.test.ts tests/unit/ppt-deck-single-container-contract.test.ts` passed (6/6).
- Re-run after ledger correction: `npm.cmd run governance:agent-docs` passed.
- Re-run after ledger correction: `npm.cmd run check:encoding` passed.

Historical validation for the paused ecommerce runtime slice:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-framework-runtime.test.ts tests/unit/ecommerce-framework-contract.test.ts tests/unit/ecommerce-button-guards.test.ts` (10/10).
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1065/1065).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git diff --check -- src/App.tsx src/app/useEcommerceRuntime.ts tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-button-guards.test.ts status.md plans.md implement.md validation.md` with CRLF normalization warnings only.

Historical validation for the paused ecommerce selection runtime slice:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-runtime-selection.test.ts tests/unit/ecommerce-analysis-selection-contract.test.ts tests/unit/ecommerce-button-guards.test.ts tests/unit/ecommerce-group-slot-state.test.ts` (11/11).
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1066/1066).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git diff --check -- src/App.tsx src/app/useEcommerceRuntime.ts src/app/ecommerceSelectionRuntime.ts tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-runtime-selection.test.ts status.md` with CRLF normalization warnings only.

Historical validation for the paused ecommerce slot history runtime slice:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-group-slot-integration.test.ts tests/unit/ecommerce-group-slot-preview-contract.test.ts tests/unit/ecommerce-group-slot-state.test.ts` (8/8).
- Passed: `npm.cmd run typecheck`.
- Previous blocker now belongs to the active UI lane and was addressed by the current Clay frosted-surface contract update.
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.

Historical validation for `ec434f94` before the current UI closure pass:

- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-framework-runtime-state-contract.test.ts tests/unit/ecommerce-framework-runtime-order.test.ts tests/unit/ecommerce-framework-runtime.test.ts tests/unit/ecommerce-framework-contract.test.ts tests/unit/ecommerce-button-guards.test.ts tests/unit/ecommerce-runtime-selection.test.ts tests/unit/ecommerce-group-slot-state.test.ts tests/unit/ecommerce-group-slot-integration.test.ts tests/unit/ecommerce-group-slot-preview-contract.test.ts` (22/22).
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1069/1069).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.

Historical validation for the paused ecommerce upload/reference runtime WIP:

- Passed RED first: targeted upload/reference contract set failed on missing `src/app/useEcommerceUploadReferenceRuntime.ts` and App still owning inline upload handlers.
- Passed after implementation and review follow-up: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-upload-references-contract.test.ts tests/unit/ecommerce-upload-removal-contract.test.ts tests/unit/ecommerce-runtime-upload-sync-contract.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts` (7/7).
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1072/1072).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.

Historical validation for the paused ecommerce group export runtime WIP:

- Passed first targeted reproduction after fixes: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-group-export-runtime-contract.test.ts tests/unit/ecommerce-group-export-entry.test.ts tests/unit/ecommerce-group-slot-integration.test.ts` (4/4).
- Passed broadened ecommerce runtime/export suite: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ecommerce-canvas-contract.test.ts tests/unit/ecommerce-export-button-guards.test.ts tests/unit/ecommerce-group-export-runtime-contract.test.ts tests/unit/ecommerce-group-export-entry.test.ts tests/unit/ecommerce-group-slot-integration.test.ts tests/unit/ecommerce-group-slot-preview-contract.test.ts tests/unit/ecommerce-group-slot-state.test.ts tests/unit/ecommerce-runtime-contract.test.ts tests/unit/ecommerce-framework-runtime-state-contract.test.ts tests/unit/ecommerce-framework-runtime-order.test.ts tests/unit/ecommerce-framework-runtime.test.ts tests/unit/ecommerce-framework-contract.test.ts tests/unit/ecommerce-button-guards.test.ts tests/unit/ecommerce-runtime-selection.test.ts tests/unit/ecommerce-upload-references-contract.test.ts tests/unit/ecommerce-upload-removal-contract.test.ts tests/unit/ecommerce-runtime-upload-sync-contract.test.ts tests/unit/ecommerce-confirm-build-flow.test.ts` (34/34).
- Passed: `npm.cmd run typecheck`.
- Passed: `npm.cmd run test:unit` (1075/1075).
- Passed: `npm.cmd run build`.
- Passed: `npm.cmd run governance:agent-docs`.
- Passed: `npm.cmd run check:encoding`.
- Passed: `git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- src/App.tsx src/app/useEcommerceGroupExportRuntime.ts tests/unit/ecommerce-group-export-runtime-contract.test.ts tests/unit/ecommerce-group-export-entry.test.ts tests/unit/ecommerce-group-slot-integration.test.ts tests/unit/ecommerce-canvas-contract.test.ts tests/unit/ecommerce-export-button-guards.test.ts status.md` with CRLF normalization warnings only.

## Browser QA

- Browser QA was completed for the historical Clay UI lane before `9e7ae2b5`.
- Current AchievementToast cleanup browser smoke was completed after the `f453cd9a` build at `http://127.0.0.1:3102/?qa=onboarding-unused-cleanup-1777890000000`: production login screen rendered with title `KK Studio - AI Image Workspace`, no connection-refused or render-error text, and `0` current-port console errors. The `AchievementToast` route state was not directly visible without completing onboarding tasks.
- Current Onboarding residual cleanup browser smoke: blocked by Codex in-app Browser automation timeouts before navigation; fallback HTTP smoke against the built `dist` returned 200/title `KK Studio - AI Image Workspace`, but no pixel-level browser verdict was obtained for this slice.
- Current pure image orphan cleanup browser QA: skipped because the slice deletes a non-UI utility module with no production imports and does not change browser-visible runtime behavior.
- Current dormant Pixi canvas cleanup browser QA: skipped because the slice deletes a dormant renderer module with no production imports and does not change browser-visible runtime behavior.
- Current dormant canvas residual cleanup browser QA: skipped because the slice only removes unread source values from dormant support files, preserves public optional props, and leaves live `InfiniteCanvas.tsx` untouched.
- Current browser target: `http://127.0.0.1:3100/settings/api-management` through the Codex in-app Browser after `npm.cmd run build`.
- Theme and surface checked: dark theme, desktop settings API workbench.
- Verified surfaces: flattened settings sidebar/search, API settings hero, simplified provider list card, official-direct and proxy buttons, and page close/log/refresh actions.
- Browser findings: the settings API workbench rendered visibly with console error count `0`; supplemental desktop/mobile settings smoke scripts exited 0 in fallback mode because headless Chromium launch hit `spawn EPERM`.
- Light-theme readability is covered by the Clay emphasis contrast contract because the in-app Browser pass could not switch theme through the blocked `javascript:` injection path.
- Current M126 image payload security browser QA: skipped because the slice touches only `src/services/llm` helper logic, unit contracts, and ledger files; it has no JSX, CSS, route rendering, browser-visible UI, or release metadata change.
- Current M127 image reference cleanup browser QA: skipped because the slice touches only `src/services/llm` helper/adapter source, unit contracts, and ledger files; it has no JSX, CSS, route rendering, browser-visible UI, or release metadata change.
- Current M128 dead-cache/log-redaction browser QA: skipped because the slice removes a dead storage helper and prompt-content console diagnostic only; it has no JSX, CSS, route rendering, browser-visible UI, or release metadata change.
- Current M129 keyManager update diagnostic browser QA: skipped because the slice touches only a key-manager console diagnostic helper and source contracts; it has no JSX, CSS, route rendering, browser-visible UI, or release metadata change.
- Current M130 OpenAI-compatible diagnostics browser QA: skipped because the slice touches only service diagnostics metadata and unit contracts; it has no JSX, CSS, route rendering, browser-visible UI, or release metadata change.
- Current settings shell card fix browser QA: desktop settings smoke and mobile settings smoke both exited 0 in fallback mode because headless Chromium launch hit `spawn EPERM`; fallback route checks returned 200 for `/`, `/settings`, and `/settings/api-management`. Pixel-level browser validation is still blocked by the local Chromium launch policy.
- Current settings shell card fix validation: targeted RED/GREEN completed for `tests/unit/settings-desktop-workbench-regression.test.ts`; `tests/unit/clay-frosted-surface-contract.test.ts` also passed after updating the frosted-surface contract. Fresh checks passed: `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run verify:desktop-settings-smoke` fallback, `npm.cmd run verify:mobile-settings-smoke` fallback, and `npm.cmd run check:encoding`.
- Current settings shell card fix implementation: `src/index.css` now keeps the desktop `.settings-shell-desktop` as the containing card with `1px` shell border and shell shadow while preserving the mobile shell's frameless treatment.

## Remaining Work

Fresh remaining-work assessment after `dade1de4`, the M131 prompt optimizer cache/logging redaction, and the current M132 shared local user-route auth inference slice:

- Current fact source: the latest committed code baseline before M132 is `dade1de4 fix: redact prompt optimizer cache diagnostics`; exact HEAD after this slice must be read from alternate git.
- Current finalization gate: `governance:check`, `architecture:check`, `governance:security`, `spec:check`, `audit:dependencies`, `typecheck`, `test:unit` 1373/1373, `build`, `check:encoding`, the strict no-unused probe, and the settings browser/manual smoke checks passed before M124. M124-M131 separately passed their focused gates, strict TS, architecture/security where required, typecheck, unit, build, agent-docs, encoding, and path-limited diff checks. M132 focused RED/GREEN passed 28/28 after subagent-review follow-ups; fresh post-ledger path-limited diff check passed before commit.
- Largest tracked TS/TSX/JS files still above 2k lines after the current M130 working tree: `src/App.tsx` 4328; `src/components/layout/PromptBar.tsx` 3631; `src/services/auth/keyManager.ts` 3595; `src/components/settings/ApiSettingsView.tsx` 3071; `src/services/llm/OpenAICompatibleAdapter.ts` 2536; `src/components/layout/ChatSidebar.tsx` 2477; `src/app/useGenerationRuntime.ts` 2341; `src/context/CanvasContext.tsx` 2197; `src/components/canvas/PromptNodeComponent.tsx` 2121; `apps/api/src/server.ts` 1918; `apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts` 1907; `src/hooks/useImageGeneration.ts` 1863.
- Current debt counts across `src`, `apps`, `packages`, `payment-server`, and `tests`: direct `as any` matches 152; broad `any` token matches 546; TS suppressions 133; `console.log` matches 246.
- Interpretation: the repository is build/test/security-green and the settings UI closure is now complete, but it is still not refactor-complete because Stage Two giant-file splitting, Stage Three quality governance, and Stage Four `apps/web` migration remain open. Remaining completion estimate is still roughly 3 major rounds: Stage Two seams, Stage Three debt governance, and Stage Four migration, plus the final audit/packaging pass.

1. The current noUnused filter is clean; the route-gate helpers are wired into live entrypoints; M107-M132 moved the latest OpenAI-compatible, server, storage/logging, key diagnostic, prompt diagnostics, prompt optimizer, and local user-route auth-helper seams into focused modules or source contracts; M118 and M122 closed the latest confirmed security blockers.
2. M132 removes the duplicated diagnostics auth inference copy and uses the shared local user-route helper so GPT Best Gemini diagnostics match local proxy Bearer-header auth behavior.
3. The next ordinary cleanup candidate should be chosen from the read-only candidates: OpenAI-compatible error helpers or another small service diagnostics boundary. `PromptBar.tsx` attachment/drag/reference-image ingestion remains available but requires browser QA because it touches file-input UI behavior.
4. Remaining OpenAI-compatible adapter seams: request builders, response parsing, provider quirks, polling fetch helpers, and image/video/audio compatibility still need fresh maps. Do not change endpoint selection, auth, fetch behavior, or fallback ordering without a dedicated behavior test.
5. Follow-up server seam after M132: inspect another server diagnostics/helper boundary only after this auth slice is committed; do not reopen local user-route auth/header/query-key behavior without a new concrete regression and focused RED test.
6. Follow-up UI seam: split `src/components/layout/PromptBar.tsx` paste/drop/reference-image ingestion and drag handling only with browser QA, because it touches file-input UI behavior.
7. `keyManager.ts` still needs a fresh seam map before any additional work; do not enter key storage, cloud sync, provider persistence, credential management, permissions, encryption helpers, runtime routing, fetch/auth behavior, endpoint selection, or shared pricing cache construction without a smaller proven boundary.
8. CanvasContext remains seam-selection-only for now; avoid `migrateNodes`, IndexedDB/local-folder movement, and persistence orchestration until a smaller diagnostics or hydration helper is mapped.
9. Stage Three quality governance is still open: direct `as any`, explicit any-type patterns, TS suppressions, and bare `console.log` must continue dropping inside touched files, not through one broad repository sweep.
10. Stage Four `apps/web` migration is still open and should not start until Stage Two boundaries are stable.
11. If release metadata changes again, rerun packaging/publish and the full release gate including `npm.cmd run governance:check`.

## Risks

- Original `.git` does not match the writable metadata copy in this session. Use the full writable metadata copy at `node_modules/.codex-git-full` for local commits unless the ACL is fixed outside the sandbox.
- Plain `.git` may show stale dirty state and must not be used as the commit-readiness source.
- The alternate-git worktree was clean at `d229c791` before this ledger alignment pass, but any staging must still be explicit path-based and reviewed before commit.
- Browser smoke tests currently pass only in fallback mode because headless Chromium launch is blocked by `spawn EPERM`; do not claim pixel-level UI validation until a real browser launch or in-app manual pass is available.
- Do not delete locks, change `.git` ACLs, revert paused runtime/PPT work, or stage unrelated runtime files without explicit user confirmation.
- Do not mix UI, PPT, runtime extraction, release metadata, and quality-debt cleanup in one commit.
