import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('App passes reusable result actions into MobileWorkspaceSurface for preview, continue-create, redraw, download, and delete', () => {
  const source = readSource('src/App.tsx');

  assert.match(source, /const handleMobileUseImageAsSource = useCallback/);
  assert.match(source, /const handlePartialRedrawRequest = useCallback/);
  assert.match(source, /const handleOpenPreview = useCallback/);
  assert.match(source, /<MobileWorkspaceSurface/);
  assert.match(source, /onPreviewImage=\{handleOpenPreview\}/);
  assert.match(source, /onUseResultAsSource=\{handleMobileUseImageAsSource\}/);
  assert.match(source, /onPartialRedraw=\{handlePartialRedrawRequest\}/);
  assert.match(source, /onDeleteImage=\{deleteImageNode\}/);
});
