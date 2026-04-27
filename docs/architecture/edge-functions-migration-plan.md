# Edge Functions Migration Plan Retired

This plan is retired.

KK Studio no longer migrates runtime behavior into Supabase Edge Functions. The active hosted runtime is:

- Frontend -> KK API (`apps/api`)
- KK API -> VPS PostgreSQL (`DATABASE_URL`)
- Payment sidecar -> KK API or VPS PostgreSQL-backed settlement
- Model proxy -> KK API local system/user route proxy modules

Do not add new Supabase Edge Function deployment steps, `supabase.functions.invoke(...)` callers, or Supabase RPC fallbacks.

Current runtime locations:

- API bootstrap: `apps/api/src/server.ts`
- Runtime config: `apps/api/src/lib/server-runtime-config.ts`
- Auth sessions: `apps/api/src/modules/auth`
- Billing and refunds: `apps/api/src/modules/billing`
- Admin model pricing: `apps/api/src/modules/model-catalog`
- System/user model proxy: `apps/api/src/modules/model-proxy`
- VPS schema: `scripts/postgres/bootstrap-kk-vps.sql` and `apps/api/sql/bootstrap-self-hosted-postgres.sql`

Required checks:

- `npm run architecture:check`
- `npm run spec:check`
- `npm run typecheck`
- `npm run check:encoding`
