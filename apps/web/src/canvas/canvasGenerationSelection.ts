import { GenerationMode, type Canvas, type GenerationConfig, type GeneratedImage, type PromptNode } from '../types.ts';

export type CanvasGenerationTarget = {
  nodeId: string;
  promptNodeId: string;
  mode: GenerationMode;
  referenceImageNodeId?: string;
};

export type CanvasGenerationSelection = {
  eligibleTargets: CanvasGenerationTarget[];
  skippedNodeIds: string[];
  unsupportedNodeIds: string[];
};

const MEDIA_MODES = new Set<GenerationMode>([
  GenerationMode.IMAGE,
  GenerationMode.VIDEO,
  GenerationMode.AUDIO,
  GenerationMode.PPT,
  GenerationMode.ECOMMERCE,
]);

const normalizeMode = (value: unknown): GenerationMode | undefined => (
  typeof value === 'string' && MEDIA_MODES.has(value as GenerationMode)
    ? value as GenerationMode
    : undefined
);

const getPromptCapabilityModes = (prompt: PromptNode): GenerationMode[] => {
  const explicit = Array.isArray(prompt.capabilityTags)
    ? prompt.capabilityTags.map(normalizeMode).filter((mode): mode is GenerationMode => Boolean(mode))
    : [];
  if (explicit.length > 0) return explicit;
  const fallback = [normalizeMode(prompt.draftMode), normalizeMode(prompt.mode)].filter(
    (mode): mode is GenerationMode => Boolean(mode),
  );
  return fallback.length > 0 ? fallback : [GenerationMode.IMAGE];
};

const findPromptForImage = (image: GeneratedImage, promptsById: Map<string, PromptNode>): PromptNode | undefined => (
  image.parentPromptId ? promptsById.get(image.parentPromptId) : undefined
);

const addPromptTarget = (
  targets: Map<string, CanvasGenerationTarget>,
  prompt: PromptNode,
  requestedMode: GenerationMode,
  referenceImageNodeId?: string,
) => {
  if (!getPromptCapabilityModes(prompt).includes(requestedMode)) return false;
  const current = targets.get(prompt.id);
  if (current && !referenceImageNodeId) {
    targets.set(prompt.id, { ...current, referenceImageNodeId: undefined });
  } else if (!current) {
    targets.set(prompt.id, {
      nodeId: prompt.id,
      promptNodeId: prompt.id,
      mode: requestedMode,
      referenceImageNodeId,
    });
  }
  return true;
};

/**
 * Resolves a canvas selection into queue-safe prompt targets without creating duplicate jobs for child images.
 * Capability tags are authoritative so specialized cards are not accidentally sent through a generic mode.
 */
export const resolveCanvasGenerationSelection = (
  canvas: Canvas | undefined,
  selectedNodeIds: readonly string[],
  config: Pick<GenerationConfig, 'mode'>,
): CanvasGenerationSelection => {
  const requestedMode = normalizeMode(config.mode);
  if (!canvas || !requestedMode) {
    return {
      eligibleTargets: [],
      skippedNodeIds: [],
      unsupportedNodeIds: [...selectedNodeIds],
    };
  }

  const promptById = new Map(canvas.promptNodes.map((prompt) => [prompt.id, prompt]));
  const imageById = new Map(canvas.imageNodes.map((image) => [image.id, image]));
  const targets = new Map<string, CanvasGenerationTarget>();
  const skippedNodeIds: string[] = [];
  const unsupportedNodeIds: string[] = [];

  for (const nodeId of selectedNodeIds) {
    const prompt = promptById.get(nodeId);
    if (prompt) {
      if (!addPromptTarget(targets, prompt, requestedMode)) skippedNodeIds.push(nodeId);
      continue;
    }

    const image = imageById.get(nodeId);
    if (!image) {
      unsupportedNodeIds.push(nodeId);
      continue;
    }

    const parentPrompt = findPromptForImage(image, promptById);
    if (!parentPrompt) {
      skippedNodeIds.push(nodeId);
      continue;
    }
    if (!addPromptTarget(targets, parentPrompt, requestedMode, image.id)) skippedNodeIds.push(nodeId);
  }

  return {
    eligibleTargets: [...targets.values()],
    skippedNodeIds,
    unsupportedNodeIds,
  };
};

const hashStable = (value: string): string => {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
};

export const createCanvasGenerationIdempotencyKey = (params: {
  canvasId: string;
  mode: GenerationMode;
  prompt: string;
  targetNodeIds: readonly string[];
}): string => `canvas_batch_${hashStable(JSON.stringify({
  canvasId: params.canvasId,
  mode: params.mode,
  prompt: params.prompt,
  targetNodeIds: [...params.targetNodeIds].sort(),
}))}`;

