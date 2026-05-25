# Canonical Data Registry

This registry defines the single source of truth for cross-cutting KK Studio data so cache layers and compatibility adapters do not become competing writers.

## Versioning

| Data | Canonical source | Allowed projections | Forbidden behavior |
| --- | --- | --- | --- |
| App version | `config/release-manifest.json` | `package.json`, `payment-server/package.json`, `src/config/appInfo.ts`, release notes | Hand-editing runtime version strings without updating the manifest |

## Identity and Access

| Data | Canonical source | Allowed projections | Forbidden behavior |
| --- | --- | --- | --- |
| Supabase auth session | Supabase Auth runtime session | in-memory web auth state, `sessionStorage` compatibility token cache | Persistent browser storage as the primary auth source |
| KK API compatibility access token | Supabase auth session, with session-scoped compatibility fallback | `sessionStorage` cache in `src/services/api/authAccessToken.ts` | `localStorage` as the live token source |
| Admin session token | Server-issued admin session state | request headers only | Logging or persisting the raw admin token in browser storage |

## User API and Key Manager

| Data | Canonical source | Allowed projections | Forbidden behavior |
| --- | --- | --- | --- |
| User API entries | API contract via `packages/contracts` and `apps/api` profile routes | compatibility readers, in-memory UI state | Direct browser writes to Supabase business tables |
| Key manager cloud state | API contract via `apps/api` profile routes | transient in-memory state, migration adapters | Competing browser persistence layers acting as authoritative |
| Provider pricing cache | Server-side runtime tables and API contracts | UI read models | Client-side pricing snapshots treated as durable truth |

## Workspace and Workflow

| Data | Canonical source | Allowed projections | Forbidden behavior |
| --- | --- | --- | --- |
| Workspace/canvas layout | API contract and cloud-backed runtime repositories | local cache, OPFS snapshots for recovery | Local cache mutating cloud state outside the typed API path |
| Workflow documents | API contract and server-side repositories | read-only compatibility adapters | Dual-write through legacy and migrated routes |

## Billing and Payments

| Data | Canonical source | Allowed projections | Forbidden behavior |
| --- | --- | --- | --- |
| Credit balance and ledger | current Supabase runtime billing tables audited by `scripts/audit-supabase.mjs` | UI summaries, typed API DTOs | Frontend direct mutation or unsanctioned sidecar writes |
| Payment orders and callbacks | `apps/payment-sidecar` runtime repositories | typed status polling, compatibility QR/status routes | Main API and sidecar both acting as primary order writers |
| Payment settlement write-back | `apps/api` internal settlement contract | sidecar internal client | Callback handlers mutating billing tables directly |
