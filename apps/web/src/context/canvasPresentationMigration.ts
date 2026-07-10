import {
  CANVAS_PRESENTATION_VERSION,
  type CanvasCardKind,
  type CanvasCardPresentation,
  type CanvasCardSizeToken,
  type CanvasLayoutMode,
  type CanvasMigrationSummary,
} from '@kk/shared';
import { GenerationMode, type Canvas, type GeneratedImage, type PromptNode } from '../types.ts';

const PROMPT_WIDTH = 320;
const DEFAULT_IMAGE_WIDTH = 280;
const DEFAULT_IMAGE_HEIGHT = 360;

const resolvePorts = (layoutMode: CanvasLayoutMode): CanvasCardPresentation['ports'] => (
  layoutMode === 'row'
    ? { source: 'right', target: 'left' }
    : { source: 'bottom', target: 'top' }
);

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
  const childImagesByPromptId = new Map<string, GeneratedImage[]>();

  canvas.imageNodes.forEach((image) => {
    if (!image.parentPromptId) return;
    const current = childImagesByPromptId.get(image.parentPromptId) || [];
    current.push(image);
    childImagesByPromptId.set(image.parentPromptId, current);
  });

  const promptNodes = canvas.promptNodes.map((prompt) => {
    if (prompt.presentation?.version === CANVAS_PRESENTATION_VERSION) return prompt;
    const children = childImagesByPromptId.get(prompt.id) || [];
    const layoutMode = inferPromptLayoutMode(prompt, children);
    const kind = resolvePromptCardKind(prompt, children.length);
    inferredLayoutNodeIds.push(prompt.id);
    migratedNodeIds.push(prompt.id);
    return {
      ...prompt,
      presentation: createCanvasCardPresentation(kind, layoutMode, resolvePromptSize(kind)),
    };
  });

  const imageNodes = canvas.imageNodes.map((image) => {
    if (image.presentation?.version === CANVAS_PRESENTATION_VERSION) return image;
    migratedNodeIds.push(image.id);
    return {
      ...image,
      presentation: createCanvasCardPresentation(
        'media-only',
        'column',
        'compact',
      ),
    };
  });

  const workflow = canvas.workflow
    ? {
      ...canvas.workflow,
      nodes: canvas.workflow.nodes.map((node) => {
        if (node.presentation?.version === CANVAS_PRESENTATION_VERSION) return node;
        migratedNodeIds.push(node.id);
        return {
          ...node,
          presentation: createCanvasCardPresentation('workflow-panel', 'column', 'wide'),
        };
      }),
    }
    : canvas.workflow;

  const noteNodes = (canvas.noteNodes || []).map((note) => (
    note.presentation?.version === CANVAS_PRESENTATION_VERSION
      ? note
      : {
        ...note,
        presentation: createCanvasCardPresentation('notebook', 'column', 'standard'),
      }
  ));

  const changed = canvas.presentationVersion !== CANVAS_PRESENTATION_VERSION || migratedNodeIds.length > 0;
  return {
    changed,
    migratedNodeIds,
    inferredLayoutNodeIds,
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
