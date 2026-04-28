# KK Studio Recovery Implementation Rules

Last updated: 2026-04-28

## Operating Mode

This is a long-running recovery execution. Do not stop after initialization, one commit, or one partial milestone. Continue until all milestones in `plans.md` are complete, or until a validation blocker cannot be resolved safely in the current session.

The current dirty worktree contains prior-session user work. Treat every existing modification as owned by the user unless this session explicitly changes it.

## Required Loop Per Milestone

For each milestone:

1. Read the relevant specification, code, and existing tests.
2. Write or update a failing source-contract/unit test first.
3. Implement only the scoped milestone change.
4. Run the milestone validation commands from `validation.md`.
5. Fix validation failures before continuing.
6. Update `status.md` with completed work, validation results, blockers, and next step.
7. Stage only files belonging to that milestone.
8. Create one scoped git commit.
9. Continue to the next milestone without waiting for manual confirmation.

## Git And Worktree Safety

- Stay on the current `main` branch. Do not create or switch branches while the active user instruction says branches are forbidden.
- The historical `codex/kk-studio-recovery-convergence` branch has been merged into `main`; references to it are archival, not an instruction to branch again.
- Never use `git reset --hard`, `git checkout --`, or destructive cleanup against uncommitted work unless explicitly requested.
- Do not stage unrelated dirty files.
- Prefer `git status --short` and path-limited `git diff -- <path>` before staging.
- Local secret or tunnel files such as `.codex-tmp-*`, `.codex-ssh-*`, and `.tmp/` must not be committed.

## Subagent Policy

Do not spawn subagents unless the active user request explicitly asks for delegated or parallel agent work. If delegation is requested, keep write scopes disjoint and let the main thread own integration, validation, and final commits.

Current read-only explorer domains:

- Auth/runtime/recharge.
- Settings/API capability architecture.
- Ecommerce framework/runtime.
- PPT deck workflow.
- Responsive mobile/tablet result flow.

## Validation Policy

- On Windows, prefer `npm.cmd` to avoid PowerShell execution policy issues.
- Documentation/rule changes require `npm.cmd run governance:agent-docs`.
- Code changes require `npm.cmd run typecheck`.
- Every completed stage requires `npm.cmd run check:encoding`.
- Full completion requires the final gate in `validation.md`.

## Secret Hygiene

Prior sessions may have exposed server, API, or tunnel credentials. Do not write any secret values into documentation, tests, or source. The safe recovery action is:

- record that credentials must be rotated,
- remove or ignore local temporary key files,
- keep sample env files placeholder-only,
- verify sensitive boundaries through existing governance checks.

## Remote System Changes

- Read-only VPS checks may inspect PostgreSQL configuration and runtime health when a usable shell is available.
- Do not append `pg_hba.conf` rules, reload PostgreSQL, or otherwise change remote access control without action-time confirmation.
- Any PostgreSQL client access repair must dry-run first and use a narrow confirmed CIDR, not a broad `0.0.0.0/0` rule.

## Context Exhaustion Protocol

If context becomes low, update `status.md` first. Then provide a resume prompt that includes:

- current branch,
- current milestone,
- last validation command and result,
- uncommitted files touched by this session,
- next exact command or file to edit.
