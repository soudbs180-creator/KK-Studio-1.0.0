import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import type { EcommerceEditableTaskState, EcommerceSeriesTemplate } from '../../apps/web/src/types.ts';
import { resolveEcommerceCopy } from '../../apps/web/src/services/ecommerce/copyResolver.ts';
import { buildEcommerceDisplayLabel, buildEcommerceRenderTask } from '../../apps/web/src/services/ecommerce/renderTaskBuilder.ts';
import { extractSeriesTemplateFromAnalysis } from '../../apps/web/src/services/ecommerce/seriesTemplateExtractor.ts';
import { parseSparseEcommerceIntent } from '../../apps/web/src/services/ecommerce/sparseIntentParser.ts';
import { mergeEcommerceTaskState } from '../../apps/web/src/services/ecommerce/taskMerger.ts';

const ROOT_DIR = process.cwd();



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

test('mergeEcommerceTaskState keeps copy seed compatibility without reading the template parameter', () => {
  const taskMergerSource = readSource('apps/web/src/services/ecommerce/taskMerger.ts');

  assert.match(
    taskMergerSource,
    /function buildTemplateCopySeed\(\s*baseCopy: EcommerceCopyTaskState,\s*_seriesTemplate\?: EcommerceSeriesTemplate,\s*\): EcommerceCopyTaskState/,
  );
  assert.doesNotMatch(
    taskMergerSource,
    /function buildTemplateCopySeed\(\s*baseCopy: EcommerceCopyTaskState,\s*seriesTemplate\?: EcommerceSeriesTemplate,/,
  );
  assert.match(taskMergerSource, /buildTemplateCopySeed\(input\.baseTask\.copy, input\.seriesTemplate\)/);
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
  assert.match(renderTask.prompt, /系列风格锚点/);
  assert.match(renderTask.prompt, /参考图职责表/);
  assert.match(renderTask.prompt, /@产品主图/);
  assert.match(renderTask.prompt, /@需求参考/);
  assert.doesNotMatch(renderTask.prompt, /图1|图2/);
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

test('buildEcommerceRenderTask includes staged A+ business size constraints in the prompt body', () => {
  const taskState = mergeEcommerceTaskState({
    baseTask: createTaskState({
      taskId: 'task-aplus-1464',
      sourceKind: 'a-plus-module',
      sourceSheet: 'A+',
      sourceRowKey: 'aplus-1464',
      theme: 'Hero banner module',
      outputTypeLabel: 'A+',
      declaredSizeText: '1464*600',
      sizeTier: '1464x600',
      displayLabel: 'A+ 21:9 4K',
    }),
    seriesTemplate: createSeriesTemplate(),
    sparseIntent: 'desktop hero first, keep room for later mobile compaction',
    productName: 'Portable Air Cooler',
  });

  const renderTask = buildEcommerceRenderTask({
    taskState,
    seriesTemplate: createSeriesTemplate(),
    aspectRatio: '21:9',
    imageSize: '4K',
  });

  assert.match(renderTask.prompt, /Business size/i);
  assert.match(renderTask.prompt, /1464\*600/);
  assert.match(renderTask.prompt, /600\*450/i);
  assert.match(renderTask.prompt, /mobile/i);
});

test('buildEcommerceRenderTask prefers effective A+ size constraints over detected size tiers when the global control overrides them', () => {
  const taskState = mergeEcommerceTaskState({
    baseTask: createTaskState({
      taskId: 'task-aplus-override',
      sourceKind: 'a-plus-module',
      sourceSheet: 'A+',
      sourceRowKey: 'aplus-override',
      theme: 'Shared banner module',
      outputTypeLabel: 'A+',
      declaredSizeText: '1464*600',
      sizeTier: '1464x600',
      effectiveSizeTier: '970x600',
      effectiveSizePolicy: 'sheet-native',
      displayLabel: 'A+ 16:9 4K',
    }),
    seriesTemplate: createSeriesTemplate(),
    sparseIntent: 'single desktop and mobile shared composition',
    productName: 'Portable Air Cooler',
  });

  const renderTask = buildEcommerceRenderTask({
    taskState,
    seriesTemplate: createSeriesTemplate(),
    aspectRatio: '16:9',
    imageSize: '4K',
  });

  assert.match(renderTask.prompt, /970\*600/);
  assert.doesNotMatch(renderTask.prompt, /1464\*600[^]*600\*450/i);
  assert.match(renderTask.prompt, /single desktop\/mobile shared composition/i);
});

test('buildEcommerceRenderTask treats direct 600*450 output as a 4:3 mobile ratio family instead of a desktop conversion', () => {
  const taskState = mergeEcommerceTaskState({
    baseTask: createTaskState({
      taskId: 'task-aplus-mobile-native',
      sourceKind: 'a-plus-module',
      sourceSheet: 'A+',
      sourceRowKey: 'aplus-mobile-native',
      theme: 'Mobile compact module',
      outputTypeLabel: 'A+',
      declaredSizeText: '600*450',
      sizeTier: '600x450',
      effectiveSizeTier: '600x450',
      effectiveSizePolicy: 'sheet-native',
      displayLabel: 'A+ 4:3 4K',
    }),
    seriesTemplate: createSeriesTemplate(),
    sparseIntent: 'compact mobile A+ deliverable',
    productName: 'Portable Air Cooler',
  });

  const renderTask = buildEcommerceRenderTask({
    taskState,
    seriesTemplate: createSeriesTemplate(),
    aspectRatio: '4:3',
    imageSize: '4K',
  });

  assert.match(renderTask.prompt, /600\*450/);
  assert.match(renderTask.prompt, /4:3/);
  assert.match(renderTask.prompt, /proportional multiple/i);
  assert.doesNotMatch(renderTask.prompt, /desktop master first/i);
  assert.doesNotMatch(renderTask.prompt, /desktop version/i);
});

test('buildEcommerceRenderTask keeps product-first prompt framing before background and style constraints', () => {
  const taskState = mergeEcommerceTaskState({
    baseTask: createTaskState({
      taskId: 'task-main-product-first',
      copy: {
        headline: 'Fast Cooling',
        subheadline: 'Portable tower fan',
        highlight: '16.5Gal',
        featureTags: ['Ice Wind', 'Low Noise'],
        cta: '',
      },
      style: {
        tone: '清新轻盈',
        atmosphere: '卧室午后',
        effect: '柔光氛围',
        backgroundType: '明亮家居背景',
      },
    }),
    seriesTemplate: createSeriesTemplate(),
    sparseIntent: '产品主体是上传的冷风机，背景是卧室午后，要求清新轻盈',
    productName: 'Portable Air Cooler',
  });

  const renderTask = buildEcommerceRenderTask({
    taskState,
    seriesTemplate: createSeriesTemplate(),
    aspectRatio: '1:1',
    imageSize: '4K',
  });

  const productIndex = renderTask.prompt.indexOf('产品图');
  const styleIndex = renderTask.prompt.indexOf('风格要求');

  assert.notEqual(productIndex, -1);
  assert.notEqual(styleIndex, -1);
  assert.ok(productIndex < styleIndex);
  assert.match(renderTask.prompt, /背景：明亮家居背景/);
});

test('buildEcommerceRenderTask surfaces stable @ anchors for the current item materials', () => {
  const taskState = createTaskState({
    assetRoles: [
      {
        assetId: 'ref-1',
        role: 'reference',
        label: '参考图1',
        normalizedLabel: '参考图1',
        aliasLabel: '图1',
        source: 'analysis',
      },
      {
        assetId: 'ref-2',
        role: 'reference',
        label: '参考图2',
        normalizedLabel: '参考图2',
        aliasLabel: '图2',
        source: 'analysis',
      },
      {
        assetId: 'product-1',
        role: 'product',
        label: '产品图1',
        normalizedLabel: '产品图',
        aliasLabel: '图3',
        source: 'upload',
      },
    ],
  });

  const renderTask = buildEcommerceRenderTask({
    taskState,
    seriesTemplate: createSeriesTemplate(),
    aspectRatio: '1:1',
    imageSize: '4K',
  });

  assert.match(renderTask.prompt, /@需求参考-ref-1/);
  assert.match(renderTask.prompt, /@需求参考-ref-2/);
  assert.match(renderTask.prompt, /@产品主图/);
  assert.match(renderTask.prompt, /优先展示：@产品主图/);
  assert.doesNotMatch(renderTask.prompt, /图1|图2|图3/);
  assert.deepEqual(
    renderTask.taskState.referenceAnchors?.map((anchor) => anchor.token),
    ['@需求参考-ref-1', '@需求参考-ref-2', '@产品主图'],
  );
});

test('buildEcommerceRenderTask preserves edited anchor role labels without changing tokens', () => {
  const taskState = createTaskState({
    assetRoles: [
      {
        assetId: 'product-1',
        role: 'product',
        label: '产品图',
        normalizedLabel: '产品图',
        token: '@产品主图',
        roleLabel: '产品主图',
        aliasLabel: '@产品主图',
        source: 'upload',
      },
      {
        assetId: 'style-ref-1',
        role: 'extra-reference',
        label: '风格参考',
        normalizedLabel: '风格参考',
        token: '@style-ref',
        roleLabel: 'LayoutRef',
        aliasLabel: '@style-ref',
        source: 'upload',
      },
    ],
  });

  const renderTask = buildEcommerceRenderTask({
    taskState,
    seriesTemplate: createSeriesTemplate(),
    aspectRatio: '1:1',
    imageSize: '4K',
  });

  assert.match(renderTask.prompt, /@style-ref：LayoutRef/);
  assert.equal(
    renderTask.taskState.referenceAnchors?.find((anchor) => anchor.assetId === 'style-ref-1')?.roleLabel,
    'LayoutRef',
  );
  assert.equal(
    renderTask.taskState.referenceAnchors?.find((anchor) => anchor.assetId === 'style-ref-1')?.token,
    '@style-ref',
  );
});
