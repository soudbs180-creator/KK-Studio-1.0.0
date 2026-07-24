# Quality Governance & Full-Stack Audit Plan — KK Studio v1.6.0

## Architecture & Scope
- **Target Project**: KK Studio v1.6.0
- **Scope**: Full-stack quality governance, type connectivity, security audit, and verification across `packages/shared`, `services/api`, `apps/web`, and `apps/mobile`.

## Milestones

| # | Milestone | Scope | Deliverables & Verification Commands | Dependencies | Status |
|---|-----------|-------|--------------------------------------|--------------|--------|
| 1 | Pre-Flight Check & Workspace Status | Run initial pre-flight checks: git status, `npm run agents:status`, initial `typecheck`, `architecture:check`, `governance:check` | `agents:status`, baseline error log | None | DONE |
| 2 | Full-Stack Domain Contracts & Type Consistency Audit | Audit `packages/shared` for zero platform-specific imports (React/DOM/Node). Ensure `services/api`, `apps/web`, `apps/mobile` pass `npm run typecheck` with 0 errors. Fix any type errors or domain leaks. | `npm run typecheck` (0 errors), code inspection report | M1 | DONE |
| 3 | Governance Rules, Deprecated Directory Isolation & Secret Audit | Audit codebase for historical/deprecated directory imports (`src/`, `apps/admin/`, `apps/api/`, `apps/payment-sidecar/`, `billing/`, `payment-server/`). Fix UI token exception in `NewInfiniteCanvasConsole.tsx`, update `DOCUMENTATION_INDEX.md`, scan for hardcoded secrets / private paths. | `npm run architecture:check` (100% pass), `npm run governance:check` (100% pass), secret scan | M2 | IN_PROGRESS |
| 4 | API Gateway SSRF Protection, UI Token Integration & Handoff Sync | Audit `CLIProxyAPI` gateway for Loopback & SSRF protection logic. Verify `apps/web` and `apps/mobile` consume shared contracts & UI tokens correctly. Update `docs/development/session-handoff.md` and perform `npm run agents:commit`. | E2E test/audit report, `session-handoff.md`, `npm run agents:commit` | M3 | PLANNED |

## Interface & Contract Requirements
1. `packages/shared` MUST NOT import platform-specific packages (`react`, `react-native`, `express`, `window`, `fs`, `node:*`).
2. `services/api`, `apps/web`, and `apps/mobile` MUST consume `packages/shared` domain contracts cleanly.
3. `CLIProxyAPI` gateway MUST sanitize/validate URLs against SSRF and loopback bypasses.
4. `session-handoff.md` MUST record all changes, decisions, and verification results before `npm run agents:commit`.
