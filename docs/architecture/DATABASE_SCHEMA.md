Status: reference

# VPS PostgreSQL Runtime Schema

The canonical hosted database is a normal PostgreSQL database on the VPS. Schema changes belong in `migrations/` and `scripts/postgres/`; business code must not execute DDL.

Canonical bootstrap files:

- `scripts/postgres/bootstrap-kk-vps.sql`
- `scripts/postgres/runtime-migration.env.example`

Required runtime tables:

- `profiles`: user profile, role, and account identity data.
- `password_identities`: password login credentials owned by the KK backend.
- `external_identities`: Google, WeChat, or other external login bindings.
- `user_sessions`: browser sessions issued by the KK backend.
- `auth_data`: per-user API and settings payloads.
- `workspace_layouts`: canvas/workspace persistence.
- `admin_credit_models`: administrator-managed model routes, provider keys, and credit pricing.
- `credit_exchange_rates`: recharge exchange-rate configuration.
- `user_credits`: canonical user credit balance.
- `credit_transactions`: debit, recharge, refund, and audit ledger.
- `payment_orders`: payment order state.
- `payment_callbacks`: payment callback audit and idempotency state.

Runtime ownership:

- The browser never writes these tables directly.
- The `server/` backend owns login, session validation, billing mutations, admin model pricing, workspace persistence, and payment settlement.
- Model generation debit/refund happens server-side. Failed image/task generation must refund the debit transaction.

Schema changes should be covered by the relevant unit, integration, and governance checks.
