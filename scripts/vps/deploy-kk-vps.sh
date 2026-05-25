#!/usr/bin/env bash
set -euo pipefail

APP_USER="${KK_APP_USER:-kkstudio}"
APP_GROUP="${KK_APP_GROUP:-$APP_USER}"
APP_ROOT="${KK_APP_ROOT:-/opt/kk-studio}"
CURRENT_DIR="${KK_CURRENT_DIR:-$APP_ROOT/current}"
ENV_DIR="${KK_ENV_DIR:-/etc/kk-studio}"
APP_SITE_ROOT="${KK_APP_SITE_ROOT:-/var/www/kk-app}"
ADMIN_SITE_ROOT="${KK_ADMIN_SITE_ROOT:-/var/www/kk-admin}"
WEB_ENV_FILE="${KK_WEB_ENV_FILE:-$ENV_DIR/kk-web.env}"
ADMIN_ENV_FILE="${KK_ADMIN_ENV_FILE:-$ENV_DIR/kk-admin.env}"
APPLY_BOOTSTRAP_SQL="${KK_APPLY_BOOTSTRAP_SQL:-false}"
POSTGRES_DB="${KK_PG_DB:-kkstudio}"
POSTGRES_SUPERUSER="${KK_PG_SUPERUSER:-postgres}"
BOOTSTRAP_SQL_PATH="${KK_BOOTSTRAP_SQL:-scripts/postgres/bootstrap-kk-vps.sql}"
SYSTEMD_SERVICES=("kk-api" "kk-payment-sidecar")

require_repo_root() {
  if [[ ! -f package.json || ! -d apps/web ]]; then
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

run_npm_script_with_optional_env() {
  local npm_command="$1"
  local env_file="$2"

  if [[ -f "${env_file}" ]]; then
    sudo -u "${APP_USER}" bash -lc "set -a; source '${env_file}'; set +a; cd '${CURRENT_DIR}' && ${npm_command}"
    return
  fi

  sudo -u "${APP_USER}" bash -lc "cd '${CURRENT_DIR}' && ${npm_command}"
}

build_static_sites() {
  run_npm_script_with_optional_env "npm run build" "${WEB_ENV_FILE}"
  install -d -m 0755 "${APP_SITE_ROOT}"
  rsync -a --delete "${CURRENT_DIR}/apps/web/dist/" "${APP_SITE_ROOT}/"
}

harden_env_permissions() {
  if [[ -f "${ENV_DIR}/kk-api.env" ]]; then
    chgrp "${APP_GROUP}" "${ENV_DIR}/kk-api.env"
    chmod 0640 "${ENV_DIR}/kk-api.env"
  fi
}

install_nginx_gateway() {
  if [[ ! -f "${CURRENT_DIR}/config/deploy/nginx/kk-vps-gateway.conf" ]]; then
    echo "[deploy-kk-vps] Nginx gateway config not found at ${CURRENT_DIR}/config/deploy/nginx/kk-vps-gateway.conf" >&2
    exit 1
  fi

  install -m 0644 "${CURRENT_DIR}/config/deploy/nginx/kk-vps-gateway.conf" /etc/nginx/sites-available/kk-vps-gateway.conf
  ln -sf /etc/nginx/sites-available/kk-vps-gateway.conf /etc/nginx/sites-enabled/kk-vps-gateway.conf
  rm -f /etc/nginx/sites-enabled/default
  rm -f /etc/nginx/sites-enabled/kk-api.conf
  rm -f /etc/nginx/sites-enabled/kk-admin-4174.conf
  nginx -t
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
    if systemctl list-unit-files "${service}.service" --no-legend | grep -q "^${service}\\.service"; then
      systemctl restart "${service}"
    else
      echo "[deploy-kk-vps] Skipping missing optional service: ${service}"
    fi
  done
  systemctl reload nginx
}

require_repo_root
sync_repo_to_runtime
install_dependencies
apply_bootstrap_sql_if_requested
build_static_sites
harden_env_permissions
install_nginx_gateway
restart_services

echo "[deploy-kk-vps] Deployment complete."
