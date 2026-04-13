import { resolveEcommerceAspectPolicy } from '../ecommerceModelPolicy.ts';
import { buildEcommerceRenderTask } from '../renderTaskBuilder.ts';
import { extractSeriesTemplateFromAnalysis } from '../seriesTemplateExtractor.ts';
import { mergeEcommerceTaskState } from '../taskMerger.ts';
import type {
  EcommerceAnalysisAPlusModule,
  EcommerceAnalysisMainImageItem,
  EcommerceAnalysisResult,
  EcommerceReferenceMention,
} from '../types.ts';

type FallbackTextInput = {
  text: string;
  sourceFileName: string;
  sourceFileType: string;
};

function cleanText(value: string): string {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u3000/g, ' ')
    .trim();
}

function splitLines(text: string): string[] {
  return cleanText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractField(line: string, labels: string[]): string {
  for (const label of labels) {
    const regex = new RegExp(`${label}\\s*[：:]\\s*([^；，。\\n]+)`);
    const match = line.match(regex);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function extractHeaderValue(lines: string[], labels: string[]): string {
  for (const line of lines) {
    const value = extractField(line, labels);
    if (value) return value;
  }
  return '';
}

function extractReferenceMentions(text: string): EcommerceReferenceMention[] {
  const matches = Array.from(new Set(text.match(/(?:参考图\d+|图\d+)/g) || []));
  return matches.map((token, index) => ({
    assetId: `text-ref-${index + 1}`,
    label: token.replace(/^图/, '参考图'),
    mentionTokens: [token],
    notes: '文本回退分析无法定位具体图片，请人工确认。',
  }));
}

function createFallbackTaskState(params: {
  taskId: string;
  sourceKind: 'main-image' | 'a-plus-module';
  sourceSheet: '主图' | 'A+';
  sourceRowKey: string;
  theme: string;
  outputTypeLabel: string;
  sparseIntent: string;
  seriesTemplate: EcommerceAnalysisResult['seriesTemplate'];
}) {
  return mergeEcommerceTaskState({
    baseTask: {
      taskId: params.taskId,
      templateId: params.seriesTemplate.templateId,
      sourceKind: params.sourceKind,
      sourceSheet: params.sourceSheet,
      sourceRowKey: params.sourceRowKey,
      theme: params.theme,
      outputTypeLabel: params.outputTypeLabel,
      imageRoleSummary: ['产品图'],
      sparseUserIntent: params.sparseIntent,
      copy: { headline: '', subheadline: '', highlight: '', featureTags: [], cta: '' },
      style: { tone: '', atmosphere: '', effect: '', backgroundType: '' },
      layout: { productSize: 'balanced', textPosition: 'top-left', accessoryPolicy: 'auto' },
      inherit: {
        keepSeriesStyle: true,
        keepFontStyle: true,
        keepLayoutStyle: true,
        keepCopyStyle: true,
        keepPalette: true,
      },
      assetRoles: [{ assetId: 'product-upload', role: 'product', label: '产品图', normalizedLabel: '产品图', source: 'upload' }],
      consistencyChecks: [],
      missingFields: [],
      resolvedPromptPreview: '',
      displayLabel: '',
    },
    seriesTemplate: params.seriesTemplate,
    sparseIntent: params.sparseIntent,
  });
}

function normalizeMainItems(
  lines: string[],
  seriesTemplate: EcommerceAnalysisResult['seriesTemplate'],
): EcommerceAnalysisMainImageItem[] {
  return lines
    .filter((line) => /^\d+[.、]/.test(line))
    .map((line, index) => {
      const type = extractField(line, ['类型']) || '主图';
      const angle = extractField(line, ['角度']);
      const theme = extractField(line, ['主题']) || type;
      const designRequirements = extractField(line, ['设计要求']);
      const copyText = extractField(line, ['文案']);
      const referenceMentions = extractReferenceMentions(`${line} ${designRequirements}`);
      const taskState = createFallbackTaskState({
        taskId: `fallback-task-main-${index + 1}`,
        sourceKind: 'main-image',
        sourceSheet: '主图',
        sourceRowKey: `fallback-main-${index + 1}`,
        theme,
        outputTypeLabel: '主图',
        sparseIntent: [line, designRequirements, copyText].filter(Boolean).join('；'),
        seriesTemplate,
      });
      const renderTask = buildEcommerceRenderTask({
        taskState,
        seriesTemplate,
        aspectRatio: '1:1',
        imageSize: '4K',
      });

      return {
        itemId: `fallback-main-${index + 1}`,
        sheet: '主图',
        rowIndex: index + 1,
        sequence: index + 1,
        type,
        angle,
        theme,
        designRequirements,
        copyText,
        sizePolicy: 'main-default',
        referenceAssetIds: [],
        referenceMentions,
        productAssetRequired: true,
        promptDraft: renderTask.prompt,
        resolvedPromptPreview: renderTask.prompt,
        editableTask: taskState,
        needsReview: true,
        reviewWarnings: ['文档文本回退分析无法确定主图参考图锚点，请人工确认。'],
      };
    });
}

function normalizeAPlusModules(
  lines: string[],
  seriesTemplate: EcommerceAnalysisResult['seriesTemplate'],
): EcommerceAnalysisAPlusModule[] {
  return lines
    .filter((line) => /^模块\d+/.test(line))
    .map((line, index) => {
      const moduleName = line.match(/^模块\d+/)?.[0] || `模块${index + 1}`;
      const type = extractField(line, ['类型']) || moduleName;
      const declaredSizeText = extractField(line, ['尺寸', '图片尺寸']);
      const angle = extractField(line, ['角度', '产品角度']);
      const designRequirements = extractField(line, ['设计要求']);
      const sellingPoints = extractField(line, ['产品卖点', '卖点']);
      const copyText = extractField(line, ['文案']);
      const policy = resolveEcommerceAspectPolicy({
        kind: 'a-plus-module',
        modelId: 'gemini-3.1-flash-image-preview',
        declaredDimensions: declaredSizeText,
        designRequirements,
        copyText,
      });
      const referenceMentions = extractReferenceMentions(`${line} ${designRequirements}`);
      const taskState = createFallbackTaskState({
        taskId: `fallback-task-aplus-${index + 1}`,
        sourceKind: 'a-plus-module',
        sourceSheet: 'A+',
        sourceRowKey: `fallback-aplus-${index + 1}`,
        theme: moduleName,
        outputTypeLabel: 'A+',
        sparseIntent: [line, designRequirements, copyText].filter(Boolean).join('；'),
        seriesTemplate,
      });
      const renderTask = buildEcommerceRenderTask({
        taskState,
        seriesTemplate,
        aspectRatio: policy.defaultAspectRatio,
        imageSize: '4K',
      });

      return {
        moduleId: `fallback-aplus-${index + 1}`,
        sheet: 'A+',
        rowIndex: index + 1,
        moduleName,
        type,
        declaredSizeText,
        angle,
        sellingPoints,
        designRequirements,
        copyText,
        sizePolicy: policy.sizePolicy,
        referenceAssetIds: [],
        referenceMentions,
        productAssetRequired: true,
        promptDraft: renderTask.prompt,
        resolvedPromptPreview: renderTask.prompt,
        editableTask: taskState,
        needsReview: true,
        reviewWarnings: ['文档文本回退分析无法确定 A+ 参考图锚点，请人工确认。'],
      };
    });
}

export function analyzeFallbackEcommerceText(input: FallbackTextInput): EcommerceAnalysisResult {
  const lines = splitLines(input.text);
  const projectName = extractHeaderValue(lines, ['需求名称']) || input.sourceFileName.replace(/\.[^.]+$/, '');
  const productName = extractHeaderValue(lines, ['产品名称']) || '';
  const mainSectionIndex = lines.findIndex((line) => line === '主图');
  const aPlusSectionIndex = lines.findIndex((line) => /^A\+$/i.test(line));
  const mainLines = mainSectionIndex >= 0
    ? lines.slice(mainSectionIndex + 1, aPlusSectionIndex >= 0 ? aPlusSectionIndex : lines.length)
    : [];
  const aPlusLines = aPlusSectionIndex >= 0
    ? lines.slice(aPlusSectionIndex + 1)
    : [];

  const draftAnalysis: EcommerceAnalysisResult = {
    seriesTemplate: {
      templateId: 'fallback-template',
      templateLabel: projectName || productName || 'fallback-template',
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
      projectName,
      productName,
      sourceFileName: input.sourceFileName,
      sourceFileType: input.sourceFileType,
      warnings: [],
    },
    assets: {
      productAssets: [],
      referenceAssets: [],
    },
    mainImageItems: [],
    aPlusGroup: {
      groupId: 'fallback-aplus-group',
      title: `${productName || 'A+'} A+ 模块`,
      modules: [],
      groupWarnings: [],
    },
    reviewWarnings: [],
  };
  const seriesTemplate = extractSeriesTemplateFromAnalysis(draftAnalysis);
  const mainImageItems = normalizeMainItems(mainLines, seriesTemplate);
  const modules = normalizeAPlusModules(aPlusLines, seriesTemplate);
  const reviewWarnings = [
    '当前结果来自文档文本回退分析，参考图编号与尺寸策略需人工确认。',
    ...mainImageItems.flatMap((item) => item.reviewWarnings),
    ...modules.flatMap((module) => module.reviewWarnings),
  ];

  return {
    seriesTemplate,
    projectMeta: {
      projectName,
      productName,
      sourceFileName: input.sourceFileName,
      sourceFileType: input.sourceFileType,
      warnings: reviewWarnings,
    },
    assets: {
      productAssets: [],
      referenceAssets: [],
    },
    mainImageItems,
    aPlusGroup: {
      groupId: 'fallback-aplus-group',
      title: `${productName || 'A+'} A+ 模块`,
      modules,
      groupWarnings: modules.flatMap((module) => module.reviewWarnings),
    },
    reviewWarnings,
  };
}

export const analyzeEcommerceTextFallback = analyzeFallbackEcommerceText;
