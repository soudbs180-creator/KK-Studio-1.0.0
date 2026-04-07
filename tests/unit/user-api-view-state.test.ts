import assert from "node:assert/strict";
import test from "node:test";

import { resolveUserApiViewState } from "../../src/services/api/userApiViewState.ts";

test("readonly snapshot hydration stays interactive when display data exists", () => {
  const viewState = resolveUserApiViewState({
    hasReadonlySnapshot: true,
    isAuthenticated: true,
    isPersistenceDegraded: false,
    runtimeOfficialCount: 0,
    runtimeProviderCount: 0,
  });

  assert.equal(viewState.isHydratingRuntimeUserApis, true);
  assert.equal(viewState.userApiActionsDisabled, false);
  assert.equal(viewState.providerActionsDisabled, false);
  assert.equal(viewState.userApiEditorDisabled, false);
  assert.equal(viewState.providerEditorReadOnly, false);
  assert.equal(viewState.shouldUseReadonlySnapshotForDisplay, true);
});

test("unauthenticated users still stay blocked", () => {
  const viewState = resolveUserApiViewState({
    hasReadonlySnapshot: true,
    isAuthenticated: false,
    isPersistenceDegraded: false,
    runtimeOfficialCount: 0,
    runtimeProviderCount: 0,
  });

  assert.equal(viewState.userApiActionsDisabled, true);
  assert.equal(viewState.providerActionsDisabled, true);
  assert.equal(viewState.userApiEditorDisabled, true);
  assert.equal(viewState.providerEditorReadOnly, true);
});
