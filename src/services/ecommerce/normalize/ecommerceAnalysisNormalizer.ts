import { resolveEcommerceAspectPolicy } from '../ecommerceModelPolicy.ts';
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

function getAssetsForRow(assets: EcommerceAnalysisAsset[], sheetName: '主图' | 'A+', rowIndex: number): EcommerceAnalysisAsset[] {
  return assets
    .filter((asset) => asset.sheetName === sheetName && asset.rowIndex === rowIndex)
    .sort((left, right) => left.displayOrder - right.displayOrder);
}

function compilePrompt(params: {
  kindLabel: string;
  theme: string;
  angle: string;
  designRequirements: string;
  copyText: string;
  referenceMentions: string[];
}): string {
  return [
    `${params.kindLabel}：${params.theme || '未命名需求'}`,
    params.angle ? `产品角度：${params.angle}` : '',
    params.designRequirements ? `设计要求：${params.designRequirements}` : '',
    params.copyText ? `文案替换：${params.copyText}` : '',
    '产品主体必须严格按照用户上传的产品图执行，保持造型、比例、颜色和关键结构一致。',
    params.referenceMentions.length > 0 ? `参考图说明：${params.referenceMentions.join('；')}` : '',
  ].filter(Boolean).join('\n');
}

function readCell(row: OpenXmlParsedRow, column: string): string {
  return String(row.cells[column] || '').trim();
}

function normalizeMainImageItems(sheet: OpenXmlParsedSheet | undefined, assets: EcommerceAnalysisAsset[], modelId: string): EcommerceAnalysisMainImageItem[] {
  if (!sheet) return [];
  const dataRows = sheet.rows.filter((row) => Number(readCell(row, 'A')) > 0 && readCell(row, 'B'));
  return dataRows.map((row) => {
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
      promptDraft: compilePrompt({
        kindLabel: '主图',
        theme: readCell(row, 'D'),
        angle: readCell(row, 'C'),
        designRequirements: readCell(row, 'E'),
        copyText: readCell(row, 'G'),
        referenceMentions: binding.mentions.map((item) => `${item.label}${item.notes ? `（${item.notes}）` : ''}`),
      }),
      needsReview: binding.needsReview,
      reviewWarnings: binding.reviewWarnings,
    };
  });
}

function normalizeAPlusModules(sheet: OpenXmlParsedSheet | undefined, assets: EcommerceAnalysisAsset[], modelId: string): EcommerceAnalysisAPlusModule[] {
  if (!sheet) return [];
  const dataRows = sheet.rows.filter((row) => {
    const moduleCell = readCell(row, 'A');
    return /^模块/i.test(moduleCell) && moduleCell !== '模块' && readCell(row, 'B') !== '类型';
  });
  return dataRows.map((row) => {
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
      promptDraft: compilePrompt({
        kindLabel: 'A+模块',
        theme: readCell(row, 'A'),
        angle: readCell(row, 'D'),
        designRequirements: readCell(row, 'E'),
        copyText: readCell(row, 'G'),
        referenceMentions: binding.mentions.map((item) => `${item.label}${item.notes ? `（${item.notes}）` : ''}`),
      }),
      needsReview: binding.needsReview,
      reviewWarnings: binding.reviewWarnings,
    };
  });
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

export function normalizeEcommerceAnalysis(parseResult: OpenXmlWorkbookParseResult, modelId: string): EcommerceAnalysisResult {
  const referenceAssets = buildReferenceAssets(parseResult);
  const mainSheet = findSheet(parseResult.sheets, '主图');
  const aPlusSheet = findSheet(parseResult.sheets, 'A+');
  const projectMeta = extractProjectMeta(parseResult);
  const mainImageItems = normalizeMainImageItems(mainSheet, referenceAssets, modelId);
  const modules = normalizeAPlusModules(aPlusSheet, referenceAssets, modelId);
  const reviewWarnings = [
    ...mainImageItems.flatMap((item) => item.reviewWarnings),
    ...modules.flatMap((module) => module.reviewWarnings),
  ];

  return {
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
