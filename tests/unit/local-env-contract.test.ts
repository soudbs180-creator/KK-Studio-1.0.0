import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { after, test } from "node:test";

const ROOT_DIR = process.cwd();
const helperModuleUrl = pathToFileURL(path.join(ROOT_DIR, "scripts", "lib", "env-contract.mjs")).href;
const envHelper = await import(helperModuleUrl);

const trackedEnvKeys = [
  "VITE_SUPABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const originalEnv = new Map(trackedEnvKeys.map((key) => [key, process.env[key]]));

function restoreTrackedEnv() {
  trackedEnvKeys.forEach((key) => {
    const originalValue = originalEnv.get(key);
    if (typeof originalValue === "string") {
      process.env[key] = originalValue;
    } else {
      delete process.env[key];
    }
  });
}

after(() => {
  restoreTrackedEnv();
});

test("local env contract ignores legacy server env files for active API config", () => {
  restoreTrackedEnv();
  trackedEnvKeys.forEach((key) => {
    delete process.env[key];
  });

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kk-env-contract-"));
  fs.mkdirSync(path.join(tempRoot, "apps", "api"), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, "server"), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, "supabase"), { recursive: true });

  fs.writeFileSync(
    path.join(tempRoot, ".env"),
    "VITE_SUPABASE_URL=https://frontend-ref.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=root-secret\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(tempRoot, "apps", "api", ".env.local"),
    "SUPABASE_URL=https://frontend-ref.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=api-secret\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(tempRoot, "server", ".env"),
    "SUPABASE_SERVICE_ROLE_KEY=server-only-secret\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(tempRoot, "supabase", ".env.functions.local"),
    "SUPABASE_SERVICE_ROLE_KEY=function-secret\n",
    "utf8",
  );

  const snapshots = envHelper.collectEnvSnapshots(tempRoot, { includeFunctionEnv: true });
  assert.deepEqual(
    snapshots.activeSnapshots.map((snapshot) => snapshot.relativePath),
    [
      ".env",
      path.join("apps", "api", ".env.local"),
      path.join("supabase", ".env.functions.local"),
    ],
  );
  assert.deepEqual(
    snapshots.ignoredSnapshots.map((snapshot) => snapshot.relativePath),
    [path.join("server", ".env")],
  );

  envHelper.applyPrimaryEnvToProcess(tempRoot, { preserveExisting: false });
  assert.equal(process.env.VITE_SUPABASE_URL, "https://frontend-ref.supabase.co");
  assert.equal(process.env.SUPABASE_URL, "https://frontend-ref.supabase.co");
  assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, "api-secret");

  const alignment = envHelper.compareSupabaseProjectRefs(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_URL,
  );
  assert.equal(alignment.publicProjectRef, "frontend-ref");
  assert.equal(alignment.serverProjectRef, "frontend-ref");
  assert.equal(alignment.matches, true);
});

test("root frontend env files do not hydrate server-only API secrets", () => {
  restoreTrackedEnv();
  trackedEnvKeys.forEach((key) => {
    delete process.env[key];
  });

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kk-env-contract-root-"));
  fs.mkdirSync(path.join(tempRoot, "apps", "api"), { recursive: true });

  fs.writeFileSync(
    path.join(tempRoot, ".env"),
    [
      "VITE_SUPABASE_URL=https://frontend-ref.supabase.co",
      "SUPABASE_URL=https://wrong-root-ref.supabase.co",
      "SUPABASE_SERVICE_ROLE_KEY=root-secret",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(tempRoot, "apps", "api", ".env.local"),
    "SUPABASE_URL=https://frontend-ref.supabase.co\n",
    "utf8",
  );

  const snapshots = envHelper.collectEnvSnapshots(tempRoot);
  const misplacedRootValues = envHelper.findSnapshotEntries(snapshots.frontendSnapshots, [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
  assert.deepEqual(
    misplacedRootValues.map((entry) => `${entry.key}:${entry.source}`),
    [
      "SUPABASE_URL:.env",
      "SUPABASE_SERVICE_ROLE_KEY:.env",
    ],
  );

  envHelper.applyPrimaryEnvToProcess(tempRoot, { preserveExisting: false });
  assert.equal(process.env.VITE_SUPABASE_URL, "https://frontend-ref.supabase.co");
  assert.equal(process.env.SUPABASE_URL, "https://frontend-ref.supabase.co");
  assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, undefined);
});
