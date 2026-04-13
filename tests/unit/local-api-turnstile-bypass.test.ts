import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, test } from "node:test";

const ROOT_DIR = process.cwd();
const bootstrapModuleUrl = pathToFileURL(
  path.join(ROOT_DIR, "scripts", "lib", "local-api-bootstrap.mjs"),
).href;
const bootstrapModule = await import(bootstrapModuleUrl);

const trackedEnvKeys = [
  "VITE_TURNSTILE_LOCAL_BYPASS",
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

test("local API turnstile bypass stays disabled until explicitly enabled", () => {
  delete process.env.VITE_TURNSTILE_LOCAL_BYPASS;

  const verifier = bootstrapModule.resolveLocalApiTurnstileVerifier(process.env);
  assert.equal(verifier, undefined);
});

test("local API turnstile bypass verifier succeeds when the local bypass flag is enabled", async () => {
  process.env.VITE_TURNSTILE_LOCAL_BYPASS = "true";

  const verifier = bootstrapModule.resolveLocalApiTurnstileVerifier(process.env);
  assert.equal(typeof verifier, "function");

  const result = await verifier("local-turnstile-bypass", "127.0.0.1");
  assert.deepEqual(result, { success: true });
});
