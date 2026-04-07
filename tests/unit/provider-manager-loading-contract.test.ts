import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("ThirdPartyProviderManager uses keyed busy state instead of one global loading flag", () => {
  const source = readSource("src/components/api/ThirdPartyProviderManager.tsx");

  assert.match(
    source,
    /import \{[\s\S]*IDLE_PROVIDER_MANAGER_BUSY_STATE,[\s\S]*isAnyProviderManagerBusy,[\s\S]*startProviderManagerBusy,[\s\S]*\} from '\.\.\/\.\.\/services\/api\/providerManagerBusyState';/,
  );
  assert.match(source, /const \[busyState, setBusyState\] = useState\(IDLE_PROVIDER_MANAGER_BUSY_STATE\);/);
  assert.match(source, /const withBusyState = async <T,>\(/);
  assert.match(source, /const hasBusyActions = isAnyProviderManagerBusy\(busyState\);/);
  assert.doesNotMatch(source, /const \[isLoading, setIsLoading\] = useState\(false\);/);
});
