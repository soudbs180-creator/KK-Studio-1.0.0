# VPS PostgreSQL Data Access Structure

KK Studio data access is routed through the current `server/` backend and typed client packages. Browser code must not import database clients or call database RPCs directly.

Canonical paths:

- Auth and browser sessions: `server/routes/user.js`
- User profile/API settings: `server/routes/user.js` and `server/routes/user-api-payload-router.js`
- Billing balance, debit, recharge, and refund: `server/routes/credits.js` and related `server/routes`
- Admin model pricing and provider route keys: `server/routes/admin.js`
- Canvas persistence: current `server/` routes plus `packages/shared` contracts
- System and user model proxy calls: `server/routes/user-wuyin-strict-router.js` and related model routes
- Payment settlement: `server/routes/webhook.js`

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
