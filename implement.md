# KK-Studio v1.4.2 Implementation Rules

Last updated: 2026-05-02

## Operating Mode

This is a long-running execution. Plain `.git` still reports baseline commit `4c448660 Refactor Clay UI and PPT runtime boundaries` and may show stale dirty state. Do not use plain `.git` for commit readiness. The development fact source is `git --git-dir=node_modules/.codex-git-full --work-tree=.`; the latest committed baseline before the prompt-group slice is `f06f1880 test: strengthen connector renderer boundary contract`.

The active workstream is a single merged line. Thread `019dd551...` is the main refactor history and `019de168...` is continuation history; both belong to Stage One M6 ecommerce runtime extraction. The Clay UI audit and frosted-surface cleanup closed in `9e7ae2b5`; ecommerce source selection closed in `ccf965c3`; ecommerce partial redraw closed in `d12731ce`; connector renderer boundary hardening closed in `5f5b76e0`; connector review follow-up closed in `f06f1880`; the M6 closeout scan found no remaining ecommerce-owned business branch in `src/App.tsx`.

The prompt-group commit completes Stage One Backfill M2 by hardening `src/app/usePromptGroupLayout.ts` without re-creating the hook. The next active slice is Stage One Backfill M3 `useGenerationRuntime` quality check.

The active plan is `plans.md`. The current status and next exact step are tracked in `status.md`. Validation commands and expected gates are tracked in `validation.md`.

For Clay UI work, use `C:/Users/Administrator/Downloads/DESIGN-clay.md` as the visual base with these overrides: inputs, main cards, sub cards, and framework cards use controlled frosted material; dark mode uses neutral black-gray surfaces; Clay brand colors are emphasis only. That lane is not active unless the user reports a new visual issue.

Current runtime order:
1. Keep the ledger files aligned with the alternate-git HEAD and the merged single execution line.
2. Treat Stage One M6 ecommerce extraction as complete unless a new concrete regression proves otherwise.
3. Write/update focused source contracts before each extraction when behavior or ownership changes.
4. Move domain helpers and side effects into `src/app/` hooks with explicit deps/result interfaces.
5. Verify with the targeted gate for the touched slice, typecheck, full unit suite, build, docs governance, encoding checks, and path-limited `git diff --check`.
6. Stage only files in the active slice through `git --git-dir=node_modules/.codex-git-full --work-tree=.`.

Browser inspection may be skipped for non-UI runtime/docs slices after recording the skip reason in `status.md`. Record which lane is active, which dirty files are excluded from the current commit, and the validation results.

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
- Do not migrate to `apps/web/` during Stage One.
- Do not change `apps/api/` unless a compatibility check proves it is required.
- Every new custom hook must live in `src/app/` and expose explicit `UseXxxDeps` and `UseXxxResult` interfaces.
- Hooks may receive dependencies through parameters only. Do not make hooks reach into `App.tsx` top-level state implicitly.
- Optional arrays, maps, and objects must be defaulted inside the hook.
- `App.tsx` should retain orchestration, rendering, and prop/event wiring, not domain business logic.
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
- Every completed milestone requires `npm.cmd run check:encoding`.
- Code milestones also require targeted tests, `npm.cmd run test:unit`, and `npm.cmd run build` unless `validation.md` documents a known blocker.
- Runtime slices require targeted contract tests, `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and a path-limited alternate-git `diff --check`.
- Architecture split slices require relevant targeted tests, `npm.cmd run architecture:check`, `npm.cmd run typecheck`, and `npm.cmd run test:unit`.
- UI or visual changes in the UI lane require a real browser inspection before commit. Start the app locally, open it through the Codex in-app Browser (`browser-use` with the `iab` backend), inspect the changed surface on desktop and mobile-sized viewports when applicable, and record the browser result in `status.md`.
- Non-UI runtime/docs slices may skip browser inspection only after the UI lane is closed, and the skip must be recorded in `status.md`; paused runtime/PPT commits use the runtime/PPT gate in `validation.md`.
- Do not claim a UI optimization is complete from source-contract tests, screenshots, build output, or smoke scripts alone. The browser check is mandatory for new UI work and can only be skipped for non-UI logic/docs changes with an explicit note.
- If a command fails, classify it as either historical or introduced by the current milestone. New failures must be fixed before commit.
- For shared v1.4.2 ledger updates, `status.md` must name the active lane(s), included commit paths, excluded dirty path groups, and browser inspection status.
- For a UI audit lane commit, `status.md` must record browser URL, theme, viewport/surface checked, `.theme-transitioning` result, SearchPalette/settings/API workbench checks, and stale chunk findings.
- The final release gate includes `npm.cmd run governance:check`, `npm.cmd run spec:check`, `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build`, and `npm.cmd run check:encoding`. Known current blocker: `governance:version` fails until portable packaging/publish metadata is regenerated so `release/publish/stable/manifest.json` and `release/KK-Studio-Portable/app/dist/app-version.json` share the same `buildTime`.

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
