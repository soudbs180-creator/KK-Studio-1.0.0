import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AspectRatio, ImageSize, type RedrawColorBlock, type RedrawRegion } from '../../apps/web/src/types.ts';
import {
  NANO_BANANA_2_MODEL_ID,
  assignColorBlockLabels,
  buildColorBlockInstruction,
  buildMarkedRegionInstruction,
  buildRedrawPlan,
  expandRedrawRect,
  mergeOverlappingRedrawRects,
  resolveEvenSquarePixelRect,
  selectRedrawImageSize,
} from '../../apps/web/src/services/image/redrawCore.ts';

const sourceSize = { width: 4000, height: 3000 };

function region(id: string, x: number, y: number, width: number, height: number): RedrawRegion {
  return {
    id,
    kind: 'rect',
    rect: { x, y, width, height },
  };
}

test('redraw core expands regions and merges overlaps after padding', () => {
  const expanded = expandRedrawRect({ x: 0.2, y: 0.2, width: 0.1, height: 0.1 });

  assert.equal(expanded.x < 0.2, true);
  assert.equal(expanded.y < 0.2, true);
  assert.equal(expanded.width > 0.1, true);
  assert.equal(expanded.height > 0.1, true);

  const merged = mergeOverlappingRedrawRects([
    { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
    { x: 0.25, y: 0.25, width: 0.2, height: 0.2 },
    { x: 0.7, y: 0.7, width: 0.1, height: 0.1 },
  ]);

  assert.equal(merged.length, 2);
});

test('redraw core resolves 1:1 even-pixel crop rectangles', () => {
  const pixelRect = resolveEvenSquarePixelRect(
    { x: 0.31, y: 0.18, width: 0.173, height: 0.091 },
    sourceSize,
  );

  assert.equal(pixelRect.width, pixelRect.height);
  assert.equal(pixelRect.width % 2, 0);
  assert.equal(pixelRect.x >= 0, true);
  assert.equal(pixelRect.y >= 0, true);
  assert.equal(pixelRect.x + pixelRect.width <= sourceSize.width, true);
  assert.equal(pixelRect.y + pixelRect.height <= sourceSize.height, true);
});

test('redraw core routes image sizes to 1K, 2K, or 4K with capability fallback', () => {
  assert.equal(selectRedrawImageSize(900, [ImageSize.SIZE_1K, ImageSize.SIZE_2K]), ImageSize.SIZE_1K);
  assert.equal(selectRedrawImageSize(1800, [ImageSize.SIZE_1K, ImageSize.SIZE_2K]), ImageSize.SIZE_2K);
  assert.equal(selectRedrawImageSize(3200, [ImageSize.SIZE_1K, ImageSize.SIZE_2K]), ImageSize.SIZE_2K);
  assert.equal(selectRedrawImageSize(3200, [ImageSize.SIZE_4K]), ImageSize.SIZE_4K);
});

test('redraw plan keeps whole-image redraw on the requested model and auto aspect ratio', () => {
  const plan = buildRedrawPlan({
    model: 'custom-main-image-model',
    prompt: '让整体更明亮',
    sourceImageDimensions: sourceSize,
    regions: [],
  });

  assert.equal(plan.mode, 'whole-image');
  assert.equal(plan.model, 'custom-main-image-model');
  assert.equal(plan.aspectRatio, AspectRatio.AUTO);
  assert.equal(plan.cropPlans.length, 0);
});

test('redraw plan forces supported local models for regional crops and marked whole-image fallback', () => {
  const regional = buildRedrawPlan({
    model: 'custom-main-image-model',
    prompt: '替换局部材质',
    sourceImageDimensions: sourceSize,
    supportedSizes: [ImageSize.SIZE_1K, ImageSize.SIZE_2K],
    regions: [
      region('a', 0.08, 0.08, 0.08, 0.08),
      region('b', 0.62, 0.62, 0.08, 0.08),
    ],
  });

  assert.equal(regional.mode, 'regional-crops');
  assert.equal(regional.model, NANO_BANANA_2_MODEL_ID);
  assert.equal(regional.aspectRatio, AspectRatio.SQUARE);
  assert.equal(regional.cropPlans.length, 2);

  const marked = buildRedrawPlan({
    model: 'custom-main-image-model',
    prompt: '只修改标记区域',
    sourceImageDimensions: sourceSize,
    regions: [
      region('a', 0.05, 0.05, 0.05, 0.05),
      region('b', 0.28, 0.08, 0.05, 0.05),
      region('c', 0.52, 0.11, 0.05, 0.05),
      region('d', 0.76, 0.14, 0.05, 0.05),
    ],
  });

  assert.equal(marked.mode, 'whole-image-marked');
  assert.equal(marked.model, NANO_BANANA_2_MODEL_ID);
  assert.match(marked.prompt, /只修改/);
  assert.match(buildMarkedRegionInstruction('保持其它区域'), /保持其它区域/);
});

test('redraw core labels same-color blocks A-Z then numbers and builds color prompt', () => {
  const blocks: RedrawColorBlock[] = Array.from({ length: 28 }, (_, index) => ({
    id: `block-${index}`,
    color: '#ef4444',
    label: '',
    rect: { x: 0.01 * index, y: 0.1, width: 0.01, height: 0.02 },
    prompt: index === 0 ? '换成金属质感' : undefined,
  }));

  const labeled = assignColorBlockLabels(blocks);
  assert.equal(labeled[0].label, '红色A');
  assert.equal(labeled[25].label, '红色Z');
  assert.equal(labeled[26].label, '红色1');

  const prompt = buildColorBlockInstruction(labeled, '整体保持原构图');
  assert.match(prompt, /红色A/);
  assert.match(prompt, /换成金属质感/);
  assert.match(prompt, /整体保持原构图/);
});
