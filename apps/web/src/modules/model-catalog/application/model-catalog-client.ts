import type {
  ApiClientRequestOptions,
  KkApiClient,
} from "../../../../../../packages/contracts/src/client/kk-api-client.ts";
import type {
  CreateAdminModelRequestDto,
  ModelCatalogItemDto,
  ModelCatalogListDto,
  ModelKind,
} from "../../../../../../packages/contracts/src/dto/model-catalog.ts";
import type { ApiResponse } from "../../../../../../packages/contracts/src/http/envelope.ts";

export class ModelCatalogClient {
  private readonly apiClient: KkApiClient;

  constructor(apiClient: KkApiClient) {
    this.apiClient = apiClient;
  }

  listModels(
    kind?: ModelKind,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ModelCatalogListDto>> {
    return this.apiClient.listModels(kind, options);
  }

  createAdminModel(
    input: CreateAdminModelRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ModelCatalogItemDto>> {
    return this.apiClient.createAdminModel(input, options);
  }
}
