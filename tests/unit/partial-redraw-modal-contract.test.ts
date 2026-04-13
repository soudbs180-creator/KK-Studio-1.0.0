import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('partial redraw modal exposes supported models, supported ratios, selection state, and reference uploads', () => {
  const modalSource = readSource('src/components/image/PartialRedrawModal.tsx');

  assert.match(modalSource, /keyManager\.getGlobalModelList\(\)/);
  assert.match(modalSource, /filter\(\(model\) => modelSupportsPartialRedraw\(model\.id\)\)/);
  assert.match(modalSource, /const hasSupportedModels = availableModels\.length > 0;/);
  assert.match(modalSource, /getPartialRedrawSupportedRatios\(selectedModel\)/);
  assert.match(modalSource, /const \[selectionRect, setSelectionRect\] = useState/);
  assert.match(modalSource, /const generationRect = useMemo\(/);
  assert.match(modalSource, /onMouseDown=\{handleSelectionStart\}/);
  assert.match(modalSource, /onMouseMove=\{handleSelectionMove\}/);
  assert.match(modalSource, /onMouseUp=\{handleSelectionEnd\}/);
  assert.match(modalSource, /type="file"/);
  assert.match(modalSource, /accept="image\/\*"/);
  assert.match(modalSource, /referenceImages\.map\(/);
  assert.match(modalSource, /disabled=\{!canSubmit\}/);
  assert.match(modalSource, /UI_TEXT\.noSupportedModels/);
});
