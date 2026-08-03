import assert from 'node:assert/strict';
import { test } from 'node:test';

import { submitCanvasGenerationBatch } from '../../apps/web/src/canvas/canvasGenerationSubmission.ts';
import { GenerationMode, type Canvas, type GenerationConfig, type PromptNode } from '../../apps/web/src/types.ts';
import type { AssistantToolExecutionContext } from '../../apps/web/src/features/ai-assistant-runtime/runtime/AssistantExecutionContext.ts';

const prompt = (id: string, mode: GenerationMode): PromptNode => ({
  id,
  prompt: id,
  position: { x: 0, y: 0 },
  aspectRatio: '1:1',
  imageSize: '1K',
  model: 'gemini-2.5-flash-image',
  childImageIds: [],
  timestamp: 1,
  mode,
  capabilityTags: [mode],
});

const canvas = (promptNodes: PromptNode[]): Canvas => ({
  id: 'canvas-1',
  name: 'Test canvas',
  promptNodes,
  imageNodes: [],
  groups: [],
  drawings: [],
  lastModified: 1,
});

const config = (mode: GenerationMode): GenerationConfig => ({
  prompt: '',
  aspectRatio: '1:1',
  imageSize: '1K',
  referenceImages: [],
  parallelCount: 1,
  model: 'gemini-2.5-flash-image',
  enableGrounding: false,
  mode,
});

const refs = (activeCanvas: Canvas, selectedNodeIds: string[]) => ({
  activeCanvasRef: { current: activeCanvas },
  selectedNodeIdsRef: { current: selectedNodeIds },
});

test('batch submission filters mixed card capabilities and keeps a stable queue key', async () => {
  const activeCanvas = canvas([
    prompt('image-prompt', GenerationMode.IMAGE),
    prompt('video-prompt', GenerationMode.VIDEO),
  ]);
  const selectedNodeIds = ['image-prompt', 'video-prompt'];
  const notices: string[] = [];
  let submitted = 0;
  let input: Record<string, unknown> | null = null;
  const references = refs(activeCanvas, selectedNodeIds);

  await submitCanvasGenerationBatch({
    activeCanvas,
    selectedNodeIds,
    submissionConfig: config(GenerationMode.IMAGE),
    submissionPrompt: 'a quiet studio',
    notify: {
      warning: (_title, message) => notices.push(`warning:${message}`),
      info: (_title, message) => notices.push(`info:${message}`),
      error: (_title, message) => notices.push(`error:${message}`),
    },
    ...references,
    execute: async (_name: string, nextInput: unknown, _context: AssistantToolExecutionContext) => {
      input = nextInput as Record<string, unknown>;
    },
    onSubmitted: () => { submitted += 1; },
  });

  assert.equal(submitted, 1);
  assert.equal((input?.prompts as Array<{ targetNodeId: string }>)[0].targetNodeId, 'image-prompt');
  assert.equal((input?.idempotencyKey as string), input?.clientIdempotencyKey);
  assert.match(notices[0], /跳过 1 张不兼容卡片/);
});

test('batch submission stops without executing when no selected card supports the mode', async () => {
  const activeCanvas = canvas([prompt('video-prompt', GenerationMode.VIDEO)]);
  const references = refs(activeCanvas, ['video-prompt']);
  let executed = false;
  const warnings: string[] = [];

  await submitCanvasGenerationBatch({
    activeCanvas,
    selectedNodeIds: ['video-prompt'],
    submissionConfig: config(GenerationMode.IMAGE),
    submissionPrompt: 'ignored',
    notify: {
      warning: (title, message) => warnings.push(`${title}:${message}`),
      info: () => undefined,
      error: () => undefined,
    },
    ...references,
    execute: async () => {
      executed = true;
    },
    onSubmitted: () => undefined,
  });

  assert.equal(executed, false);
  assert.match(warnings[0], /没有可生成的目标卡片/);
});

test('batch submission reports queue errors without clearing the composer', async () => {
  const activeCanvas = canvas([prompt('image-prompt', GenerationMode.IMAGE)]);
  const references = refs(activeCanvas, ['image-prompt']);
  const errors: string[] = [];
  let submitted = 0;

  await submitCanvasGenerationBatch({
    activeCanvas,
    selectedNodeIds: ['image-prompt'],
    submissionConfig: config(GenerationMode.IMAGE),
    submissionPrompt: 'should fail',
    notify: {
      warning: () => undefined,
      info: () => undefined,
      error: (_title, message) => errors.push(message),
    },
    ...references,
    execute: async () => {
      throw new Error('queue unavailable');
    },
    onSubmitted: () => { submitted += 1; },
  });

  assert.equal(submitted, 0);
  assert.deepEqual(errors, ['queue unavailable']);
});
