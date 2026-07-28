import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  buildCanvasV3EdgePath,
  getCanvasV3EdgeStyle,
  getCanvasV3PortHitSize,
  resolveCanvasV3ToolbarPlacement,
} from '../../apps/web/src/canvas/v3/edgeGeometry.ts';

test('Canvas V3 edges are solid cubic curves with screen-space widths', () => {
  const path = buildCanvasV3EdgePath({ x: 20, y: 80 }, { x: 260, y: 160 });
  assert.match(path, /^M 20 80 C /);

  assert.deepEqual(getCanvasV3EdgeStyle('default'), {
    stroke: 'rgba(255, 255, 255, 0.18)',
    strokeWidth: 1,
  });
  assert.deepEqual(getCanvasV3EdgeStyle('selected'), {
    stroke: 'oklch(0.5926 0.2236 258.42)',
    strokeWidth: 1.5,
  });
  assert.equal(getCanvasV3PortHitSize(false), 20);
  assert.equal(getCanvasV3PortHitSize(true), 44);
});

test('Canvas V3 toolbar placement prefers the card right side and avoids collisions', () => {
  const viewport = { left: 0, top: 48, right: 1280, bottom: 720 };
  const card = { left: 400, top: 180, right: 720, bottom: 420 };
  const toolbar = { width: 300, height: 44 };

  assert.equal(resolveCanvasV3ToolbarPlacement(card, toolbar, viewport, []).placement, 'right');
  assert.equal(resolveCanvasV3ToolbarPlacement(
    card,
    toolbar,
    viewport,
    [{ left: 732, top: 180, right: 1100, bottom: 420 }],
  ).placement, 'left');
});

test('Canvas V3 exposes one edge layer and removes dashed renderers', () => {
  const edgeLayer = fs.readFileSync('apps/web/src/canvas/v3/CanvasEdgeLayer.tsx', 'utf8');
  const renderers = [
    fs.readFileSync('apps/web/src/core/canvas/renderers/ImageGenerationGroupRenderer.tsx', 'utf8'),
    fs.readFileSync('apps/web/src/core/canvas/renderers/VideoGenerationGroupRenderer.tsx', 'utf8'),
    fs.readFileSync('apps/web/src/core/canvas/renderers/MultiImageGroupRenderer.tsx', 'utf8'),
  ].join('\n');

  assert.match(edgeLayer, /nonScalingStroke|vectorEffect="non-scaling-stroke"/);
  assert.match(edgeLayer, /CanvasRenderingContext2D/);
  assert.doesNotMatch(edgeLayer, /strokeDasharray|setLineDash\(\[[^\]]/);
  assert.doesNotMatch(renderers, /strokeDasharray|groupConnectorDash/);
});

test('desktop selection toolbar consumes the shared Canvas V3 collision resolver', () => {
  const selectionOverlay = fs.readFileSync('apps/web/src/app/useSelectionMenuOverlay.ts', 'utf8');
  const selectionMenu = fs.readFileSync('apps/web/src/components/canvas/SelectionMenu.tsx', 'utf8');

  assert.match(selectionOverlay, /resolveCanvasV3ToolbarPlacement/);
  assert.doesNotMatch(selectionOverlay, /const doScreenRectsOverlap|const shiftScreenRectRightPastBlocks/);
  assert.doesNotMatch(selectionMenu, /haptic-press|frost-card|active:scale/);
});
