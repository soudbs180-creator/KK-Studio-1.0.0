import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  extractWuyinAsyncEndpointDetails,
  extractWuyinEndpointDetails,
  fetchWuyinPricingCatalog,
  selectWuyinGeneratableCatalogModels,
} from "../../apps/web/src/services/billing/newApiPricingService.ts";

describe("Wuyin pricing catalog helpers", () => {
  test("derives stable model IDs from async and product endpoint URLs", () => {
    assert.equal(
      extractWuyinEndpointDetails("https://api.wuyinkeji.com/api/sora2-new/submit")?.modelId,
      "sora2-new",
    );
    assert.equal(
      extractWuyinEndpointDetails("/api/chat/index")?.modelId,
      "chat_index",
    );
    assert.equal(
      extractWuyinAsyncEndpointDetails("https://api.wuyinkeji.com/api/async/detail"),
      null,
    );
    assert.equal(
      extractWuyinAsyncEndpointDetails("https://api.wuyinkeji.com/api/async/image_wan2.6")?.modelId,
      "image_wan2.6",
    );
  });

  test("normalizes the official api_list payload and filters UI-generatable models", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({
      code: 200,
      data: {
        api_list: [
          {
            id: "33",
            name: "GPT-Image-2",
            url: "https://api.wuyinkeji.com/api/async/image_gpt",
            method: "POST",
            api_type: "2",
            balance_sum: "0.100000",
            pay_unit: "张",
            tags: ["付费"],
          },
          {
            id: "8",
            name: "grok_imagine",
            url: "https://api.wuyinkeji.com/api/async/image_grok_imagine",
            method: "POST",
            api_type: "2",
            balance_sum: "0.100000",
            pay_unit: "张",
            tags: ["付费"],
          },
          {
            id: "34",
            name: "NanoBanana2",
            url: "https://api.wuyinkeji.com/api/async/image_nanoBanana2",
            method: "POST",
            api_type: "2",
            balance_sum: "0.100000",
            pay_unit: "张",
            tags: ["付费"],
          },
          {
            id: "52",
            name: "grok_imagine",
            url: "https://api.wuyinkeji.com/api/async/video_grok_imagine",
            method: "POST",
            api_type: "11",
            balance_sum: "0.050000",
            pay_unit: "秒",
            tags: ["付费"],
          },
          {
            id: "44",
            name: "ChatAPI",
            url: "https://api.wuyinkeji.com/api/chat/index",
            method: "POST",
            api_type: "1",
            balance_sum: "0.000000",
            pay_unit: "token",
          },
          {
            id: "45",
            name: "结果详情",
            url: "https://api.wuyinkeji.com/api/async/detail",
            method: "GET",
            api_type: "10",
            balance_sum: "0.000000",
            pay_unit: "次",
          },
        ],
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

    try {
      const catalog = await fetchWuyinPricingCatalog("https://api.wuyinkeji.com");
      assert.deepEqual(catalog.map((item) => item.modelId), [
        "image_gpt",
        "image_grok_imagine",
        "image_nanoBanana2",
        "video_grok_imagine",
        "chat_index",
        "async_detail",
      ]);
      assert.equal(catalog[3].displayPrice, "0.05元/秒");
      assert.equal(catalog[3].endpointPath, "/api/async/video_grok_imagine");
      assert.deepEqual(selectWuyinGeneratableCatalogModels(catalog).map((item) => item.modelId), [
        "image_nanoBanana2",
        "image_gpt",
        "image_grok_imagine",
        "video_grok_imagine",
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
