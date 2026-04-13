import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('App passes reusable continue-create and partial-redraw handlers into the mobile result feed', () => {
  const source = readSource('src/App.tsx');

  assert.match(source, /const handleMobileUseImageAsSource = useCallback/);
  assert.match(source, /const handlePartialRedrawRequest = useCallback/);
  assert.match(source, /<MobileResultFeed/);
  assert.match(source, /onUseAsSource=\{handleMobileUseImageAsSource\}/);
  assert.match(source, /onPartialRedraw=\{handlePartialRedrawRequest\}/);
  assert.match(source, /<GlobalLightbox[\s\S]*onPartialRedraw=\{handlePartialRedrawRequest\}/);
});
