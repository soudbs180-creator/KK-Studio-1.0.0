import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveApiWorkbenchDiagnosticsAvailability,
  resolveApiWorkbenchStageMeta,
} from "../../src/components/settings/apiWorkbenchState.ts";

const pick = (zhText: string, enText: string) => enText;

test("diagnostics mode keeps the underlying workbench stage contract intact", () => {
  const meta = resolveApiWorkbenchStageMeta({
    activeTab: "official",
    pick,
    showDiagnostics: true,
    stage: "editable",
    snapshotHydrationHelper: "syncing helper",
    userApiPersistenceWarning: null,
    userApiPersistenceHelper: null,
    backendUnavailableHelper: null,
    userApiActionHelper: null,
  });

  assert.equal(meta.stage, "editable");
  assert.equal(meta.interactionLabel, "Editable");
  assert.equal(meta.primaryActionKind, "create-official");
  assert.equal(meta.nextActionLabel, "Add local API");
});

test("diagnostics refresh stays available when runtime is down even though route diagnostics stay locked", () => {
  const availability = resolveApiWorkbenchDiagnosticsAvailability({
    isAuthenticated: true,
    isApiReachable: false,
  });

  assert.equal(availability.refreshDisabled, false);
  assert.equal(availability.routeActionsDisabled, true);
});
