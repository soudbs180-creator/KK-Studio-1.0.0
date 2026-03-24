import {
  buildRequestMeta,
  type ApiResponse,
  type SaveWorkflowRequestDto,
  type WorkflowDocumentDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { consoleLogger } from "../../../../../../packages/shared/src/index.ts";
import { createWorkflowDocument, normalizeWorkflowDocument } from "../domain/workflow-document.ts";
import type { WorkflowRepository } from "../infrastructure/in-memory-workflow-repository.ts";

export class WorkflowService {
  private readonly logger = consoleLogger.child({ module: "workflow" });
  private readonly repository: WorkflowRepository;

  constructor(repository: WorkflowRepository) {
    this.repository = repository;
  }

  async saveWorkflow(
    workflowId: string,
    workspaceId: string,
    input: SaveWorkflowRequestDto,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<WorkflowDocumentDto>> {
    const now = new Date().toISOString();
    const existing = await this.repository.findById(workspaceId, workflowId);
    const document = normalizeWorkflowDocument(
      createWorkflowDocument(input, {
        workflowId,
        workspaceId,
        canvasId: existing?.canvasId || `${workspaceId}-canvas`,
        createdAt: existing?.createdAt,
        updatedAt: now,
      }),
    );

    await this.repository.save(document);

    this.logger.info("Workflow saved by migrated module", {
      workflowId,
      workspaceId,
      nodeCount: document.nodes.length,
      edgeCount: document.edges.length,
    });

    return {
      success: true,
      data: document,
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async getWorkflow(
    workspaceId: string,
    workflowId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<WorkflowDocumentDto>> {
    const document = await this.repository.findById(workspaceId, workflowId);
    if (!document) {
      return {
        success: false,
        error: {
          code: "WORKFLOW_NOT_FOUND",
          message: "Workflow document does not exist.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      };
    }

    return {
      success: true,
      data: document,
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }
}
