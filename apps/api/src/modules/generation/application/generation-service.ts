import {
  buildRequestMeta,
  type ApiResponse,
  type CreateGenerationTaskRequestDto,
  type GenerationTaskDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { consoleLogger } from "../../../../../../packages/shared/src/index.ts";
import {
  buildGenerationTaskCreatedEvent,
  createGenerationTask,
} from "../domain/generation-task.ts";
import type { GenerationTaskRepository } from "../infrastructure/in-memory-generation-task-repository.ts";

export class GenerationService {
  private readonly logger = consoleLogger.child({ module: "generation" });
  private readonly repository: GenerationTaskRepository;

  constructor(repository: GenerationTaskRepository) {
    this.repository = repository;
  }

  async createTask(
    input: CreateGenerationTaskRequestDto,
    requesterId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<GenerationTaskDto>> {
    const existing = await this.repository.findByIdempotencyKey(requesterId, input.idempotencyKey);
    if (existing) {
      return {
        success: true,
        data: existing,
        meta: buildRequestMeta(requestId, clientVersion),
      };
    }

    const task = createGenerationTask(input, { requesterId });
    await this.repository.save(task);

    this.logger.info("Generation task created by migrated module", {
      taskId: task.id,
      workflowId: task.workflowId,
      requesterId,
      event: buildGenerationTaskCreatedEvent(task),
    });

    return {
      success: true,
      data: task,
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async getTask(
    taskId: string,
    requesterId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<GenerationTaskDto>> {
    const task = await this.repository.findById(taskId);
    if (!task || task.requesterId !== requesterId) {
      return {
        success: false,
        error: {
          code: "GENERATION_TASK_NOT_FOUND",
          message: "Generation task does not exist.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      };
    }

    return {
      success: true,
      data: task,
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }
}
