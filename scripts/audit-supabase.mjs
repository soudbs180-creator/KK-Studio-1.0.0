import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..");

export const RUNTIME_TABLE_CONTRACT = Object.freeze([
  {
    name: "profiles",
    role: "runtime",
    rationale: "Canonical runtime identity and profile metadata.",
    target: "profiles",
  },
  {
    name: "user_credits",
    role: "runtime",
    rationale: "Canonical runtime balance account used by the migrated billing repository.",
    target: "credit_accounts",
  },
  {
    name: "credit_transactions",
    role: "runtime",
    rationale: "Canonical runtime ledger used by debit, recharge, settlement, and refund flows.",
    target: "credit_ledger",
  },
  {
    name: "admin_auth",
    role: "runtime",
    rationale: "Legacy-but-live admin password material still used by the admin console repository.",
    target: "admin_sessions + externalized secret management",
  },
  {
    name: "admin_credit_models",
    role: "runtime",
    rationale: "Current runtime model routing and billing configuration source.",
    target: "model_catalog + provider_channels",
  },
  {
    name: "temp_users",
    role: "runtime",
    rationale: "Current guest identity runtime store.",
    target: "temp_users or external identity bridge",
  },
  {
    name: "provider_pricing_cache",
    role: "runtime",
    rationale: "Current provider pricing snapshot cache served through the typed model-catalog admin API.",
    target: "provider_pricing_snapshots",
  },
  {
    name: "credit_exchange_rates",
    role: "runtime",
    rationale: "Recharge exchange-rate runtime store used by current billing UI flows.",
    target: "billing configuration domain table",
  },
  {
    name: "generation_tasks",
    role: "runtime",
    rationale: "Current async generation task store.",
    target: "generation_tasks",
  },
  {
    name: "payment_orders",
    role: "runtime",
    rationale: "Payment sidecar durable order source of truth.",
    target: "payment_orders",
  },
  {
    name: "payment_callbacks",
    role: "runtime",
    rationale: "Payment callback audit trail and settlement dedupe source.",
    target: "payment_callbacks",
  },
  {
    name: "admin_sessions",
    role: "runtime",
    rationale: "Current admin elevation session table.",
    target: "admin_sessions",
  },
]);

export const TARGET_TABLE_CONTRACT = Object.freeze([
  {
    name: "profiles",
    bridge: "Already canonical at runtime.",
  },
  {
    name: "user_api_keys",
    bridge: "Currently bridged through profile cloud state and client secure storage; table is not live yet.",
  },
  {
    name: "model_catalog",
    bridge: "Still split across admin_credit_models and provider-specific configuration.",
  },
  {
    name: "provider_channels",
    bridge: "Still represented inside admin_credit_models and provider runtime configuration.",
  },
  {
    name: "provider_pricing_snapshots",
    bridge: "provider_pricing_cache remains the current runtime pricing snapshot store behind the model-catalog admin API.",
  },
  {
    name: "workspaces",
    bridge: "Workspace/canvas data is still persisted via compatibility repositories and cloud layout state.",
  },
  {
    name: "canvases",
    bridge: "Canvas persistence still flows through compatibility repositories and layout sync state.",
  },
  {
    name: "workflows",
    bridge: "Workflow persistence is still bridged by the workspace-canvas compatibility layer.",
  },
  {
    name: "workflow_nodes",
    bridge: "Workflow nodes are still bridged by the workspace-canvas compatibility layer.",
  },
  {
    name: "assets",
    bridge: "Asset catalog remains runtime-bridged while the target asset schema is introduced incrementally.",
  },
  {
    name: "generation_tasks",
    bridge: "Already canonical at runtime.",
  },
  {
    name: "generation_results",
    bridge: "Task result materialization has not been split into a dedicated table yet.",
  },
  {
    name: "credit_accounts",
    bridge: "user_credits remains the current runtime balance source of truth.",
  },
  {
    name: "credit_ledger",
    bridge: "credit_transactions remains the current runtime ledger source of truth.",
  },
  {
    name: "payment_orders",
    bridge: "Already canonical at runtime.",
  },
  {
    name: "payment_callbacks",
    bridge: "Already canonical at runtime.",
  },
  {
    name: "refund_records",
    bridge: "Refunds still land in credit_transactions plus billing RPCs; dedicated records table is not live yet.",
  },
  {
    name: "audit_logs",
    bridge: "Audit coverage is still split across runtime tables and application-level logging.",
  },
  {
    name: "admin_sessions",
    bridge: "Already canonical at runtime.",
  },
  {
    name: "idempotency_keys",
    bridge: "Idempotency currently lives on payment_orders, payment_callbacks, and credit_transactions columns/RPC logic.",
  },
]);

export const RUNTIME_RPC_CONTRACT = Object.freeze([
  "refund_credits",
  "get_active_credit_models",
  "api_record_credit_debit_v1",
  "api_record_payment_settlement_v1",
]);

export const REQUIRED_EDGE_FUNCTIONS = Object.freeze([
  "secure-model-proxy",
]);

export const REQUIRED_RUNTIME_MIGRATIONS = Object.freeze([
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
]);

const NO_PUBLIC_ROW_TABLES = new Set([
  "user_credits",
  "credit_transactions",
  "admin_auth",
  "admin_credit_models",
  "temp_users",
  "generation_tasks",
  "payment_orders",
  "payment_callbacks",
  "admin_sessions",
  "external_identities",
]);

const PLACEHOLDER_SECRET_PATTERNS = [
  "your-",
  "example",
  "replace",
  "changeme",
  "<",
  "todo",
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((accumulator, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return accumulator;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        return accumulator;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      value = value.replace(/^['"]|['"]$/g, "");
      accumulator[key] = value;
      return accumulator;
    }, {});
}

function extractBuiltinSupabaseConfig() {
  const filePath = path.join(repoRoot, "src", "lib", "supabase.ts");
  const source = fs.readFileSync(filePath, "utf8");
  const enabledMatch = source.match(/export const isUsingBuiltinSupabaseConfig = (true|false);/);
  const urlMatch = source.match(/const BUILTIN_SUPABASE_URL = '([^']+)'/);
  const keyMatch = source.match(/const BUILTIN_SUPABASE_ANON_KEY = '([^']+)'/);

  return {
    enabled: enabledMatch?.[1] !== "false",
    url: urlMatch?.[1] || "",
    key: keyMatch?.[1] || "",
  };
}

function readProjectRef() {
  const filePath = path.join(repoRoot, "supabase", ".temp", "project-ref");
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").trim() : "";
}

function projectRefFromUrl(url) {
  const match = String(url || "").match(/^https:\/\/([^.]+)\.supabase\.co/i);
  return match?.[1] || "";
}

function functionsBaseUrl(url) {
  const ref = projectRefFromUrl(url);
  return ref ? `https://${ref}.functions.supabase.co` : "";
}

function isPlaceholderSecret(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return PLACEHOLDER_SECRET_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function restHeaders(apiKey, bearerToken = apiKey) {
  return {
    apikey: apiKey,
    Authorization: `Bearer ${bearerToken}`,
    "Content-Type": "application/json",
  };
}

async function probeRestObject(supabaseUrl, apiKey, objectName) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${objectName}?select=*&limit=1`, {
    method: "GET",
    headers: restHeaders(apiKey),
  });

  if (response.status === 404) {
    return { exists: false, status: response.status, detail: "missing", rowCount: null };
  }

  const body = await response.text().catch(() => "");

  if (response.ok) {
    let rowCount = null;

    try {
      const parsed = JSON.parse(body);
      if (Array.isArray(parsed)) {
        rowCount = parsed.length;
      }
    } catch {
      rowCount = null;
    }

    return {
      exists: true,
      status: response.status,
      detail: rowCount === null ? "ok" : `ok (${rowCount} row(s) visible with publishable key)`,
      rowCount,
    };
  }

  if (/permission denied|forbidden|jwt|row-level|rls/i.test(body)) {
    return {
      exists: true,
      status: response.status,
      detail: "permission-limited",
      rowCount: null,
    };
  }

  return {
    exists: response.status !== 404,
    status: response.status,
    detail: body || "request failed",
    rowCount: null,
  };
}

async function loadSchemaCatalog(supabaseUrl, apiKey) {
  if (!supabaseUrl || !apiKey) {
    return {
      ok: false,
      detail: "missing service-role key",
      spec: null,
    };
  }

  if (isPlaceholderSecret(apiKey)) {
    return {
      ok: false,
      detail: "placeholder service-role key detected",
      spec: null,
    };
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: "GET",
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/openapi+json",
    },
  }).catch((error) => ({
    ok: false,
    status: 0,
    json: async () => null,
    text: async () => error.message,
  }));

  if (response.ok) {
    return {
      ok: true,
      detail: "openapi schema loaded",
      spec: await response.json(),
    };
  }

  const detail = await response.text().catch(() => "");
  return {
    ok: false,
    detail: `${response.status} ${detail || "failed to load schema metadata"}`.trim(),
    spec: null,
  };
}

export function buildOpenApiPathSet(spec) {
  return new Set(Object.keys(spec?.paths || {}));
}

function evaluatePathSet(pathSet, pathName) {
  const exists = pathSet.has(pathName);

  return {
    exists,
    status: exists ? 200 : 404,
    detail: exists ? "openapi schema" : "missing from openapi schema",
  };
}

export function evaluateCatalogContracts(spec) {
  const pathSet = buildOpenApiPathSet(spec);

  return {
    runtimeTables: RUNTIME_TABLE_CONTRACT.map((table) => ({
      ...table,
      ...evaluatePathSet(pathSet, `/${table.name}`),
    })),
    runtimeRpcs: RUNTIME_RPC_CONTRACT.map((rpcName) => ({
      name: rpcName,
      ...evaluatePathSet(pathSet, `/rpc/${rpcName}`),
    })),
    targetTables: TARGET_TABLE_CONTRACT.map((table) => ({
      ...table,
      ...evaluatePathSet(pathSet, `/${table.name}`),
    })),
  };
}

function normalizeMigrationName(fileName) {
  return path.basename(fileName).replace(/\.sql$/i, "").replace(/^\d+_/, "");
}

function collectLocalMigrationFiles() {
  const directories = [
    path.join(repoRoot, "infra", "supabase", "migrations"),
    path.join(repoRoot, "supabase", "migrations"),
  ];

  const files = [];

  for (const directory of directories) {
    if (!fs.existsSync(directory)) {
      continue;
    }

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".sql")) {
        continue;
      }

      files.push({
        fileName: entry.name,
        fullPath: path.join(directory, entry.name),
      });
    }
  }

  return files;
}

export function evaluateLocalMigrationContracts(migrationFiles) {
  const byName = new Map();

  for (const file of migrationFiles) {
    const fileName = typeof file === "string" ? file : file.fileName;
    const fullPath = typeof file === "string" ? file : file.fullPath;
    const normalized = normalizeMigrationName(fileName);
    const matches = byName.get(normalized) || [];
    matches.push({
      fileName,
      fullPath,
    });
    byName.set(normalized, matches);
  }

  return REQUIRED_RUNTIME_MIGRATIONS.map((name) => {
    const matches = byName.get(name) || [];
    return {
      name,
      exists: matches.length > 0,
      matches,
    };
  });
}

async function probeEdgeFunction(supabaseUrl, apiKey, functionName) {
  const baseUrl = functionsBaseUrl(supabaseUrl);
  if (!baseUrl) {
    return { exists: false, status: 0, detail: "invalid functions base url" };
  }

  const response = await fetch(`${baseUrl}/${functionName}`, {
    method: "POST",
    headers: restHeaders(apiKey),
    body: JSON.stringify({ mode: "healthcheck" }),
  }).catch((error) => ({
    ok: false,
    status: 0,
    text: async () => error.message,
  }));

  if (response.status === 404) {
    return { exists: false, status: response.status, detail: "missing" };
  }

  if (response.ok) {
    return { exists: true, status: response.status, detail: "ok" };
  }

  const detail = await response.text().catch(() => "");
  return {
    exists: response.status !== 404,
    status: response.status,
    detail: detail || "edge function responded with auth or runtime error",
  };
}

async function checkConnection(supabaseUrl) {
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: "GET",
  }).catch((error) => ({
    status: 0,
    text: async () => error.message,
  }));

  const detail = await response.text().catch(() => "");
  return {
    ok: response.status > 0,
    status: response.status,
    detail: detail ? detail.slice(0, 160) : "reachable",
  };
}

function logSection(title) {
  console.log("");
  console.log(title);
}

function logCheck(label, ok, detail = "") {
  const prefix = ok ? "[OK]" : "[FAIL]";
  console.log(`${prefix} ${label}${detail ? ` - ${detail}` : ""}`);
}

function logWarn(label, detail = "") {
  console.log(`[WARN] ${label}${detail ? ` - ${detail}` : ""}`);
}

function logInfo(label, detail = "") {
  console.log(`[INFO] ${label}${detail ? ` - ${detail}` : ""}`);
}

function describeMigrationMatches(matches) {
  if (!matches.length) {
    return "missing from infra/supabase or supabase migrations";
  }

  return matches.map((match) => match.fileName).join(", ");
}

export async function runAudit() {
  const rootEnv = {
    ...parseEnvFile(path.join(repoRoot, ".env")),
    ...parseEnvFile(path.join(repoRoot, ".env.local")),
  };
  const paymentEnvExample = parseEnvFile(path.join(repoRoot, "payment-server", ".env.example"));
  const paymentEnv = parseEnvFile(path.join(repoRoot, "payment-server", ".env"));
  const builtin = extractBuiltinSupabaseConfig();
  const projectRef = readProjectRef();

  const supabaseUrl = rootEnv.SUPABASE_URL || rootEnv.VITE_SUPABASE_URL || builtin.url;
  const publishableKey =
    rootEnv.SUPABASE_ANON_KEY || rootEnv.VITE_SUPABASE_ANON_KEY || builtin.key;
  const paymentSupabaseUrl = paymentEnv.SUPABASE_URL || "";
  const paymentSupabaseUrlDetail = paymentSupabaseUrl
    || paymentEnvExample.SUPABASE_URL
    || "missing payment-server URL";
  const paymentServiceRoleKey =
    paymentEnv.SUPABASE_SERVICE_ROLE_KEY || paymentEnv.SUPABASE_SECRET_KEY || "";
  const paymentServiceRoleKeyFromExample =
    paymentEnvExample.SUPABASE_SERVICE_ROLE_KEY || paymentEnvExample.SUPABASE_SECRET_KEY || "";
  const auditServiceRoleKey =
    paymentServiceRoleKey || rootEnv.SUPABASE_SERVICE_ROLE_KEY || rootEnv.SUPABASE_SECRET_KEY || "";

  const expectedRef = projectRef || projectRefFromUrl(supabaseUrl);
  const currentRef = projectRefFromUrl(supabaseUrl);
  const builtinRef = projectRefFromUrl(builtin.url);
  const paymentRef = projectRefFromUrl(paymentSupabaseUrl);
  const schemaCatalog = supabaseUrl
    ? await loadSchemaCatalog(supabaseUrl, auditServiceRoleKey)
    : { ok: false, detail: "missing supabase url", spec: null };
  const catalogEvaluation = schemaCatalog.ok ? evaluateCatalogContracts(schemaCatalog.spec) : null;
  const localMigrationFiles = collectLocalMigrationFiles();
  const localMigrationEvaluation = evaluateLocalMigrationContracts(localMigrationFiles);

  const serverSideServiceRoleConfigured =
    Boolean(paymentServiceRoleKey) && !isPlaceholderSecret(paymentServiceRoleKey);
  const serverSideServiceRoleDetail = serverSideServiceRoleConfigured
    ? "configured in payment-server/.env"
    : paymentServiceRoleKeyFromExample
      ? "missing from local env files (payment-server/.env.example still contains a placeholder)"
      : "missing from local env files";
  const serverSideServiceRoleMatchesProject =
    schemaCatalog.ok && serverSideServiceRoleConfigured && paymentRef === expectedRef;

  console.log("========================================");
  console.log("Supabase Runtime Audit");
  console.log("========================================");
  console.log(`Project ref: ${expectedRef || "(missing)"}`);
  console.log(`Supabase URL: ${supabaseUrl || "(missing)"}`);
  console.log(`Functions URL: ${functionsBaseUrl(supabaseUrl) || "(missing)"}`);

  let hasFailures = false;
  let hasWarnings = false;
  let targetGapCount = 0;
  let targetGapScanAvailable = false;

  logSection("Connectivity & config");

  const connection = supabaseUrl
    ? await checkConnection(supabaseUrl)
    : { ok: false, status: 0, detail: "missing supabase url" };
  logCheck(
    "Public Supabase endpoint reachable",
    connection.ok,
    `${connection.status} ${connection.detail}`.trim(),
  );
  hasFailures ||= !connection.ok;

  const builtinAligned = !builtin.enabled || (Boolean(builtin.url) && builtinRef === expectedRef);
  logCheck(
    "Built-in client config matches project ref",
    builtinAligned,
    builtin.enabled ? (builtin.url || "missing built-in config") : "disabled by env-only runtime config",
  );
  hasFailures ||= !builtinAligned;

  const envAligned = Boolean(supabaseUrl) && currentRef === expectedRef;
  logCheck("Root env/client URL matches project ref", envAligned);
  hasFailures ||= !envAligned;

  const paymentAligned = Boolean(paymentSupabaseUrl) && paymentRef === expectedRef;
  logCheck(
    "payment-server SUPABASE_URL matches project ref",
    paymentAligned,
    paymentSupabaseUrlDetail,
  );
  hasFailures ||= !paymentAligned;

  const hasPublishableKey = Boolean(publishableKey);
  logCheck("Publishable key configured", hasPublishableKey);
  hasFailures ||= !hasPublishableKey;

  if (serverSideServiceRoleConfigured) {
    logCheck(
      "server-side service-role key configured",
      serverSideServiceRoleConfigured,
      serverSideServiceRoleDetail,
    );
  } else {
    logWarn("server-side service-role key configured", serverSideServiceRoleDetail);
    hasWarnings = true;
  }

  if (schemaCatalog.ok) {
    logCheck("Server-side schema introspection available", schemaCatalog.ok, schemaCatalog.detail);
  } else if (auditServiceRoleKey) {
    logCheck("Server-side schema introspection available", false, schemaCatalog.detail);
    hasFailures = true;
  } else {
    logWarn("Server-side schema introspection available", schemaCatalog.detail);
    hasWarnings = true;
  }

  if (serverSideServiceRoleConfigured) {
    logCheck(
      "server-side service-role key matches current project",
      serverSideServiceRoleMatchesProject,
      serverSideServiceRoleMatchesProject
        ? "schema metadata loaded for current project"
        : "configured server-side key does not match the current project",
    );
    hasFailures ||= !serverSideServiceRoleMatchesProject;
  } else {
    logWarn(
      "server-side service-role key matches current project",
      "skipped because no usable local service-role key was found",
    );
    hasWarnings = true;
  }

  if (supabaseUrl && publishableKey) {
    logSection("Runtime contract");

    for (const table of RUNTIME_TABLE_CONTRACT) {
      const result = schemaCatalog.ok
        ? catalogEvaluation.runtimeTables.find((candidate) => candidate.name === table.name)
        : await probeRestObject(supabaseUrl, publishableKey, table.name);

      logCheck(`runtime-table:${table.name}`, result.exists, `${result.status} ${result.detail}`);
      hasFailures ||= !result.exists;

      if (NO_PUBLIC_ROW_TABLES.has(table.name)) {
        const visibilityProbe = await probeRestObject(supabaseUrl, publishableKey, table.name);
        const hidesRows = !visibilityProbe.exists
          ? false
          : visibilityProbe.rowCount === null || visibilityProbe.rowCount === 0;

        logCheck(
          `publishable-access:${table.name}`,
          hidesRows,
          `${visibilityProbe.status} ${visibilityProbe.detail}`,
        );
        hasFailures ||= !hidesRows;
      }
    }

    if (schemaCatalog.ok) {
      for (const rpcResult of catalogEvaluation.runtimeRpcs) {
        logCheck(`runtime-rpc:${rpcResult.name}`, rpcResult.exists, `${rpcResult.status} ${rpcResult.detail}`);
        hasFailures ||= !rpcResult.exists;
      }
    } else {
      logWarn(
        "runtime-rpc-catalog",
        "requires valid service-role key for non-destructive RPC audit",
      );
      hasWarnings = true;
      for (const rpcName of RUNTIME_RPC_CONTRACT) {
        logInfo(`runtime-rpc:${rpcName}`, "not checked");
      }
    }

    for (const functionName of REQUIRED_EDGE_FUNCTIONS) {
      const result = await probeEdgeFunction(supabaseUrl, publishableKey, functionName);
      logCheck(`edge:${functionName}`, result.exists, `${result.status} ${result.detail}`);
      hasFailures ||= !result.exists;
    }
  }

  logSection("Local migration assets");

  for (const migration of localMigrationEvaluation) {
    logCheck(
      `local-migration:${migration.name}`,
      migration.exists,
      describeMigrationMatches(migration.matches),
    );
    hasFailures ||= !migration.exists;
  }

  if (catalogEvaluation) {
    targetGapScanAvailable = true;
    logSection("Target schema alignment");

    for (const table of catalogEvaluation.targetTables) {
      if (table.exists) {
        logInfo(`target-table:${table.name}`, `already present (${table.detail})`);
        continue;
      }

      targetGapCount += 1;
      logInfo(`target-gap:${table.name}`, table.bridge);
    }
  } else {
    logSection("Target schema alignment");
    logWarn("target-gap-scan", "skipped because schema introspection was unavailable");
    hasWarnings = true;
  }

  logSection("Canonical runtime");
  for (const table of RUNTIME_TABLE_CONTRACT) {
    logInfo(
      table.name,
      `${table.rationale} Target landing: ${table.target}.`,
    );
  }

  console.log("");
  console.log(
    targetGapScanAvailable
      ? `Target advisory gaps: ${targetGapCount}`
      : "Target advisory gaps: n/a (server-side introspection unavailable)",
  );
  console.log(
    hasFailures
      ? "Audit finished with failures."
      : hasWarnings
        ? "Audit passed with warnings."
        : "Audit passed.",
  );
  console.log("========================================");

  if (hasFailures) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAudit().catch((error) => {
    console.error("[audit-supabase] Unexpected failure:", error);
    process.exitCode = 1;
  });
}
