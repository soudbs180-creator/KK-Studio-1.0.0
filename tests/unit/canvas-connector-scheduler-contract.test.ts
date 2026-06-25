import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const connectorSchedulerSource = () => readSource('apps/web/src/canvas/CanvasConnectorScheduler.ts');
const livePositionStoreSource = () => readSource('apps/web/src/app/canvasLivePositionStore.ts');
const imageCardSource = () => readSource('apps/web/src/components/image/ImageCard2.tsx');
const promptNodeSource = () => readSource('apps/web/src/components/canvas/PromptNodeComponent.tsx');

test('connector scheduler batches connector path writes behind requestAnimationFrame', () => {
  const source = connectorSchedulerSource();

  assert.match(source, /private static pendingUpdates = new Set<string>/);
  assert.match(source, /private static pathCache = new Map<string, string>/);
  assert.match(source, /requestAnimationFrame\(\(\) => \{/);
  assert.match(source, /private static flush\(\)/);
});

test('connector scheduler only writes svg path when the path changes', () => {
  const source = connectorSchedulerSource();

  assert.match(source, /const cachedPath = this\.pathCache\.get\(cacheKey\)/);
  assert.match(source, /if \(cachedPath !== newPath\) \{/);
  assert.match(source, /pathEl\.setAttribute\('d', newPath\)/);
  assert.match(source, /this\.pathCache\.set\(cacheKey, newPath\)/);
});

test('legacy connector update api forwards to the shared scheduler', () => {
  const source = livePositionStoreSource();

  assert.match(source, /import \{ CanvasConnectorScheduler \}/);
  assert.match(source, /export function updateConnectorDom\(promptId: string, imageId: string, sync = true\)/);
  assert.match(source, /CanvasConnectorScheduler\.request\(promptId, imageId, sync\)/);
});

test('prompt and image cards request connector updates through the scheduler', () => {
  const imageSource = imageCardSource();
  const promptSource = promptNodeSource();

  assert.match(imageSource, /CanvasConnectorScheduler\.request\(image\.parentPromptId, image\.id/);
  assert.match(promptSource, /CanvasConnectorScheduler\.request\(node\.id, childImageId\)/);
});
