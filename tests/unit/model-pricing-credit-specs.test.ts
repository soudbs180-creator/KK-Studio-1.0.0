import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildCreditModelCatalog,
  pickCreditModelSpec,
  pickCreditRouteUnit,
} from "../../apps/web/src/services/model/adminRouteUnits.ts";

describe("admin credit model specs", () => {
  test("expands advanced quality pricing into size-specific specs", () => {
    const catalog = buildCreditModelCatalog([
      {
        id: "nano-banana-pro",
        displayName: "Nano Banana Pro",
        provider: "system",
        providerId: "provider-a",
        providerName: "Provider A",
        creditCost: 2,
        advancedEnabled: true,
        qualityPricing: {
          "0.5K": { enabled: true, creditCost: 1 },
          "1K": { enabled: true, creditCost: 2 },
          "2K": { enabled: true, creditCost: 4 },
          "4K": { enabled: false, creditCost: 8 },
        },
        billingType: "per_request",
        endpoint: "image-generation",
        isSystemModel: true,
      },
    ]);

    assert.equal(catalog.length, 1);
    assert.deepEqual(
      catalog[0].specs.map((spec) => ({
        sizeSpec: spec.sizeSpec,
        creditPrice: spec.creditPrice,
        enabled: spec.enabled,
      })),
      [
        { sizeSpec: "0.5K", creditPrice: 1, enabled: true },
        { sizeSpec: "1K", creditPrice: 2, enabled: true },
        { sizeSpec: "2K", creditPrice: 4, enabled: true },
        { sizeSpec: "4K", creditPrice: 8, enabled: false },
      ],
    );
  });

  test("keeps one default route unit per flat admin model row", () => {
    const catalog = buildCreditModelCatalog([
      {
        id: "nano-banana-pro",
        displayName: "Nano Banana Pro",
        provider: "system",
        providerId: "provider-a",
        providerName: "Provider A",
        creditCost: 2,
        advancedEnabled: false,
        billingType: "per_request",
        endpoint: "image-generation-async",
        isSystemModel: true,
      },
    ]);

    assert.equal(catalog[0].specs.length, 1);
    assert.equal(catalog[0].specs[0].routeUnits.length, 1);
    assert.equal(catalog[0].specs[0].routeUnits[0].requestProfileId, "12ai");
    assert.equal(catalog[0].specs[0].routeUnits[0].requestSurface, "async-image");
  });

  test("selects the matching size spec when one exists", () => {
    const catalog = buildCreditModelCatalog([
      {
        id: "nano-banana-pro",
        displayName: "Nano Banana Pro",
        provider: "system",
        providerId: "provider-a",
        providerName: "Provider A",
        creditCost: 2,
        advancedEnabled: true,
        qualityPricing: {
          "0.5K": { enabled: true, creditCost: 1 },
          "1K": { enabled: true, creditCost: 2 },
          "2K": { enabled: true, creditCost: 4 },
          "4K": { enabled: true, creditCost: 8 },
        },
        billingType: "per_request",
        endpoint: "image-generation",
        isSystemModel: true,
      },
    ]);

    const spec = pickCreditModelSpec(catalog[0], "2K");
    assert.equal(spec?.sizeSpec, "2K");
    assert.equal(spec?.creditPrice, 4);
  });

  test("prefers the matching supplier route unit when a preferred supplier id is provided", () => {
    const catalog = buildCreditModelCatalog([
      {
        id: "nano-banana-pro",
        displayName: "Nano Banana Pro",
        provider: "system",
        providerId: "provider-a",
        providerName: "Provider A",
        creditCost: 2,
        advancedEnabled: false,
        billingType: "per_request",
        endpoint: "image-generation",
        isSystemModel: true,
        priority: 10,
        weight: 1,
        mixWithSameModel: true,
      },
      {
        id: "nano-banana-pro",
        displayName: "Nano Banana Pro",
        provider: "system",
        providerId: "provider-b",
        providerName: "Provider B",
        creditCost: 2,
        advancedEnabled: false,
        billingType: "per_request",
        endpoint: "image-generation",
        isSystemModel: true,
        priority: 5,
        weight: 1,
        mixWithSameModel: true,
      },
    ]);

    const spec = pickCreditModelSpec(catalog[0], "1K");
    const routeUnit = pickCreditRouteUnit(spec, "provider-b");
    assert.equal(routeUnit?.supplierId, "provider-b");
  });

  test("keeps an explicit request profile id when admin data already provides one", () => {
    const catalog = buildCreditModelCatalog([
      {
        id: "nano-banana-pro",
        displayName: "Nano Banana Pro",
        provider: "system",
        providerId: "provider-a",
        providerName: "Provider A",
        requestProfileId: "gpt-best",
        routeStrategy: "priority-failover",
        creditCost: 2,
        advancedEnabled: false,
        billingType: "per_request",
        endpoint: "image-generation",
        isSystemModel: true,
      },
    ]);

    assert.equal(catalog[0].specs[0].routeStrategy, "priority-failover");
    assert.equal(catalog[0].specs[0].routeUnits[0].requestProfileId, "gpt-best");
  });
});
