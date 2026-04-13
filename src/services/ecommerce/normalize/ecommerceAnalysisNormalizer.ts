import type { EcommerceEditableTaskState, EcommerceTaskAssetRoleBinding } from '../../../types.ts';
import { resolveEcommerceAspectPolicy } from '../ecommerceModelPolicy.ts';
import { buildEcommerceRenderTask } from '../renderTaskBuilder.ts';
import { extractSeriesTemplateFromAnalysis } from '../seriesTemplateExtractor.ts';
import { mergeEcommerceTaskState } from '../taskMerger.ts';
import type {
  EcommerceAnalysisAPlusModule,
  EcommerceAnalysisAsset,
  EcommerceAnalysisMainImageItem,
  EcommerceAnalysisResult,
  OpenXmlParsedRow,
  OpenXmlParsedSheet,
  OpenXmlWorkbookParseResult,
} from '../types.ts';
import { resolveReferenceBindings } from '../xlsx/referenceBindingResolver.ts';

function findSheet(sheets: OpenXmlParsedSheet[], name: string): OpenXmlParsedSheet | undefined {
  return sheets.find((sheet) => sheet.name === name);
}

function readCell(row: OpenXmlParsedRow, column: string): string {
  return String(row.cells[column] || '').trim();
}

function buildReferenceAssets(parseResult: OpenXmlWorkbookParseResult): EcommerceAnalysisAsset[] {
  return parseResult.mediaAssets.map((asset, index) => ({
    assetId: asset.assetId,
    label: `参考图${index + 1}`,
    source: 'reference',
    sheetName: asset.sheetName as '主图' | 'A+' | undefined,
    rowIndex: asset.rowIndex,
    displayOrder: asset.displayOrder,
    previewUrl: asset.previewUrl,
    mimeType: asset.mimeType,
  }));
}

function getAssetsForRow(
  assets: EcommerceAnalysisAsset[],
  sheetName: '主图' | 'A+',
  rowIndex: number,
): EcommerceAnalysisAsset[] {
  return assets
    .filter((asset) => asset.sheetName === sheetName && asset.rowIndex === rowIndex)
    .sort((left, right) => left.displayOrder - right.displayOrder);
}

function extractProjectMeta(parseResult: OpenXmlWorkbookParseResult) {
  const mainSheet = findSheet(parseResult.sheets, '主图');
  const mainRows = mainSheet?.rows || [];
  const fallbackRow: OpenXmlParsedRow = { rowIndex: 0, cells: {}, referenceSlots: [] };
  const projectName = readCell(mainRows.find((row) => readCell(row, 'A') === '需求名称') || fallbackRow, 'D');
  const productName = readCell(mainRows.find((row) => readCell(row, 'A') === '产品名称') || fallbackRow, 'D');
  const defaultMainImageSizeHint = readCell(mainRows.find((row) => readCell(row, 'A') === '需求尺寸') || fallbackRow, 'D');

  return {
    projectName,
    productName,
    defaultMainImageSizeHint,
  };
}

function buildTaskAssetRoles(params: {
  rowAssets: EcommerceAnalysisAsset[];
  referenceMentions: Array<{ assetId: string; mentionTokens: string[]; notes?: string }>;
}): EcommerceTaskAssetRoleBinding[] {
  const productRole: EcommerceTaskAssetRoleBinding = {
    assetId: 'product-upload',
    role: 'product',
    label: '产品图',
    normalizedLabel: '产品图',
    source: 'upload',
  };

  const referenceRoles = params.rowAssets.map((asset, index) => {
    const mention = params.referenceMentions.find((item) => item.assetId === asset.assetId) || params.referenceMentions[index];
    return {
      assetId: asset.assetId,
      role: 'reference' as const,
      label: asset.label,
      normalizedLabel: asset.label || `参考图${index + 1}`,
      source: 'analysis' as const,
      note: mention?.notes,
      mentionTokens: mention?.mentionTokens,
    };
  });

  return [productRole, ...referenceRoles];
}

function buildBaseTaskState(params: {
  taskId: string;
  sourceKind: EcommerceEditableTaskState['sourceKind'];
  sourceSheet: EcommerceEditableTaskState['sourceSheet'];
  sourceRowKey: string;
  theme: string;
  outputTypeLabel: string;
  sparseIntent: string;
  assetRoles: EcommerceTaskAssetRoleBinding[];
  seriesTemplate: EcommerceAnalysisResult['seriesTemplate'];
}): EcommerceEditableTaskState {
  return mergeEcommerceTaskState({
    baseTask: {
      taskId: params.taskId,
      templateId: params.seriesTemplate.templateId,
      sourceKind: params.sourceKind,
      sourceSheet: params.sourceSheet,
      sourceRowKey: params.sourceRowKey,
      theme: params.theme,
      outputTypeLabel: params.outputTypeLabel,
      imageRoleSummary: params.assetRoles.map((item) => item.normalizedLabel),
      sparseUserIntent: params.sparseIntent,
      copy: {
        headline: '',
        subheadline: '',
        highlight: '',
        featureTags: [],
        cta: '',
      },
      style: {
        tone: '',
        atmosphere: '',
        effect: '',
        backgroundType: '',
      },
      layout: {
        productSize: 'balanced',
        textPosition: 'top-left',
        accessoryPolicy: 'auto',
      },
      inherit: {
        keepSeriesStyle: true,
        keepFontStyle: true,
        keepLayoutStyle: true,
        keepCopyStyle: true,
        keepPalette: true,
      },
      assetRoles: params.assetRoles,
      consistencyChecks: [],
      missingFields: [],
      resolvedPromptPreview: '',
      displayLabel: '',
    },
    seriesTemplate: params.seriesTemplate,
    sparseIntent: params.sparseIntent,
  });
}

function buildDraftAnalysisForTemplate(
  parseResult: OpenXmlWorkbookParseResult,
  referenceAssets: EcommerceAnalysisAsset[],
  projectMeta: ReturnType<typeof extractProjectMeta>,
  modelId: string,
): EcommerceAnalysisResult {
  const mainSheet = findSheet(parseResult.sheets, '主图');
  const aPlusSheet = findSheet(parseResult.sheets, 'A+');

  const mainImageItems: EcommerceAnalysisMainImageItem[] = (mainSheet?.rows || [])
    .filter((row) => Number(readCell(row, 'A')) > 0 && readCell(row, 'B'))
    .map((row) => ({
      itemId: `main-${readCell(row, 'A') || row.rowIndex}`,
      sheet: '主图',
      rowIndex: row.rowIndex,
      sequence: Number(readCell(row, 'A') || row.rowIndex),
      type: readCell(row, 'B'),
      angle: readCell(row, 'C'),
      theme: readCell(row, 'D'),
      designRequirements: readCell(row, 'E'),
      copyText: readCell(row, 'G'),
      sizePolicy: resolveEcommerceAspectPolicy({ kind: 'main-image', modelId }).sizePolicy,
      referenceAssetIds: getAssetsForRow(referenceAssets, '主图', row.rowIndex).map((asset) => asset.assetId),
      referenceMentions: [],
      productAssetRequired: true,
      promptDraft: '',
      needsReview: false,
      reviewWarnings: [],
    }));

  const modules: EcommerceAnalysisAPlusModule[] = (aPlusSheet?.rows || [])
    .filter((row) => {
      const moduleCell = readCell(row, 'A');
      return /^模块/i.test(moduleCell) && moduleCell !== '模块' && readCell(row, 'B') !== '类型';
    })
    .map((row) => {
      const policy = resolveEcommerceAspectPolicy({
        kind: 'a-plus-module',
        modelId,
        declaredDimensions: readCell(row, 'C'),
        designRequirements: readCell(row, 'E'),
        copyText: readCell(row, 'G'),
      });

      return {
        moduleId: `aplus-${row.rowIndex}`,
        sheet: 'A+',
        rowIndex: row.rowIndex,
        moduleName: readCell(row, 'A'),
        type: readCell(row, 'B'),
        declaredSizeText: readCell(row, 'C'),
        angle: readCell(row, 'D'),
        sellingPoints: readCell(row, 'F'),
        designRequirements: readCell(row, 'E'),
        copyText: readCell(row, 'G'),
        sizePolicy: policy.sizePolicy,
        referenceAssetIds: getAssetsForRow(referenceAssets, 'A+', row.rowIndex).map((asset) => asset.assetId),
        referenceMentions: [],
        productAssetRequired: true,
        promptDraft: '',
        needsReview: false,
        reviewWarnings: [],
      };
    });

  return {
    seriesTemplate: {
      templateId: 'pending-template',
      templateLabel: projectMeta.projectName || projectMeta.productName || '电商套系',
      inheritByDefault: true,
      styleProfile: {
        tone: '统一套系风格',
        primaryColors: [],
        backgroundStyle: '干净商业背景',
        effectStyle: '轻量商业特效',
        shadowStyle: 'soft clean shadow',
        atmosphere: '明亮干净',
      },
      layoutProfile: {
        productPosition: 'center-right',
        textPosition: 'top-left',
        highlightPosition: 'left-middle',
        accessoryPosition: 'bottom-right',
        whitespaceStyle: 'clean spacious',
        productScalePreset: 'balanced',
      },
      copyProfile: {
        languageStyle: 'short commercial phrases',
        headlineStyle: '2-4 words',
        subheadlineStyle: '1 short sentence',
        highlightStyle: 'large numeric value',
        tone: 'direct, feature-led',
        preferredLanguage: 'mixed',
      },
      fontProfile: {
        fontStyle: 'sans bold clean',
        headlineWeight: 700,
        subheadlineWeight: 500,
        highlightWeight: 800,
        headlineScale: 1,
        subheadlineScale: 0.55,
        highlightScale: 1.35,
        textColorPrimary: '#FFFFFF',
        textColorSecondary: '#1E2B36',
      },
      constraints: {
        mustKeepConsistency: true,
        forbiddenElements: ['people'],
        mustKeepProductRealistic: true,
        allowedOverrides: ['tone', 'effect', 'productScale', 'copy'],
      },
    },
    projectMeta: {
      projectName: projectMeta.projectName,
      productName: projectMeta.productName,
      sourceFileName: parseResult.sourceFileName,
      sourceFileType: parseResult.sourceFileType,
      defaultMainImageSizeHint: projectMeta.defaultMainImageSizeHint,
      warnings: [],
    },
    assets: {
      productAssets: [],
      referenceAssets,
    },
    mainImageItems,
    aPlusGroup: {
      groupId: 'aplus-group',
      title: `${projectMeta.productName || 'A+'} A+ 模块`,
      modules,
      groupWarnings: [],
    },
    reviewWarnings: [],
  };
}

function normalizeMainImageItems(
  sheet: OpenXmlParsedSheet | undefined,
  assets: EcommerceAnalysisAsset[],
  modelId: string,
  seriesTemplate: EcommerceAnalysisResult['seriesTemplate'],
): EcommerceAnalysisMainImageItem[] {
  if (!sheet) return [];

  return sheet.rows
    .filter((row) => Number(readCell(row, 'A')) > 0 && readCell(row, 'B'))
    .map((row) => {
      const rowAssets = getAssetsForRow(assets, '主图', row.rowIndex);
      const binding = resolveReferenceBindings({
        assets: rowAssets.map((asset) => ({
          assetId: asset.assetId,
          fileName: asset.label,
          mimeType: asset.mimeType || 'image/png',
          previewUrl: asset.previewUrl || '',
          displayOrder: asset.displayOrder,
          rowIndex: asset.rowIndex,
          sheetName: asset.sheetName,
        })),
        designRequirements: readCell(row, 'E'),
        copyText: readCell(row, 'G'),
      });
      const policy = resolveEcommerceAspectPolicy({ kind: 'main-image', modelId });
      const taskState = buildBaseTaskState({
        taskId: `task-main-${readCell(row, 'A') || row.rowIndex}`,
        sourceKind: 'main-image',
        sourceSheet: '主图',
        sourceRowKey: `main-${readCell(row, 'A') || row.rowIndex}`,
        theme: readCell(row, 'D') || readCell(row, 'B'),
        outputTypeLabel: '主图',
        sparseIntent: [readCell(row, 'G'), readCell(row, 'E')].filter(Boolean).join('；'),
        assetRoles: buildTaskAssetRoles({
          rowAssets,
          referenceMentions: binding.mentions,
        }),
        seriesTemplate,
      });
      const renderTask = buildEcommerceRenderTask({
        taskState,
        seriesTemplate,
        aspectRatio: policy.defaultAspectRatio,
        imageSize: '4K',
      });

      return {
        itemId: `main-${readCell(row, 'A') || row.rowIndex}`,
        sheet: '主图',
        rowIndex: row.rowIndex,
        sequence: Number(readCell(row, 'A') || row.rowIndex),
        type: readCell(row, 'B'),
        angle: readCell(row, 'C'),
        theme: readCell(row, 'D'),
        designRequirements: readCell(row, 'E'),
        copyText: readCell(row, 'G'),
        sizePolicy: policy.sizePolicy,
        referenceAssetIds: rowAssets.map((asset) => asset.assetId),
        referenceMentions: binding.mentions,
        productAssetRequired: true,
        promptDraft: renderTask.prompt,
        resolvedPromptPreview: renderTask.prompt,
        editableTask: taskState,
        needsReview: binding.needsReview,
        reviewWarnings: binding.reviewWarnings,
      };
    });
}

function normalizeAPlusModules(
  sheet: OpenXmlParsedSheet | undefined,
  assets: EcommerceAnalysisAsset[],
  modelId: string,
  seriesTemplate: EcommerceAnalysisResult['seriesTemplate'],
): EcommerceAnalysisAPlusModule[] {
  if (!sheet) return [];

  return sheet.rows
    .filter((row) => {
      const moduleCell = readCell(row, 'A');
      return /^模块/i.test(moduleCell) && moduleCell !== '模块' && readCell(row, 'B') !== '类型';
    })
    .map((row) => {
      const rowAssets = getAssetsForRow(assets, 'A+', row.rowIndex);
      const binding = resolveReferenceBindings({
        assets: rowAssets.map((asset) => ({
          assetId: asset.assetId,
          fileName: asset.label,
          mimeType: asset.mimeType || 'image/png',
          previewUrl: asset.previewUrl || '',
          displayOrder: asset.displayOrder,
          rowIndex: asset.rowIndex,
          sheetName: asset.sheetName,
        })),
        designRequirements: readCell(row, 'E'),
        copyText: readCell(row, 'G'),
      });
      const policy = resolveEcommerceAspectPolicy({
        kind: 'a-plus-module',
        modelId,
        declaredDimensions: readCell(row, 'C'),
        designRequirements: readCell(row, 'E'),
        copyText: readCell(row, 'G'),
      });
      const taskState = buildBaseTaskState({
        taskId: `task-aplus-${row.rowIndex}`,
        sourceKind: 'a-plus-module',
        sourceSheet: 'A+',
        sourceRowKey: `aplus-${row.rowIndex}`,
        theme: readCell(row, 'A'),
        outputTypeLabel: 'A+',
        sparseIntent: [readCell(row, 'G'), readCell(row, 'E')].filter(Boolean).join('；'),
        assetRoles: buildTaskAssetRoles({
          rowAssets,
          referenceMentions: binding.mentions,
        }),
        seriesTemplate,
      });
      const renderTask = buildEcommerceRenderTask({
        taskState,
        seriesTemplate,
        aspectRatio: policy.defaultAspectRatio,
        imageSize: '4K',
      });

      return {
        moduleId: `aplus-${row.rowIndex}`,
        sheet: 'A+',
        rowIndex: row.rowIndex,
        moduleName: readCell(row, 'A'),
        type: readCell(row, 'B'),
        declaredSizeText: readCell(row, 'C'),
        angle: readCell(row, 'D'),
        sellingPoints: readCell(row, 'F'),
        designRequirements: readCell(row, 'E'),
        copyText: readCell(row, 'G'),
        sizePolicy: policy.sizePolicy,
        referenceAssetIds: rowAssets.map((asset) => asset.assetId),
        referenceMentions: binding.mentions,
        productAssetRequired: true,
        promptDraft: renderTask.prompt,
        resolvedPromptPreview: renderTask.prompt,
        editableTask: taskState,
        needsReview: binding.needsReview,
        reviewWarnings: binding.reviewWarnings,
      };
    });
}

export function normalizeEcommerceAnalysis(
  parseResult: OpenXmlWorkbookParseResult,
  modelId: string,
): EcommerceAnalysisResult {
  const referenceAssets = buildReferenceAssets(parseResult);
  const projectMeta = extractProjectMeta(parseResult);
  const draftAnalysis = buildDraftAnalysisForTemplate(parseResult, referenceAssets, projectMeta, modelId);
  const seriesTemplate = extractSeriesTemplateFromAnalysis(draftAnalysis);
  const mainSheet = findSheet(parseResult.sheets, '主图');
  const aPlusSheet = findSheet(parseResult.sheets, 'A+');
  const mainImageItems = normalizeMainImageItems(mainSheet, referenceAssets, modelId, seriesTemplate);
  const modules = normalizeAPlusModules(aPlusSheet, referenceAssets, modelId, seriesTemplate);
  const reviewWarnings = [
    ...mainImageItems.flatMap((item) => item.reviewWarnings),
    ...modules.flatMap((module) => module.reviewWarnings),
  ];

  return {
    seriesTemplate,
    projectMeta: {
      projectName: projectMeta.projectName,
      productName: projectMeta.productName,
      sourceFileName: parseResult.sourceFileName,
      sourceFileType: parseResult.sourceFileType,
      defaultMainImageSizeHint: projectMeta.defaultMainImageSizeHint,
      warnings: reviewWarnings,
    },
    assets: {
      productAssets: [],
      referenceAssets,
    },
    mainImageItems,
    aPlusGroup: {
      groupId: 'aplus-group',
      title: `${projectMeta.productName || 'A+'} A+ 模块`,
      modules,
      groupWarnings: modules.flatMap((module) => module.reviewWarnings),
    },
    reviewWarnings,
  };
}
