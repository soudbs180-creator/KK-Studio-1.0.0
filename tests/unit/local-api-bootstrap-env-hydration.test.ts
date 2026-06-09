import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, test } from "node:test";

const ROOT_DIR = process.cwd();
const bootstrapModuleUrl = pathToFileURL(
  path.join(ROOT_DIR, "scripts", "lib", "local-api-bootstrap.mjs"),
).href;
const bootstrapModule = await import(bootstrapModuleUrl);

const trackedEnvKeys = [
  "PORT",
  "RUN_KK_API_SKELETON",
  "VITE_KK_API_BASE_URL",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "DATABASE_URL",
  "USER_API_ENCRYPTION_SECRET",
  "KK_API_MAX_JSON_BODY_BYTES",
  "KK_API_PROFILE_MAX_JSON_BODY_BYTES",
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

afterEach(() => {
  restoreTrackedEnv();
});

test("local API bootstrap hydrates server env files before local-only startup", async () => {
  restoreTrackedEnv();
  trackedEnvKeys.forEach((key) => {
    delete process.env[key];
  });

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kk-local-api-bootstrap-"));
  fs.mkdirSync(path.join(tempRoot, "server"), { recursive: true });

  fs.writeFileSync(
    path.join(tempRoot, ".env.local"),
    [
      "VITE_KK_API_BASE_URL=http://127.0.0.1:3001",
      "VITE_SUPABASE_URL=https://legacy-ref.supabase.co",
      "VITE_SUPABASE_ANON_KEY=legacy-public-anon-key",
    ].join("\n"),
    "utf8",
  );

  fs.writeFileSync(
    path.join(tempRoot, "server", ".env.local"),
    [
      "DATABASE_URL=postgres://kk:secret@127.0.0.1:5432/kkstudio",
      "SUPABASE_URL=https://legacy-api-ref.supabase.co",
      "USER_API_ENCRYPTION_SECRET=local-encryption-secret",
    ].join("\n"),
    "utf8",
  );

  fs.writeFileSync(
    path.join(tempRoot, "server", "index.js"),
    [
      "exports.startServer = function startServer(port) {",
      "  return {",
      "    port,",
      "    env: {",
      "      VITE_KK_API_BASE_URL: process.env.VITE_KK_API_BASE_URL || null,",
      "      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || null,",
      "      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || null,",
      "      SUPABASE_URL: process.env.SUPABASE_URL || null,",
      "      DATABASE_URL: process.env.DATABASE_URL || null,",
      "      USER_API_ENCRYPTION_SECRET: process.env.USER_API_ENCRYPTION_SECRET || null,",
      "      KK_API_MAX_JSON_BODY_BYTES: process.env.KK_API_MAX_JSON_BODY_BYTES || null,",
      "      KK_API_PROFILE_MAX_JSON_BODY_BYTES: process.env.KK_API_PROFILE_MAX_JSON_BODY_BYTES || null,",
      "      RUN_KK_API_SKELETON: process.env.RUN_KK_API_SKELETON || null,",
      "      PORT: process.env.PORT || null,",
      "    },",
      "  };",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = await bootstrapModule.startLocalApiServer({
      repoRoot: tempRoot,
      skipConfigCheck: true,
      port: 0,
    });

    assert.equal(result.port, 0);
    assert.deepEqual(result.env, {
      VITE_KK_API_BASE_URL: "http://127.0.0.1:3001",
      VITE_SUPABASE_URL: null,
      VITE_SUPABASE_ANON_KEY: null,
      SUPABASE_URL: null,
      DATABASE_URL: "postgres://kk:secret@127.0.0.1:5432/kkstudio",
      USER_API_ENCRYPTION_SECRET: "local-encryption-secret",
      KK_API_MAX_JSON_BODY_BYTES: "1048576",
      KK_API_PROFILE_MAX_JSON_BODY_BYTES: "4194304",
      RUN_KK_API_SKELETON: "false",
      PORT: "0",
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
