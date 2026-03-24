import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { AUTHENTICATED_USER_ID_HEADER } from "../../packages/shared/src/index.ts";
import { AssetLibraryService } from "../../apps/api/src/modules/asset-library/application/asset-library-service.ts";
import { InMemoryAssetLibraryRepository } from "../../apps/api/src/modules/asset-library/infrastructure/in-memory-asset-library-repository.ts";
import { handleListAssets } from "../../apps/api/src/modules/asset-library/presentation/http-asset-library-routes.ts";

describe("asset library routes", () => {
  test("requires authentication for asset access", async () => {
    const service = new AssetLibraryService(new InMemoryAssetLibraryRepository());
    const result = await handleListAssets(service, {}, {
      "x-request-id": "req-assets-auth",
    });

    assert.equal(result.statusCode, 401);
    assert.equal(result.body.success, false);
  });

  test("returns paged assets filtered by kind", async () => {
    const service = new AssetLibraryService(new InMemoryAssetLibraryRepository());
    const result = await handleListAssets(service, {
      kind: "image",
      limit: "1",
    }, {
      [AUTHENTICATED_USER_ID_HEADER]: "asset-user-1",
      "x-request-id": "req-assets-list",
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    if (result.body.success) {
      assert.equal(result.body.data.items.length, 1);
      assert.equal(result.body.data.items[0].kind, "image");
      assert.equal(result.body.meta.pagination?.limit, 1);
    }
  });
});
