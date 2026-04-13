import type {
  EcommerceCopyTaskState,
  EcommerceEditableTaskState,
  EcommerceInheritTaskState,
  EcommerceLayoutTaskState,
  EcommerceSeriesTemplate,
  EcommerceSparseIntentPatch,
  EcommerceStyleTaskState,
} from '../../types.ts';
import { resolveEcommerceCopy } from './copyResolver.ts';
import { parseSparseEcommerceIntent } from './sparseIntentParser.ts';

export interface MergeEcommerceTaskStateInput {
  baseTask: EcommerceEditableTaskState;
  seriesTemplate?: EcommerceSeriesTemplate;
  sparseIntent?: string;
  productName?: string;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

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

function buildTemplateCopySeed(
  baseCopy: EcommerceCopyTaskState,
  seriesTemplate?: EcommerceSeriesTemplate,
): EcommerceCopyTaskState {
  return {
    headline: baseCopy.headline,
    subheadline: baseCopy.subheadline,
    highlight: baseCopy.highlight,
    featureTags: [...baseCopy.featureTags],
    cta: baseCopy.cta,
  };
}

function mergeStyleState(
  baseStyle: EcommerceStyleTaskState,
  seriesTemplate: EcommerceSeriesTemplate | undefined,
  patch: EcommerceSparseIntentPatch,
): EcommerceStyleTaskState {
  const merged: EcommerceStyleTaskState = {
    tone: baseStyle.tone || seriesTemplate?.styleProfile.tone || '',
    atmosphere: baseStyle.atmosphere || seriesTemplate?.styleProfile.atmosphere || '',
    effect: baseStyle.effect || seriesTemplate?.styleProfile.effectStyle || '',
    backgroundType: baseStyle.backgroundType || seriesTemplate?.styleProfile.backgroundStyle || '',
  };

  if (patch.style?.tone) merged.tone = patch.style.tone;
  if (patch.style?.atmosphere) merged.atmosphere = patch.style.atmosphere;
  if (patch.style?.backgroundType) merged.backgroundType = patch.style.backgroundType;
  if (patch.style?.effect) merged.effect = patch.style.effect;
  if (patch.style?.effectEnabled === false) merged.effect = 'none';

  return merged;
}

function mergeLayoutState(
  baseLayout: EcommerceLayoutTaskState,
  seriesTemplate: EcommerceSeriesTemplate | undefined,
  patch: EcommerceSparseIntentPatch,
): EcommerceLayoutTaskState {
  return {
    productSize: patch.layout?.productSize || baseLayout.productSize || seriesTemplate?.layoutProfile.productScalePreset || 'balanced',
    textPosition: patch.layout?.textPosition || baseLayout.textPosition || seriesTemplate?.layoutProfile.textPosition || 'top-left',
    accessoryPolicy: patch.layout?.accessoryPolicy || baseLayout.accessoryPolicy || 'auto',
  };
}

function mergeInheritState(
  baseInherit: EcommerceInheritTaskState,
  seriesTemplate: EcommerceSeriesTemplate | undefined,
  patch: EcommerceSparseIntentPatch,
): EcommerceInheritTaskState {
  const templateDefaults = seriesTemplate?.inheritByDefault
    ? {
        keepSeriesStyle: true,
        keepFontStyle: true,
        keepLayoutStyle: true,
        keepCopyStyle: true,
        keepPalette: true,
      }
    : {};

  return {
    keepSeriesStyle: patch.inherit?.keepSeriesStyle ?? templateDefaults.keepSeriesStyle ?? baseInherit.keepSeriesStyle,
    keepFontStyle: patch.inherit?.keepFontStyle ?? templateDefaults.keepFontStyle ?? baseInherit.keepFontStyle,
    keepLayoutStyle: patch.inherit?.keepLayoutStyle ?? templateDefaults.keepLayoutStyle ?? baseInherit.keepLayoutStyle,
    keepCopyStyle: patch.inherit?.keepCopyStyle ?? templateDefaults.keepCopyStyle ?? baseInherit.keepCopyStyle,
    keepPalette: patch.inherit?.keepPalette ?? templateDefaults.keepPalette ?? baseInherit.keepPalette,
  };
}

function buildConsistencyChecks(
  taskState: EcommerceEditableTaskState,
  seriesTemplate?: EcommerceSeriesTemplate,
): string[] {
  return uniqueStrings([
    ...taskState.consistencyChecks,
    taskState.inherit.keepSeriesStyle ? '保持系列风格一致' : '',
    taskState.inherit.keepFontStyle ? '保持字体风格一致' : '',
    taskState.inherit.keepLayoutStyle ? '保持版式风格一致' : '',
    taskState.inherit.keepPalette ? '保持系列配色连续性' : '',
    seriesTemplate?.constraints.mustKeepProductRealistic ? '产品主体必须保持真实' : '',
    seriesTemplate?.constraints.mustKeepConsistency ? '维持整套系列统一感' : '',
    ...(seriesTemplate?.constraints.forbiddenElements || []).map((item) => `避免出现 ${item}`),
  ]);
}

function buildMissingFields(taskState: EcommerceEditableTaskState): string[] {
  return uniqueStrings([
    taskState.assetRoles.some((asset) => asset.role === 'product') ? '' : 'missing-product-asset',
    taskState.copy.headline ? '' : 'missing-headline',
    taskState.copy.subheadline ? '' : 'missing-subheadline',
  ]);
}

export function mergeEcommerceTaskState(input: MergeEcommerceTaskStateInput): EcommerceEditableTaskState {
  const sparseIntent = String(input.sparseIntent ?? input.baseTask.sparseUserIntent ?? '').trim();
  const resolvedSparseIntent = parseSparseEcommerceIntent(sparseIntent);

  const nextStyle = mergeStyleState(input.baseTask.style, input.seriesTemplate, resolvedSparseIntent);
  const nextLayout = mergeLayoutState(input.baseTask.layout, input.seriesTemplate, resolvedSparseIntent);
  const nextInherit = mergeInheritState(input.baseTask.inherit, input.seriesTemplate, resolvedSparseIntent);

  const nextTask: EcommerceEditableTaskState = {
    ...input.baseTask,
    sparseUserIntent: sparseIntent,
    outputTypeLabel: resolvedSparseIntent.outputTypeLabel || input.baseTask.outputTypeLabel,
    style: nextStyle,
    layout: nextLayout,
    inherit: nextInherit,
    copy: {
      ...buildTemplateCopySeed(input.baseTask.copy, input.seriesTemplate),
      ...resolvedSparseIntent.copy,
      featureTags: [...input.baseTask.copy.featureTags],
    },
    resolvedSparseIntent,
  };

  const resolvedCopy = resolveEcommerceCopy({
    taskState: nextTask,
    seriesTemplate: input.seriesTemplate,
    productName: input.productName,
  });

  nextTask.copy = resolvedCopy;
  nextTask.consistencyChecks = buildConsistencyChecks(nextTask, input.seriesTemplate);
  nextTask.missingFields = buildMissingFields(nextTask);

  return nextTask;
}
