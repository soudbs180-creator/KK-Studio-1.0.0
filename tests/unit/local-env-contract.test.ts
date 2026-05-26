import { readSource } from '../support/workspacePaths.js';
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
  "VITE_KK_API_BASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "PGHOST",
  "PGDATABASE",
  "PGUSER",
  "USER_API_ENCRYPTION_SECRET",
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

test("local env contract hydrates VPS API config and ignores legacy Supabase env files", () => {
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
    [
      "VITE_KK_API_BASE_URL=http://127.0.0.1:3001",
      "VITE_SUPABASE_URL=https://frontend-ref.supabase.co",
      "SUPABASE_SERVICE_ROLE_KEY=root-secret",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(tempRoot, "apps", "api", ".env.local"),
    [
      "DATABASE_URL=postgres://kk:secret@127.0.0.1:5432/kkstudio",
      "USER_API_ENCRYPTION_SECRET=api-encryption-secret",
      "SUPABASE_URL=https://ignored-api-ref.supabase.co",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(tempRoot, "server", ".env"),
    "DATABASE_URL=postgres://legacy:secret@127.0.0.1:5432/legacy\n",
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
    ],
  );
  assert.deepEqual(
    snapshots.ignoredSnapshots.map((snapshot) => snapshot.relativePath),
    [path.join("server", ".env")],
  );

  envHelper.applyPrimaryEnvToProcess(tempRoot, { preserveExisting: false });
  assert.equal(process.env.VITE_KK_API_BASE_URL, "http://127.0.0.1:3001");
  assert.equal(process.env.DATABASE_URL, "postgres://kk:secret@127.0.0.1:5432/kkstudio");
  assert.equal(process.env.USER_API_ENCRYPTION_SECRET, "api-encryption-secret");
  assert.equal(process.env.VITE_SUPABASE_URL, undefined);
  assert.equal(process.env.SUPABASE_URL, undefined);
  assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, undefined);
});

test("root frontend env files do not hydrate server-only API secrets or legacy Supabase env", () => {
  restoreTrackedEnv();
  trackedEnvKeys.forEach((key) => {
    delete process.env[key];
  });

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kk-env-contract-root-"));
  fs.mkdirSync(path.join(tempRoot, "apps", "api"), { recursive: true });

  fs.writeFileSync(
    path.join(tempRoot, ".env"),
    [
      "VITE_KK_API_BASE_URL=http://127.0.0.1:3001",
      "DATABASE_URL=postgres://root:secret@127.0.0.1:5432/wrong",
      "USER_API_ENCRYPTION_SECRET=root-secret",
      "VITE_SUPABASE_URL=https://frontend-ref.supabase.co",
      "SUPABASE_URL=https://wrong-root-ref.supabase.co",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(tempRoot, "apps", "api", ".env.local"),
    [
      "DATABASE_URL=postgres://kk:secret@127.0.0.1:5432/kkstudio",
      "USER_API_ENCRYPTION_SECRET=api-secret",
    ].join("\n"),
    "utf8",
  );

  const snapshots = envHelper.collectEnvSnapshots(tempRoot);
  const misplacedRootValues = envHelper.findSnapshotEntries(snapshots.frontendSnapshots, [
    "DATABASE_URL",
    "USER_API_ENCRYPTION_SECRET",
  ]);
  assert.deepEqual(
    misplacedRootValues.map((entry) => `${entry.key}:${entry.source}`),
    [
      "DATABASE_URL:.env",
      "USER_API_ENCRYPTION_SECRET:.env",
    ],
  );

  envHelper.applyPrimaryEnvToProcess(tempRoot, { preserveExisting: false });
  assert.equal(process.env.VITE_KK_API_BASE_URL, "http://127.0.0.1:3001");
  assert.equal(process.env.DATABASE_URL, "postgres://kk:secret@127.0.0.1:5432/kkstudio");
  assert.equal(process.env.USER_API_ENCRYPTION_SECRET, "api-secret");
  assert.equal(process.env.VITE_SUPABASE_URL, undefined);
  assert.equal(process.env.SUPABASE_URL, undefined);
});

test("runtime env helper keeps Vite public vars on explicit import.meta.env keys", () => {
  const runtimeEnvSource = fs.readFileSync(
    path.join(ROOT_DIR, "src", "utils", "runtimeEnv.ts"),
    "utf8",
  );

  assert.match(runtimeEnvSource, /import\.meta\.env\.VITE_KK_API_BASE_URL/);
  assert.match(runtimeEnvSource, /import\.meta\.env\.VITE_KK_ADMIN_URL/);
  assert.doesNotMatch(runtimeEnvSource, /import\.meta\.env\.VITE_SUPABASE_URL/);
  assert.doesNotMatch(runtimeEnvSource, /import\.meta\.env\.VITE_SUPABASE_ANON_KEY/);
  assert.match(runtimeEnvSource, /import\.meta\.env\.VITE_TURNSTILE_SITE_KEY/);
  assert.doesNotMatch(runtimeEnvSource, /const meta = import\.meta/);
  assert.doesNotMatch(runtimeEnvSource, /meta\.env;\s*$/m);
});

test(".env.example does not activate a non-local KK API base URL by default", () => {
  const source = readSource(".env.example");

  assert.doesNotMatch(
    source,
    /^VITE_KK_API_BASE_URL\s*=\s*https?:\/\/(?!localhost(?::|\/|$)|127\.|0\.0\.0\.0(?::|\/|$))/m,
  );
  assert.match(source, /^VITE_PUBLIC_API_BASE_URL\s*=\s*(?:\/api|http:\/\/localhost:8888\/api)/m);
  assert.match(source, /^EXPO_PUBLIC_API_BASE_URL\s*=\s*https:\/\/your-site\.netlify\.app\/api/m);
});
