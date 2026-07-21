import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..", "..");

export const POSTGRES_BOOTSTRAP_SQL_FILES = Object.freeze([
  "scripts/ops/postgres/bootstrap-kk-vps.sql",
]);

export const REQUIRED_RUNTIME_TABLES = Object.freeze([
  "profiles",
  "password_identities",
  "user_sessions",
  "admin_auth",
  "admin_sessions",
  "temp_users",
  "external_identities",
  "generation_tasks",
  "workflow_documents",
  "workspace_layouts",
  "workspace_cloud_images",
  "admin_credit_models",
  "provider_pricing_cache",
  "user_credits",
  "credit_exchange_rates",
  "credit_transactions",
  "recharge_submissions",
  "payment_orders",
  "payment_callbacks",
]);

export const RUNTIME_TABLE_CONTRACT = Object.freeze([
  { name: "profiles", role: "auth", rationale: "Canonical user identity and profile metadata." },
  { name: "password_identities", role: "auth", rationale: "Password login credentials for the hosted API." },
  { name: "user_sessions", role: "auth", rationale: "Browser refresh sessions, including 30-day hosted login state." },
  { name: "admin_auth", role: "admin", rationale: "Admin password material for the admin console." },
  { name: "admin_sessions", role: "admin", rationale: "Admin elevation sessions." },
  { name: "temp_users", role: "auth", rationale: "Guest identity runtime store." },
  { name: "external_identities", role: "auth", rationale: "Google and WeChat identity links." },
  { name: "generation_tasks", role: "generation", rationale: "Async image/video task tracking." },
  { name: "workflow_documents", role: "workspace", rationale: "Workflow document persistence." },
  { name: "workspace_layouts", role: "workspace", rationale: "Infinite canvas layout persistence." },
  { name: "workspace_cloud_images", role: "workspace", rationale: "Generated image metadata for canvas restore." },
  { name: "admin_credit_models", role: "billing", rationale: "Admin-managed model credit pricing." },
  { name: "provider_pricing_cache", role: "billing", rationale: "Provider pricing snapshot cache." },
  { name: "user_credits", role: "billing", rationale: "User credit balances." },
  { name: "credit_exchange_rates", role: "billing", rationale: "Recharge exchange-rate configuration." },
  { name: "credit_transactions", role: "billing", rationale: "Credit ledger for debit, settlement, and refunds." },
  { name: "recharge_submissions", role: "billing", rationale: "Manual recharge order state and admin review queue." },
  { name: "payment_orders", role: "payment", rationale: "Server-backed durable payment order state." },
  { name: "payment_callbacks", role: "payment", rationale: "Payment callback audit and settlement dedupe." },
]);

export const REQUIRED_RUNTIME_COLUMN_CONTRACT = Object.freeze([
  { table: "profiles", column: "id", typePattern: "\\btext\\b" },
  { table: "password_identities", column: "user_id", typePattern: "\\btext\\b" },
  { table: "user_sessions", column: "user_id", typePattern: "\\btext\\b" },
  { table: "admin_sessions", column: "admin_user_id", typePattern: "\\btext\\b" },
  { table: "temp_users", column: "id", typePattern: "\\btext\\b" },
  { table: "workspace_layouts", column: "user_id", typePattern: "\\btext\\b" },
  { table: "workspace_cloud_images", column: "user_id", typePattern: "\\btext\\b" },
  { table: "admin_credit_models", column: "visibility", typePattern: "\\btext\\b" },
  { table: "provider_pricing_cache", column: "pricing_json", typePattern: "\\bjsonb\\b" },
  { table: "recharge_submissions", column: "submission_id", typePattern: "\\btext\\b" },
  { table: "recharge_submissions", column: "user_id", typePattern: "\\btext\\b" },
  { table: "recharge_submissions", column: "payment_marked_at", typePattern: "\\btimestamptz\\b" },
  { table: "payment_orders", column: "id", typePattern: "\\btext\\b" },
  { table: "payment_callbacks", column: "payment_order_id", typePattern: "\\btext\\b" },
]);

function stripSqlComments(sql) {
  return String(sql || "")
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function tablePattern(tableName) {
  const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?["']?${escaped}["']?\\b`, "i");
}

function tableBlockPattern(tableName) {
  const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?["']?${escaped}["']?\\s*\\(([\\s\\S]*?)\\);`,
    "i",
  );
}

function columnPattern(columnName, typePattern) {
  const escaped = columnName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\n,])\\s*["']?${escaped}["']?\\s+${typePattern}`, "i");
}

function missingColumnsForTable(normalizedSql, tableName) {
  const tableBlock = normalizedSql.match(tableBlockPattern(tableName))?.[1] || "";
  return REQUIRED_RUNTIME_COLUMN_CONTRACT
    .filter((column) => column.table === tableName)
    .filter((column) => !columnPattern(column.column, column.typePattern).test(tableBlock))
    .map((column) => column.column);
}

export function evaluatePostgresBootstrapSql(sql) {
  const normalizedSql = stripSqlComments(sql);

  return RUNTIME_TABLE_CONTRACT.map((table) => ({
    ...table,
    exists: tablePattern(table.name).test(normalizedSql),
    missingColumns: missingColumnsForTable(normalizedSql, table.name),
  }));
}

export function getPostgresBootstrapSqlFileChecks(rootDir = repoRoot) {
  return POSTGRES_BOOTSTRAP_SQL_FILES.map((relativePath) => ({
    relativePath,
    exists: fs.existsSync(path.join(rootDir, relativePath)),
  }));
}

export function evaluatePostgresBootstrapSqlFiles(rootDir = repoRoot) {
  const combinedSql = POSTGRES_BOOTSTRAP_SQL_FILES
    .map((relativePath) => {
      const absolutePath = path.join(rootDir, relativePath);
      return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
    })
    .join("\n\n");

  return evaluatePostgresBootstrapSql(combinedSql);
}

function logCheck(label, ok, detail = "") {
  const prefix = ok ? "[OK]" : "[FAIL]";
  console.log(`${prefix} ${label}${detail ? ` - ${detail}` : ""}`);
}

export async function runAudit(options = {}) {
  const rootDir = options.repoRoot || repoRoot;
  const fileChecks = getPostgresBootstrapSqlFileChecks(rootDir);
  const evaluation = evaluatePostgresBootstrapSqlFiles(rootDir);
  const missing = evaluation.filter((result) => !result.exists);

  console.log("========================================");
  console.log("VPS PostgreSQL Runtime Audit");
  console.log("========================================");
  console.log("Bootstrap SQL files:");
  for (const check of fileChecks) {
    logCheck(`file:${check.relativePath}`, check.exists);
  }

  console.log("");
  console.log("Runtime table contract:");
  for (const result of evaluation) {
    logCheck(`table:${result.name}`, result.exists, result.rationale);
    if (result.exists && result.missingColumns.length > 0) {
      logCheck(
        `columns:${result.name}`,
        false,
        `missing ${result.missingColumns.join(", ")}`,
      );
    }
  }

  console.log("");
  const missingFiles = fileChecks.filter((check) => !check.exists);
  const columnFailures = evaluation.filter((result) => result.missingColumns.length > 0);
  if (missingFiles.length > 0 || missing.length > 0 || columnFailures.length > 0) {
    console.log(
      `Audit finished with ${missingFiles.length} missing bootstrap SQL file(s), ${missing.length} missing runtime table(s), and ${columnFailures.length} column contract failure(s).`,
    );
    process.exitCode = 1;
  } else {
    console.log("Audit passed.");
  }
  console.log("========================================");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAudit().catch((error) => {
    console.error("[audit-vps-postgres] Unexpected failure:", error);
    process.exitCode = 1;
  });
}
