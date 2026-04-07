import assert from "node:assert/strict";
import test from "node:test";

import { refreshAdminModelCatalogSafely } from "../../src/services/model/adminModelCatalogRefresh.ts";

test("refreshAdminModelCatalogSafely resolves ok when both refresh steps succeed", async () => {
  const calls: string[] = [];

  const result = await refreshAdminModelCatalogSafely({
    forceLoadAdminModels: async () => {
      calls.push("force");
    },
    refreshUnifiedModels: async () => {
      calls.push("unified");
    },
  });

  assert.deepEqual(calls, ["force", "unified"]);
  assert.deepEqual(result, { ok: true });
});

test("refreshAdminModelCatalogSafely keeps provider saves non-fatal when the catalog refresh fails", async () => {
  const result = await refreshAdminModelCatalogSafely({
    forceLoadAdminModels: async () => {
      throw new Error("active credit models endpoint is temporarily unavailable");
    },
    refreshUnifiedModels: async () => {
      throw new Error("should not run after the first failure");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.message, "active credit models endpoint is temporarily unavailable");
});

test("refreshAdminModelCatalogSafely falls back to a generic message for unknown failures", async () => {
  const result = await refreshAdminModelCatalogSafely({
    forceLoadAdminModels: async () => {
      return;
    },
    refreshUnifiedModels: async () => {
      throw "unexpected";
    },
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.message,
    "The model catalog could not be refreshed after the provider change.",
  );
});
