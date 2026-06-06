import { useCallback, useEffect, type RefObject } from 'react';

import type { BuildEcommerceGroupExportManifestInput } from '../services/ecommerce/groupExportManifest.ts';
import { applyEcommerceSlotResult, type EcommerceGroupSlotState } from '../services/ecommerce/groupSlotState.ts';
import { type EcommerceGroupSheet, type GeneratedImage, type PromptNode } from '../types/index.ts';
import { createZipArchive, saveBlobAs } from '../utils/archiveRuntime.ts';

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

async function normalizeImageToAPUSMobile(blob: Blob, isMobile: boolean): Promise<Blob> {
  if (!isMobile) {
    return blob;
  }
  return new Promise<Blob>((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const width = img.width;
      const height = img.height;

      // 无论比例偏差如何，只要是手机端大图导出，都必须强制归一化到 600x450 的等比例整数倍率像素上
      // 使用 Math.round 来精准保留用户选择的 1K(k=2, 1200x900) 或 2K(k=4, 2400x1800) 级别分辨率
      const k = Math.max(1, Math.round(Math.min(width / 600, height / 450)));
      const targetWidth = 600 * k;
      const targetHeight = 450 * k;

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(blob);
        return;
      }

      const sourceAspectRatio = width / height;
      const targetAspectRatio = 4 / 3;
      let srcX = 0;
      let srcY = 0;
      let srcWidth = width;
      let srcHeight = height;

      if (sourceAspectRatio > targetAspectRatio) {
        // 源图宽度偏宽，居中裁切左右
        srcWidth = height * targetAspectRatio;
        srcX = (width - srcWidth) / 2;
      } else {
        // 源图高度偏高，居中裁切上下
        srcHeight = width / targetAspectRatio;
        srcY = (height - srcHeight) / 2;
      }

      ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, targetWidth, targetHeight);
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            resolve(blob);
          }
        },
        blob.type || 'image/png',
        0.95
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    img.src = url;
  });
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
      if (promptNode.redraw?.inheritedTaskState?.taskId === taskId || promptNode.partialRedraw?.inheritedTaskState?.taskId === taskId) {
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
    const exportables: Array<{ fileName: string; image: GeneratedImage; isMobile: boolean }> = [];

    const manifestInput: BuildEcommerceGroupExportManifestInput = {
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

        const effectiveSizeTier = promptNode.ecommerce.effectiveSizeTier || promptNode.ecommerce.editableTask?.effectiveSizeTier || promptNode.ecommerce.editableTask?.sizeTier;
        const isMobileSize = effectiveSizeTier === '600x450';

        if ((promptNode.ecommerce.effectiveSizePolicy || promptNode.ecommerce.sizePolicy) === 'desktop-then-mobile') {
          const deliverables = (['desktop', 'mobile'] as const).map((deliveryKind) => {
            const latestForDelivery = resolveLatestEcommerceSlotImage(promptNode, deliveryKind);
            if (!latestForDelivery) {
              return { deliveryKind };
            }

            const extension = resolveEcommerceImageExtension(latestForDelivery.image);
            const fileName = `${String(index + 1).padStart(2, '0')}-${sanitizeEcommerceExportName(slotLabel, `slot-${index + 1}`)}-${deliveryKind}.${extension}`;
            exportables.push({
              fileName,
              image: latestForDelivery.image,
              isMobile: deliveryKind === 'mobile',
            });

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
        exportables.push({
          fileName,
          image: latest.image,
          isMobile: isMobileSize,
        });

        return {
          slotId,
          slotLabel,
          selectedForGeneration: true,
          latestImageId: latest.image.id,
          latestSource: latest.latestSource,
          fileName,
        };
      }),
    };

    if (exportables.length === 0) {
      void import('../services/system/notificationService').then(({ notify }) => {
        notify.warning('无可导出图片', `${packageLabel}当前没有已生成的图片可打包。`);
      });
      return;
    }

    const [{ buildEcommerceGroupExportManifest }, zip] = await Promise.all([
      import('../services/ecommerce/groupExportManifest.ts'),
      createZipArchive(),
    ]);
    const manifest = buildEcommerceGroupExportManifest(manifestInput);

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    const fallbackQualityFiles: string[] = [];
    for (const exportItem of exportables) {
      let { blob, isOriginal } = await resolvePptImageBlob(exportItem.image);
      if (!isOriginal) fallbackQualityFiles.push(exportItem.fileName);

      try {
        blob = await normalizeImageToAPUSMobile(blob, exportItem.isMobile);
      } catch (err) {
        console.warn('[ecommerce] Crop pixel normalize failed', err);
      }

      zip.file(exportItem.fileName, blob);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    await saveBlobAs(content, `${sanitizeEcommerceExportName(packageLabel, packageLabel)}-${Date.now()}.zip`);
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
