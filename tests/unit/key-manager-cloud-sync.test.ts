import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clearCloudSyncPendingFlagsOnRevisionMatch,
  createKeyManagerCloudSyncState,
  hasPendingCloudSync,
  markPendingProviderCloudSync,
  markPendingStateCloudSync,
  resetCloudSyncState,
} from "../../src/services/auth/keyManagerCloudSync.ts";

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
