import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCanvasGenerationIdempotencyKey,
  resolveCanvasGenerationSelection,
} from '../../apps/web/src/canvas/canvasGenerationSelection.ts';
import { GenerationMode, type Canvas, type GeneratedImage, type PromptNode } from '../../apps/web/src/types.ts';

const prompt = (id: string, mode: GenerationMode, capabilityTags?: GenerationMode[]): PromptNode => ({
  id,
  prompt: id,
  position: { x: 0, y: 0 },
  aspectRatio: '1:1',
  imageSize: '1K',
  model: 'gemini-2.5-flash-image',
  childImageIds: [],
  timestamp: 1,
  mode,
  capabilityTags,
});

const image = (id: string, parentPromptId: string): GeneratedImage => ({
  id,
  url: `https://example.test/${id}.png`,
  prompt: id,
  aspectRatio: '1:1',
  imageSize: '1K',
  timestamp: 1,
  model: 'gemini-2.5-flash-image',
  canvasId: 'canvas-1',
  parentPromptId,
  position: { x: 0, y: 0 },
});

const canvas = (promptNodes: PromptNode[], imageNodes: GeneratedImage[] = []): Canvas => ({
  id: 'canvas-1',
  name: 'Test canvas',
  promptNodes,
  imageNodes,
  groups: [],
  drawings: [],
  lastModified: 1,
});

test('mixed media selection keeps only targets compatible with the active mode', () => {
  const result = resolveCanvasGenerationSelection(
    canvas([prompt('image-prompt', GenerationMode.IMAGE), prompt('video-prompt', GenerationMode.VIDEO)]),
    ['image-prompt', 'video-prompt'],
    { mode: GenerationMode.IMAGE },
  );

  assert.deepEqual(result.eligibleTargets.map((target) => target.promptNodeId), ['image-prompt']);
  assert.deepEqual(result.skippedNodeIds, ['video-prompt']);
  assert.deepEqual(result.unsupportedNodeIds, []);
});

test('prompt and child image selection deduplicates to one prompt target', () => {
  const result = resolveCanvasGenerationSelection(
    canvas([prompt('prompt-1', GenerationMode.IMAGE)], [image('image-1', 'prompt-1')]),
    ['image-1', 'prompt-1'],
    { mode: GenerationMode.IMAGE },
  );

  assert.equal(result.eligibleTargets.length, 1);
  assert.equal(result.eligibleTargets[0].promptNodeId, 'prompt-1');
  assert.equal(result.eligibleTargets[0].referenceImageNodeId, undefined);
});

test('capability tags take precedence over a stale card mode', () => {
  const result = resolveCanvasGenerationSelection(
    canvas([prompt('prompt-1', GenerationMode.VIDEO, [GenerationMode.IMAGE])]),
    ['prompt-1'],
    { mode: GenerationMode.IMAGE },
  );

  assert.deepEqual(result.eligibleTargets.map((target) => target.promptNodeId), ['prompt-1']);
  assert.deepEqual(result.skippedNodeIds, []);
});

test('zero eligible targets are reported without silently falling back to a new card', () => {
  const result = resolveCanvasGenerationSelection(
    canvas([prompt('video-prompt', GenerationMode.VIDEO)]),
    ['video-prompt'],
    { mode: GenerationMode.IMAGE },
  );

  assert.equal(result.eligibleTargets.length, 0);
  assert.deepEqual(result.skippedNodeIds, ['video-prompt']);
});

test('selection idempotency key is stable regardless of target ordering', () => {
  const first = createCanvasGenerationIdempotencyKey({
    canvasId: 'canvas-1',
    mode: GenerationMode.IMAGE,
    prompt: 'a quiet studio',
    targetNodeIds: ['b', 'a'],
  });
  const second = createCanvasGenerationIdempotencyKey({
    canvasId: 'canvas-1',
    mode: GenerationMode.IMAGE,
    prompt: 'a quiet studio',
    targetNodeIds: ['a', 'b'],
  });

  assert.equal(first, second);
});
