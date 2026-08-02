#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
ENV_FILE="${1:-${REPO_ROOT}/scripts/ops/postgres/runtime-migration.env}"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-}"
EXPORT_ROOT="${EXPORT_ROOT:-${REPO_ROOT}/.tmp-postgres-migration}"
BOOTSTRAP_SQL="${BOOTSTRAP_SQL:-${REPO_ROOT}/scripts/ops/postgres/bootstrap-kk-vps.sql}"
STRICT_BILLING_SCHEMA_MIGRATION="${STRICT_BILLING_SCHEMA_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/003_strict_agents_schema.sql}"
CREDIT_DEFAULT_MIGRATION="${CREDIT_DEFAULT_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/005_remove_default_credits.sql}"
ADMIN_CREDITS_MIGRATION="${ADMIN_CREDITS_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/006_admin_credits_contract.sql}"
ADMIN_LEVEL_CONSTRAINT_MIGRATION="${ADMIN_LEVEL_CONSTRAINT_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/009_admin_level_check_constraint.sql}"
ORDERS_CONSTRAINT_MIGRATION="${ORDERS_CONSTRAINT_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/010_orders_positive_credits_constraint.sql}"
AI_ASSISTANT_SCOPE_MIGRATION="${AI_ASSISTANT_SCOPE_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/016_ai_assistant_user_scope.sql}"
AGENT_RUN_EVENT_MIGRATION="${AGENT_RUN_EVENT_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/020_agent_run_events.sql}"
AGENT_SESSION_MIGRATION="${AGENT_SESSION_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/021_agent_sessions.sql}"
AGENT_RUN_SESSION_BINDING_MIGRATION="${AGENT_RUN_SESSION_BINDING_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/022_agent_run_session_binding.sql}"
AGENT_RUN_SEMANTIC_EVENT_MIGRATION="${AGENT_RUN_SEMANTIC_EVENT_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/023_agent_run_semantic_events.sql}"
AGENT_RUN_REPLAN_EVENT_MIGRATION="${AGENT_RUN_REPLAN_EVENT_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/024_agent_run_replan_events.sql}"
OAUTH_IDENTITY_MIGRATION="${OAUTH_IDENTITY_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/026_oauth_identities.sql}"
PAYMENT_RECHARGE_MIGRATION="${PAYMENT_RECHARGE_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/027_payment_recharge_integrity.sql}"
PAYMENT_RECHARGE_HARDENING_MIGRATION="${PAYMENT_RECHARGE_HARDENING_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/028_payment_recharge_hardening.sql}"
PROVIDER_ROUTING_PRIORITY_MIGRATION="${PROVIDER_ROUTING_PRIORITY_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/029_provider_connection_routing_priority.sql}"
PAIRED_RUNTIMES_MIGRATION="${PAIRED_RUNTIMES_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/030_paired_runtimes.sql}"
AGENT_EXTENSIONS_MIGRATION="${AGENT_EXTENSIONS_MIGRATION:-${REPO_ROOT}/infrastructure/database/migrations/031_agent_extensions.sql}"
RUNTIME_SQL="${EXPORT_ROOT}/runtime-data.sql"
RUNTIME_SCHEMA_SQL="${EXPORT_ROOT}/runtime-schema.sql"

if [[ -z "${TARGET_DATABASE_URL}" ]]; then
  echo "[import-runtime-into-vps] TARGET_DATABASE_URL is required." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[import-runtime-into-vps] psql is required." >&2
  exit 1
fi

if [[ ! -f "${BOOTSTRAP_SQL}" ]]; then
  echo "[import-runtime-into-vps] Missing bootstrap SQL: ${BOOTSTRAP_SQL}" >&2
  exit 1
fi

for prerequisite_migration in \
  "${STRICT_BILLING_SCHEMA_MIGRATION}" \
  "${CREDIT_DEFAULT_MIGRATION}" \
  "${ADMIN_CREDITS_MIGRATION}" \
  "${ADMIN_LEVEL_CONSTRAINT_MIGRATION}" \
  "${ORDERS_CONSTRAINT_MIGRATION}"; do
  if [[ ! -f "${prerequisite_migration}" ]]; then
    echo "[import-runtime-into-vps] Missing billing prerequisite migration: ${prerequisite_migration}" >&2
    exit 1
  fi
done

if [[ ! -f "${AI_ASSISTANT_SCOPE_MIGRATION}" ]]; then
  echo "[import-runtime-into-vps] Missing AI assistant scope migration: ${AI_ASSISTANT_SCOPE_MIGRATION}" >&2
  exit 1
fi

if [[ ! -f "${AGENT_RUN_EVENT_MIGRATION}" ]]; then
  echo "[import-runtime-into-vps] Missing Agent Run event migration: ${AGENT_RUN_EVENT_MIGRATION}" >&2
  exit 1
fi

if [[ ! -f "${AGENT_SESSION_MIGRATION}" ]]; then
  echo "[import-runtime-into-vps] Missing Agent Session migration: ${AGENT_SESSION_MIGRATION}" >&2
  exit 1
fi

if [[ ! -f "${AGENT_RUN_SESSION_BINDING_MIGRATION}" ]]; then
  echo "[import-runtime-into-vps] Missing Agent Run Session binding migration: ${AGENT_RUN_SESSION_BINDING_MIGRATION}" >&2
  exit 1
fi

if [[ ! -f "${AGENT_RUN_SEMANTIC_EVENT_MIGRATION}" ]]; then
  echo "[import-runtime-into-vps] Missing Agent Run semantic event migration: ${AGENT_RUN_SEMANTIC_EVENT_MIGRATION}" >&2
  exit 1
fi

if [[ ! -f "${AGENT_RUN_REPLAN_EVENT_MIGRATION}" ]]; then
  echo "[import-runtime-into-vps] Missing Agent Run replan event migration: ${AGENT_RUN_REPLAN_EVENT_MIGRATION}" >&2
  exit 1
fi

if [[ ! -f "${OAUTH_IDENTITY_MIGRATION}" ]]; then
  echo "[import-runtime-into-vps] Missing OAuth identity migration: ${OAUTH_IDENTITY_MIGRATION}" >&2
  exit 1
fi

if [[ ! -f "${PAYMENT_RECHARGE_MIGRATION}" ]]; then
  echo "[import-runtime-into-vps] Missing payment recharge migration: ${PAYMENT_RECHARGE_MIGRATION}" >&2
  exit 1
fi

if [[ ! -f "${PAYMENT_RECHARGE_HARDENING_MIGRATION}" ]]; then
  echo "[import-runtime-into-vps] Missing payment recharge hardening migration: ${PAYMENT_RECHARGE_HARDENING_MIGRATION}" >&2
  exit 1
fi

for runtime_migration in \
  "${PROVIDER_ROUTING_PRIORITY_MIGRATION}" \
  "${PAIRED_RUNTIMES_MIGRATION}" \
  "${AGENT_EXTENSIONS_MIGRATION}"; do
  if [[ ! -f "${runtime_migration}" ]]; then
    echo "[import-runtime-into-vps] Missing runtime capability migration: ${runtime_migration}" >&2
    exit 1
  fi
done

if [[ ! -f "${RUNTIME_SQL}" ]]; then
  echo "[import-runtime-into-vps] Missing export file: ${RUNTIME_SQL}" >&2
  exit 1
fi

if [[ ! -f "${RUNTIME_SCHEMA_SQL}" ]]; then
  echo "[import-runtime-into-vps] Missing export schema file: ${RUNTIME_SCHEMA_SQL}" >&2
  exit 1
fi

echo "[import-runtime-into-vps] Applying bootstrap schema"
psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${BOOTSTRAP_SQL}"

echo "[import-runtime-into-vps] Applying strict billing prerequisite migrations"
for prerequisite_migration in \
  "${STRICT_BILLING_SCHEMA_MIGRATION}" \
  "${CREDIT_DEFAULT_MIGRATION}" \
  "${ADMIN_CREDITS_MIGRATION}" \
  "${ADMIN_LEVEL_CONSTRAINT_MIGRATION}" \
  "${ORDERS_CONSTRAINT_MIGRATION}"; do
  psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${prerequisite_migration}"
done

echo "[import-runtime-into-vps] Applying mandatory AI assistant user-scope migration"
psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${AI_ASSISTANT_SCOPE_MIGRATION}"

echo "[import-runtime-into-vps] Applying mandatory Agent Run event migration"
psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${AGENT_RUN_EVENT_MIGRATION}"

echo "[import-runtime-into-vps] Applying mandatory Agent Session migration"
psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${AGENT_SESSION_MIGRATION}"

echo "[import-runtime-into-vps] Applying mandatory Agent Run Session binding migration"
psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${AGENT_RUN_SESSION_BINDING_MIGRATION}"

echo "[import-runtime-into-vps] Applying mandatory Agent Run semantic event migration"
psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${AGENT_RUN_SEMANTIC_EVENT_MIGRATION}"

echo "[import-runtime-into-vps] Applying mandatory Agent Run replan event migration"
psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${AGENT_RUN_REPLAN_EVENT_MIGRATION}"

echo "[import-runtime-into-vps] Applying mandatory OAuth identity migration"
psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${OAUTH_IDENTITY_MIGRATION}"

echo "[import-runtime-into-vps] Applying mandatory payment recharge integrity migration"
psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${PAYMENT_RECHARGE_MIGRATION}"

echo "[import-runtime-into-vps] Runtime schema snapshot retained for audit only; canonical bootstrap and migrations own the target schema"

echo "[import-runtime-into-vps] Importing exported runtime data"
psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${RUNTIME_SQL}"

echo "[import-runtime-into-vps] Applying mandatory payment recharge hardening migration"
psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${PAYMENT_RECHARGE_HARDENING_MIGRATION}"

echo "[import-runtime-into-vps] Applying provider routing, paired runtime and agent extension migrations"
for runtime_migration in \
  "${PROVIDER_ROUTING_PRIORITY_MIGRATION}" \
  "${PAIRED_RUNTIMES_MIGRATION}" \
  "${AGENT_EXTENSIONS_MIGRATION}"; do
  psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${runtime_migration}"
done

echo "[import-runtime-into-vps] Import complete."
