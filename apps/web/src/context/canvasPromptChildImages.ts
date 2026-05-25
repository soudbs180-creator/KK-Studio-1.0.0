import type { GeneratedImage, PromptNode } from '../types';

export function resolvePromptChildImageIds(
    node?: Pick<PromptNode, 'id' | 'childImageIds' | 'sourceImageId'> | null,
    imageNodes: GeneratedImage[] = []
): string[] {
    if (!node?.id) return [];

    const promptId = node.id;
    const sourceImageId = node.sourceImageId;
    const orderedIds = (node.childImageIds || []).filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    const imageNodeById = new Map(imageNodes.map((imageNode) => [imageNode.id, imageNode] as const));
    const strongOwnedImages = imageNodes.filter((imageNode) => (
        imageNode.parentPromptId === promptId && imageNode.id !== sourceImageId
    ));

    if (strongOwnedImages.length > 0) {
        const resolvedIds: string[] = [];
        const seenIds = new Set<string>();

        orderedIds.forEach((imageId) => {
            const imageNode = imageNodeById.get(imageId);
            if (!imageNode || imageNode.id === sourceImageId || imageNode.parentPromptId !== promptId || seenIds.has(imageNode.id)) {
                return;
            }
            seenIds.add(imageNode.id);
            resolvedIds.push(imageNode.id);
        });

        strongOwnedImages.forEach((imageNode) => {
            if (seenIds.has(imageNode.id)) return;
            seenIds.add(imageNode.id);
            resolvedIds.push(imageNode.id);
        });

        return resolvedIds;
    }

    if (sourceImageId) {
        return [];
    }

    const legacyIds: string[] = [];
    const seenIds = new Set<string>();
    orderedIds.forEach((imageId) => {
        const imageNode = imageNodeById.get(imageId);
        if (!imageNode || imageNode.id === sourceImageId || imageNode.parentPromptId || seenIds.has(imageNode.id)) {
            return;
        }
        seenIds.add(imageNode.id);
        legacyIds.push(imageNode.id);
    });

    return legacyIds;
}
