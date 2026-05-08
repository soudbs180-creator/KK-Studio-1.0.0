import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { resolvePromptChildImageIds } from '../../src/context/canvasPromptChildImages.ts';
import type { GeneratedImage, PromptNode } from '../../src/types.ts';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '';
}

function promptNode(input: Partial<Pick<PromptNode, 'id' | 'childImageIds' | 'sourceImageId'>>): Pick<PromptNode, 'id' | 'childImageIds' | 'sourceImageId'> {
  return {
    id: input.id ?? 'prompt-1',
    childImageIds: input.childImageIds ?? [],
    sourceImageId: input.sourceImageId,
  };
}

function imageNode(input: Partial<GeneratedImage> & Pick<GeneratedImage, 'id'>): GeneratedImage {
  return {
    id: input.id,
    url: input.url ?? `https://example.test/${input.id}.png`,
    prompt: input.prompt ?? 'prompt',
    aspectRatio: input.aspectRatio ?? '1:1',
    timestamp: input.timestamp ?? 1,
    model: input.model ?? 'test-model',
    canvasId: input.canvasId ?? 'canvas-1',
    parentPromptId: input.parentPromptId ?? '',
    position: input.position ?? { x: 0, y: 0 },
    ...input,
  };
}

test('prompt child image resolver boundary lives outside CanvasContext', () => {
  const contextSource = readSource('src/context/CanvasContext.tsx');
  const helperSource = readSource('src/context/canvasPromptChildImages.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-prompt-child-images-runtime-contract\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasPromptChildImages';/);
  assert.match(helperSource, /export function resolvePromptChildImageIds/);
  assert.doesNotMatch(contextSource, /const resolvePromptChildImageIds =/);
});

test('strong prompt ownership preserves listed order and appends unlisted owned images', () => {
  const prompt = promptNode({
    id: 'prompt-1',
    childImageIds: ['owned-2', 'missing', '', 'owned-1', 'owned-2', 'source-1'],
    sourceImageId: 'source-1',
  });
  const images = [
    imageNode({ id: 'owned-1', parentPromptId: 'prompt-1' }),
    imageNode({ id: 'owned-2', parentPromptId: 'prompt-1' }),
    imageNode({ id: 'owned-3', parentPromptId: 'prompt-1' }),
    imageNode({ id: 'source-1', parentPromptId: 'prompt-1' }),
    imageNode({ id: 'foreign', parentPromptId: 'prompt-2' }),
  ];

  assert.deepEqual(resolvePromptChildImageIds(prompt, images), ['owned-2', 'owned-1', 'owned-3']);
});

test('source image prevents legacy fallback when no strong children exist', () => {
  const prompt = promptNode({
    id: 'prompt-1',
    childImageIds: ['legacy-1', 'legacy-2'],
    sourceImageId: 'source-1',
  });
  const images = [
    imageNode({ id: 'legacy-1', parentPromptId: '' }),
    imageNode({ id: 'legacy-2', parentPromptId: '' }),
  ];

  assert.deepEqual(resolvePromptChildImageIds(prompt, images), []);
});

test('legacy fallback returns only unparented listed children when no strong children exist', () => {
  const prompt = promptNode({
    id: 'prompt-1',
    childImageIds: ['legacy-2', 'legacy-1', 'legacy-2', 'foreign', 'missing'],
  });
  const images = [
    imageNode({ id: 'legacy-1', parentPromptId: '' }),
    imageNode({ id: 'legacy-2', parentPromptId: '' }),
    imageNode({ id: 'foreign', parentPromptId: 'prompt-2' }),
  ];

  assert.deepEqual(resolvePromptChildImageIds(prompt, images), ['legacy-2', 'legacy-1']);
});
