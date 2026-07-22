#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

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
REPO_BOOTSTRAP_SQL="${KK_BOOTSTRAP_SQL:-${REPO_ROOT}/scripts/ops/postgres/bootstrap-kk-vps.sql}"
AI_ASSISTANT_SCOPE_MIGRATION="${KK_AI_ASSISTANT_SCOPE_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/016_ai_assistant_user_scope.sql}"
AGENT_RUN_EVENT_MIGRATION="${KK_AGENT_RUN_EVENT_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/020_agent_run_events.sql}"
AGENT_SESSION_MIGRATION="${KK_AGENT_SESSION_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/021_agent_sessions.sql}"
AGENT_RUN_SESSION_BINDING_MIGRATION="${KK_AGENT_RUN_SESSION_BINDING_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/022_agent_run_session_binding.sql}"
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
  if [[ ! -f "${REPO_BOOTSTRAP_SQL}" ]]; then
    echo "[bootstrap-kk-vps] Required bootstrap SQL not found at ${REPO_BOOTSTRAP_SQL}." >&2
    exit 1
  fi
  if [[ ! -f "${AI_ASSISTANT_SCOPE_MIGRATION}" ]]; then
    echo "[bootstrap-kk-vps] Required AI assistant migration not found at ${AI_ASSISTANT_SCOPE_MIGRATION}." >&2
    exit 1
  fi
  if [[ ! -f "${AGENT_RUN_EVENT_MIGRATION}" ]]; then
    echo "[bootstrap-kk-vps] Required Agent Run event migration not found at ${AGENT_RUN_EVENT_MIGRATION}." >&2
    exit 1
  fi
  if [[ ! -f "${AGENT_SESSION_MIGRATION}" ]]; then
    echo "[bootstrap-kk-vps] Required Agent Session migration not found at ${AGENT_SESSION_MIGRATION}." >&2
    exit 1
  fi
  if [[ ! -f "${AGENT_RUN_SESSION_BINDING_MIGRATION}" ]]; then
    echo "[bootstrap-kk-vps] Required Agent Run Session binding migration not found at ${AGENT_RUN_SESSION_BINDING_MIGRATION}." >&2
    exit 1
  fi

  REPO_BOOTSTRAP_SQL="$(realpath "${REPO_BOOTSTRAP_SQL}")"
  AI_ASSISTANT_SCOPE_MIGRATION="$(realpath "${AI_ASSISTANT_SCOPE_MIGRATION}")"
  AGENT_RUN_EVENT_MIGRATION="$(realpath "${AGENT_RUN_EVENT_MIGRATION}")"
  AGENT_SESSION_MIGRATION="$(realpath "${AGENT_SESSION_MIGRATION}")"
  AGENT_RUN_SESSION_BINDING_MIGRATION="$(realpath "${AGENT_RUN_SESSION_BINDING_MIGRATION}")"
  case "${REPO_BOOTSTRAP_SQL}" in
    "${REPO_ROOT}"/*) ;;
    *) echo "[bootstrap-kk-vps] Bootstrap SQL must stay inside ${REPO_ROOT}." >&2; exit 1 ;;
  esac
  case "${AI_ASSISTANT_SCOPE_MIGRATION}" in
    "${REPO_ROOT}"/*) ;;
    *) echo "[bootstrap-kk-vps] AI assistant migration must stay inside ${REPO_ROOT}." >&2; exit 1 ;;
  esac
  case "${AGENT_RUN_EVENT_MIGRATION}" in
    "${REPO_ROOT}"/*) ;;
    *) echo "[bootstrap-kk-vps] Agent Run event migration must stay inside ${REPO_ROOT}." >&2; exit 1 ;;
  esac
  case "${AGENT_SESSION_MIGRATION}" in
    "${REPO_ROOT}"/*) ;;
    *) echo "[bootstrap-kk-vps] Agent Session migration must stay inside ${REPO_ROOT}." >&2; exit 1 ;;
  esac
  case "${AGENT_RUN_SESSION_BINDING_MIGRATION}" in
    "${REPO_ROOT}"/*) ;;
    *) echo "[bootstrap-kk-vps] Agent Run Session binding migration must stay inside ${REPO_ROOT}." >&2; exit 1 ;;
  esac

  for identifier in "${POSTGRES_USER}" "${POSTGRES_DB}" "${POSTGRES_SUPERUSER}"; do
    if [[ ! "${identifier}" =~ ^[a-z_][a-z0-9_]{0,62}$ ]]; then
      echo "[bootstrap-kk-vps] PostgreSQL role and database identifiers must use lowercase letters, digits, and underscores." >&2
      exit 1
    fi
  done

  if ! command -v runuser >/dev/null 2>&1; then
    echo "[bootstrap-kk-vps] runuser is required for PostgreSQL provisioning." >&2
    exit 1
  fi

  if [[ -z "${POSTGRES_PASSWORD}" ]]; then
    echo "[bootstrap-kk-vps] KK_PG_PASSWORD is required; refusing to create an unusable runtime role." >&2
    exit 1
  fi

  export KK_BOOTSTRAP_ROLE_PASSWORD="${POSTGRES_PASSWORD}"
  runuser --preserve-environment -u "${POSTGRES_SUPERUSER}" -- \
    psql -v ON_ERROR_STOP=1 -v role_name="${POSTGRES_USER}" <<'SQL'
\getenv role_password KK_BOOTSTRAP_ROLE_PASSWORD
SELECT format(
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role_name')
      THEN 'ALTER ROLE %I WITH LOGIN PASSWORD %L'
    ELSE 'CREATE ROLE %I LOGIN PASSWORD %L'
  END,
  :'role_name',
  :'role_password'
) \gexec
SQL
  unset KK_BOOTSTRAP_ROLE_PASSWORD

  if ! runuser -u "${POSTGRES_SUPERUSER}" -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'" | grep -q 1; then
    runuser -u "${POSTGRES_SUPERUSER}" -- createdb --owner="${POSTGRES_USER}" "${POSTGRES_DB}"
  fi

  # 单一 psql 会话先 SET ROLE，确保 fresh install 的所有对象归运行角色所有。
  runuser -u "${POSTGRES_SUPERUSER}" -- psql \
    -v ON_ERROR_STOP=1 \
    -d "${POSTGRES_DB}" \
    -c "SET ROLE \"${POSTGRES_USER}\"" \
    -f "${REPO_BOOTSTRAP_SQL}" \
    -f "${AI_ASSISTANT_SCOPE_MIGRATION}" \
    -f "${AGENT_RUN_EVENT_MIGRATION}" \
    -f "${AGENT_SESSION_MIGRATION}" \
    -f "${AGENT_RUN_SESSION_BINDING_MIGRATION}"
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
1. Copy env templates from scripts/ops/vps/kk-vps.env.example and scripts/ops/vps/*.env.example into ${ENV_DIR}
2. Clone or sync the repo into ${APP_ROOT}/current
3. Run scripts/ops/vps/deploy-kk-vps.sh from the repo root
4. Start services:
   systemctl restart kk-api
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
