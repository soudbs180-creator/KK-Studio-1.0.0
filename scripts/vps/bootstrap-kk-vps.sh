#!/usr/bin/env bash
set -euo pipefail

APP_USER="${KK_APP_USER:-kkstudio}"
APP_GROUP="${KK_APP_GROUP:-$APP_USER}"
APP_ROOT="${KK_APP_ROOT:-/opt/kk-studio}"
ENV_DIR="${KK_ENV_DIR:-/etc/kk-studio}"
APP_SITE_ROOT="${KK_APP_SITE_ROOT:-/var/www/kk-app}"
ADMIN_SITE_ROOT="${KK_ADMIN_SITE_ROOT:-/var/www/kk-admin}"
POSTGRES_DB="${KK_PG_DB:-kkstudio}"
POSTGRES_USER="${KK_PG_USER:-kkstudio}"
POSTGRES_PASSWORD="${KK_PG_PASSWORD:-}"
POSTGRES_SUPERUSER="${KK_PG_SUPERUSER:-postgres}"
REPO_BOOTSTRAP_SQL="${KK_BOOTSTRAP_SQL:-scripts/postgres/bootstrap-kk-vps.sql}"
NODE_MAJOR="${KK_NODE_MAJOR:-24}"

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "[bootstrap-kk-vps] Please run as root." >&2
    exit 1
  fi
}

install_base_packages() {
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y \
    ca-certificates \
    curl \
    git \
    gnupg \
    nginx \
    postgresql \
    postgresql-contrib \
    rsync \
    unzip
}

install_nodejs() {
  if command -v node >/dev/null 2>&1; then
    local detected_major
    detected_major="$(node -p 'process.versions.node.split(".")[0]')"
    if [[ "${detected_major}" == "${NODE_MAJOR}" ]]; then
      echo "[bootstrap-kk-vps] Node.js ${NODE_MAJOR}.x already installed."
      return
    fi
  fi

  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
  corepack enable || true
}

ensure_app_user() {
  if ! getent group "${APP_GROUP}" >/dev/null 2>&1; then
    groupadd --system "${APP_GROUP}"
  fi

  if ! id -u "${APP_USER}" >/dev/null 2>&1; then
    useradd --system --gid "${APP_GROUP}" --home-dir "${APP_ROOT}" --create-home --shell /bin/bash "${APP_USER}"
  fi
}

prepare_directories() {
  install -d -m 0755 -o "${APP_USER}" -g "${APP_GROUP}" \
    "${APP_ROOT}" \
    "${APP_ROOT}/current" \
    "${APP_ROOT}/releases" \
    "${APP_ROOT}/shared" \
    "${APP_ROOT}/shared/logs" \
    "${APP_ROOT}/shared/uploads" \
    "${APP_ROOT}/shared/tmp" \
    "${ENV_DIR}" \
    "${APP_SITE_ROOT}" \
    "${ADMIN_SITE_ROOT}" \
    "/var/www/releases" \
    "/var/www/releases/app" \
    "/var/www/releases/admin"
}

setup_postgres() {
  if [[ -z "${POSTGRES_PASSWORD}" ]]; then
    echo "[bootstrap-kk-vps] KK_PG_PASSWORD is empty. Skipping PostgreSQL role/database creation." >&2
  else
    su - "${POSTGRES_SUPERUSER}" -c "psql -v ON_ERROR_STOP=1 <<'SQL'
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${POSTGRES_USER}') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '${POSTGRES_USER}', '${POSTGRES_PASSWORD}');
  ELSE
    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', '${POSTGRES_USER}', '${POSTGRES_PASSWORD}');
  END IF;
END
\$\$;
SQL"

    su - "${POSTGRES_SUPERUSER}" -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'\" | grep -q 1 || createdb --owner='${POSTGRES_USER}' '${POSTGRES_DB}'"
  fi

  if [[ -f "${REPO_BOOTSTRAP_SQL}" ]]; then
    su - "${POSTGRES_SUPERUSER}" -c "psql -v ON_ERROR_STOP=1 -d '${POSTGRES_DB}' -f '${REPO_BOOTSTRAP_SQL}'"
  else
    echo "[bootstrap-kk-vps] Bootstrap SQL not found at ${REPO_BOOTSTRAP_SQL}. Skipping schema bootstrap." >&2
  fi
}

install_runtime_templates() {
  if [[ -d config/deploy/systemd ]]; then
    install -m 0644 config/deploy/systemd/*.service /etc/systemd/system/
  fi

  if [[ -f config/deploy/nginx/kk-vps-gateway.conf ]]; then
    install -m 0644 config/deploy/nginx/kk-vps-gateway.conf /etc/nginx/sites-available/kk-vps-gateway.conf
    ln -sf /etc/nginx/sites-available/kk-vps-gateway.conf /etc/nginx/sites-enabled/kk-vps-gateway.conf
    rm -f /etc/nginx/sites-enabled/default
    rm -f /etc/nginx/sites-enabled/kk-api.conf
    rm -f /etc/nginx/sites-enabled/kk-admin-4174.conf
    rm -f /etc/nginx/sites-enabled/kk-vps.conf
    rm -f /etc/nginx/sites-available/kk-vps.conf
  fi

  systemctl daemon-reload
  systemctl enable postgresql nginx || true
}

print_next_steps() {
  cat <<EOF

[bootstrap-kk-vps] Base bootstrap complete.

Next steps:
1. Copy env templates from scripts/vps/kk-vps.env.example and scripts/vps/*.env.example into ${ENV_DIR}
2. Clone or sync the repo into ${APP_ROOT}/current
3. Run scripts/vps/deploy-kk-vps.sh from the repo root
4. Start services:
   systemctl restart kk-api
   systemctl restart kk-payment-sidecar
   systemctl reload nginx
EOF
}

require_root
install_base_packages
install_nodejs
ensure_app_user
prepare_directories
setup_postgres
install_runtime_templates
print_next_steps
