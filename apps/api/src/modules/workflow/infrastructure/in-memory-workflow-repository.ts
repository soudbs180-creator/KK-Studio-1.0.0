import type { WorkflowDocumentDto } from "../../../../../../packages/contracts/src/index.ts";

export interface WorkflowRepository {
  findById(workspaceId: string, workflowId: string): Promise<WorkflowDocumentDto | null>;
  listByWorkspace(workspaceId: string): Promise<WorkflowDocumentDto[]>;
  save(document: WorkflowDocumentDto): Promise<void>;
}

export class InMemoryWorkflowRepository implements WorkflowRepository {
  private readonly workflows = new Map<string, WorkflowDocumentDto>();

  private buildWorkflowKey(workspaceId: string, workflowId: string): string {
    return `${workspaceId}:${workflowId}`;
  }

  async findById(workspaceId: string, workflowId: string): Promise<WorkflowDocumentDto | null> {
    return this.workflows.get(this.buildWorkflowKey(workspaceId, workflowId)) || null;
  }

  async listByWorkspace(workspaceId: string): Promise<WorkflowDocumentDto[]> {
    return Array.from(this.workflows.values())
      .filter((document) => document.workspaceId === workspaceId)
      .map((document) => ({ ...document }));
  }

  async save(document: WorkflowDocumentDto): Promise<void> {
    this.workflows.set(this.buildWorkflowKey(document.workspaceId, document.id), document);
  }
}
