import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const imageCardSource = () => readSource('apps/web/src/components/image/ImageCard2.tsx');
const promptNodeSource = () => readSource('apps/web/src/components/canvas/PromptNodeComponent.tsx');

test('image cards only measure in full visible idle state through the measurement scheduler', () => {
  const source = imageCardSource();

  assert.match(source, /CanvasMeasurementScheduler/);
  assert.match(source, /CanvasMeasurementScheduler\.request\(/);
  assert.match(source, /detailLevel !== 'full' \|\| isCanvasTransforming \|\| isDragging \|\| !isVisible/);
  assert.match(source, /new ResizeObserver\(\(\) => \{/);
  assert.match(source, /if \(isCanvasTransforming \|\| isDragging\) return;/);
});

test('prompt cards route height measurement through the shared scheduler', () => {
  const source = promptNodeSource();

  assert.match(source, /CanvasMeasurementScheduler/);
  assert.match(source, /CanvasMeasurementScheduler\.requestHeight\(/);
  assert.match(source, /detailLevel !== 'full' \|\| isCanvasTransforming \|\| isDragging \|\| !isVisible/);
  assert.match(source, /new ResizeObserver/);
  assert.match(source, /if \(isCanvasTransforming \|\| isDragging\) return;/);
});

test('measurement scheduler batches DOM reads behind requestAnimationFrame', () => {
  const source = readSource('apps/web/src/canvas/CanvasMeasurementScheduler.ts');

  assert.match(source, /requestAnimationFrame\(\(\) => \{/);
  assert.match(source, /private static pendingTasks = new Map/);
  assert.match(source, /if \(this\.isLocked\) return/);
  assert.match(source, /el\.offsetHeight/);
});

test('card components route connector updates through the shared scheduler', () => {
  const imageSource = imageCardSource();
  const promptSource = promptNodeSource();

  assert.match(imageSource, /CanvasConnectorScheduler/);
  assert.match(imageSource, /CanvasConnectorScheduler\.request\(/);
  assert.match(promptSource, /CanvasConnectorScheduler/);
  assert.match(promptSource, /CanvasConnectorScheduler\.request\(/);
});

test('connector scheduler batches updates behind requestAnimationFrame with deduplication', () => {
  const source = readSource('apps/web/src/canvas/CanvasConnectorScheduler.ts');

  assert.match(source, /requestAnimationFrame\(\(\) => \{/);
  assert.match(source, /private static pendingUpdates = new Set/);
});

test('connector scheduler avoids redundant DOM updates using a path cache', () => {
  const source = readSource('apps/web/src/canvas/CanvasConnectorScheduler.ts');

  assert.match(source, /private static pathCache = new Map/);
  assert.match(source, /cachedPath !== newPath/);
  assert.match(source, /setAttribute\('d', newPath\)/);
});
