# Current State Inventory

This inventory records the current active runtime layout for KK Studio v1.5.8.

| Area | Current path | Status |
| --- | --- | --- |
| Web runtime | `apps/web/` | Active |
| Mobile workspace | `apps/mobile/` | Active |
| Backend runtime | `server/` | Active Express / VPS backend |
| Shared contracts | `packages/shared/` | Active platform-neutral contracts |
| HTTP client | `packages/api-client/` | Active typed client surface |
| UI package | `packages/ui/` | Active design/token layer |
| Database changes | `migrations/`, `scripts/postgres/` | Active schema and bootstrap sources |
| Historical docs | `docs/archive/` | Historical only |

Retired runtime paths must not re-enter the active tree. If historical behavior must be referenced, use archived documentation or an explicit adapter/service in the current runtime with a documented deletion condition.
