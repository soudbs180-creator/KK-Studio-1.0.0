import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import type {
  OrderedPptNodeBundle,
  OrderedPptPreviewBundle,
  PptDeckEditorState,
  PptEditableExportBundle,
  PptOutlineLineParts,
  PptStackPreviewState,
  UsePptRuntimeDeps,
  UsePptRuntimeResult,
} from '../../apps/web/src/app/usePptRuntime.ts';
import type { PptRuntimeCanvasSnapshot } from '../../apps/web/src/app/pptRuntimeHelpers.ts';

const ROOT_DIR = process.cwd();

type PptRuntimePublicBoundary = {
  deps: UsePptRuntimeDeps;
  result: UsePptRuntimeResult;
  outline: PptOutlineLineParts;
  previewBundle: OrderedPptPreviewBundle;
  nodeBundle: OrderedPptNodeBundle;
  exportBundle: PptEditableExportBundle;
  deckEditor: PptDeckEditorState;
  stackPreview: PptStackPreviewState;
  canvasSnapshot: PptRuntimeCanvasSnapshot;
}

function readSource(relativePath: string): string {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '';
}

function assertAppDoesNotDefine(appSource: string, name: string): void {
  assert.doesNotMatch(
    appSource,
    new RegExp(`(?:const|let|var)\\s+${name}\\s*=|function\\s+${name}\\s*\\(`),
  );
}

test('PPT runtime helpers and exports are owned by usePptRuntime', () => {
  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/usePptRuntime.ts');
  const helperSource = readSource('src/app/pptRuntimeHelpers.ts');
  const testConfigSource = readSource('tsconfig.tests.json');
  const boundaryIsTypechecked: PptRuntimePublicBoundary | null = null;

  assert.equal(boundaryIsTypechecked, null);
  assert.match(hookSource, /export interface UsePptRuntimeDeps/);
  assert.match(hookSource, /export interface UsePptRuntimeResult/);
  assert.match(testConfigSource, /tests\/unit\/ppt-runtime-contract\.test\.ts/);
  assert.match(testConfigSource, /tests\/unit\/ppt-runtime-helper-contract\.test\.ts/);
  assert.match(testConfigSource, /tests\/unit\/ppt-deck-single-container-contract\.test\.ts/);
  assert.match(hookSource, /setPptDeckEditor: Dispatch<SetStateAction<PptDeckEditorState \| null>>;/);
  assert.match(hookSource, /type UpdatePromptNode = \(promptNode: PromptNode\) => void \| Promise<unknown>;/);
  assert.match(hookSource, /type UpdateImageNode = \(id: string, updates: Partial<GeneratedImage>\) => void \| Promise<unknown>;/);
  assert.match(hookSource, /pickByDocumentLanguage: typeof pickByDocumentLanguage;/);
  assert.match(hookSource, /updatePromptNode: UpdatePromptNode;/);
  assert.match(hookSource, /updateImageNode: UpdateImageNode;/);
  assert.match(hookSource, /setPreviewImages: Dispatch<SetStateAction<GeneratedImage\[\] \| null>>;/);
  assert.match(hookSource, /setPreviewInitialIndex: Dispatch<SetStateAction<number>>;/);
  assert.match(hookSource, /setPptStackPreview: Dispatch<SetStateAction<PptStackPreviewState \| null>>;/);
  assert.match(hookSource, /showNoPptPagesWarning: \(\) => void;/);
  assert.match(hookSource, /parsePptOutlineLine: \(raw\?: string\) => PptOutlineLineParts;/);
  assert.match(hookSource, /buildPptPageAlias: \(raw: string \| undefined, pageIndex: number\) => string;/);
  assert.match(hookSource, /getOrderedPptPreviewBundle: \(imageId: string\) => OrderedPptPreviewBundle \| null;/);
  assert.match(hookSource, /tryOpenPptPreview: \(imageId: string\) => boolean;/);
  assert.match(hookSource, /getOrderedPptNodeBundle: \(nodeOrId: PromptNode \| string\) => OrderedPptNodeBundle \| null;/);
  assert.match(hookSource, /getPptEditableExportBundle: \(node: PromptNode\) => PptEditableExportBundle \| null;/);
  assert.match(hookSource, /requirePptEditableExportBundle: \(node: PromptNode\) => PptEditableExportBundle \| null;/);
  assert.match(hookSource, /sanitizePptFileSegment: \(value: string, fallback: string\) => string;/);
  assert.match(hookSource, /resolvePptImageBlob: \(image: GeneratedImage\) => Promise<\{ blob: Blob; isOriginal: boolean \}>;/);
  assert.match(hookSource, /resolvePptExportImageAsset: \(image: GeneratedImage\) => Promise<\{ blob: Blob; ext: 'png' \| 'jpg'; mime: 'image\/png' \| 'image\/jpeg' \}>;/);
  assert.match(hookSource, /renderPptEditablePagePreviewBlob: \(page: PptEditablePage, imageById: Map<string, GeneratedImage>\) => Promise<Blob>;/);
  assert.match(hookSource, /handleExportPptPackageEditable: \(node: PromptNode\) => Promise<void>;/);
  assert.match(hookSource, /handleExportPptxEditable: \(node: PromptNode\) => Promise<void>;/);
  assert.match(hookSource, /handleExportPptx: \(node: PromptNode\) => Promise<void>;/);
  assert.match(hookSource, /handleExportPptPackage: \(node: PromptNode\) => Promise<void>;/);
  assert.match(hookSource, /handleSavePptEditablePages: \(nodeId: string, pages: PptEditablePage\[\]\) => void;/);
  assert.match(hookSource, /handleExportPptSinglePage: \(node: PromptNode, pageIndex: number\) => Promise<void>;/);
  assert.match(hookSource, /handleEditPptTextFromLightbox: \(image: GeneratedImage\) => void;/);
  assert.match(hookSource, /handleOpenPptDeckEditor: \(nodeOrId: PromptNode \| string, initialIndex\?: number\) => void;/);
  assert.match(hookSource, /handleOpenPptDeckEditorFromImage: \(image: GeneratedImage\) => void;/);
  assert.match(hookSource, /handleOpenPptStackPreview: \(imageId: string\) => void;/);
  assert.match(hookSource, /handleDownloadPptComposite: \(imageId: string\) => Promise<void>;/);
  assert.match(hookSource, /isPptDeckChildImageNode: \(imageNode: GeneratedImage\) => boolean;/);
  assert.match(hookSource, /resolveCurrentPromptChildImages: \(promptNode: PromptNode \| undefined \| null, imageNodes: GeneratedImage\[\]\) => GeneratedImage\[\];/);
  assert.match(hookSource, /const showNoPptPagesWarning = useCallback\(\(\): void => \{/);
  assert.match(hookSource, /import\('\.\.\/services\/system\/notificationService'\)/);
  assert.match(hookSource, /const parsePptOutlineLine = useCallback\(\(raw\?: string\): PptOutlineLineParts => \{/);
  assert.match(hookSource, /splitBy\('：'\) \|\| splitBy\(':'\)/);
  assert.match(hookSource, /splitBy\(' - '\) \|\| splitBy\(' — '\) \|\| splitBy\(' – '\)/);
  assert.match(hookSource, /return title \|\| `第 \$\{pageIndex \+ 1\} 页`;/);
  assert.match(hookSource, /from '\.\/pptRuntimeHelpers';/);
  assert.match(hookSource, /const getOrderedPptPreviewBundle = useCallback\(\(imageId: string\): OrderedPptPreviewBundle \| null => \{/);
  assert.match(hookSource, /return resolveOrderedPptPreviewBundleForCanvas\(canvas, imageId\);/);
  assert.match(hookSource, /const getOrderedPptNodeBundle = useCallback\(\(nodeOrId: PromptNode \| string\): OrderedPptNodeBundle \| null => \{/);
  assert.match(hookSource, /return resolveOrderedPptNodeBundleForCanvas\(canvas, nodeOrId\);/);
  assert.match(hookSource, /const tryOpenPptPreview = useCallback\(\(imageId: string\): boolean => \{/);
  assert.match(hookSource, /setPreviewImages\(bundle\.images\);/);
  assert.match(hookSource, /setPreviewInitialIndex\(bundle\.currentIndex\);/);
  assert.match(helperSource, /export function resolveOrderedPptPreviewBundleForCanvas/);
  assert.match(helperSource, /export function resolveOrderedPptNodeBundleForCanvas/);
  assert.match(helperSource, /getPromptPptImageNodes\(safeImageNodes, promptNode\.id\)\.forEach\(pushImage\);/);
  assert.match(helperSource, /if \(candidate\.parentPromptId !== promptNode\.id\) return;/);
  assert.doesNotMatch(hookSource, /getPromptPptImageNodes/);
  assert.match(hookSource, /const getPptEditableExportBundle = useCallback\(\(node: PromptNode\): PptEditableExportBundle \| null => \{/);
  assert.match(hookSource, /const pages = buildPptEditablePages\(bundle\.promptNode, images\);/);
  assert.match(hookSource, /const requirePptEditableExportBundle = useCallback\(\(node: PromptNode\): PptEditableExportBundle \| null => \{/);
  assert.match(hookSource, /showNoPptPagesWarning\(\);/);
  assert.match(hookSource, /const sanitizePptFileSegment = useCallback\(\(value: string, fallback: string\): string => \{/);
  assert.match(hookSource, /const renderBlobIntoImage = useCallback\(\(blob: Blob\) => \(/);
  assert.match(hookSource, /const convertBlobToPng = useCallback\(async \(blob: Blob\) => \{/);
  assert.doesNotMatch(hookSource, /[\u0080-\u009f]/);
  assert.match(hookSource, /new Error\('图片加载失败'\)/);
  assert.match(hookSource, /throw new Error\('无法创建导出画布'\);/);
  assert.match(hookSource, /throw new Error\('无法转换图片格式'\);/);
  assert.match(hookSource, /throw new Error\('无法创建页面预览画布'\);/);
  assert.match(hookSource, /throw new Error\('无法生成页面预览'\);/);
  assert.match(hookSource, /const resolvePptImageBlob = useCallback\(async \(image: GeneratedImage\): Promise<\{ blob: Blob; isOriginal: boolean \}> => \{/);
  assert.match(hookSource, /const \{ getStrictOriginalImage \} = await import\('\.\.\/services\/storage\/imageStorage'\);/);
  assert.match(hookSource, /blob = base64ToBlob\(source\);/);
  assert.match(hookSource, /const resolvePptExportImageAsset = useCallback\(async \(image: GeneratedImage\): Promise<\{ blob: Blob; ext: 'png' \| 'jpg'; mime: 'image\/png' \| 'image\/jpeg' \}> => \{/);
  assert.match(hookSource, /const renderPptEditablePagePreviewBlob = useCallback\(async \(\s*page: PptEditablePage,\s*imageById: Map<string, GeneratedImage>,\s*\): Promise<Blob> => \{/s);
  assert.match(hookSource, /const handleExportPptPackageEditable = useCallback\(async \(node: PromptNode\): Promise<void> => \{/);
  assert.match(hookSource, /const exportBundle = requirePptEditableExportBundle\(node\);/);
  assert.match(hookSource, /const outlinePages = syncPptSlidesFromEditablePages\(pages\);/);
  assert.match(hookSource, /const asset = await resolvePptExportImageAsset\(image\);/);
  assert.match(hookSource, /zip\.file\(previewFile, await renderPptEditablePagePreviewBlob\(page, imageById\)\);/);
  assert.match(hookSource, /zip\.file\('editable\/deck\.json'/);
  assert.match(hookSource, /zip\.file\(slideFile, JSON\.stringify/);
  assert.match(hookSource, /zip\.file\('meta\/manifest\.json'/);
  assert.match(hookSource, /zip\.file\('outline\/ppt-outline\.json'/);
  assert.match(hookSource, /zip\.file\('outline\/slides-preview\.html', slidesHtml\);/);
  assert.match(hookSource, /const slidesHtml = buildPptSlidesPreviewHtml\(\{/);
  assert.match(hookSource, /saveAs\(blob, `ppt-editable-package-\$\{Date\.now\(\)\}\.zip`\);/);
  assert.match(hookSource, /const handleExportPptxEditable = useCallback\(async \(node: PromptNode\): Promise<void> => \{/);
  assert.match(hookSource, /writePptxPackageSkeleton\(\{/);
  assert.match(hookSource, /buildPptxSlideXml\(\{/);
  assert.match(hookSource, /buildPptxSlideRelationshipsXml\(/);
  assert.match(hookSource, /saveAs\(pptxBlob, `ppt-layered-\$\{Date\.now\(\)\}\.pptx`\);/);
  assert.match(hookSource, /const handleExportPptx = useCallback\(async \(node: PromptNode\): Promise<void> => \{/);
  assert.match(hookSource, /const bundle = getOrderedPptNodeBundle\(node\);/);
  assert.match(hookSource, /const ordered = bundle\?\.images\.slice\(0, 20\) \|\| \[\];/);
  assert.match(hookSource, /const promptNode = bundle\?\.promptNode \|\| node;/);
  assert.match(hookSource, /title: promptNode\.prompt \|\| 'KK Studio PPT export',/);
  assert.match(hookSource, /const outlineRaw = promptNode\.pptSlides\?\.\[i\] \|\| img\.alias \|\|/);
  assert.match(hookSource, /zip\.file\(`ppt\/slides\/slide\$\{i \+ 1\}\.xml`, buildPptxSlideXml\(\{/);
  assert.match(hookSource, /zip\.file\(`ppt\/slides\/_rels\/slide\$\{i \+ 1\}\.xml\.rels`, buildPptxSlideRelationshipsXml\(\[/);
  assert.match(hookSource, /saveAs\(pptxBlob, `ppt-slides-\$\{Date\.now\(\)\}\.pptx`\);/);
  assert.match(hookSource, /import\('\.\.\/services\/system\/notificationService'\)\.then\(\(\{ notify \}\) => \{/);
  assert.match(hookSource, /const handleExportPptPackage = useCallback\(async \(node: PromptNode\): Promise<void> => \{/);
  assert.match(hookSource, /const childImages = bundle\?\.images \|\| \[\];/);
  assert.match(hookSource, /const outlineRaw = promptNode\.pptSlides\?\.\[i\] \|\| img\.alias \|\| '';/);
  assert.match(hookSource, /nodeId: promptNode\.id,/);
  assert.match(hookSource, /referenceStorageIds: \(promptNode\.referenceImages \|\| \[\]\)\.map/);
  assert.match(hookSource, /const slidesHtml = buildPptSlidesPreviewHtml\(\{/);
  assert.match(hookSource, /zip\.file\('outline\/slides-preview\.html', slidesHtml\);/);
  assert.match(hookSource, /saveAs\(blob, `ppt-pages-\$\{Date\.now\(\)\}\.zip`\);/);
  assert.match(hookSource, /const stitchPptImagesToBlob = useCallback\(async \(images: GeneratedImage\[\]\) => \{/);
  assert.match(hookSource, /const handleDownloadPptComposite = useCallback\(async \(imageId: string\): Promise<void> => \{/);
  assert.match(hookSource, /saveAs\(blob, `ppt-full-screen-\$\{Date\.now\(\)\}\.png`\);/);
  assert.match(hookSource, /const handleExportPptSinglePage = useCallback\(async \(node: PromptNode, pageIndex: number\): Promise<void> => \{/);
  assert.match(hookSource, /if \(node\.mode !== GenerationMode\.PPT\) return;/);
  assert.match(hookSource, /const ordered = getOrderedPptNodeBundle\(node\)\?\.images \|\| \[\];/);
  assert.match(hookSource, /const name = `ppt-page-\$\{String\(pageIndex \+ 1\)\.padStart\(2, '0'\)\}\.png`;/);
  assert.match(hookSource, /notify\.success\('导出完成', `已导出图 \$\{pageIndex \+ 1\}`\);/);
  assert.match(hookSource, /const handleEditPptTextFromLightbox = useCallback\(\(image: GeneratedImage\): void => \{/);
  assert.match(hookSource, /const nextPages = buildPptEditablePages\(bundle\.promptNode, bundle\.images\);/);
  assert.match(hookSource, /patchPptTextLayer\(/);
  assert.match(hookSource, /setPreviewImages\(\(prev\) => prev\?\.map/);
  assert.match(hookSource, /setPptStackPreview\(\(prev\) => prev \? \{/);
  assert.match(hookSource, /notify\.warning\('内容为空', '请输入当前页面的标题或描述'\);/);
  assert.match(hookSource, /notify\.success\('页面文案已更新', `第 \$\{bundle\.currentIndex \+ 1\} 页已同步到主卡设置`\);/);
  assert.match(hookSource, /const handleSavePptEditablePages = useCallback\(\(nodeId: string, pages: PptEditablePage\[\]\): void => \{/);
  assert.match(hookSource, /const canvas = activeCanvasRef\.current;/);
  assert.match(hookSource, /const promptNode = canvas\.promptNodes\.find\(\(node\) => node\.id === nodeId\);/);
  assert.match(hookSource, /function resolvePptEditablePageImageId\(page: PptEditablePage\): string \| undefined \{/);
  assert.match(hookSource, /const safePages = pages \|\| \[\];/);
  assert.match(hookSource, /const nextSlides = syncPptSlidesFromEditablePages\(safePages\);/);
  assert.match(hookSource, /const aliasByImageId = new Map<string, string>\(\);/);
  assert.match(hookSource, /const pageImageId = resolvePptEditablePageImageId\(page\);/);
  assert.match(hookSource, /aliasByImageId\.set\(pageImageId, alias\);/);
  assert.match(hookSource, /aliasByImageId\.forEach\(\(alias, imageId\) => \{/);
  assert.match(hookSource, /updateImageNode\(imageId, \{ alias \}\);/);
  assert.match(hookSource, /setPreviewImages\(\(prev\) => \{/);
  assert.match(hookSource, /aliasByImageId\.get\(image\.id\)/);
  assert.match(hookSource, /setPptStackPreview\(\(prev\) => \{/);
  assert.match(hookSource, /notify\.success\(\s*pickByDocumentLanguage\(/s);
  assert.match(hookSource, /\.replace\(\/\[\\\\\/:\*\?"<>\|\]\/g, '_'\)/);
  assert.match(hookSource, /\.replace\(\/\\s\+\/g, ' '\)/);
  assert.match(hookSource, /const handleOpenPptDeckEditor = useCallback\(\(nodeOrId: PromptNode \| string, initialIndex = 0\): void => \{/);
  assert.match(hookSource, /setPptDeckEditor\(\{/);
  assert.match(hookSource, /initialIndex: Math\.max\(0, Math\.min\(initialIndex, bundle\.images\.length - 1\)\),/);
  assert.match(hookSource, /const handleOpenPptDeckEditorFromImage = useCallback\(\(image: GeneratedImage\): void => \{/);
  assert.match(hookSource, /handleOpenPptDeckEditor\(bundle\.promptNode, bundle\.currentIndex\);/);
  assert.match(hookSource, /const handleOpenPptStackPreview = useCallback\(\(imageId: string\): void => \{/);
  assert.match(hookSource, /setPptStackPreview\(\{\s*images: bundle\.images,\s*initialIndex: bundle\.currentIndex,\s*\}\);/);
  assert.match(hookSource, /const isPptDeckChildImageNode = useCallback\(\(imageNode: GeneratedImage\): boolean => \{/);
  assert.match(hookSource, /return isPptDeckChildImageNodeFromCanvas\(imageNode, activeCanvasRef\.current\);/);
  assert.match(hookSource, /const resolveCurrentPromptChildImages = useCallback\(\(\s*promptNode: PromptNode \| undefined \| null,\s*imageNodes: GeneratedImage\[\],\s*\): GeneratedImage\[\] => \{/);
  assert.match(hookSource, /return resolveCurrentPromptChildImagesForPptRuntime\(promptNode, imageNodes\);/);
  assert.match(helperSource, /if \(promptNode\.mode === GenerationMode\.PPT\) return \[\] as GeneratedImage\[\];/);
  assert.match(helperSource, /const safeImageNodes = imageNodes \|\| \[\];/);
  assert.match(helperSource, /const strongOwnedImages = safeImageNodes\.filter\(\(imageNode\) => \(/);
  assert.doesNotMatch(hookSource, /Array<any>|catch \(error: any\)/);

  assert.match(appSource, /import \{ usePptRuntime \} from '\.\/app\/usePptRuntime';/);
  assert.match(appSource, /const \{[\s\S]*buildPptPageAlias,[\s\S]*getOrderedPptNodeBundle,[\s\S]*resolvePptImageBlob,[\s\S]*tryOpenPptPreview,[\s\S]*handleExportPptPackageEditable,[\s\S]*handleExportPptxEditable,[\s\S]*handleDownloadPptComposite,[\s\S]*handleExportPptSinglePage,[\s\S]*handleEditPptTextFromLightbox,[\s\S]*handleSavePptEditablePages,[\s\S]*handleOpenPptDeckEditor,[\s\S]*handleOpenPptDeckEditorFromImage,[\s\S]*handleOpenPptStackPreview,[\s\S]*isPptDeckChildImageNode,[\s\S]*resolveCurrentPromptChildImages,[\s\S]*\} = usePptRuntime\(/);
  assert.match(appSource, /usePptRuntime\(\{[\s\S]*activeCanvasRef,[\s\S]*pickByDocumentLanguage,[\s\S]*setPreviewImages,[\s\S]*setPreviewInitialIndex,[\s\S]*setPptDeckEditor,[\s\S]*setPptStackPreview,[\s\S]*updateImageNode,[\s\S]*updatePromptNode,[\s\S]*\}\);/);
  assert.match(appSource, /tryOpenPptPreview,/);
  assert.match(appSource, /setPreviewInitialIndex,/);
  assert.match(appSource, /if \(tryOpenPptPreview\(imageId\)\) \{\s*return;\s*\}/);
  assert.doesNotMatch(appSource, /from '\.\/utils\/pptEditable';/);
  assert.doesNotMatch(appSource, /\bshowNoPptPagesWarning,\s*\n|\bparsePptOutlineLine,\s*\n|\brequirePptEditableExportBundle,\s*\n|\bsanitizePptFileSegment,\s*\n|\bresolvePptExportImageAsset,\s*\n/);
  assert.doesNotMatch(appSource, /const showNoPptPagesWarning = useCallback\(\(\) => \{/);
  assert.doesNotMatch(appSource, /const parsePptOutlineLine = useCallback\(\(raw\?: string\) => \{/);
  assert.doesNotMatch(appSource, /const buildPptPageAlias = useCallback\(\(raw: string \| undefined, pageIndex: number\) => \{/);
  assert.doesNotMatch(appSource, /function getOrderedPptPreviewBundle\(imageId: string\) \{/);
  assert.doesNotMatch(appSource, /const getOrderedPptNodeBundle = useCallback\(\(nodeOrId: PromptNode \| string\) => \{/);
  assert.doesNotMatch(appSource, /const getPptEditableExportBundle = useCallback\(\(node: PromptNode\) => \{/);
  assert.doesNotMatch(appSource, /const requirePptEditableExportBundle = useCallback\(\(node: PromptNode\) => \{/);
  assert.doesNotMatch(appSource, /const sanitizePptFileSegment = useCallback\(\(value: string, fallback: string\) => \{/);
  assert.doesNotMatch(appSource, /const renderBlobIntoImage = useCallback\(\(blob: Blob\) => \(/);
  assert.doesNotMatch(appSource, /const convertBlobToPng = useCallback\(async \(blob: Blob\) => \{/);
  assert.doesNotMatch(appSource, /const resolvePptImageBlob = useCallback\(\(image: GeneratedImage\) => \{/);
  assert.doesNotMatch(appSource, /const resolvePptExportImageAsset = useCallback\(async \(image: GeneratedImage\) => \{/);
  assert.doesNotMatch(appSource, /const renderPptEditablePagePreviewBlob = useCallback\(async \(page: PptEditablePage, imageById: Map<string, GeneratedImage>\) => \{/);
  assert.doesNotMatch(appSource, /const handleExportPptPackageEditable = useCallback\(async \(node: PromptNode\) => \{/);
  assert.doesNotMatch(appSource, /const handleExportPptxEditable = useCallback\(async \(node: PromptNode\) => \{/);
  assert.doesNotMatch(appSource, /const handleExportPptx = useCallback\(async \(node: PromptNode\) => \{/);
  assert.doesNotMatch(appSource, /const handleExportPptPackage = useCallback\(async \(node: PromptNode\) => \{/);
  assert.doesNotMatch(appSource, /const handleDownloadPptComposite = useCallback\(\(imageId: string\) => \{/);
  assert.doesNotMatch(appSource, /const handleExportPptSinglePage = useCallback\(async \(node: PromptNode, pageIndex: number\) => \{/);
  assert.doesNotMatch(appSource, /const handleEditPptTextFromLightbox = useCallback\(\(image: GeneratedImage\) => \{/);
  assert.doesNotMatch(appSource, /const handleSavePptEditablePages = useCallback\(\(nodeId: string, pages: PptEditablePage\[\]\) => \{/);
  assert.doesNotMatch(appSource, /const handleOpenPptDeckEditor = useCallback\(\(nodeOrId: PromptNode \| string, initialIndex = 0\) => \{/);
  assert.doesNotMatch(appSource, /const handleOpenPptDeckEditorFromImage = useCallback\(\(image: GeneratedImage\) => \{/);
  assert.doesNotMatch(appSource, /const handleOpenPptStackPreview = useCallback\(\(imageId: string\) => \{/);
  assert.doesNotMatch(appSource, /const isPptDeckChildImageNode = useCallback\(\(imageNode: GeneratedImage\) => \{/);
  assert.doesNotMatch(appSource, /const resolveCurrentPromptChildImages = useCallback\(\(\s*promptNode: PromptNode \| undefined \| null,\s*imageNodes: GeneratedImage\[\],\s*\) => \{/);

  [
    'renderBlobIntoImage',
    'convertBlobToPng',
    'tryOpenPptPreview',
    'resolvePptImageBlob',
    'resolvePptExportImageAsset',
    'renderPptEditablePagePreviewBlob',
    'handleExportPptPackageEditable',
    'handleExportPptxEditable',
    'handleExportPptx',
    'handleExportPptPackage',
    'handleDownloadPptComposite',
    'handleExportPptSinglePage',
    'handleEditPptTextFromLightbox',
    'handleSavePptEditablePages',
    'handleOpenPptDeckEditor',
    'handleOpenPptDeckEditorFromImage',
    'handleOpenPptStackPreview',
    'isPptDeckChildImageNode',
    'resolveCurrentPromptChildImages',
  ].forEach((name) => {
    assertAppDoesNotDefine(appSource, name);
  });
});
