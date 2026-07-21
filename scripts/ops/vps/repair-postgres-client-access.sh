#!/usr/bin/env bash
set -euo pipefail

POSTGRES_DB="${KK_PG_DB:-kkstudio}"
POSTGRES_USER="${KK_PG_USER:-kkstudio_app}"
POSTGRES_SUPERUSER="${KK_PG_SUPERUSER:-postgres}"
CLIENT_CIDR="${KK_PG_CLIENT_CIDR:-}"
HBA_AUTH_METHOD="${KK_PG_HBA_AUTH_METHOD:-scram-sha-256}"
DRY_RUN="${KK_PG_CLIENT_ACCESS_DRY_RUN:-true}"

if [[ "${KK_APPLY_PG_CLIENT_ACCESS:-false}" == "true" ]]; then
  DRY_RUN="false"
fi

die() {
  echo "[repair-postgres-client-access] $*" >&2
  exit 1
}

psql_as_superuser() {
  su - "${POSTGRES_SUPERUSER}" -c "psql $*"
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Please run as root on the VPS."
  fi
}

validate_inputs() {
  [[ -n "${CLIENT_CIDR}" ]] || die "KK_PG_CLIENT_CIDR is required, for example 203.0.113.10/32."
  [[ "${CLIENT_CIDR}" == */* ]] || die "KK_PG_CLIENT_CIDR must be a CIDR range, not a bare IP."
  [[ "${POSTGRES_DB}" =~ ^[A-Za-z0-9_,.-]+$ ]] || die "KK_PG_DB contains unsupported characters."
  [[ "${POSTGRES_USER}" =~ ^[A-Za-z0-9_,.-]+$ ]] || die "KK_PG_USER contains unsupported characters."
  [[ "${HBA_AUTH_METHOD}" =~ ^[A-Za-z0-9_-]+$ ]] || die "KK_PG_HBA_AUTH_METHOD contains unsupported characters."
}

resolve_hba_file() {
  local hba_file
  hba_file="$(psql_as_superuser "-Atc 'show hba_file;'")"
  [[ -n "${hba_file}" ]] || die "PostgreSQL did not report hba_file."
  [[ -f "${hba_file}" ]] || die "pg_hba.conf not found at ${hba_file}."
  echo "${hba_file}"
}

print_current_rules() {
  echo "[repair-postgres-client-access] Current matching pg_hba rules:"
  psql_as_superuser "-Atc \"select line_number || ':' || type || ':' || database::text || ':' || user_name::text || ':' || coalesce(address, '') || ':' || auth_method || ':' || coalesce(error, '') from pg_hba_file_rules where database::text like '%${POSTGRES_DB}%' or user_name::text like '%${POSTGRES_USER}%' order by line_number;\"" || true
}

append_hba_rule() {
  local hba_file="$1"
  local hba_rule="hostssl ${POSTGRES_DB} ${POSTGRES_USER} ${CLIENT_CIDR} ${HBA_AUTH_METHOD}"
  local backup_file="${hba_file}.kkstudio.$(date -u +%Y%m%d%H%M%S).bak"

  echo "[repair-postgres-client-access] Target hba_file: ${hba_file}"
  echo "[repair-postgres-client-access] Proposed rule: ${hba_rule}"

  if grep -Fqx "${hba_rule}" "${hba_file}"; then
    echo "[repair-postgres-client-access] Rule already exists. Nothing to append."
    return
  fi

  if [[ "${DRY_RUN}" != "false" ]]; then
    echo "[repair-postgres-client-access] Dry run only. Set KK_APPLY_PG_CLIENT_ACCESS=true to append and reload."
    return
  fi

  cp -p "${HBA_FILE}" "${backup_file}"
  {
    echo ""
    echo "# KK Studio login/API PostgreSQL client access. Added $(date -u +%Y-%m-%dT%H:%M:%SZ)."
    echo "${hba_rule}"
  } >>"${hba_file}"
  echo "[repair-postgres-client-access] Backup written to ${backup_file}"
}

reload_postgres() {
  if [[ "${DRY_RUN}" != "false" ]]; then
    return
  fi

  psql_as_superuser "-v ON_ERROR_STOP=1 -c 'select pg_reload_conf();'"
  echo "[repair-postgres-client-access] PostgreSQL configuration reloaded."
}

require_root
validate_inputs
HBA_FILE="$(resolve_hba_file)"
print_current_rules
append_hba_rule "${HBA_FILE}"
reload_postgres
print_current_rules
