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

## Current runtime truth

The repo is still mid-migration, so this table is the source of truth for what is live today versus what is still transitional.

## Runtime truth table

| Path | Runtime role | Meaning today |
| --- | --- | --- |
| `src/` | `current-live-web` | Current live browser app entrypoint. Root `vite.config.ts` and `tsconfig.json` still build this tree. |
| `apps/web/` | `target-web` | Target browser shell after the web migration is complete. Do not describe it as the current runtime yet. |
| `apps/api/` | `canonical-api` | Canonical Node API and privileged server flows. |
| `apps/payment-sidecar/` | `canonical-payment` | Canonical payment service and settlement write-back runtime. |
| `server/` | `transition-bridge` | Transitional server mounts kept alive during API migration. |
| `api/` | `transition-bridge` | Root compatibility handlers and local-only edge-style entrypoints. |
| `payment-server/` | `transition-bridge` | Legacy payment bridge and webhook shell that still exists during payment migration. |

## Runtime topology truth table

Use this table when deciding which runtime path is canonical versus transitional:

| Path | Runtime status | Hosted/Web role | Notes |
| --- | --- | --- | --- |
| `apps/api/` | `canonical` | Main business API / BFF | Owns auth-adjacent business routes, profile persistence, billing, workspace sync, generation, and model-proxy entrypoints. |
| `apps/payment-sidecar/` | `canonical` | Main payment runtime | Owns checkout, callback handling, and settlement write-back. |
| `server/` | `bridge` | Transitional wrapper only | Keeps old local/server entrypoints alive by mounting migrated `apps/api` route modules. Do not add new primary logic here. |
| `payment-server/` | `bridge` | Transitional wrapper only | Forwards legacy payment-server flows into `apps/payment-sidecar`. Hosted deployments must not treat it as a second primary payment writer. |
| `api/auth-password-login.ts` | `local-only` | Disabled by default | Same-origin password proxy for local or explicit fallback scenarios only. Hosted browser auth should stay Supabase-first and must not rely on this path by default. |

### Hosted default

- Hosted/Web must default to `apps/api` + Supabase Edge Functions + `apps/payment-sidecar`.
- `server/`, `payment-server/`, and `api/auth-password-login.ts` are not canonical Hosted entrypoints.
- If a hosted environment re-enables one of these paths, treat it as an explicit migration override and document it in the release runbook before shipping.

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
