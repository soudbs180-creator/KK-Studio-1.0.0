import type { EntityId } from "./common.ts";

export interface CanvasSummaryDto {
  workspaceId: EntityId;
  canvasId: EntityId;
  name: string;
  nodeCount: number;
  connectionCount: number;
  updatedAt: string;
}

export interface CanvasLayoutRecordDto {
  [key: string]: unknown;
}

export interface CanvasLayoutDto {
  canvases: CanvasLayoutRecordDto[];
}

export interface SaveCanvasLayoutRequestDto {
  canvases: CanvasLayoutRecordDto[];
}

export interface CleanupCloudImagesResponseDto {
  deletedCount: number;
  preservedLayout: boolean;
}
