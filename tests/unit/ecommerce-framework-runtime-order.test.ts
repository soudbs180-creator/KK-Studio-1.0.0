import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

test("App declares ecommerceState before syncing framework runtime refs from it", () => {
  const appSource = readSource("src/App.tsx");

  const stateIndex = appSource.indexOf(
    "const [ecommerceState, setEcommerceState] = useState<EcommerceRuntimeState>({",
  );
  const runtimeSyncEffectIndex = appSource.indexOf(
    "ecommerceFrameworkRuntimeRef.current = ecommerceState.frameworkRuntime;",
  );

  assert.notEqual(
    stateIndex,
    -1,
    "expected App.tsx to declare ecommerceState runtime state",
  );
  assert.notEqual(
    runtimeSyncEffectIndex,
    -1,
    "expected App.tsx to sync ecommerce framework runtime refs from ecommerceState",
  );
  assert.ok(
    stateIndex < runtimeSyncEffectIndex,
    "ecommerceState must be declared before any effect reads it during render",
  );
});
