import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

test("App declares ecommerceState before initializing framework runtime state hook", () => {
  const appSource = readSource("src/App.tsx");
  const hookSource = readSource("src/app/useEcommerceFrameworkRuntimeState.ts");

  const stateIndex = appSource.indexOf(
    "const [ecommerceState, setEcommerceState] = useState<EcommerceRuntimeState>({",
  );
  const frameworkStateHookIndex = appSource.indexOf(
    "const frameworkStateView = useEcommerceFrameworkRuntimeState({",
  );
  const runtimeSyncEffectIndex = hookSource.search(
    /ecommerceFrameworkRuntimeRef\.current = ecommerceState\.frameworkRuntime(?: \|\| \{\})?;/,
  );

  assert.notEqual(
    stateIndex,
    -1,
    "expected App.tsx to declare ecommerceState runtime state",
  );
  assert.notEqual(
    frameworkStateHookIndex,
    -1,
    "expected App.tsx to initialize ecommerce framework runtime state hook",
  );
  assert.notEqual(
    runtimeSyncEffectIndex,
    -1,
    "expected framework runtime state hook to sync runtime refs from ecommerceState",
  );
  assert.ok(
    stateIndex < frameworkStateHookIndex,
    "ecommerceState must be declared before the framework runtime state hook reads it",
  );
});
