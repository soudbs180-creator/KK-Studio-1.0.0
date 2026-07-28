import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

type CanvasSnapToGridModule = {
  CANVAS_GRID_SIZE: number;
  snapCanvasPointToGrid: (
    point: { x: number; y: number },
    options?: { enabled?: boolean; gridSize?: number },
  ) => { x: number; y: number };
};



async function loadCanvasSnapToGridModule(): Promise<CanvasSnapToGridModule> {
  const fullPath = path.join(ROOT_DIR, 'apps/web/src/utils/canvasSnapToGrid.ts');
  assert.equal(existsSync(fullPath), true, 'apps/web/src/utils/canvasSnapToGrid.ts must exist');
  return await import('../../apps/web/src/utils/canvasSnapToGrid.ts') as CanvasSnapToGridModule;
}

test('snap-to-grid helper uses the visible canvas grid size and preserves free drag when disabled', async () => {
  const { CANVAS_GRID_SIZE, snapCanvasPointToGrid } = await loadCanvasSnapToGridModule();

  assert.equal(CANVAS_GRID_SIZE, 16);
  assert.deepEqual(snapCanvasPointToGrid({ x: 23, y: 41 }, { enabled: false }), { x: 23, y: 41 });
  assert.deepEqual(snapCanvasPointToGrid({ x: 23, y: 41 }, { enabled: true }), { x: 16, y: 48 });
  assert.deepEqual(snapCanvasPointToGrid({ x: -9, y: -25 }, { enabled: true }), { x: -16, y: -32 });
  assert.deepEqual(snapCanvasPointToGrid({ x: 25, y: 35 }, { enabled: true, gridSize: 10 }), { x: 30, y: 40 });
});

test('snap-to-grid helper leaves invalid coordinates untouched', async () => {
  const { snapCanvasPointToGrid } = await loadCanvasSnapToGridModule();

  assert.deepEqual(snapCanvasPointToGrid({ x: Number.NaN, y: 41 }, { enabled: true }), { x: Number.NaN, y: 41 });
  assert.deepEqual(snapCanvasPointToGrid({ x: 23, y: Infinity }, { enabled: true }), { x: 23, y: Infinity });
});

test('desktop canvas toolbar exposes a dedicated snap toggle wired to card drags', () => {
  const projectManagerSource = readSource('apps/web/src/components/settings/ProjectManager.tsx');
  const promptCardSource = readSource('apps/web/src/components/canvas/PromptNodeComponent.tsx');
  const imageCardSource = readSource('apps/web/src/components/image/ImageCard2.tsx');
  const workflowCardSource = readSource('apps/web/src/workflow/nodes/WorkflowUtilityCard.tsx');
  const appSource = readSource('apps/web/src/App.tsx');

  assert.match(projectManagerSource, /showSnapToGrid\?: boolean;/);
  assert.match(projectManagerSource, /onToggleSnapToGrid: \(\) => void;/);
  assert.match(projectManagerSource, /data-testid="canvas-snap-to-grid-toggle"/);
  assert.match(projectManagerSource, /<Magnet size=\{16\} \/>/);

  assert.match(promptCardSource, /snapToGrid\?: boolean;/);
  assert.match(promptCardSource, /snapCanvasPointToGrid\(/);
  assert.match(imageCardSource, /snapToGrid\?: boolean;/);
  assert.match(imageCardSource, /snapCanvasPointToGrid\(/);
  assert.match(workflowCardSource, /snapToGrid\?: boolean;/);
  assert.match(workflowCardSource, /snapCanvasPointToGrid\(/);
  assert.match(
    workflowCardSource,
    /onPositionChange\(node\.id,\s*snapCanvasPointToGrid\(\{/,
  );
  assert.doesNotMatch(workflowCardSource, /snapCanvasCoordinate\(nextPosition\.x, zoomScale\)/);
  assert.doesNotMatch(workflowCardSource, /snapCanvasCoordinate\(nextPosition\.y, zoomScale\)/);

  assert.match(appSource, /const \[snapToGrid, setSnapToGrid\] = useState\(false\);/);
  assert.match(appSource, /snapToGrid=\{snapToGrid\}/);
  assert.match(appSource, /onToggleSnapToGrid=\{handleToggleSnapToGrid\}/);
});
