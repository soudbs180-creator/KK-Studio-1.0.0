# VPS PostgreSQL Runtime Schema

The canonical hosted database is a normal PostgreSQL database on the VPS. It is not a Supabase project and does not rely on Supabase Auth, Edge Functions, RLS helpers, or hosted RPC functions.

Canonical bootstrap files:

- `scripts/postgres/bootstrap-kk-vps.sql`
- `apps/api/sql/bootstrap-self-hosted-postgres.sql`

Required runtime tables:

- `profiles`: user profile, role, and account identity data.
- `password_identities`: password login credentials owned by the KK API.
- `external_identities`: Google, WeChat, or other external login bindings.
- `user_sessions`: browser sessions issued by the KK API. Browser login is intended to persist for 30 days.
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
- The KK API owns login, session validation, billing mutations, admin model pricing, and workspace persistence.
- The payment sidecar only handles payment-protocol concerns and settles through the VPS/PostgreSQL runtime.
- Model generation debit/refund happens server-side through the KK API. Failed image/task generation must refund the debit transaction.

Schema changes should be added to the VPS bootstrap SQL files above and covered by `tests/unit/vps-postgres-audit-contract.test.ts`.
