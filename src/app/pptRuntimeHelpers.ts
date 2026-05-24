import { GenerationMode, type Canvas, type GeneratedImage, type PptEditableImageLayer, type PptEditablePage, type PromptNode } from '../types';
import { getPromptPptImageNodes } from '../utils/pptEditable';

export type PptRuntimeCanvasSnapshot = Pick<Canvas, 'imageNodes' | 'promptNodes'>;

function resolveOrderedPptImagesForPrompt(
  imageNodes: GeneratedImage[] | undefined | null,
  promptNode: PromptNode,
): GeneratedImage[] {
  const safeImageNodes = imageNodes || [];
  const imageNodeById = new Map(safeImageNodes.map((imageNode) => [imageNode.id, imageNode] as const));
  const orderedImages: GeneratedImage[] = [];
  const seenIds = new Set<string>();

  const pushImage = (candidate: GeneratedImage | undefined): void => {
    if (!candidate) return;
    if (candidate.parentPromptId !== promptNode.id) return;
    if (seenIds.has(candidate.id)) return;
    seenIds.add(candidate.id);
    orderedImages.push(candidate);
  };

  (promptNode.childImageIds || []).filter(Boolean).forEach((imageId) => {
    pushImage(imageNodeById.get(imageId));
  });

  getPromptPptImageNodes(safeImageNodes, promptNode.id).forEach(pushImage);

  return orderedImages;
}

export function resolveOrderedPptPreviewBundleForCanvas(
  canvas: PptRuntimeCanvasSnapshot,
  imageId: string,
): { promptNode: PromptNode; images: GeneratedImage[]; currentIndex: number } | null {
  const target = canvas.imageNodes.find((img) => img.id === imageId);
  if (!target || target.mode !== GenerationMode.PPT || !target.parentPromptId) {
    return null;
  }

  const promptNode = canvas.promptNodes.find((node) => node.id === target.parentPromptId);
  if (!promptNode || promptNode.mode !== GenerationMode.PPT) {
    return null;
  }

  const images = resolveOrderedPptImagesForPrompt(canvas.imageNodes, promptNode);
  if (images.length === 0) return null;

  const currentIndex = Math.max(0, images.findIndex((img) => img.id === imageId));
  return {
    promptNode,
    images,
    currentIndex,
  };
}

export function resolveOrderedPptNodeBundleForCanvas(
  canvas: PptRuntimeCanvasSnapshot,
  nodeOrId: PromptNode | string,
): { promptNode: PromptNode; images: GeneratedImage[] } | null {
  const promptNode = typeof nodeOrId === 'string'
    ? canvas.promptNodes.find((node) => node.id === nodeOrId)
    : canvas.promptNodes.find((node) => node.id === nodeOrId.id) || nodeOrId;

  if (!promptNode || promptNode.mode !== GenerationMode.PPT) return null;

  const images = resolveOrderedPptImagesForPrompt(canvas.imageNodes, promptNode);
  if (images.length === 0) return null;

  return {
    promptNode,
    images,
  };
}

export function isPptDeckChildImageNodeFromCanvas(
  imageNode: GeneratedImage,
  canvas: PptRuntimeCanvasSnapshot | undefined,
): boolean {
  if (!imageNode.parentPromptId || !canvas) {
    return false;
  }

  const parentPrompt = canvas.promptNodes.find((promptNode) => promptNode.id === imageNode.parentPromptId);
  return Boolean(parentPrompt && parentPrompt.mode === GenerationMode.PPT);
}

export function resolvePptEditablePageImageId(page: PptEditablePage | undefined | null): string | undefined {
  if (!page) return undefined;
  return page.backgroundImageId
    || page.layers.find((layer): layer is PptEditableImageLayer => layer.type === 'image')?.imageNodeId;
}

export function resolveCurrentPromptChildImagesForPptRuntime(
  promptNode: PromptNode | undefined | null,
  imageNodes: GeneratedImage[] | undefined | null,
): GeneratedImage[] {
  if (!promptNode) return [] as GeneratedImage[];
  if (promptNode.mode === GenerationMode.PPT) return [] as GeneratedImage[];

  const safeImageNodes = imageNodes || [];
  const promptId = promptNode.id;
  const sourceImageId = promptNode.sourceImageId;
  const orderedIds = (promptNode.childImageIds || []).filter((id): id is string => Boolean(id));
  const imageNodeById = new Map(safeImageNodes.map((imageNode) => [imageNode.id, imageNode] as const));
  const strongOwnedImages = safeImageNodes.filter((imageNode) => (
    imageNode.parentPromptId === promptId && imageNode.id !== sourceImageId
  ));

  if (strongOwnedImages.length > 0) {
    const orderedOwnedImages: GeneratedImage[] = [];
    const seenIds = new Set<string>();

    orderedIds.forEach((imageId) => {
      const imageNode = imageNodeById.get(imageId);
      if (!imageNode || imageNode.id === sourceImageId || imageNode.parentPromptId !== promptId || seenIds.has(imageNode.id)) {
        return;
      }
      seenIds.add(imageNode.id);
      orderedOwnedImages.push(imageNode);
    });

    strongOwnedImages.forEach((imageNode) => {
      if (seenIds.has(imageNode.id)) return;
      seenIds.add(imageNode.id);
      orderedOwnedImages.push(imageNode);
    });

    // 按照时间戳升序排序，使新生成的在最下面，旧时间生成的在上面，同时防止 React 更新时元素微抖动导致卡片错位
    orderedOwnedImages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    return orderedOwnedImages;
  }

  if (promptNode.error) {
    return [] as GeneratedImage[];
  }

  if (sourceImageId) {
    return [] as GeneratedImage[];
  }

  const legacyOwnedImages: GeneratedImage[] = [];
  const seenIds = new Set<string>();
  orderedIds.forEach((imageId) => {
    const imageNode = imageNodeById.get(imageId);
    if (!imageNode || imageNode.id === sourceImageId || imageNode.parentPromptId || seenIds.has(imageNode.id)) {
      return;
    }
    seenIds.add(imageNode.id);
    legacyOwnedImages.push(imageNode);
  });

  // 按照时间戳升序排序
  legacyOwnedImages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  return legacyOwnedImages;
}
