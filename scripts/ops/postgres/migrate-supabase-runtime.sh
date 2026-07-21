#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${1:-${REPO_ROOT}/scripts/postgres/runtime-migration.env}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[migrate-supabase-runtime] Missing env file: ${ENV_FILE}" >&2
  exit 1
fi

"${SCRIPT_DIR}/export-supabase-runtime.sh" "${ENV_FILE}"
"${SCRIPT_DIR}/import-runtime-into-vps.sh" "${ENV_FILE}"

echo "[migrate-supabase-runtime] Runtime migration finished."
