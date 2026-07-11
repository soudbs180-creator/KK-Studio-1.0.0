import assert from 'node:assert/strict';
import test from 'node:test';
import { arrangeCanvasSceneNodes, getCanvasArrangeRootNodeIds } from '../../apps/web/src/context/canvasSceneArrange.ts';

const baseCanvas = () => ({
  id: 'canvas-1',
  name: 'Arrange',
  lastModified: 1,
  promptNodes: [{
    id: 'prompt-1',
    prompt: 'root',
    position: { x: 0, y: 200 },
    height: 200,
    childImageIds: ['image-1'],
    timestamp: 1,
  }],
  imageNodes: [{
    id: 'image-1',
    url: 'https://example.test/1.png',
    prompt: '',
    aspectRatio: '1:1',
    timestamp: 1,
    canvasId: 'canvas-1',
    parentPromptId: 'prompt-1',
    position: { x: 0, y: 600 },
  }],
  noteNodes: [{
    id: 'note-1',
    title: 'Note',
    position: { x: 700, y: 240 },
    width: 320,
    height: 240,
    elements: [],
    presentation: { version: 2, kind: 'notebook', layoutMode: 'column', size: 'standard', ports: { source: 'bottom', target: 'top' } },
    createdAt: 1,
    updatedAt: 1,
  }],
  workflow: {
    version: 1,
    nodes: [{
      id: 'workflow-1',
      kind: 'workflow-panel',
      position: { x: 1300, y: 420 },
      width: 420,
      height: 420,
      data: { title: 'Flow', status: 'idle', steps: [], outputNodeIds: [] },
      presentation: { version: 2, kind: 'workflow-panel', layoutMode: 'column', size: 'wide', ports: { source: 'bottom', target: 'top' } },
    }],
    edges: [],
  },
  groups: [],
  drawings: [],
} as any);

test('scene arrange supports notebook and workflow cards in the same row', () => {
  const source = baseCanvas();
  const result = arrangeCanvasSceneNodes(source, ['note-1', 'workflow-1'], 'row', { now: () => 10 });
  assert.ok(result);
  const note = result?.canvas.noteNodes?.[0];
  const workflow = result?.canvas.workflow?.nodes[0];
  assert.ok(note && workflow);
  assert.ok(note.position.x < workflow.position.x);
  assert.equal(note.updatedAt, 10);
  assert.deepEqual(result?.canvas.promptNodes[0].position, source.promptNodes[0].position);
});

test('global arrange roots keep prompt children atomic and include auxiliary cards', () => {
  const source = baseCanvas();
  const roots = getCanvasArrangeRootNodeIds(source);
  assert.equal(roots.includes('prompt-1'), true);
  assert.equal(roots.includes('image-1'), false);
  assert.equal(roots.includes('note-1'), true);
  assert.equal(roots.includes('workflow-1'), true);

  const result = arrangeCanvasSceneNodes(source, roots, 'column', { now: () => 11 });
  const prompt = result?.canvas.promptNodes[0];
  const image = result?.canvas.imageNodes[0];
  assert.ok(prompt && image);
  assert.equal(image.position.x - prompt.position.x, 0);
  assert.equal(image.position.y - prompt.position.y, 400);
  assert.equal(prompt.presentation?.layoutMode, 'column');
});

test('group arrangement moves every member and its persisted bounds together', () => {
  const source = baseCanvas();
  source.groups = [{
    id: 'group-1',
    nodeIds: ['prompt-1', 'image-1'],
    bounds: { x: -200, y: -40, width: 400, height: 680 },
    type: 'custom',
  }];
  const originalPrompt = { ...source.promptNodes[0].position };
  const result = arrangeCanvasSceneNodes(source, ['group-1', 'note-1'], 'row', { now: () => 12 });
  assert.ok(result);
  const movedPrompt = result?.canvas.promptNodes[0].position;
  const movedImage = result?.canvas.imageNodes[0].position;
  assert.ok(movedPrompt && movedImage);
  assert.equal(movedPrompt.x - originalPrompt.x, movedImage.x - source.imageNodes[0].position.x);
  assert.equal(result?.canvas.groups[0].bounds.width, 400);
  assert.equal(result?.canvas.groups[0].bounds.height, 680);
});
