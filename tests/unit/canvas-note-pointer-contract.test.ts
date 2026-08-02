import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { clientPointToCanvasPoint } from '../../apps/web/src/canvas/canvasCoordinates.ts';

test('shared canvas coordinates convert client points for mouse, touch, and pen events', () => {
  assert.deepEqual(clientPointToCanvasPoint(
    { x: 310, y: 220 },
    { left: 10, top: 20 },
    { x: 100, y: 40, scale: 2 },
  ), { x: 100, y: 80 });
  assert.equal(clientPointToCanvasPoint(
    { x: 0, y: 0 },
    { left: 0, top: 0 },
    { x: 0, y: 0, scale: 0 },
  ), null);
});

test('drawing overlay uses one pointer-event path with capture and correct world preview offset', () => {
  const source = fs.readFileSync('apps/web/src/components/canvas/CanvasDrawingInteractionOverlay.tsx', 'utf8');
  assert.match(source, /onPointerDown=\{handlePointerDown\}/);
  assert.match(source, /onPointerMove=\{handlePointerMove\}/);
  assert.match(source, /onPointerUp=/);
  assert.match(source, /onPointerCancel=/);
  assert.match(source, /setPointerCapture/);
  assert.match(source, /releasePointerCapture/);
  assert.match(source, /clientPointToCanvasPoint/);
  assert.match(source, /touchAction: 'none'/);
  assert.match(source, /CANVAS_DRAWING_OVERLAY_ORIGIN_OFFSET/);
  assert.match(source, /touchPointersRef/);
  assert.match(source, /touchGestureRef/);
  assert.match(source, /canvasRef\.current\?\.setView/);
  assert.match(source, /event\.pointerType === 'touch'/);
  assert.doesNotMatch(source, /onMouseDown=|onMouseMove=|onMouseUp=/);
  assert.doesNotMatch(source, /toDataURL|base64/i);
});

test('notebook editing and AI rasterization remain vector-first', () => {
  const noteCard = fs.readFileSync('apps/web/src/components/canvas/CanvasNoteCard.tsx', 'utf8');
  const rasterizer = fs.readFileSync('apps/web/src/canvas/canvasNoteRasterizer.ts', 'utf8');
  assert.match(noteCard, /aria-label="Edit notebook card"/);
  assert.match(rasterizer, /canvas\.toBlob/);
  assert.doesNotMatch(rasterizer, /toDataURL|base64/i);
});

test('canvas groups use pointer capture for mouse touch and pen dragging', () => {
  const source = fs.readFileSync('apps/web/src/components/canvas/CanvasGroupComponent.tsx', 'utf8');
  assert.match(source, /onPointerDown=\{handlePointerDown\}/);
  assert.match(source, /onPointerMove=\{handlePointerMove\}/);
  assert.match(source, /onPointerUp=/);
  assert.match(source, /onPointerCancel=/);
  assert.match(source, /setPointerCapture/);
  assert.doesNotMatch(source, /onMouseDown=\{handleMouseDown\}/);
  assert.doesNotMatch(source, /window\.addEventListener\('mousemove'/);
});
