import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('mobile result feed detail drawer exposes prompt, time, references, continue-create, redraw, and download actions', () => {
  const source = readSource('src/components/mobile/MobileResultFeed.tsx');

  assert.match(source, /PartialRedrawModal/);
  assert.match(source, /formatTimestamp\(activeDetailResult\.timestamp\)/);
  assert.match(source, /activeDetailPrompt\?\.referenceImages/);
  assert.match(source, /参考图/);
  assert.match(source, /继续创作/);
  assert.match(source, /重绘/);
  assert.match(source, /下载/);
  assert.match(source, /onUseAsSource\(activeDetailImage\.id\)/);
  assert.match(source, /onPartialRedraw\(activeDetailImage, request\)/);
  assert.match(source, /onImagePreview\(activeDetailImage\.id\)/);
  assert.match(source, /triggerDownload\(activeDetailResult\)/);
});
