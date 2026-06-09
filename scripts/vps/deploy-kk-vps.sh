#!/usr/bin/env bash
set -euo pipefail

APP_USER="${KK_APP_USER:-kkstudio}"
APP_GROUP="${KK_APP_GROUP:-$APP_USER}"
APP_ROOT="${KK_APP_ROOT:-/opt/kk-studio}"
CURRENT_DIR="${KK_CURRENT_DIR:-$APP_ROOT/current}"
ENV_DIR="${KK_ENV_DIR:-/etc/kk-studio}"
APP_SITE_ROOT="${KK_APP_SITE_ROOT:-/var/www/kk-app}"
WEB_ENV_FILE="${KK_WEB_ENV_FILE:-$ENV_DIR/kk-web.env}"
APPLY_BOOTSTRAP_SQL="${KK_APPLY_BOOTSTRAP_SQL:-false}"
POSTGRES_DB="${KK_PG_DB:-kkstudio}"
POSTGRES_SUPERUSER="${KK_PG_SUPERUSER:-postgres}"
BOOTSTRAP_SQL_PATH="${KK_BOOTSTRAP_SQL:-scripts/postgres/bootstrap-kk-vps.sql}"
SYSTEMD_SERVICES=("kk-api")

# 准备版本发布所需的目录
RELEASES_DIR="${APP_ROOT}/releases"
APP_RELEASES_DIR="/var/www/releases/app"

TIMESTAMP="$(date +%Y%m%d%H%M%S)"
COMMIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")"
RELEASE_NAME="${TIMESTAMP}-${COMMIT_SHA}"

NEW_RELEASE_DIR="${RELEASES_DIR}/release-${RELEASE_NAME}"
NEW_APP_RELEASE_DIR="${APP_RELEASES_DIR}/kk-app-${RELEASE_NAME}"

# 备份原先的软链接指向，用以部署失败时回退
PREV_CURRENT=""
PREV_APP=""

require_repo_root() {
  if [[ ! -f package.json || ! -d apps/web ]]; then
    echo "[deploy-kk-vps] Run this script from the repository root." >&2
    exit 1
  fi
}

# 部署出错时的自动化回滚逻辑
on_error() {
  local exit_code=$?
  echo "[deploy-kk-vps] CRITICAL: An error occurred on line $1. Exit code: ${exit_code}." >&2
  
  if [[ -n "${PREV_CURRENT}" ]]; then
    echo "[deploy-kk-vps] Initiating rollback to previous stable releases..." >&2
    
    ln -sfn "${PREV_CURRENT}" "${CURRENT_DIR}"
    echo "[deploy-kk-vps] Rolled back current app to: ${PREV_CURRENT}" >&2
    
    if [[ -n "${PREV_APP}" ]]; then
      ln -sfn "${PREV_APP}" "${APP_SITE_ROOT}"
      echo "[deploy-kk-vps] Rolled back Web site to: ${PREV_APP}" >&2
    fi
    
    echo "[deploy-kk-vps] Re-applying legacy Nginx config..." >&2
    if [[ -f "${CURRENT_DIR}/config/deploy/nginx/kk-vps-gateway.conf" ]]; then
      install -m 0644 "${CURRENT_DIR}/config/deploy/nginx/kk-vps-gateway.conf" /etc/nginx/sites-available/kk-vps-gateway.conf
      ln -sf /etc/nginx/sites-available/kk-vps-gateway.conf /etc/nginx/sites-enabled/kk-vps-gateway.conf
    fi
    
    nginx -t && systemctl reload nginx || true
    
    echo "[deploy-kk-vps] Restarting previous systemd services..." >&2
    systemctl daemon-reload
    for service in "${SYSTEMD_SERVICES[@]}"; do
      systemctl restart "${service}" || true
    done
    echo "[deploy-kk-vps] Rollback process completed." >&2
  fi
  
  exit "${exit_code}"
}

# 注册异常捕获钩子
trap 'on_error $LINENO' ERR

sync_repo_to_release_dir() {
  echo "[deploy-kk-vps] Deploying Commit: ${COMMIT_SHA} on Branch: $(git branch --show-current 2>/dev/null || echo "unknown")"
  echo "[deploy-kk-vps] Syncing repository to release folder: ${NEW_RELEASE_DIR}"
  
  install -d -m 0755 -o "${APP_USER}" -g "${APP_GROUP}" "${RELEASES_DIR}"
  install -d -m 0755 -o "${APP_USER}" -g "${APP_GROUP}" "${NEW_RELEASE_DIR}"
  
  # 同步项目文件，排除开发状态与已有打包产物
  rsync -a --delete \
    --exclude ".git" \
    --exclude ".worktrees" \
    --exclude "node_modules" \
    --exclude "dist" \
    ./ "${NEW_RELEASE_DIR}/"
    
  # 创建 shared 软链接，确保各版本对共享媒体/日志的读写一致
  ln -sfn "${APP_ROOT}/shared" "${NEW_RELEASE_DIR}/shared"
  chown -R "${APP_USER}:${APP_GROUP}" "${NEW_RELEASE_DIR}"
}

install_dependencies() {
  echo "[deploy-kk-vps] Installing dependencies under: ${NEW_RELEASE_DIR}"
  sudo -u "${APP_USER}" bash -lc "cd '${NEW_RELEASE_DIR}' && npm ci"
}

run_npm_script_in_release() {
  local npm_command="$1"
  local env_file="$2"

  if [[ -f "${env_file}" ]]; then
    sudo -u "${APP_USER}" bash -lc "set -a; source '${env_file}'; set +a; cd '${NEW_RELEASE_DIR}' && ${npm_command}"
    return
  fi

  sudo -u "${APP_USER}" bash -lc "cd '${NEW_RELEASE_DIR}' && ${npm_command}"
}

build_static_sites() {
  echo "[deploy-kk-vps] Building Web Static Site..."
  run_npm_script_in_release "npm run build" "${WEB_ENV_FILE}"
  
  # 验证打包产物及清单文件是否就绪
  if [[ ! -f "${NEW_RELEASE_DIR}/apps/web/dist/app-version.json" ]]; then
    echo "[deploy-kk-vps] ERROR: apps/web/dist/app-version.json was not generated during build." >&2
    exit 1
  fi
  
  echo "[deploy-kk-vps] Generated Build Manifest:"
  cat "${NEW_RELEASE_DIR}/apps/web/dist/app-version.json"
  
  install -d -m 0755 "${APP_RELEASES_DIR}"
  install -d -m 0755 "${NEW_APP_RELEASE_DIR}"
  rsync -a --delete "${NEW_RELEASE_DIR}/apps/web/dist/" "${NEW_APP_RELEASE_DIR}/"
}

harden_env_permissions() {
  if [[ -f "${ENV_DIR}/kk-api.env" ]]; then
    chgrp "${APP_GROUP}" "${ENV_DIR}/kk-api.env"
    chmod 0640 "${ENV_DIR}/kk-api.env"
  fi
}

apply_bootstrap_sql_if_requested() {
  if [[ "${APPLY_BOOTSTRAP_SQL}" != "true" ]]; then
    return
  fi

  if [[ ! -f "${NEW_RELEASE_DIR}/${BOOTSTRAP_SQL_PATH}" ]]; then
    echo "[deploy-kk-vps] Bootstrap SQL not found at ${NEW_RELEASE_DIR}/${BOOTSTRAP_SQL_PATH}" >&2
    exit 1
  fi

  echo "[deploy-kk-vps] Executing bootstrap database migrations..."
  su - "${POSTGRES_SUPERUSER}" -c "psql -v ON_ERROR_STOP=1 -d '${POSTGRES_DB}' -f '${NEW_RELEASE_DIR}/${BOOTSTRAP_SQL_PATH}'"
}

atomic_switch_symlinks() {
  echo "[deploy-kk-vps] Swapping symlinks to version: ${RELEASE_NAME}"
  
  # 备份原 current 指向
  if [[ -L "${CURRENT_DIR}" ]]; then
    PREV_CURRENT="$(readlink -f "${CURRENT_DIR}")"
  elif [[ -d "${CURRENT_DIR}" ]]; then
    echo "[deploy-kk-vps] Converting folder ${CURRENT_DIR} to symlink..."
    mv "${CURRENT_DIR}" "${RELEASES_DIR}/legacy-folder-backup"
    PREV_CURRENT="${RELEASES_DIR}/legacy-folder-backup"
  fi

  # 备份 Web 指向
  if [[ -L "${APP_SITE_ROOT}" ]]; then
    PREV_APP="$(readlink -f "${APP_SITE_ROOT}")"
  elif [[ -d "${APP_SITE_ROOT}" ]]; then
    echo "[deploy-kk-vps] Converting folder ${APP_SITE_ROOT} to symlink..."
    mv "${APP_SITE_ROOT}" "${APP_RELEASES_DIR}/legacy-folder-backup"
    PREV_APP="${APP_RELEASES_DIR}/legacy-folder-backup"
  fi

  # 执行软链接原子切换
  ln -sfn "${NEW_RELEASE_DIR}" "${CURRENT_DIR}"
  ln -sfn "${NEW_APP_RELEASE_DIR}" "${APP_SITE_ROOT}"
}

install_nginx_gateway() {
  local gateway_conf="${CURRENT_DIR}/config/deploy/nginx/kk-vps-gateway.conf"
  if [[ ! -f "${gateway_conf}" ]]; then
    echo "[deploy-kk-vps] Nginx gateway config not found at ${gateway_conf}" >&2
    exit 1
  fi

  echo "[deploy-kk-vps] Installing Nginx configuration..."
  install -m 0644 "${gateway_conf}" /etc/nginx/sites-available/kk-vps-gateway.conf
  ln -sf /etc/nginx/sites-available/kk-vps-gateway.conf /etc/nginx/sites-enabled/kk-vps-gateway.conf
  
  # 清理可能残留的冲突配置文件
  rm -f /etc/nginx/sites-enabled/default
  rm -f /etc/nginx/sites-enabled/kk-api.conf
  rm -f /etc/nginx/sites-enabled/kk-admin-4174.conf
  rm -f /etc/nginx/sites-enabled/kk-vps.conf
  
  echo "[deploy-kk-vps] Testing Nginx configuration syntax..."
  if ! nginx -t; then
    echo "[deploy-kk-vps] ERROR: Nginx config check failed. Aborting." >&2
    exit 1
  fi
}

restart_services_and_reload_nginx() {
  echo "[deploy-kk-vps] Reloading systemd daemon and restarting API services..."
  systemctl daemon-reload
  for service in "${SYSTEMD_SERVICES[@]}"; do
    if systemctl list-unit-files "${service}.service" --no-legend | grep -q "^${service}\\.service"; then
      systemctl restart "${service}"
    else
      echo "[deploy-kk-vps] Skipping missing optional service: ${service}"
    fi
  done
  
  echo "[deploy-kk-vps] Reloading nginx service..."
  systemctl reload nginx
}

validate_deployment_by_curl() {
  echo "[deploy-kk-vps] Conducting post-deployment smoke checks..."
  
  # 验证 1: 本地 curl 验证静态站点上的版本 Manifest 信息
  echo "[deploy-kk-vps] Testing endpoint: http://127.0.0.1/app-version.json"
  local manifest_body
  manifest_body="$(curl -sS --fail http://127.0.0.1/app-version.json || echo "")"
  if [[ -z "${manifest_body}" ]]; then
    echo "[deploy-kk-vps] ERROR: Failed to retrieve /app-version.json via localhost HTTP." >&2
    exit 1
  fi
  
  local live_sha
  live_sha="$(echo "${manifest_body}" | grep -oP '"commitSha":\s*"\K[^"]+' || echo "null")"
  echo "[deploy-kk-vps] Local file Commit SHA: ${COMMIT_SHA}"
  echo "[deploy-kk-vps] HTTP Response Commit SHA: ${live_sha}"
  
  if [[ "${live_sha}" != "${COMMIT_SHA}" && "${COMMIT_SHA}" != "unknown" ]]; then
    echo "[deploy-kk-vps] ERROR: Deployed version SHA mismatch! Expected ${COMMIT_SHA} but got ${live_sha}." >&2
    exit 1
  fi
  
  # 验证 2: 验证后端 API 服务是否可达
  echo "[deploy-kk-vps] Testing backend health check: http://127.0.0.1/healthz"
  local health_status
  health_status="$(curl -sS --fail http://127.0.0.1/healthz || echo "")"
  if [[ "${health_status}" != "ok" && "${health_status}" != '{"status":"ok"}' && ! "${health_status}" =~ "ok" ]]; then
    echo "[deploy-kk-vps] ERROR: Backend health check failed. Received: ${health_status}" >&2
    exit 1
  fi
  
  echo "[deploy-kk-vps] All deployment checks passed successfully."
}

cleanup_old_releases() {
  echo "[deploy-kk-vps] Cleaning up old releases, keeping the latest 5..."
  
  # 1. 清理 Node API 发布的 releases
  if [[ -d "${RELEASES_DIR}" ]]; then
    cd "${RELEASES_DIR}"
    local count
    count=$(ls -1d release-* 2>/dev/null | wc -l || echo 0)
    if [[ "${count}" -gt 5 ]]; then
      ls -1dt release-* | tail -n +"6" | while read -r old_rel; do
        if [[ -n "${old_rel}" ]]; then
          echo "[deploy-kk-vps] Pruning old Node release: ${old_rel}"
          rm -rf "${old_rel}"
        fi
      done
    fi
  fi
  
  # 2. 清理 Web 静态资源发布的 releases
  if [[ -d "${APP_RELEASES_DIR}" ]]; then
    cd "${APP_RELEASES_DIR}"
    local count
    count=$(ls -1d kk-app-* 2>/dev/null | wc -l || echo 0)
    if [[ "${count}" -gt 5 ]]; then
      ls -1dt kk-app-* | tail -n +"6" | while read -r old_rel; do
        if [[ -n "${old_rel}" ]]; then
          echo "[deploy-kk-vps] Pruning old Web site release: ${old_rel}"
          rm -rf "${old_rel}"
        fi
      done
    fi
  fi
}

# 流程运行
require_repo_root
sync_repo_to_release_dir
install_dependencies
apply_bootstrap_sql_if_requested
build_static_sites
harden_env_permissions

# 进入临界区，进行原子替换与重载
atomic_switch_symlinks
install_nginx_gateway
restart_services_and_reload_nginx

# 本地验证
validate_deployment_by_curl

# 验证通过，清理旧包
cleanup_old_releases

echo "[deploy-kk-vps] Release ${RELEASE_NAME} deployed successfully."
