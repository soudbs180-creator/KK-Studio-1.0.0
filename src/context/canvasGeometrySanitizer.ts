import type { Canvas, CanvasGroup, WorkflowNode } from '../types.ts';

const MAX_CANVAS_COORDINATE = 200000;
const MIN_PROMPT_HEIGHT = 32;
const MAX_PROMPT_HEIGHT = 2400;
const MIN_PROMPT_WIDTH = 248;
const MAX_PROMPT_WIDTH = 1200;
const MIN_WORKFLOW_CARD_WIDTH = 180;
const MAX_WORKFLOW_CARD_WIDTH = 1200;
const MIN_WORKFLOW_CARD_HEIGHT = 96;
const MAX_WORKFLOW_CARD_HEIGHT = 1600;
const MIN_GROUP_SIZE = 32;
const MAX_GROUP_SIZE = 200000;

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

const isUsableCoordinate = (value: unknown): value is number => (
  isFiniteNumber(value) && Math.abs(value) <= MAX_CANVAS_COORDINATE
);

const sanitizePosition = (position: unknown): { x: number; y: number } => {
  if (!position || typeof position !== 'object') {
    return { x: 0, y: 0 };
  }

  const candidate = position as { x?: unknown; y?: unknown };
  return {
    x: isUsableCoordinate(candidate.x) ? candidate.x : 0,
    y: isUsableCoordinate(candidate.y) ? candidate.y : 0,
  };
};

const sanitizeOptionalDimension = (
  value: unknown,
  min: number,
  max: number,
): number | undefined => (
  isFiniteNumber(value) && value >= min && value <= max ? value : undefined
);

const sanitizeGroupBounds = (bounds: CanvasGroup['bounds']): CanvasGroup['bounds'] => {
  const position = sanitizePosition(bounds);
  return {
    x: position.x,
    y: position.y,
    width: sanitizeOptionalDimension(bounds?.width, MIN_GROUP_SIZE, MAX_GROUP_SIZE) ?? MIN_GROUP_SIZE,
    height: sanitizeOptionalDimension(bounds?.height, MIN_GROUP_SIZE, MAX_GROUP_SIZE) ?? MIN_GROUP_SIZE,
  };
};

const sanitizeWorkflowNode = (node: WorkflowNode): WorkflowNode => ({
  ...node,
  position: sanitizePosition(node.position),
  width: sanitizeOptionalDimension(node.width, MIN_WORKFLOW_CARD_WIDTH, MAX_WORKFLOW_CARD_WIDTH),
  height: sanitizeOptionalDimension(node.height, MIN_WORKFLOW_CARD_HEIGHT, MAX_WORKFLOW_CARD_HEIGHT),
});

export const sanitizePersistedCanvas = (canvas: Canvas): Canvas => ({
  ...canvas,
  promptNodes: (canvas.promptNodes || []).map((node) => ({
    ...node,
    position: sanitizePosition(node.position),
    width: sanitizeOptionalDimension(node.width, MIN_PROMPT_WIDTH, MAX_PROMPT_WIDTH),
    height: sanitizeOptionalDimension(node.height, MIN_PROMPT_HEIGHT, MAX_PROMPT_HEIGHT),
  })),
  imageNodes: (canvas.imageNodes || []).map((node) => ({
    ...node,
    position: sanitizePosition(node.position),
  })),
  groups: (canvas.groups || []).map((group) => ({
    ...group,
    bounds: sanitizeGroupBounds(group.bounds),
  })),
  drawings: (canvas.drawings || []).map((drawing) => ({
    ...drawing,
    points: (drawing.points || []).map(sanitizePosition),
    width: sanitizeOptionalDimension(drawing.width, 1, 96) ?? 1,
  })),
  workflow: canvas.workflow
    ? {
      ...canvas.workflow,
      nodes: (canvas.workflow.nodes || []).map(sanitizeWorkflowNode),
      edges: canvas.workflow.edges || [],
    }
    : canvas.workflow,
});

export const sanitizePersistedCanvases = (canvases: unknown = []): Canvas[] => (
  Array.isArray(canvases) ? canvases.map((canvas) => sanitizePersistedCanvas(canvas as Canvas)) : []
);
