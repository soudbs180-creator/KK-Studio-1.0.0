# VPS PostgreSQL Data Access Structure

KK Studio data access is routed through typed API modules. Browser code must not import database clients or call database RPCs directly.

Canonical paths:

- Auth and 30-day browser sessions: `apps/api/src/modules/auth`
- User profile/API settings: `apps/api/src/modules/auth/application/auth-data-service.ts`
- Billing balance, debit, recharge, and refund: `apps/api/src/modules/billing`
- Admin model pricing and provider route keys: `apps/api/src/modules/model-catalog`
- Canvas persistence: `apps/api/src/modules/workspace-canvas`
- System and user model proxy calls: `apps/api/src/modules/model-proxy`
- Payment settlement: `apps/payment-sidecar` and `apps/api/src/modules/billing`

Frontend access rules:

- Use `kkWebApiClient` for user-facing API calls.
- Use KK API session cookies or access tokens issued by the VPS API.
- Do not add `supabase.rpc(...)`, `supabase.auth`, `supabase.functions.invoke(...)`, or `@supabase/supabase-js`.
- Do not expose service credentials or provider API keys to the browser.

Billing rules:

- Recharge credits through the payment/admin API only.
- Debit credits on the server before system model generation.
- Return `ledgerId` and `balanceAfter` for confirmed debits.
- If image/video/task generation fails after debit, refund the debit transaction on the server and return `refundApplied` and `refundBalanceAfter` when available.
- Model credit costs are configured in the admin model pricing UI and persisted in `admin_credit_models`.

Verification:

- `npm run architecture:check`
- `npm run spec:check`
- `npm run typecheck`
- `npm run check:encoding`
