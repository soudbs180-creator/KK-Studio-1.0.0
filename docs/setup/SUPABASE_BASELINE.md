# Supabase Baseline

This repository now treats the current remote Supabase project as the source of truth:

- Project ref: `ovdjhdofjysanamgkfng`
- Public URL: `https://ovdjhdofjysanamgkfng.supabase.co`
- Required Edge Function: `secure-model-proxy`

## Canonical runtime objects

- `profiles`
  Stores user identity data and `user_apis`.
- `user_credits`
  Stores the current balance and balance-related aggregates.
- `credit_transactions`
  Canonical ledger for recharge, consumption, refund, and rollback events.
- `admin_credit_models`
  Canonical system-model routing table.
- `temp_users`
  Canonical temporary user identity table.
- `available_models_for_users`
  Public-safe model catalog view.

## Legacy objects

- `usage_records`
  Legacy consumption log. Historical rows are migrated into `credit_transactions`, and new writes should stop.
- `profiles.credits`
  Deprecated balance field. `user_credits.balance` is the source of truth.
- `admin_auth`
  Legacy password material table used only by legacy RPCs. Admin identity should come from `profiles.role`.
- 2025 bootstrap migrations
  Kept for history only. Do not replay them as the initialization source for the current project.

## Audit expectations

`npm run supabase:audit` should confirm:

- local config points to `ovdjhdofjysanamgkfng`
- canonical tables and view exist
- required RPCs exist
- `secure-model-proxy` is deployed
- `payment-server` points to the same Supabase project
