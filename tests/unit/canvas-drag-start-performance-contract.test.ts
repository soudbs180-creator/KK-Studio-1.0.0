import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('selected canvas cards start dragging without forcing a front-layer state rewrite', () => {
  const promptSource = readSource('apps/web/src/components/canvas/PromptNodeComponent.tsx');
  const imageSource = readSource('apps/web/src/components/image/ImageCard2.tsx');

  const promptStart = promptSource.indexOf('const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {');
  const promptPointerStart = promptSource.indexOf('// Handle both Mouse and Touch events', promptStart);
  assert.notEqual(promptStart, -1);
  assert.notEqual(promptPointerStart, -1);
  const promptMouseDownSource = promptSource.slice(promptStart, promptPointerStart);

  assert.match(
    promptMouseDownSource,
    /if \(!isSelected\) \{\s*onBringToFront\?\.\(\);\s*onSelect\(\);\s*\}/,
  );
  assert.doesNotMatch(
    promptMouseDownSource,
    /return;\s*\}\s*onBringToFront\?\.\(\);\s*\/\/ Only select if not already selected/,
  );

  const imageStart = imageSource.indexOf('const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {');
  const imagePointerStart = imageSource.indexOf('const clientX =', imageStart);
  const imageSelectStart = imageSource.indexOf('if (!isSelected && onSelect) {', imageStart);
  assert.notEqual(imageStart, -1);
  assert.notEqual(imagePointerStart, -1);
  assert.notEqual(imageSelectStart, -1);

  const imageLeftDragStart = imageSource.indexOf('e.stopPropagation();', imageSource.indexOf('// 阻止事件冒泡到 Canvas', imageStart));
  assert.notEqual(imageLeftDragStart, -1);
  const imagePrePointerSource = imageSource.slice(imageLeftDragStart, imagePointerStart);
  const imageSelectSource = imageSource.slice(imageSelectStart, imageSource.indexOf('dragStartPos.current', imageSelectStart));

  assert.doesNotMatch(imagePrePointerSource, /onBringToFront\?\.\(\);/);
  assert.match(
    imageSelectSource,
    /if \(!isSelected && onSelect\) \{\s*onBringToFront\?\.\(\);/,
  );
});

test('layering and live drag helpers avoid repeated full-canvas drag-start work', () => {
  const layeringSource = readSource('apps/web/src/context/canvasLayering.ts');
  const promptGroupLayoutSource = readSource('apps/web/src/app/usePromptGroupLayout.ts');

  assert.match(layeringSource, /const childImageIdsByPromptId = new Map<string, string\[\]>\(\);/);

  const getPromptGroupStart = layeringSource.indexOf('const getPromptGroupImageIds = (promptId: string) => {');
  const getPromptGroupEnd = layeringSource.indexOf('const pushPromptGroup = (promptId: string) => {', getPromptGroupStart);
  assert.notEqual(getPromptGroupStart, -1);
  assert.notEqual(getPromptGroupEnd, -1);
  const getPromptGroupSource = layeringSource.slice(getPromptGroupStart, getPromptGroupEnd);

  assert.match(getPromptGroupSource, /childImageIdsByPromptId\.get\(promptId\)/);
  assert.doesNotMatch(getPromptGroupSource, /canvas\.imageNodes\.forEach/);

  const deltaStart = promptGroupLayoutSource.indexOf('const applyLiveNodeDeltaToDraggedSet = useCallback((');
  const deltaEnd = promptGroupLayoutSource.indexOf('const handleImageCardHeightChange = useCallback(', deltaStart);
  const liveChangeStart = promptGroupLayoutSource.indexOf('const handleLiveNodePositionChange = useCallback(');
  const liveChangeEnd = promptGroupLayoutSource.indexOf('const shouldAutoRegroupPromptGroup = useCallback(', liveChangeStart);
  assert.notEqual(deltaStart, -1);
  assert.notEqual(deltaEnd, -1);
  assert.notEqual(liveChangeStart, -1);
  assert.notEqual(liveChangeEnd, -1);

  const deltaSource = promptGroupLayoutSource.slice(deltaStart, deltaEnd);
  const liveChangeSource = promptGroupLayoutSource.slice(liveChangeStart, liveChangeEnd);

  assert.equal(deltaSource.match(/syncLiveNodePositionState\(\);/g)?.length, 1);
  assert.equal(liveChangeSource.match(/syncLiveNodePositionState\(\);/g)?.length, 1);
});

test('large canvases disable per-mousemove grid glow effects', () => {
  const infiniteCanvasSource = readSource('apps/web/src/components/canvas/InfiniteCanvas.tsx');
  const workspaceSource = readSource('apps/web/src/pages/Workspace/WorkspacePage.tsx');

  assert.match(infiniteCanvasSource, /reducePointerEffects\?: boolean;/);
  assert.match(infiniteCanvasSource, /if \(!showGrid \|\| reducePointerEffects\) return;/);
  assert.match(
    infiniteCanvasSource,
    /if \(!reducePointerEffects\) \{\s*window\.addEventListener\('mousemove', handleWindowMouseMoveForGlow, \{ passive: true \}\);\s*\}/,
  );
  assert.match(workspaceSource, /reducePointerEffects=\{isLargeProject\}/);
  assert.match(workspaceSource, /<GpuBackground\s*enabled=\{!isLargeProject\}/);
});
