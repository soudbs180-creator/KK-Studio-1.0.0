#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${1:-${REPO_ROOT}/scripts/postgres/runtime-migration.env}"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-}"
EXPORT_ROOT="${EXPORT_ROOT:-${REPO_ROOT}/.tmp-postgres-migration}"
BOOTSTRAP_SQL="${BOOTSTRAP_SQL:-${REPO_ROOT}/scripts/postgres/bootstrap-kk-vps.sql}"
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

echo "[import-runtime-into-vps] Applying exported runtime schema snapshot"
psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${RUNTIME_SCHEMA_SQL}"

echo "[import-runtime-into-vps] Importing exported runtime data"
psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${RUNTIME_SQL}"

echo "[import-runtime-into-vps] Import complete."
