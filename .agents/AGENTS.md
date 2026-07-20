Status: reference

# Workspace Agent Rules - KK Studio v1.6.0

Last updated: 2026-07-20
Version source of truth: `config/release-manifest.json`

This file is the hidden workspace copy of the agent rules. It must stay aligned
with the root `AGENTS.md`; it is not a second product architecture or a second
runtime. When the two files disagree, the root rules and the current source
code win. Historical notes belong in `docs/archive/` and are never current
implementation guidance.

## Current runtime boundaries

| Area | Owner | Boundary |
| --- | --- | --- |
| Web workspace and canvas | `apps/web/` | React/Vite UI, CanvasRuntimeState and the assistant surface. |
| Mobile app | `apps/mobile/` | Expo/React Native UI; no browser-only globals in shared code. |
| Shared contracts | `packages/shared/` | Platform-neutral DTOs, enums and domain types. |
| API transport | `packages/api-client/` | Typed KK API Client and injected credential/session adapters. |
| UI system | `packages/ui/` | Semantic tokens and presentational primitives only. |
| Backend and billing | `server/` | Authenticated API proxy, provider routing, billing and persistence. |
| Database schema | `migrations/` | The only location for PostgreSQL DDL. |

Do not recreate removed roots such as `src/`, `apps/admin/`, `apps/api/`,
`apps/payment-sidecar/`, `billing/` or `payment-server/` in the active runtime.
Those names may appear only in explicitly historical records.

## AI execution contract

All autonomous work follows:

```text
IntentGate -> Planner -> ToolRegistry -> PermissionPolicy -> Executor
  -> Verification -> Memory / Knowledge Update
```

The canonical shared state is `CanvasRuntimeState`; durable generation work is
owned by `DurableGenerationQueue`; run history is owned by `AgentRunStore`.
Use `generation.createBatchJob` and `assets.zipOriginals` for the corresponding
business operations. Never automate by clicking DOM controls, filling a
composer, or parsing assistant text as an execution protocol. `action://` links
are presentation-only and require an explicit user click.

The collaboration modes are mutually exclusive:

- `direct`: ordinary user interaction; chat does not execute Agent tools.
- `assist`: live page/selection context and suggestions; executable plans wait
  for user confirmation.
- `takeover`: safe read/navigation and low-risk reversible work may run under
  policy; generation, batch, cost, deletion, publishing, account and payment
  actions still require confirmation or are forbidden.

## Security and documentation rules

- Provider requests and Agent persistence go through typed KK API Client
  methods. Browser code must not send privileged provider requests directly.
- Never place real keys, tokens, passwords, database credentials, payment data,
  private files or machine-specific paths in source, Markdown, screenshots or
  logs. Use named environment variables or neutral placeholders.
- Do not document a default password or a fixed credit price. Billing amounts
  come from the authenticated server-side catalog and must be displayed as a
  runtime quote.
- User Knowledge, Skills, runs and canvas snapshots are owner-scoped. Do not
  infer ownership from client input or share a user's records across accounts.
- Keep light and dark UI guidance semantic and canvas-first. Avoid introducing
  a parallel assistant, task store, token set or visual system.

## Collaboration protocol

Before editing, inspect the current working tree and reread every file that is
in scope. Preserve unrelated uncommitted changes; do not reset or overwrite
another agent's work. Keep changes small, run the narrowest relevant checks,
and record the files, decisions, validation and remaining risk in the handoff
document. Do not create a commit from a subtask unless the coordinating agent
explicitly requests it.

Required checks for a completed phase:

```text
npm run governance:docs
npm run governance:check
npm run architecture:check
npm run typecheck
npm run build
```

If a check cannot run, report the exact command and blocker; never claim an
unrun validation passed.
