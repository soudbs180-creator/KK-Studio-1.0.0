Status: reference

# KK Admin VPS Deployment

This document is a tombstone for the retired standalone `apps/admin` deployment.

Current facts:

- `apps/admin/` is not an active runtime.
- `npm run admin:*` intentionally fails to prevent the old app from re-entering the main chain.
- Admin-related privileged behavior belongs behind the current `server/` backend and the active `apps/web/` experience.

Do not build or deploy `apps/admin/dist`. Use the current VPS deploy flow in `scripts/vps/deploy-kk-vps.sh` for `apps/web/` and `server/`.
