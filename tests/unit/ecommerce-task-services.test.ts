import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { EcommerceEditableTaskState, EcommerceSeriesTemplate } from '../../src/types.ts';
import { resolveEcommerceCopy } from '../../src/services/ecommerce/copyResolver.ts';
import { buildEcommerceDisplayLabel, buildEcommerceRenderTask } from '../../src/services/ecommerce/renderTaskBuilder.ts';
import { extractSeriesTemplateFromAnalysis } from '../../src/services/ecommerce/seriesTemplateExtractor.ts';
import { parseSparseEcommerceIntent } from '../../src/services/ecommerce/sparseIntentParser.ts';
import { mergeEcommerceTaskState } from '../../src/services/ecommerce/taskMerger.ts';

function createSeriesTemplate(): EcommerceSeriesTemplate {
  return {
    templateId: 'series-summer-cooler',
    templateLabel: 'summer cooler',
    inheritByDefault: true,
    styleProfile: {
      tone: '清爽夏日蓝',
      primaryColors: ['#EAF8FF', '#6CCBFF'],
      backgroundStyle: '白底棚拍',
      effectStyle: '轻微冷风感',
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
      preferredLanguage: 'en',
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
  };
}

function createTaskState(overrides: Partial<EcommerceEditableTaskState> = {}): EcommerceEditableTaskState {
  return {
    taskId: 'task-main-1',
    templateId: 'series-summer-cooler',
    sourceKind: 'main-image',
    sourceSheet: '主图',
    sourceRowKey: 'main-1',
    theme: '冷风机主图',
    outputTypeLabel: '主图',
    imageRoleSummary: ['产品图', '参考图1'],
    sparseUserIntent: '还是上一套风格',
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
    assetRoles: [
      {
        assetId: 'product-1',
        role: 'product',
        label: '产品图',
        normalizedLabel: '产品图',
        source: 'upload',
      },
      {
        assetId: 'ref-1',
        role: 'reference',
        label: '参考图1',
        normalizedLabel: '参考图1',
        source: 'analysis',
        mentionTokens: ['右边图片'],
      },
    ],
    consistencyChecks: [],
    missingFields: [],
    resolvedPromptPreview: '',
    displayLabel: '主图 1:1 4K',
    ...overrides,
  };
}

test('extractSeriesTemplateFromAnalysis produces inherit-by-default style and copy template data', () => {
  const template = extractSeriesTemplateFromAnalysis({
    projectMeta: {
      projectName: '夏日冷风机套系',
      productName: 'Portable Air Cooler',
      sourceFileName: 'summer.xlsx',
      sourceFileType: 'xlsx',
      warnings: [],
    },
    assets: {
      productAssets: [],
      referenceAssets: [],
    },
    mainImageItems: [
      {
        itemId: 'main-1',
        sheet: '主图',
        rowIndex: 1,
        sequence: 1,
        type: '主图',
        angle: '正面',
        theme: 'Fast Cooling',
        designRequirements: '夏日清爽、白底棚拍、冷风流线',
        copyText: 'Fast Cooling 16.5Gal',
        sizePolicy: 'main-default',
        referenceAssetIds: [],
        referenceMentions: [],
        productAssetRequired: true,
        promptDraft: '',
        resolvedPromptPreview: '',
        editableTask: createTaskState(),
        needsReview: false,
        reviewWarnings: [],
      },
    ],
    aPlusGroup: {
      groupId: 'aplus-group',
      title: 'A+ 模块',
      modules: [],
      groupWarnings: [],
    },
    reviewWarnings: [],
    seriesTemplate: createSeriesTemplate(),
  });

  assert.equal(template.inheritByDefault, true);
  assert.equal(template.styleProfile.tone, '清爽夏日蓝');
  assert.match(template.layoutProfile.productPosition, /right|center-right/);
  assert.equal(template.copyProfile.highlightStyle, 'large numeric value');
});

test('parseSparseEcommerceIntent recognizes sparse chinese overrides', () => {
  const patch = parseSparseEcommerceIntent('文案写 16.5Gal，色调更清凉一点，字大一点，还是上一套风格，不要风效，产品放大，做成主图');

  assert.equal(patch.copy?.highlight, '16.5Gal');
  assert.equal(patch.style?.tone, '更清凉一点');
  assert.equal(patch.style?.effectEnabled, false);
  assert.equal(patch.layout?.productSize, 'large');
  assert.equal(patch.inherit?.keepSeriesStyle, true);
  assert.equal(patch.inherit?.keepFontStyle, true);
  assert.equal(patch.outputTypeLabel, '主图');
  assert.equal(patch.font?.headlineScaleDelta, 0.15);
});

test('mergeEcommerceTaskState prefers explicit user patch over task defaults and template values', () => {
  const seriesTemplate = createSeriesTemplate();
  const merged = mergeEcommerceTaskState({
    baseTask: createTaskState({
      copy: {
        headline: '',
        subheadline: '',
        highlight: '',
        featureTags: [],
        cta: '',
      },
    }),
    seriesTemplate,
    sparseIntent: '文案写 16.5Gal，色调更清凉一点，字大一点',
    productName: 'Portable Air Cooler',
  });

  assert.equal(merged.copy.highlight, '16.5Gal');
  assert.equal(merged.style.tone, '更清凉一点');
  assert.match(merged.copy.headline, /Fast Cooling|Portable Air Cooler/);
  assert.equal(merged.inherit.keepSeriesStyle, true);
});

test('resolveEcommerceCopy fills missing commercial copy while preserving explicit user text', () => {
  const seriesTemplate = createSeriesTemplate();
  const copy = resolveEcommerceCopy({
    taskState: createTaskState({
      copy: {
        headline: '',
        subheadline: '',
        highlight: '16.5Gal',
        featureTags: [],
        cta: '',
      },
    }),
    seriesTemplate,
    productName: 'Portable Air Cooler',
  });

  assert.equal(copy.highlight, '16.5Gal');
  assert.ok(copy.headline.length > 0);
  assert.ok(copy.subheadline.length > 0);
});

test('buildEcommerceRenderTask emits normalized asset roles and business display labels', () => {
  const taskState = mergeEcommerceTaskState({
    baseTask: createTaskState(),
    seriesTemplate: createSeriesTemplate(),
    sparseIntent: '文案写 16.5Gal，色调更清凉一点',
    productName: 'Portable Air Cooler',
  });

  const renderTask = buildEcommerceRenderTask({
    taskState,
    seriesTemplate: createSeriesTemplate(),
    aspectRatio: '1:1',
    imageSize: '4K',
  });

  assert.equal(buildEcommerceDisplayLabel('主图', '1:1', '4K'), '主图 1:1 4K');
  assert.equal(buildEcommerceDisplayLabel('A+', '21:9', '4K'), 'A+ 21:9 4K');
  assert.match(renderTask.prompt, /参考图1/);
  assert.match(renderTask.prompt, /产品图/);
  assert.equal(renderTask.displayLabel, '主图 1:1 4K');
  assert.ok(renderTask.consistencyChecks.length > 0);
  assert.equal(renderTask.taskState.taskId, taskState.taskId);
  assert.equal(renderTask.taskState.displayLabel, renderTask.displayLabel);
  assert.equal(renderTask.taskState.resolvedPromptPreview, renderTask.prompt);
  assert.equal(renderTask.taskState.lastRenderPrompt, renderTask.prompt);
  assert.deepEqual(renderTask.taskState.copy, renderTask.copy);
  assert.deepEqual(renderTask.taskState.consistencyChecks, renderTask.consistencyChecks);
  assert.notEqual(renderTask.taskState, taskState);
});
