import {
  collectEnvSnapshots,
  compareSupabaseProjectRefs,
  describeSupabaseServerKey,
  findSnapshotEntries,
  findIgnoredLegacySecrets,
  getEffectiveValue,
  resolveRepoRoot,
  summarizeValue,
} from "./lib/env-contract.mjs";

const rootPath = resolveRepoRoot(import.meta.url);

function printKeyStatus(label, record) {
  if (!record) {
    console.log(`- ${label}: <missing>`);
    return;
  }

  console.log(`- ${label}: ${summarizeValue(record.value)} from ${record.source}`);
}

async function fetchHealth() {
  const baseUrl = process.env.VITE_KK_API_BASE_URL || "http://127.0.0.1:3001";
  const url = `${baseUrl.replace(/\/+$/, "")}/healthz`;
  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      return { ok: false, message: `HTTP ${response.status}` };
    }
    const body = await response.json();
    return { ok: true, data: body?.data || null };
  } catch (error) {
    return { ok: false, message: error?.message || "fetch failed" };
  }
}

async function run() {
  const snapshots = collectEnvSnapshots(rootPath);
  const frontendKeys = [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "VITE_KK_API_BASE_URL",
  ];
  const apiServerKeys = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_ANON_KEY",
    "USER_API_ENCRYPTION_SECRET",
  ];
  const misplacedRootServerEnv = findSnapshotEntries(snapshots.frontendSnapshots, apiServerKeys);

  console.log("[diagnose-api-env] Frontend env search order:");
  snapshots.searchedFiles.frontend.forEach((filePath) => {
    console.log(`- ${filePath}`);
  });

  console.log("[diagnose-api-env] Local API env search order:");
  snapshots.searchedFiles.api.forEach((filePath) => {
    console.log(`- ${filePath}`);
  });

  console.log("[diagnose-api-env] Ignored legacy env files:");
  snapshots.searchedFiles.ignoredLegacy.forEach((filePath) => {
    console.log(`- ${filePath}`);
  });

  console.log("[diagnose-api-env] Frontend public env sources:");
  frontendKeys.forEach((key) => {
    printKeyStatus(key, getEffectiveValue(snapshots.frontendSnapshots, key));
  });

  console.log("[diagnose-api-env] Local API server env sources:");
  apiServerKeys.forEach((key) => {
    printKeyStatus(key, getEffectiveValue(snapshots.apiSnapshots, key));
  });
  const serverKey =
    getEffectiveValue(snapshots.apiSnapshots, "SUPABASE_SERVICE_ROLE_KEY")?.value
    || getEffectiveValue(snapshots.apiSnapshots, "SUPABASE_SECRET_KEY")?.value;
  const serverKeyDescription = describeSupabaseServerKey(serverKey);
  console.log("[diagnose-api-env] Service-role key validation:");
  console.log(`- status: ${serverKeyDescription.status}`);
  if (serverKeyDescription.reason) {
    console.log(`- detail: ${serverKeyDescription.reason}`);
  }

  const ignoredLegacySecrets = findIgnoredLegacySecrets(snapshots.ignoredSnapshots, [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
  ]);
  console.log("[diagnose-api-env] Ignored legacy service-role entries:");
  if (ignoredLegacySecrets.length === 0) {
    console.log("- none");
  } else {
    ignoredLegacySecrets.forEach((entry) => {
      console.log(`- ${entry.key}: ${summarizeValue(entry.value)} from ${entry.source}`);
    });
  }

  console.log("[diagnose-api-env] Ignored root server env entries:");
  if (misplacedRootServerEnv.length === 0) {
    console.log("- none");
  } else {
    misplacedRootServerEnv.forEach((entry) => {
      console.log(`- ${entry.key}: ${summarizeValue(entry.value)} from ${entry.source}`);
    });
  }

  const publicUrl = getEffectiveValue(snapshots.frontendSnapshots, "VITE_SUPABASE_URL")?.value;
  const serverUrl = getEffectiveValue(snapshots.apiSnapshots, "SUPABASE_URL")?.value || publicUrl;
  const projectAlignment = compareSupabaseProjectRefs(publicUrl, serverUrl);
  console.log("[diagnose-api-env] Supabase project alignment:");
  console.log(`- public project ref: ${projectAlignment.publicProjectRef || "<missing>"}`);
  console.log(`- server project ref: ${projectAlignment.serverProjectRef || "<missing>"}`);
  console.log(`- project refs match: ${projectAlignment.matches === undefined ? "<unknown>" : String(projectAlignment.matches)}`);

  const health = await fetchHealth();
  console.log("[diagnose-api-env] /healthz:");
  if (!health.ok) {
    console.log(`- unreachable: ${health.message}`);
    return;
  }

  const config = health.data?.config || {};
  const repos = health.data?.repositories || {};
  const persistence = health.data?.persistence || {};
  const runtime = health.data?.runtime || {};
  console.log(`- status: ${health.data?.status || "unknown"}`);
  console.log(`- config.supabaseProjectRef: ${config.supabaseProjectRef || "<missing>"}`);
  console.log(`- config.publicSupabaseProjectRef: ${config.publicSupabaseProjectRef || "<missing>"}`);
  console.log(`- config.projectRefMatches: ${config.projectRefMatches === undefined ? "<unknown>" : String(config.projectRefMatches)}`);
  console.log(`- config.hasServiceRoleKey: ${Boolean(config.hasServiceRoleKey)}`);
  console.log(`- config.hasUserApiEncryptionSecret: ${Boolean(config.hasUserApiEncryptionSecret)}`);
  console.log(`- config.canonicalPersistenceReady: ${Boolean(config.canonicalPersistenceReady)}`);
  console.log(`- repositories.authData: ${repos.authData || "unknown"}`);
  console.log(`- repositories.creditAccounts: ${repos.creditAccounts || "unknown"}`);
  console.log(`- repositories.creditProviders: ${repos.creditProviders || "unknown"}`);
  console.log(`- repositories.workspaceLayout: ${repos.workspaceLayout || "unknown"}`);
  console.log(`- persistence.userApiKeys: ${Boolean(persistence.userApiKeys)}`);
  console.log(`- persistence.tempUsers: ${Boolean(persistence.tempUsers)}`);
  console.log(`- persistence.credits: ${Boolean(persistence.credits)}`);
  console.log(`- persistence.creditProviders: ${Boolean(persistence.creditProviders)}`);
  console.log(`- persistence.workspaceLayout: ${Boolean(persistence.workspaceLayout)}`);
  console.log(`- runtime.allowDegradedPersistence: ${Boolean(runtime.allowDegradedPersistence)}`);
  console.log(`- runtime.blockers: ${Array.isArray(runtime.blockers) ? runtime.blockers.join(", ") || "<none>" : "<unknown>"}`);
}

run();
