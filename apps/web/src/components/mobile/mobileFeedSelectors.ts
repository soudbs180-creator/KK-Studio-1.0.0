import type {
  EcommerceFrameworkRuntimeState,
  GeneratedImage,
  MobileEcommerceContinuation,
  MobileResultEntry,
  MobileResultLayout,
  PromptNode,
} from '../../types';
import { resolveEcommerceFrameworkSummary } from '../../services/ecommerce/frameworkRuntime.ts';

const DEFAULT_RESULT_ACTIONS: MobileResultEntry['actions'] = {
  preview: true,
  useAsSource: true,
  partialRedraw: true,
  download: true,
  delete: true,
};

type EcommerceFrameworkSummary = ReturnType<typeof resolveEcommerceFrameworkSummary>;

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

const resolveDisplaySource = (imageNode: GeneratedImage): string | null => {
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

const resolveModelLabel = (imageNode: GeneratedImage): string => {
  const value = normalizeText(imageNode.modelLabel || imageNode.model || imageNode.id);
  return value || imageNode.id;
};

const resolveDisplayLabel = (
  imageNode: GeneratedImage,
  promptNode: PromptNode | undefined,
): string | undefined => {
  const normalizedImageLabel = normalizeText(imageNode.displayLabel);
  if (normalizedImageLabel) {
    return normalizedImageLabel;
  }

  const normalizedPromptLabel = normalizeText(promptNode?.ecommerce?.displayLabel);
  if (normalizedPromptLabel) {
    return normalizedPromptLabel;
  }

  const normalizedInheritedLabel = normalizeText(imageNode.redraw?.inheritedDisplayLabel || imageNode.partialRedraw?.inheritedDisplayLabel);
  return normalizedInheritedLabel || undefined;
};

const parseAspectRatioValue = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'auto') {
    return null;
  }

  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if (!match) {
    return null;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return width / height;
};

const resolveMobileResultLayout = (
  imageNode: GeneratedImage,
): MobileResultLayout => {
  const exactWidth = imageNode.exactDimensions?.width;
  const exactHeight = imageNode.exactDimensions?.height;
  const exactRatio = exactWidth && exactHeight && exactWidth > 0 && exactHeight > 0
    ? exactWidth / exactHeight
    : null;
  const ratio = exactRatio ?? parseAspectRatioValue(String(imageNode.aspectRatio || '')) ?? 1;

  if (ratio >= 1.7) {
    return {
      aspectRatio: ratio,
      aspectCategory: 'wide',
      emphasis: 'wide',
    };
  }

  if (ratio >= 1.12) {
    return {
      aspectRatio: ratio,
      aspectCategory: 'landscape',
      emphasis: 'standard',
    };
  }

  if (ratio <= 0.85) {
    return {
      aspectRatio: ratio,
      aspectCategory: 'portrait',
      emphasis: 'standard',
    };
  }

  return {
    aspectRatio: ratio,
    aspectCategory: 'square',
    emphasis: 'compact',
  };
};

function resolveEcommerceStage(
  ecommerce: PromptNode['ecommerce'] | undefined,
): Pick<MobileEcommerceContinuation, 'stageLabel' | 'stageTone' | 'stageDescription'> {
  if (!ecommerce) {
    return {
      stageLabel: '待生成',
      stageTone: 'blue',
      stageDescription: '当前模块已就绪，可以继续编辑任务或确认生成。',
    };
  }

  if (ecommerce.needsReview || (ecommerce.reviewWarnings || []).length > 0) {
    return {
      stageLabel: '待复核',
      stageTone: 'amber',
      stageDescription: '先检查运营需求和参考图绑定，再决定是否继续生成。',
    };
  }

  if (ecommerce.desktopStage === 'generated') {
    return {
      stageLabel: '桌面待确认',
      stageTone: 'blue',
      stageDescription: '桌面稿已生成，确认后即可继续生成手机版。',
    };
  }

  if (ecommerce.desktopStage === 'failed') {
    return {
      stageLabel: '桌面生成失败',
      stageTone: 'rose',
      stageDescription: '建议先编辑任务提示词，再重新生成桌面稿。',
    };
  }

  if (ecommerce.mobileStage === 'pending') {
    return {
      stageLabel: '手机待生成',
      stageTone: 'blue',
      stageDescription: '桌面稿已确认，可以继续生成手机版。',
    };
  }

  if (ecommerce.mobileStage === 'failed') {
    return {
      stageLabel: '手机生成失败',
      stageTone: 'rose',
      stageDescription: '建议微调提示词后，重新生成手机版。',
    };
  }

  if (ecommerce.mobileStage === 'generated') {
    return {
      stageLabel: '手机已生成',
      stageTone: 'emerald',
      stageDescription: '桌面和手机版都已完成，可以继续检查或调整任务。',
    };
  }

  if (ecommerce.stage === 'failed') {
    return {
      stageLabel: '生成失败',
      stageTone: 'rose',
      stageDescription: '建议先检查任务内容，再重新发起生成。',
    };
  }

  if (ecommerce.stage === 'generated') {
    return {
      stageLabel: '已生成',
      stageTone: 'emerald',
      stageDescription: '当前模块已生成完成，可以继续创作或编辑任务。',
    };
  }

  if (ecommerce.stage === 'generating') {
    return {
      stageLabel: '生成中',
      stageTone: 'blue',
      stageDescription: '当前模块正在生成，请等待结果返回。',
    };
  }

  return {
    stageLabel: '待生成',
    stageTone: 'blue',
    stageDescription: '当前模块已就绪，可以继续编辑任务或确认生成。',
  };
}

function resolveEcommerceContinuation(
  imageNode: GeneratedImage,
  promptNode: PromptNode | undefined,
  frameworkSummaryById: Map<string, EcommerceFrameworkSummary>,
): MobileEcommerceContinuation | undefined {
  const ecommerce = promptNode?.ecommerce;
  const inheritedTaskState = imageNode.redraw?.inheritedTaskState || imageNode.partialRedraw?.inheritedTaskState;
  const taskState = ecommerce?.editableTask || inheritedTaskState;
  const sourceSheet = ecommerce?.sourceSheet || taskState?.sourceSheet;
  const kind = ecommerce?.kind || taskState?.sourceKind;
  const frameworkId = ecommerce?.frameworkId;
  const frameworkSummary = frameworkId ? frameworkSummaryById.get(frameworkId) : undefined;

  if (!sourceSheet || !kind || kind === 'a-plus-group' || kind === 'framework') {
    return undefined;
  }

  const displayLabel = resolveDisplayLabel(imageNode, promptNode)
    || taskState?.displayLabel
    || taskState?.outputTypeLabel
    || '';
  const stage = resolveEcommerceStage(ecommerce);

  return {
    promptNodeId: promptNode?.id || imageNode.redraw?.sourcePromptId || imageNode.partialRedraw?.sourcePromptId || null,
    taskId: taskState?.taskId,
    sourceSheet,
    kind,
    sourceRowKey: ecommerce?.sourceRowKey || taskState?.sourceRowKey || imageNode.id,
    outputTypeLabel: taskState?.outputTypeLabel || displayLabel || kind,
    displayLabel: displayLabel || taskState?.outputTypeLabel || kind,
    declaredSizeText: ecommerce?.declaredSizeText,
    taskPrompt: normalizeText(taskState?.sparseUserIntent),
    assetRoles: taskState?.assetRoles || [],
    stageLabel: stage.stageLabel,
    stageTone: stage.stageTone,
    stageDescription: stage.stageDescription,
    reviewWarnings: ecommerce?.reviewWarnings || [],
    selectedForGeneration: ecommerce?.selectedForGeneration !== false,
    canEditTask: Boolean(taskState),
    canConfirmDesktop: ecommerce?.kind === 'a-plus-module' && ecommerce.desktopStage === 'generated',
    canGenerateMobile: ecommerce?.kind === 'a-plus-module' && ecommerce.desktopStage === 'confirmed',
    canToggleSelection: Boolean(ecommerce && ecommerce.kind !== 'a-plus-group'),
    ...(frameworkId ? { frameworkId } : {}),
    ...(frameworkSummary
      ? {
          frameworkLabel: frameworkSummary.frameworkLabel,
          frameworkStatus: {
            activeSheet: frameworkSummary.activeSheet,
            paused: frameworkSummary.paused,
            queued: frameworkSummary.queued,
            dispatching: frameworkSummary.dispatching,
            running: frameworkSummary.running,
            completed: frameworkSummary.completed,
            failed: frameworkSummary.failed,
            pausedItems: frameworkSummary.pausedItems,
            total: frameworkSummary.total,
          },
        }
      : {}),
  };
}

const compareMobileFeedResults = (left: MobileResultEntry, right: MobileResultEntry): number => {
  // 简体中文：更改为升序排序，使较新（时间戳大）的结果排在最下方，完美契合滚动到底部对焦的体验
  const timeDelta = left.timestamp - right.timestamp;
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
  frameworkRuntime: Record<string, EcommerceFrameworkRuntimeState> = {},
): MobileResultEntry[] {
  const promptNodeById = new Map(promptNodes.map((promptNode) => [promptNode.id, promptNode] as const));
  const frameworkSummaryById = new Map(
    promptNodes
      .filter((promptNode) => promptNode.ecommerce?.kind === 'framework')
      .map((frameworkNode) => [
        frameworkNode.id,
        resolveEcommerceFrameworkSummary(promptNodes, frameworkNode.id, frameworkRuntime[frameworkNode.id]),
      ] as const),
  );

  // 简体中文：收集所有已有对应生成图片的 parentPromptId 集合，用于防止将已生成图片的节点误判为失败节点
  const parentPromptIdsWithImages = new Set<string>();
  imageNodes.forEach((img) => {
    if (img.parentPromptId) {
      parentPromptIdsWithImages.add(img.parentPromptId);
    }
  });

  // 简体中文：提取所有当前正在生成中，或者已失败且尚无成功图片的 PromptNode 并在移动端作为占位卡片呈现
  const activePromptNodes = promptNodes.filter((node) => {
    const isGenerating = Boolean(node.isGenerating) && !parentPromptIdsWithImages.has(node.id);
    const isFailed = Boolean(node.error) && !parentPromptIdsWithImages.has(node.id);

    if (!isGenerating && !isFailed) {
      return false;
    }

    // 排除普通的未启动的草稿节点
    if (node.isDraft && !isGenerating) {
      return false;
    }

    // 排除画布辅助节点
    if (node.hiddenInCanvas) {
      return false;
    }

    return true;
  });

  const promptEntries = activePromptNodes.map((node) => {
    const promptSummary = resolvePromptSummary(node, { id: node.id } as any);
    const mobileLayout: MobileResultLayout = {
      aspectRatio: parseAspectRatioValue(node.aspectRatio) || 1,
      aspectCategory: 'square',
      emphasis: 'compact',
    };

    return {
      id: node.id,
      imageId: node.id,
      displaySrc: null,
      displayLabel: node.ecommerce?.displayLabel,
      hasOriginal: false,
      timestamp: node.timestamp || Date.now(),
      parentPromptId: node.id,
      prompt: node.prompt,
      promptSummary,
      fullPrompt: node.originalPrompt || node.prompt || promptSummary,
      referenceImages: node.referenceImages || [],
      modelId: node.model,
      modelLabel: node.modelLabel || node.id,
      aspectRatio: node.aspectRatio || 'AUTO',
      imageSize: node.imageSize || '1K',
      actions: {
        preview: false,
        useAsSource: false,
        partialRedraw: false,
        download: false,
        delete: true,
      },
      primaryImageSource: null,
      ecommerceContinuation: resolveEcommerceContinuation({ id: node.id } as any, node, frameworkSummaryById),
      mobileLayout,
      detailEntryId: node.id,
      detailEntry: {
        imageId: node.id,
        promptId: node.id,
      },
      tags: node.tags || [],
      isGenerating: node.isGenerating,
      error: node.error === '::INTERRUPTED::' ? '生成被中断' : node.error,
    } satisfies MobileResultEntry;
  });

  const rawEntries = [
    ...imageNodes.map((imageNode) => {
      const parentPromptId = normalizeOptionalId(imageNode.parentPromptId);
      const promptNode = parentPromptId ? promptNodeById.get(parentPromptId) : undefined;
      const promptSummary = resolvePromptSummary(promptNode, imageNode);
      const displaySrc = resolveDisplaySource(imageNode);
      const mobileLayout = resolveMobileResultLayout(imageNode);
      const detailEntry = {
        imageId: imageNode.id,
        promptId: parentPromptId,
      };

      return {
        id: imageNode.id,
        imageId: imageNode.id,
        displaySrc,
        displayLabel: resolveDisplayLabel(imageNode, promptNode),
        hasOriginal: Boolean(imageNode.originalUrl || imageNode.apiResultUrl),
        timestamp: resolveTimestamp(imageNode, promptNode),
        parentPromptId,
        prompt: imageNode.prompt || promptNode?.prompt || promptSummary,
        promptSummary,
        fullPrompt: normalizeText(promptNode?.originalPrompt || promptNode?.prompt || promptSummary) || promptSummary,
        referenceImages: promptNode?.referenceImages || [],
        modelId: imageNode.model,
        modelLabel: resolveModelLabel(imageNode),
        aspectRatio: imageNode.aspectRatio || 'AUTO',
        imageSize: imageNode.imageSize || '1K',
        actions: { ...DEFAULT_RESULT_ACTIONS },
        primaryImageSource: displaySrc,
        ecommerceContinuation: resolveEcommerceContinuation(imageNode, promptNode, frameworkSummaryById),
        mobileLayout,
        detailEntryId: imageNode.id,
        detailEntry,
        tags: imageNode.tags || promptNode?.tags || [],
        isGenerating: imageNode.isGenerating,
        error: imageNode.error,
      } satisfies MobileResultEntry;
    }),
    ...promptEntries,
  ];

  const groupsMap = new Map<string, MobileResultEntry[]>();
  rawEntries.forEach((entry) => {
    const key = entry.parentPromptId || `standalone-${entry.id}`;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, []);
    }
    groupsMap.get(key)!.push(entry);
  });

  const aggregatedEntries: MobileResultEntry[] = [];
  groupsMap.forEach((groupItems) => {
    // 简体中文：将组内条目按照时间戳降序排列，使得最新的那张作为代表图展示
    groupItems.sort((a, b) => b.timestamp - a.timestamp);
    const representative = { ...groupItems[0] };
    representative.groupCount = groupItems.length;
    representative.groupEntries = groupItems;
    aggregatedEntries.push(representative);
  });

  return aggregatedEntries.sort(compareMobileFeedResults);
}
