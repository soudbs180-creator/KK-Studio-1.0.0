import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('live position cleanup is emitted as null instead of a synthetic origin position', () => {
  const store = read('apps/web/src/app/canvasLivePositionStore.ts');

  assert.match(store, /export type PositionListener = \(position: Point \| null\) => void;/);
  assert.match(store, /nodeListeners\.forEach\(\(listener\) => listener\(position\)\);/);
  assert.match(store, /nodeListeners\.forEach\(\(listener\) => listener\(null\)\);/);
  assert.doesNotMatch(store, /listener\(position \|\| \{ x: 0, y: 0 \}\)/);
  assert.doesNotMatch(store, /listener\(\{ x: 0, y: 0 \}\)/);
});

test('prompt and image shells keep persistent position in left and top only', () => {
  const prompt = read('apps/web/src/components/canvas/PromptNodeComponent.tsx');
  const image = read('apps/web/src/components/image/ImageCard2.tsx');

  for (const source of [prompt, image]) {
    assert.match(source, /positioning=\{isChatMode \? 'flow' : 'world'\}/);
    assert.doesNotMatch(
      source,
      /transform:\s*`translate3d\(\$\{renderLeft - originX\}px,\s*\$\{renderTop - originY\}px,\s*0px\)`/,
    );
  }
});

test('prompt live movement uses a relative transient transform', () => {
  const prompt = read('apps/web/src/components/canvas/PromptNodeComponent.tsx');
  const subscribeStart = prompt.indexOf(
    'const unsubscribe = canvasLivePositionStore.subscribe(node.id, (pos) => {',
  );
  const subscribeEnd = prompt.indexOf('return () => unsubscribe();', subscribeStart);

  assert.notEqual(subscribeStart, -1);
  assert.notEqual(subscribeEnd, -1);

  const subscription = prompt.slice(subscribeStart, subscribeEnd);
  assert.match(subscription, /const currentLeft = parseFloat\(containerRef\.current\.style\.left\) \|\| 0;/);
  assert.match(subscription, /const currentTop = parseFloat\(containerRef\.current\.style\.top\) \|\| 0;/);
  assert.match(subscription, /const nextTranslateX = renderLeft - originX - currentLeft;/);
  assert.match(subscription, /const nextTranslateY = renderTop - originY - currentTop;/);
  assert.doesNotMatch(
    subscription,
    /translate3d\(\$\{renderLeft - originX\}px,\s*\$\{renderTop - originY\}px,\s*0px\)/,
  );
});

test('a dragged card does not consume its own live-position broadcast', () => {
  const prompt = read('apps/web/src/components/canvas/PromptNodeComponent.tsx');
  const image = read('apps/web/src/components/image/ImageCard2.tsx');

  for (const source of [prompt, image]) {
    const subscribeStart = source.indexOf('canvasLivePositionStore.subscribe(');
    const subscribeEnd = source.indexOf('return () => unsubscribe();', subscribeStart);
    const subscription = source.slice(subscribeStart, subscribeEnd);

    assert.match(subscription, /if \(isDraggingRef\.current\) return;/);
  }
});

test('prompt drag freezes its coordinate frame from pointer down through commit', () => {
  const prompt = read('apps/web/src/components/canvas/PromptNodeComponent.tsx');
  const dragStart = prompt.indexOf('const handleMouseDown =');
  const dragUpdate = prompt.indexOf('const updateDragPosition =', dragStart);
  const dragEnd = prompt.indexOf('const handleMouseUp =', dragUpdate);
  const pointerDown = prompt.slice(dragStart, dragUpdate);
  const pointerMove = prompt.slice(dragUpdate, dragEnd);
  const pointerUp = prompt.slice(dragEnd, prompt.indexOf('useEffect(() => {', dragEnd));

  assert.match(pointerDown, /dragRenderMetricsRef\.current = \{[\s\S]*zoomScale: zoomScale \|\| 1,[\s\S]*nodeId: node\.id,/);
  assert.match(pointerMove, /const scale = dragRenderMetricsRef\.current\.zoomScale;/);
  assert.match(pointerUp, /const scale = dragRenderMetricsRef\.current\.zoomScale;/);
});
