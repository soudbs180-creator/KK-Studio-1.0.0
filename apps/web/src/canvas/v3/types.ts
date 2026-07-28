import type { CanvasCardSizeToken } from '@kk/shared';
import type { CanvasCardDetailLevel } from '../performanceProfile.ts';

export type CanvasV3CardKind =
  | 'prompt'
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'ppt'
  | 'storyboard'
  | 'ecommerce'
  | 'agent'
  | 'preview'
  | 'save'
  | 'workflow'
  | 'pending'
  | 'error'
  | 'unknown';

export type CanvasCardStatus =
  | 'idle'
  | 'running'
  | 'succeeded'
  | 'paused'
  | 'cancelled'
  | 'error';

export type CanvasCardActionId =
  | 'edit'
  | 'optimize'
  | 'run'
  | 'retry'
  | 'pause'
  | 'cancel'
  | 'copy'
  | 'download'
  | 'upscale'
  | 'remove-background'
  | 'reuse'
  | 'connect'
  | 'play'
  | 'extend'
  | 'analyze'
  | 'preview'
  | 'export'
  | 'open'
  | 'compare'
  | 'details'
  | 'more';

export interface CanvasCardAction {
  id: CanvasCardActionId;
  label: string;
  priority: 'primary' | 'secondary' | 'overflow';
  disabled?: boolean;
  destructive?: boolean;
}

export type CanvasPortRole = 'input' | 'result' | 'reference' | 'control' | 'sequence';

export interface CanvasPortViewModel {
  id: string;
  nodeId: string;
  direction: 'input' | 'output';
  side: 'top' | 'right' | 'bottom' | 'left';
  role: CanvasPortRole;
  label?: string;
}

export interface CanvasCardMetadata {
  label: string;
  value: string;
}

export interface CanvasCardMedia {
  type: 'image' | 'video' | 'audio' | 'deck' | 'product';
  sourceUrl?: string;
  posterUrl?: string;
  aspectRatio?: string;
}

export interface CanvasCardViewModel {
  id: string;
  kind: CanvasV3CardKind;
  title: string;
  summary?: string;
  status: CanvasCardStatus;
  statusLabel: string;
  size: CanvasCardSizeToken;
  width: number;
  heightMode: 'content';
  headerHeight: 36;
  footerHeight: 36;
  position: { x: number; y: number };
  parentId?: string;
  childIds: string[];
  progress?: number;
  errorMessage?: string;
  media?: CanvasCardMedia;
  metadata: CanvasCardMetadata[];
  actions: CanvasCardAction[];
  ports: CanvasPortViewModel[];
}

export interface CanvasEdgeViewModel {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  role: CanvasPortRole;
  state: 'active' | 'disabled';
  selected?: boolean;
  running?: boolean;
  label?: string;
}

export interface CanvasV3CardRenderState {
  detailLevel: Extract<CanvasCardDetailLevel, 'full' | 'compact' | 'thumbnail-shell'>;
  selected: boolean;
  dragging: boolean;
  mobile: boolean;
}
