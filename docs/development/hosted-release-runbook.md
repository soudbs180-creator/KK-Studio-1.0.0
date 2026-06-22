# Hosted Release Runbook

## Goal

Release the hosted KK Studio frontend and the current VPS backend from one runtime line:

- Frontend runtime: `apps/web/`
- Backend runtime: `server/` Express / VPS
- Version source: `config/release-manifest.json`
- Database schema changes: `migrations/` and `scripts/postgres/`

Hosted builds must not restore retired serverless or sidecar runtimes.

## Release Order

Always release in this order:

1. Apply PostgreSQL migrations.
2. Deploy the `server/` backend to the VPS.
3. Deploy the hosted frontend.
4. Run smoke tests against `/healthz`, `/api/`, auth, model proxy, and Stripe webhook configuration.

Do not deploy the frontend first when the VPS backend is still on an older runtime contract.

## Environment Authority

Keep the runtime split explicit:

- Root `.env` / `.env.local` are for frontend public env such as `VITE_KK_API_BASE_URL`, `VITE_AUTH_REDIRECT_ORIGIN`, and `VITE_TURNSTILE_SITE_KEY`.
- `server/.env.local` is the local backend env source for `DATABASE_URL`, `USER_API_ENCRYPTION_SECRET`, provider keys, and Stripe secrets.
- `scripts/vps/kk-api.env.example` is the VPS backend env template.
- `scripts/postgres/runtime-migration.env.example` is the migration env template.

Optional local API JSON body-size overrides also live in `server/.env.local`:

- `KK_API_MAX_JSON_BODY_BYTES`
- `KK_API_PROFILE_MAX_JSON_BODY_BYTES`
- `KK_API_KEY_MANAGER_MAX_JSON_BODY_BYTES`

Before shipping, verify assumptions explicitly:

```bash
npm.cmd run api:diagnose
npm.cmd run release:hosted:check
```

For scripted or CI releases, provide Vercel state through environment variables
instead of relying on a local interactive link:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

When those values are present, `npm.cmd run release:hosted:check` treats the
project metadata as linked and the hosted release script passes the token to the
Vercel CLI through an environment-variable reference. When they are absent, the
remaining manual steps are `vercel login` and `vercel link`.

If the release was deployed through the Vercel plugin or the Git integration and
the deployment has already been verified as `READY`, record that local proof in
`.kk-local/hosted-release-verification.json` or set
`KK_RELEASE_VERCEL_REMOTE_VERIFIED=true` for the current shell. The preflight
still reports missing local Vercel CLI auth as a warning, but it does not block
when the proof matches the current Git `HEAD`, Vercel project metadata, and a
READY deployment.

## Hosted Frontend

Required:

- `VITE_KK_API_BASE_URL`

Recommended:

- `VITE_AUTH_REDIRECT_ORIGIN`
- `VITE_TURNSTILE_ENABLED`
- `VITE_TURNSTILE_SITE_KEY`

Forbidden on hosted builds:

- `VITE_ENABLE_LEGACY_WEB_API_FALLBACK`
- backend-only keys or secrets

## Backend Secrets

The VPS backend must provide:

- `DATABASE_URL`
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `PASSWORD_SALT`
- `JWT_SECRET`
- `KK_API_SESSION_SIGNING_SECRET`
- `USER_API_ENCRYPTION_SECRET`
- `PUBLIC_APP_URL` or `KK_PUBLIC_APP_URL` or `WEB_PUBLIC_URL`
- `PASSWORD_RESET_TOKEN_SECRET`
- `PASSWORD_RESET_EMAIL_FROM`
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Optional provider/runtime secrets should stay in the VPS runtime env, never in frontend env files.

## Password Reset Production Readiness

Password reset is part of the hosted auth release surface. Before enabling it:

- Apply `migrations/013_password_reset_tokens.sql` to the VPS PostgreSQL database.
- Set one public app origin in the VPS backend env: `PUBLIC_APP_URL`, `KK_PUBLIC_APP_URL`, or `WEB_PUBLIC_URL`.
- Set `PASSWORD_RESET_TOKEN_SECRET` to a stable long random secret. Do not rotate it while active reset links may still exist.
- Set `PASSWORD_RESET_EMAIL_FROM` and `RESEND_API_KEY` in the VPS backend env so reset links are actually delivered.
- Keep all password-reset mail secrets out of root frontend env files and Vercel public env.

## Preflight Checklist

Run:

```bash
npm.cmd run governance:current
npm.cmd run governance:check
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run build
npm.cmd run verify:changes
```

What must be true before release:

- `server/` owns `/healthz`, `/api/`, and `/webhook`.
- Root frontend env contains no server-only secrets.
- Hosted frontend points at the deployed VPS backend.
- Stripe webhook secrets are present in the VPS runtime env.
- No retired runtime path exists in the active source tree.
