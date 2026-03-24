# infra/supabase

This directory is now the canonical home for KK Studio database migrations, seed data, and RLS-related assets.

Current structure:

```text
infra/supabase/
  migrations/
  functions/
  seed/
  rls/
```

Current migration status:

- New schema work should land in `infra/supabase/migrations/`.
- The payment sidecar persistence tables are introduced here first so the new architecture can move off the in-memory store without disturbing the legacy billing tables.
- The main API billing module now persists against the existing `user_credits + credit_transactions` runtime tables through server-side RPCs instead of the in-memory repository.
- `credit_transactions` now carries `idempotency_key`, `business_ref_type`, and `business_ref_id` so debit and payment-settlement writes can be deduplicated and traced back to the API contract.
- The database exposes `api_record_credit_debit_v1` and `api_record_payment_settlement_v1` for service-role-only writes from `apps/api`.
- `npm run supabase:audit` now validates the current runtime contract separately from future target-schema gaps, so migration-in-progress environments do not fail on advisory-only missing target tables.
- Legacy migrations that already exist in Supabase remain valid; this directory is the forward path for new changes.
