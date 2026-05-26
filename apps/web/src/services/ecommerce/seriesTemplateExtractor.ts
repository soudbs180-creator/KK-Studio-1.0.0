import type { EcommerceSeriesTemplate } from '../../types';
import type { EcommerceAnalysisResult } from './types';

type SeriesTemplateAnalysis = EcommerceAnalysisResult & {
  seriesTemplate?: EcommerceSeriesTemplate;
};

function slugify(value: string): string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'ecommerce-series-template';
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = String(value || '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function inferPreferredLanguage(value: string): 'zh' | 'en' | 'mixed' {
  const text = String(value || '').trim();
  if (!text) return 'zh';

  const latinMatches = text.match(/[A-Za-z]/g) || [];
  const cjkMatches = text.match(/[\u4e00-\u9fff]/g) || [];

  if (latinMatches.length > 0 && cjkMatches.length === 0) return 'en';
  if (latinMatches.length > 0 && cjkMatches.length > 0) return 'mixed';
  return 'zh';
}

function inferColorPalette(text: string): string[] {
  const colorMatches = text.match(/#[0-9a-fA-F]{6}/g) || [];
  const uniqueColors = uniqueStrings(colorMatches);
  if (uniqueColors.length > 0) return uniqueColors.slice(0, 3);

  if (/蓝|冰|凉|清爽|夏/.test(text)) {
    return ['#EAF8FF', '#6CCBFF'];
  }

  return ['#F5F5F5', '#222222'];
}

function buildFallbackTemplate(analysis: SeriesTemplateAnalysis): EcommerceSeriesTemplate {
  const firstMainImage = analysis.mainImageItems[0];
  const designRequirements = String(firstMainImage?.designRequirements || '');
  const copyText = String(firstMainImage?.copyText || '');
  const theme = String(firstMainImage?.theme || analysis.projectMeta.productName || analysis.projectMeta.projectName || '').trim();
  const preferredLanguage = inferPreferredLanguage(`${copyText} ${analysis.projectMeta.productName}`);
  const palette = inferColorPalette(`${designRequirements} ${copyText}`);
  const templateLabel = theme || analysis.projectMeta.productName || analysis.projectMeta.projectName || 'ecommerce series';

  return {
    templateId: slugify(analysis.projectMeta.projectName || analysis.projectMeta.productName || templateLabel),
    templateLabel,
    inheritByDefault: true,
    styleProfile: {
      tone: /清凉|清爽|夏/.test(designRequirements) ? '清爽夏日蓝调' : (theme || 'clean commercial'),
      primaryColors: palette,
      backgroundStyle: /白底|白底棚拍/.test(designRequirements) ? '白底棚拍' : 'clean branded background',
      effectStyle: /风|流线|效果/.test(designRequirements) ? '轻微品牌氛围效果' : 'minimal visual effects',
      shadowStyle: 'soft clean shadow',
      atmosphere: /明亮|干净|清爽/.test(designRequirements) ? '明亮干净' : 'clean commercial',
    },
    layoutProfile: {
      productPosition: /右/.test(designRequirements) ? 'center-right' : 'center-right',
      textPosition: /左/.test(designRequirements) ? 'top-left' : 'top-left',
      highlightPosition: 'left-middle',
      accessoryPosition: 'bottom-right',
      whitespaceStyle: 'clean spacious',
      productScalePreset: 'balanced',
    },
    copyProfile: {
      languageStyle: preferredLanguage === 'en' ? 'short commercial phrases' : '短促商业短句',
      headlineStyle: '2-4 words',
      subheadlineStyle: '1 short sentence',
      highlightStyle: /\d/.test(copyText) ? 'large numeric value' : 'short highlight',
      tone: preferredLanguage === 'en' ? 'direct, feature-led' : '直接、卖点优先',
      preferredLanguage,
    },
    fontProfile: {
      fontStyle: 'sans bold clean',
      headlineWeight: 700,
      subheadlineWeight: 500,
      highlightWeight: 800,
      headlineScale: 1,
      subheadlineScale: 0.55,
      highlightScale: 1.35,
      textColorPrimary: preferredLanguage === 'en' ? '#FFFFFF' : '#FFFFFF',
      textColorSecondary: '#1E2B36',
    },
    constraints: {
      mustKeepConsistency: true,
      forbiddenElements: ['people'],
      mustKeepProductRealistic: true,
      allowedOverrides: ['tone', 'effect', 'productScale', 'copy'],
    },
  };
}

function sanitizeTemplate(template: EcommerceSeriesTemplate, analysis: SeriesTemplateAnalysis): EcommerceSeriesTemplate {
  const fallback = buildFallbackTemplate(analysis);
  return {
    templateId: template.templateId || fallback.templateId,
    templateLabel: template.templateLabel || fallback.templateLabel,
    inheritByDefault: template.inheritByDefault ?? fallback.inheritByDefault,
    styleProfile: {
      ...fallback.styleProfile,
      ...template.styleProfile,
      primaryColors: uniqueStrings([
        ...(template.styleProfile?.primaryColors || []),
        ...fallback.styleProfile.primaryColors,
      ]).slice(0, 4),
    },
    layoutProfile: {
      ...fallback.layoutProfile,
      ...template.layoutProfile,
    },
    copyProfile: {
      ...fallback.copyProfile,
      ...template.copyProfile,
    },
    fontProfile: {
      ...fallback.fontProfile,
      ...template.fontProfile,
    },
    constraints: {
      ...fallback.constraints,
      ...template.constraints,
      forbiddenElements: uniqueStrings([
        ...(template.constraints?.forbiddenElements || []),
        ...fallback.constraints.forbiddenElements,
      ]),
      allowedOverrides: uniqueStrings([
        ...(template.constraints?.allowedOverrides || []),
        ...fallback.constraints.allowedOverrides,
      ]),
    },
  };
}

export function extractSeriesTemplateFromAnalysis(analysis: SeriesTemplateAnalysis): EcommerceSeriesTemplate {
  if (analysis.seriesTemplate) {
    return sanitizeTemplate(analysis.seriesTemplate, analysis);
  }

  return buildFallbackTemplate(analysis);
}
