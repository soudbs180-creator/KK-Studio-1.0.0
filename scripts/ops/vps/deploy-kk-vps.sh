#!/usr/bin/env bash
set -Eeuo pipefail

APP_USER="${KK_APP_USER:-kkstudio}"
APP_GROUP="${KK_APP_GROUP:-$APP_USER}"
APP_ROOT="${KK_APP_ROOT:-/opt/kk-studio}"
CURRENT_DIR="${KK_CURRENT_DIR:-$APP_ROOT/current}"
ENV_DIR="${KK_ENV_DIR:-/etc/kk-studio}"
APP_SITE_ROOT="${KK_APP_SITE_ROOT:-/var/www/kk-app}"
WEB_ENV_FILE="${KK_WEB_ENV_FILE:-$ENV_DIR/kk-web.env}"
API_ENV_FILE="${KK_API_ENV_FILE:-$ENV_DIR/kk-api.env}"
APPLY_BOOTSTRAP_SQL="${KK_APPLY_BOOTSTRAP_SQL:-false}"
BOOTSTRAP_SQL_PATH="${KK_BOOTSTRAP_SQL:-scripts/ops/postgres/bootstrap-kk-vps.sql}"
AI_ASSISTANT_SCOPE_MIGRATION_PATH="${KK_AI_ASSISTANT_SCOPE_MIGRATION:-infrastructure/database/migrations/016_ai_assistant_user_scope.sql}"
AGENT_RUN_EVENT_MIGRATION_PATH="${KK_AGENT_RUN_EVENT_MIGRATION:-infrastructure/database/migrations/020_agent_run_events.sql}"
AGENT_SESSION_MIGRATION_PATH="${KK_AGENT_SESSION_MIGRATION:-infrastructure/database/migrations/021_agent_sessions.sql}"
AGENT_RUN_SESSION_BINDING_MIGRATION_PATH="${KK_AGENT_RUN_SESSION_BINDING_MIGRATION:-infrastructure/database/migrations/022_agent_run_session_binding.sql}"
AGENT_RUN_SEMANTIC_EVENT_MIGRATION_PATH="${KK_AGENT_RUN_SEMANTIC_EVENT_MIGRATION:-infrastructure/database/migrations/023_agent_run_semantic_events.sql}"
AGENT_RUN_REPLAN_EVENT_MIGRATION_PATH="${KK_AGENT_RUN_REPLAN_EVENT_MIGRATION:-infrastructure/database/migrations/024_agent_run_replan_events.sql}"
OAUTH_IDENTITY_MIGRATION_PATH="${KK_OAUTH_IDENTITY_MIGRATION:-infrastructure/database/migrations/026_oauth_identities.sql}"
PAYMENT_RECHARGE_MIGRATION_PATH="${KK_PAYMENT_RECHARGE_MIGRATION:-infrastructure/database/migrations/027_payment_recharge_integrity.sql}"
SYSTEMD_SERVICES=("kk-api")

# 准备版本发布所需的目录
RELEASES_DIR="${APP_ROOT}/releases"
APP_RELEASES_DIR="/var/www/releases/app"

TIMESTAMP="$(date +%Y%m%d%H%M%S)"
COMMIT_SHA=""
COMMIT_SHORT_SHA=""
RELEASE_NAME=""
RUNTIME_DATABASE_URL=""
MIGRATION_DATABASE_URL=""
RUNTIME_DATABASE_USER=""

NEW_RELEASE_DIR=""
NEW_APP_RELEASE_DIR=""

# 备份原先的软链接指向，用以部署失败时回退
PREV_CURRENT=""
PREV_APP=""
SCHEMA_CUTOVER_APPLIED=false
SCHEMA_MIGRATION_ATTEMPTED=false
API_SERVICES_STOPPED_FOR_SCHEMA_CUTOVER=false
ACTIVE_API_SERVICES_BEFORE_CUTOVER=()

require_repo_root() {
  if [[ ! -f package.json || ! -d apps/web ]]; then
    echo "[deploy-kk-vps] Run this script from the repository root." >&2
    exit 1
  fi
}

require_clean_git_release() {
  if ! command -v git >/dev/null 2>&1; then
    echo "[deploy-kk-vps] git is required to create an attributable release." >&2
    exit 1
  fi
  COMMIT_SHA="$(git rev-parse --verify HEAD 2>/dev/null || true)"
  if [[ ! "${COMMIT_SHA}" =~ ^[0-9a-fA-F]{40}$ ]]; then
    echo "[deploy-kk-vps] Unable to resolve a full 40-character Git commit SHA." >&2
    exit 1
  fi
  if [[ -n "$(git status --porcelain --untracked-files=all)" ]]; then
    echo "[deploy-kk-vps] Refusing to deploy a dirty worktree; commit or remove every tracked and untracked change first." >&2
    exit 1
  fi
  COMMIT_SHA="${COMMIT_SHA,,}"
  COMMIT_SHORT_SHA="${COMMIT_SHA:0:7}"
  RELEASE_NAME="${TIMESTAMP}-${COMMIT_SHORT_SHA}"
  NEW_RELEASE_DIR="${RELEASES_DIR}/release-${RELEASE_NAME}"
  NEW_APP_RELEASE_DIR="${APP_RELEASES_DIR}/kk-app-${RELEASE_NAME}"
}

read_env_value() {
  local env_file="$1"
  local key="$2"
  local value
  value="$(sed -n "s/^${key}=//p" "${env_file}" | tail -n 1)"
  value="${value%$'\r'}"
  if [[ "${value}" == \"*\" && "${value}" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "${value}" == \'*\' && "${value}" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "${value}"
}

require_runtime_database_target() {
  if ! command -v psql >/dev/null 2>&1; then
    echo "[deploy-kk-vps] psql is required for mandatory schema migration." >&2
    exit 1
  fi
  if [[ ! -f "${API_ENV_FILE}" ]]; then
    echo "[deploy-kk-vps] Runtime API environment file not found: ${API_ENV_FILE}" >&2
    exit 1
  fi
  RUNTIME_DATABASE_URL="$(read_env_value "${API_ENV_FILE}" DATABASE_URL)"
  if [[ ! "${RUNTIME_DATABASE_URL}" =~ ^postgres(ql)?:// ]]; then
    echo "[deploy-kk-vps] DATABASE_URL in ${API_ENV_FILE} is missing or is not a PostgreSQL URL." >&2
    exit 1
  fi
  if ! psql "${RUNTIME_DATABASE_URL}" -v ON_ERROR_STOP=1 -Atqc 'SELECT 1' >/dev/null; then
    echo "[deploy-kk-vps] Cannot connect to the exact DATABASE_URL used by kk-api.service." >&2
    exit 1
  fi
  MIGRATION_DATABASE_URL="${KK_MIGRATION_DATABASE_URL:-${RUNTIME_DATABASE_URL}}"
  if [[ ! "${MIGRATION_DATABASE_URL}" =~ ^postgres(ql)?:// ]]; then
    echo "[deploy-kk-vps] KK_MIGRATION_DATABASE_URL is not a PostgreSQL URL." >&2
    exit 1
  fi

  local runtime_identity migration_identity authority_probe missing_count unauthorized_count version_missing event_table_missing session_tables_missing can_create_schema is_superuser
  runtime_identity="$(psql "${RUNTIME_DATABASE_URL}" -v ON_ERROR_STOP=1 -Atqc "SELECT current_database() || '|' || coalesce(inet_server_addr()::text, 'local-socket') || '|' || coalesce(inet_server_port()::text, 'default')")"
  migration_identity="$(psql "${MIGRATION_DATABASE_URL}" -v ON_ERROR_STOP=1 -Atqc "SELECT current_database() || '|' || coalesce(inet_server_addr()::text, 'local-socket') || '|' || coalesce(inet_server_port()::text, 'default')")"
  if [[ -z "${runtime_identity}" || "${runtime_identity}" != "${migration_identity}" ]]; then
    echo "[deploy-kk-vps] Runtime and migration credentials do not resolve to the same PostgreSQL database endpoint." >&2
    exit 1
  fi
  RUNTIME_DATABASE_USER="$(psql "${RUNTIME_DATABASE_URL}" -v ON_ERROR_STOP=1 -Atqc 'SELECT current_user')"
  if [[ -z "${RUNTIME_DATABASE_USER}" ]]; then
    echo "[deploy-kk-vps] Could not resolve the kk-api runtime database role." >&2
    exit 1
  fi

  authority_probe="$(psql "${MIGRATION_DATABASE_URL}" -v ON_ERROR_STOP=1 -AtF '|' -qc "
    WITH targets(name, required_before_migration) AS (VALUES
      ('agent_runs', true), ('agent_tool_calls', true), ('agent_memory', true),
      ('knowledge_documents', true), ('knowledge_chunks', true),
      ('canvas_runtime_snapshots', true), ('agent_skills', true),
      ('agent_run_events', false), ('agent_sessions', false),
      ('agent_context_snapshots', false)
    ), relations AS (
      SELECT target.name, target.required_before_migration, class.oid, class.relowner
      FROM targets AS target
      LEFT JOIN pg_class AS class
        ON class.oid = to_regclass('public.' || target.name)
    )
    SELECT
      count(*) FILTER (WHERE oid IS NULL AND required_before_migration),
      count(*) FILTER (
        WHERE oid IS NOT NULL
          AND NOT pg_has_role(current_user, relowner, 'USAGE')
          AND NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user)
      ),
      CASE WHEN to_regclass('public.agent_skill_versions') IS NULL THEN 1 ELSE 0 END,
      CASE WHEN to_regclass('public.agent_run_events') IS NULL THEN 1 ELSE 0 END,
      count(*) FILTER (
        WHERE name IN ('agent_sessions', 'agent_context_snapshots') AND oid IS NULL
      ),
      has_schema_privilege(current_user, 'public', 'CREATE'),
      (SELECT rolsuper FROM pg_roles WHERE rolname = current_user)
    FROM relations
  ")"
  IFS='|' read -r missing_count unauthorized_count version_missing event_table_missing session_tables_missing can_create_schema is_superuser <<< "${authority_probe}"
  if [[ "${unauthorized_count}" != "0" ]]; then
    echo "[deploy-kk-vps] Migration role does not own or inherit ownership for every existing AI assistant table." >&2
    exit 1
  fi
  if [[ "${missing_count}" != "0" && "${APPLY_BOOTSTRAP_SQL}" != "true" ]]; then
    echo "[deploy-kk-vps] Required AI tables are missing and KK_APPLY_BOOTSTRAP_SQL is not enabled." >&2
    exit 1
  fi
  if [[ "${version_missing}" != "0" && "${can_create_schema}" != "t" ]]; then
    echo "[deploy-kk-vps] Migration role cannot create agent_skill_versions in the public schema." >&2
    exit 1
  fi
  if [[ "${event_table_missing}" != "0" && "${can_create_schema}" != "t" ]]; then
    echo "[deploy-kk-vps] Migration role cannot create agent_run_events in the public schema." >&2
    exit 1
  fi
  if [[ "${session_tables_missing}" != "0" && "${can_create_schema}" != "t" ]]; then
    echo "[deploy-kk-vps] Migration role cannot create Agent Session tables in the public schema." >&2
    exit 1
  fi
  if [[ "${APPLY_BOOTSTRAP_SQL}" == "true" && "${is_superuser}" != "t" ]]; then
    echo "[deploy-kk-vps] Full bootstrap during deploy requires an explicit superuser migration credential." >&2
    exit 1
  fi
}

verify_preflight_changes() {
  echo "[deploy-kk-vps] Running pre-deployment build verification and quality gates..."
  if ! npm run verify:changes; then
    echo "[deploy-kk-vps] ERROR: Pre-deployment change verification (npm run verify:changes) failed. Aborting." >&2
    exit 1
  fi
  echo "[deploy-kk-vps] Pre-deployment verification passed."
}

# 部署出错时的自动化回滚逻辑
on_error() {
  local error_line="$1"
  local exit_code="$2"
  echo "[deploy-kk-vps] CRITICAL: An error occurred near line ${error_line}. Exit code: ${exit_code}." >&2

  if [[ "${SCHEMA_CUTOVER_APPLIED}" == "true" ]]; then
    echo "[deploy-kk-vps] Database schema cutover already completed; refusing to restart or restore the previous release." >&2
    echo "[deploy-kk-vps] Keep the compatible release selected (if switched) and repair/restart it manually." >&2
    return
  fi

  if [[ "${SCHEMA_MIGRATION_ATTEMPTED}" == "true" ]]; then
    echo "[deploy-kk-vps] Database migration was attempted and its commit outcome may be unknown; refusing to restart the previous release." >&2
    echo "[deploy-kk-vps] Verify schemas 016, 020, 021, 022, 023, 024, 026 and 027 manually before selecting and starting a compatible release." >&2
    return
  fi
  
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
    
    echo "[deploy-kk-vps] Rollback process completed." >&2
  fi

  if [[ "${API_SERVICES_STOPPED_FOR_SCHEMA_CUTOVER}" == "true" ]]; then
    echo "[deploy-kk-vps] Schema migration did not complete; restarting the unchanged API release." >&2
    systemctl daemon-reload || true
    for service in "${ACTIVE_API_SERVICES_BEFORE_CUTOVER[@]}"; do
      systemctl restart "${service}" || true
    done
  fi
}

# EXIT 同时覆盖命令失败与脚本中的显式 exit；进入 handler 前先移除 trap，避免恢复失败递归触发。
on_exit() {
  local exit_code=$?
  local error_line="${BASH_LINENO[0]:-${LINENO}}"
  if [[ "${exit_code}" -eq 0 ]]; then
    return
  fi
  trap - EXIT
  on_error "${error_line}" "${exit_code}"
  exit "${exit_code}"
}

trap on_exit EXIT

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
  run_npm_script_in_release "KK_STUDIO_COMMIT_SHA='${COMMIT_SHA}' npm run build" "${WEB_ENV_FILE}"
  
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
  if [[ -f "${API_ENV_FILE}" ]]; then
    chgrp "${APP_GROUP}" "${API_ENV_FILE}"
    chmod 0640 "${API_ENV_FILE}"
  fi
}

stop_api_services_for_schema_cutover() {
  echo "[deploy-kk-vps] Stopping API services for the database schema cutover..."
  API_SERVICES_STOPPED_FOR_SCHEMA_CUTOVER=true
  for service in "${SYSTEMD_SERVICES[@]}"; do
    local unit_listing
    if ! unit_listing="$(systemctl list-unit-files "${service}.service" --no-legend --no-pager)"; then
      echo "[deploy-kk-vps] ERROR: Failed to query systemd unit ${service}.service before schema cutover." >&2
      return 1
    fi
    if ! grep -q "^${service}\\.service" <<<"${unit_listing}"; then
      echo "[deploy-kk-vps] Skipping missing optional service: ${service}"
      continue
    fi

    local active_state
    if ! active_state="$(systemctl show "${service}.service" --property=ActiveState --value)"; then
      echo "[deploy-kk-vps] ERROR: Failed to read ActiveState for ${service}.service before schema cutover." >&2
      return 1
    fi
    case "${active_state}" in
      active|activating|reloading|refreshing)
        ACTIVE_API_SERVICES_BEFORE_CUTOVER+=("${service}")
        ;;
      inactive|failed|deactivating)
        echo "[deploy-kk-vps] Service already inactive before cutover: ${service}"
        ;;
      *)
        echo "[deploy-kk-vps] ERROR: Unexpected ActiveState '${active_state}' for ${service}.service." >&2
        return 1
        ;;
    esac

    if ! systemctl stop "${service}"; then
      echo "[deploy-kk-vps] ERROR: Failed to stop ${service}.service before schema cutover." >&2
      return 1
    fi
  done
}

verify_database_migration_inputs() {
  if [[ "${APPLY_BOOTSTRAP_SQL}" == "true" && ! -f "${NEW_RELEASE_DIR}/${BOOTSTRAP_SQL_PATH}" ]]; then
    echo "[deploy-kk-vps] Bootstrap SQL not found at ${NEW_RELEASE_DIR}/${BOOTSTRAP_SQL_PATH}" >&2
    exit 1
  fi
  if [[ ! -f "${NEW_RELEASE_DIR}/${AI_ASSISTANT_SCOPE_MIGRATION_PATH}" ]]; then
    echo "[deploy-kk-vps] AI assistant scope migration not found at ${NEW_RELEASE_DIR}/${AI_ASSISTANT_SCOPE_MIGRATION_PATH}" >&2
    exit 1
  fi
  if [[ ! -f "${NEW_RELEASE_DIR}/${AGENT_RUN_EVENT_MIGRATION_PATH}" ]]; then
    echo "[deploy-kk-vps] Agent Run event migration not found at ${NEW_RELEASE_DIR}/${AGENT_RUN_EVENT_MIGRATION_PATH}" >&2
    exit 1
  fi
  if [[ ! -f "${NEW_RELEASE_DIR}/${AGENT_SESSION_MIGRATION_PATH}" ]]; then
    echo "[deploy-kk-vps] Agent Session migration not found at ${NEW_RELEASE_DIR}/${AGENT_SESSION_MIGRATION_PATH}" >&2
    exit 1
  fi
  if [[ ! -f "${NEW_RELEASE_DIR}/${AGENT_RUN_SESSION_BINDING_MIGRATION_PATH}" ]]; then
    echo "[deploy-kk-vps] Agent Run Session binding migration not found at ${NEW_RELEASE_DIR}/${AGENT_RUN_SESSION_BINDING_MIGRATION_PATH}" >&2
    exit 1
  fi
  if [[ ! -f "${NEW_RELEASE_DIR}/${AGENT_RUN_SEMANTIC_EVENT_MIGRATION_PATH}" ]]; then
    echo "[deploy-kk-vps] Agent Run semantic event migration not found at ${NEW_RELEASE_DIR}/${AGENT_RUN_SEMANTIC_EVENT_MIGRATION_PATH}" >&2
    exit 1
  fi
  if [[ ! -f "${NEW_RELEASE_DIR}/${AGENT_RUN_REPLAN_EVENT_MIGRATION_PATH}" ]]; then
    echo "[deploy-kk-vps] Agent Run replan event migration not found at ${NEW_RELEASE_DIR}/${AGENT_RUN_REPLAN_EVENT_MIGRATION_PATH}" >&2
    exit 1
  fi
  if [[ ! -f "${NEW_RELEASE_DIR}/${OAUTH_IDENTITY_MIGRATION_PATH}" ]]; then
    echo "[deploy-kk-vps] OAuth identity migration not found at ${NEW_RELEASE_DIR}/${OAUTH_IDENTITY_MIGRATION_PATH}" >&2
    exit 1
  fi
  if [[ ! -f "${NEW_RELEASE_DIR}/${PAYMENT_RECHARGE_MIGRATION_PATH}" ]]; then
    echo "[deploy-kk-vps] Payment recharge migration not found at ${NEW_RELEASE_DIR}/${PAYMENT_RECHARGE_MIGRATION_PATH}" >&2
    exit 1
  fi
}

apply_database_migrations() {
  if [[ "${APPLY_BOOTSTRAP_SQL}" == "true" ]]; then
    echo "[deploy-kk-vps] Executing optional full bootstrap database schema..."
    SCHEMA_MIGRATION_ATTEMPTED=true
    psql "${MIGRATION_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${NEW_RELEASE_DIR}/${BOOTSTRAP_SQL_PATH}"
  fi

  echo "[deploy-kk-vps] Applying mandatory AI assistant user-scope migration..."
  SCHEMA_MIGRATION_ATTEMPTED=true
  psql "${MIGRATION_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${NEW_RELEASE_DIR}/${AI_ASSISTANT_SCOPE_MIGRATION_PATH}"

  echo "[deploy-kk-vps] Applying mandatory Agent Run event migration..."
  psql "${MIGRATION_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${NEW_RELEASE_DIR}/${AGENT_RUN_EVENT_MIGRATION_PATH}"

  echo "[deploy-kk-vps] Applying mandatory Agent Session migration..."
  psql "${MIGRATION_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${NEW_RELEASE_DIR}/${AGENT_SESSION_MIGRATION_PATH}"

  echo "[deploy-kk-vps] Applying mandatory Agent Run Session binding migration..."
  psql "${MIGRATION_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${NEW_RELEASE_DIR}/${AGENT_RUN_SESSION_BINDING_MIGRATION_PATH}"

  echo "[deploy-kk-vps] Applying mandatory Agent Run semantic event migration..."
  psql "${MIGRATION_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${NEW_RELEASE_DIR}/${AGENT_RUN_SEMANTIC_EVENT_MIGRATION_PATH}"

  echo "[deploy-kk-vps] Applying mandatory Agent Run replan event migration..."
  psql "${MIGRATION_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${NEW_RELEASE_DIR}/${AGENT_RUN_REPLAN_EVENT_MIGRATION_PATH}"

  echo "[deploy-kk-vps] Applying mandatory OAuth identity migration..."
  psql "${MIGRATION_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${NEW_RELEASE_DIR}/${OAUTH_IDENTITY_MIGRATION_PATH}"

  echo "[deploy-kk-vps] Applying mandatory payment recharge integrity migration..."
  psql "${MIGRATION_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${NEW_RELEASE_DIR}/${PAYMENT_RECHARGE_MIGRATION_PATH}"

  psql "${MIGRATION_DATABASE_URL}" -v ON_ERROR_STOP=1 -v runtime_role="${RUNTIME_DATABASE_USER}" <<'SQL'
SELECT format(
  'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %s TO %I',
  string_agg(format('public.%I', table_name), ', '),
  :'runtime_role'
)
FROM (VALUES
  ('agent_runs'), ('agent_run_events'), ('agent_sessions'), ('agent_context_snapshots'),
  ('agent_tool_calls'), ('agent_memory'), ('knowledge_documents'),
  ('knowledge_chunks'), ('canvas_runtime_snapshots'), ('agent_skills'), ('agent_skill_versions'),
  ('auth_identities'), ('oauth_transactions'), ('credit_exchange_rates'),
  ('recharge_submissions'), ('plans'), ('orders')
) AS ai_tables(table_name)
\gexec

SELECT format(
  'GRANT USAGE, SELECT ON SEQUENCE %s TO %I',
  pg_get_serial_sequence('public.agent_context_snapshots', 'sequence'),
  :'runtime_role'
)
WHERE pg_get_serial_sequence('public.agent_context_snapshots', 'sequence') IS NOT NULL
\gexec
SQL

  psql "${MIGRATION_DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agent_runs'
      AND column_name = 'user_id'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'agent_runs.user_id is not present and NOT NULL';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agent_runs'
      AND column_name = 'replan_count'
      AND data_type = 'integer'
      AND is_nullable = 'NO'
      AND coalesce(column_default, '') LIKE '0%'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agent_runs_replan_count_check'
      AND conrelid = 'public.agent_runs'::regclass
      AND convalidated
  ) THEN
    RAISE EXCEPTION 'agent_runs.replan_count is missing or does not enforce the three-replan limit';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agent_runs'
      AND column_name = 'event_sequence'
      AND data_type = 'integer'
      AND is_nullable = 'NO'
  ) OR to_regclass('public.agent_run_events') IS NULL OR EXISTS (
    SELECT 1
    FROM (VALUES
      ('run_id', 'text'),
      ('sequence', 'integer'),
      ('event_type', 'text'),
      ('status', 'text'),
      ('run_updated_at', 'timestamp with time zone'),
      ('created_at', 'timestamp with time zone')
    ) AS expected(column_name, data_type)
    LEFT JOIN information_schema.columns AS actual
      ON actual.table_schema = 'public'
      AND actual.table_name = 'agent_run_events'
      AND actual.column_name = expected.column_name
    WHERE actual.column_name IS NULL
      OR actual.data_type <> expected.data_type
      OR actual.is_nullable <> 'NO'
  ) OR EXISTS (
    SELECT 1
    FROM (VALUES
      ('step_id', 'text'),
      ('tool_name', 'text'),
      ('outcome', 'text'),
      ('verification_rule', 'text'),
      ('retryable', 'boolean'),
      ('verified_at', 'timestamp with time zone'),
      ('replan_count', 'integer'),
      ('reason_code', 'text'),
      ('trigger_code', 'text')
    ) AS expected(column_name, data_type)
    LEFT JOIN information_schema.columns AS actual
      ON actual.table_schema = 'public'
      AND actual.table_name = 'agent_run_events'
      AND actual.column_name = expected.column_name
    WHERE actual.column_name IS NULL
      OR actual.data_type <> expected.data_type
      OR actual.is_nullable <> 'YES'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agent_run_events_event_type_check'
      AND conrelid = 'public.agent_run_events'::regclass
      AND convalidated
      AND position('run_snapshot' IN pg_get_constraintdef(oid)) > 0
      AND position('step_outcome' IN pg_get_constraintdef(oid)) > 0
      AND position('replan' IN pg_get_constraintdef(oid)) > 0
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agent_run_events_event_shape_check'
      AND conrelid = 'public.agent_run_events'::regclass
      AND convalidated
  ) OR to_regprocedure('public.project_agent_run_step_outcomes(jsonb,jsonb)') IS NULL OR (
    SELECT count(*) FROM pg_trigger AS event_trigger
    JOIN pg_class AS class ON class.oid = event_trigger.tgrelid
    WHERE class.oid = 'public.agent_runs'::regclass
      AND event_trigger.tgname IN (
        'prepare_agent_run_event_sequence',
        'append_agent_run_snapshot_event'
      )
      AND NOT event_trigger.tgisinternal
  ) <> 2
    OR to_regprocedure('public.prepare_agent_run_event_sequence()') IS NULL
    OR to_regprocedure('public.append_agent_run_snapshot_event()') IS NULL THEN
    RAISE EXCEPTION 'agent_run_events schema is missing or invalid';
  END IF;
  IF to_regclass('public.agent_sessions') IS NULL
    OR to_regclass('public.agent_context_snapshots') IS NULL
    OR EXISTS (
      SELECT 1
      FROM (VALUES
        ('agent_sessions', 'id', 'text'),
        ('agent_sessions', 'user_id', 'text'),
        ('agent_sessions', 'collaboration_mode', 'text'),
        ('agent_sessions', 'messages', 'jsonb'),
        ('agent_sessions', 'summary', 'jsonb'),
        ('agent_sessions', 'token_budget', 'jsonb'),
        ('agent_sessions', 'last_heartbeat_at', 'timestamp with time zone'),
        ('agent_context_snapshots', 'snapshot_id', 'text'),
        ('agent_context_snapshots', 'session_id', 'text'),
        ('agent_context_snapshots', 'sequence', 'bigint'),
        ('agent_context_snapshots', 'snapshot_data', 'jsonb'),
        ('agent_context_snapshots', 'captured_at', 'timestamp with time zone')
      ) AS expected(table_name, column_name, data_type)
      LEFT JOIN information_schema.columns AS actual
        ON actual.table_schema = 'public'
        AND actual.table_name = expected.table_name
        AND actual.column_name = expected.column_name
      WHERE actual.column_name IS NULL
        OR actual.data_type <> expected.data_type
        OR actual.is_nullable <> 'NO'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'agent_context_snapshots'
        AND column_name = 'sequence'
        AND is_identity = 'YES'
    ) OR NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.agent_context_snapshots'::regclass
        AND confrelid = 'public.agent_sessions'::regclass
        AND contype = 'f'
    ) THEN
    RAISE EXCEPTION 'agent_sessions schema is missing or invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agent_runs'
      AND column_name = 'session_id'
      AND data_type = 'text'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agent_runs_session_owner_fkey'
      AND conrelid = 'public.agent_runs'::regclass
      AND confrelid = 'public.agent_sessions'::regclass
      AND contype = 'f'
      AND array_length(conkey, 1) = 2
      AND array_length(confkey, 1) = 2
  ) THEN
    RAISE EXCEPTION 'agent_runs.session_id is missing or its owner binding is invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agent_runs'
      AND column_name = 'step_results'
      AND data_type = 'jsonb'
      AND is_nullable = 'NO'
      AND coalesce(column_default, '') LIKE '%[]%'
  ) THEN
    RAISE EXCEPTION 'agent_runs.step_results is not canonical jsonb NOT NULL with an empty-array default';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('knowledge_documents'),
      ('agent_skills'),
      ('canvas_runtime_snapshots')
    ) AS expected(table_name)
    LEFT JOIN information_schema.columns AS actual
      ON actual.table_schema = 'public'
      AND actual.table_name = expected.table_name
      AND actual.column_name = 'owner_scope'
    WHERE actual.column_name IS NULL
      OR actual.data_type <> 'text'
      OR actual.is_nullable <> 'NO'
      OR coalesce(actual.column_default, '') NOT LIKE '%legacy%'
  ) THEN
    RAISE EXCEPTION 'AI owner_scope columns are missing or do not enforce canonical NOT NULL legacy defaults';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('agent_runs', 'created_at'),
      ('agent_runs', 'updated_at'),
      ('agent_tool_calls', 'started_at'),
      ('agent_tool_calls', 'completed_at'),
      ('agent_memory', 'created_at'),
      ('agent_memory', 'updated_at'),
      ('knowledge_documents', 'created_at'),
      ('knowledge_documents', 'updated_at'),
      ('knowledge_chunks', 'created_at'),
      ('canvas_runtime_snapshots', 'created_at'),
      ('canvas_runtime_snapshots', 'updated_at'),
      ('agent_skills', 'created_at'),
      ('agent_skills', 'updated_at')
    ) AS expected(table_name, column_name)
    LEFT JOIN information_schema.columns AS actual
      ON actual.table_schema = 'public'
      AND actual.table_name = expected.table_name
      AND actual.column_name = expected.column_name
    WHERE actual.data_type IS DISTINCT FROM 'timestamp with time zone'
  ) THEN
    RAISE EXCEPTION 'AI assistant timestamp columns are missing or are not timestamptz';
  END IF;
  IF to_regclass('public.agent_skill_versions') IS NULL THEN
    RAISE EXCEPTION 'agent_skill_versions is missing';
  END IF;
  IF to_regclass('public.auth_identities') IS NULL
    OR to_regclass('public.oauth_transactions') IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'password_hash'
        AND is_nullable = 'YES'
    ) THEN
    RAISE EXCEPTION 'OAuth identity schema is missing or users.password_hash is still required';
  END IF;
  IF to_regclass('public.credit_exchange_rates') IS NULL
    OR to_regclass('public.recharge_submissions') IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'currency'
    )
    OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'currency'
    )
    OR NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'chk_recharge_submission_credit_amount_positive'
        AND conrelid = 'public.recharge_submissions'::regclass
        AND convalidated
    )
    OR NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'chk_recharge_submission_status'
        AND conrelid = 'public.recharge_submissions'::regclass
        AND convalidated
    )
    OR NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'chk_recharge_submission_manual_channel'
        AND conrelid = 'public.recharge_submissions'::regclass
        AND convalidated
    ) THEN
    RAISE EXCEPTION 'Payment recharge integrity schema is missing or invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index AS index
    JOIN pg_class AS class ON class.oid = index.indexrelid
    WHERE class.relname = 'agent_skills_user_name_idx'
      AND index.indisunique
      AND pg_get_expr(index.indpred, index.indrelid) LIKE '%owner_scope%user%'
  ) THEN
    RAISE EXCEPTION 'agent_skills_user_name_idx is missing its user-scope predicate';
  END IF;
END $$;
SQL
  SCHEMA_CUTOVER_APPLIED=true
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

install_systemd_units() {
  local api_unit="${CURRENT_DIR}/config/deploy/systemd/kk-api.service"
  if [[ ! -f "${api_unit}" ]]; then
    echo "[deploy-kk-vps] API systemd unit not found at ${api_unit}" >&2
    exit 1
  fi

  echo "[deploy-kk-vps] Installing API systemd unit from the selected release..."
  install -m 0644 "${api_unit}" /etc/systemd/system/kk-api.service
  systemctl daemon-reload
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
  API_SERVICES_STOPPED_FOR_SCHEMA_CUTOVER=false
  
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
  
  if [[ "${live_sha}" != "${COMMIT_SHA}" ]]; then
    echo "[deploy-kk-vps] ERROR: Deployed version SHA mismatch! Expected ${COMMIT_SHA} but got ${live_sha}." >&2
    exit 1
  fi
  
  # 验证 2: 验证后端 API 服务是否可达
  echo "[deploy-kk-vps] Testing backend health check: http://127.0.0.1/healthz"
  local health_status
  health_status="$(curl -sS --fail http://127.0.0.1/healthz || echo "")"
  if [[ ! "${health_status}" =~ '"status":"ok"' && ! "${health_status}" =~ '"ok":true' && "${health_status}" != "ok" ]]; then
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
require_clean_git_release
require_runtime_database_target
verify_preflight_changes
sync_repo_to_release_dir
install_dependencies
build_static_sites
harden_env_permissions
verify_database_migration_inputs
stop_api_services_for_schema_cutover
apply_database_migrations

# 进入临界区，进行原子替换与重载
atomic_switch_symlinks
install_systemd_units
install_nginx_gateway
restart_services_and_reload_nginx

# 本地验证
validate_deployment_by_curl

# 验证通过，清理旧包
cleanup_old_releases

echo "[deploy-kk-vps] Release ${RELEASE_NAME} deployed successfully."
