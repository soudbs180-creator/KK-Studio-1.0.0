Status: reference

# Canonical Data Registry

This registry defines the single source of truth for cross-cutting KK Studio data so cache layers and compatibility adapters do not become competing writers.

## Versioning

| Data | Canonical source | Allowed projections | Forbidden behavior |
| --- | --- | --- | --- |
| App version | `config/release-manifest.json` | `package.json`, `services/api/package.json`, `apps/web/src/config/appInfo.ts`, release notes | Hand-editing runtime version strings without updating the manifest |

## Identity and Access

| Data | Canonical source | Allowed projections | Forbidden behavior |
| --- | --- | --- | --- |
| KK API session | `services/api/` session routes | in-memory web auth state, short-lived compatibility token cache | Persistent browser storage as the primary auth source |
| Admin session token | Server-issued admin session state | request headers only | Logging or persisting the raw admin token in browser storage |

## User API and Key Manager

| Data | Canonical source | Allowed projections | Forbidden behavior |
| --- | --- | --- | --- |
| User API entries | API contract via `packages/api-client` and `services/api/` profile routes | compatibility readers, in-memory UI state | Direct browser writes to database tables |
| Key manager cloud state | API contract via `services/api/` profile routes | transient in-memory state, migration adapters | Competing browser persistence layers acting as authoritative |
| Provider pricing cache | Server-side runtime tables and API contracts | UI read models | Client-side pricing snapshots treated as durable truth |

## Workspace and Workflow

| Data | Canonical source | Allowed projections | Forbidden behavior |
| --- | --- | --- | --- |
| Workspace/canvas layout | API contract and backend repositories | local cache, OPFS snapshots for recovery | Local cache mutating cloud state outside the typed API path |
| Workflow documents | API contract and server-side repositories | read-only compatibility adapters | Dual-write through legacy and migrated routes |

## Billing and Payments

| Data | Canonical source | Allowed projections | Forbidden behavior |
| --- | --- | --- | --- |
| Credit balance and ledger | Current backend billing tables | UI summaries, typed API DTOs | Frontend direct mutation or unsanctioned writes |
| Payment orders and callbacks | `services/api/routes/webhook.js` and current payment routes | typed status polling, compatibility QR/status routes | Multiple runtimes acting as primary order writers |
| Payment settlement write-back | `services/api/` settlement contract | internal route helpers | Callback handlers mutating billing tables outside the server transaction |
