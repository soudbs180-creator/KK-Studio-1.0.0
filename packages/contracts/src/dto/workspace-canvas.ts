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
  id: EntityId;
  name: string;
  folderName?: string;
  promptNodes?: unknown[];
  imageNodes?: unknown[];
  groups?: unknown[];
  drawings?: unknown[];
  workflow?: unknown;
  lastModified: number;
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
