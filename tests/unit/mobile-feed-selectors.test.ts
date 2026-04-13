import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { GeneratedImage, PromptNode } from '../../src/types.ts';
import { selectMobileFeedResults } from '../../src/components/mobile/mobileFeedSelectors.ts';

function createPromptNode(overrides: Partial<PromptNode> = {}): PromptNode {
  return {
    id: 'prompt-default',
    prompt: 'Default prompt',
    originalPrompt: 'Default prompt',
    childImageIds: [],
    timestamp: 0,
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
      ['image-alpha', 'image-beta', 'image-gamma'],
    );
    assert.deepEqual(
      results.map((item) => item.timestamp),
      [900, 900, 700],
    );
    assert.deepEqual(
      results.map((item) => item.parentPromptId),
      ['prompt-alpha', 'prompt-beta', null],
    );
  });

  test('derives prompt summary, source, and detail entry from the parent prompt', () => {
    const prompt = createPromptNode({
      id: 'prompt-hero',
      originalPrompt: '  Hero   scene   with   warm light  ',
      prompt: 'Fallback prompt',
      timestamp: 1234,
    });
    const image = createImage({
      id: 'image-hero',
      parentPromptId: 'prompt-hero',
      prompt: 'Image prompt should not win',
      timestamp: 0,
      originalUrl: 'https://example.com/original.png',
      apiResultUrl: 'https://example.com/api.png',
      url: 'https://example.com/fallback.png',
    });

    const [result] = selectMobileFeedResults([prompt], [image]);

    assert.equal(result.id, 'image-hero');
    assert.equal(result.primaryImageSource, 'https://example.com/original.png');
    assert.equal(result.timestamp, 1234);
    assert.equal(result.parentPromptId, 'prompt-hero');
    assert.equal(result.promptSummary, 'Hero scene with warm light');
    assert.equal(result.detailEntryId, 'image-hero');
    assert.deepEqual(result.detailEntry, {
      imageId: 'image-hero',
      promptId: 'prompt-hero',
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
    });

    const [result] = selectMobileFeedResults([], [image]);

    assert.equal(result.id, 'image-orphan');
    assert.equal(result.parentPromptId, 'ghost-prompt');
    assert.equal(result.promptSummary, 'Standalone moodboard');
    assert.equal(
      result.primaryImageSource,
      'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
    );
    assert.equal(result.detailEntryId, 'image-orphan');
    assert.deepEqual(result.detailEntry, {
      imageId: 'image-orphan',
      promptId: 'ghost-prompt',
    });
  });
});
