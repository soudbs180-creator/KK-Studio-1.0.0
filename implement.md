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

- Work on `codex/kk-studio-recovery-convergence`.
- Never use `git reset --hard`, `git checkout --`, or destructive cleanup against uncommitted work unless explicitly requested.
- Do not stage unrelated dirty files.
- Prefer `git status --short` and path-limited `git diff -- <path>` before staging.
- Local secret or tunnel files such as `.codex-tmp-*`, `.codex-ssh-*`, and `.tmp/` must not be committed.

## Subagent Policy

The user requested broad subagent use. Use subagents for independent domains and set each one to `gpt-5.5` with `xhigh` reasoning.

- Use explorer agents for read-only investigation by subsystem.
- Use worker agents only when the write scope is disjoint and explicit.
- Tell workers they are not alone in the codebase, must not revert others' edits, and must list changed paths.
- The main thread owns integration, validation, and final commits.

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
