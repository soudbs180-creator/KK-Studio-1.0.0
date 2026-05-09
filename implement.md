# KK-Studio v1.4.6 Implementation Rules

Last updated: 2026-05-09

## Operating Mode

Current 1.4.6 release blocker audit (2026-05-09): align the two-feature release line, including desktop snap-to-grid and collapsed manual groups, while preserving hosted/VPS proxy, dependency audit, visible Chinese text, PromptBar QA, and clean-hosted-env guardrails. Use alternate git only.

Release audit execution rules:
- Stage and commit release audit files in narrow groups: security/proxy/dependency/VPS, UI/localization, and ledger updates.
- Do not stage `.env.local`, `apps/api/.env.local`, `output/`, `.tmp*`, Playwright screenshots, or unrelated canvas snap/collapsed-group files.
- Vercel proxy defaults must be HTTPS. Production proxy code must fail closed before sending Authorization, cookie, csrf, session, or token-like headers to an HTTP upstream.
- Hosted builds must use same-origin HTTPS or an HTTPS VPS API domain. A local HTTP VPS base URL is allowed only as a local dirty snapshot and must block hosted preflight.
- `VITE_TURNSTILE_LOCAL_BYPASS=true` is forbidden in hosted release snapshots. Real hosted Turnstile/OAuth/payment sidecar secrets must be supplied in the deployment environment, not committed.
- Chinese visible UI fixes must be verified through `npm.cmd run check:encoding` and a focused visible-text contract. Technical terms such as `Turnstile`, `API Key`, `PPT`, `PPTX`, `Chrome`, and `Edge` may remain English.
- UI release audit work requires real browser evidence. Record URL, viewport, theme, console/page errors, stale chunk count, `.theme-transitioning`, clipped button count, PromptBar active gradient evidence, and local sensitive-storage keys in `status.md`.
- If `npm.cmd run release:hosted:check` fails only because local dirty env contains dev bypass or remote HTTP API base URL, record it as a release-environment blocker and do not weaken the guard.
- VPS nginx public virtual hosts must fail closed for `/internal/` with `404`; do not expose internal payment callback or settlement paths through public DNS.
- Production release remains blocked if `api.kkai.plus` cannot serve HTTPS with a valid certificate and healthy `/healthz`, `/api/manifest`, and `/api/v1/auth/session` responses.

Current desktop snap-to-grid hotfix (2026-05-09): add the desktop left-toolbar snap toggle and route the enabled state into prompt, image, workflow utility, selected-node, and canvas-group drag commit paths. Keep the change scoped to canvas snap behavior, the toolbar control, focused contract coverage, and ledger updates. Do not stage or commit existing unrelated hosted/API/payment/PromptBar/settings/collapsed-group work.

Snap-to-grid implementation rules:
- The snap grid size is the visible canvas grid size, currently 16 canvas units.
- Disabled snap must preserve existing free-drag behavior exactly.
- Invalid coordinates or invalid grid sizes must be returned unchanged.
- Apply snapping after pointer-to-canvas coordinate conversion and before persisted position updates.
- Do not apply render/pixel rounding to already snapped persisted workflow positions; render-only pixel alignment must stay separate from canvas position storage.
- Multi-selected drag commits must snap each moved node's final position independently when snap is enabled, not only snap the source card delta.
- Desktop toolbar state must be accessible through `aria-pressed` and a stable `data-testid`.
- UI evidence is required before commit. Prefer the Codex in-app Browser; if it is blocked, record the blocker and use the repository Playwright/headless-browser fallback with URL, viewport, theme, checked surfaces, `.theme-transitioning`, stale chunk text, and console-error status.
- Stage only snap-to-grid files plus ledger files, with patch staging if a file also contains unrelated dirty work.

Current desktop collapsed manual group hotfix (2026-05-09): add the desktop manual-group hide/expand path requested by the user. Keep the change scoped to manual canvas group collapse state, compact card UI, hidden-member render/load suppression, focused contract coverage, browser evidence, and ledger updates. Do not stage or commit existing unrelated hosted/API/payment/PromptBar/settings/snap-to-grid work.

Collapsed manual group implementation rules:
- Persist only a small optional `CanvasGroup.collapsed` flag; do not duplicate member state or delete hidden nodes.
- The expanded manual group header owns the hide control and uses lucide `EyeOff`; the collapsed card owns the expand control and uses lucide `Eye`.
- Collapsed cards must render as compact canvas objects with expand text plus group label only.
- Hidden group members must be excluded from prompt/image/workflow render queues, prompt-group child data, image-load scheduling/prefetch, connector rendering, and canvas fit/card-position inputs.
- Collapsed group culling must use computed member bounds when available, matching `CanvasGroupComponent` placement, instead of relying on stale persisted `group.bounds`.
- UI evidence is required before commit. Prefer the Codex in-app Browser; if it is blocked, record the blocker and use the repository Playwright/headless-browser fallback with URL, viewport, theme, checked surfaces, connector count, `.theme-transitioning`, stale chunk text, and console-error status.
- Stage only collapsed-group files plus ledger files. Use patch staging for mixed files such as `src/App.tsx` and `tsconfig.tests.json`, excluding snap-to-grid and hosted/VPS hunks.

Completed provider compatibility override (2026-05-08): GPT Best priority compatibility from `https://gpt-best.apifox.cn/llms.txt` is committed in `fe99e829`. M131 prompt optimizer cache/logging redaction is committed in `dade1de4`. The active slice is M132 shared local user-route auth inference. Keep changes path-limited to the local user-route auth helper, diagnostics auth inference, focused local user-route contracts, and ledgers. Do not change endpoint call-site behavior, fetch execution, fallback ordering, key storage, provider persistence, billing/payment behavior, storage persistence, UI, release metadata, or broad adapter refactors in this slice.

GPT Best implementation rules:
- Re-fetch or re-check the live GPT Best docs before claiming current compatibility.
- Treat the Apifox docs host as provider evidence, not as an API base URL.
- Preserve provider identity separately from OpenAI-compatible protocol compatibility.
- Keep official OpenAI fallback behavior isolated: `OpenAI` with an empty Base URL may still use `https://api.openai.com/v1`.
- For GPT Best and other non-OpenAI compatible providers, do not let image/chat-image paths silently fall back to official OpenAI when Base URL is empty.
- Use `supported_endpoint_types` or equivalent remote model metadata for surface routing. Do not infer all images, chat, responses, or Gemini surfaces from the marketing phrase "OpenAI-compatible".
- Use focused source/contract tests before production changes and rerun the GPT Best provider gate in `validation.md`.

Prompt optimizer redaction rules:
- Write or update a focused contract before production changes and verify it fails for prompt-content leakage.
- Redact user prompt/content fields in cache keys, cache metadata, and diagnostics/log previews; preserve functional prompt optimization request behavior.
- Do not change provider selection, endpoint selection, auth/header behavior, billing, UI, storage ownership, or automatic route fallback semantics.
- Browser QA may be skipped after recording the reason because this is a non-UI service/logging slice.

Shared local user-route auth inference rules:
- Add or update focused contracts before production changes and verify the RED failure for divergent diagnostics/proxy auth behavior.
- Diagnostics and proxy execution must share the same auth/header/query-key inference helper.
- GPT Best Gemini routes must use Bearer header auth even when persisted route data says `authMethod: "query"`.
- Official Google Gemini and 12AI Gemini query-key behavior must remain unchanged.
- Normalize copied API keys by removing zero-width characters, line breaks, tabs, surrounding whitespace, embedded whitespace, and a leading `Bearer` prefix before query/header assembly.
- Preserve endpoint URL construction, fetch execution, pricing discovery payloads, provider routing, key storage, billing, UI, release metadata, and old import-path compatibility.
- Browser QA may be skipped after recording the reason because this is a non-UI server/auth helper slice.

Previous hotfix override (2026-05-07): the ecommerce framework card header and arrange regression is closed. Do not mix future server/auth commits with auth/logout, PromptBar ratio controls, settings chrome, provider routing changes outside the shared helper, key storage, payment/server, release metadata, or unrelated runtime extraction work.

This is a long-running execution. Plain `.git` may show stale historical state. Do not use plain `.git` for commit readiness. The development fact source is `git --git-dir=node_modules/.codex-git-full --work-tree=.`. The latest committed baseline before the current M132 server/auth slice is `dade1de4 fix: redact prompt optimizer cache diagnostics`; docs-only ledger sync commits may sit above it.

The active workstream is a single merged line. Thread `019dd551...` is the main refactor history and `019de168...` is continuation history; both belong to Stage One M6 ecommerce runtime extraction. The Clay UI audit and frosted-surface cleanup closed in `9e7ae2b5`; ecommerce source selection closed in `ccf965c3`; ecommerce partial redraw closed in `d12731ce`; connector renderer boundary hardening closed in `5f5b76e0`; connector review follow-up closed in `f06f1880`; the M6 closeout scan found no remaining ecommerce-owned business branch in `src/App.tsx`. The latest alternate-git baseline before this slice is `cab9046c fix: return to login after logout`.

Stage One Backfill M2 completed in `8a458cd4` by hardening `src/app/usePromptGroupLayout.ts` without re-creating the hook. Stage One Backfill M3 completed in `ab719c4a` by semantically checking the public `useGenerationRuntime` boundary. The generation billing follow-up completed in `083db7f8`. Stage One Backfill M5 completed in `569383aa` by semantically checking `usePptRuntime` and the PPT helper boundary. Stage Two M1-M55 are committed through `6902b79b`; the latest security/release/adapter/server cleanup line includes `4cdbf4cf`, `567f85aa`, `0c5cadde`, `333f2551`, `b6620ef2`, `0603547a`, `58be183d`, `0edb13f5`, `8f878b3a`, `96b94e5e`, `9764ba70`, `268ed882`, `f2de4377`, `d229c791`, `3dab3056`, `296c1203`, and `617491b3`. Unused-code cleanup has since landed in `b9baa445` (PromptBar/ImageCard), `b6767e85` (App), `fafecef9` (OpenAI-compatible adapter), `783fddeb` (LLMService), `92ee7a4f` (pure utility), `3108a29f` (ChatSidebar), `0efba271` (PromptNode), `0797bf95` (SystemLogs), `f453cd9a` (AchievementToast), `e661630e` (Onboarding residual), `05394f83` (imageCompression orphan), `eeb377d5` (dormant Pixi canvas), `9ce70e96` (dormant canvas residual), `58161f20` (legacy dashboard icons), `7d2c2584` (file-system stubs), `5dac56e8` (import-only types), `bdb082d7` (live canvas props), `e714380b` (workflow actions import), `57e8c05b` (common error-boundary parameter), `d4291729` (generation runtime import), `c29effe5` (CanvasContext type imports), `c4526e6b` (ProjectManager props), `d8845775` (ecommerce taskMerger parameter), `37540efc` (model display provider parameter), `324b42a6` (video-service cleanup), `b31edef5` (image priority/LOD cleanup), `56ffe696` (small LLM adapter cleanup), `8dfa152a` (chat-service cleanup), `a4032085` (generation-runtime contract test cleanup), `d075e6fd` (prompt optimizer duplicate-tab cleanup), `0cc6c77c` (KK API client unused DTO cleanup), `63386046` (user API payload secret-constant cleanup), `651b54c5` (cost service import cleanup), `318e6b1e` (secure model proxy unused-helper cleanup), `27f03e62` (user API profile import cleanup), `6c624909` (UserProfileModal billing alias cleanup), `95c5fc16` (user API cloud helper cleanup), `d5e6a809` (NewAPI management unused cleanup), `c465146b` (recharge submission unused cleanup), `51f6ff18` (storage adapter unused cleanup), `d49398c9` (storage preference unused cleanup), `efe1bdf9` (image storage cleanup), `9db2fe41` (Google adapter import cleanup), `574b3f41` (Gemini service cleanup), `cedb3718` (image generation hook cleanup), `c85ab3f9` (keyManager cleanup), `426a0a0c` (secure proxy route-gate wiring), `0001f6a2` (post-M106 ledger alignment), `689a2cc2` (post-hotfix ledger sync), `c0c96808` (M117 Gemini image sizing helper extraction), `2dbb402e` (M118 legacy payment-server security hardening), `8545513b` (M119 OpenAI-compatible Google extra-body helper extraction), `cff75d23` (M120 OpenAI-compatible chat payload helper extraction), `da4ffc79` (ecommerce canvas workbench split), `485a6bef` (PromptBar mobile action flattening), and `1ca080eb` (settings workbench chrome flattening).

The active plan is `plans.md`. The current status and next exact step are tracked in `status.md`. Validation commands and expected gates are tracked in `validation.md`.

Current slice override: M132 shared local user-route auth inference is the active slice. The selected production boundary is limited to `apps/api/src/lib/local-user-route-auth.ts`, the model-proxy compatibility re-export, user-route diagnostics helper imports/calls, and focused local user-route source/route tests. Do not change endpoint call-site behavior, fetch execution, polling, billing, fallback ordering, key storage, provider persistence, release metadata, payment/server behavior, PromptBar controls, settings UI, storage ownership, or unrelated runtime extraction work in this slice.

For Clay UI work, use `C:/Users/Administrator/Downloads/DESIGN-clay.md` as the visual base with these overrides: inputs, main cards, sub cards, and framework cards use controlled frosted material; dark mode uses neutral black-gray surfaces; Clay brand colors are emphasis only. That lane is not active unless the user reports a new visual issue.

Current convergence order:
1. Keep the ledger files aligned with the alternate-git HEAD and the merged single execution line.
2. Treat Stage One M6 ecommerce extraction and Stage One backfill boundaries as complete unless a new concrete regression proves otherwise.
3. For Stage Two, split or prune one responsibility at a time from the largest files. M123 followed the M122 security hardening by moving the task-token implementation behind a focused helper. M124 continued the OpenAI-compatible adapter seam by extracting pure AceData route/reference/size helpers. M125 extracted 12AI async route helpers and chat-image response selection. M126 closed the security follow-up by allowlisting image URL schemes and raster MIME types in the payload helper. M127 extracted repeated reference-image formatting and removed unreachable commented delegates. M128 removed the dead Gemini response cache module and its prompt-content logs. M129 redacted the raw `updateKey` diagnostic payload. M130 redacted prompt-bearing OpenAI-compatible diagnostics and snippets. M131 redacted prompt optimizer cache/logging surfaces. M132 shares local user-route auth inference between diagnostics and proxy. The current service milestone must stay path-limited to local user-route auth inference code and focused tests.
4. Write/update focused source contracts before each extraction when behavior or ownership changes.
5. Move domain helpers and side effects into focused modules while preserving compatibility exports.
6. Verify with the targeted gate for the touched slice, typecheck, full unit suite, build or architecture check as required, docs governance, encoding checks, and path-limited `git diff --check`.
7. Stage only files in the active slice through `git --git-dir=node_modules/.codex-git-full --work-tree=.`.

Browser inspection may be skipped for non-UI runtime/docs slices after recording the skip reason in `status.md`. Record which lane is active, which dirty files are excluded from the current commit, and the validation results.

Finalization audits must record high-confidence blockers and fix only narrow, verified issues. Do not delete broad historical code solely because a grep result looks stale; dead-code cleanup requires import/reference proof plus targeted validation.

## Milestone Loop

For every milestone:

1. Inspect the local implementation and tests relevant to that milestone.
2. Write or update a focused test/contract first when behavior or structure changes.
3. Implement only the scoped change.
4. Run every command listed for the milestone in `validation.md`.
5. Fix new failures before proceeding.
6. Update `status.md` with:
   - files changed,
   - line counts before/after when applicable,
   - validation commands and results,
   - risks and follow-up,
   - next milestone.
7. Stage only the files that belong to the milestone.
8. Create the milestone commit.
9. Continue immediately to the next milestone.

## Refactor Rules

- Do not rewrite a subsystem when a surgical extraction is sufficient.
- Keep runtime/PPT changes in the runtime lane and do not stage them into future UI commits.
- Do not pull runtime/PPT behavior changes into future UI work unless a compile failure proves it is necessary.
- For UI surfaces, use shared tokens instead of one-off inline glass, blue/indigo selected states, or heavy shadows.
- Controlled frosted surfaces require a translucent background, readable contrast, hairline border, low tokenized shadow, `backdrop-filter` where supported, and a solid fallback where unsupported.
- Keep `src/` as the active runtime until boundaries are stable.
- Do not migrate to `apps/web/` during Stage Two giant-file splits.
- Do not change `apps/api/` unless a compatibility check proves it is required.
- Every new custom hook must live in `src/app/` and expose explicit `UseXxxDeps` and `UseXxxResult` interfaces.
- Hooks may receive dependencies through parameters only. Do not make hooks reach into `App.tsx` top-level state implicitly.
- Optional arrays, maps, and objects must be defaulted inside the hook.
- `App.tsx` should retain orchestration, rendering, and prop/event wiring, not domain business logic.
- `CanvasContext.tsx` should retain provider orchestration and public context shape while state-model, mutation, selection/drag, or persistence helpers move behind focused modules.
- Delete only the code made redundant by the current extraction.
- Reduce `any`, `@ts-ignore` / `@ts-expect-error`, and bare `console.log` in touched files when doing so is local and safe. Do not attempt a whole-repo cleanup inside a runtime extraction.

## Git Rules

- Continue on the current branch unless the user explicitly asks for a new branch or worktree.
- Never use `git reset --hard`, `git checkout --`, or destructive cleanup against uncommitted work.
- Check `git --git-dir=node_modules/.codex-git-full --work-tree=. status --short` before staging. Plain `git status --short` is historical/stale observation only and must not decide commit readiness.
- Stage path-limited files only.
- Make one scoped commit per milestone.
- Do not commit local secret or temporary files.
- Do not attempt to repair plain `.git` ACLs or rewrite history during this convergence line.

## Validation Rules

- Use `npm.cmd` on Windows for npm scripts.
- Documentation/rule changes require `npm.cmd run governance:agent-docs`.
- Code changes require `npm.cmd run typecheck`.
- Dependency security changes require `npm.cmd run audit:dependencies`, which audits both the root lockfile and `payment-server`, plus a fresh install/lockfile consistency check for any touched package.
- Every completed milestone requires `npm.cmd run check:encoding`.
- Code milestones also require targeted tests, `npm.cmd run test:unit`, and `npm.cmd run build` unless `validation.md` documents a known blocker.
- Runtime slices require targeted contract tests, `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and a path-limited alternate-git `diff --check`.
- Architecture split slices require relevant targeted tests, `npm.cmd run architecture:check`, `npm.cmd run typecheck`, and `npm.cmd run test:unit`.
- UI or visual changes in the UI lane require a real browser inspection before commit. Start the app locally, open it through the Codex in-app Browser (`browser-use` with the `iab` backend), inspect the changed surface on desktop and mobile-sized viewports when applicable, and record the browser result in `status.md`.
- Non-UI runtime/docs slices may skip browser inspection only after the UI lane is closed, and the skip must be recorded in `status.md`; paused runtime/PPT commits use the runtime/PPT gate in `validation.md`.
- Do not claim a UI optimization is complete from source-contract tests, screenshots, build output, or smoke scripts alone. The browser check is mandatory for new UI work and can only be skipped for non-UI logic/docs changes with an explicit note.
- If a command fails, classify it as either historical or introduced by the current milestone. New failures must be fixed before commit.
- For shared v1.4.6 ledger updates, `status.md` must name the active lane(s), included commit paths, excluded dirty path groups, and browser inspection status.
- For a UI audit lane commit, `status.md` must record browser URL, theme, viewport/surface checked, `.theme-transitioning` result, SearchPalette/settings/API workbench checks, and stale chunk findings.
- The final release gate includes `npm.cmd run governance:check`, `npm.cmd run audit:dependencies`, `npm.cmd run spec:check`, `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build`, and `npm.cmd run check:encoding`. The former `governance:version` portable metadata mismatch was cleared by `567f85aa`; rerun the gate after any future packaging/publish metadata change.

## M116 Completion Rule

- M116 is committed in `52074495`. Do not reopen it for unrelated service/provider/security/release-metadata work.
- The ecommerce static-preview analysis fallback hotfix is committed in `5aaccf50`. Treat it as closed unless a new concrete upload regression appears.
- Any follow-up giant-file split, type-debt cleanup, or security gate work must start from a clean alternate-git worktree and use its own validation gate.

## Context Exhaustion Protocol

If context becomes low, update `status.md` first, then provide a resume prompt containing:

- current branch,
- current milestone,
- files changed in the current milestone,
- last validation command and result,
- uncommitted files,
- next exact edit or command.

## Historical Recovery Note

Earlier recovery-convergence work is complete and no longer the active milestone list. Preserve its safety posture: protect user work, avoid secret exposure, validate before claiming completion, and keep commits narrow.
