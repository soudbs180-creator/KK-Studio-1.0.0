#!/usr/bin/env bash
set -euo pipefail

APP_USER="${KK_APP_USER:-kkstudio}"
APP_GROUP="${KK_APP_GROUP:-$APP_USER}"
APP_ROOT="${KK_APP_ROOT:-/opt/kk-studio}"
CURRENT_DIR="${KK_CURRENT_DIR:-$APP_ROOT/current}"
ADMIN_SITE_ROOT="${KK_ADMIN_SITE_ROOT:-/var/www/kk-admin}"
APPLY_BOOTSTRAP_SQL="${KK_APPLY_BOOTSTRAP_SQL:-false}"
POSTGRES_DB="${KK_PG_DB:-kkstudio}"
POSTGRES_SUPERUSER="${KK_PG_SUPERUSER:-postgres}"
BOOTSTRAP_SQL_PATH="${KK_BOOTSTRAP_SQL:-scripts/postgres/bootstrap-kk-vps.sql}"
SYSTEMD_SERVICES=("kk-api" "kk-payment-sidecar")

require_repo_root() {
  if [[ ! -f package.json || ! -d apps/api || ! -d apps/admin ]]; then
    echo "[deploy-kk-vps] Run this script from the repository root." >&2
    exit 1
  fi
}

sync_repo_to_runtime() {
  install -d -m 0755 -o "${APP_USER}" -g "${APP_GROUP}" "${CURRENT_DIR}"
  rsync -a --delete \
    --exclude ".git" \
    --exclude ".worktrees" \
    --exclude "node_modules" \
    --exclude "dist" \
    ./ "${CURRENT_DIR}/"
  chown -R "${APP_USER}:${APP_GROUP}" "${CURRENT_DIR}"
}

install_dependencies() {
  sudo -u "${APP_USER}" bash -lc "cd '${CURRENT_DIR}' && npm ci"
}

build_admin_site() {
  sudo -u "${APP_USER}" bash -lc "cd '${CURRENT_DIR}' && npm run admin:build"
  sudo -u "${APP_USER}" bash -lc "cd '${CURRENT_DIR}' && npm run build"
  install -d -m 0755 "${ADMIN_SITE_ROOT}"
  rsync -a --delete "${CURRENT_DIR}/apps/admin/dist/" "${ADMIN_SITE_ROOT}/"
}

apply_bootstrap_sql_if_requested() {
  if [[ "${APPLY_BOOTSTRAP_SQL}" != "true" ]]; then
    return
  fi

  if [[ ! -f "${CURRENT_DIR}/${BOOTSTRAP_SQL_PATH}" ]]; then
    echo "[deploy-kk-vps] Bootstrap SQL not found at ${CURRENT_DIR}/${BOOTSTRAP_SQL_PATH}" >&2
    exit 1
  fi

  su - "${POSTGRES_SUPERUSER}" -c "psql -v ON_ERROR_STOP=1 -d '${POSTGRES_DB}' -f '${CURRENT_DIR}/${BOOTSTRAP_SQL_PATH}'"
}

restart_services() {
  systemctl daemon-reload
  for service in "${SYSTEMD_SERVICES[@]}"; do
    systemctl restart "${service}"
  done
  systemctl reload nginx
}

require_repo_root
sync_repo_to_runtime
install_dependencies
apply_bootstrap_sql_if_requested
build_admin_site
restart_services

echo "[deploy-kk-vps] Deployment complete."
