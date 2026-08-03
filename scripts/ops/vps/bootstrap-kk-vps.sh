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
STRICT_BILLING_SCHEMA_MIGRATION="${KK_STRICT_BILLING_SCHEMA_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/003_strict_agents_schema.sql}"
CREDIT_DEFAULT_MIGRATION="${KK_CREDIT_DEFAULT_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/005_remove_default_credits.sql}"
ADMIN_CREDITS_MIGRATION="${KK_ADMIN_CREDITS_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/006_admin_credits_contract.sql}"
ADMIN_LEVEL_CONSTRAINT_MIGRATION="${KK_ADMIN_LEVEL_CONSTRAINT_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/009_admin_level_check_constraint.sql}"
ORDERS_CONSTRAINT_MIGRATION="${KK_ORDERS_CONSTRAINT_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/010_orders_positive_credits_constraint.sql}"
AI_ASSISTANT_SCOPE_MIGRATION="${KK_AI_ASSISTANT_SCOPE_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/016_ai_assistant_user_scope.sql}"
AGENT_RUN_EVENT_MIGRATION="${KK_AGENT_RUN_EVENT_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/020_agent_run_events.sql}"
AGENT_SESSION_MIGRATION="${KK_AGENT_SESSION_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/021_agent_sessions.sql}"
AGENT_RUN_SESSION_BINDING_MIGRATION="${KK_AGENT_RUN_SESSION_BINDING_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/022_agent_run_session_binding.sql}"
AGENT_RUN_SEMANTIC_EVENT_MIGRATION="${KK_AGENT_RUN_SEMANTIC_EVENT_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/023_agent_run_semantic_events.sql}"
AGENT_RUN_REPLAN_EVENT_MIGRATION="${KK_AGENT_RUN_REPLAN_EVENT_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/024_agent_run_replan_events.sql}"
OAUTH_IDENTITY_MIGRATION="${KK_OAUTH_IDENTITY_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/026_oauth_identities.sql}"
PAYMENT_RECHARGE_MIGRATION="${KK_PAYMENT_RECHARGE_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/027_payment_recharge_integrity.sql}"
PAYMENT_RECHARGE_HARDENING_MIGRATION="${KK_PAYMENT_RECHARGE_HARDENING_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/028_payment_recharge_hardening.sql}"
PROVIDER_ROUTING_PRIORITY_MIGRATION="${KK_PROVIDER_ROUTING_PRIORITY_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/029_provider_connection_routing_priority.sql}"
PAIRED_RUNTIMES_MIGRATION="${KK_PAIRED_RUNTIMES_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/030_paired_runtimes.sql}"
AGENT_EXTENSIONS_MIGRATION="${KK_AGENT_EXTENSIONS_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/031_agent_extensions.sql}"
AGENT_COORDINATION_MIGRATION="${KK_AGENT_COORDINATION_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/032_agent_coordination.sql}"
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
  for prerequisite_migration in \
    "${STRICT_BILLING_SCHEMA_MIGRATION}" \
    "${CREDIT_DEFAULT_MIGRATION}" \
    "${ADMIN_CREDITS_MIGRATION}" \
    "${ADMIN_LEVEL_CONSTRAINT_MIGRATION}" \
    "${ORDERS_CONSTRAINT_MIGRATION}"; do
    if [[ ! -f "${prerequisite_migration}" ]]; then
      echo "[bootstrap-kk-vps] Required billing prerequisite migration not found at ${prerequisite_migration}." >&2
      exit 1
    fi
  done
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
  if [[ ! -f "${AGENT_RUN_SEMANTIC_EVENT_MIGRATION}" ]]; then
    echo "[bootstrap-kk-vps] Required Agent Run semantic event migration not found at ${AGENT_RUN_SEMANTIC_EVENT_MIGRATION}." >&2
    exit 1
  fi
  if [[ ! -f "${AGENT_RUN_REPLAN_EVENT_MIGRATION}" ]]; then
    echo "[bootstrap-kk-vps] Required Agent Run replan event migration not found at ${AGENT_RUN_REPLAN_EVENT_MIGRATION}." >&2
    exit 1
  fi
  if [[ ! -f "${OAUTH_IDENTITY_MIGRATION}" ]]; then
    echo "[bootstrap-kk-vps] Required OAuth identity migration not found at ${OAUTH_IDENTITY_MIGRATION}." >&2
    exit 1
  fi
  if [[ ! -f "${PAYMENT_RECHARGE_MIGRATION}" ]]; then
    echo "[bootstrap-kk-vps] Required payment recharge migration not found at ${PAYMENT_RECHARGE_MIGRATION}." >&2
    exit 1
  fi
  if [[ ! -f "${PAYMENT_RECHARGE_HARDENING_MIGRATION}" ]]; then
    echo "[bootstrap-kk-vps] Required payment recharge hardening migration not found at ${PAYMENT_RECHARGE_HARDENING_MIGRATION}." >&2
    exit 1
  fi
  for runtime_migration in \
    "${PROVIDER_ROUTING_PRIORITY_MIGRATION}" \
    "${PAIRED_RUNTIMES_MIGRATION}" \
    "${AGENT_EXTENSIONS_MIGRATION}" \
    "${AGENT_COORDINATION_MIGRATION}"; do
    if [[ ! -f "${runtime_migration}" ]]; then
      echo "[bootstrap-kk-vps] Required runtime capability migration not found at ${runtime_migration}." >&2
      exit 1
    fi
  done

  REPO_BOOTSTRAP_SQL="$(realpath "${REPO_BOOTSTRAP_SQL}")"
  STRICT_BILLING_SCHEMA_MIGRATION="$(realpath "${STRICT_BILLING_SCHEMA_MIGRATION}")"
  CREDIT_DEFAULT_MIGRATION="$(realpath "${CREDIT_DEFAULT_MIGRATION}")"
  ADMIN_CREDITS_MIGRATION="$(realpath "${ADMIN_CREDITS_MIGRATION}")"
  ADMIN_LEVEL_CONSTRAINT_MIGRATION="$(realpath "${ADMIN_LEVEL_CONSTRAINT_MIGRATION}")"
  ORDERS_CONSTRAINT_MIGRATION="$(realpath "${ORDERS_CONSTRAINT_MIGRATION}")"
  AI_ASSISTANT_SCOPE_MIGRATION="$(realpath "${AI_ASSISTANT_SCOPE_MIGRATION}")"
  AGENT_RUN_EVENT_MIGRATION="$(realpath "${AGENT_RUN_EVENT_MIGRATION}")"
  AGENT_SESSION_MIGRATION="$(realpath "${AGENT_SESSION_MIGRATION}")"
  AGENT_RUN_SESSION_BINDING_MIGRATION="$(realpath "${AGENT_RUN_SESSION_BINDING_MIGRATION}")"
  AGENT_RUN_SEMANTIC_EVENT_MIGRATION="$(realpath "${AGENT_RUN_SEMANTIC_EVENT_MIGRATION}")"
  AGENT_RUN_REPLAN_EVENT_MIGRATION="$(realpath "${AGENT_RUN_REPLAN_EVENT_MIGRATION}")"
  OAUTH_IDENTITY_MIGRATION="$(realpath "${OAUTH_IDENTITY_MIGRATION}")"
  PAYMENT_RECHARGE_MIGRATION="$(realpath "${PAYMENT_RECHARGE_MIGRATION}")"
  PAYMENT_RECHARGE_HARDENING_MIGRATION="$(realpath "${PAYMENT_RECHARGE_HARDENING_MIGRATION}")"
  PROVIDER_ROUTING_PRIORITY_MIGRATION="$(realpath "${PROVIDER_ROUTING_PRIORITY_MIGRATION}")"
  PAIRED_RUNTIMES_MIGRATION="$(realpath "${PAIRED_RUNTIMES_MIGRATION}")"
  AGENT_EXTENSIONS_MIGRATION="$(realpath "${AGENT_EXTENSIONS_MIGRATION}")"
  AGENT_COORDINATION_MIGRATION="$(realpath "${AGENT_COORDINATION_MIGRATION}")"
  case "${REPO_BOOTSTRAP_SQL}" in
    "${REPO_ROOT}"/*) ;;
    *) echo "[bootstrap-kk-vps] Bootstrap SQL must stay inside ${REPO_ROOT}." >&2; exit 1 ;;
  esac
  for prerequisite_migration in \
    "${STRICT_BILLING_SCHEMA_MIGRATION}" \
    "${CREDIT_DEFAULT_MIGRATION}" \
    "${ADMIN_CREDITS_MIGRATION}" \
    "${ADMIN_LEVEL_CONSTRAINT_MIGRATION}" \
    "${ORDERS_CONSTRAINT_MIGRATION}"; do
    case "${prerequisite_migration}" in
      "${REPO_ROOT}"/*) ;;
      *) echo "[bootstrap-kk-vps] Billing prerequisite migrations must stay inside ${REPO_ROOT}." >&2; exit 1 ;;
    esac
  done
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
  case "${AGENT_RUN_SEMANTIC_EVENT_MIGRATION}" in
    "${REPO_ROOT}"/*) ;;
    *) echo "[bootstrap-kk-vps] Agent Run semantic event migration must stay inside ${REPO_ROOT}." >&2; exit 1 ;;
  esac
  case "${AGENT_RUN_REPLAN_EVENT_MIGRATION}" in
    "${REPO_ROOT}"/*) ;;
    *) echo "[bootstrap-kk-vps] Agent Run replan event migration must stay inside ${REPO_ROOT}." >&2; exit 1 ;;
  esac
  case "${OAUTH_IDENTITY_MIGRATION}" in
    "${REPO_ROOT}"/*) ;;
    *) echo "[bootstrap-kk-vps] OAuth identity migration must stay inside ${REPO_ROOT}." >&2; exit 1 ;;
  esac
  case "${PAYMENT_RECHARGE_MIGRATION}" in
    "${REPO_ROOT}"/*) ;;
    *) echo "[bootstrap-kk-vps] Payment recharge migration must stay inside ${REPO_ROOT}." >&2; exit 1 ;;
  esac
  case "${PAYMENT_RECHARGE_HARDENING_MIGRATION}" in
    "${REPO_ROOT}"/*) ;;
    *) echo "[bootstrap-kk-vps] Payment recharge hardening migration must stay inside ${REPO_ROOT}." >&2; exit 1 ;;
  esac
  for runtime_migration in \
    "${PROVIDER_ROUTING_PRIORITY_MIGRATION}" \
    "${PAIRED_RUNTIMES_MIGRATION}" \
    "${AGENT_EXTENSIONS_MIGRATION}" \
    "${AGENT_COORDINATION_MIGRATION}"; do
    case "${runtime_migration}" in
      "${REPO_ROOT}"/*) ;;
      *) echo "[bootstrap-kk-vps] Runtime capability migrations must stay inside ${REPO_ROOT}." >&2; exit 1 ;;
    esac
  done

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
    -f "${STRICT_BILLING_SCHEMA_MIGRATION}" \
    -f "${CREDIT_DEFAULT_MIGRATION}" \
    -f "${ADMIN_CREDITS_MIGRATION}" \
    -f "${ADMIN_LEVEL_CONSTRAINT_MIGRATION}" \
    -f "${ORDERS_CONSTRAINT_MIGRATION}" \
    -f "${AI_ASSISTANT_SCOPE_MIGRATION}" \
    -f "${AGENT_RUN_EVENT_MIGRATION}" \
    -f "${AGENT_SESSION_MIGRATION}" \
    -f "${AGENT_RUN_SESSION_BINDING_MIGRATION}" \
    -f "${AGENT_RUN_SEMANTIC_EVENT_MIGRATION}" \
    -f "${AGENT_RUN_REPLAN_EVENT_MIGRATION}" \
    -f "${OAUTH_IDENTITY_MIGRATION}" \
    -f "${PAYMENT_RECHARGE_MIGRATION}" \
    -f "${PAYMENT_RECHARGE_HARDENING_MIGRATION}" \
    -f "${PROVIDER_ROUTING_PRIORITY_MIGRATION}" \
    -f "${PAIRED_RUNTIMES_MIGRATION}" \
    -f "${AGENT_EXTENSIONS_MIGRATION}" \
    -f "${AGENT_COORDINATION_MIGRATION}"
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
