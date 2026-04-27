import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('Canvas startup begins project and reference-image disk loads in parallel once folder access is restored', () => {
  const source = readSource('src/context/CanvasContext.tsx');

  assert.match(source, /const projectLoadPromise = traceLocalPerformance\('canvas-startup\.disk-project-load', \(\) => fileSystemService\.loadProjectWithThumbs\(handle\)\);/);
  assert.match(source, /const referenceImageLoadPromise = traceLocalPerformance\('canvas-startup\.reference-image-load', \(\) => fileSystemService\.loadAllReferenceImages\(handle\)\);/);
  assert.match(source, /const \[\{ canvases, images, activeCanvasId: savedActiveCanvasId \}, refUrls\] = await Promise\.all\(\[\s*projectLoadPromise,\s*referenceImageLoadPromise,\s*\]\);/);
});
