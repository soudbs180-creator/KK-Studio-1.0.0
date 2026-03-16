# Auto Update And Deploy

This guide keeps the repository tidy while enabling automatic updates for both the hosted app and the portable client.

## Safe file organization

Use the local organizer when root-level debug files start to pile up:

```bash
npm run organize:local
```

The script only moves obvious local artifacts into `workspace/`:

- `.codex-temp*` -> `workspace/local-artifacts/codex-temp/`
- `.codex-backups*` -> `workspace/local-artifacts/codex-backups/`
- root diagnostic patches -> `workspace/diagnostics/patches/`
- root screenshots -> `workspace/diagnostics/screenshots/`
- root typecheck dumps -> `workspace/diagnostics/typecheck/`
- nested backup files under `src/`, `docs/`, and `scripts/` -> `workspace/local-artifacts/source-backups/`

This keeps the project root focused on source, config, and deployment files.

## Hosted app auto-update

Production builds now emit `dist/app-version.json`.

The client polls that manifest in production and prompts the user to refresh when a new deployment is detected.

Default behavior:

- enabled automatically on non-local `http` or `https` hosts
- disabled on `localhost` and `127.0.0.1`
- can be forced off with `VITE_ENABLE_UPDATE_CHECK=false`

## Portable client self-update

### 1. Build the portable bundle

```bash
npm run package:portable
```

### 2. Publish an update archive + manifest

```bash
npm run publish:portable -- --base-url https://your-static-host.example/kk-studio/portable/stable
```

This creates:

- `release/publish/stable/KK-Studio-Portable-<version>.zip`
- `release/publish/stable/manifest.json`

Host both files on any static file service.

### 3. Enable startup self-update

Inside the portable bundle:

1. Copy `support/update-config.json.example` to `support/update-config.json`
2. Set `manifestUrl` to the hosted `manifest.json`

Example:

```json
{
  "enabled": true,
  "manifestUrl": "https://your-static-host.example/kk-studio/portable/stable/manifest.json"
}
```

On startup, the portable launcher will:

- read the local `app/dist/app-version.json`
- fetch the remote manifest
- download the new archive when the version is newer
- verify SHA-256 when provided
- update the bundle before the local services start
- preserve `app/payment-server/.env` and `support/update-config.json`

## Cloud auto-deploy

The repository includes an optional GitHub Actions workflow at `.github/workflows/cloud-auto-deploy.yml`.

It will:

- build the project on pushes to `main` or `master`
- deploy to Vercel if `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` are configured
- deploy to Netlify if `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` are configured

You can enable either provider or both by setting the matching repository secrets.
