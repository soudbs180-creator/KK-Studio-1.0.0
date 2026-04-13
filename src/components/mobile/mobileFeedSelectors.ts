import type { GeneratedImage, PromptNode } from '../../types.ts';

export interface MobileFeedDetailEntry {
  imageId: string;
  promptId: string | null;
}

export interface MobileFeedResult {
  id: string;
  imageId: string;
  primaryImageSource: string | null;
  timestamp: number;
  parentPromptId: string | null;
  promptSummary: string;
  detailEntryId: string;
  detailEntry: MobileFeedDetailEntry;
}

const normalizeOptionalId = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const normalizeText = (value: string | null | undefined): string => value?.replace(/\s+/g, ' ').trim() ?? '';

const resolvePromptSummary = (promptNode: PromptNode | undefined, imageNode: GeneratedImage): string => {
  const candidates = [
    promptNode?.originalPrompt,
    promptNode?.prompt,
    promptNode?.optimizedPromptZh,
    promptNode?.optimizedPromptEn,
    imageNode.prompt,
    imageNode.alias,
    imageNode.fileName,
    imageNode.id,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return imageNode.id;
};

const resolvePrimaryImageSource = (imageNode: GeneratedImage): string | null => {
  const source = imageNode.originalUrl || imageNode.apiResultUrl || imageNode.url;
  if (!source) {
    return null;
  }

  if (
    source.startsWith('data:') ||
    source.startsWith('blob:') ||
    source.startsWith('http://') ||
    source.startsWith('https://')
  ) {
    return source;
  }

  return `data:${imageNode.mimeType || 'image/png'};base64,${source.replace(/[\r\n\s]+/g, '')}`;
};

const resolveTimestamp = (imageNode: GeneratedImage, promptNode: PromptNode | undefined): number => {
  if (Number.isFinite(imageNode.timestamp) && imageNode.timestamp > 0) {
    return imageNode.timestamp;
  }

  if (promptNode && Number.isFinite(promptNode.timestamp) && promptNode.timestamp > 0) {
    return promptNode.timestamp;
  }

  return 0;
};

const compareMobileFeedResults = (left: MobileFeedResult, right: MobileFeedResult): number => {
  const timeDelta = right.timestamp - left.timestamp;
  if (timeDelta !== 0) {
    return timeDelta;
  }

  const parentDelta = (left.parentPromptId ?? '').localeCompare(right.parentPromptId ?? '');
  if (parentDelta !== 0) {
    return parentDelta;
  }

  return left.id.localeCompare(right.id);
};

export function selectMobileFeedResults(
  promptNodes: PromptNode[],
  imageNodes: GeneratedImage[],
): MobileFeedResult[] {
  const promptNodeById = new Map(promptNodes.map((promptNode) => [promptNode.id, promptNode] as const));

  return imageNodes
    .map((imageNode) => {
      const parentPromptId = normalizeOptionalId(imageNode.parentPromptId);
      const promptNode = parentPromptId ? promptNodeById.get(parentPromptId) : undefined;
      const detailEntry: MobileFeedDetailEntry = {
        imageId: imageNode.id,
        promptId: parentPromptId,
      };

      return {
        id: imageNode.id,
        imageId: imageNode.id,
        primaryImageSource: resolvePrimaryImageSource(imageNode),
        timestamp: resolveTimestamp(imageNode, promptNode),
        parentPromptId,
        promptSummary: resolvePromptSummary(promptNode, imageNode),
        detailEntryId: imageNode.id,
        detailEntry,
      };
    })
    .sort(compareMobileFeedResults);
}
