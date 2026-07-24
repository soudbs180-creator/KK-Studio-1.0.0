#!/usr/bin/env bash
# =============================================================================
# Phase 2a 外部门禁 — migration 001→019 演练脚本
# =============================================================================
# 用法:
#   KK_MIGRATION_DATABASE_URL="postgresql://..." bash scripts/ops/postgres/rehearse-migration-001-019.sh
#   KK_MIGRATION_DATABASE_URL="postgresql://..." KK_MIGRATION_REHEARSAL_MODE="repeat" bash ...
#
# 模式（KK_MIGRATION_REHEARSAL_MODE）:
#   fresh  (默认)  — 空库首次执行（仅 bootstrap + migrations）
#   repeat          — 对已有库重复执行所有 migration（幂等性验证）
#   populated       — 对含存量数据的库执行（数据保留验证）
#
# 约束:
#   - 脚本不会创建或删除数据库
#   - 连接串不得提交到 Git 或写入 Handoff
#   - 必须在受控环境执行，连接目标必须是非生产库
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
MIGRATIONS_DIR="${REPO_ROOT}/infrastructure/database/migrations"
REPORT_FILE="${REPO_ROOT}/temp/migration-rehearsal-report.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DATABASE_URL="${KK_MIGRATION_DATABASE_URL:-}"
MODE="${KK_MIGRATION_REHEARSAL_MODE:-fresh}"

if [[ -z "${DATABASE_URL}" ]]; then
  echo -e "${RED}[ERROR]${NC} KK_MIGRATION_DATABASE_URL 未设置。" >&2
  echo "示例: KK_MIGRATION_DATABASE_URL=\"postgresql://user:pass@host:5432/db\" bash $0" >&2
  exit 1
fi

if ! command -v psql &>/dev/null; then
  echo -e "${RED}[ERROR]${NC} 本机未安装 psql。" >&2
  exit 1
fi

# 安全检查：确认目标不是生产库
DB_NAME="$(echo "${DATABASE_URL}" | sed -n 's/.*\/\([^/?]*\).*/\1/p')"
if [[ "${DB_NAME,,}" =~ production|prod|live|master ]]; then
  echo -e "${RED}[SAFETY]${NC} 数据库名包含 production/prod/live/master，拒绝执行。"
  exit 1
fi

# 连接验证
echo -e "${YELLOW}[1/4]${NC} 验证数据库连接..."
if ! psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -Atqc 'SELECT 1' >/dev/null 2>&1; then
  echo -e "${RED}[ERROR]${NC} 无法连接��据库。" >&2
  exit 1
fi
CURRENT_DB="$(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -Atqc 'SELECT current_database()')"
echo "  已连接: ${CURRENT_DB}"
echo "  模式:   ${MODE}"

# 初始化报告 JSON
mkdir -p "$(dirname "${REPORT_FILE}")"
cat > "${REPORT_FILE}" <<'REPORT_HEAD'
{
  "started_at": "",
  "mode": "",
  "database": "",
  "migrations": [],
  "summary": { "total": 0, "passed": 0, "failed": 0, "warnings": [] }
}
REPORT_HEAD

# 内联更新 JSON 辅助函数
update_json_field() {
  local file="$1" key="$2" value="$3"
  local tmp="${file}.tmp"
  jq ".${key} = \"${value}\"" "${file}" > "${tmp}" && mv "${tmp}" "${file}"
}

update_json_summary() {
  local file="$1" key="$2" value="$3"
  local tmp="${file}.tmp"
  jq ".summary.${key} = ${value}" "${file}" > "${tmp}" && mv "${tmp}" "${file}"
}

append_json_migration_entry() {
  local file="$1" id="$2" status="$3" message="$4"
  local entry
  entry="{\"id\":\"${id}\",\"status\":\"${status}\",\"message\":\"${message}\",\"completed_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
  local tmp="${file}.tmp"
  jq ".migrations += [${entry}]" "${file}" > "${tmp}" && mv "${tmp}" "${file}"
}

# 初始化元数据
update_json_field "${REPORT_FILE}" "started_at" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
update_json_field "${REPORT_FILE}" "mode" "${MODE}"
update_json_field "${REPORT_FILE}" "database" "${CURRENT_DB}"

echo ""
echo -e "${YELLOW}[2/4]${NC} 执行 migration 001→019..."

PASSED=0
FAILED=0
MIGRATION_IDS=("001" "002" "003" "004" "005" "006" "007" "008" "009" "010"
                "011" "012" "013" "014" "015" "016" "017" "018" "019")

for mid in "${MIGRATION_IDS[@]}"; do
  # 查找正确文件（number 前导零匹配）
  MIGRATION_FILE="$(ls "${MIGRATIONS_DIR}"/${mid}_*.sql 2>/dev/null | head -1)"
  if [[ -z "${MIGRATION_FILE}" ]]; then
    echo "  [${mid}] ${RED}✗${NC} 找不到文件"
    append_json_migration_entry "${REPORT_FILE}" "${mid}" "failed" "file not found"
    FAILED=$((FAILED + 1))
    continue
  fi

  MIGRATION_NAME="$(basename "${MIGRATION_FILE}" .sql)"
  echo -n "  [${mid}] ${MIGRATION_NAME#*_} ... "

  if OUTPUT=$(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${MIGRATION_FILE}" 2>&1); then
    echo -e "${GREEN}✓${NC}"
    append_json_migration_entry "${REPORT_FILE}" "${mid}" "passed" "applied successfully"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗${NC}"
    echo "        ${OUTPUT}" | tail -5
    append_json_migration_entry "${REPORT_FILE}" "${mid}" "failed" "$(echo "${OUTPUT}" | head -1)"
    FAILED=$((FAILED + 1))

    # 关键 migration 失败立即中止
    if [[ "${mid}" == "017" || "${mid}" == "018" || "${mid}" == "019" ]]; then
      echo -e "${RED}[ABORT]${NC} 关键 migration ${mid} 失败，停止继续执行。"
      break
    fi
  fi
done

echo ""
TOTAL=$((PASSED + FAILED))
echo -e "${YELLOW}[3/4]${NC} 执行完成: ${PASSED}/${TOTAL} 通过${FAILED:+, ${FAILED} 失败}"

update_json_summary "${REPORT_FILE}" "total" "${TOTAL}"
update_json_summary "${REPORT_FILE}" "passed" "${PASSED}"
update_json_summary "${REPORT_FILE}" "failed" "${FAILED}"

# =============================================================================
# [4/4] 结构验证
# =============================================================================
echo ""
echo -e "${YELLOW}[4/4]${NC} 结构验证..."
echo ""

# 辅助：运行 SQL 查询并捕获结果
run_query() {
  local label="$1" query="$2"
  echo -n "  ${label} ... "
  local result
  if result=$(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -Atq -c "${query}" 2>/dev/null); then
    echo -e "${GREEN}${result}${NC}"
  else
    echo -e "${RED}FAILED${NC}"
    return 1
  fi
}

# 4.1 关键表存在性
echo "  --- 核心表存在性 ---"
for tbl in generation_quotes generation_jobs generation_job_items ledger_entries \
           provider_connections capability_bindings asset_lineage_relations \
           generation_image_worker_leases; do
  EXISTS=$(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -Atq \
    -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='${tbl}'" 2>/dev/null || echo "0")
  if [[ "${EXISTS}" == "1" ]]; then
    echo -e "  ${tbl} ${GREEN}✓${NC}"
  else
    echo -e "  ${tbl} ${RED}✗ 缺失${NC}"
  fi
done

# 4.2 Migration 018 特有——RLS 策略
echo ""
echo "  --- RLS 策略（018） ---"
RLS_COUNT=$(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -Atq \
  -c "SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN ('provider_connections','capability_bindings','asset_lineage_relations')" 2>/dev/null || echo "0")
echo -e "  RLS 策略数: ${RLS_COUNT}（预期: 3）"

# 4.3 Migration 018 唯一约束与外键
echo ""
echo "  --- 约束完整性（018） ---"
UNQ_COUNT=$(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -Atq \
  -c "SELECT count(*) FROM pg_constraint WHERE conrelid='public.capability_bindings'::regclass AND contype='u'" 2>/dev/null || echo "0")
FK_COUNT=$(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -Atq \
  -c "SELECT count(*) FROM pg_constraint WHERE conrelid='public.capability_bindings'::regclass AND contype='f'" 2>/dev/null || echo "0")
echo -e "  capability_bindings UNIQUE 约束: ${UNQ_COUNT}（预期: 1）"
echo -e "  capability_bindings FK 约束:    ${FK_COUNT}（预期: 1）"

# 4.4 重复执行后数据保留（仅在 populated 模式下有意义）
if [[ "${MODE}" == "populated" ]]; then
  echo ""
  echo "  --- 存量数据保留（populated 模式） ---"
  CONN_COUNT=$(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -Atq \
    -c "SELECT count(*) FROM public.provider_connections" 2>/dev/null || echo "0")
  BIND_COUNT=$(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -Atq \
    -c "SELECT count(*) FROM public.capability_bindings" 2>/dev/null || echo "0")
  LINEAGE_COUNT=$(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -Atq \
    -c "SELECT count(*) FROM public.asset_lineage_relations" 2>/dev/null || echo "0")
  echo -e "  provider_connections:       ${CONN_COUNT} 行"
  echo -e "  capability_bindings:        ${BIND_COUNT} 行"
  echo -e "  asset_lineage_relations:    ${LINEAGE_COUNT} 行"
fi

# 4.5 Job Item 与 Lease 表结构（017/019）
echo ""
echo "  --- Job/Lease 表结构（017/019） ---"
JOB_COLS=$(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -Atq \
  -c "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='generation_jobs'" 2>/dev/null || echo "0")
ITEM_COLS=$(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -Atq \
  -c "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='generation_job_items'" 2>/dev/null || echo "0")
LEASE_COLS=$(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -Atq \
  -c "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='generation_image_worker_leases'" 2>/dev/null || echo "0")
echo -e "  generation_jobs 列数:              ${JOB_COLS}"
echo -e "  generation_job_items 列数:          ${ITEM_COLS}"
echo -e "  generation_image_worker_leases 列数:${LEASE_COLS}"

# 4.6 汇总警告（warnings 不阻止 exit code，仅记录）
WARNINGS=""
if [[ "${RLS_COUNT}" != "3" ]]; then
  WARNINGS="${WARNINGS} RLS 策略数=${RLS_COUNT}(预期3);"
fi
if [[ "${UNQ_COUNT}" != "1" ]]; then
  WARNINGS="${WARNINGS} capability_bindings UNIQUE=${UNQ_COUNT}(预期1);"
fi
if [[ "${FK_COUNT}" != "1" ]]; then
  WARNINGS="${WARNINGS} capability_bindings FK=${FK_COUNT}(预期1);"
fi

if [[ -n "${WARNINGS}" ]]; then
  echo ""
  echo -e "${YELLOW}[WARN]${NC} 发现结构警告:${WARNINGS}"
fi

update_json_field "${REPORT_FILE}" "summary.warnings" "[${WARNINGS}]"

echo ""
echo "报告已输出: ${REPORT_FILE}"

if [[ "${FAILED}" -gt 0 ]]; then
  echo -e "${RED}演练未通过: ${FAILED} 个 migration 失败${NC}"
  exit 1
else
  echo -e "${GREEN}演练通过: 全部 ${PASSED} 个 migration 成功${NC}"
  exit 0
fi
