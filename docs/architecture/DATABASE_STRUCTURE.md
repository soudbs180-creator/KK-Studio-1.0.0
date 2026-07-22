Status: reference

# VPS PostgreSQL Data Access Structure

KK Studio data access is routed through the current `services/api/` backend and typed client packages. Browser code must not import database clients or call database RPCs directly.

Canonical paths:

- Auth and browser sessions: `services/api/routes/user/auth.js`
- User profile/API settings: `services/api/routes/user/profile.js` and `services/api/routes/user-api-payload-router.js`
- Wuyin catalog/refresh/pricing proxy: `services/api/routes/user/wuyin.js`
- Shared request owner/meta/envelope: `services/api/routes/user/shared/requestContext.js`
- Billing balance, debit, recharge, and refund: `services/api/routes/credits.js` and related `services/api/routes`
- Admin model pricing and provider route keys: `services/api/routes/admin.js`
- Canvas persistence: current `services/api/` routes plus `packages/shared` contracts
- User model proxy calls: `services/api/routes/user/profile.js`; Wuyin catalog HTTP ownership remains isolated in `services/api/routes/user/wuyin.js`
- Quote/Job/Worker: `services/api/lib/generation-v3/` and `services/api/lib/generation-v3/worker/`
- Payment settlement: `services/api/routes/webhook.js`

Frontend access rules:

- Use `packages/api-client` and current web service wrappers for user-facing API calls.
- Use KK API session cookies or access tokens issued by the VPS backend.
- Do not add browser-side database clients, hosted RPC calls, or service-role credentials.
- Do not expose provider API keys to the browser.

Billing rules:

- Recharge credits through the payment/admin API only.
- Debit credits on the server before system model generation.
- Return `ledgerId` and `balanceAfter` for confirmed debits.
- If image/video/task generation fails after debit, refund the debit transaction on the server and return `refundApplied` and `refundBalanceAfter` when available.
- Model credit costs are configured in the admin model pricing UI and persisted in current backend tables.

Verification:

- `npm.cmd run architecture:check`
- `npm.cmd run spec:check`
- `npm.cmd run typecheck`
- `npm.cmd run check:encoding`
