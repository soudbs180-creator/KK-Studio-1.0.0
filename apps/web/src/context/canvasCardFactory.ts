import type { CanvasCardKind, CanvasLayoutMode } from '@kk/shared';
import {
  AspectRatio,
  GenerationMode,
  ImageSize,
  type CanvasNoteNode,
  type GeneratedImage,
  type PromptNode,
  type WorkflowPanelNode,
  type WorkflowPanelStep,
} from '../types.ts';
import { createCanvasCardPresentation } from './canvasPresentationMigration.ts';

export type CanvasCardMediaInput = {
  url: string;
  mimeType?: string;
  fileName?: string;
  storageId?: string;
  prompt?: string;
};

export type CanvasCreateCardInput = {
  kind: CanvasCardKind;
  /** Agent/tool retry key. When present, every produced node ID is deterministic. */
  idempotencyKey?: string;
  title?: string;
  prompt?: string;
  position?: { x: number; y: number };
  layoutMode?: CanvasLayoutMode;
  aspectRatio?: string;
  imageSize?: string;
  model?: string;
  media?: CanvasCardMediaInput[];
  pptSlides?: string[];
  noteElements?: CanvasNoteNode['elements'];
  sourceNodeIds?: string[];
  workflowSteps?: Array<Partial<WorkflowPanelStep> & Pick<WorkflowPanelStep, 'label'>>;
  diagnostic?: string;
};

export type CanvasCardFactoryDefaults = {
  canvasId: string;
  position: { x: number; y: number };
  model?: string;
  now?: number;
  idFactory?: (prefix: string, index?: number) => string;
};

export type CanvasCardFactoryResult = {
  kind: CanvasCardKind;
  primaryNodeId: string;
  promptNodes: PromptNode[];
  imageNodes: GeneratedImage[];
  noteNodes: CanvasNoteNode[];
  workflowNodes: WorkflowPanelNode[];
};

const createDefaultId = (now: number) => (prefix: string, index = 0) => (
  `${prefix}-${now.toString(36)}-${index}-${Math.random().toString(36).slice(2, 8)}`
);

const stableCardHash = (value: string, seed: number): string => value.split('').reduce(
  (hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0,
  seed,
).toString(16).padStart(8, '0');

const createDeterministicId = (idempotencyKey: string) => (prefix: string, index = 0) => {
  const source = `${idempotencyKey}\u0000${prefix}\u0000${index}`;
  return `agent-${prefix}-${stableCardHash(source, 2166136261)}${stableCardHash(source, 3335557771)}`;
};

const resolvePromptMode = (kind: CanvasCardKind) => {
  if (kind === 'ecommerce') return GenerationMode.ECOMMERCE;
  if (kind === 'ppt-deck') return GenerationMode.PPT;
  return GenerationMode.IMAGE;
};

export const createCanvasCardNodes = (
  input: CanvasCreateCardInput,
  defaults: CanvasCardFactoryDefaults,
): CanvasCardFactoryResult => {
  const now = defaults.now ?? Date.now();
  const idFactory = defaults.idFactory
    || (input.idempotencyKey ? createDeterministicId(input.idempotencyKey) : createDefaultId(now));
  const position = input.position || defaults.position;
  const layoutMode = input.layoutMode || (input.kind === 'multi-image' ? 'grid' : 'column');
  const aspectRatio = (input.aspectRatio || AspectRatio.SQUARE) as PromptNode['aspectRatio'];
  const imageSize = (input.imageSize || ImageSize.SIZE_1K) as PromptNode['imageSize'];
  const model = input.model || defaults.model || 'gemini-2.5-flash-image';
  const media = (input.media || []).filter((item) => typeof item.url === 'string' && item.url.trim());
  const result: CanvasCardFactoryResult = {
    kind: input.kind,
    primaryNodeId: '',
    promptNodes: [],
    imageNodes: [],
    noteNodes: [],
    workflowNodes: [],
  };

  if (input.kind === 'workflow-panel') {
    const id = idFactory('workflow-panel');
    result.primaryNodeId = id;
    result.workflowNodes.push({
      id,
      kind: 'workflow-panel',
      position,
      width: 420,
      height: 420,
      presentation: createCanvasCardPresentation('workflow-panel', layoutMode, 'wide'),
      data: {
        title: input.title || input.prompt || 'Workflow',
        status: 'idle',
        steps: (input.workflowSteps || []).map((step, index) => ({
          id: step.id || idFactory('workflow-step', index),
          label: step.label,
          enabled: step.enabled !== false,
          parameters: step.parameters || {},
          status: step.status || 'idle',
          error: step.error,
        })),
        outputNodeIds: [],
      },
    });
    return result;
  }

  if (input.kind === 'notebook') {
    const id = idFactory('note');
    result.primaryNodeId = id;
    result.noteNodes.push({
      id,
      title: input.title || 'Notebook',
      position,
      width: 320,
      height: 240,
      elements: input.noteElements || [],
      sourceNodeIds: input.sourceNodeIds,
      presentation: createCanvasCardPresentation('notebook', layoutMode, 'standard'),
      createdAt: now,
      updatedAt: now,
    });
    return result;
  }

  if (input.kind === 'media-only' || input.kind === 'audio') {
    if (media.length === 0) throw new Error(`${input.kind} cards require at least one media URL.`);
    media.forEach((item, index) => {
      const id = idFactory(input.kind === 'audio' ? 'audio' : 'media', index);
      if (!result.primaryNodeId) result.primaryNodeId = id;
      result.imageNodes.push({
        id,
        url: item.url,
        storageId: item.storageId,
        fileName: item.fileName,
        mimeType: item.mimeType,
        prompt: item.prompt || input.prompt || input.title || '',
        aspectRatio,
        imageSize,
        timestamp: now,
        model,
        canvasId: defaults.canvasId,
        parentPromptId: '',
        orphaned: true,
        mode: input.kind === 'audio' ? GenerationMode.AUDIO : GenerationMode.IMAGE,
        position: { x: position.x + index * 360, y: position.y },
        presentation: createCanvasCardPresentation(input.kind, layoutMode, 'standard'),
      });
    });
    return result;
  }

  const promptId = idFactory('prompt');
  const promptKind = input.kind;
  const promptNode: PromptNode = {
    id: promptId,
    prompt: input.prompt || input.title || (promptKind === 'unknown' ? 'Unsupported card' : ''),
    position,
    aspectRatio,
    imageSize,
    model,
    childImageIds: [],
    timestamp: now,
    mode: resolvePromptMode(promptKind),
    pptSlides: input.pptSlides,
    ...(promptKind === 'ecommerce' ? {
      ecommerce: {
        kind: 'framework' as const,
        sourceSheet: '主图' as const,
        sourceRowKey: promptId,
        stage: 'ready' as const,
        displayLabel: input.title || 'Ecommerce workbench',
        frameworkMeta: {
          activeSheet: '主图' as const,
          taskNodeIds: [],
          inputSummary: input.prompt ? [input.prompt] : [],
        },
      },
    } : {}),
    presentation: createCanvasCardPresentation(
      promptKind,
      layoutMode,
      promptKind === 'ppt-deck' || promptKind === 'ecommerce' || promptKind === 'multi-image' ? 'wide' : 'standard',
      input.diagnostic || (promptKind === 'unknown' ? 'Unsupported card kind' : undefined),
    ),
  };

  media.forEach((item, index) => {
    const id = idFactory('image', index);
    promptNode.childImageIds.push(id);
    result.imageNodes.push({
      id,
      url: item.url,
      storageId: item.storageId,
      fileName: item.fileName,
      mimeType: item.mimeType,
      prompt: item.prompt || promptNode.prompt,
      aspectRatio,
      imageSize,
      timestamp: now,
      model,
      canvasId: defaults.canvasId,
      parentPromptId: promptId,
      mode: promptNode.mode,
      position: layoutMode === 'row'
        ? { x: position.x + 480 + index * 360, y: position.y }
        : { x: position.x, y: position.y + 420 + index * 360 },
      presentation: createCanvasCardPresentation('media-only', layoutMode, 'standard'),
    });
  });

  result.primaryNodeId = promptId;
  result.promptNodes.push(promptNode);
  return result;
};
