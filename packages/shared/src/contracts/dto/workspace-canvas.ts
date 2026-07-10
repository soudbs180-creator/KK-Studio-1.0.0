import type { EntityId } from "./common.ts";

export const CANVAS_PRESENTATION_VERSION = 2 as const;

export type CanvasCardKind =
  | "prompt-result-group"
  | "prompt-only"
  | "media-only"
  | "ecommerce"
  | "ppt-deck"
  | "audio"
  | "text"
  | "notebook"
  | "multi-image"
  | "workflow-panel"
  | "unknown";

export type CanvasLayoutMode = "row" | "column" | "grid";

export type CanvasCardSizeToken = "compact" | "standard" | "wide";

export type CanvasConnectionSide = "top" | "right" | "bottom" | "left";

export interface CanvasSceneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasConnectionPorts {
  source: CanvasConnectionSide;
  target: CanvasConnectionSide;
}

export interface CanvasCardPresentation {
  version: typeof CANVAS_PRESENTATION_VERSION;
  kind: CanvasCardKind;
  layoutMode: CanvasLayoutMode;
  size: CanvasCardSizeToken;
  ports: CanvasConnectionPorts;
  diagnostic?: string;
}

export interface CanvasVectorPointDto {
  x: number;
  y: number;
}

export interface CanvasVectorElementDto {
  id: EntityId;
  type: "pen" | "marker" | "rect" | "circle" | "line" | "arrow" | "text";
  points: CanvasVectorPointDto[];
  color: string;
  width: number;
  fillColor?: string;
  text?: string;
  fontSize?: number;
}

export interface CanvasNoteNodeDto {
  id: EntityId;
  title: string;
  position: CanvasVectorPointDto;
  width: number;
  height: number;
  elements: CanvasVectorElementDto[];
  sourceNodeIds?: EntityId[];
  previewStorageId?: string;
  zIndex?: number;
  presentation: CanvasCardPresentation;
  createdAt: number;
  updatedAt: number;
}

export interface CanvasViewportSnapshot {
  canvasId: EntityId;
  surface: "phone" | "tablet-portrait" | "tablet-landscape" | "desktop";
  x: number;
  y: number;
  scale: number;
  updatedAt: number;
}

export interface CanvasMigrationSummary {
  version: typeof CANVAS_PRESENTATION_VERSION;
  migratedCanvasIds: EntityId[];
  repairedNodeIds: EntityId[];
  inferredLayoutNodeIds: EntityId[];
  backupKey?: string;
  completedAt: number;
}

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
  noteNodes?: CanvasNoteNodeDto[];
  workflow?: unknown;
  presentationVersion?: typeof CANVAS_PRESENTATION_VERSION;
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
