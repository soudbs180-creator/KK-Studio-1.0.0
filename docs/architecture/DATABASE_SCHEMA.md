Status: reference

# VPS PostgreSQL Runtime Schema

The canonical hosted database is a normal PostgreSQL database on the VPS. Schema changes belong in `infrastructure/database/migrations/` and `scripts/ops/postgres/`; business code must not execute DDL.

Canonical bootstrap files:

- `scripts/ops/postgres/bootstrap-kk-vps.sql`
- `scripts/ops/postgres/runtime-migration.env.example`

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
- `generation_quotes`, `generation_jobs`, `generation_job_items`, `ledger_entries`: v3 Quote、Job、Item 与计费账本，由 migration 017 建立。
- `provider_connections`, `capability_bindings`, `asset_lineage_relations`: Provider Connection、Capability Graph 绑定和资产 lineage，由 migration 018 建立。
- `generation_image_worker_leases`: image Durable Worker 的 Item 级租约、heartbeat、重试和取消投影，由 migration 019 建立；flag 回滚不得删除该表或其中状态。

Runtime ownership:

- The browser never writes these tables directly.
- The `services/api/` backend owns login, session validation, billing mutations, admin model pricing, workspace persistence, and payment settlement.
- `services/api/lib/generation-v3/` owns Quote、Job、ledger 与冻结 Provider route；`services/api/lib/generation-v3/worker/` owns image Worker execution state.
- Model generation debit/refund happens server-side. Failed image/task generation must refund the debit transaction.

Schema changes should be covered by the relevant unit, integration, and governance checks.
