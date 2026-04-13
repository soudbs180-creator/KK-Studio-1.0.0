import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  clearCloudSyncPendingFlagsOnRevisionMatch,
  createKeyManagerCloudSyncState,
  hasPendingCloudSync,
  markPendingProviderCloudSync,
  markPendingStateCloudSync,
  resetCloudSyncState,
} from "../../src/services/auth/keyManagerCloudSync.ts";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("cloud sync helper tracks pending state and revision changes", () => {
  const state = createKeyManagerCloudSyncState();

  assert.equal(hasPendingCloudSync(state), false);
  assert.equal(markPendingStateCloudSync(state), 1);
  assert.equal(state.pendingStateCloudSync, true);
  assert.equal(hasPendingCloudSync(state), true);

  assert.equal(markPendingProviderCloudSync(state), 2);
  assert.equal(state.pendingProviderCloudSync, true);
  assert.equal(state.cloudSyncRevision, 2);
});

test("cloud sync helper only clears pending flags for the matching revision", () => {
  const state = createKeyManagerCloudSyncState();
  markPendingStateCloudSync(state);
  markPendingProviderCloudSync(state);

  clearCloudSyncPendingFlagsOnRevisionMatch(state, 1);
  assert.equal(state.pendingStateCloudSync, true);
  assert.equal(state.pendingProviderCloudSync, true);

  clearCloudSyncPendingFlagsOnRevisionMatch(state, 2);
  assert.equal(state.pendingStateCloudSync, false);
  assert.equal(state.pendingProviderCloudSync, false);
});

test("cloud sync helper can fully reset state", () => {
  const state = createKeyManagerCloudSyncState();
  markPendingStateCloudSync(state);
  markPendingProviderCloudSync(state);

  resetCloudSyncState(state);
  assert.equal(state.pendingStateCloudSync, false);
  assert.equal(state.pendingProviderCloudSync, false);
  assert.equal(state.cloudSyncRevision, 0);
});

test("cloud sync entry points force-refresh the local API payload without skipping fixed local users", () => {
  const source = readSource("src/services/auth/keyManager.ts");

  assert.match(source, /async syncToCloudNow\(\): Promise<void> \{\s*await this\.saveToCloud\(this\.state, \{\s*ignoreBackoff: true,\s*throwOnError: true,\s*\}\);\s*\}/);
  assert.match(source, /async refreshFromCloudNow\(\): Promise<void> \{\s*if \(!this\.userId\) \{\s*return;\s*\}\s*\s*await this\.loadFromCloud\(\);\s*\}/);
  assert.doesNotMatch(source, /async refreshFromCloudNow\(\): Promise<void> \{\s*if \(!this\.userId \|\| this\.userId\.startsWith\('dev-user-'\)\) \{/);
  assert.doesNotMatch(source, /private ensureCloudHydration\(\): void \{\s*if \(!this\.userId \|\| this\.userId\.startsWith\('dev-user-'\)\) \{/);
});
