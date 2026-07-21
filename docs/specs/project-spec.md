Status: reference

# KK Studio Project Spec

## Current Architecture

KK Studio is a modular monolith with clear runtime boundaries:

中文基线：KK Studio 当前是模块化单体（modular monolith），并保留 MVC-style 边界：UI/View 留在 `apps/web/`，业务控制与特权执行收口到 `services/api/`，共享契约通过 typed client 暴露。

- `apps/web/`: React/Vite Web runtime and canvas UI.
- `apps/mobile/`: mobile workspace.
- `services/api/`: Express / VPS backend, including auth, model proxying, billing, admin APIs, persistence routes, and Stripe webhook settlement.
- `packages/shared/`: shared DTOs, enums, and pure contracts.
- `packages/api-client/`: typed client boundary used by Web and cross-platform consumers.
- `packages/ui/`: design tokens, base UI components, and UI bridge helpers.
- `infrastructure/database/migrations/` and `scripts/ops/postgres/`: database schema changes and bootstrap SQL.

## Boundary Rules

- Views call the backend through typed client/service wrappers; they must not import database clients or server implementation files.
- `services/api/` owns privileged behavior: database access, payment settlement, provider secrets, user API secret transport, and admin mutations.
- `packages/shared/` must stay platform-neutral and may not import React, DOM, or Node-only runtime code.
- `packages/api-client/` may define HTTP behavior but must not hard-code platform storage.
- Business DDL belongs only in migrations and PostgreSQL scripts.

## Runtime Flow

```text
apps/web
  -> packages/api-client / web service wrappers
  -> services/api/
  -> PostgreSQL / provider APIs / Stripe
```

## Verification

- `npm.cmd run spec:check`
- `npm.cmd run architecture:check`
- `npm.cmd run governance:check`
- `npm.cmd run typecheck`
- `npm.cmd run build`
