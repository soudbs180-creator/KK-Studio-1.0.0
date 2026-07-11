import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { getCanvasSceneNodes } from '../../apps/web/src/canvas/canvasSceneGeometry.ts';

test('scene adapter gives every active canvas surface one shared geometry contract', () => {
  const canvas = {
    id: 'canvas-1',
    name: 'Scene',
    lastModified: 1,
    drawings: [],
    promptNodes: [{
      id: 'prompt-1',
      prompt: 'Prompt',
      position: { x: 100, y: 200 },
      height: 160,
      childImageIds: ['image-1'],
      timestamp: 10,
      presentation: { version: 2, kind: 'prompt-result-group', layoutMode: 'column', size: 'standard', ports: { source: 'bottom', target: 'top' } },
    }],
    imageNodes: [{
      id: 'image-1',
      position: { x: 100, y: 520 },
      parentPromptId: 'prompt-1',
      timestamp: 11,
      presentation: { version: 2, kind: 'media-only', layoutMode: 'column', size: 'compact', ports: { source: 'bottom', target: 'top' } },
    }],
    noteNodes: [{
      id: 'note-1',
      title: 'Note',
      position: { x: 600, y: 300 },
      width: 320,
      height: 180,
      elements: [],
      presentation: { version: 2, kind: 'notebook', layoutMode: 'column', size: 'standard', ports: { source: 'bottom', target: 'top' } },
      createdAt: 12,
      updatedAt: 12,
    }],
    workflow: {
      nodes: [{
        id: 'workflow-1',
        kind: 'workflow-panel',
        position: { x: 900, y: 420 },
        width: 420,
        height: 420,
        data: { status: 'paused' },
        presentation: { version: 2, kind: 'workflow-panel', layoutMode: 'column', size: 'wide', ports: { source: 'bottom', target: 'top' } },
      }],
      edges: [],
    },
    groups: [{
      id: 'group-1',
      label: 'Group',
      nodeIds: ['prompt-1', 'image-1'],
      bounds: { x: -80, y: 20, width: 360, height: 540 },
    }],
  } as any;

  const nodes = getCanvasSceneNodes(canvas);
  assert.deepEqual(nodes.map((node) => node.nodeType), ['prompt', 'media', 'workflow', 'note', 'group']);
  assert.deepEqual(nodes.find((node) => node.id === 'prompt-1')?.childNodeIds, ['image-1']);
  assert.equal(nodes.find((node) => node.id === 'image-1')?.parentNodeId, 'prompt-1');
  assert.equal(nodes.find((node) => node.id === 'workflow-1')?.status, 'paused');
  assert.deepEqual(nodes.find((node) => node.id === 'group-1')?.memberNodeIds, ['prompt-1', 'image-1']);
});

test('shared SceneNode contract is consumed by geometry and AI runtime state', () => {
  const shared = fs.readFileSync('packages/shared/src/contracts/dto/workspace-canvas.ts', 'utf8');
  const geometry = fs.readFileSync('apps/web/src/canvas/canvasSceneGeometry.ts', 'utf8');
  const runtime = fs.readFileSync('apps/web/src/features/ai-takeover/core/canvasRuntimeStateBuilder.ts', 'utf8');

  assert.match(shared, /export interface CanvasSceneNode/);
  assert.match(shared, /nodeType: CanvasSceneNodeType/);
  assert.match(geometry, /getCanvasSceneNodes/);
  assert.match(runtime, /const sceneNodes = getCanvasSceneNodes/);
  assert.doesNotMatch(runtime, /promptNodes\.forEach\(\(node: any\) => countCard/);
});
