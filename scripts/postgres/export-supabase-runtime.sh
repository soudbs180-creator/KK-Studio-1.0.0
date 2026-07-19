#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${1:-${REPO_ROOT}/scripts/postgres/runtime-migration.env}"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

SUPABASE_DB_URL="${SUPABASE_DB_URL:-}"
SOURCE_DATABASE_LABEL="${SOURCE_DATABASE_LABEL:-supabase-runtime}"
EXPORT_ROOT="${EXPORT_ROOT:-${REPO_ROOT}/.tmp-postgres-migration}"
TABLES="${TABLES:-profiles,temp_users,external_identities,admin_auth,admin_sessions,user_credits,credit_exchange_rates,credit_transactions,generation_tasks,workflow_documents,workspace_layouts,workspace_cloud_images,admin_credit_models,provider_pricing_cache,payment_orders,payment_callbacks}"

if [[ -z "${SUPABASE_DB_URL}" ]]; then
  echo "[export-supabase-runtime] SUPABASE_DB_URL is required." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "[export-supabase-runtime] pg_dump is required." >&2
  exit 1
fi

mkdir -p "${EXPORT_ROOT}"

IFS=',' read -r -a TABLE_ARRAY <<< "${TABLES}"
TABLE_ARGS=()
for table in "${TABLE_ARRAY[@]}"; do
  trimmed_table="$(echo "${table}" | xargs)"
  if [[ -n "${trimmed_table}" ]]; then
    TABLE_ARGS+=(--table "public.${trimmed_table}")
  fi
done

echo "[export-supabase-runtime] Exporting runtime tables into ${EXPORT_ROOT}"
pg_dump \
  --schema-only \
  --no-owner \
  --no-privileges \
  "${TABLE_ARGS[@]}" \
  --file "${EXPORT_ROOT}/runtime-schema.sql" \
  "${SUPABASE_DB_URL}"

pg_dump \
  --data-only \
  --inserts \
  --column-inserts \
  --no-owner \
  --no-privileges \
  "${TABLE_ARGS[@]}" \
  --file "${EXPORT_ROOT}/runtime-data.sql" \
  "${SUPABASE_DB_URL}"

printf '%s\n' "${TABLE_ARRAY[@]}" > "${EXPORT_ROOT}/runtime-table-order.txt"

cat > "${EXPORT_ROOT}/runtime-manifest.json" <<EOF
{
  "sourceKind": "${SOURCE_DATABASE_LABEL}",
  "tableCount": ${#TABLE_ARRAY[@]},
  "tables": [
$(printf '    "%s"%s\n' "${TABLE_ARRAY[@]}" "" | sed '$!s/$/,/')
  ],
  "artifacts": [
    "runtime-schema.sql",
    "runtime-data.sql",
    "runtime-table-order.txt",
    "README.txt"
  ]
}
EOF

cat > "${EXPORT_ROOT}/README.txt" <<EOF
Supabase runtime export

Source kind:
  ${SOURCE_DATABASE_LABEL}

Credentials:
  Intentionally omitted. The source URL is accepted only through the process environment.

Tables:
  ${TABLES}

Artifacts:
  runtime-schema.sql
  runtime-data.sql
  runtime-table-order.txt
  runtime-manifest.json
EOF

echo "[export-supabase-runtime] Export complete."
