import type {
  GeneratedImage,
  PromptNode,
  PptDeckModuleState,
  PptDeckPageGenerationStatus,
  PptDeckPageModule,
  PptEditablePage,
} from '../types';
import { buildPptPageAlias, parsePptOutlineLine } from './pptUtils';

type PptDeckPromptLike = Pick<
  PromptNode,
  | 'prompt'
  | 'timestamp'
  | 'isGenerating'
  | 'error'
  | 'parallelCount'
  | 'lastGenerationTotalCount'
  | 'childImageIds'
  | 'pptSlides'
  | 'pptEditablePages'
  | 'pptStyleLocked'
  | 'pptDeck'
>;

type PptDeckImageLike = Pick<
  GeneratedImage,
  'id' | 'alias' | 'url' | 'originalUrl' | 'error' | 'timestamp'
>;

const getExpectedPageCount = (node: PptDeckPromptLike) => {
  const counts = [
    node.pptSlides?.length || 0,
    node.pptEditablePages?.length || 0,
    node.childImageIds?.length || 0,
    node.pptDeck?.pages?.length || 0,
    node.lastGenerationTotalCount || 0,
    node.parallelCount || 0,
  ];

  const maxCount = Math.max(...counts, 0);
  if (maxCount > 0) {
    return maxCount;
  }

  return String(node.prompt || '').trim() ? 1 : 0;
};

const resolveDeckStage = (
  node: PptDeckPromptLike,
  pageCount: number,
  readyCount: number,
): PptDeckModuleState['stage'] => {
  if (node.error) {
    return 'failed';
  }
  if (node.isGenerating) {
    return 'generating';
  }
  if (readyCount > 0) {
    return 'ready';
  }
  if (pageCount > 0 && (node.pptSlides?.length || 0) > 0) {
    return 'descriptions';
  }
  return 'outline';
};

const resolvePageStatus = (
  node: PptDeckPromptLike,
  index: number,
  pageCount: number,
  imageId: string | undefined,
  image: PptDeckImageLike | undefined,
  inheritedPage: PptDeckPageModule | undefined,
): PptDeckPageGenerationStatus => {
  if (image?.error) {
    return 'error';
  }
  if (imageId && (image || inheritedPage?.thumbnailUrl)) {
    return 'ready';
  }
  if (node.error && index < Math.max(pageCount, 1)) {
    return 'error';
  }
  if (node.isGenerating) {
    return index < Math.max(node.parallelCount || 0, pageCount) ? 'generating' : 'queued';
  }
  return 'idle';
};

const resolveOutlineText = (
  slides: string[],
  editablePage: PptEditablePage | undefined,
  inheritedPage: PptDeckPageModule | undefined,
  prompt: string,
  index: number,
) => {
  const raw = String(
    slides[index]
      || editablePage?.outline
      || inheritedPage?.outlineText
      || inheritedPage?.pageDescription
      || ''
  ).trim();

  if (raw) {
    return raw;
  }

  return prompt.trim()
    ? `第 ${index + 1} 页：${prompt.trim()}`
    : `第 ${index + 1} 页`;
};

export const buildPptDeckModuleState = (
  node: PptDeckPromptLike,
  images: PptDeckImageLike[] = [],
): PptDeckModuleState => {
  const slides = (node.pptSlides || []).map((item) => String(item || '').trim());
  const inheritedPages = node.pptDeck?.pages || [];
  const editablePages = node.pptEditablePages || [];
  const imageIds = (node.childImageIds || []).filter(Boolean);
  const imageById = new Map(images.map((image) => [image.id, image] as const));
  const pageCount = getExpectedPageCount(node);

  const pages: PptDeckPageModule[] = Array.from({ length: pageCount }, (_, index) => {
    const inheritedPage = inheritedPages[index];
    const editablePage = editablePages[index];
    const outlineText = resolveOutlineText(slides, editablePage, inheritedPage, String(node.prompt || ''), index);
    const parsedOutline = parsePptOutlineLine(outlineText);
    const imageId = imageIds[index] || editablePage?.backgroundImageId || inheritedPage?.imageId;
    const image = imageId ? imageById.get(imageId) : undefined;
    const thumbnailUrl = image?.originalUrl || image?.url || inheritedPage?.thumbnailUrl;
    const title = String(
      inheritedPage?.title
        || editablePage?.name
        || image?.alias
        || buildPptPageAlias(outlineText, index)
    ).trim();
    const pageDescription = String(
      editablePage?.notes
        || inheritedPage?.pageDescription
        || parsedOutline.subtitle
        || outlineText
    ).trim();

    return {
      pageIndex: index,
      pageNumber: index + 1,
      title: title || `第 ${index + 1} 页`,
      outlineText,
      pageDescription,
      imageId,
      editablePageId: editablePage?.id || inheritedPage?.editablePageId,
      thumbnailUrl,
      generationStatus: resolvePageStatus(node, index, pageCount, imageId, image, inheritedPage),
      error: image?.error || (node.error && !imageId ? node.error : inheritedPage?.error),
      version: inheritedPage?.version || 1,
      updatedAt: image?.timestamp || editablePage?.pageIndex || inheritedPage?.updatedAt || node.timestamp,
      exportStatus: inheritedPage?.exportStatus || 'idle',
    };
  });

  const readyCount = pages.filter((page) => page.generationStatus === 'ready').length;
  const stage = resolveDeckStage(node, pageCount, readyCount);
  const lastThumbnailUrl = [...pages].reverse().find((page) => page.thumbnailUrl)?.thumbnailUrl;

  return {
    stage,
    title: String(node.prompt || '').trim() || 'PPT 项目',
    pageCount,
    styleLocked: node.pptStyleLocked !== false,
    pages,
    lastThumbnailUrl,
    exportStatus: readyCount > 0 ? 'ready' : (node.pptDeck?.exportStatus || 'idle'),
    source: node.pptDeck ? 'native' : 'derived-legacy',
    updatedAt: node.timestamp,
  };
};
