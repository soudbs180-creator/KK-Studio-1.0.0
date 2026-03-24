import type {
  ApiClientRequestOptions,
  KkApiClient,
} from "../../../../../../packages/contracts/src/client/kk-api-client.ts";
import type {
  CreateGenerationTaskRequestDto,
  GenerationTaskDto,
} from "../../../../../../packages/contracts/src/dto/generation.ts";
import type { ApiResponse } from "../../../../../../packages/contracts/src/http/envelope.ts";

export class GenerationClient {
  private readonly apiClient: KkApiClient;

  constructor(apiClient: KkApiClient) {
    this.apiClient = apiClient;
  }

  createTask(
    input: CreateGenerationTaskRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<GenerationTaskDto>> {
    return this.apiClient.createGenerationTask(input, options);
  }

  getTask(
    taskId: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<GenerationTaskDto>> {
    return this.apiClient.getGenerationTask(taskId, options);
  }
}
