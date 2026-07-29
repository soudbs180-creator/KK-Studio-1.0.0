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

test('workflow utility drag commits the final pointer before clearing its drag session', () => {
  const workflowUtility = read('apps/web/src/workflow/nodes/WorkflowUtilityCard.tsx');
  const stopStart = workflowUtility.indexOf('const stopDrag =');
  const stopEnd = workflowUtility.indexOf('const startDrag =', stopStart);
  const stopDrag = workflowUtility.slice(stopStart, stopEnd);

  assert.notEqual(stopStart, -1);
  assert.notEqual(stopEnd, -1);
  assert.match(workflowUtility, /const dragCleanupRef = useRef<\(\(\) => void\) \| null>\(null\);/);
  assert.match(stopDrag, /latestPointerRef\.current = \{ x: event\.clientX, y: event\.clientY \};/);
  assert.match(stopDrag, /cancelAnimationFrame\(frameRef\.current\);/);
  assert.match(stopDrag, /flushDrag\(\);/);
  assert.match(stopDrag, /dragCleanupRef\.current\?\.\(\);/);
  assert.ok(
    stopDrag.indexOf('flushDrag();') < stopDrag.indexOf('dragRef.current = null;'),
    'the final pointer must be committed before drag state is cleared',
  );
});

test('canvas groups keep one persistent transform coordinate source', () => {
  const group = read('apps/web/src/components/canvas/CanvasGroupComponent.tsx');
  const styleStart = group.indexOf('style={{');
  const styleEnd = group.indexOf('}}', styleStart);
  const surfaceStyle = group.slice(styleStart, styleEnd);
  const transformDeclarations = surfaceStyle.match(
    /transform:\s*`translate\(\$\{renderedBounds\.x\}px,\s*\$\{renderedBounds\.y\}px\)`/g,
  ) ?? [];

  assert.equal(transformDeclarations.length, 1);
});

test('auxiliary cards use one transient DOM drag path and commit state once on release', () => {
  const dragHook = read('apps/web/src/components/canvas/useTransientCanvasCardDrag.ts');
  const workflowPanel = read('apps/web/src/components/canvas/WorkflowPanelCard.tsx');
  const note = read('apps/web/src/components/canvas/CanvasNoteCard.tsx');

  assert.match(dragHook, /window\.requestAnimationFrame\(flushPendingTransform\)/);
  assert.match(dragHook, /element\.style\.transform = `translate3d\(/);
  assert.match(dragHook, /onPositionChange\(finalPosition\);/);
  assert.match(dragHook, /committedPositionRef\.current = finalPosition;/);

  for (const source of [workflowPanel, note]) {
    assert.match(source, /useTransientCanvasCardDrag/);
    assert.match(source, /ref=\{cardRef\}/);
    assert.match(source, /\{\.\.\.dragHandleProps\}/);
    assert.doesNotMatch(source, /onPointerMove=\{\(event\) => \{[\s\S]{0,320}onPositionChange\(/);
  }
});

test('responsive browser smoke measures settled desktop auxiliary-card drags', () => {
  const smoke = read('scripts/test/verify-canvas-responsive-cdp.mjs');

  assert.match(smoke, /id: "note-responsive"/);
  assert.match(smoke, /id: "workflow-panel-responsive"/);
  assert.match(smoke, /async function verifyDesktopAuxiliaryCardDrag/);
  assert.match(smoke, /postReleaseDrift/);
  assert.match(smoke, /during\.transform/);
  assert.match(smoke, /settled\.transform/);
});
