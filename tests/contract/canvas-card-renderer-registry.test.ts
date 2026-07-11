import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('Canvas Card Registry registers real renderers through the unified shell path', () => {
  const filenames = [
    'ImageGenerationGroupRenderer.tsx',
    'VideoGenerationGroupRenderer.tsx',
    'MultiImageGroupRenderer.tsx',
    'UnknownCardRenderer.tsx',
  ];
  for (const filename of filenames) {
    const filePath = path.resolve(`apps/web/src/core/canvas/renderers/${filename}`);
    assert.equal(fs.existsSync(filePath), true, `${filename} must exist`);
    assert.ok(fs.readFileSync(filePath, 'utf8').length > 0, `${filename} must not be empty`);
  }

  const registry = fs.readFileSync(path.resolve('apps/web/src/core/canvas/renderers/CanvasCardRendererRegistry.ts'), 'utf8');
  assert.doesNotMatch(registry, /BrowserTaskCardRenderer|AssetCardRenderer|WorkflowCardRenderer|AgentCardRenderer|ExportCardRenderer/);
  for (const removed of ['EcommerceTaskCardRenderer.tsx', 'PptSlideCardRenderer.tsx', 'PptDeckCardRenderer.tsx', 'MusicTaskCardRenderer.tsx']) {
    assert.equal(fs.existsSync(path.resolve(`apps/web/src/core/canvas/renderers/${removed}`)), false);
  }
  for (const removed of ['BrowserTaskCardRenderer.tsx', 'AssetCardRenderer.tsx', 'WorkflowCardRenderer.tsx', 'AgentCardRenderer.tsx', 'ExportCardRenderer.tsx']) {
    assert.equal(fs.existsSync(path.resolve(`apps/web/src/core/canvas/renderers/${removed}`)), false);
  }
});
