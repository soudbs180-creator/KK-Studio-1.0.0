import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('all active business card surfaces expose the unified shell semantics', () => {
  const prompt = read('apps/web/src/components/canvas/PromptNodeComponent.tsx');
  const image = read('apps/web/src/components/image/ImageCard2.tsx');
  const shell = read('apps/web/src/components/canvas/CanvasCardShell.tsx');

  for (const source of [prompt, image, shell]) {
    assert.match(source, /data-card-kind/);
    assert.match(source, /data-layout-mode/);
    assert.match(source, /data-detail-level/);
    assert.match(source, /canvas-card-shell/);
  }
});

test('PPT deck uses one real deck card instead of scattered page cards', () => {
  const renderer = read('apps/web/src/core/canvas/renderers/ImageGenerationGroupRenderer.tsx');
  const prompt = read('apps/web/src/components/canvas/PromptNodeComponent.tsx');

  assert.match(renderer, /isSingleDeckCard = node\.presentation\?\.kind === 'ppt-deck'/);
  assert.match(renderer, /renderedChildLayouts = isSingleDeckCard \? \[\] : childVisualLayouts/);
  assert.match(prompt, /pptDeck\.pages\.slice\(0, 6\)/);
  assert.match(prompt, /pptDeck\.lastThumbnailUrl/);
});

test('fake business renderers cannot be restored as side paths', () => {
  const registry = read('apps/web/src/core/canvas/renderers/CanvasCardRendererRegistry.ts');
  for (const path of [
    'apps/web/src/core/canvas/renderers/EcommerceTaskCardRenderer.tsx',
    'apps/web/src/core/canvas/renderers/PptSlideCardRenderer.tsx',
    'apps/web/src/core/canvas/renderers/PptDeckCardRenderer.tsx',
    'apps/web/src/core/canvas/renderers/MusicTaskCardRenderer.tsx',
  ]) {
    assert.equal(fs.existsSync(path), false, `${path} must remain removed`);
  }
  assert.match(registry, /presentationKind === 'ppt-deck'/);
  assert.match(registry, /presentationKind === 'audio'/);
  assert.doesNotMatch(registry, /import (?:EcommerceTask|PptSlide|PptDeck|MusicTask)CardRenderer/);
});

test('multi-image cards persist fold and primary-image controls', () => {
  const renderer = read('apps/web/src/core/canvas/renderers/MultiImageGroupRenderer.tsx');
  const registry = read('apps/web/src/core/canvas/renderers/CanvasCardRendererRegistry.ts');
  const workspace = read('apps/web/src/pages/Workspace/WorkspacePage.tsx');

  assert.match(renderer, /view\.expanded === true/);
  assert.match(renderer, /primaryMediaNodeId/);
  assert.match(renderer, /data-multi-image-controls="true"/);
  assert.match(renderer, /visibleChildren = expanded \? orderedChildren : orderedChildren\.slice\(0, 1\)/);
  assert.match(registry, /presentationKind === 'multi-image'/);
  assert.match(workspace, /React\.createElement\(cardRenderer/);
});

test('audio uses the real media element and auxiliary cards stay virtualized', () => {
  const image = read('apps/web/src/components/image/ImageCard2.tsx');
  const workspace = read('apps/web/src/pages/Workspace/WorkspacePage.tsx');

  assert.match(image, /<audio/);
  assert.match(image, /ref=\{audioRef\}/);
  assert.match(workspace, /isAuxiliaryCanvasNodeVisible/);
  assert.match(workspace, /activeCanvas\?\.noteNodes[\s\S]{0,220}\.filter\(\(note\) => isAuxiliaryCanvasNodeVisible/);
  assert.match(workspace, /node\.kind === 'workflow-panel'[\s\S]{0,220}isAuxiliaryCanvasNodeVisible/);
});
