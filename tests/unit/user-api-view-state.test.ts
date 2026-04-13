import assert from "node:assert/strict";
import test from "node:test";

import { resolveUserApiViewState } from "../../src/services/api/userApiViewState.ts";

test("readonly snapshot hydration stays interactive when display data exists", () => {
  const viewState = resolveUserApiViewState({
    hasReadonlySnapshot: true,
    isApiReachable: true,
    isAuthenticated: true,
    isPersistenceDegraded: false,
    runtimeOfficialCount: 0,
    runtimeProviderCount: 0,
  });

  assert.equal(viewState.isHydratingRuntimeUserApis, true);
  assert.equal(viewState.stage, "syncing");
  assert.equal(viewState.userApiActionsDisabled, false);
  assert.equal(viewState.providerActionsDisabled, false);
  assert.equal(viewState.userApiEditorDisabled, false);
  assert.equal(viewState.providerEditorReadOnly, false);
  assert.equal(viewState.shouldUseReadonlySnapshotForDisplay, true);
});

test("unauthenticated users still stay blocked", () => {
  const viewState = resolveUserApiViewState({
    hasReadonlySnapshot: true,
    isApiReachable: true,
    isAuthenticated: false,
    isPersistenceDegraded: false,
    runtimeOfficialCount: 0,
    runtimeProviderCount: 0,
  });

  assert.equal(viewState.userApiActionsDisabled, true);
  assert.equal(viewState.stage, "unauthenticated");
  assert.equal(viewState.providerActionsDisabled, true);
  assert.equal(viewState.userApiEditorDisabled, true);
  assert.equal(viewState.providerEditorReadOnly, true);
});

test("authenticated users stay editable when the API server is unreachable but readonly snapshots are available", () => {
  const viewState = resolveUserApiViewState({
    hasReadonlySnapshot: true,
    isApiReachable: false,
    isAuthenticated: true,
    isPersistenceDegraded: true,
    runtimeOfficialCount: 0,
    runtimeProviderCount: 0,
  });

  assert.equal(viewState.userApiActionsDisabled, false);
  assert.equal(viewState.stage, "readonly-fallback");
  assert.equal(viewState.providerActionsDisabled, false);
  assert.equal(viewState.userApiEditorDisabled, false);
  assert.equal(viewState.providerEditorReadOnly, false);
  assert.equal(viewState.shouldUseReadonlySnapshotForDisplay, true);
});

test("authenticated users remain editable during degraded persistence when the API server is still reachable", () => {
  const viewState = resolveUserApiViewState({
    hasReadonlySnapshot: false,
    isApiReachable: true,
    isAuthenticated: true,
    isPersistenceDegraded: true,
    runtimeOfficialCount: 1,
    runtimeProviderCount: 1,
  });

  assert.equal(viewState.userApiActionsDisabled, false);
  assert.equal(viewState.stage, "editable");
  assert.equal(viewState.providerActionsDisabled, false);
  assert.equal(viewState.userApiEditorDisabled, false);
  assert.equal(viewState.providerEditorReadOnly, false);
  assert.equal(viewState.shouldUseReadonlySnapshotForDisplay, false);
});

test("authenticated users enter local-api-unavailable mode when runtime is down and no readonly snapshot exists", () => {
  const viewState = resolveUserApiViewState({
    hasReadonlySnapshot: false,
    isApiReachable: false,
    isAuthenticated: true,
    isPersistenceDegraded: true,
    runtimeOfficialCount: 0,
    runtimeProviderCount: 0,
  });

  assert.equal(viewState.stage, "local-api-unavailable");
  assert.equal(viewState.userApiActionsDisabled, false);
  assert.equal(viewState.providerActionsDisabled, false);
  assert.equal(viewState.shouldUseReadonlySnapshotForDisplay, false);
});
