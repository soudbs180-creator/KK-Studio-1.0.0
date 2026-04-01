import type {
  ApiClientRequestOptions,
  KkApiClient,
} from "../../../../../../packages/contracts/src/index.ts";
import type {
  AssetKind,
  AssetListDto,
} from "../../../../../../packages/contracts/src/index.ts";
import type { ApiResponse } from "../../../../../../packages/contracts/src/index.ts";

export class AssetLibraryClient {
  private readonly apiClient: KkApiClient;

  constructor(apiClient: KkApiClient) {
    this.apiClient = apiClient;
  }

  listAssets(
    input?: { kind?: AssetKind; cursor?: string; limit?: number },
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<AssetListDto>> {
    return this.apiClient.listAssets(input, options);
  }
}
