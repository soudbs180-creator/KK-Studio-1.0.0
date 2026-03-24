import type { GenerationTaskDto } from "../../../../../../packages/contracts/src/index.ts";

export interface GenerationTaskRepository {
  findById(taskId: string): Promise<GenerationTaskDto | null>;
  findByIdempotencyKey(requesterId: string, idempotencyKey: string): Promise<GenerationTaskDto | null>;
  save(task: GenerationTaskDto): Promise<void>;
}

export class InMemoryGenerationTaskRepository implements GenerationTaskRepository {
  private readonly tasks = new Map<string, GenerationTaskDto>();
  private readonly idempotencyIndex = new Map<string, string>();

  private buildScopeKey(requesterId: string, idempotencyKey: string): string {
    return `${requesterId}:${idempotencyKey}`;
  }

  async findById(taskId: string): Promise<GenerationTaskDto | null> {
    return this.tasks.get(taskId) || null;
  }

  async findByIdempotencyKey(requesterId: string, idempotencyKey: string): Promise<GenerationTaskDto | null> {
    const taskId = this.idempotencyIndex.get(this.buildScopeKey(requesterId, idempotencyKey));
    if (!taskId) return null;
    return this.tasks.get(taskId) || null;
  }

  async save(task: GenerationTaskDto): Promise<void> {
    this.tasks.set(task.id, task);
    this.idempotencyIndex.set(this.buildScopeKey(task.requesterId, task.idempotencyKey), task.id);
  }
}
