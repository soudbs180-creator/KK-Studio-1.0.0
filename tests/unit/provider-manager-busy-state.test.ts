import assert from "node:assert/strict";
import test from "node:test";

import {
  IDLE_PROVIDER_MANAGER_BUSY_STATE,
  finishProviderManagerBusy,
  isAnyProviderManagerBusy,
  startProviderManagerBusy,
} from "../../src/services/api/providerManagerBusyState.ts";

test("provider refresh only marks the targeted provider as busy", () => {
  const busyState = startProviderManagerBusy(
    IDLE_PROVIDER_MANAGER_BUSY_STATE,
    { type: "refresh-provider", providerId: "provider-1" },
  );

  assert.equal(busyState.refreshingProviderId, "provider-1");
  assert.equal(busyState.creating, false);
  assert.equal(isAnyProviderManagerBusy(busyState), true);
});

test("finishing a provider refresh clears the targeted busy slot", () => {
  const busyState = finishProviderManagerBusy(
    {
      ...IDLE_PROVIDER_MANAGER_BUSY_STATE,
      refreshingProviderId: "provider-1",
    },
    { type: "refresh-provider", providerId: "provider-1" },
  );

  assert.equal(busyState.refreshingProviderId, null);
});
