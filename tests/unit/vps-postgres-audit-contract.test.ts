import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import {
  POSTGRES_BOOTSTRAP_SQL_FILES,
  REQUIRED_RUNTIME_COLUMN_CONTRACT,
  REQUIRED_RUNTIME_TABLES,
  RUNTIME_TABLE_CONTRACT,
  evaluatePostgresBootstrapSql,
  evaluatePostgresBootstrapSqlFiles,
} from "../../scripts/audit-vps-postgres.mjs";

const ROOT_DIR = process.cwd();

describe("VPS PostgreSQL audit contract", () => {
  test("runtime contract covers login sessions, billing, model pricing, and payment settlement", () => {
    assert.deepEqual(
      RUNTIME_TABLE_CONTRACT.map((table) => table.name),
      REQUIRED_RUNTIME_TABLES,
    );

    assert.ok(REQUIRED_RUNTIME_TABLES.includes("profiles"));
    assert.ok(REQUIRED_RUNTIME_TABLES.includes("password_identities"));
    assert.ok(REQUIRED_RUNTIME_TABLES.includes("user_sessions"));
    assert.ok(REQUIRED_RUNTIME_TABLES.includes("admin_credit_models"));
    assert.ok(REQUIRED_RUNTIME_TABLES.includes("user_credits"));
    assert.ok(REQUIRED_RUNTIME_TABLES.includes("credit_transactions"));
    assert.ok(REQUIRED_RUNTIME_TABLES.includes("recharge_submissions"));
    assert.ok(REQUIRED_RUNTIME_TABLES.includes("payment_orders"));
    assert.ok(REQUIRED_RUNTIME_TABLES.includes("payment_callbacks"));
  });

  test("runtime column contract locks non-Supabase VPS identifiers and pricing columns", () => {
    assert.ok(REQUIRED_RUNTIME_COLUMN_CONTRACT.some((column) => (
      column.table === "profiles"
      && column.column === "id"
      && column.typePattern === "\\btext\\b"
    )));
    assert.ok(REQUIRED_RUNTIME_COLUMN_CONTRACT.some((column) => (
      column.table === "provider_pricing_cache"
      && column.column === "pricing_json"
    )));
    assert.ok(REQUIRED_RUNTIME_COLUMN_CONTRACT.some((column) => (
      column.table === "recharge_submissions"
      && column.column === "payment_marked_at"
    )));
    assert.ok(REQUIRED_RUNTIME_COLUMN_CONTRACT.some((column) => (
      column.table === "admin_credit_models"
      && column.column === "visibility"
    )));
  });

  test("bootstrap SQL contains every required runtime table", () => {
    const evaluation = evaluatePostgresBootstrapSqlFiles(ROOT_DIR);
    const missing = evaluation.filter((result) => !result.exists).map((result) => result.name);

    assert.deepEqual(missing, []);
  });

  test("bootstrap SQL contains required runtime columns", () => {
    const evaluation = evaluatePostgresBootstrapSqlFiles(ROOT_DIR);
    const missingColumns = evaluation
      .filter((result) => result.missingColumns.length > 0)
      .map((result) => `${result.name}:${result.missingColumns.join(",")}`);

    assert.deepEqual(missingColumns, []);
  });

  test("SQL evaluation reports missing runtime tables without contacting Supabase", () => {
    const evaluation = evaluatePostgresBootstrapSql("create table if not exists profiles (id uuid);");
    const profiles = evaluation.find((result) => result.name === "profiles");
    const userCredits = evaluation.find((result) => result.name === "user_credits");

    assert.equal(profiles?.exists, true);
    assert.deepEqual(profiles?.missingColumns, ["id"]);
    assert.equal(userCredits?.exists, false);
  });

  test("audit implementation is local PostgreSQL-only", () => {
    const auditSource = readFileSync(path.join(ROOT_DIR, "scripts", "ci", "audit-vps-postgres.mjs"), "utf8");

    assert.match(auditSource, /bootstrap-kk-vps\.sql/);
    assert.doesNotMatch(auditSource, /functions\.supabase\.co/);
    assert.doesNotMatch(auditSource, /\/rest\/v1\//);
    assert.doesNotMatch(auditSource, /SUPABASE_SERVICE_ROLE_KEY/);
  });

  test("audit checks the canonical VPS bootstrap files", () => {
    assert.deepEqual(POSTGRES_BOOTSTRAP_SQL_FILES, [
      "scripts/postgres/bootstrap-kk-vps.sql",
      "apps/api/sql/bootstrap-self-hosted-postgres.sql",
    ]);
  });

  test("database setup script targets VPS PostgreSQL instead of Supabase CLI", () => {
    const setupSource = readFileSync(path.join(ROOT_DIR, "scripts", "setup", "setup-database.bat"), "utf8");

    assert.match(setupSource, /bootstrap-kk-vps\.sql/);
    assert.match(setupSource, /psql/i);
    assert.doesNotMatch(setupSource, /npx\s+supabase/i);
    assert.doesNotMatch(setupSource, /SUPABASE_PROJECT_REF/);
  });
});
