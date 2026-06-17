import type {
  AgentWorkflowNode,
  GeneratedImage,
  PreviewWorkflowNode,
  PromptNode,
  SaveWorkflowNode,
} from '../types';
import type { CanvasCardDetailLevel } from '../canvas/performanceProfile';
import type { ImageQuality } from '../services/image/imageQuality';

export type Point = { x: number; y: number };

export type SelectionBoxState = { start: Point; current: Point; active: boolean } | null;

export type DragConnectionState = {
  active: boolean;
  startId: string;
  startPos: Point;
  currentPos: Point;
} | null;

export type PromptGroupTier = 'base' | 'generating' | 'focused';

export type PromptGroupView = {
  id: string;
  rootPrompt: PromptNode;
  childImages: GeneratedImage[];
  intraGroupEdges: Array<{ fromId: string; toId: string }>;
  bounds: { x: number; y: number; width: number; height: number };
  baseOrder: number;
  tier: PromptGroupTier;
  isOverlapping: boolean;
};

export type PromptGroupLayoutPresentationState = {
  layoutMode: 'expanded' | 'regrouping' | 'docked';
  regroupProgress: number;
  startedAt: number;
  settleUntil: number | null;
  targetSlotIndicesByChildId: Record<string, number>;
  regroupStartPositionsByChildId?: Record<string, Point>;
};

export type PromptGroupRegroupLayout = {
  renderPosition: Point;
  settledPosition: Point;
};

export type PromptGroupRenderItem = {
  id: string;
  kind: 'prompt-group';
  groupView: PromptGroupView;
  node: PromptNode;
  childNodes: GeneratedImage[];
  detailLevel: CanvasCardDetailLevel;
  isPlaceholder?: boolean;
};

export type ImageRenderItem = {
  id: string;
  kind: 'image';
  node: GeneratedImage;
  groupLayerZIndex: number;
  stackZIndexOverride?: number;
  detailLevel: CanvasCardDetailLevel;
  loadPriority: number;
  loadBand: 0 | 1 | 2 | 3;
  isPlaceholder?: boolean;
};

export type PreviewRenderItem = {
  id: string;
  kind: 'preview';
  node: PreviewWorkflowNode;
};

export type SaveRenderItem = {
  id: string;
  kind: 'save';
  node: SaveWorkflowNode;
};

export type AgentRenderItem = {
  id: string;
  kind: 'agent';
  node: AgentWorkflowNode;
};

export type WorkflowUtilityCanvasNode = PreviewWorkflowNode | SaveWorkflowNode | AgentWorkflowNode;

export type CanvasRenderItem =
  | PromptGroupRenderItem
  | ImageRenderItem
  | PreviewRenderItem
  | SaveRenderItem
  | AgentRenderItem;

export type ScheduledImageLoadState = {
  loadBand: 0 | 1 | 2 | 3;
  loadPriority: number;
  prefetchQuality: ImageQuality;
};
