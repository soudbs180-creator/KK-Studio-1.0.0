import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("admin model service routes background refreshes through the shared policy helper", () => {
  const serviceSource = readSource("src/services/model/adminModelService.ts");

  assert.match(
    serviceSource,
    /import \{\s*getAdminModelAutoRefreshDelay,\s*shouldStartAdminModelRefresh,\s*\} from ['"]\.\/adminModelRefreshPolicy['"];/,
  );
  assert.match(serviceSource, /private requestBackgroundRefresh\(force = false\): void \{/);
  assert.match(serviceSource, /const shouldStart = shouldStartAdminModelRefresh\(/);
  assert.match(serviceSource, /const nextDelay = delayMs \?\? getAdminModelAutoRefreshDelay\(/);
});
