import {
  buildRequestMeta,
  type ApiResponse,
  type CanvasLayoutDto,
  type CleanupCloudImagesResponseDto,
  type CanvasSummaryDto,
  type SaveCanvasLayoutRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { consoleLogger } from "../../../../../../packages/shared/src/index.ts";
import type { WorkflowRepository } from "../../workflow/index.ts";
import type { WorkspaceLayoutRepository } from "../infrastructure/in-memory-workspace-layout-repository.ts";

export class WorkspaceCanvasService {
  private readonly logger = consoleLogger.child({ module: "workspace-canvas" });
  private readonly workflowRepository: WorkflowRepository;
  private readonly layoutRepository: WorkspaceLayoutRepository;

  constructor(workflowRepository: WorkflowRepository, layoutRepository: WorkspaceLayoutRepository) {
    this.workflowRepository = workflowRepository;
    this.layoutRepository = layoutRepository;
  }

  async getCanvasSummary(
    workspaceId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<CanvasSummaryDto>> {
    const workflows = await this.workflowRepository.listByWorkspace(workspaceId);
    if (workflows.length === 0) {
      return {
        success: false,
        error: {
          code: "WORKSPACE_CANVAS_NOT_FOUND",
          message: "Workspace canvas does not exist.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      };
    }

    const latestWorkflow = [...workflows].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    )[0];

    const nodeCount = workflows.reduce((sum, workflow) => sum + workflow.nodes.length, 0);
    const connectionCount = workflows.reduce((sum, workflow) => sum + workflow.edges.length, 0);

    this.logger.info("Workspace canvas summary resolved", {
      workspaceId,
      workflowCount: workflows.length,
      nodeCount,
      connectionCount,
    });

    return {
      success: true,
      data: {
        workspaceId,
        canvasId: latestWorkflow.canvasId,
        name: latestWorkflow.name,
        nodeCount,
        connectionCount,
        updatedAt: latestWorkflow.updatedAt,
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async getCanvasLayout(
    userId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<CanvasLayoutDto>> {
    const canvases = await this.layoutRepository.getLayout(userId);

    return {
      success: true,
      data: {
        canvases,
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async saveCanvasLayout(
    userId: string,
    input: SaveCanvasLayoutRequestDto,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<CanvasLayoutDto>> {
    const canvases = await this.layoutRepository.saveLayout(userId, input.canvases);
    this.logger.info("Workspace layout saved via migrated API module", {
      userId,
      canvasCount: canvases.length,
    });

    return {
      success: true,
      data: {
        canvases,
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async cleanupCloudImages(
    userId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<CleanupCloudImagesResponseDto>> {
    const result = await this.layoutRepository.cleanupCloudImages(userId);
    this.logger.info("Cloud image cleanup completed via migrated API module", {
      userId,
      deletedCount: result.deletedCount,
      preservedLayout: result.preservedLayout,
    });

    return {
      success: true,
      data: result,
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }
}
