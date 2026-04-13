import { resolveEcommerceAspectPolicy } from '../ecommerceModelPolicy.ts';
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
    const regex = new RegExp(`${label}\\s*[：:]\\s*([^；;]+)`);
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
    notes: '文档文本回退分析无法定位具体图片，请人工确认。',
  }));
}

function buildPrompt(kindLabel: string, line: string, designRequirements: string, copyText: string): string {
  return [
    `${kindLabel}草案：${line}`,
    designRequirements ? `设计要求：${designRequirements}` : '',
    copyText ? `文案替换：${copyText}` : '',
    '这是基于文档文本的回退分析结果，请在生成前人工确认参考图与尺寸策略。',
  ].filter(Boolean).join('\n');
}

function normalizeMainItems(lines: string[]): EcommerceAnalysisMainImageItem[] {
  return lines
    .filter((line) => /^\d+[.、]/.test(line))
    .map((line, index) => {
      const type = extractField(line, ['类型']) || '主图';
      const angle = extractField(line, ['角度']);
      const theme = extractField(line, ['主题']) || type;
      const designRequirements = extractField(line, ['设计要求']);
      const copyText = extractField(line, ['文案']);
      const referenceMentions = extractReferenceMentions(`${line} ${designRequirements}`);

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
        promptDraft: buildPrompt('主图', line, designRequirements, copyText),
        needsReview: true,
        reviewWarnings: ['文档文本回退分析无法确定主图参考图锚点，请人工确认。'],
      };
    });
}

function normalizeAPlusModules(lines: string[]): EcommerceAnalysisAPlusModule[] {
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
        promptDraft: buildPrompt('A+模块', line, designRequirements, copyText),
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

  const mainImageItems = normalizeMainItems(mainLines);
  const modules = normalizeAPlusModules(aPlusLines);
  const reviewWarnings = [
    '当前结果来自文档文本回退分析，参考图编号与尺寸策略需人工确认。',
    ...mainImageItems.flatMap((item) => item.reviewWarnings),
    ...modules.flatMap((module) => module.reviewWarnings),
  ];

  return {
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
