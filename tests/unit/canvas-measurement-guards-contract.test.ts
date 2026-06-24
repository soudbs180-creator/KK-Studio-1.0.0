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

test('prompt cards do not install measurement observer while transforming or hidden', () => {
  const source = promptNodeSource();

  assert.match(source, /detailLevel !== 'full' \|\| isCanvasTransforming \|\| isDragging \|\| !isVisible/);
  assert.match(source, /new ResizeObserver/);
  assert.match(source, /if \(isCanvasTransforming \|\| isDragging\) return;/);
});

test('prompt measurement should be frame scheduled instead of direct resize writes', () => {
  const source = promptNodeSource();

  assert.match(source, /requestAnimationFrame\(/, 'Prompt measurement must use rAF scheduling before reading offsetHeight or setting state.');
  assert.doesNotMatch(
    source,
    /new ResizeObserver\(\(entries\) => \{[\s\S]{0,240}updateHeight\(\);[\s\S]{0,80}\}\);/,
    'ResizeObserver callback must not call updateHeight directly; schedule it through requestAnimationFrame.'
  );
});
