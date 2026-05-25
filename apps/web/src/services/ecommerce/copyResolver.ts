import type {
  EcommerceCopyTaskState,
  EcommerceEditableTaskState,
  EcommerceSeriesTemplate,
} from '../../types.ts';

export interface ResolveEcommerceCopyInput {
  taskState: EcommerceEditableTaskState;
  seriesTemplate?: EcommerceSeriesTemplate;
  productName?: string;
}

function cleanText(value: string | undefined): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function titleCaseWords(value: string): string {
  const trimmed = cleanText(value);
  if (!trimmed) return '';

  if (/[\u4e00-\u9fff]/.test(trimmed)) {
    return trimmed;
  }

  return trimmed
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function dedupeStrings(values: Array<string | undefined>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const trimmed = cleanText(value);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function buildFallbackHeadline(input: ResolveEcommerceCopyInput): string {
  const explicitCandidates = [
    input.taskState.copy.headline,
    input.productName,
    input.taskState.theme,
    input.seriesTemplate?.templateLabel,
  ];

  const resolved = dedupeStrings(explicitCandidates)[0];
  return titleCaseWords(resolved || 'Product Highlight');
}

function buildFallbackSubheadline(input: ResolveEcommerceCopyInput, headline: string): string {
  const productName = cleanText(input.productName);
  const tone = cleanText(input.taskState.style.tone || input.seriesTemplate?.copyProfile.tone);
  const preferredLanguage = input.seriesTemplate?.copyProfile.preferredLanguage || 'zh';

  if (input.taskState.copy.subheadline) {
    return cleanText(input.taskState.copy.subheadline);
  }

  if (preferredLanguage === 'en' || /[A-Za-z]/.test(productName || headline)) {
    if (productName && tone) {
      return `${productName} with a ${tone} commercial look.`;
    }
    if (productName) {
      return `${productName} hero visual built for ecommerce conversion.`;
    }
    return `${headline} visual built for ecommerce conversion.`;
  }

  if (productName && tone) {
    return `${productName}，${tone}商业展示。`;
  }
  if (productName) {
    return `${productName}电商卖点展示。`;
  }
  return `${headline}，用于电商转化展示。`;
}

function buildFallbackHighlight(input: ResolveEcommerceCopyInput): string {
  const values = [
    input.taskState.copy.highlight,
    ...input.taskState.copy.featureTags,
  ];

  return dedupeStrings(values)[0] || '';
}

function buildFeatureTags(input: ResolveEcommerceCopyInput, headline: string, highlight: string): string[] {
  const derived = [
    ...input.taskState.copy.featureTags,
    highlight,
    input.taskState.style.tone,
    input.seriesTemplate?.templateLabel,
    headline,
  ];

  return dedupeStrings(derived).slice(0, 4);
}

function buildFallbackCta(input: ResolveEcommerceCopyInput): string {
  if (input.taskState.copy.cta) {
    return cleanText(input.taskState.copy.cta);
  }

  const preferredLanguage = input.seriesTemplate?.copyProfile.preferredLanguage || 'zh';
  return preferredLanguage === 'en' ? 'Shop Now' : '立即了解';
}

export function resolveEcommerceCopy(input: ResolveEcommerceCopyInput): EcommerceCopyTaskState {
  const headline = buildFallbackHeadline(input);
  const highlight = buildFallbackHighlight(input);

  return {
    headline,
    subheadline: buildFallbackSubheadline(input, headline),
    highlight,
    featureTags: buildFeatureTags(input, headline, highlight),
    cta: buildFallbackCta(input),
  };
}
