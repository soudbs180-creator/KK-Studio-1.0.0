import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCanvasCardNodes, type CanvasCreateCardInput } from '../../apps/web/src/context/canvasCardFactory.ts';

const defaults = {
  canvasId: 'canvas-1',
  position: { x: 100, y: 200 },
  now: 1000,
  idFactory: (prefix: string, index = 0) => `${prefix}-${index}`,
};

test('canonical card factory gives every supported kind a visible V2 presentation', () => {
  const cases: CanvasCreateCardInput[] = [
    { kind: 'prompt-result-group', media: [{ url: 'https://example.test/a.png' }] },
    { kind: 'prompt-only' },
    { kind: 'media-only', media: [{ url: 'https://example.test/a.png' }] },
    { kind: 'ecommerce' },
    { kind: 'ppt-deck', pptSlides: ['one', 'two'] },
    { kind: 'audio', media: [{ url: 'https://example.test/a.mp3', mimeType: 'audio/mpeg' }] },
    { kind: 'text' },
    { kind: 'notebook', noteElements: [] },
    { kind: 'multi-image', media: [{ url: 'https://example.test/a.png' }, { url: 'https://example.test/b.png' }] },
    { kind: 'workflow-panel', workflowSteps: [{ label: 'Generate' }] },
    { kind: 'unknown', diagnostic: 'legacy payload' },
  ];

  cases.forEach((input) => {
    const result = createCanvasCardNodes(input, defaults);
    const primary = [...result.promptNodes, ...result.imageNodes, ...result.noteNodes, ...result.workflowNodes]
      .find((node) => node.id === result.primaryNodeId);
    assert.ok(primary, `${input.kind} must produce a primary node`);
    assert.equal(primary.presentation?.version, 2);
    assert.equal(primary.presentation?.kind, input.kind);
  });
});

test('audio factory output is a playable media node without fabricated duration', () => {
  const result = createCanvasCardNodes({
    kind: 'audio',
    prompt: 'voice over',
    media: [{ url: 'https://example.test/voice.mp3', mimeType: 'audio/mpeg' }],
  }, defaults);

  assert.equal(result.imageNodes.length, 1);
  assert.equal(result.imageNodes[0].mode, 'audio');
  assert.equal(result.imageNodes[0].url, 'https://example.test/voice.mp3');
  assert.equal('duration' in result.imageNodes[0], false);
});

test('media cards reject missing URLs instead of rendering blank cards', () => {
  assert.throws(() => createCanvasCardNodes({ kind: 'media-only' }, defaults), /require at least one media URL/);
});

test('ecommerce factory output opens as a real framework workbench card', () => {
  const result = createCanvasCardNodes({
    kind: 'ecommerce',
    title: 'Summer collection',
    prompt: 'Build storefront assets',
  }, defaults);

  assert.equal(result.promptNodes[0].mode, 'ecommerce');
  assert.equal(result.promptNodes[0].ecommerce?.kind, 'framework');
  assert.equal(result.promptNodes[0].ecommerce?.displayLabel, 'Summer collection');
});

test('legacy canvas creation tool names contain no unreachable side-path implementations', () => {
  const tools = fs.readFileSync('apps/web/src/features/ai-assistant-runtime/tools/canvasTools.ts', 'utf8');
  assert.match(tools, /name: 'canvas\.createPromptCards'[\s\S]*?createCardThroughFactory/);
  assert.match(tools, /name: 'canvas\.createAudioCard'[\s\S]*?createCardThroughFactory/);
  assert.doesNotMatch(tools, /takeover_ppt_|takeover_img_|new Audio\(\)|addAudioNode/);
});
