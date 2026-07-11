import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('Card LoD policy covers every registered card through renderer or shell detail levels', () => {
  const registrySource = fs.readFileSync(path.resolve('apps/web/src/core/canvas/renderers/CanvasCardRendererRegistry.ts'), 'utf8');
  const shellSource = fs.readFileSync(path.resolve('apps/web/src/components/canvas/CanvasCardShell.tsx'), 'utf8');
  const multiImageSource = fs.readFileSync(path.resolve('apps/web/src/core/canvas/renderers/MultiImageGroupRenderer.tsx'), 'utf8');
  const unknownSource = fs.readFileSync(path.resolve('apps/web/src/core/canvas/renderers/UnknownCardRenderer.tsx'), 'utf8');

  assert.match(registrySource, /supportsGhost:\s*true/);
  assert.match(registrySource, /canRenderSkeleton:\s*true/);
  assert.match(shellSource, /detailLevel === 'ghost'/);
  assert.match(shellSource, /detailLevel === 'skeleton'/);
  assert.match(multiImageSource, /props\.detailLevel !== 'ghost'/);
  assert.match(multiImageSource, /props\.detailLevel !== 'skeleton'/);
  assert.match(unknownSource, /detailLevel=\{detailLevel\}/);
});
