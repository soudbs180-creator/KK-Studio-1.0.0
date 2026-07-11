import {
  CANVAS_PRESENTATION_VERSION,
  type CanvasCardKind,
  type CanvasCardPresentation,
  type CanvasCardSizeToken,
  type CanvasLayoutMode,
  type CanvasMigrationIssue,
  type CanvasMigrationSummary,
} from '@kk/shared';
import { GenerationMode, type Canvas, type GeneratedImage, type PromptNode } from '../types.ts';

const PROMPT_WIDTH = 320;
const DEFAULT_IMAGE_WIDTH = 280;
const DEFAULT_IMAGE_HEIGHT = 360;
const CARD_KINDS = new Set<CanvasCardKind>([
  'prompt-result-group', 'prompt-only', 'media-only', 'ecommerce', 'ppt-deck',
  'audio', 'text', 'notebook', 'multi-image', 'workflow-panel', 'unknown',
]);
const LAYOUT_MODES = new Set<CanvasLayoutMode>(['row', 'column', 'grid']);
const SIZE_TOKENS = new Set<CanvasCardSizeToken>(['compact', 'standard', 'wide']);

const resolvePorts = (layoutMode: CanvasLayoutMode): CanvasCardPresentation['ports'] => (
  layoutMode === 'row'
    ? { source: 'right', target: 'left' }
    : { source: 'bottom', target: 'top' }
);

const isValidPresentation = (
  presentation: unknown,
  allowedKinds: ReadonlySet<CanvasCardKind>,
): presentation is CanvasCardPresentation => {
  if (!presentation || typeof presentation !== 'object') return false;
  const candidate = presentation as Partial<CanvasCardPresentation>;
  if (candidate.version !== CANVAS_PRESENTATION_VERSION) return false;
  if (!candidate.kind || !CARD_KINDS.has(candidate.kind) || !allowedKinds.has(candidate.kind)) return false;
  if (!candidate.layoutMode || !LAYOUT_MODES.has(candidate.layoutMode)) return false;
  if (!candidate.size || !SIZE_TOKENS.has(candidate.size)) return false;
  const expectedPorts = resolvePorts(candidate.layoutMode);
  return candidate.ports?.source === expectedPorts.source
    && candidate.ports?.target === expectedPorts.target;
};

const normalizePresentation = (
  presentation: unknown,
  expected: CanvasCardPresentation,
  allowedKinds: ReadonlySet<CanvasCardKind>,
  nodeId: string,
  issues: CanvasMigrationIssue[],
): { presentation: CanvasCardPresentation; changed: boolean; inferred: boolean } => {
  if (isValidPresentation(presentation, allowedKinds)) {
    return { presentation, changed: false, inferred: false };
  }
  const candidate = presentation as Partial<CanvasCardPresentation> | undefined;
  if (!candidate || candidate.version !== CANVAS_PRESENTATION_VERSION) {
    return { presentation: expected, changed: true, inferred: true };
  }
  const diagnostic = `Damaged card presentation for ${nodeId}; original card data was preserved.`;
  issues.push({
    code: 'damaged-card-presentation',
    message: diagnostic,
    severity: 'warning',
    nodeId,
  });
  return {
    presentation: createCanvasCardPresentation('unknown', 'column', 'standard', diagnostic),
    changed: true,
    inferred: false,
  };
};

export const createCanvasCardPresentation = (
  kind: CanvasCardKind,
  layoutMode: CanvasLayoutMode = 'column',
  size: CanvasCardSizeToken = 'standard',
  diagnostic?: string,
): CanvasCardPresentation => ({
  version: CANVAS_PRESENTATION_VERSION,
  kind,
  layoutMode,
  size,
  ports: resolvePorts(layoutMode),
  ...(diagnostic ? { diagnostic } : {}),
});

export const inferPromptLayoutMode = (
  prompt: PromptNode,
  childImages: GeneratedImage[],
): CanvasLayoutMode => {
  if (childImages.length === 0) return 'column';

  const childCenters = childImages.map((image) => image.position);
  const averageX = childCenters.reduce((sum, point) => sum + point.x, 0) / childCenters.length;
  const averageY = childCenters.reduce((sum, point) => sum + point.y, 0) / childCenters.length;
  const deltaX = averageX - prompt.position.x;
  const deltaY = averageY - prompt.position.y;
  const minX = Math.min(...childCenters.map((point) => point.x));
  const maxX = Math.max(...childCenters.map((point) => point.x));
  const minY = Math.min(...childCenters.map((point) => point.y));
  const maxY = Math.max(...childCenters.map((point) => point.y));
  const spreadX = maxX - minX;
  const spreadY = maxY - minY;

  if (
    childImages.length >= 3
    && spreadX > DEFAULT_IMAGE_WIDTH * 1.2
    && spreadY > DEFAULT_IMAGE_HEIGHT * 0.5
  ) {
    return 'grid';
  }

  if (
    deltaX > PROMPT_WIDTH / 2
    && Math.abs(deltaX) >= Math.abs(deltaY) * 0.65
  ) {
    return 'row';
  }

  return 'column';
};

export const resolvePromptCardKind = (prompt: PromptNode, childCount: number): CanvasCardKind => {
  if (prompt.mode === GenerationMode.ECOMMERCE) return 'ecommerce';
  if (prompt.mode === GenerationMode.PPT) return 'ppt-deck';
  if (prompt.mode === GenerationMode.AUDIO) return 'audio';
  if (prompt.tags?.includes('assistant') || prompt.tags?.includes('text')) return 'text';
  if (childCount > 1) return 'multi-image';
  return childCount > 0 ? 'prompt-result-group' : 'prompt-only';
};

const resolvePromptSize = (kind: CanvasCardKind): CanvasCardSizeToken => (
  kind === 'ecommerce' || kind === 'ppt-deck' ? 'wide' : 'standard'
);

const migrateCanvas = (canvas: Canvas) => {
  const inferredLayoutNodeIds: string[] = [];
  const migratedNodeIds: string[] = [];
  const flaggedNodeIds: string[] = [];
  const issues: CanvasMigrationIssue[] = [];
  const childImagesByPromptId = new Map<string, GeneratedImage[]>();

  canvas.imageNodes.forEach((image) => {
    if (!image.parentPromptId) return;
    const current = childImagesByPromptId.get(image.parentPromptId) || [];
    current.push(image);
    childImagesByPromptId.set(image.parentPromptId, current);
  });

  const promptNodes = canvas.promptNodes.map((prompt) => {
    const children = childImagesByPromptId.get(prompt.id) || [];
    const layoutMode = inferPromptLayoutMode(prompt, children);
    const kind = resolvePromptCardKind(prompt, children.length);
    const normalized = normalizePresentation(
      prompt.presentation,
      createCanvasCardPresentation(kind, layoutMode, resolvePromptSize(kind)),
      new Set<CanvasCardKind>(['prompt-result-group', 'prompt-only', 'ecommerce', 'ppt-deck', 'audio', 'text', 'multi-image', 'unknown']),
      prompt.id,
      issues,
    );
    if (!normalized.changed) return prompt;
    if (normalized.inferred) inferredLayoutNodeIds.push(prompt.id);
    else flaggedNodeIds.push(prompt.id);
    migratedNodeIds.push(prompt.id);
    return {
      ...prompt,
      presentation: normalized.presentation,
    };
  });

  const imageNodes = canvas.imageNodes.map((image) => {
    const normalized = normalizePresentation(
      image.presentation,
      createCanvasCardPresentation('media-only', 'column', 'compact'),
      new Set<CanvasCardKind>(['media-only', 'unknown']),
      image.id,
      issues,
    );
    if (!normalized.changed) return image;
    if (!normalized.inferred) flaggedNodeIds.push(image.id);
    migratedNodeIds.push(image.id);
    return {
      ...image,
      presentation: normalized.presentation,
    };
  });

  const workflow = canvas.workflow
    ? {
      ...canvas.workflow,
      nodes: canvas.workflow.nodes.map((node) => {
        const normalized = normalizePresentation(
          node.presentation,
          createCanvasCardPresentation('workflow-panel', 'column', 'wide'),
          new Set<CanvasCardKind>(['workflow-panel', 'unknown']),
          node.id,
          issues,
        );
        if (!normalized.changed) return node;
        if (!normalized.inferred) flaggedNodeIds.push(node.id);
        migratedNodeIds.push(node.id);
        return {
          ...node,
          presentation: normalized.presentation,
        };
      }),
    }
    : canvas.workflow;

  const noteNodes = (canvas.noteNodes || []).map((note) => {
    const normalized = normalizePresentation(
      note.presentation,
      createCanvasCardPresentation('notebook', 'column', 'standard'),
      new Set<CanvasCardKind>(['notebook', 'unknown']),
      note.id,
      issues,
    );
    if (!normalized.changed) return note;
    if (!normalized.inferred) flaggedNodeIds.push(note.id);
    migratedNodeIds.push(note.id);
    return { ...note, presentation: normalized.presentation };
  });

  const changed = canvas.presentationVersion !== CANVAS_PRESENTATION_VERSION || migratedNodeIds.length > 0;
  return {
    changed,
    migratedNodeIds,
    flaggedNodeIds,
    inferredLayoutNodeIds,
    issues: issues.map((issue) => ({ ...issue, canvasId: canvas.id })),
    canvas: changed
      ? {
        ...canvas,
        promptNodes,
        imageNodes,
        noteNodes,
        workflow,
        presentationVersion: CANVAS_PRESENTATION_VERSION,
      }
      : canvas,
  };
};

export const migrateCanvasPresentations = (canvases: Canvas[]) => {
  const results = canvases.map(migrateCanvas);
  const migratedCanvasIds = results.filter((result) => result.changed).map((result) => result.canvas.id);
  const summary: CanvasMigrationSummary = {
    version: CANVAS_PRESENTATION_VERSION,
    migratedCanvasIds,
    repairedNodeIds: results.flatMap((result) => result.migratedNodeIds),
    inferredLayoutNodeIds: results.flatMap((result) => result.inferredLayoutNodeIds),
    flaggedNodeIds: results.flatMap((result) => result.flaggedNodeIds),
    issues: results.flatMap((result) => result.issues),
    completedAt: Date.now(),
  };

  return {
    changed: migratedCanvasIds.length > 0,
    canvases: results.map((result) => result.canvas),
    summary,
  };
};

export const getCanvasMigrationBackupKey = (storageKey: string): string => (
  `${storageKey}:presentation-v${CANVAS_PRESENTATION_VERSION}:backup`
);

export const getCanvasMigrationSummaryKey = (storageKey: string): string => (
  `${storageKey}:presentation-v${CANVAS_PRESENTATION_VERSION}:summary`
);

export const restoreCanvasMigrationBackup = (storageKey: string): boolean => {
  const backupKey = getCanvasMigrationBackupKey(storageKey);
  const backup = localStorage.getItem(backupKey);
  if (!backup) return false;
  localStorage.setItem(storageKey, backup);
  localStorage.removeItem(backupKey);
  localStorage.removeItem(getCanvasMigrationSummaryKey(storageKey));
  return true;
};
