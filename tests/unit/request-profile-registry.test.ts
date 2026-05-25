import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  getRequestProfile,
  getRequestProfiles,
  resolveLocalRequestProfile,
} from "../../apps/web/src/services/api/requestProfileRegistry.ts";

describe("request profile registry", () => {
  test("exposes the expected built-in request profiles", () => {
    const profileIds = getRequestProfiles().map((profile) => profile.id);

    assert.deepEqual(
      profileIds,
      [
        "12ai",
        "gpt-best",
        "suxi",
        "wuyinkeji",
        "openai-official",
        "anthropic-official",
        "generic-openai",
      ],
    );
  });

  test("keeps GPT Best docs as identification evidence instead of executable API bases", () => {
    const profile = getRequestProfile("gpt-best");

    assert.ok(profile);
    assert.match(profile!.docSources[0], /gpt-best\.apifox\.cn\/llms\.txt/);
    assert.equal(profile!.apiBaseUrlPolicy, "runtime-supplied");
  });

  test("falls back unknown local providers to the 12AI request profile", () => {
    const profile = resolveLocalRequestProfile({
      provider: "Custom",
      baseUrl: "https://unknown-provider.example.com/v1",
    });

    assert.equal(profile.id, "12ai");
  });
});
