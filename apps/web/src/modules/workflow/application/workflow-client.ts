import type {
  ApiClientRequestOptions,
  KkApiClient,
} from "../../../../../../packages/contracts/src/client/kk-api-client.ts";
import type {
  SaveWorkflowRequestDto,
  WorkflowDocumentDto,
} from "../../../../../../packages/contracts/src/dto/workflow.ts";
import type { ApiResponse } from "../../../../../../packages/contracts/src/http/envelope.ts";

export class WorkflowClient {
  private readonly apiClient: KkApiClient;

  constructor(apiClient: KkApiClient) {
    this.apiClient = apiClient;
  }

  saveWorkflow(
    workspaceId: string,
    workflowId: string,
    input: SaveWorkflowRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<WorkflowDocumentDto>> {
    return this.apiClient.saveWorkflow(workspaceId, workflowId, input, options);
  }

  getWorkflow(
    workspaceId: string,
    workflowId: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<WorkflowDocumentDto>> {
    return this.apiClient.getWorkflow(workspaceId, workflowId, options);
  }
}
