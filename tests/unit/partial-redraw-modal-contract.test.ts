import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('redraw workspace exposes cross-device tools, model routing, color blocks, and reference uploads', () => {
  const workspaceSource = readSource('apps/web/src/components/image/RedrawWorkspace.tsx');

  assert.match(workspaceSource, /keyManager\.getGlobalModelList\(\)/);
  assert.match(workspaceSource, /isLocalRedrawModel\(model\.id\)/);
  assert.match(workspaceSource, /NANO_BANANA_2_MODEL_ID/);
  assert.match(workspaceSource, /NANO_BANANA_PRO_MODEL_ID/);
  assert.match(workspaceSource, /type RedrawWorkspaceTool = 'pan' \| 'box' \| 'brush' \| 'color';/);
  assert.match(workspaceSource, /const \[brushSize, setBrushSize\] = useState/);
  assert.match(workspaceSource, /assignColorBlockLabels/);
  assert.match(workspaceSource, /buildRedrawPlan/);
  assert.match(workspaceSource, /buildAnnotatedReferenceImage/);
  assert.match(workspaceSource, /onPointerDown=\{handlePointerDown\}/);
  assert.match(workspaceSource, /onPointerMove=\{handlePointerMove\}/);
  assert.match(workspaceSource, /onPointerUp=\{handlePointerUp\}/);
  assert.match(workspaceSource, /type="file"/);
  assert.match(workspaceSource, /accept="image\/\*"/);
  assert.match(workspaceSource, /referenceImages\.map\(/);
  assert.match(workspaceSource, /disabled=\{!canSubmit\}/);
});
