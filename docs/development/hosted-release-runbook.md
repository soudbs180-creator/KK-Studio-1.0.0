# Hosted Release Runbook

## Goal

Make the hosted Vercel frontend and the Supabase backend behave like the local Supabase-first runtime:

- User-owned API routes must use `userRoute` and must not consume credits.
- Admin-managed credit models must stay server-side only and must not expose provider `base_url` or `api_keys`.
- Hosted builds must not fall back to the legacy Web API unless that fallback is intentionally deployed and configured.
- Hosted browser password login must stay on the Supabase-first path and must not silently depend on `api/auth-password-login.ts`.
- Hosted payment runtimes must fail closed when durable storage or settlement auth is unavailable.
- Legacy `/api/pay*` payment routes stay local-only by default.

## Release Order

Always release in this order:

1. Supabase database migrations
2. Supabase Edge Functions
3. Vercel frontend
4. Smoke tests

Do not deploy the frontend first when the Edge Functions are still on an older runtime contract.

## Current Hosted Requirements

### Local development env authority

Keep the local runtime split explicit:

- Root `.env` / `.env.local` are for frontend public env such as `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and local-only `VITE_KK_API_BASE_URL`.
- `apps/api/.env.local` is the authoritative local API source for `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `USER_API_ENCRYPTION_SECRET`.
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

Local default body-size behavior:

- Standard routes stay at `1048576` bytes unless `KK_API_MAX_JSON_BODY_BYTES` overrides them.
- Profile persistence routes default to `4194304` bytes unless `KK_API_PROFILE_MAX_JSON_BODY_BYTES`
  or `KK_API_KEY_MANAGER_MAX_JSON_BODY_BYTES` overrides them.

### Vercel frontend

Required:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Recommended:

- `VITE_AUTH_REDIRECT_ORIGIN`
- `VITE_TURNSTILE_ENABLED`
- `VITE_TURNSTILE_SITE_KEY`

Optional:

- `VITE_PAYMENT_GATEWAY_URL`

Forbidden on hosted builds unless you intentionally run a compatible public KK API:

- `VITE_KK_API_BASE_URL`
- `VITE_ENABLE_LEGACY_WEB_API_FALLBACK`

Why:

- Hosted builds should stay on the Supabase-first runtime by default.
- A compatible public KK API now requires both `VITE_KK_API_BASE_URL` and `VITE_ENABLE_LEGACY_WEB_API_FALLBACK=true` to re-enable legacy fallback intentionally.
- `api/auth-password-login.ts` is a local-only escape hatch. If hosted auth ever depends on it, treat that as a migration regression and fix the Supabase-first path instead of normalizing the proxy.

### Runtime ownership map

Hosted release reviews should use this ownership map:

- `apps/api/`: canonical Hosted business API / BFF
- `apps/payment-sidecar/`: canonical Hosted payment runtime
- `server/`: bridge only, never a Hosted primary
- `payment-server/`: bridge only, never a Hosted primary
- `api/auth-password-login.ts`: local-only password proxy, disabled by default in Hosted

### Supabase Edge Function secrets

Functions already receive these defaults in hosted Supabase environments:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Reference:

- [Supabase Edge Functions Environment Variables](https://supabase.com/docs/guides/functions/secrets)

For `wechat-auth`, additionally set:

- `WECHAT_OPEN_APP_ID`
- `WECHAT_OPEN_APP_SECRET`
- `WECHAT_OPEN_REDIRECT_URI`
- `WECHAT_STATE_SIGNING_SECRET`
- `WECHAT_ALLOWED_REDIRECT_ORIGINS`

Recommended:

- `WECHAT_DEFAULT_REDIRECT_URL`

For `secure-model-proxy`, keep these server-side secrets available when used by the runtime contract:

- `USER_API_ENCRYPTION_SECRET`
- `KK_INTERNAL_ROUTE_PROXY_SECRET`
- `SYSTEM_PROXY_TASK_SECRET`

For `user-route-proxy`, keep these server-side secrets available:

- `USER_API_ENCRYPTION_SECRET`
- `SYSTEM_PROXY_TASK_SECRET`
- optional: `USER_ROUTE_PROXY_TASK_SECRET`

For payment settlement, keep these server-side secrets available:

- `PAYMENT_SIDECAR_SETTLEMENT_TOKEN`
- `PAYMENT_WEBHOOK_SETTLEMENT_TOKEN`
- `PAYMENT_SIDECAR_CALLBACK_TOKEN`

## Preflight Checklist

### 1. Local machine access

You need one of these:

- `vercel login` completed on the machine that will deploy the frontend
- or a valid `VERCEL_TOKEN`

You also need one of these:

- `supabase login` completed on the machine that will deploy functions
- or a valid `SUPABASE_ACCESS_TOKEN`

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
- `VITE_KK_API_BASE_URL` is not present in the hosted env plan
- `VITE_ENABLE_LEGACY_WEB_API_FALLBACK` is not present in the hosted env plan
- Hosted payment runtimes cannot boot in memory-only settlement mode
- Hosted payment runtimes fail closed instead of booting with in-memory payment storage or missing settlement auth.
- Build passes
- The current repo contains the latest `user-route-proxy`, `secure-model-proxy`, and `wechat-auth` code

## Supabase Release Steps

### 1. Link the project

Project ref:

- `ovdjhdofjysanamgkfng`

Example:

```bash
npx supabase link --project-ref ovdjhdofjysanamgkfng
```

### 2. Push migrations

```bash
npx supabase db push
```

### 3. Set production secrets

Supabase supports setting production secrets from a file or individually:

```bash
npx supabase secrets set --env-file supabase/.env.functions.local
```

or:

```bash
npx supabase secrets set WECHAT_OPEN_APP_ID=... WECHAT_OPEN_APP_SECRET=...
```

Notes:

- Secrets become available to functions immediately.
- You do not need to re-deploy just because a secret value changed.

Reference:

- [Supabase Edge Functions Environment Variables](https://supabase.com/docs/guides/functions/secrets)

### 4. Deploy Edge Functions

Deploy in this order:

```bash
npm run supabase:functions:deploy:user-route-proxy
npm run supabase:functions:deploy:secure-model-proxy
npm run supabase:functions:deploy:admin-credit-models
npm run supabase:functions:deploy:wechat-auth
```

Why:

- `user-route-proxy` is the hosted-safe path for BYOK/user-owned routes and must be live before frontend smoke tests.
- `secure-model-proxy` is the critical runtime for user-owned routes versus credit-model routing.
- `wechat-auth` must stay `--no-verify-jwt` because `start-login` and `/callback` are anonymous entrypoints.

## Vercel Release Steps

### 1. Confirm project linkage

The repo should contain:

- `.vercel/project.json`

### 2. Confirm hosted env values

Before deploying, verify in the Vercel dashboard:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AUTH_REDIRECT_ORIGIN`
- `VITE_TURNSTILE_ENABLED`
- `VITE_TURNSTILE_SITE_KEY`

And confirm that this key is absent:

- `VITE_KK_API_BASE_URL`
- `VITE_ENABLE_LEGACY_WEB_API_FALLBACK`

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

### Public model catalog redaction

Check that the public active credit model catalog still redacts provider secrets:

```sql
select * from public.get_active_credit_models() limit 1;
```

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

Confirm these hosted paths still work:

- guest login
- workspace layout sync
- cloud cleanup

Confirm these hosted paths stay disabled unless you intentionally re-enable them:

- legacy `/api/pay*` payment routes
- manual payment checkout pages

## Known Failure Patterns

### User-owned API still deducts credits

Most likely causes:

- Hosted `secure-model-proxy` is still on an older version without `userRoute`
- Frontend was deployed but the function was not
- Vercel still has the legacy Web API opt-in env enabled, forcing hosted traffic back onto the old fallback path

### WeChat login returns setup or availability errors

Most likely causes:

- Missing WeChat secrets
- `WECHAT_ALLOWED_REDIRECT_ORIGINS` does not include the hosted origin
- `WECHAT_OPEN_REDIRECT_URI` does not point to the Supabase Edge Function callback

### Hosted login works locally but not on Vercel

Most likely causes:

- `VITE_AUTH_REDIRECT_ORIGIN` mismatch
- Turnstile site key missing in Vercel
- Supabase auth URL configuration missing the deployed origin
- A migration-only password proxy or legacy fallback path is masking a Supabase-first auth regression locally

## Database Access Note

The current WeChat function uses Supabase clients built from environment secrets rather than a direct Postgres driver. If you later switch to direct Postgres access inside Edge Functions, follow the official connection guidance here:

- [Connect to Postgres from Supabase Edge Functions](https://supabase.com/docs/guides/functions/connect-to-postgres)
