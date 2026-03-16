## Project Root Guide

This repository is now organized into four simple groups so you can tell what matters at a glance.

### 1. Project source

These are the folders that make up the real app and usually matter when you are developing or deploying:

- `src/`: front-end source
- `public/`: static assets
- `api/`: serverless-style API handlers
- `server/`: local/server routes
- `payment-server/`: payment sidecar service
- `billing/`: billing logic
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

1. `src/`
2. `public/`
3. `api/`, `server/`, `payment-server/`
4. `package.json`

If you only want to clean up local clutter later, check:

1. `workspace/`
2. `dist/`
3. `release/`
4. `.npm-cache/`

### Maintenance helpers

- `npm run organize:local`: safely moves obvious root-level temp artifacts into `workspace/`
- It also moves nested `.bak` / backup files out of `src/`, `docs/`, and `scripts/` into `workspace/local-artifacts/source-backups/`
- `npm run package:portable`: rebuilds the portable client bundle
- `npm run publish:portable`: creates a hosted portable update archive + manifest under `release/publish/`
- `docs/setup/AUTO_UPDATE_AND_DEPLOY.md`: setup guide for client self-updates and cloud auto-deploy
