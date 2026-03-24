import type {
  ApiClientRequestOptions,
  KkApiClient,
} from "../../../../../../packages/contracts/src/client/kk-api-client.ts";
import type { CanvasSummaryDto } from "../../../../../../packages/contracts/src/dto/workspace-canvas.ts";
import type { ApiResponse } from "../../../../../../packages/contracts/src/http/envelope.ts";

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
