# Hosted Release Runbook

## Goal

Make the hosted Vercel frontend and the VPS API/payment runtime behave like the current VPS-backed runtime:

- User-owned API routes must use `userRoute` and must not consume credits.
- Admin-managed credit models must stay server-side only and must not expose provider `base_url` or `api_keys`.
- Hosted browser password login must stay on the direct hosted session/API path and must not depend on any local password proxy.
- Hosted payment runtimes must fail closed when durable storage or settlement auth is unavailable.
- Legacy `/api/pay*` payment routes stay local-only by default.

## Release Order

Always release in this order:

1. VPS PostgreSQL migrations
2. VPS API and payment sidecar
3. Vercel frontend
4. Smoke tests

Do not deploy the frontend first when the VPS API is still on an older runtime contract.

## Current Hosted Requirements

### Local development env authority

Keep the local runtime split explicit:

- Root `.env` / `.env.local` are for frontend public env such as `VITE_KK_API_BASE_URL`.
- `apps/api/.env.local` is the authoritative local API source for `DATABASE_URL`, `USER_API_ENCRYPTION_SECRET`, and `KK_PRIMARY_ADMIN_USER_ID`.
- Optional local API JSON body-size overrides also live in `apps/api/.env.local`:
  `KK_API_MAX_JSON_BODY_BYTES`, `KK_API_PROFILE_MAX_JSON_BODY_BYTES`, and `KK_API_KEY_MANAGER_MAX_JSON_BODY_BYTES`.
- `server/.env` is legacy-only and is ignored by the current local API startup and diagnostics.
- Hosted payment runtimes must fail closed when durable storage or settlement auth is unavailable.
- Legacy `/api/pay*` payment routes stay local-only by default unless an explicit compatibility override is enabled for a tightly controlled migration window.

Before shipping, verify both local and hosted assumptions explicitly:

```bash
npm run api:diagnose
npm run release:hosted:check
```

### Vercel frontend

Required:

- `VITE_KK_API_BASE_URL`

Recommended:

- `VITE_AUTH_REDIRECT_ORIGIN`
- `VITE_TURNSTILE_ENABLED`
- `VITE_TURNSTILE_SITE_KEY`

Optional:

- `VITE_PAYMENT_GATEWAY_URL`

Forbidden on hosted builds:

- `VITE_ENABLE_LEGACY_WEB_API_FALLBACK`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Why:

- Hosted builds should stay on the direct VPS API runtime by default.
- The browser should receive only the public API origin and public frontend settings, never server secrets.

### Hosted API owner-admin config

Required:

- `KK_PRIMARY_ADMIN_USER_ID`

Why:

- Hosted admin access defaults to one owner user ID.
- Delegated `profiles.role = 'admin'` users remain supported, but the owner admin must be configured explicitly.

### Hosted API social auth config

The current login screen starts Google and WeChat through `apps/api` routes:

- `GET /api/v1/auth/google/start`
- `GET /api/v1/auth/wechat/start`

Required:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_STATE_SIGNING_SECRET`
- `GOOGLE_ALLOWED_REDIRECT_ORIGINS`
- `WECHAT_OPEN_APP_ID`
- `WECHAT_OPEN_APP_SECRET`
- `WECHAT_OPEN_REDIRECT_URI`
- `WECHAT_STATE_SIGNING_SECRET`
- `WECHAT_ALLOWED_REDIRECT_ORIGINS`

Recommended:

- `WECHAT_DEFAULT_REDIRECT_URL`

Why:

- Missing Google values surface as `GOOGLE_AUTH_UNAVAILABLE`.
- Missing WeChat values surface as `WECHAT_AUTH_UNAVAILABLE`.
- `GOOGLE_ALLOWED_REDIRECT_ORIGINS` and `WECHAT_ALLOWED_REDIRECT_ORIGINS` must include every hosted frontend origin that can start login or account binding.
- Local examples should use the API callback routes.

### VPS API and payment config

Required on the VPS runtime:

- `DATABASE_URL`
- `USER_API_ENCRYPTION_SECRET`
- `PAYMENT_SIDECAR_INTERNAL_TOKEN`
- `PAYMENT_SIDECAR_SETTLEMENT_TOKEN`
- `PAYMENT_WEBHOOK_SETTLEMENT_TOKEN`
- `PAYMENT_SIDECAR_CALLBACK_TOKEN`

Recommended:

- `KK_INTERNAL_ROUTE_PROXY_SECRET`
- `SYSTEM_PROXY_TASK_SECRET`
- `USER_ROUTE_PROXY_TASK_SECRET`

### Runtime ownership map

Hosted release reviews should use this ownership map:

- `apps/api/`: canonical Hosted business API / BFF
- `apps/payment-sidecar/`: canonical Hosted payment runtime
- `server/`: bridge only, never a Hosted primary
- `payment-server/`: bridge only, never a Hosted primary

## Preflight Checklist

### 1. Local machine access

You need one of these:

- `vercel login` completed on the machine that will deploy the frontend
- or a valid `VERCEL_TOKEN`

You also need a working VPS deployment path:

- `KK_VPS_DEPLOY_COMMAND` set to the command that deploys migrations, `apps/api`, and `apps/payment-sidecar`
- or an equivalent manual VPS deployment run before deploying Vercel

### 2. Repo-level checks

Run:

```bash
npm run api:diagnose
npm run release:hosted:check
npm run verify:changes
npm run test:unit
npm run build
```

What must be true before release:

- Local `/healthz` reports `status: ok`
- `config.canonicalPersistenceReady` is `true`
- No hosted-required env shows as missing or placeholder in the local snapshot
- `VITE_KK_API_BASE_URL` points at the VPS API origin
- `VITE_ENABLE_LEGACY_WEB_API_FALLBACK` is not present in the hosted env plan
- Hosted payment runtimes cannot boot in memory-only settlement mode
- Hosted payment runtimes fail closed instead of booting with in-memory payment storage or missing settlement auth.
- Build passes
- The current repo contains the latest VPS API model-proxy, billing, payment, Google, and WeChat auth code

## VPS Release Steps

### 1. Apply PostgreSQL migrations

Run the project-approved migration command on the VPS database before deploying the API process.

### 2. Deploy API and payment sidecar

Run the configured deployment command:

```bash
KK_VPS_DEPLOY_COMMAND="<your deploy command>" npm run release:hosted -- --skip-vercel
```

The command must deploy:

- `apps/api`
- `apps/payment-sidecar`
- PostgreSQL migrations required by auth, billing, workspace sync, model routing, and payment settlement

### 3. Verify VPS health

Confirm:

- `/healthz` returns healthy persistence state
- login session restore works
- payment sidecar can reach the API settlement route
- model proxy can debit and refund credits

## Vercel Release Steps

### 1. Confirm project linkage

The repo should contain:

- `.vercel/project.json`

### 2. Confirm hosted env values

Before deploying, verify in the Vercel dashboard:

- `VITE_KK_API_BASE_URL`
- `VITE_AUTH_REDIRECT_ORIGIN`
- `VITE_TURNSTILE_ENABLED`
- `VITE_TURNSTILE_SITE_KEY`

And confirm that these keys are absent:

- `VITE_ENABLE_LEGACY_WEB_API_FALLBACK`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 3. Deploy

Preview:

```bash
npx vercel deploy -y
```

Production:

```bash
npx vercel deploy --prod -y
```

## Smoke Tests

### Credits and routing

1. Log in with a normal user.
2. Add a personal API route.
3. Trigger one generation through that personal route.
4. Confirm the request succeeds and the user credit balance does not decrease.
5. Trigger one generation through an admin-managed credit model.
6. Confirm the request succeeds and credits do decrease.
7. Force one failed image generation or failed image fetch path.
8. Confirm the previously debited credits are refunded.

### Public model catalog redaction

Check that the public active credit model catalog still redacts provider secrets.

Expected:

- `base_url` is `null`
- `api_keys` is `null`

### WeChat auth

1. Start WeChat login from the hosted frontend.
2. Confirm the QR flow opens correctly.
3. Complete callback.
4. Confirm the browser lands back on the hosted origin in `/auth/callback`.
5. Repeat once for account binding while logged in.

### Hosted runtime parity

Confirm these hosted paths work:

- password login
- guest login
- 30-day hosted session restore
- workspace layout sync
- user credit balance refresh
- recharge settlement
- generation debit/refund
- cloud cleanup

Confirm these hosted paths stay disabled unless you intentionally re-enable them:

- legacy `/api/pay*` payment routes
- manual payment checkout pages

## Known Failure Patterns

### User-owned API still deducts credits

Most likely causes:

- Hosted API on the VPS is still on an older version without `userRoute`.
- Frontend was deployed but the VPS API was not.
- Vercel still has the legacy Web API opt-in env enabled.

### Credit model generation does not refund failed image requests

Most likely causes:

- The VPS API model-proxy did not persist the failed task status.
- The provider returned a malformed image response that bypassed the refund path.
- The payment/generation ledger is missing the idempotency key for the failed operation.

### WeChat login returns setup or availability errors

Most likely causes:

- Missing WeChat secrets
- `WECHAT_ALLOWED_REDIRECT_ORIGINS` does not include the hosted origin
- `WECHAT_OPEN_REDIRECT_URI` does not point to the hosted API callback route

### Google login returns setup or availability errors

Most likely causes:

- Missing Google OAuth secrets
- `GOOGLE_ALLOWED_REDIRECT_ORIGINS` does not include the hosted origin
- `GOOGLE_OAUTH_REDIRECT_URI` does not point to the hosted API callback route

### Hosted login works locally but not on Vercel

Most likely causes:

- `VITE_AUTH_REDIRECT_ORIGIN` mismatch
- Turnstile site key missing in Vercel
- Vercel `VITE_KK_API_BASE_URL` points at the wrong VPS API origin
- A migration-only password proxy or legacy fallback path is masking a hosted session/API auth regression locally
