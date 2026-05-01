import { useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

import { GenerationMode, type GeneratedImage, type PromptNode, type PptEditableImageLayer, type PptEditablePage } from '../types';
import { buildPptxSlideRelationshipsXml, buildPptxSlideXml } from './buildPptxSlideDocuments';
import { buildPptSlidesPreviewHtml } from './buildPptSlidesPreviewHtml';
import {
  isPptDeckChildImageNodeFromCanvas,
  resolveCurrentPromptChildImagesForPptRuntime,
  resolveOrderedPptNodeBundleForCanvas,
  resolveOrderedPptPreviewBundleForCanvas,
  type PptRuntimeCanvasSnapshot,
} from './pptRuntimeHelpers';
import { base64ToBlob } from '../utils/downloadUtils';
import { pickByDocumentLanguage } from '../utils/localeText';
import {
  buildPptEditablePages,
  getPptTextLayer,
  patchPptTextLayer,
  sortPptLayers,
  syncPptSlidesFromEditablePages,
  PPT_EDITABLE_CANVAS,
} from '../utils/pptEditable';
import { writePptxPackageSkeleton } from './writePptxPackageSkeleton';

export interface PptOutlineLineParts {
  title: string;
  subtitle: string;
}

type UpdatePromptNode = (promptNode: PromptNode) => void | Promise<unknown>;
type UpdateImageNode = (id: string, updates: Partial<GeneratedImage>) => void | Promise<unknown>;

export interface OrderedPptPreviewBundle {
  promptNode: PromptNode;
  images: GeneratedImage[];
  currentIndex: number;
}

export interface OrderedPptNodeBundle {
  promptNode: PromptNode;
  images: GeneratedImage[];
}

export interface PptEditableExportBundle {
  promptNode: PromptNode;
  images: GeneratedImage[];
  pages: PptEditablePage[];
  imageById: Map<string, GeneratedImage>;
}

export interface PptDeckEditorState {
  nodeId: string;
  initialIndex: number;
}

export interface PptStackPreviewState {
  images: GeneratedImage[];
  initialIndex: number;
}

interface PptPackagePageMeta {
  page: number;
  title: string;
  outlineTitle: string;
  outlineSubtitle: string;
  prompt: GeneratedImage['prompt'];
  model: GeneratedImage['model'];
  provider: string | undefined;
  keySlotId: GeneratedImage['keySlotId'];
  dimensions: GeneratedImage['dimensions'];
  imageSize: GeneratedImage['imageSize'];
  timestamp: GeneratedImage['timestamp'];
  file: string;
}

function resolvePptEditablePageImageId(page: PptEditablePage): string | undefined {
  return page.backgroundImageId
    || page.layers.find((layer): layer is PptEditableImageLayer => layer.type === 'image')?.imageNodeId;
}

export interface UsePptRuntimeDeps {
  activeCanvasRef: RefObject<PptRuntimeCanvasSnapshot | undefined>;
  pickByDocumentLanguage: typeof pickByDocumentLanguage;
  setPptDeckEditor: Dispatch<SetStateAction<PptDeckEditorState | null>>;
  setPptStackPreview: Dispatch<SetStateAction<PptStackPreviewState | null>>;
  setPreviewImages: Dispatch<SetStateAction<GeneratedImage[] | null>>;
  setPreviewInitialIndex: Dispatch<SetStateAction<number>>;
  updatePromptNode: UpdatePromptNode;
  updateImageNode: UpdateImageNode;
}

export interface UsePptRuntimeResult {
  showNoPptPagesWarning: () => void;
  parsePptOutlineLine: (raw?: string) => PptOutlineLineParts;
  buildPptPageAlias: (raw: string | undefined, pageIndex: number) => string;
  getOrderedPptPreviewBundle: (imageId: string) => OrderedPptPreviewBundle | null;
  tryOpenPptPreview: (imageId: string) => boolean;
  getOrderedPptNodeBundle: (nodeOrId: PromptNode | string) => OrderedPptNodeBundle | null;
  getPptEditableExportBundle: (node: PromptNode) => PptEditableExportBundle | null;
  requirePptEditableExportBundle: (node: PromptNode) => PptEditableExportBundle | null;
  sanitizePptFileSegment: (value: string, fallback: string) => string;
  resolvePptImageBlob: (image: GeneratedImage) => Promise<{ blob: Blob; isOriginal: boolean }>;
  resolvePptExportImageAsset: (image: GeneratedImage) => Promise<{ blob: Blob; ext: 'png' | 'jpg'; mime: 'image/png' | 'image/jpeg' }>;
  renderPptEditablePagePreviewBlob: (page: PptEditablePage, imageById: Map<string, GeneratedImage>) => Promise<Blob>;
  handleExportPptPackageEditable: (node: PromptNode) => Promise<void>;
  handleExportPptxEditable: (node: PromptNode) => Promise<void>;
  handleExportPptx: (node: PromptNode) => Promise<void>;
  handleExportPptPackage: (node: PromptNode) => Promise<void>;
  handleDownloadPptComposite: (imageId: string) => Promise<void>;
  handleExportPptSinglePage: (node: PromptNode, pageIndex: number) => Promise<void>;
  handleEditPptTextFromLightbox: (image: GeneratedImage) => void;
  handleSavePptEditablePages: (nodeId: string, pages: PptEditablePage[]) => void;
  handleOpenPptDeckEditor: (nodeOrId: PromptNode | string, initialIndex?: number) => void;
  handleOpenPptDeckEditorFromImage: (image: GeneratedImage) => void;
  handleOpenPptStackPreview: (imageId: string) => void;
  isPptDeckChildImageNode: (imageNode: GeneratedImage) => boolean;
  resolveCurrentPromptChildImages: (promptNode: PromptNode | undefined | null, imageNodes: GeneratedImage[]) => GeneratedImage[];
}

export function usePptRuntime({
  activeCanvasRef,
  pickByDocumentLanguage,
  setPreviewImages,
  setPreviewInitialIndex,
  setPptDeckEditor,
  setPptStackPreview,
  updateImageNode,
  updatePromptNode,
}: UsePptRuntimeDeps): UsePptRuntimeResult {
  const showNoPptPagesWarning = useCallback((): void => {
    import('../services/system/notificationService').then(({ notify }) => {
      notify.warning('无可导出页面', '当前主卡还没有生成副卡页面');
    });
  }, []);

  const parsePptOutlineLine = useCallback((raw?: string): PptOutlineLineParts => {
    const text = String(raw || '').trim();
    if (!text) return { title: '', subtitle: '' };

    const splitBy = (token: string): PptOutlineLineParts | null => {
      const idx = text.indexOf(token);
      if (idx <= 0) return null;
      const title = text.slice(0, idx).trim();
      const subtitle = text.slice(idx + token.length).trim();
      return { title, subtitle };
    };

    const byColon = splitBy('：') || splitBy(':');
    if (byColon) return byColon;

    const byDash = splitBy(' - ') || splitBy(' — ') || splitBy(' – ');
    if (byDash) return byDash;

    return { title: text, subtitle: '' };
  }, []);

  const buildPptPageAlias = useCallback((raw: string | undefined, pageIndex: number): string => {
    const parsed = parsePptOutlineLine(raw);
    const title = parsed.title || parsed.subtitle || String(raw || '').trim();
    return title || `第 ${pageIndex + 1} 页`;
  }, [parsePptOutlineLine]);

  const getOrderedPptPreviewBundle = useCallback((imageId: string): OrderedPptPreviewBundle | null => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return null;
    return resolveOrderedPptPreviewBundleForCanvas(canvas, imageId);
  }, [activeCanvasRef]);

  const getOrderedPptNodeBundle = useCallback((nodeOrId: PromptNode | string): OrderedPptNodeBundle | null => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return null;
    return resolveOrderedPptNodeBundleForCanvas(canvas, nodeOrId);
  }, [activeCanvasRef]);

  const tryOpenPptPreview = useCallback((imageId: string): boolean => {
    const bundle = getOrderedPptPreviewBundle(imageId);
    if (!bundle) return false;

    setPreviewImages(bundle.images);
    setPreviewInitialIndex(bundle.currentIndex);
    return true;
  }, [getOrderedPptPreviewBundle, setPreviewImages, setPreviewInitialIndex]);

  const getPptEditableExportBundle = useCallback((node: PromptNode): PptEditableExportBundle | null => {
    const bundle = getOrderedPptNodeBundle(node);
    if (!bundle) return null;

    const images = bundle.images.slice(0, 20);
    const pages = buildPptEditablePages(bundle.promptNode, images);

    return {
      promptNode: bundle.promptNode,
      images,
      pages,
      imageById: new Map(images.map((image) => [image.id, image] as const)),
    };
  }, [getOrderedPptNodeBundle]);

  const requirePptEditableExportBundle = useCallback((node: PromptNode): PptEditableExportBundle | null => {
    const exportBundle = getPptEditableExportBundle(node);
    if (!exportBundle) {
      showNoPptPagesWarning();
      return null;
    }

    return exportBundle;
  }, [getPptEditableExportBundle, showNoPptPagesWarning]);

  const sanitizePptFileSegment = useCallback((value: string, fallback: string): string => {
    const normalized = String(value || '')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    return normalized || fallback;
  }, []);

  const renderBlobIntoImage = useCallback((blob: Blob) => (
    new Promise<HTMLImageElement>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('图片加载失败'));
      };
      image.src = objectUrl;
    })
  ), []);

  const convertBlobToPng = useCallback(async (blob: Blob) => {
    const image = await renderBlobIntoImage(blob);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('无法创建导出画布');
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png', 1);
    });

    if (!pngBlob) {
      throw new Error('无法转换图片格式');
    }

    return pngBlob;
  }, [renderBlobIntoImage]);

  const resolvePptImageBlob = useCallback(async (image: GeneratedImage): Promise<{ blob: Blob; isOriginal: boolean }> => {
    const { getStrictOriginalImage } = await import('../services/storage/imageStorage');

    let isOriginal = true;
    let source = await getStrictOriginalImage(image.id);
    if (!source && image.storageId && image.storageId !== image.id) {
      source = await getStrictOriginalImage(image.storageId);
    }
    if (!source) {
      source = image.originalUrl || image.url;
      isOriginal = false;
    }
    if (!source) {
      throw new Error('未找到可用的图片源');
    }

    let blob: Blob;
    if (source.startsWith('data:')) {
      blob = base64ToBlob(source);
    } else if (source.startsWith('blob:')) {
      const response = await fetch(source);
      if (!response.ok) throw new Error('无法读取本地图片数据');
      blob = await response.blob();
    } else {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`下载图片失败：HTTP ${response.status}`);
      }
      blob = await response.blob();
    }
    return { blob, isOriginal };
  }, []);

  const resolvePptExportImageAsset = useCallback(async (image: GeneratedImage): Promise<{ blob: Blob; ext: 'png' | 'jpg'; mime: 'image/png' | 'image/jpeg' }> => {
    const { blob } = await resolvePptImageBlob(image);
    const type = String(blob.type || '').toLowerCase();

    if (type.includes('png')) {
      return { blob, ext: 'png', mime: 'image/png' };
    }
    if (type.includes('jpeg') || type.includes('jpg')) {
      return { blob, ext: 'jpg', mime: 'image/jpeg' };
    }

    const pngBlob = await convertBlobToPng(blob);
    return { blob: pngBlob, ext: 'png', mime: 'image/png' };
  }, [convertBlobToPng, resolvePptImageBlob]);

  const renderPptEditablePagePreviewBlob = useCallback(async (
    page: PptEditablePage,
    imageById: Map<string, GeneratedImage>,
  ): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    canvas.width = PPT_EDITABLE_CANVAS.width;
    canvas.height = PPT_EDITABLE_CANVAS.height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('无法创建页面预览画布');
    }

    context.fillStyle = '#020617';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textBaseline = 'top';

    const normalizeColor = (value?: string, fallback = '#FFFFFF') => {
      const raw = String(value || '').trim();
      if (/^#[0-9a-fA-F]{3}$/.test(raw) || /^#[0-9a-fA-F]{6}$/.test(raw)) {
        return raw;
      }
      return fallback;
    };

    for (const layer of sortPptLayers(page.layers)) {
      if (!layer.visible) continue;

      if (layer.type === 'image') {
        const sourceImageId = layer.imageNodeId || page.backgroundImageId;
        const sourceImage = sourceImageId ? imageById.get(sourceImageId) : undefined;
        const sourceBlob = sourceImage ? (await resolvePptImageBlob(sourceImage)).blob : null;
        const imageElement = sourceBlob ? await renderBlobIntoImage(sourceBlob) : null;

        if (!imageElement) continue;

        context.save();
        context.globalAlpha = Math.max(0, Math.min(1, layer.opacity ?? 1));
        context.drawImage(imageElement, layer.x, layer.y, layer.width, layer.height);
        context.restore();
        continue;
      }

      if (!layer.text.trim()) continue;

      const backgroundOpacity = Math.max(0, Math.min(1, (layer.backgroundOpacity ?? 0) * (layer.opacity ?? 1)));
      if (layer.backgroundColor && backgroundOpacity > 0) {
        context.save();
        context.globalAlpha = backgroundOpacity;
        context.fillStyle = normalizeColor(layer.backgroundColor, '#111827');
        context.fillRect(layer.x, layer.y, layer.width, layer.height);
        context.restore();
      }

      const paddingX = 24;
      const paddingY = 18;
      const availableWidth = Math.max(0, layer.width - paddingX * 2);
      const lines = layer.text.split(/\r?\n/);

      context.save();
      context.globalAlpha = Math.max(0, Math.min(1, layer.opacity ?? 1));
      context.fillStyle = normalizeColor(layer.color, '#FFFFFF');
      context.font = `${layer.fontWeight || 500} ${layer.fontSize}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
      context.textAlign = layer.align || 'left';

      const baseX = layer.align === 'center'
        ? layer.x + layer.width / 2
        : layer.align === 'right'
          ? layer.x + layer.width - paddingX
          : layer.x + paddingX;
      const lineHeight = Math.round(layer.fontSize * 1.3);

      lines.forEach((line, lineIndex) => {
        const y = layer.y + paddingY + lineIndex * lineHeight;
        if (y > layer.y + layer.height - lineHeight) return;
        const text = line || ' ';

        if (availableWidth > 0 && context.measureText(text).width > availableWidth && layer.align !== 'center') {
          context.save();
          context.beginPath();
          context.rect(layer.x + paddingX, layer.y + paddingY, availableWidth, layer.height - paddingY * 2);
          context.clip();
          context.fillText(text, baseX, y);
          context.restore();
        } else {
          context.fillText(text, baseX, y);
        }
      });

      context.restore();
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png', 1);
    });

    if (!blob) {
      throw new Error('无法生成页面预览');
    }

    return blob;
  }, [renderBlobIntoImage, resolvePptImageBlob]);

  const handleExportPptPackageEditable = useCallback(async (node: PromptNode): Promise<void> => {
    const exportBundle = requirePptEditableExportBundle(node);
    if (!exportBundle) return;

    const zip = new JSZip();
    const { promptNode, images, pages, imageById } = exportBundle;
    const outlinePages = syncPptSlidesFromEditablePages(pages);
    const pageSummaries: Array<Record<string, unknown>> = [];
    const assetFileByImageId = new Map<string, string>();
    const uniqueImageIds = Array.from(new Set(
      pages.flatMap((page) => page.layers
        .map((layer) => layer.type === 'image' ? (layer.imageNodeId || page.backgroundImageId || null) : null)
        .filter((id): id is string => Boolean(id))),
    ));

    for (let assetIndex = 0; assetIndex < uniqueImageIds.length; assetIndex += 1) {
      const imageId = uniqueImageIds[assetIndex];
      const image = imageById.get(imageId);
      if (!image) continue;

      const asset = await resolvePptExportImageAsset(image);
      const assetSlug = sanitizePptFileSegment(
        image.alias || `slide-${assetIndex + 1}`,
        `slide-${assetIndex + 1}`,
      );
      const assetFile = `editable/assets/${String(assetIndex + 1).padStart(2, '0')}-${assetSlug}.${asset.ext}`;
      zip.file(assetFile, asset.blob);
      assetFileByImageId.set(imageId, assetFile);
    }

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const page = pages[pageIndex];
      const pageNo = pageIndex + 1;
      const pageTitle = getPptTextLayer(page, 'title')?.text.trim() || page.name || `Slide ${pageNo}`;
      const pageSlug = sanitizePptFileSegment(pageTitle, `slide-${pageNo}`);
      const previewFile = `pages/${String(pageNo).padStart(2, '0')}-${pageSlug}.png`;
      const backgroundImageId = page.backgroundImageId
        || page.layers.find((layer): layer is PptEditableImageLayer => layer.type === 'image')?.imageNodeId;
      zip.file(previewFile, await renderPptEditablePagePreviewBlob(page, imageById));

      const slideFile = `editable/slides/slide-${String(pageNo).padStart(2, '0')}.json`;
      const subtitle = getPptTextLayer(page, 'subtitle')?.text.trim() || '';
      const layerPayload = page.layers.map((layer) => {
        if (layer.type === 'image') {
          const layerImageId = layer.imageNodeId || page.backgroundImageId;
          return {
            ...layer,
            sourceUrl: undefined,
            assetFile: layerImageId ? assetFileByImageId.get(layerImageId) : undefined,
          };
        }

        return layer;
      });

      zip.file(slideFile, JSON.stringify({
        id: page.id,
        page: pageNo,
        name: page.name,
        outline: outlinePages[pageIndex] || page.outline,
        notes: page.notes || '',
        backgroundImageId: backgroundImageId || null,
        previewFile,
        layers: layerPayload,
      }, null, 2));

      pageSummaries.push({
        page: pageNo,
        id: page.id,
        title: pageTitle,
        subtitle,
        outline: outlinePages[pageIndex] || page.outline,
        prompt: images[pageIndex]?.prompt || promptNode.prompt,
        model: images[pageIndex]?.model || promptNode.model,
        provider: images[pageIndex]?.providerLabel || images[pageIndex]?.provider || promptNode.providerLabel || promptNode.provider,
        keySlotId: images[pageIndex]?.keySlotId || promptNode.keySlotId,
        dimensions: images[pageIndex]?.dimensions,
        imageSize: images[pageIndex]?.imageSize || promptNode.imageSize,
        timestamp: images[pageIndex]?.timestamp || promptNode.timestamp,
        previewFile,
        editableFile: slideFile,
        backgroundAsset: backgroundImageId ? assetFileByImageId.get(backgroundImageId) : undefined,
        layerCount: page.layers.length,
        visibleLayerCount: page.layers.filter((layer) => layer.visible).length,
      });
    }

    zip.file('editable/deck.json', JSON.stringify({
      exportedAt: new Date().toISOString(),
      format: 'kk-studio-ppt-editable/v1',
      canvas: PPT_EDITABLE_CANVAS,
      node: {
        id: promptNode.id,
        prompt: promptNode.prompt,
        mode: promptNode.mode,
        model: promptNode.model,
        modelLabel: promptNode.modelLabel,
        provider: promptNode.provider,
        providerLabel: promptNode.providerLabel,
        keySlotId: promptNode.keySlotId,
        aspectRatio: promptNode.aspectRatio,
        imageSize: promptNode.imageSize,
        styleLocked: promptNode.pptStyleLocked !== false,
      },
      pages: pages.map((page, index) => ({
        id: page.id,
        page: index + 1,
        name: page.name,
        outline: outlinePages[index] || page.outline,
        previewFile: `pages/${String(index + 1).padStart(2, '0')}-${sanitizePptFileSegment(
          getPptTextLayer(page, 'title')?.text.trim() || page.name || `slide-${index + 1}`,
          `slide-${index + 1}`,
        )}.png`,
        editableFile: `editable/slides/slide-${String(index + 1).padStart(2, '0')}.json`,
      })),
      assets: Object.fromEntries(assetFileByImageId.entries()),
      notes: [
        pickByDocumentLanguage(
          '这个包会保留分层 PPT 场景数据，便于继续在线编辑或导出 PPTX。',
          'This package preserves layered PPT scene data for online editing and PPTX export.'
        ),
        pickByDocumentLanguage(
          'PSD 无法从扁平化 AI 图片自动还原，若要导出 PSD，需要基于这些图层重新构建。',
          'PSD export is not reconstructed automatically from a flat AI image; it must be rebuilt from these layers.'
        ),
      ],
    }, null, 2));

    zip.file('meta/manifest.json', JSON.stringify({
      exportedAt: new Date().toISOString(),
      nodeId: promptNode.id,
      nodePrompt: promptNode.prompt,
      pageCount: pages.length,
      pages: pageSummaries,
    }, null, 2));

    zip.file('outline/ppt-outline.json', JSON.stringify({
      topic: promptNode.prompt,
      pageCount: pages.length,
      styleLocked: promptNode.pptStyleLocked !== false,
      pages: outlinePages.map((text, index) => ({
        page: index + 1,
        text,
      })),
    }, null, 2));

    zip.file('meta/node-meta.json', JSON.stringify({
      nodeId: promptNode.id,
      model: promptNode.model,
      modelLabel: promptNode.modelLabel,
      provider: promptNode.provider,
      providerLabel: promptNode.providerLabel,
      keySlotId: promptNode.keySlotId,
      aspectRatio: promptNode.aspectRatio,
      imageSize: promptNode.imageSize,
      parallelCount: promptNode.parallelCount,
      styleLocked: promptNode.pptStyleLocked !== false,
      referenceStorageIds: (promptNode.referenceImages || []).map((ref) => ref.storageId || ref.id).filter(Boolean),
    }, null, 2));

    zip.file('editable/README.md', [
      pickByDocumentLanguage('# 可编辑 PPT 页面包', '# Editable PPT Package'),
      '',
      pickByDocumentLanguage('- `editable/deck.json`：KK Studio 使用的分层页面包清单。', '- `editable/deck.json`: layered deck manifest used by KK Studio.'),
      pickByDocumentLanguage('- `editable/slides/*.json`：每一页的可编辑图层数据。', '- `editable/slides/*.json`: per-slide editable layer data.'),
      pickByDocumentLanguage('- `editable/assets/*`：页面 JSON 引用到的图像图层素材。', '- `editable/assets/*`: image layer assets referenced by the slide JSON.'),
      pickByDocumentLanguage('- `pages/*`：用于快速查看的预览 PNG。', '- `pages/*`: preview PNGs for quick inspection.'),
      '',
      pickByDocumentLanguage(
        '当你希望保留可编辑文字和图层顺序，并继续导出 PPTX 或后续重建 PSD 时，请使用这个包。',
        'Use this package when you want to keep editable text and layer ordering, then export to PPTX now or rebuild PSD later.'
      ),
    ].join('\n'));

    const slidesHtml = buildPptSlidesPreviewHtml({
      title: promptNode.prompt || 'PPT 导出预览',
      items: pageSummaries.map((page) => ({
        page: String(page.page || ''),
        title: String(page.title || ''),
        imageSrc: `../${String(page.previewFile || '')}`,
        description: String(page.outline || ''),
      })),
    });
    zip.file('outline/slides-preview.html', slidesHtml);

    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `ppt-editable-package-${Date.now()}.zip`);

    import('../services/system/notificationService').then(({ notify }) => {
      notify.success('导出完成', `已导出 ${pages.length} 页，以及 editable 图层包、预览页和素材目录`);
    });
  }, [
    pickByDocumentLanguage,
    renderPptEditablePagePreviewBlob,
    requirePptEditableExportBundle,
    resolvePptExportImageAsset,
    sanitizePptFileSegment,
  ]);

  const handleExportPptxEditable = useCallback(async (node: PromptNode): Promise<void> => {
    const exportBundle = requirePptEditableExportBundle(node);
    if (!exportBundle) return;

    const { promptNode, pages, imageById } = exportBundle;
    const slideWidth = 12192000;
    const slideHeight = 6858000;
    const emuPerPx = Math.round(slideWidth / PPT_EDITABLE_CANVAS.width);
    const escapeXml = (value: string) => String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    const normalizeColor = (value?: string, fallback = 'FFFFFF') => {
      const raw = String(value || '').trim().replace(/^#/, '');
      if (/^[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
      if (/^[0-9a-fA-F]{3}$/.test(raw)) {
        return raw.split('').map((part) => `${part}${part}`).join('').toUpperCase();
      }
      return fallback;
    };
    const toAlphaValue = (opacity: number) => Math.max(0, Math.min(100000, Math.round(opacity * 100000)));
    const toEmu = (value: number) => Math.max(0, Math.round(value * emuPerPx));
    const alignMap = {
      left: 'l',
      center: 'ctr',
      right: 'r',
    } as const;
    const makeColorXml = (value: string | undefined, fallback: string, opacity = 1) => (
      `<a:srgbClr val="${normalizeColor(value, fallback)}">${opacity < 1 ? `<a:alpha val="${toAlphaValue(opacity)}"/>` : ''}</a:srgbClr>`
    );

    const zip = new JSZip();
    const visibleImageIds = Array.from(new Set(
      pages.flatMap((page) => page.layers.reduce<string[]>((ids, layer) => {
        if (!layer.visible || layer.type !== 'image') {
          return ids;
        }

        const imageId = layer.imageNodeId || page.backgroundImageId;
        if (imageId) {
          ids.push(imageId);
        }

        return ids;
      }, [])),
    ));
    const mediaByImageId = new Map<string, { fileName: string; ext: 'png' | 'jpg' }>();

    for (let mediaIndex = 0; mediaIndex < visibleImageIds.length; mediaIndex += 1) {
      const imageId = visibleImageIds[mediaIndex];
      const image = imageById.get(imageId);
      if (!image) continue;

      const asset = await resolvePptExportImageAsset(image);
      const fileName = `image${mediaIndex + 1}.${asset.ext}`;
      zip.file(`ppt/media/${fileName}`, asset.blob);
      mediaByImageId.set(imageId, { fileName, ext: asset.ext });
    }

    writePptxPackageSkeleton({
      zip,
      slideCount: pages.length,
      title: promptNode.prompt || 'KK Studio PPT',
      slideWidth,
      slideHeight,
    });

    for (let slideIndex = 0; slideIndex < pages.length; slideIndex += 1) {
      const page = pages[slideIndex];
      const visibleLayers = sortPptLayers(page.layers).filter((layer) => layer.visible);
      const slideLayerXml: string[] = [];
      const slideRelationships: string[] = [];
      let nextShapeId = 2;
      let nextRelationshipId = 1;

      visibleLayers.forEach((layer) => {
        if (layer.type === 'image') {
          const imageId = layer.imageNodeId || page.backgroundImageId;
          if (!imageId) return;

          const media = mediaByImageId.get(imageId);
          if (!media) return;

          const relationshipId = `rId${nextRelationshipId}`;
          nextRelationshipId += 1;
          slideRelationships.push(
            `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${media.fileName}"/>`,
          );

          const opacity = Math.max(0, Math.min(1, layer.opacity ?? 1));
          const pictureXml = `      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="${nextShapeId}" name="${escapeXml(layer.name || `Image ${nextShapeId}`)}"/>
          <p:cNvPicPr/>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="${relationshipId}">${opacity < 1 ? `<a:alphaModFix amt="${toAlphaValue(opacity)}"/>` : ''}</a:blip>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm><a:off x="${toEmu(layer.x)}" y="${toEmu(layer.y)}"/><a:ext cx="${toEmu(layer.width)}" cy="${toEmu(layer.height)}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>`;
          slideLayerXml.push(pictureXml);
          nextShapeId += 1;
          return;
        }

        if (!layer.text.trim()) return;

        const fontSize = Math.max(100, Math.round(layer.fontSize * 100));
        const textOpacity = Math.max(0, Math.min(1, layer.opacity ?? 1));
        const backgroundOpacity = Math.max(0, Math.min(1, (layer.backgroundOpacity ?? 0) * textOpacity));
        const paragraphs = layer.text.split(/\r?\n/).map((line) => (
          `          <a:p>
            <a:pPr algn="${alignMap[layer.align || 'left']}"/>
            <a:r>
              <a:rPr lang="zh-CN"${(layer.fontWeight || 0) >= 600 ? ' b="1"' : ''} sz="${fontSize}">
                <a:solidFill>${makeColorXml(layer.color, 'FFFFFF', textOpacity)}</a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(line || ' ')}</a:t>
            </a:r>
            <a:endParaRPr lang="zh-CN" sz="${fontSize}"/>
          </a:p>`
        )).join('\n');
        const textXml = `      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${nextShapeId}" name="${escapeXml(layer.name || `Text ${nextShapeId}`)}"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="${toEmu(layer.x)}" y="${toEmu(layer.y)}"/><a:ext cx="${toEmu(layer.width)}" cy="${toEmu(layer.height)}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          ${layer.backgroundColor && backgroundOpacity > 0 ? `<a:solidFill>${makeColorXml(layer.backgroundColor, '111827', backgroundOpacity)}</a:solidFill>` : '<a:noFill/>'}
          <a:ln><a:noFill/></a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr wrap="square" lIns="114300" tIns="57150" rIns="114300" bIns="57150"/>
          <a:lstStyle/>
${paragraphs}
        </p:txBody>
      </p:sp>`;
        slideLayerXml.push(textXml);
        nextShapeId += 1;
      });

      slideRelationships.push(
        `<Relationship Id="rId${nextRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`,
      );

      zip.file(`ppt/slides/slide${slideIndex + 1}.xml`, buildPptxSlideXml({
        bodyXml: slideLayerXml.join('\n'),
      }));

      zip.file(`ppt/slides/_rels/slide${slideIndex + 1}.xml.rels`, buildPptxSlideRelationshipsXml(slideRelationships));
    }

    const pptxBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(pptxBlob, `ppt-layered-${Date.now()}.pptx`);

    import('../services/system/notificationService').then(({ notify }) => {
      notify.success('PPTX 导出完成', `已导出 ${pages.length} 页的可编辑图层 PPTX`);
    });
  }, [requirePptEditableExportBundle, resolvePptExportImageAsset]);

  const handleExportPptx = useCallback(async (node: PromptNode): Promise<void> => {
    if (!activeCanvasRef.current) return;
    if (node.mode !== GenerationMode.PPT) return;

    const ordered = getPromptPptImageNodes(activeCanvasRef.current.imageNodes, node.id).slice(0, 20);

    if (ordered.length === 0) {
      showNoPptPagesWarning();
      return;
    }

    const escapeXml = (s: string) => String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const zip = new JSZip();
    writePptxPackageSkeleton({
      zip,
      slideCount: ordered.length,
      title: node.prompt || 'KK Studio PPT export',
    });

    for (let i = 0; i < ordered.length; i++) {
      const img = ordered[i];
      const outlineRaw = node.pptSlides?.[i] || img.alias || `Slide ${i + 1}`;
      const { title: outlineTitle, subtitle: outlineSubtitle } = parsePptOutlineLine(outlineRaw);
      const titleText = outlineTitle || `Slide ${i + 1}`;
      const subtitleText = outlineSubtitle || '';
      const src = img.originalUrl || img.url;
      const res = await fetch(src);
      const blob = await res.blob();
      const mime = blob.type || 'image/png';
      const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'png';
      const mediaPath = `ppt/media/image${i + 1}.${ext}`;
      zip.file(mediaPath, blob);

      zip.file(`ppt/slides/slide${i + 1}.xml`, buildPptxSlideXml({
        bodyXml: `      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="2" name="${escapeXml(img.alias || `Slide ${i + 1}`)}"/>
          <p:cNvPicPr/>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rId1"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Title Box"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="228600"/><a:ext cx="11277600" cy="731520"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="111827"><a:alpha val="42000"/></a:srgbClr></a:solidFill>
          <a:ln><a:noFill/></a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr lIns="114300" tIns="57150" rIns="114300" bIns="57150"/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="zh-CN" b="1" sz="3200"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr>
              <a:t>${escapeXml(titleText)}</a:t>
            </a:r>
            <a:endParaRPr lang="zh-CN" sz="3200"/>
          </a:p>
        </p:txBody>
      </p:sp>
      ${subtitleText ? `<p:sp>
        <p:nvSpPr>
          <p:cNvPr id="4" name="Subtitle Box"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="1005840"/><a:ext cx="11277600" cy="548640"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="0F172A"><a:alpha val="28000"/></a:srgbClr></a:solidFill>
          <a:ln><a:noFill/></a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr lIns="114300" tIns="38100" rIns="114300" bIns="38100"/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="zh-CN" sz="1800"><a:solidFill><a:srgbClr val="E5E7EB"/></a:solidFill></a:rPr>
              <a:t>${escapeXml(subtitleText)}</a:t>
            </a:r>
            <a:endParaRPr lang="zh-CN" sz="1800"/>
          </a:p>
        </p:txBody>
      </p:sp>` : ''}
`,
      }));

      zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, buildPptxSlideRelationshipsXml([
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i + 1}.${ext}"/>`,
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>',
      ]));
    }

    const pptxBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(pptxBlob, `ppt-slides-${Date.now()}.pptx`);
    import('../services/system/notificationService').then(({ notify }) => {
      notify.success('PPTX export complete', `Exported ${ordered.length} slides as a .pptx file`);
    });
  }, [activeCanvasRef, parsePptOutlineLine, showNoPptPagesWarning]);

  const handleExportPptPackage = useCallback(async (node: PromptNode): Promise<void> => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;

    const childImages = getPromptPptImageNodes(canvas.imageNodes, node.id);

    if (childImages.length === 0) {
      showNoPptPagesWarning();
      return;
    }

    const zip = new JSZip();
    const pagesMeta: PptPackagePageMeta[] = [];

    for (let i = 0; i < childImages.length; i += 1) {
      const img = childImages[i];
      const pageNo = i + 1;
      const pageName = img.alias || `图${pageNo}`;
      const outlineRaw = node.pptSlides?.[i] || img.alias || '';
      const { title: outlineTitle, subtitle: outlineSubtitle } = parsePptOutlineLine(outlineRaw);
      const fileName = `pages/${String(pageNo).padStart(2, '0')}-${pageName.replace(/[\\/:*?"<>|]/g, '_')}.png`;
      const src = img.originalUrl || img.url;

      try {
        const res = await fetch(src);
        const blob = await res.blob();
        zip.file(fileName, blob);
      } catch {
        // Skip broken pages but keep metadata
      }

      pagesMeta.push({
        page: pageNo,
        title: pageName,
        outlineTitle,
        outlineSubtitle,
        prompt: img.prompt,
        model: img.model,
        provider: img.providerLabel || img.provider,
        keySlotId: img.keySlotId,
        dimensions: img.dimensions,
        imageSize: img.imageSize,
        timestamp: img.timestamp,
        file: fileName,
      });
    }

    const outlinePages = (node.pptSlides || []).map((text, idx) => ({
      page: idx + 1,
      text,
    }));

    zip.file('meta/manifest.json', JSON.stringify({
      exportedAt: new Date().toISOString(),
      nodeId: node.id,
      nodePrompt: node.prompt,
      pageCount: childImages.length,
      pages: pagesMeta,
    }, null, 2));

    zip.file('outline/ppt-outline.json', JSON.stringify({
      topic: node.prompt,
      pageCount: Math.max(childImages.length, outlinePages.length),
      styleLocked: node.pptStyleLocked !== false,
      pages: outlinePages,
    }, null, 2));

    zip.file('meta/node-meta.json', JSON.stringify({
      nodeId: node.id,
      model: node.model,
      modelLabel: node.modelLabel,
      provider: node.provider,
      providerLabel: node.providerLabel,
      keySlotId: node.keySlotId,
      aspectRatio: node.aspectRatio,
      imageSize: node.imageSize,
      parallelCount: node.parallelCount,
      styleLocked: node.pptStyleLocked !== false,
      referenceStorageIds: (node.referenceImages || []).map((ref) => ref.storageId || ref.id).filter(Boolean),
    }, null, 2));

    const slidesHtml = buildPptSlidesPreviewHtml({
      title: node.prompt || 'PPT 导出',
      items: pagesMeta.map((pageMeta) => ({
        page: pageMeta.page,
        title: String(pageMeta.title || ''),
        imageSrc: `../${String(pageMeta.file || '')}`,
        description: String(pageMeta.prompt || ''),
      })),
    });
    zip.file('outline/slides-preview.html', slidesHtml);

    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `ppt-pages-${Date.now()}.zip`);

    import('../services/system/notificationService').then(({ notify }) => {
      notify.success('导出完成', `已导出 ${childImages.length} 页与 pages/outline/meta 目录`);
    });
  }, [activeCanvasRef, parsePptOutlineLine, showNoPptPagesWarning]);

  const stitchPptImagesToBlob = useCallback(async (images: GeneratedImage[]) => {
    const loaded = await Promise.all(images.map(async (image) => {
      const { blob } = await resolvePptImageBlob(image);
      const objectUrl = URL.createObjectURL(blob);
      try {
        const element = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('图片加载失败'));
          img.src = objectUrl;
        });
        return {
          width: element.naturalWidth,
          height: element.naturalHeight,
          element,
        };
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }));

    const maxWidth = Math.max(...loaded.map((item) => item.width));
    const scaledHeights = loaded.map((item) => Math.round(item.height * (maxWidth / item.width)));
    const rawTotalHeight = scaledHeights.reduce((sum, value) => sum + value, 0);
    const maxCanvasHeight = 32000;
    const downscale = rawTotalHeight > maxCanvasHeight ? maxCanvasHeight / rawTotalHeight : 1;
    const targetWidth = Math.max(1, Math.round(maxWidth * downscale));
    const finalHeights = scaledHeights.map((value) => Math.max(1, Math.round(value * downscale)));
    const totalHeight = finalHeights.reduce((sum, value) => sum + value, 0);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = totalHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('无法创建整屏导出画布');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    let offsetY = 0;
    loaded.forEach((item, index) => {
      const height = finalHeights[index];
      context.drawImage(item.element, 0, offsetY, targetWidth, height);
      offsetY += height;
    });

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png', 1);
    });

    if (!blob) {
      throw new Error('整屏导出失败');
    }

    return blob;
  }, [resolvePptImageBlob]);

  const handleDownloadPptComposite = useCallback(async (imageId: string): Promise<void> => {
    const bundle = getOrderedPptPreviewBundle(imageId);
    if (!bundle) return;

    try {
      const blob = await stitchPptImagesToBlob(bundle.images);
      saveAs(blob, `ppt-full-screen-${Date.now()}.png`);
      import('../services/system/notificationService').then(({ notify }) => {
        notify.success('导出完成', `已导出 ${bundle.images.length} 页整屏长图`);
      });
    } catch (error: unknown) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.error('整屏导出失败', error instanceof Error ? error.message : '请稍后重试');
      });
    }
  }, [getOrderedPptPreviewBundle, stitchPptImagesToBlob]);

  const handleExportPptSinglePage = useCallback(async (node: PromptNode, pageIndex: number): Promise<void> => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;
    if (node.mode !== GenerationMode.PPT) return;

    const ordered = getPromptPptImageNodes(canvas.imageNodes || [], node.id);
    const target = ordered[pageIndex];
    if (!target) return;

    try {
      const res = await fetch(target.originalUrl || target.url);
      const blob = await res.blob();
      const name = `ppt-page-${String(pageIndex + 1).padStart(2, '0')}.png`;
      saveAs(blob, name);
      import('../services/system/notificationService').then(({ notify }) => {
        notify.success('导出完成', `已导出图 ${pageIndex + 1}`);
      });
    } catch (error: unknown) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.error('导出失败', error instanceof Error ? error.message : '无法导出该页面');
      });
    }
  }, [activeCanvasRef]);

  const handleEditPptTextFromLightbox = useCallback((image: GeneratedImage): void => {
    const bundle = getOrderedPptPreviewBundle(image.id);
    if (!bundle) return;

    const currentText = bundle.promptNode.pptSlides?.[bundle.currentIndex]
      || image.alias
      || buildPptPageAlias(undefined, bundle.currentIndex);
    const nextText = window.prompt(`编辑第 ${bundle.currentIndex + 1} 页文字`, currentText);
    if (nextText === null) return;

    const trimmed = nextText.trim();
    if (!trimmed) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.warning('内容为空', '请输入当前页面的标题或描述');
      });
      return;
    }

    const nextSlides = [...(bundle.promptNode.pptSlides || [])];
    while (nextSlides.length < bundle.images.length) {
      nextSlides.push(buildPptPageAlias(undefined, nextSlides.length));
    }
    nextSlides[bundle.currentIndex] = trimmed;

    const nextPages = buildPptEditablePages(bundle.promptNode, bundle.images);
    const parsed = parsePptOutlineLine(trimmed);
    const currentPage = nextPages[bundle.currentIndex];
    if (currentPage) {
      let patchedPage = patchPptTextLayer(
        currentPage,
        'title',
        parsed.title || buildPptPageAlias(trimmed, bundle.currentIndex),
      );
      patchedPage = patchPptTextLayer(patchedPage, 'subtitle', parsed.subtitle || '');
      nextPages[bundle.currentIndex] = patchedPage;
    }

    updatePromptNode({
      ...bundle.promptNode,
      pptSlides: nextSlides,
      pptEditablePages: nextPages,
      parallelCount: Math.max(bundle.promptNode.parallelCount || 1, nextSlides.length),
    });

    updateImageNode(image.id, {
      alias: buildPptPageAlias(trimmed, bundle.currentIndex),
    });

    setPreviewImages((prev) => prev?.map((item) => (
      item.id === image.id
        ? { ...item, alias: buildPptPageAlias(trimmed, bundle.currentIndex) }
        : item
    )) || prev);

    setPptStackPreview((prev) => prev ? {
      ...prev,
      images: prev.images.map((item) => (
        item.id === image.id
          ? { ...item, alias: buildPptPageAlias(trimmed, bundle.currentIndex) }
          : item
      )),
    } : prev);

    import('../services/system/notificationService').then(({ notify }) => {
      notify.success('页面文案已更新', `第 ${bundle.currentIndex + 1} 页已同步到主卡设置`);
    });
  }, [buildPptPageAlias, buildPptEditablePages, getOrderedPptPreviewBundle, parsePptOutlineLine, setPptStackPreview, setPreviewImages, updateImageNode, updatePromptNode]);

  const handleSavePptEditablePages = useCallback((nodeId: string, pages: PptEditablePage[]): void => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;

    const promptNode = canvas.promptNodes.find((node) => node.id === nodeId);
    if (!promptNode) return;

    const safePages = pages || [];
    const nextSlides = syncPptSlidesFromEditablePages(safePages);
    updatePromptNode({
      ...promptNode,
      pptEditablePages: safePages,
      pptSlides: nextSlides,
      parallelCount: Math.max(promptNode.parallelCount || 1, nextSlides.length || 1),
    });

    const aliasByImageId = new Map<string, string>();

    safePages.forEach((page, index) => {
      const alias = buildPptPageAlias(nextSlides[index], index);
      const pageImageId = resolvePptEditablePageImageId(page);
      if (pageImageId) {
        aliasByImageId.set(pageImageId, alias);
      }
    });

    aliasByImageId.forEach((alias, imageId) => {
      updateImageNode(imageId, { alias });
    });

    setPreviewImages((prev) => {
      if (!prev) return prev;
      return prev.map((image) => {
        const alias = aliasByImageId.get(image.id);
        return alias ? { ...image, alias } : image;
      });
    });

    setPptStackPreview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        images: prev.images.map((image) => {
          const alias = aliasByImageId.get(image.id);
          return alias ? { ...image, alias } : image;
        }),
      };
    });

    import('../services/system/notificationService').then(({ notify }) => {
      notify.success(
        pickByDocumentLanguage('页面包已更新', 'Deck updated'),
        pickByDocumentLanguage(
          `已保存 ${safePages.length} 页可编辑 PPT 页面。`,
          `Saved ${safePages.length} editable PPT page${safePages.length === 1 ? '' : 's'}.`,
        ),
      );
    });
  }, [activeCanvasRef, buildPptPageAlias, pickByDocumentLanguage, setPptStackPreview, setPreviewImages, updateImageNode, updatePromptNode]);

  const handleOpenPptDeckEditor = useCallback((nodeOrId: PromptNode | string, initialIndex = 0): void => {
    const bundle = getOrderedPptNodeBundle(nodeOrId);
    if (!bundle) return;

    setPptDeckEditor({
      nodeId: bundle.promptNode.id,
      initialIndex: Math.max(0, Math.min(initialIndex, bundle.images.length - 1)),
    });
  }, [getOrderedPptNodeBundle, setPptDeckEditor]);

  const handleOpenPptDeckEditorFromImage = useCallback((image: GeneratedImage): void => {
    const bundle = getOrderedPptPreviewBundle(image.id);
    if (!bundle) return;
    handleOpenPptDeckEditor(bundle.promptNode, bundle.currentIndex);
  }, [getOrderedPptPreviewBundle, handleOpenPptDeckEditor]);

  const handleOpenPptStackPreview = useCallback((imageId: string): void => {
    const bundle = getOrderedPptPreviewBundle(imageId);
    if (!bundle) return;

    setPptStackPreview({
      images: bundle.images,
      initialIndex: bundle.currentIndex,
    });
  }, [getOrderedPptPreviewBundle, setPptStackPreview]);

  const isPptDeckChildImageNode = useCallback((imageNode: GeneratedImage): boolean => {
    return isPptDeckChildImageNodeFromCanvas(imageNode, activeCanvasRef.current);
  }, [activeCanvasRef]);

  const resolveCurrentPromptChildImages = useCallback((
    promptNode: PromptNode | undefined | null,
    imageNodes: GeneratedImage[],
  ): GeneratedImage[] => {
    return resolveCurrentPromptChildImagesForPptRuntime(promptNode, imageNodes);
  }, []);

  return {
    showNoPptPagesWarning,
    parsePptOutlineLine,
    buildPptPageAlias,
    getOrderedPptPreviewBundle,
    tryOpenPptPreview,
    getOrderedPptNodeBundle,
    getPptEditableExportBundle,
    requirePptEditableExportBundle,
    sanitizePptFileSegment,
    resolvePptImageBlob,
    resolvePptExportImageAsset,
    renderPptEditablePagePreviewBlob,
    handleExportPptPackageEditable,
    handleExportPptxEditable,
    handleExportPptx,
    handleExportPptPackage,
    handleDownloadPptComposite,
    handleExportPptSinglePage,
    handleEditPptTextFromLightbox,
    handleSavePptEditablePages,
    handleOpenPptDeckEditor,
    handleOpenPptDeckEditorFromImage,
    handleOpenPptStackPreview,
    isPptDeckChildImageNode,
    resolveCurrentPromptChildImages,
  };
}
