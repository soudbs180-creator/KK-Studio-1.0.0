import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createCanvasConnectionOnCanvas,
  moveCanvasDrawingsOnCanvas,
  updateCanvasDrawingsOnCanvas,
} from '../../apps/web/src/context/canvasDrawingConnectionOperations.ts';
import type { Canvas } from '../../apps/web/src/types.ts';

const canvas = (): Canvas => ({
  id: 'canvas-1',
  name: 'Canvas',
  promptNodes: [{ id: 'prompt-1', prompt: '', position: { x: 0, y: 0 }, aspectRatio: '1:1', imageSize: '1K', model: 'model', childImageIds: [], timestamp: 1 }],
  imageNodes: [{ id: 'image-1', url: '', prompt: '', position: { x: 400, y: 0 }, aspectRatio: '1:1', timestamp: 1, model: 'model', canvasId: 'canvas-1', parentPromptId: '', }],
  groups: [],
  drawings: [{ id: 'drawing-1', type: 'line', points: [{ x: 1, y: 2 }, { x: 5, y: 6 }], color: '#ef4444', width: 2 }],
  connections: [],
  lastModified: 1,
});

test('drawing operations update selected vectors without touching other drawings', () => {
  const original = canvas();
  const updated = updateCanvasDrawingsOnCanvas(original, ['drawing-1'], { color: '#3b82f6', width: 4 });
  const moved = moveCanvasDrawingsOnCanvas(updated, ['drawing-1'], { x: 10, y: -2 });
  assert.equal(moved.drawings[0].color, '#3b82f6');
  assert.equal(moved.drawings[0].width, 4);
  assert.deepEqual(moved.drawings[0].points, [{ x: 11, y: 0 }, { x: 15, y: 4 }]);
});

test('independent connection ports are inferred from node placement', () => {
  const result = createCanvasConnectionOnCanvas(canvas(), 'prompt-1', 'image-1', () => 'abc');
  assert.deepEqual(result, {
    id: 'connection-abc',
    sourceNodeId: 'prompt-1',
    targetNodeId: 'image-1',
    sourcePort: 'right',
    targetPort: 'left',
    style: 'solid',
    createdAt: result?.createdAt,
    updatedAt: result?.updatedAt,
  });
});
