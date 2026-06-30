import { GenerationMode, type GeneratedImage, type PromptNode } from '../types.ts';

export function buildPromptChildImagesByPromptId(
  promptNodes: PromptNode[] | undefined | null,
  imageNodes: GeneratedImage[] | undefined | null,
): Map<string, GeneratedImage[]> {
  const childImagesByPromptId = new Map<string, GeneratedImage[]>();
  const safePromptNodes = promptNodes || [];
  const safeImageNodes = imageNodes || [];

  if (safePromptNodes.length === 0 || safeImageNodes.length === 0) {
    return childImagesByPromptId;
  }

  const imageNodeById = new Map<string, GeneratedImage>();
  const strongOwnedImagesByPromptId = new Map<string, GeneratedImage[]>();

  safeImageNodes.forEach((imageNode) => {
    imageNodeById.set(imageNode.id, imageNode);
    if (!imageNode.parentPromptId) {
      return;
    }

    const ownedImages = strongOwnedImagesByPromptId.get(imageNode.parentPromptId);
    if (ownedImages) {
      ownedImages.push(imageNode);
      return;
    }

    strongOwnedImagesByPromptId.set(imageNode.parentPromptId, [imageNode]);
  });

  safePromptNodes.forEach((promptNode) => {
    if (promptNode.mode === GenerationMode.PPT) {
      return;
    }

    const promptId = promptNode.id;
    const sourceImageId = promptNode.sourceImageId;
    const orderedIds = (promptNode.childImageIds || []).filter((id): id is string => Boolean(id));
    const strongOwnedImages = (strongOwnedImagesByPromptId.get(promptId) || [])
      .filter((imageNode) => imageNode.id !== sourceImageId);

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

      childImagesByPromptId.set(promptId, orderedOwnedImages);
      return;
    }

    if (promptNode.error || sourceImageId) {
      return;
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

    if (legacyOwnedImages.length > 0) {
      childImagesByPromptId.set(promptId, legacyOwnedImages);
    }
  });

  return childImagesByPromptId;
}
