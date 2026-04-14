import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import {
  adminModelService,
  type AdminModelConfig,
  type AdminProvider,
} from "../../src/services/model/adminModelService.ts";
import {
  buildCreditModelCatalog,
  type CreditModelCatalogEntry,
} from "../../src/services/model/adminRouteUnits.ts";
import type { AdminModelQualityPricing } from "../../src/services/model/adminModelQuality.ts";

type AdminModelServiceHarness = {
  providers: AdminProvider[];
  models: AdminModelConfig[];
  creditCatalog: CreditModelCatalogEntry[];
};

const serviceHarness = adminModelService as unknown as AdminModelServiceHarness;
const originalProviders = serviceHarness.providers;
const originalModels = serviceHarness.models;
const originalCreditCatalog = serviceHarness.creditCatalog;

function createQualityPricing(baseCreditCost: number): AdminModelQualityPricing {
  return {
    "0.5K": { enabled: true, creditCost: Math.max(1, Math.floor(baseCreditCost / 2)) },
    "1K": { enabled: true, creditCost: baseCreditCost },
    "2K": { enabled: true, creditCost: baseCreditCost * 2 },
    "4K": { enabled: false, creditCost: baseCreditCost * 4 },
  };
}

function createAdminModelConfig(overrides: Partial<AdminModelConfig>): AdminModelConfig {
  const providerId = overrides.providerId || "provider-a";
  const providerName = overrides.providerName || "Provider A";
  const creditCost = overrides.creditCost ?? 2;

  return {
    id: "nano-banana-pro",
    displayName: "Nano Banana Pro",
    provider: providerId,
    providerId,
    providerName,
    requestProfileId: overrides.requestProfileId,
    routeStrategy: overrides.routeStrategy,
    recordId: overrides.recordId,
    priority: overrides.priority ?? 0,
    weight: overrides.weight ?? 1,
    callCount: overrides.callCount ?? 0,
    colorStart: overrides.colorStart || "#2563EB",
    colorEnd: overrides.colorEnd || "#1D4ED8",
    colorSecondary: overrides.colorSecondary || "#1D4ED8",
    textColor: overrides.textColor || "white",
    creditCost,
    advancedEnabled: overrides.advancedEnabled ?? true,
    mixWithSameModel: overrides.mixWithSameModel ?? true,
    qualityPricing: overrides.qualityPricing || createQualityPricing(creditCost),
    billingType: overrides.billingType || "per_request",
    endpoint: overrides.endpoint || "image-generation",
    advantages: overrides.advantages || "",
    isSystemModel: overrides.isSystemModel ?? true,
    isSystemInternal: overrides.isSystemInternal ?? true,
  };
}

function seedCreditCatalog(models: AdminModelConfig[]): void {
  serviceHarness.providers = [];
  serviceHarness.models = models;
  serviceHarness.creditCatalog = buildCreditModelCatalog(models);
}

afterEach(() => {
  serviceHarness.providers = originalProviders;
  serviceHarness.models = originalModels;
  serviceHarness.creditCatalog = originalCreditCatalog;
});

describe("adminModelService credit route helpers", () => {
  test("getCreditModelSpec strips route suffixes and returns the requested quality spec", () => {
    seedCreditCatalog([
      createAdminModelConfig({
        providerId: "provider-a",
        providerName: "Provider A",
        requestProfileId: "gpt-best",
        routeStrategy: "priority-failover",
      }),
    ]);

    const spec = adminModelService.getCreditModelSpec("nano-banana-pro@system_provider-a", "2K");

    assert.ok(spec);
    assert.equal(spec?.id, "nano-banana-pro:2K");
    assert.equal(spec?.sizeSpec, "2K");
    assert.equal(spec?.creditPrice, 4);
    assert.equal(spec?.routeUnits[0]?.requestProfileId, "gpt-best");
  });

  test("getCreditRouteSnapshot returns the resolved route unit for the selected supplier", () => {
    seedCreditCatalog([
      createAdminModelConfig({
        providerId: "provider-a",
        providerName: "Provider A",
        creditCost: 3,
        routeStrategy: "weighted-random",
      }),
      createAdminModelConfig({
        providerId: "provider-b",
        providerName: "Provider B",
        creditCost: 1,
        routeStrategy: "weighted-random",
      }),
    ]);

    const snapshot = adminModelService.getCreditRouteSnapshot(
      "nano-banana-pro@system_provider-b",
      "1K",
    );

    assert.deepEqual(snapshot, {
      specId: "nano-banana-pro:1K",
      routeStrategy: "weighted-random",
      routeUnitId: "nano-banana-pro:provider-b:1K",
      supplierId: "provider-b",
    });
  });
});
