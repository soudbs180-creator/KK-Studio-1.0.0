# Project Structure

This document defines ownership rules for the KK Studio repository during the migration to the final `apps/* + packages/*` layout.

## Target top-level layout

```text
apps/
  web/
  api/
  payment-sidecar/
packages/
  ui/
  contracts/
  shared/
  domain/
docs/
scripts/
workspace/
```

## Ownership summary

- `apps/web`: browser app shell, routes, modules, and typed API clients
- `apps/api`: main API and privileged business logic
- `apps/payment-sidecar`: payment providers, callbacks, order persistence, and settlement write-back
- `packages/ui`: reusable UI primitives only
- `packages/contracts`: DTOs, envelopes, and generated/manual API clients
- `packages/shared`: cross-runtime utilities such as env access, auth headers, and logging
- `packages/domain`: pure rules, policies, state machines, and repository interfaces

## Legacy status

The repository still contains frozen legacy roots:

- `src/`
- `server/`
- `api/`
- `billing/`
- `payment-server/`

These paths are transitional. Do not introduce new primary logic there.

## Web boundary

- Web code must call backend behavior through typed contracts.
- Web code must not directly access Supabase business tables or RPCs.
- Web code must not import API or payment implementation files.

## Service boundary

- `apps/api` and `apps/payment-sidecar` must not import web implementation files.
- Cross-module service imports must flow through module indexes, not deep implementation paths.
- Shared behavior used by both services belongs in `packages/shared` or `packages/domain`.

## Local artifact policy

Temporary scripts, screenshots, diagnostics, and scratch files do not belong at the repo root. Move them into `workspace/diagnostics`, `workspace/local-artifacts`, or `workspace/quarantine`.
