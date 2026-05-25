import type { EcommerceEditableTaskState, EcommerceTaskAssetRoleBinding } from '../../../types.ts';
import { resolveEcommerceAspectPolicy } from '../ecommerceModelPolicy.ts';
import { buildEcommerceRenderTask } from '../renderTaskBuilder.ts';
import { buildEcommerceAssetRoleBindings } from '../assetRoleBindings.ts';
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

const CANONICAL_MAIN_SHEET = '主图' as const;
const CANONICAL_APLUS_SHEET = 'A+' as const;

function findSheet(sheets: OpenXmlParsedSheet[], name: string): OpenXmlParsedSheet | undefined {
  return sheets.find((sheet) => sheet.name === name);
}

function readCell(row: OpenXmlParsedRow, column: string): string {
  return String(row.cells[column] || '').trim();
}

type MainSheetColumnKey =
  | 'sequence'
  | 'type'
  | 'angle'
  | 'theme'
  | 'sellingPoints'
  | 'designRequirements'
  | 'referenceNotes'
  | 'copyZh'
  | 'copyEn'
  | 'copyGeneric';

type APlusSheetColumnKey =
  | 'sequence'
  | 'moduleName'
  | 'type'
  | 'declaredSizeText'
  | 'angle'
  | 'sellingPoints'
  | 'designRequirements'
  | 'referenceNotes'
  | 'copyZh'
  | 'copyEn'
  | 'copyGeneric';

type SheetColumnKey = MainSheetColumnKey | APlusSheetColumnKey;

type SheetHeaderDefinition = {
  key: SheetColumnKey;
  patterns: string[];
};

type SheetSchema = {
  headerRowIndex: number;
  columns: Partial<Record<SheetColumnKey, string>>;
};

type MainRowCandidate = {
  itemKey: string;
  row: OpenXmlParsedRow;
  sequence: number;
  type: string;
  angle: string;
  theme: string;
  designRequirements: string;
  referenceNotes: string;
  copyText: string;
};

type APlusRowCandidate = {
  moduleKey: string;
  row: OpenXmlParsedRow;
  moduleName: string;
  type: string;
  declaredSizeText: string;
  angle: string;
  sellingPoints: string;
  designRequirements: string;
  referenceNotes: string;
  copyText: string;
};

const MAIN_SHEET_HEADER_DEFINITIONS: SheetHeaderDefinition[] = [
  { key: 'copyZh', patterns: ['文案中文', '中文文案'] },
  { key: 'copyEn', patterns: ['文案英文', '英文文案'] },
  { key: 'sequence', patterns: ['序号', '编号', '序列', 'no', 'number', 'sequence', 'seq', 'index'] },
  { key: 'designRequirements', patterns: ['设计要求', '设计需求', '设计说明', '画面要求', '需求描述', 'designrequirements', 'designbrief', 'creativebrief', 'requirements', 'brief', 'prompt', 'description'] },
  { key: 'sellingPoints', patterns: ['卖点', '亮点', '核心卖点', 'sellingpoints', 'sellingpoint', 'features', 'feature', 'benefits'] },
  { key: 'theme', patterns: ['主题', '场景主题', '风格主题', 'theme', 'scene', 'concept'] },
  { key: 'angle', patterns: ['角度', '产品角度', '镜头', 'angle', 'view', 'productangle'] },
  { key: 'type', patterns: ['类型', '画面类型', '版式类型', 'imagetype', 'type', 'outputtype', 'deliverable'] },
  { key: 'referenceNotes', patterns: ['参考', '图片参考', '参考图', '参考图片', 'reference', 'referenceimage', 'referenceimages'] },
  { key: 'copyGeneric', patterns: ['文案', '标题文案', 'copy', 'headline', 'text', 'caption'] },
];

const APLUS_SHEET_HEADER_DEFINITIONS: SheetHeaderDefinition[] = [
  { key: 'sequence', patterns: ['序号', '编号', '序列', 'no', 'number', 'sequence', 'seq', 'index'] },
  { key: 'copyZh', patterns: ['文案中文', '中文文案'] },
  { key: 'copyEn', patterns: ['文案英文', '英文文案'] },
  { key: 'declaredSizeText', patterns: ['图片尺寸', '模块尺寸', '尺寸', '画布尺寸', 'size', 'dimensions', 'dimension', 'pixels', 'px'] },
  { key: 'designRequirements', patterns: ['图片要求', '设计要求', '设计需求', '设计说明', '画面要求', '需求描述', 'designrequirements', 'designbrief', 'creativebrief', 'requirements', 'brief', 'prompt', 'description'] },
  { key: 'sellingPoints', patterns: ['产品卖点', '卖点', '亮点', '核心卖点', 'sellingpoints', 'sellingpoint', 'features', 'feature', 'benefits'] },
  { key: 'moduleName', patterns: ['模块名称', '模块名', '模块', '版块', 'module', 'modulename', 'section', 'sectionname'] },
  { key: 'angle', patterns: ['产品角度', '角度', '镜头', 'angle', 'view', 'productangle'] },
  { key: 'type', patterns: ['图片内容', '内容', '类型', '模块类型', '版式类型', 'type', 'moduletype', 'sectiontype', 'bannerkind'] },
  { key: 'referenceNotes', patterns: ['参考', '图片参考', '参考图', '参考图1', '参考图片', 'reference', 'referenceimage', 'referenceimages'] },
  { key: 'copyGeneric', patterns: ['文案', '标题文案', 'copy', 'headline', 'text', 'caption'] },
];

function normalizeLabelToken(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\r\n\t]+/g, '')
    .replace(/[()（）【】\[\]<>《》:：/\\\-_.，。,;；·•]/g, '');
}

function columnRefToIndex(columnRef: string): number {
  return String(columnRef || '')
    .toUpperCase()
    .split('')
    .reduce((sum, char) => sum * 26 + (char.charCodeAt(0) - 64), 0);
}

function getOrderedCells(row: OpenXmlParsedRow): Array<[string, string]> {
  return Object.entries(row.cells).sort(
    ([leftColumn], [rightColumn]) => columnRefToIndex(leftColumn) - columnRefToIndex(rightColumn),
  );
}

function resolveHeaderKey(value: string, definitions: SheetHeaderDefinition[]): SheetColumnKey | null {
  const normalizedValue = normalizeLabelToken(value);
  if (!normalizedValue) return null;

  for (const definition of definitions) {
    if (definition.patterns.some((pattern) => normalizedValue.includes(pattern))) {
      return definition.key;
    }
  }

  return null;
}

function detectSheetSchema(
  sheet: OpenXmlParsedSheet | undefined,
  definitions: SheetHeaderDefinition[],
): SheetSchema | null {
  if (!sheet) return null;

  let bestSchema: SheetSchema | null = null;
  let bestScore = 0;

  for (const row of sheet.rows.slice(0, 60)) {
    const columns: Partial<Record<SheetColumnKey, string>> = {};
    let score = 0;

    for (const [columnRef, value] of getOrderedCells(row)) {
      const key = resolveHeaderKey(value, definitions);
      if (!key || columns[key]) continue;
      columns[key] = columnRef;
      score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestSchema = {
        headerRowIndex: row.rowIndex,
        columns,
      };
    }
  }

  return bestScore >= 3 ? bestSchema : null;
}

function normalizeSheetRoleToken(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[+＋]/g, 'plus')
    .replace(/[\s\r\n\t_./\\\-()（）【】\[\]<>《》:：，。,;；·•]+/g, '');
}

function countSchemaColumns(schema: SheetSchema | null): number {
  return Object.keys(schema?.columns || {}).length;
}

function scoreSheetNameForRole(sheetName: string, role: 'main' | 'aplus'): number {
  const token = normalizeSheetRoleToken(sheetName);
  const aliases = role === 'main'
    ? ['主图', 'main', 'mainimage', 'mainimages', 'hero', 'listing', 'listingimage', 'productimage']
    : ['aplus', 'a+', '详情', '详情页', '模块', 'module', 'modules', 'detail', 'details', 'enhancedbrandcontent'];

  return aliases.some((alias) => token.includes(normalizeSheetRoleToken(alias))) ? 8 : 0;
}

function findSheetByRole(
  sheets: OpenXmlParsedSheet[],
  role: 'main' | 'aplus',
): OpenXmlParsedSheet | undefined {
  const definitions = role === 'main'
    ? MAIN_SHEET_HEADER_DEFINITIONS
    : APLUS_SHEET_HEADER_DEFINITIONS;

  const scoredSheets = sheets
    .map((sheet) => {
      const schemaScore = countSchemaColumns(detectSheetSchema(sheet, definitions));
      return {
        sheet,
        score: scoreSheetNameForRole(sheet.name, role) + schemaScore,
      };
    })
    .sort((left, right) => right.score - left.score);

  const best = scoredSheets[0];
  return best && best.score >= 3 ? best.sheet : undefined;
}

function findMainSheet(sheets: OpenXmlParsedSheet[]): OpenXmlParsedSheet | undefined {
  return findSheet(sheets, CANONICAL_MAIN_SHEET) || findSheetByRole(sheets, 'main');
}

function findAPlusSheet(sheets: OpenXmlParsedSheet[]): OpenXmlParsedSheet | undefined {
  return findSheet(sheets, CANONICAL_APLUS_SHEET) || findSheetByRole(sheets, 'aplus');
}

function readSchemaCell(
  row: OpenXmlParsedRow,
  schema: SheetSchema | null,
  key: SheetColumnKey,
  fallbackColumns: string[] = [],
): string {
  const preferredColumn = schema?.columns[key];
  if (preferredColumn) {
    const preferredValue = readCell(row, preferredColumn);
    if (preferredValue) {
      return preferredValue;
    }
  }

  for (const column of fallbackColumns) {
    const fallbackValue = readCell(row, column);
    if (fallbackValue) {
      return fallbackValue;
    }
  }

  return '';
}

function joinUniqueText(parts: string[]): string {
  return Array.from(
    new Set(parts.map((part) => String(part || '').trim()).filter(Boolean)),
  ).join('\n');
}

function dedupeWarnings(warnings: string[]): string[] {
  return Array.from(new Set(warnings.map((warning) => String(warning || '').trim()).filter(Boolean)));
}

function looksLikeNumericSequence(value: string): boolean {
  return /^\d+(?:\.0+)?$/.test(String(value || '').trim());
}

function looksLikeDimensionText(value: string): boolean {
  return /\d+\s*(?:\*|x|×)\s*\d+/i.test(String(value || '').trim());
}

function findMetaValue(rows: OpenXmlParsedRow[], labels: string[], fallbackColumn: string): string {
  const normalizedLabels = labels.map((label) => normalizeLabelToken(label));

  for (const row of rows) {
    const orderedCells = getOrderedCells(row);
    const labelIndex = orderedCells.findIndex(([, value]) => {
      const normalizedValue = normalizeLabelToken(value);
      return normalizedLabels.some((label) => normalizedValue === label);
    });

    if (labelIndex === -1) continue;

    const inlineValue = orderedCells
      .slice(labelIndex + 1)
      .map(([, value]) => String(value || '').trim())
      .find(Boolean);
    if (inlineValue) {
      return inlineValue;
    }

    const fallbackValue = readCell(row, fallbackColumn);
    if (fallbackValue) {
      return fallbackValue;
    }
  }

  return '';
}

function buildReferenceAssets(parseResult: OpenXmlWorkbookParseResult): EcommerceAnalysisAsset[] {
  const mainSheetName = findMainSheet(parseResult.sheets)?.name;
  const aPlusSheetName = findAPlusSheet(parseResult.sheets)?.name;

  return parseResult.mediaAssets.map((asset, index) => ({
    assetId: asset.assetId,
    label: `参考图${index + 1}`,
    source: 'reference',
    sheetName: asset.sheetName === CANONICAL_MAIN_SHEET
      ? CANONICAL_MAIN_SHEET
      : asset.sheetName === CANONICAL_APLUS_SHEET
        ? CANONICAL_APLUS_SHEET
        : asset.sheetName === aPlusSheetName && aPlusSheetName !== mainSheetName
          ? CANONICAL_APLUS_SHEET
          : asset.sheetName === mainSheetName
            ? CANONICAL_MAIN_SHEET
            : asset.sheetName === aPlusSheetName
              ? CANONICAL_APLUS_SHEET
              : asset.sheetName as '主图' | 'A+' | undefined,
    rowIndex: asset.rowIndex,
    anchorRowIndex: asset.anchorRowIndex,
    anchorColRef: asset.anchorColRef,
    displayOrder: asset.displayOrder,
    previewUrl: asset.previewUrl,
    mimeType: asset.mimeType,
  }));
}

function getAssetsForRow(
  assets: EcommerceAnalysisAsset[],
  sheetName: '主图' | 'A+',
  rowIndex: number,
  assetRowAssignments?: Map<string, number>,
): EcommerceAnalysisAsset[] {
  return assets
    .filter((asset) => {
      if (asset.sheetName !== sheetName) return false;
      const resolvedRowIndex = assetRowAssignments?.get(asset.assetId) ?? asset.rowIndex;
      return resolvedRowIndex === rowIndex;
    })
    .sort((left, right) => left.displayOrder - right.displayOrder);
}

function extractProjectMeta(parseResult: OpenXmlWorkbookParseResult) {
  const mainSheet = findMainSheet(parseResult.sheets);
  const mainRows = mainSheet?.rows || [];
  const projectName = findMetaValue(mainRows, ['需求名称', 'Project Name', 'Project', 'Requirement Name'], 'D');
  const productName = findMetaValue(mainRows, ['产品名称', 'Product Name', 'Product'], 'D');
  const defaultMainImageSizeHint = findMetaValue(mainRows, ['需求尺寸', '图片尺寸', 'Image Size', 'Default Size', 'Size'], 'D');

  return {
    projectName,
    productName,
    defaultMainImageSizeHint,
  };
}

function resolveOwningRowIndex(targetRowIndex: number, candidateRowIndices: number[]): number | undefined {
  if (candidateRowIndices.length === 0) return undefined;

  const precedingCandidates = candidateRowIndices.filter((candidateRowIndex) => candidateRowIndex <= targetRowIndex);
  if (precedingCandidates.length > 0) {
    return precedingCandidates[precedingCandidates.length - 1];
  }

  return candidateRowIndices[0];
}

function resolveAssetRowAssignments(
  assets: EcommerceAnalysisAsset[],
  sheetName: '主图' | 'A+',
  candidateRowIndices: number[],
): Map<string, number> {
  const sortedRowIndices = [...candidateRowIndices].sort((left, right) => left - right);
  const assignments = new Map<string, number>();

  if (sortedRowIndices.length === 0) {
    return assignments;
  }

  for (const asset of assets) {
    if (asset.sheetName !== sheetName) continue;

    const directRowIndex = asset.rowIndex;
    if (directRowIndex && sortedRowIndices.includes(directRowIndex)) {
      assignments.set(asset.assetId, directRowIndex);
      continue;
    }

    const anchorRowIndex = asset.anchorRowIndex ?? asset.rowIndex;
    if (!anchorRowIndex) continue;

    const owningRowIndex = resolveOwningRowIndex(anchorRowIndex, sortedRowIndices);
    if (owningRowIndex !== undefined) {
      assignments.set(asset.assetId, owningRowIndex);
    }
  }

  return assignments;
}

function extractMainRowCandidates(sheet: OpenXmlParsedSheet | undefined): MainRowCandidate[] {
  if (!sheet) return [];

  const schema = detectSheetSchema(sheet, MAIN_SHEET_HEADER_DEFINITIONS);
  const headerRowIndex = schema?.headerRowIndex ?? 0;
  let implicitSequence = 0;

  return sheet.rows
    .filter((row) => row.rowIndex > headerRowIndex)
    .map((row) => {
      const type = readSchemaCell(row, schema, 'type', ['B', 'A']);
      const angle = readSchemaCell(row, schema, 'angle', ['C', 'B']);
      const sellingPoints = readSchemaCell(row, schema, 'sellingPoints', ['C']);
      const designRequirements = readSchemaCell(row, schema, 'designRequirements', ['E', 'D']);
      const referenceNotes = readSchemaCell(row, schema, 'referenceNotes');
      const copyText = joinUniqueText([
        readSchemaCell(row, schema, 'copyZh', schema ? [] : ['G', 'E']),
        readSchemaCell(row, schema, 'copyEn', schema ? [] : ['F']),
        readSchemaCell(row, schema, 'copyGeneric', schema ? [] : ['G', 'F', 'E']),
      ]);
      const theme = readSchemaCell(row, schema, 'theme') || sellingPoints || type;
      const sequenceText = readSchemaCell(row, schema, 'sequence', ['A']);
      const parsedSequence = Number(sequenceText);
      const hasMeaningfulContent = [type, angle, sellingPoints, designRequirements, copyText]
        .filter(Boolean)
        .length >= 2;

      if (!hasMeaningfulContent) {
        return null;
      }

      implicitSequence += 1;
      const sequence = Number.isFinite(parsedSequence) && parsedSequence > 0
        ? parsedSequence
        : implicitSequence;

      return {
        itemKey: `main-${Number.isFinite(parsedSequence) && parsedSequence > 0 ? parsedSequence : row.rowIndex}`,
        row,
        sequence,
        type,
        angle,
        theme,
        designRequirements,
        referenceNotes,
        copyText,
      };
    })
    .filter((row): row is MainRowCandidate => Boolean(row));
}

function extractAPlusRowCandidates(sheet: OpenXmlParsedSheet | undefined): APlusRowCandidate[] {
  if (!sheet) return [];

  const schema = detectSheetSchema(sheet, APLUS_SHEET_HEADER_DEFINITIONS);
  const headerRowIndex = schema?.headerRowIndex ?? 0;
  let implicitModuleCount = 0;

  return sheet.rows
    .filter((row) => row.rowIndex > headerRowIndex)
    .map((row) => {
      let moduleName = readSchemaCell(row, schema, 'moduleName', schema ? [] : ['A']);
      let type = readSchemaCell(row, schema, 'type', schema ? [] : ['B']);
      let declaredSizeText = readSchemaCell(row, schema, 'declaredSizeText', schema ? [] : ['C']);
      let angle = readSchemaCell(row, schema, 'angle', schema ? [] : ['D']);
      let designRequirements = readSchemaCell(row, schema, 'designRequirements', schema ? [] : ['E']);
      let sellingPoints = readSchemaCell(row, schema, 'sellingPoints', schema ? [] : ['F']);
      let referenceNotes = readSchemaCell(row, schema, 'referenceNotes');
      let copyText = joinUniqueText([
        readSchemaCell(row, schema, 'copyZh', schema ? [] : ['G']),
        readSchemaCell(row, schema, 'copyEn'),
        readSchemaCell(row, schema, 'copyGeneric', schema ? [] : ['G']),
      ]);

      if (looksLikeNumericSequence(moduleName) && readCell(row, 'C') && looksLikeDimensionText(readCell(row, 'D'))) {
        moduleName = readCell(row, 'C');
        declaredSizeText = readCell(row, 'D');
        type = readCell(row, 'E');
        angle = '';
        designRequirements = readCell(row, 'F');
        sellingPoints = '';
        referenceNotes = readCell(row, 'H');
        copyText = readCell(row, 'G');
      }

      const hasMeaningfulContent = [moduleName, type, declaredSizeText, designRequirements, copyText]
        .filter(Boolean)
        .length >= 2;

      if (!hasMeaningfulContent) {
        return null;
      }

      implicitModuleCount += 1;
      return {
        moduleKey: `aplus-${row.rowIndex}`,
        row,
        moduleName: moduleName || `模块${implicitModuleCount}`,
        type,
        declaredSizeText,
        angle,
        sellingPoints,
        designRequirements,
        referenceNotes,
        copyText,
      };
    })
    .filter((row): row is APlusRowCandidate => Boolean(row));
}

function buildTaskAssetRoles(params: {
  rowAssets: EcommerceAnalysisAsset[];
  referenceMentions: Array<{ assetId: string; label: string; mentionTokens: string[]; notes?: string }>;
}): EcommerceTaskAssetRoleBinding[] {
  return buildEcommerceAssetRoleBindings({
    rowAssets: params.rowAssets,
    rowMentions: params.referenceMentions,
    manualReferences: [],
    productReferences: [{ id: 'product-upload', storageId: 'product-upload' }],
    extraReferences: [],
  });
}

function buildBaseTaskState(params: {
  taskId: string;
  sourceKind: EcommerceEditableTaskState['sourceKind'];
  sourceSheet: EcommerceEditableTaskState['sourceSheet'];
  sourceRowKey: string;
  theme: string;
  outputTypeLabel: string;
  declaredSizeText?: string;
  sizeTier?: EcommerceEditableTaskState['sizeTier'];
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
      declaredSizeText: params.declaredSizeText,
      sizeTier: params.sizeTier,
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
  const mainSheet = findMainSheet(parseResult.sheets);
  const aPlusSheet = findAPlusSheet(parseResult.sheets);
  const mainRowCandidates = extractMainRowCandidates(mainSheet);
  const aPlusRowCandidates = extractAPlusRowCandidates(aPlusSheet);
  const mainAssetAssignments = resolveAssetRowAssignments(
    referenceAssets,
    '主图',
    mainRowCandidates.map((candidate) => candidate.row.rowIndex),
  );
  const aPlusAssetAssignments = resolveAssetRowAssignments(
    referenceAssets,
    'A+',
    aPlusRowCandidates.map((candidate) => candidate.row.rowIndex),
  );

  const mainImageItems: EcommerceAnalysisMainImageItem[] = mainRowCandidates.map((candidate) => ({
    itemId: candidate.itemKey,
    sheet: '主图',
    rowIndex: candidate.row.rowIndex,
    sequence: candidate.sequence,
    type: candidate.type,
    angle: candidate.angle,
    theme: candidate.theme,
    designRequirements: candidate.designRequirements,
    copyText: candidate.copyText,
    sizePolicy: resolveEcommerceAspectPolicy({ kind: 'main-image', modelId }).sizePolicy,
    referenceAssetIds: getAssetsForRow(
      referenceAssets,
      '主图',
      candidate.row.rowIndex,
      mainAssetAssignments,
    ).map((asset) => asset.assetId),
    referenceMentions: [],
    productAssetRequired: true,
    promptDraft: '',
    needsReview: false,
    reviewWarnings: [],
  }));

  const modules: EcommerceAnalysisAPlusModule[] = aPlusRowCandidates.map((candidate) => {
    const policy = resolveEcommerceAspectPolicy({
      kind: 'a-plus-module',
      modelId,
      declaredDimensions: candidate.declaredSizeText,
      designRequirements: candidate.designRequirements,
      copyText: candidate.copyText,
    });

    return {
      moduleId: candidate.moduleKey,
      sheet: 'A+',
      rowIndex: candidate.row.rowIndex,
      moduleName: candidate.moduleName,
      type: candidate.type,
      declaredSizeText: candidate.declaredSizeText,
      angle: candidate.angle,
      sellingPoints: candidate.sellingPoints,
      designRequirements: candidate.designRequirements,
      copyText: candidate.copyText,
      sizePolicy: policy.sizePolicy,
      referenceAssetIds: getAssetsForRow(
        referenceAssets,
        'A+',
        candidate.row.rowIndex,
        aPlusAssetAssignments,
      ).map((asset) => asset.assetId),
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

  const rowCandidates = extractMainRowCandidates(sheet);
  const assetAssignments = resolveAssetRowAssignments(
    assets,
    '主图',
    rowCandidates.map((candidate) => candidate.row.rowIndex),
  );

  return rowCandidates
    .map((candidate) => {
      const rowAssets = getAssetsForRow(assets, '主图', candidate.row.rowIndex, assetAssignments);
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
        designRequirements: candidate.designRequirements,
        copyText: candidate.copyText,
        referenceNotes: candidate.referenceNotes,
      });
      const policy = resolveEcommerceAspectPolicy({ kind: 'main-image', modelId });
      const taskState = buildBaseTaskState({
        taskId: `task-${candidate.itemKey}`,
        sourceKind: 'main-image',
        sourceSheet: '主图',
        sourceRowKey: candidate.itemKey,
        theme: candidate.theme || candidate.type,
        outputTypeLabel: '主图',
        declaredSizeText: undefined,
        sizeTier: undefined,
        sparseIntent: [candidate.copyText, candidate.designRequirements].filter(Boolean).join('；'),
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
        itemId: candidate.itemKey,
        sheet: '主图',
        rowIndex: candidate.row.rowIndex,
        sequence: candidate.sequence,
        type: candidate.type,
        angle: candidate.angle,
        theme: candidate.theme,
        designRequirements: candidate.designRequirements,
        copyText: candidate.copyText,
        sizePolicy: policy.sizePolicy,
        sizeTier: policy.sizeTier,
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

  const rowCandidates = extractAPlusRowCandidates(sheet);
  const assetAssignments = resolveAssetRowAssignments(
    assets,
    'A+',
    rowCandidates.map((candidate) => candidate.row.rowIndex),
  );

  return rowCandidates
    .map((candidate) => {
      const rowAssets = getAssetsForRow(assets, 'A+', candidate.row.rowIndex, assetAssignments);
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
        designRequirements: candidate.designRequirements,
        copyText: candidate.copyText,
        referenceNotes: candidate.referenceNotes,
      });
      const policy = resolveEcommerceAspectPolicy({
        kind: 'a-plus-module',
        modelId,
        declaredDimensions: candidate.declaredSizeText,
        designRequirements: candidate.designRequirements,
        copyText: candidate.copyText,
      });
      const taskState = buildBaseTaskState({
        taskId: `task-${candidate.moduleKey}`,
        sourceKind: 'a-plus-module',
        sourceSheet: 'A+',
        sourceRowKey: candidate.moduleKey,
        theme: candidate.moduleName,
        outputTypeLabel: 'A+',
        declaredSizeText: candidate.declaredSizeText,
        sizeTier: policy.sizeTier,
        sparseIntent: [candidate.copyText, candidate.designRequirements].filter(Boolean).join('；'),
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
        moduleId: candidate.moduleKey,
        sheet: 'A+',
        rowIndex: candidate.row.rowIndex,
        moduleName: candidate.moduleName,
        type: candidate.type,
        declaredSizeText: candidate.declaredSizeText,
        angle: candidate.angle,
        sellingPoints: candidate.sellingPoints,
        designRequirements: candidate.designRequirements,
        copyText: candidate.copyText,
        sizePolicy: policy.sizePolicy,
        sizeTier: policy.sizeTier,
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
  const mainSheet = findMainSheet(parseResult.sheets);
  const aPlusSheet = findAPlusSheet(parseResult.sheets);
  const mainImageItems = normalizeMainImageItems(mainSheet, referenceAssets, modelId, seriesTemplate);
  const modules = normalizeAPlusModules(aPlusSheet, referenceAssets, modelId, seriesTemplate);
  const reviewWarnings = dedupeWarnings([
    ...mainImageItems.flatMap((item) => item.reviewWarnings),
    ...modules.flatMap((module) => module.reviewWarnings),
  ]);

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
      groupWarnings: dedupeWarnings(modules.flatMap((module) => module.reviewWarnings)),
    },
    reviewWarnings,
  };
}
