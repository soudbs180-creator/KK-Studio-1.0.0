# KK Studio v1.4.1

KK Studio is a multimodal canvas workspace for image, video, audio, and presentation workflows. It combines prompt authoring, model routing, user API management, workspace sync, and operational tooling in a single app.

## Highlights

- Visual canvas for prompts, assets, and generated results
- Multiple model routes, including official endpoints and third-party providers
- Local-first workflows with Supabase auth plus API-mediated cloud storage and sync
- Built-in settings surfaces for billing, diagnostics, logging, and provider management

## Tech Stack

- React 19
- TypeScript 5.8
- Vite 6
- Node.js 24.x
- Supabase

## Current runtime truth

- `src/` remains the live web runtime.
- `apps/web/` is the target web runtime under migration.
- `apps/api/` is the canonical API runtime.
- `apps/payment-sidecar/` is the canonical payment runtime.
- `server/`, `api/`, and `payment-server/` remain transitional bridges.

## Local Development

1. Copy `.env.example` to `.env` if you need frontend-level overrides.
2. Copy `apps/api/.env.local.example` to `apps/api/.env.local`.
3. Fill in a real `SUPABASE_SERVICE_ROLE_KEY` in `apps/api/.env.local`.
4. Install dependencies with `npm install`.
5. Start the local stack with `npm run dev:start`.

The local API startup is now strict: it only reads root `.env` / `.env.local` and `apps/api/.env` / `apps/api/.env.local`, and it intentionally ignores legacy `server/.env` files.

For local API JSON body limits, the default startup behavior is:

- `KK_API_MAX_JSON_BODY_BYTES=1048576` for standard routes.
- `KK_API_PROFILE_MAX_JSON_BODY_BYTES=4194304` for `/api/v1/profile/user-apis`, `/api/v1/profile/user-apis/payload`, and `/api/v1/profile/key-manager-state`.

If you need to inspect the currently effective values, run `npm run api:diagnose`.

## Common Commands

```bash
npm run dev:start
npm run dev:status
npm run dev:stop
npm run typecheck
npm run test:unit
npm run build
npm run check:encoding
```

## Project Layout

- `src/`: current live web frontend
- `apps/web/`: target frontend runtime under migration
- `apps/api/`: canonical Node API and authenticated server flows
- `apps/payment-sidecar/`: canonical payment runtime
- `payment-server/`: transitional payment bridge and webhook shell
- `server/`, `api/`: transitional compatibility layers
- `supabase/`: migrations and edge-function assets
- `scripts/`: development, verification, and release scripts
- `tests/`: unit, contract, and e2e coverage
- `docs/`: runbooks, reports, and implementation notes

## Notes

- Runtime artifacts under `.kk-local/` are local state, not source-of-truth project files.
- If local development behaves inconsistently, check `npm run dev:status` and the logs under `.kk-local/logs/`.
- For a quick repo orientation, see [PROJECT_ROOT_GUIDE.md](PROJECT_ROOT_GUIDE.md).
