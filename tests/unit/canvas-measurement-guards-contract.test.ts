import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const imageCardSource = () => readSource('apps/web/src/components/image/ImageCard2.tsx');
const promptNodeSource = () => readSource('apps/web/src/components/canvas/PromptNodeComponent.tsx');

test('image cards only measure in full visible idle state', () => {
  const source = imageCardSource();

  assert.match(source, /detailLevel !== 'full' \|\| isCanvasTransforming \|\| isDragging \|\| !isVisible/);
  assert.match(source, /requestAnimationFrame\(updateHeightAndDensity\)/);
  assert.match(source, /new ResizeObserver\(\(\) => \{/);
  assert.match(source, /if \(isCanvasTransforming \|\| isDragging\) return;/);
});

test('prompt cards avoid measurement observers outside full visible idle state', () => {
  const source = promptNodeSource();

  assert.match(source, /detailLevel !== 'full' \|\| isCanvasTransforming \|\| isDragging \|\| !isVisible/);
  assert.match(source, /new ResizeObserver/);
  assert.match(source, /if \(isCanvasTransforming \|\| isDragging\) return;/);
});
