import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  REQUIRED_RUNTIME_MIGRATIONS,
  RUNTIME_RPC_CONTRACT,
  RUNTIME_TABLE_CONTRACT,
  evaluateCatalogContracts,
  evaluateLocalMigrationContracts,
} from "../../scripts/audit-supabase.mjs";

describe("supabase audit contract", () => {
  test("runtime contract matches the current migrated runtime surfaces", () => {
    assert.deepEqual(
      RUNTIME_TABLE_CONTRACT.map((table) => table.name),
      [
        "profiles",
        "user_credits",
        "credit_transactions",
        "admin_auth",
        "admin_credit_models",
        "temp_users",
        "provider_pricing_cache",
        "credit_exchange_rates",
        "generation_tasks",
        "payment_orders",
        "payment_callbacks",
        "admin_sessions",
      ],
    );

    assert.deepEqual(
      RUNTIME_RPC_CONTRACT,
      [
        "refund_credits",
        "get_active_credit_models",
        "api_record_credit_debit_v1",
        "api_record_payment_settlement_v1",
      ],
    );

    assert.deepEqual(
      REQUIRED_RUNTIME_MIGRATIONS,
      [
        "consolidate_runtime_contract",
        "add_payment_sidecar_tables",
        "harden_payment_sidecar_policies",
        "exclude_anonymous_auth_from_payment_policies",
        "add_billing_idempotency_and_rpc",
        "add_admin_sessions",
        "consolidate_runtime_tables_and_freeze_legacy_surfaces",
        "remove_legacy_billing_duplicates",
        "restore_external_identities_runtime",
        "harden_pg_cron_policy_roles",
      ],
    );
  });

  test("catalog evaluation separates runtime requirements from future target gaps", () => {
    const runtimePathEntries = [
      ...RUNTIME_TABLE_CONTRACT.map((table) => [`/${table.name}`, {}]),
      ...RUNTIME_RPC_CONTRACT.map((rpcName) => [`/rpc/${rpcName}`, {}]),
    ];

    const targetTablesAlreadyLive = [
      "/profiles",
      "/generation_tasks",
      "/payment_orders",
      "/payment_callbacks",
      "/admin_sessions",
    ];

    const evaluation = evaluateCatalogContracts({
      paths: Object.fromEntries([
        ...runtimePathEntries,
        ...targetTablesAlreadyLive.map((pathName) => [pathName, {}]),
      ]),
    });

    assert.equal(evaluation.runtimeTables.every((result) => result.exists), true);
    assert.equal(evaluation.runtimeRpcs.every((result) => result.exists), true);

    const missingTargetTables = evaluation.targetTables
      .filter((result) => !result.exists)
      .map((result) => result.name);

    assert.ok(missingTargetTables.includes("credit_accounts"));
    assert.ok(missingTargetTables.includes("credit_ledger"));
    assert.ok(missingTargetTables.includes("model_catalog"));
    assert.ok(!missingTargetTables.includes("profiles"));
    assert.ok(!missingTargetTables.includes("generation_tasks"));
    assert.ok(!missingTargetTables.includes("payment_orders"));
  });

  test("migration evaluation accepts renamed timestamped files as the same milestone", () => {
    const evaluation = evaluateLocalMigrationContracts([
      "20260316000003_consolidate_runtime_contract.sql",
      "20260323120000_add_payment_sidecar_tables.sql",
      "20260323123000_harden_payment_sidecar_policies.sql",
      "20260323124500_exclude_anonymous_auth_from_payment_policies.sql",
      "20260323133000_add_billing_idempotency_and_rpc.sql",
      "20260323143000_add_admin_sessions.sql",
      "20260323010000_consolidate_runtime_tables_and_freeze_legacy_surfaces.sql",
      "20260323011000_remove_legacy_billing_duplicates.sql",
      "20260323070000_restore_external_identities_runtime.sql",
      "20260323113000_harden_pg_cron_policy_roles.sql",
    ]);

    assert.equal(evaluation.every((result) => result.exists), true);
  });
});
