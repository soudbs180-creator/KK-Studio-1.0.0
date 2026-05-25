import type { AuditFieldsDto, EntityId } from "./common.ts";
import type { WorkflowNodeType } from "../enums/status.ts";

export interface WorkflowNodePositionDto {
  x: number;
  y: number;
}

export interface WorkflowNodeDto {
  id: EntityId;
  nodeType: WorkflowNodeType;
  position: WorkflowNodePositionDto;
  width?: number;
  height?: number;
  zIndex?: number;
  label?: string;
  tags?: string[];
  config: Record<string, unknown>;
}

export interface WorkflowEdgeDto {
  id: EntityId;
  from: EntityId;
  to: EntityId;
  role?: "input" | "result" | "reference" | "control" | "sequence";
  state?: "active" | "disabled";
  label?: string;
}

export interface SaveWorkflowRequestDto {
  name: string;
  version: number;
  status?: "draft" | "published" | "archived";
  nodes: WorkflowNodeDto[];
  edges?: WorkflowEdgeDto[];
}

export interface WorkflowDocumentDto extends AuditFieldsDto {
  id: EntityId;
  workspaceId: EntityId;
  canvasId: EntityId;
  name: string;
  status: "draft" | "published" | "archived";
  version: number;
  nodes: WorkflowNodeDto[];
  edges: WorkflowEdgeDto[];
}
