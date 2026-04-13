import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import type {
  SaveAdminCreditProviderRequestDto,
  UpsertProviderPricingCacheRequestDto,
} from "../../packages/contracts/src/index.ts";
import {
  InMemoryCreditProviderRepository,
} from "../../apps/api/src/modules/model-catalog/infrastructure/in-memory-credit-provider-repository.ts";
import {
  PostgresCreditProviderRepository,
  createCreditProviderRepositoryFromEnv,
} from "../../apps/api/src/modules/model-catalog/infrastructure/postgres-credit-provider-repository.ts";
import { buildSharedPricingCacheProviderId } from "../../apps/api/src/modules/model-catalog/infrastructure/provider-pricing-cache-key.ts";

interface RecordedQuery {
  sql: string;
  values: unknown[];
}

class FakeQueryable {
  readonly queries: RecordedQuery[] = [];
  nextRowsQueue: unknown[][] = [];

  async query(sql: string, values: unknown[] = []) {
    this.queries.push({ sql, values });
    const rows = this.nextRowsQueue.length > 0 ? this.nextRowsQueue.shift()! : [];
    return { rows };
  }
}

const databaseUrlEnv = "DATABASE_URL";
const originalDatabaseUrl = process.env[databaseUrlEnv];

afterEach(() => {
  if (typeof originalDatabaseUrl === "string") {
    process.env[databaseUrlEnv] = originalDatabaseUrl;
  } else {
    delete process.env[databaseUrlEnv];
  }
});

function buildProviderInput(): SaveAdminCreditProviderRequestDto {
  return {
    providerName: "Provider One",
    baseUrl: "https://api.example.com/v1",
    apiKeys: ["sk-provider-1"],
    retainApiKeyFingerprints: [],
    models: [
      {
        modelId: "gpt-4.1",
        displayName: "GPT-4.1",
        endpointType: "openai",
        creditCost: 3,
        isActive: true,
        maxCallsLimit: null,
        autoPauseOnLimit: false,
        priority: 10,
        weight: 100,
        advancedEnabled: false,
        mixWithSameModel: false,
      },
    ],
  };
}

function buildPricingInput(): UpsertProviderPricingCacheRequestDto {
  return {
    pricing: [
      {
        modelId: "gpt-4.1",
        modelName: "GPT-4.1",
        inputPrice: 1.2,
        outputPrice: 3.4,
        isPerToken: true,
        currency: "USD",
      },
    ],
  };
}

test("Postgres credit provider repository saves provider rows and pricing cache", async () => {
  const fakeQueryable = new FakeQueryable();
  const repository = new PostgresCreditProviderRepository(fakeQueryable as never);

  await repository.saveAdminProvider("provider-1", buildProviderInput());
  await repository.saveProviderPricingCache("provider-1", buildPricingInput());

  assert.ok(fakeQueryable.queries.some((entry) => /delete from admin_credit_models/i.test(entry.sql)));
  assert.ok(fakeQueryable.queries.some((entry) => /insert into admin_credit_models/i.test(entry.sql)));
  assert.ok(fakeQueryable.queries.some((entry) => /insert into provider_pricing_cache/i.test(entry.sql)));
});

test("Postgres credit provider repository maps grouped provider rows and active models", async () => {
  const fakeQueryable = new FakeQueryable();
  fakeQueryable.nextRowsQueue = [
    [
      {
        provider_id: "provider-1",
        provider_name: "Provider One",
        base_url: "https://api.example.com/v1",
        api_keys: ["sk-provider-1"],
        model_id: "gpt-4.1",
        display_name: "GPT-4.1",
        description: null,
        endpoint_type: "openai",
        credit_cost: 3,
        priority: 10,
        weight: 100,
        is_active: true,
        call_count: 2,
        max_calls_limit: null,
        color: null,
        color_secondary: null,
        text_color: null,
        advanced_enabled: false,
        mix_with_same_model: false,
        quality_pricing: null,
      },
    ],
    [
      {
        provider_id: "provider-1",
        provider_name: "Provider One",
        model_id: "gpt-4.1",
        display_name: "GPT-4.1",
        description: null,
        endpoint_type: "openai",
        credit_cost: 3,
        priority: 10,
        weight: 100,
        call_count: 2,
        color: null,
        color_secondary: null,
        text_color: null,
        advanced_enabled: false,
        mix_with_same_model: false,
        quality_pricing: null,
      },
    ],
  ];
  const repository = new PostgresCreditProviderRepository(fakeQueryable as never);

  const providers = await repository.listAdminProviders();
  const active = await repository.listActiveCreditModels();

  assert.equal(providers.length, 1);
  assert.equal(providers[0].providerId, "provider-1");
  assert.equal(providers[0].models.length, 1);
  assert.equal(active.length, 1);
  assert.equal(active[0].providerId, "provider-1");
  assert.equal(active[0].models[0].modelId, "gpt-4.1");
});

test("Postgres credit provider repository reads shared pricing cache by baseUrl hash", async () => {
  const fakeQueryable = new FakeQueryable();
  const baseUrl = "https://api.example.com/v1";
  fakeQueryable.nextRowsQueue = [[
    {
      provider_id: buildSharedPricingCacheProviderId(baseUrl),
      pricing_json: buildPricingInput().pricing,
      cached_at: "2026-04-13T10:00:00.000Z",
    },
  ]];
  const repository = new PostgresCreditProviderRepository(fakeQueryable as never);

  const cached = await repository.getSharedProviderPricingCache(baseUrl);

  assert.ok(cached);
  assert.equal(cached?.pricing.length, 1);
  assert.match(fakeQueryable.queries[0].sql, /from provider_pricing_cache/i);
});

test("credit provider repository factory uses postgres when DATABASE_URL is configured", () => {
  process.env.DATABASE_URL = "postgres://kk:secret@127.0.0.1:5432/kkstudio";

  const repository = createCreditProviderRepositoryFromEnv({
    createPostgresRepository: () => ({ kind: "postgres" } as unknown as PostgresCreditProviderRepository),
  });

  assert.deepEqual(repository, { kind: "postgres" });
});

test("credit provider repository factory falls back to in-memory without postgres config", () => {
  delete process.env.DATABASE_URL;

  const repository = createCreditProviderRepositoryFromEnv();

  assert.ok(repository instanceof InMemoryCreditProviderRepository);
});
