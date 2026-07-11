import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('Card Render Policy keeps real prompt groups atomic and damaged cards diagnostic', () => {
  const registryPath = path.resolve('apps/web/src/core/canvas/renderers/CanvasCardRendererRegistry.ts');
  const source = fs.readFileSync(registryPath, 'utf8');

  assert.match(source, /hasMainCard: false/);
  assert.match(source, /hasResultCards: false/);
  assert.match(source, /atomicGroup: false/);
  assert.match(source, /image-generation-group[\s\S]{0,220}hasMainCard: true[\s\S]{0,120}atomicGroup: true/);
  assert.match(source, /video-generation-group[\s\S]{0,220}hasMainCard: true[\s\S]{0,120}atomicGroup: true/);
  assert.match(source, /if \(presentationKind === 'multi-image'\) return 'multi-image-group'/);
  assert.match(source, /presentation\?\.kind === 'unknown'/);
  assert.match(source, /return 'image-generation-group'/);
  assert.doesNotMatch(source, /ecommerce-task-card|ppt-slide-card|ppt-deck-card|music-task-card/);
});
