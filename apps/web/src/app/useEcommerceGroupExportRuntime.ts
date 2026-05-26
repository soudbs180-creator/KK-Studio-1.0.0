import { useCallback, useEffect, type RefObject } from 'react';
import JSZip from 'jszip';

import { buildEcommerceGroupExportManifest } from '../services/ecommerce/groupExportManifest.ts';
import { applyEcommerceSlotResult, type EcommerceGroupSlotState } from '../services/ecommerce/groupSlotState.ts';
import { type EcommerceGroupSheet, type GeneratedImage, type PromptNode } from '../types';

export interface EcommerceLatestSlotImage {
  image: GeneratedImage;
  latestSource: 'generated' | 'redraw';
}

export interface EcommerceGroupExportCanvasSnapshot {
  promptNodes: PromptNode[];
  imageNodes: GeneratedImage[];
}

export interface EcommerceGroupExportState {
  analysisConfirmed: boolean;
  selectedItems: Record<string, boolean>;
  groupSlots: Record<EcommerceGroupSheet, EcommerceGroupSlotState[]>;
}

export type SetEcommerceGroupExportState = (
  updater: (previousState: EcommerceGroupExportState) => Partial<EcommerceGroupExportState> | null
) => void;

export type ResolvePptImageBlobForEcommerce = (
  image: GeneratedImage
) => Promise<{ blob: Blob; isOriginal: boolean }>;

type SaveEcommerceBlob = (data: Blob | string, filename?: string) => void;
type FileSaverRuntimeModule = SaveEcommerceBlob | {
  default?: SaveEcommerceBlob;
  saveAs?: SaveEcommerceBlob;
};

export interface UseEcommerceGroupExportRuntimeDeps {
  activeCanvas?: EcommerceGroupExportCanvasSnapshot | null;
  activeCanvasRef: RefObject<EcommerceGroupExportCanvasSnapshot | null | undefined>;
  ecommerceState: EcommerceGroupExportState;
  setEcommerceGroupExportState: SetEcommerceGroupExportState;
  resolvePptImageBlob: ResolvePptImageBlobForEcommerce;
}

export interface UseEcommerceGroupExportRuntimeResult {
  resolveLatestEcommerceSlotImage: (node: PromptNode, deliveryKind?: 'default' | 'desktop' | 'mobile') => EcommerceLatestSlotImage | null;
  handleExportEcommerceGroup: (groupNode: PromptNode) => Promise<void>;
}

export function sanitizeEcommerceExportName(value: string, fallback: string): string {
  const normalized = String(value || '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .trim();
  return normalized || fallback;
}

function resolveEcommerceImageExtension(image: GeneratedImage): 'jpg' | 'png' | 'webp' {
  return image.mimeType?.includes('jpeg') || image.mimeType?.includes('jpg')
    ? 'jpg'
    : image.mimeType?.includes('webp')
      ? 'webp'
      : 'png';
}

async function saveEcommerceBlob(content: Blob, fileName: string): Promise<void> {
  const fileSaverModule = await import('file-saver') as unknown as FileSaverRuntimeModule;
  const saveBlob = typeof fileSaverModule === 'function'
    ? fileSaverModule
    : fileSaverModule.saveAs ?? fileSaverModule.default;

  if (!saveBlob) {
    throw new Error('File saver runtime is unavailable.');
  }

  saveBlob(content, fileName);
}

export function resolveLatestEcommerceSlotImageFromCanvas(
  canvas: EcommerceGroupExportCanvasSnapshot | null | undefined,
  node: PromptNode,
  deliveryKind?: 'default' | 'desktop' | 'mobile',
): EcommerceLatestSlotImage | null {
  const taskId = node.ecommerce?.editableTask?.taskId;
  if (!canvas || !node.ecommerce) {
    return null;
  }

  const candidatePromptIds = new Set<string>([node.id]);
  if (taskId) {
    canvas.promptNodes.forEach((promptNode) => {
      if (promptNode.partialRedraw?.inheritedTaskState?.taskId === taskId) {
        candidatePromptIds.add(promptNode.id);
      }
    });
  }

  const latestImage = canvas.imageNodes
    .filter((imageNode) => {
      if (!imageNode.parentPromptId || !candidatePromptIds.has(imageNode.parentPromptId)) {
        return false;
      }

      if (!deliveryKind) {
        return true;
      }

      if (deliveryKind === 'default') {
        return !imageNode.ecommerceDeliveryKind || imageNode.ecommerceDeliveryKind === 'default';
      }

      return imageNode.ecommerceDeliveryKind === deliveryKind;
    })
    .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))[0];

  if (!latestImage) {
    return null;
  }

  return {
    image: latestImage,
    latestSource: latestImage.parentPromptId === node.id ? 'generated' : 'redraw',
  };
}

export function buildNextEcommerceGroupSlots(input: {
  promptNodes: PromptNode[];
  previousGroupSlots: Record<EcommerceGroupSheet, EcommerceGroupSlotState[]>;
  selectedItems: Record<string, boolean>;
  resolveLatestSlotImage: (
    node: PromptNode,
    deliveryKind?: 'default' | 'desktop' | 'mobile'
  ) => EcommerceLatestSlotImage | null;
}): Record<EcommerceGroupSheet, EcommerceGroupSlotState[]> {
  const selectedItems = input.selectedItems || {};
  const previousGroupSlots = input.previousGroupSlots || {};
  const nextGroupSlots: Record<EcommerceGroupSheet, EcommerceGroupSlotState[]> = {
    '主图': (previousGroupSlots['主图'] || []).map((slot) => ({
      ...slot,
      selected: selectedItems[slot.sourceKey] !== false,
    })),
    'A+': (previousGroupSlots['A+'] || []).map((slot) => ({
      ...slot,
      selected: selectedItems[slot.sourceKey] !== false,
    })),
  };

  (input.promptNodes || []).forEach((promptNode) => {
    if (!promptNode.ecommerce || promptNode.ecommerce.kind === 'a-plus-group') {
      return;
    }

    const sheet = promptNode.ecommerce.sourceSheet;
    const sheetSlots = nextGroupSlots[sheet] || [];
    const slot = sheetSlots.find((entry) => entry.sourceKey === promptNode.ecommerce?.sourceRowKey);
    if (!slot) {
      return;
    }

    const latest = input.resolveLatestSlotImage(promptNode);
    if (!latest) {
      return;
    }

    nextGroupSlots[sheet] = applyEcommerceSlotResult(nextGroupSlots[sheet], {
      slotId: slot.slotId,
      imageId: latest.image.id,
      source: latest.latestSource,
    });

    (slot.deliveries || []).forEach((delivery) => {
      const latestForDelivery = input.resolveLatestSlotImage(promptNode, delivery.deliveryKind);
      if (!latestForDelivery) {
        return;
      }

      nextGroupSlots[sheet] = applyEcommerceSlotResult(nextGroupSlots[sheet], {
        slotId: slot.slotId,
        deliveryKind: delivery.deliveryKind,
        imageId: latestForDelivery.image.id,
        source: latestForDelivery.latestSource,
      });
    });
  });

  return nextGroupSlots;
}

export function useEcommerceGroupExportRuntime({
  activeCanvas,
  activeCanvasRef,
  ecommerceState,
  setEcommerceGroupExportState,
  resolvePptImageBlob,
}: UseEcommerceGroupExportRuntimeDeps): UseEcommerceGroupExportRuntimeResult {
  const resolveLatestEcommerceSlotImage = useCallback((node: PromptNode, deliveryKind?: 'default' | 'desktop' | 'mobile') => (
    resolveLatestEcommerceSlotImageFromCanvas(activeCanvasRef.current, node, deliveryKind)
  ), [activeCanvasRef]);

  useEffect(() => {
    if (!ecommerceState.analysisConfirmed) {
      return;
    }

    setEcommerceGroupExportState((previousState) => {
      const nextGroupSlots = buildNextEcommerceGroupSlots({
        promptNodes: activeCanvas?.promptNodes || [],
        previousGroupSlots: previousState.groupSlots,
        selectedItems: previousState.selectedItems,
        resolveLatestSlotImage: resolveLatestEcommerceSlotImage,
      });

      const previousSignature = JSON.stringify(previousState.groupSlots);
      const nextSignature = JSON.stringify(nextGroupSlots);
      if (previousSignature === nextSignature) {
        return null;
      }

      return {
        groupSlots: nextGroupSlots,
      };
    });
  }, [
    activeCanvas,
    ecommerceState.analysisConfirmed,
    ecommerceState.selectedItems,
    resolveLatestEcommerceSlotImage,
    setEcommerceGroupExportState,
  ]);

  const handleExportEcommerceGroup = useCallback(async (groupNode: PromptNode) => {
    if (!groupNode.ecommerce || groupNode.ecommerce.kind !== 'a-plus-group') {
      return;
    }

    const canvas = activeCanvasRef.current;
    if (!canvas) {
      return;
    }

    const moduleNodes = canvas.promptNodes.filter((promptNode) => (
      !!promptNode.ecommerce
      && promptNode.ecommerce.kind !== 'a-plus-group'
      && promptNode.ecommerce.groupId === groupNode.id
    ));
    const slotStateBySourceKey = new Map(
      (ecommerceState.groupSlots[groupNode.ecommerce.sourceSheet] || []).map((slot) => [slot.sourceKey, slot] as const),
    );

    const packageType = groupNode.ecommerce.sourceSheet === '主图' ? 'main-image-group' : 'a-plus-group';
    const packageLabel = groupNode.ecommerce.sourceSheet === '主图' ? '主图包' : 'A+包';
    const zip = new JSZip();
    const exportables: Array<{ fileName: string; image: GeneratedImage }> = [];

    const manifest = buildEcommerceGroupExportManifest({
      packageType,
      groupId: groupNode.id,
      groupLabel: groupNode.ecommerce.sourceSheet,
      sourcePromptId: groupNode.id,
      slots: moduleNodes.map((promptNode, index) => {
        const latest = resolveLatestEcommerceSlotImage(promptNode);
        const slotLabel = promptNode.ecommerce?.displayLabel || promptNode.ecommerce?.sourceRowKey || `${groupNode.ecommerce?.sourceSheet} 模块`;
        const slotState = promptNode.ecommerce
          ? slotStateBySourceKey.get(promptNode.ecommerce.sourceRowKey)
          : undefined;
        const slotId = slotState?.slotId || `${groupNode.id}-slot-${index + 1}`;
        const isSelected = slotState?.selected ?? (promptNode.ecommerce?.selectedForGeneration !== false);
        if (!promptNode.ecommerce || !isSelected) {
          return {
            slotId,
            slotLabel,
            selectedForGeneration: false,
          };
        }

        if ((promptNode.ecommerce.effectiveSizePolicy || promptNode.ecommerce.sizePolicy) === 'desktop-then-mobile') {
          const deliverables = (['desktop', 'mobile'] as const).map((deliveryKind) => {
            const latestForDelivery = resolveLatestEcommerceSlotImage(promptNode, deliveryKind);
            if (!latestForDelivery) {
              return { deliveryKind };
            }

            const extension = resolveEcommerceImageExtension(latestForDelivery.image);
            const fileName = `${String(index + 1).padStart(2, '0')}-${sanitizeEcommerceExportName(slotLabel, `slot-${index + 1}`)}-${deliveryKind}.${extension}`;
            exportables.push({ fileName, image: latestForDelivery.image });

            return {
              deliveryKind,
              latestImageId: latestForDelivery.image.id,
              latestSource: latestForDelivery.latestSource,
              fileName,
            };
          });

          if (!deliverables.some((deliverable) => 'latestImageId' in deliverable)) {
            return {
              slotId,
              slotLabel,
              selectedForGeneration: true,
            };
          }

          return {
            slotId,
            slotLabel,
            selectedForGeneration: true,
            deliverables,
          };
        }

        if (!latest) {
          return {
            slotId,
            slotLabel,
            selectedForGeneration: true,
          };
        }

        const extension = resolveEcommerceImageExtension(latest.image);
        const fileName = `${String(index + 1).padStart(2, '0')}-${sanitizeEcommerceExportName(slotLabel, `slot-${index + 1}`)}.${extension}`;
        exportables.push({ fileName, image: latest.image });

        return {
          slotId,
          slotLabel,
          selectedForGeneration: true,
          latestImageId: latest.image.id,
          latestSource: latest.latestSource,
          fileName,
        };
      }),
    });

    if (exportables.length === 0) {
      void import('../services/system/notificationService').then(({ notify }) => {
        notify.warning('无可导出图片', `${packageLabel}当前没有已生成的图片可打包。`);
      });
      return;
    }

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    const fallbackQualityFiles: string[] = [];
    for (const exportItem of exportables) {
      const { blob, isOriginal } = await resolvePptImageBlob(exportItem.image);
      if (!isOriginal) fallbackQualityFiles.push(exportItem.fileName);
      zip.file(exportItem.fileName, blob);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    await saveEcommerceBlob(content, `${sanitizeEcommerceExportName(packageLabel, packageLabel)}-${Date.now()}.zip`);
    void import('../services/system/notificationService').then(({ notify }) => {
      if (fallbackQualityFiles.length > 0) {
        notify.warning('部分图片非原始质量', `${fallbackQualityFiles.length} 张图片使用了回退源：${fallbackQualityFiles.slice(0, 3).join('、')}${fallbackQualityFiles.length > 3 ? '…' : ''}`);
      }
      notify.success('导出完成', `${packageLabel}已导出，共 ${exportables.length} 张图片。`);
    });
  }, [activeCanvasRef, ecommerceState.groupSlots, resolveLatestEcommerceSlotImage, resolvePptImageBlob]);

  return {
    resolveLatestEcommerceSlotImage,
    handleExportEcommerceGroup,
  };
}
