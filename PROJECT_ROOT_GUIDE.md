## Project Root Guide

This repository is in a deliberate migration state, so the quickest way to stay oriented is to separate the current live runtimes from the target layout.

### Runtime truth first

- The current live web runtime is root `src/`.
- The target web runtime is `apps/web/`.
- The canonical API runtime is `apps/api/`.
- The canonical payment runtime is `apps/payment-sidecar/`.
- `server/`, `api/`, and `payment-server/` remain transitional until their bridge responsibilities are fully removed.
- `billing/` remains a migration-era surface that is still referenced by selected integration tests and compatibility code.

### 1. Project source

These are the folders that usually matter when you are developing or deploying:

- `src/`: current live web runtime
- `public/`: static assets
- `apps/web/`: target web runtime under migration
- `apps/api/`: canonical Node API
- `apps/payment-sidecar/`: canonical payment runtime
- `api/`: transitional root compatibility handlers
- `server/`: transitional server mounts
- `payment-server/`: transitional payment bridge and webhook shell
- `billing/`: legacy billing code still referenced by integration tests and migration bridges
- `config/`: project config data
- `migrations/`: database migrations
- `supabase/`: Supabase-related project files
- `tests/`: tests
- `scripts/`: project scripts
- `docs/`: project docs, reports, screenshots

### 2. Dependency or generated folders

These are not your handwritten business code:

- `node_modules/`: installed dependencies
- `dist/`: front-end build output
- `release/`: portable packaged build output
- `.npm-cache/`: local npm cache
- `.vercel/`: local Vercel metadata/cache

### 3. Root config files

These stay in the root because tools expect them there:

- `package.json`, `package-lock.json`
- `vite.config.ts`
- `tsconfig.json`, `tsconfig.node.json`
- `tailwind.config.js`, `postcss.config.js`
- `netlify.toml`, `docker-compose.billing.yml`
- `.env`, `.env.example`, `.env.local`
- `.gitignore`, `.editorconfig`, `.npmrc`
- `README.md`, `start.bat`

### 4. Local workspace area

Anything that is not core code but still worth keeping has been grouped under:

- `workspace/diagnostics/`: logs, patches, typecheck output, scraped temp files
- `workspace/local-artifacts/`: Codex temp folders, recovery snapshots, QDM unpack files
- `workspace/vendor-archives/`: downloaded `.tgz` / `.tar` archives

### Good rule of thumb

If you want to understand the app, start with:

1. `README.md`
2. `docs/PROJECT_STRUCTURE.md`
3. `src/` for the current live web runtime
4. `apps/api/` and `apps/payment-sidecar/` for canonical server runtimes

If you only want to clean up local clutter later, check:

1. `workspace/`
2. `dist/`
3. `release/`
4. `.npm-cache/`

### Maintenance helpers

- `npm run organize:local`: safely moves obvious root-level temp artifacts into `workspace/`
- It now also collects root `tmp-*.err/out`, `.tmp-*` HTML/JS helper files, extracted text fragments, and `.tmp-playwright/`
- It also moves nested `.bak` / backup files out of `src/`, `docs/`, and `scripts/` into `workspace/local-artifacts/source-backups/`
- `npm run package:portable`: rebuilds the portable client bundle
- `npm run publish:portable`: creates a hosted portable update archive + manifest under `release/publish/`
- `docs/setup/AUTO_UPDATE_AND_DEPLOY.md`: setup guide for client self-updates and cloud auto-deploy
