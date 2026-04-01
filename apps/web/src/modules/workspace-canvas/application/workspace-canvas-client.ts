import type {
  ApiClientRequestOptions,
  KkApiClient,
} from "../../../../../../packages/contracts/src/index.ts";
import type { CanvasSummaryDto } from "../../../../../../packages/contracts/src/index.ts";
import type { ApiResponse } from "../../../../../../packages/contracts/src/index.ts";

export class WorkspaceCanvasClient {
  private readonly apiClient: KkApiClient;

  constructor(apiClient: KkApiClient) {
    this.apiClient = apiClient;
  }

  getCanvasSummary(
    workspaceId: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<CanvasSummaryDto>> {
    return this.apiClient.getWorkspaceCanvas(workspaceId, options);
  }
}
