import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { GeneratedImage, PromptNode, ReferenceImage } from '../../apps/web/src/types.ts';
import { selectMobileFeedResults } from '../../apps/web/src/components/mobile/mobileFeedSelectors.ts';

function createReferenceImage(overrides: Partial<ReferenceImage> = {}): ReferenceImage {
  return {
    id: 'ref-default',
    data: 'https://example.com/ref.png',
    mimeType: 'image/png',
    ...overrides,
  };
}

function createPromptNode(overrides: Partial<PromptNode> = {}): PromptNode {
  return {
    id: 'prompt-default',
    prompt: 'Default prompt',
    originalPrompt: 'Default prompt',
    childImageIds: [],
    referenceImages: [],
    timestamp: 0,
    modelLabel: 'Default model',
    ...overrides,
  } as PromptNode;
}

function createImage(overrides: Partial<GeneratedImage> = {}): GeneratedImage {
  return {
    id: 'image-default',
    url: 'https://example.com/default.png',
    prompt: 'Default image prompt',
    timestamp: 0,
    parentPromptId: '',
    model: 'default-model',
    modelLabel: 'Default model',
    aspectRatio: '1:1' as GeneratedImage['aspectRatio'],
    imageSize: '1K' as GeneratedImage['imageSize'],
    ...overrides,
  } as GeneratedImage;
}

describe('selectMobileFeedResults', () => {
  test('sorts result cards by newest timestamp with deterministic tie-breakers', () => {
    const promptAlpha = createPromptNode({
      id: 'prompt-alpha',
      prompt: 'Alpha prompt',
      timestamp: 400,
    });
    const promptBeta = createPromptNode({
      id: 'prompt-beta',
      prompt: 'Beta prompt',
      timestamp: 300,
    });

    const imageAlpha = createImage({
      id: 'image-alpha',
      parentPromptId: 'prompt-alpha',
      prompt: 'Alpha image prompt',
      timestamp: 900,
      url: 'https://example.com/alpha.png',
    });
    const imageGamma = createImage({
      id: 'image-gamma',
      parentPromptId: '',
      prompt: 'Standalone gamma prompt',
      timestamp: 700,
      url: 'https://example.com/gamma.png',
    });
    const imageBeta = createImage({
      id: 'image-beta',
      parentPromptId: 'prompt-beta',
      prompt: 'Beta image prompt',
      timestamp: 900,
      url: 'https://example.com/beta.png',
    });

    const results = selectMobileFeedResults(
      [promptBeta, promptAlpha],
      [imageBeta, imageGamma, imageAlpha],
    );

    assert.deepEqual(
      results.map((item) => item.id),
      ['image-gamma', 'image-alpha', 'image-beta'],
    );
    assert.deepEqual(
      results.map((item) => item.timestamp),
      [700, 900, 900],
    );
    assert.deepEqual(
      results.map((item) => item.parentPromptId),
      [null, 'prompt-alpha', 'prompt-beta'],
    );
  });

  test('derives the mobile entry payload from prompt and image fields', () => {
    const references = [
      createReferenceImage({ id: 'ref-1', url: 'https://example.com/ref-1.png' }),
      createReferenceImage({ id: 'ref-2', data: 'raw-base64-content', mimeType: 'image/jpeg' }),
    ];
    const prompt = createPromptNode({
      id: 'prompt-hero',
      originalPrompt: '  Hero   scene   with   warm light  ',
      prompt: 'Fallback prompt',
      referenceImages: references,
      timestamp: 1234,
      modelLabel: 'Prompt model',
    });
    const image = createImage({
      id: 'image-hero',
      parentPromptId: 'prompt-hero',
      prompt: 'Image prompt should not win',
      timestamp: 0,
      originalUrl: 'https://example.com/original.png',
      apiResultUrl: 'https://example.com/api.png',
      url: 'https://example.com/fallback.png',
      model: 'imagen-4',
      modelLabel: 'Imagen 4',
      aspectRatio: '16:9' as GeneratedImage['aspectRatio'],
      imageSize: '2K' as GeneratedImage['imageSize'],
    });

    const [result] = selectMobileFeedResults([prompt], [image]);

    assert.equal(result.id, 'image-hero');
    assert.equal(result.imageId, 'image-hero');
    assert.equal(result.displaySrc, 'https://example.com/original.png');
    assert.equal(result.hasOriginal, true);
    assert.equal(result.timestamp, 1234);
    assert.equal(result.parentPromptId, 'prompt-hero');
    assert.equal(result.promptSummary, 'Hero scene with warm light');
    assert.equal(result.fullPrompt, 'Hero scene with warm light');
    assert.deepEqual(result.referenceImages, references);
    assert.equal(result.modelLabel, 'Imagen 4');
    assert.equal(result.aspectRatio, '16:9');
    assert.equal(result.imageSize, '2K');
    assert.deepEqual(result.actions, {
      preview: true,
      useAsSource: true,
      partialRedraw: true,
      download: true,
      delete: true,
    });
  });

  test('keeps standalone results and normalizes raw base64 into a data url', () => {
    const image = createImage({
      id: 'image-orphan',
      parentPromptId: 'ghost-prompt',
      prompt: '  Standalone    moodboard  ',
      timestamp: 321,
      mimeType: 'image/jpeg',
      url: 'iVBORw0KGgoAAAANSUhEUgAAAAUA',
      modelLabel: '',
    });

    const [result] = selectMobileFeedResults([], [image]);

    assert.equal(result.id, 'image-orphan');
    assert.equal(result.parentPromptId, 'ghost-prompt');
    assert.equal(result.promptSummary, 'Standalone moodboard');
    assert.equal(
      result.displaySrc,
      'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
    );
    assert.equal(result.fullPrompt, 'Standalone moodboard');
    assert.deepEqual(result.referenceImages, []);
    assert.equal(result.modelLabel, 'default-model');
    assert.equal(result.hasOriginal, false);
  });

  test('falls back to prompt ecommerce labels and inherited redraw labels when image displayLabel is missing', () => {
    const ecommercePrompt = createPromptNode({
      id: 'prompt-ecom',
      prompt: 'Ecommerce prompt',
      ecommerce: {
        kind: 'main-image',
        sourceSheet: '主图',
        sourceRowKey: 'main-1',
        displayLabel: '主图 1:1 4K',
      } as PromptNode['ecommerce'],
    });
    const ecommerceImage = createImage({
      id: 'image-ecom',
      parentPromptId: 'prompt-ecom',
      displayLabel: undefined,
    });
    const redrawImage = createImage({
      id: 'image-redraw',
      parentPromptId: '',
      partialRedraw: {
        sourceImageId: 'source-1',
        sourceImageDimensions: { width: 1, height: 1 },
        selectionRect: { x: 0, y: 0, width: 1, height: 1 },
        generationRect: { x: 0, y: 0, width: 1, height: 1 },
        targetAspectRatio: '1:1' as GeneratedImage['aspectRatio'],
        extraReferenceImageIds: [],
        inheritedDisplayLabel: 'A+ 21:9 4K',
        compositeVersion: 1,
      },
      displayLabel: undefined,
    });

    const results = selectMobileFeedResults([ecommercePrompt], [ecommerceImage, redrawImage]);
    const resultById = new Map(results.map((item) => [item.id, item] as const));

    assert.equal(resultById.get('image-ecom')?.displayLabel, '主图 1:1 4K');
    assert.equal(resultById.get('image-redraw')?.displayLabel, 'A+ 21:9 4K');
  });
  test('does not project follow-up ecommerce actions for framework prompt cards', () => {
    const frameworkPrompt = createPromptNode({
      id: 'prompt-framework',
      prompt: 'Framework prompt',
      ecommerce: {
        kind: 'framework',
        sourceSheet: '主图',
        sourceRowKey: 'framework-root',
        displayLabel: 'Framework root',
        stage: 'ready',
        desktopStage: 'not_applicable',
        mobileStage: 'not_applicable',
      } as PromptNode['ecommerce'],
    });
    const frameworkImage = createImage({
      id: 'image-framework',
      parentPromptId: 'prompt-framework',
      displayLabel: 'Framework image',
    });

    const [result] = selectMobileFeedResults([frameworkPrompt], [frameworkImage]);

    assert.equal(result.ecommerceContinuation, undefined);
  });

  test('projects ecommerce continuation metadata for mobile detail follow-up actions', () => {
    const taskState = {
      taskId: 'task-a-plus-1',
      sourceKind: 'a-plus-module',
      sourceSheet: 'A+',
      sourceRowKey: 'a-plus-row-1',
      theme: 'Summer launch',
      outputTypeLabel: 'A+ 21:9',
      imageRoleSummary: ['product', 'reference-1'],
      sparseUserIntent: '右侧参考图一，左侧保留产品主体和卖点标题',
      copy: {
        headline: 'Headline',
        subheadline: 'Subheadline',
        highlight: 'Highlight',
        featureTags: ['防水', '便携'],
        cta: '立即购买',
      },
      style: {
        tone: '专业冷静',
        atmosphere: '清爽明亮',
        effect: '高光质感',
        backgroundType: 'brand',
      },
      layout: {
        productSize: 'balanced',
        textPosition: 'left',
        accessoryPolicy: 'minimal',
      },
      inherit: {
        keepSeriesStyle: true,
        keepFontStyle: true,
        keepLayoutStyle: true,
        keepCopyStyle: true,
        keepPalette: true,
      },
      assetRoles: [],
      consistencyChecks: [],
      missingFields: [],
      resolvedPromptPreview: 'Resolved prompt preview',
      displayLabel: 'A+ 21:9 4K',
    };
    const prompt = createPromptNode({
      id: 'prompt-a-plus',
      ecommerce: {
        kind: 'a-plus-module',
        sourceSheet: 'A+',
        sourceRowKey: 'a-plus-row-1',
        sizePolicy: 'desktop-then-mobile',
        desktopStage: 'generated',
        mobileStage: 'locked',
        needsReview: true,
        reviewWarnings: ['请确认参考图一是否对应右侧卖点图'],
        editableTask: taskState,
        selectedForGeneration: false,
        displayLabel: 'A+ 21:9 4K',
      } as PromptNode['ecommerce'],
    });
    const image = createImage({
      id: 'image-a-plus',
      parentPromptId: 'prompt-a-plus',
    });

    const [result] = selectMobileFeedResults([prompt], [image]);

    assert.deepEqual(result.ecommerceContinuation, {
      promptNodeId: 'prompt-a-plus',
      taskId: 'task-a-plus-1',
      sourceSheet: 'A+',
      kind: 'a-plus-module',
      sourceRowKey: 'a-plus-row-1',
      outputTypeLabel: 'A+ 21:9',
      displayLabel: 'A+ 21:9 4K',
      declaredSizeText: undefined,
      taskPrompt: '右侧参考图一，左侧保留产品主体和卖点标题',
      assetRoles: [],
      stageLabel: '待复核',
      stageTone: 'amber',
      stageDescription: '先检查运营需求和参考图绑定，再决定是否继续生成。',
      reviewWarnings: ['请确认参考图一是否对应右侧卖点图'],
      selectedForGeneration: false,
      canEditTask: true,
      canConfirmDesktop: true,
      canGenerateMobile: false,
      canToggleSelection: true,
    });
  });
});
