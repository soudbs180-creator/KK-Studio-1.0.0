import type { CanvasMigrationIssue } from '@kk/shared';
import type {
  Canvas,
  CanvasDrawing,
  CanvasGroup,
  CanvasNoteNode,
  GeneratedImage,
  PromptNode,
  WorkflowNode,
} from '../types';
import type { WorkflowEdge } from '../workflow/types.ts';

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

export interface CanvasSanitizationResult {
  canvases: Canvas[];
  changed: boolean;
  affectedCanvasIds: string[];
  repairedNodeIds: string[];
  flaggedNodeIds: string[];
  issues: CanvasMigrationIssue[];
}

type SanitizationReporter = {
  changed: boolean;
  affectedCanvasIds: Set<string>;
  repairedNodeIds: Set<string>;
  flaggedNodeIds: Set<string>;
  issues: CanvasMigrationIssue[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

const isUsableCoordinate = (value: unknown): value is number => (
  isFiniteNumber(value) && Math.abs(value) <= MAX_CANVAS_COORDINATE
);

const reportIssue = (
  reporter: SanitizationReporter,
  issue: CanvasMigrationIssue,
) => {
  reporter.changed = true;
  if (issue.canvasId) reporter.affectedCanvasIds.add(issue.canvasId);
  if (issue.nodeId) {
    if (issue.severity === 'repaired') reporter.repairedNodeIds.add(issue.nodeId);
    else reporter.flaggedNodeIds.add(issue.nodeId);
  }
  reporter.issues.push(issue);
};

const sanitizePosition = (
  position: unknown,
  reporter?: SanitizationReporter,
  canvasId?: string,
  nodeId?: string,
): { x: number; y: number } => {
  const candidate = isRecord(position) ? position : {};
  const x = isUsableCoordinate(candidate.x) ? candidate.x : 0;
  const y = isUsableCoordinate(candidate.y) ? candidate.y : 0;
  if (x !== candidate.x || y !== candidate.y) {
    if (reporter) {
      reportIssue(reporter, {
        code: 'invalid-position',
        message: 'Invalid canvas coordinates were reset to a visible origin.',
        severity: 'repaired',
        canvasId,
        nodeId,
      });
    }
  }
  return { x, y };
};

const sanitizeOptionalDimension = (
  value: unknown,
  min: number,
  max: number,
): number | undefined => (
  isFiniteNumber(value) && value >= min && value <= max ? value : undefined
);

const sanitizeDimension = (
  value: unknown,
  min: number,
  max: number,
  fallback: number | undefined,
  reporter: SanitizationReporter,
  canvasId: string,
  nodeId: string,
  axis: 'width' | 'height',
) => {
  const sanitized = sanitizeOptionalDimension(value, min, max) ?? fallback;
  if (sanitized !== value && value !== undefined) {
    reportIssue(reporter, {
      code: `invalid-${axis}`,
      message: `Invalid card ${axis} was replaced with a safe measured fallback.`,
      severity: 'repaired',
      canvasId,
      nodeId,
    });
  }
  return sanitized;
};

const sanitizePromptNode = (
  node: PromptNode,
  reporter: SanitizationReporter,
  canvasId: string,
): PromptNode => ({
  ...node,
  position: sanitizePosition(node.position, reporter, canvasId, node.id),
  width: sanitizeDimension(node.width, MIN_PROMPT_WIDTH, MAX_PROMPT_WIDTH, undefined, reporter, canvasId, node.id, 'width'),
  height: sanitizeDimension(node.height, MIN_PROMPT_HEIGHT, MAX_PROMPT_HEIGHT, undefined, reporter, canvasId, node.id, 'height'),
  childImageIds: Array.isArray(node.childImageIds) ? node.childImageIds.filter((id): id is string => typeof id === 'string') : [],
});

const sanitizeImageNode = (
  node: GeneratedImage,
  reporter: SanitizationReporter,
  canvasId: string,
): GeneratedImage => ({
  ...node,
  position: sanitizePosition(node.position, reporter, canvasId, node.id),
  parentPromptId: typeof node.parentPromptId === 'string' ? node.parentPromptId : '',
});

const sanitizeGroup = (
  group: CanvasGroup,
  reporter: SanitizationReporter,
  canvasId: string,
): CanvasGroup => {
  const position = sanitizePosition(group.bounds, reporter, canvasId, group.id);
  return {
    ...group,
    nodeIds: Array.isArray(group.nodeIds) ? group.nodeIds.filter((id): id is string => typeof id === 'string') : [],
    bounds: {
      x: position.x,
      y: position.y,
      width: sanitizeDimension(group.bounds?.width, MIN_GROUP_SIZE, MAX_GROUP_SIZE, MIN_GROUP_SIZE, reporter, canvasId, group.id, 'width') ?? MIN_GROUP_SIZE,
      height: sanitizeDimension(group.bounds?.height, MIN_GROUP_SIZE, MAX_GROUP_SIZE, MIN_GROUP_SIZE, reporter, canvasId, group.id, 'height') ?? MIN_GROUP_SIZE,
    },
  };
};

const sanitizeDrawing = (
  drawing: CanvasDrawing,
  reporter: SanitizationReporter,
  canvasId: string,
): CanvasDrawing => ({
  ...drawing,
  points: (Array.isArray(drawing.points) ? drawing.points : []).map((point) => (
    sanitizePosition(point, reporter, canvasId, drawing.id)
  )),
  width: sanitizeDimension(drawing.width, 1, 96, 1, reporter, canvasId, drawing.id, 'width') ?? 1,
});

const sanitizeNoteNode = (
  node: CanvasNoteNode,
  reporter: SanitizationReporter,
  canvasId: string,
): CanvasNoteNode => ({
  ...node,
  position: sanitizePosition(node.position, reporter, canvasId, node.id),
  width: sanitizeDimension(node.width, MIN_PROMPT_WIDTH, MAX_PROMPT_WIDTH, 320, reporter, canvasId, node.id, 'width') ?? 320,
  height: sanitizeDimension(node.height, MIN_PROMPT_HEIGHT, MAX_PROMPT_HEIGHT, 240, reporter, canvasId, node.id, 'height') ?? 240,
  elements: (Array.isArray(node.elements) ? node.elements : []).map((element) => ({
    ...element,
    points: (Array.isArray(element.points) ? element.points : []).map((point) => (
      sanitizePosition(point, reporter, canvasId, node.id)
    )),
    width: sanitizeDimension(element.width, 1, 96, 1, reporter, canvasId, node.id, 'width') ?? 1,
  })),
});

const sanitizeWorkflowNode = (
  node: WorkflowNode,
  reporter: SanitizationReporter,
  canvasId: string,
): WorkflowNode => ({
  ...node,
  position: sanitizePosition(node.position, reporter, canvasId, node.id),
  width: sanitizeDimension(node.width, MIN_WORKFLOW_CARD_WIDTH, MAX_WORKFLOW_CARD_WIDTH, undefined, reporter, canvasId, node.id, 'width'),
  height: sanitizeDimension(node.height, MIN_WORKFLOW_CARD_HEIGHT, MAX_WORKFLOW_CARD_HEIGHT, undefined, reporter, canvasId, node.id, 'height'),
});

const validNodeRecords = <T extends { id: string }>(
  value: unknown,
  canvasId: string,
  collection: string,
  reporter: SanitizationReporter,
): T[] => {
  if (!Array.isArray(value)) {
    reportIssue(reporter, {
      code: `invalid-${collection}-collection`,
      message: `The ${collection} collection was malformed and isolated from runtime rendering.`,
      severity: 'warning',
      canvasId,
    });
    return [];
  }
  return value.filter((entry): entry is T => {
    const valid = isRecord(entry) && typeof entry.id === 'string' && entry.id.length > 0;
    if (!valid) {
      reportIssue(reporter, {
        code: `invalid-${collection}-entry`,
        message: `A malformed ${collection} entry was preserved in the migration backup and isolated from rendering.`,
        severity: 'warning',
        canvasId,
      });
    }
    return valid;
  });
};

const validWorkflowEdges = (
  value: unknown,
  canvasId: string,
  reporter: SanitizationReporter,
): WorkflowEdge[] => {
  if (!Array.isArray(value)) {
    reportIssue(reporter, {
      code: 'invalid-workflow-edge-collection',
      message: 'The workflow edge collection was malformed and isolated from runtime rendering.',
      severity: 'warning',
      canvasId,
    });
    return [];
  }
  return value.filter((entry): entry is WorkflowEdge => {
    const valid = isRecord(entry)
      && typeof entry.id === 'string'
      && typeof entry.from === 'string'
      && typeof entry.to === 'string';
    if (!valid) {
      reportIssue(reporter, {
        code: 'invalid-workflow-edge-entry',
        message: 'A malformed workflow edge was preserved in the migration backup and isolated from rendering.',
        severity: 'warning',
        canvasId,
      });
    }
    return valid;
  });
};

const sanitizePersistedCanvasWithReport = (
  canvas: Canvas,
  reporter: SanitizationReporter,
): Canvas => {
  const canvasId = canvas.id;
  let promptNodes = validNodeRecords<PromptNode>(canvas.promptNodes, canvasId, 'prompt', reporter)
    .map((node) => sanitizePromptNode(node, reporter, canvasId));
  let imageNodes = validNodeRecords<GeneratedImage>(canvas.imageNodes, canvasId, 'image', reporter)
    .map((node) => sanitizeImageNode(node, reporter, canvasId));
  const workflowNodes = canvas.workflow
    ? validNodeRecords<WorkflowNode>(canvas.workflow.nodes, canvasId, 'workflow', reporter)
      .map((node) => sanitizeWorkflowNode(node, reporter, canvasId))
    : [];
  const noteNodes = validNodeRecords<CanvasNoteNode>(canvas.noteNodes ?? [], canvasId, 'note', reporter)
    .map((node) => sanitizeNoteNode(node, reporter, canvasId));
  const promptIds = new Set(promptNodes.map((node) => node.id));

  imageNodes = imageNodes.map((image) => {
    if (!image.parentPromptId || promptIds.has(image.parentPromptId)) return image;
    reportIssue(reporter, {
      code: 'missing-parent-prompt',
      message: 'A media card referenced a missing prompt and was preserved as an orphan card.',
      severity: 'repaired',
      canvasId,
      nodeId: image.id,
    });
    return { ...image, parentPromptId: '', orphaned: true };
  });

  const imageById = new Map(imageNodes.map((image) => [image.id, image]));
  promptNodes = promptNodes.map((prompt) => {
    const linkedIds = imageNodes.filter((image) => image.parentPromptId === prompt.id).map((image) => image.id);
    const canonicalIds = Array.from(new Set(linkedIds));
    const currentIds = prompt.childImageIds.filter((id) => imageById.get(id)?.parentPromptId === prompt.id);
    const unchanged = currentIds.length === canonicalIds.length && currentIds.every((id, index) => id === canonicalIds[index]);
    if (unchanged) return prompt;
    reportIssue(reporter, {
      code: 'invalid-child-links',
      message: 'Prompt-to-media links were rebuilt from valid parent relationships.',
      severity: 'repaired',
      canvasId,
      nodeId: prompt.id,
    });
    return { ...prompt, childImageIds: canonicalIds };
  });

  const validNodeIds = new Set([
    ...promptNodes.map((node) => node.id),
    ...imageNodes.map((node) => node.id),
    ...noteNodes.map((node) => node.id),
    ...workflowNodes.map((node) => node.id),
  ]);
  const groups = validNodeRecords<CanvasGroup>(canvas.groups, canvasId, 'group', reporter)
    .map((group) => sanitizeGroup(group, reporter, canvasId))
    .map((group) => {
      const nodeIds = group.nodeIds.filter((id) => validNodeIds.has(id));
      if (nodeIds.length === group.nodeIds.length) return group;
      reportIssue(reporter, {
        code: 'invalid-group-links',
        message: 'Missing group members were removed while the group itself was preserved.',
        severity: 'repaired',
        canvasId,
        nodeId: group.id,
      });
      return { ...group, nodeIds };
    });
  const drawings = validNodeRecords<CanvasDrawing>(canvas.drawings, canvasId, 'drawing', reporter)
    .map((drawing) => sanitizeDrawing(drawing, reporter, canvasId));
  const workflow = canvas.workflow
    ? {
      ...canvas.workflow,
      nodes: workflowNodes,
      edges: validWorkflowEdges(canvas.workflow.edges, canvasId, reporter).map((edge) => {
        if (validNodeIds.has(edge.from) && validNodeIds.has(edge.to)) return edge;
        reportIssue(reporter, {
          code: 'unresolved-workflow-edge',
          message: 'A workflow edge references a missing node; it remains visible in data but is disabled.',
          severity: 'warning',
          canvasId,
          nodeId: edge.id,
        });
        return { ...edge, state: 'disabled' as const };
      }),
    }
    : canvas.workflow;

  return {
    ...canvas,
    promptNodes,
    imageNodes,
    groups,
    drawings,
    noteNodes,
    workflow,
  };
};

export const sanitizePersistedCanvasesWithReport = (canvases: unknown = []): CanvasSanitizationResult => {
  const reporter: SanitizationReporter = {
    changed: false,
    affectedCanvasIds: new Set(),
    repairedNodeIds: new Set(),
    flaggedNodeIds: new Set(),
    issues: [],
  };
  if (!Array.isArray(canvases)) {
    reportIssue(reporter, {
      code: 'invalid-canvas-collection',
      message: 'The persisted canvas collection was malformed and isolated from runtime rendering.',
      severity: 'warning',
    });
    return {
      canvases: [],
      changed: reporter.changed,
      affectedCanvasIds: [],
      repairedNodeIds: [],
      flaggedNodeIds: [],
      issues: reporter.issues,
    };
  }

  const validCanvases = canvases.filter((entry): entry is Canvas => {
    const valid = isRecord(entry) && typeof entry.id === 'string' && entry.id.length > 0;
    if (!valid) {
      reportIssue(reporter, {
        code: 'invalid-canvas-entry',
        message: 'A malformed canvas was preserved in the migration backup and isolated from rendering.',
        severity: 'warning',
      });
    }
    return valid;
  });
  const sanitized = validCanvases.map((canvas) => sanitizePersistedCanvasWithReport(canvas, reporter));
  return {
    canvases: sanitized,
    changed: reporter.changed,
    affectedCanvasIds: [...reporter.affectedCanvasIds],
    repairedNodeIds: [...reporter.repairedNodeIds],
    flaggedNodeIds: [...reporter.flaggedNodeIds],
    issues: reporter.issues,
  };
};

export const sanitizePersistedCanvas = (canvas: Canvas): Canvas => (
  sanitizePersistedCanvasesWithReport([canvas]).canvases[0] ?? canvas
);

export const sanitizePersistedCanvases = (canvases: unknown = []): Canvas[] => (
  sanitizePersistedCanvasesWithReport(canvases).canvases
);
